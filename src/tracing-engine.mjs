import settings from '../data/hangul-settings.json' with {type:'json'};
import {distance,resample,insideSquare,project} from './stroke-engine.mjs';
export const HANGUL_SETTINGS=settings;
export function validateTracingSettings(config=settings){
  const errors=[];
  const bounds={startRadius:[.05,.25],snapRadius:[.05,.25],maxDeviation:[.1,.35],completion:[.75,1],closeRatio:[.6,1],sampleSpacing:[1,8],maxInputGap:[.02,.12],maxInputFraction:[.05,.3],maxSearchFraction:[.02,.18],maxReverseTravel:[.01,.06],forwardSlack:[0,.01],travelMultiplier:[1,2],endpointRadius:[.03,.1],endpointFraction:[.03,.15],initialDirectionDistance:[.005,.03],initialTangentDistance:[.01,.04],initialTangentFraction:[.05,.2],initialDirectionCosine:[-.5,0],competingStartMargin:[0,.05],competingTraceMargin:[0,.03],competingTraceLimit:[.02,.08],animationMs:[500,4000],acceptanceMs:[200,1000],minPoints:[4,16]};
  for(const[key,[min,max]]of Object.entries(bounds))if(!Number.isFinite(config[key])||config[key]<min||config[key]>max)errors.push(`韓文設定 ${key} 超出範圍`);
  if(config.snapRadius>config.maxDeviation)errors.push('磁吸不可大於偏移容忍');
  if(config.side!==1024||config.strictOrder!==true||config.rejectBackwards!==true||typeof config.showGuides!=='boolean')errors.push('字框、筆序與方向設定不符');
  for(const [type,value]of Object.entries(config.types??{}))if(!['straight','curve','turn','short','crossing'].includes(type)||Object.keys(value).some(k=>k!=='maxSearchFraction')||('maxSearchFraction'in value&&(value.maxSearchFraction<.02||value.maxSearchFraction>.18)))errors.push(`類型設定不符：${type}`);
  for(const [id,value]of Object.entries(config.overrides??{})){
    if(!value.reason?.trim()||!value.strokes){errors.push(`覆寫 ${id} 缺少理由`);continue;}
    for(const [i,fields]of Object.entries(value.strokes))for(const [key,number]of Object.entries(fields)){
      if(!bounds[key]||!Number.isFinite(number)||number<bounds[key][0]||number>bounds[key][1])errors.push(`覆寫 ${id}/${i}/${key} 不符範圍`);
    }
  }
  return errors;
}
export function tracingOptions(character,index) {
  const {types,overrides,...global}=settings;
  return {...global,...Object.assign({},...(character.strokeTypes?.[index]??[]).map(type=>types[type]??{})),...(overrides[character.id]?.strokes?.[index]??{})};
}
const errorFor=(actual,expected)=>{
  const a=resample(actual),b=resample(expected);
  return a.length&&b.length?a.reduce((sum,p,i)=>sum+distance(p,b[i]),0)/a.length:Infinity;
};
// Shared full-trace recognizer. Only the expected stroke can reveal ink.
// Progress is an arc length, bounded by local search and physical input travel.
export function createTracingStroke(allStrokes,index,overrides={}) {
  const config={...settings,...overrides};
  const expected=allStrokes[index]??[];
  const total=expected.slice(1).reduce((n,p,i)=>n+distance(expected[i],p),0);
  const samples=resample(expected,Math.max(2,Math.ceil(total/config.sampleSpacing)+1));
  const lengths=[0];for(let i=1;i<samples.length;i++) lengths.push(lengths[i-1]+distance(samples[i-1],samples[i]));
  const length=lengths.at(-1);
  const trace={
    phase:'waiting',rawPoints:[],snappedPoints:[],progress:0,arc:0,coveredArc:0,rawTravel:0,closeTravel:0,
    directionArc:0,directionPeak:0,reverseTravel:0,pendingTravel:0,recovering:false,invalid:'',
    startOffset:{x:0,y:0},result:{ok:false,reason:'尚未書寫。'},
    start(point) {
      if(this.phase!=='waiting')return;
      this.phase='drawing';this.rawPoints.push({...point});
      if(!samples.length||!insideSquare(point,config.side)) {this.invalid='請在字框內開始。';return;}
      this.startOffset={x:point.x-samples[0].x,y:point.y-samples[0].y};
      const own=distance(point,samples[0]);
      const competitor=allStrokes.some((ps,j)=>j!==index&&ps.length&&distance(point,ps[0])+config.side*config.competingStartMargin<own);
      if(own>config.side*config.startRadius||competitor) this.invalid=`筆順不符，請從第 ${index+1} 筆數字起點開始。`;
      else this.snappedPoints.push(samples[0]);
    },
    add(point) {
      if(this.phase!=='drawing')return;
      const previous=this.rawPoints.at(-1);this.rawPoints.push({...point});
      if(!insideSquare(point,config.side)){this.invalid||='超出字框，請重畫目前這一筆。';return;}
      if(this.invalid||!previous)return;
      const travel=distance(previous,point);if(!travel)return;
      this.rawTravel+=travel;
      if(travel>Math.min(config.side*config.maxInputGap,length*config.maxInputFraction)){this.invalid='軌跡不連續，請勿跳過筆畫。';return;}
      // Translate only the direction probe, never the rendered centerline.
      const directionPoint={x:point.x-this.startOffset.x,y:point.y-this.startOffset.y};
      const net=distance(this.rawPoints[0],point);
      if(this.directionPeak<config.side*config.initialDirectionDistance&&net>=config.side*config.initialDirectionDistance) {
        const tangent=Math.min(length*config.initialTangentFraction,config.side*config.initialTangentDistance);
        const tip=project(samples[0],samples,lengths,tangent,tangent)?.point;
        if(tip){const dx=point.x-this.rawPoints[0].x,dy=point.y-this.rawPoints[0].y,tx=tip.x-samples[0].x,ty=tip.y-samples[0].y;
          if((dx*tx+dy*ty)/(Math.hypot(dx,dy)*Math.hypot(tx,ty))<config.initialDirectionCosine){this.invalid='方向相反，請沿起點箭頭描寫。';return;}}
      }
      this.pendingTravel+=travel;
      const window=Math.min(config.side*config.maxInputGap,length*config.maxSearchFraction,this.pendingTravel*config.travelMultiplier+config.side*config.forwardSlack);
      const direction=project(directionPoint,samples,lengths,Math.max(0,this.directionArc-window),Math.min(length,this.directionArc+window));
      if(direction){this.directionArc=direction.arc;this.directionPeak=Math.max(this.directionPeak,direction.arc);this.reverseTravel=this.directionPeak-direction.arc;
        if(this.reverseTravel>config.side*config.maxReverseTravel){this.invalid='方向相反，請沿箭頭前進。';return;}}
      const match=project(point,samples,lengths,this.arc,Math.min(length,this.arc+window));
      if(!match||match.gap>config.side*config.maxDeviation){this.invalid='偏離目前筆畫太遠，請重畫這一筆。';return;}
      if(match.gap>config.side*config.snapRadius){this.recovering=true;return;}
      this.closeTravel+=travel;
      if(match.arc<=this.arc)return;
      const advance=match.arc-this.arc;
      if(!this.recovering)this.coveredArc+=advance;
      this.recovering=false;
      for(let i=1;i<samples.length;i++)if(lengths[i]>this.arc&&lengths[i]<match.arc)this.snappedPoints.push(samples[i]);
      this.snappedPoints.push(match.point);this.arc=match.arc;this.progress=this.arc/length;
      this.pendingTravel=Math.max(0,this.pendingTravel-advance/config.travelMultiplier);
    },
    reason() {
      if(this.invalid)return this.invalid;
      if(this.recovering)return '暫時離開引導線，回到目前筆跡附近可繼續。';
      if(this.rawPoints.length<config.minPoints||this.rawTravel<length*config.completion)return '這一筆還太短，請沿線繼續。';
      if(this.progress<config.completion||this.coveredArc/length<config.completion)return '尚未完成這一筆，請勿跳過中段。';
      const last=this.rawPoints.at(-1),alignedEnd={x:last.x-this.startOffset.x,y:last.y-this.startOffset.y};
      // A small constant finger offset is already allowed at the start. Apply the
      // same translation to the end test instead of making short strokes stricter.
      if(Math.min(distance(last,samples.at(-1)),distance(alignedEnd,samples.at(-1)))>Math.min(config.side*config.endpointRadius,length*config.endpointFraction))return '請沿線寫到這一筆終點。';
      if(this.closeTravel/this.rawTravel<config.closeRatio)return '請多沿著目前引導線描寫。';
      const own=errorFor(this.rawPoints,expected);
      if(allStrokes.some((ps,j)=>j!==index&&errorFor(this.rawPoints,ps)<Math.min(config.side*config.competingTraceLimit,own-config.side*config.competingTraceMargin)))return `筆順不符，現在需要第 ${index+1} 筆。`;
      return '';
    },
    canAutoComplete(){return this.phase==='drawing'&&!this.reason();},
    finish(){if(this.phase!=='drawing')return this.result;this.phase='validating';const reason=this.reason();this.result={ok:!reason,reason:reason||'這一筆完成！'};this.phase=reason?'rejected':'accepted';return this.result;},
    finishDirection(){return this.finish();},
    cancel(){if(this.phase==='drawing'||this.phase==='validating'){this.phase='rejected';this.snappedPoints=[];this.result={ok:false,reason:'書寫已中斷，保留已完成筆畫，請重畫目前這一筆。'};}},
    afterAnimation(last=false){if(this.phase==='accepted')this.phase=last?'completed':'waiting';},
  };
  return trace;
}
