import {bridgePointerGap} from './pointer-tracing.mjs';
import {distance,project,resample} from './stroke-engine.mjs';

// Work in CSS pixels after the complete SVG CTM and optional component frame.
// No DPR multiplication: pointer client coordinates already use CSS pixels.
export const TRACK_RADIUS_PX=35;
export function createScreenStroke(strokes,index,space){
  const paths=strokes.map(ps=>ps.map(space.toScreen)),expected=paths[index]??[];
  const samples=resample(expected,Math.max(2,Math.ceil(expected.slice(1).reduce((n,p,i)=>n+distance(expected[i],p),0)/2)+1));
  const lengths=[0];for(let i=1;i<samples.length;i++)lengths.push(lengths[i-1]+distance(samples[i-1],samples[i]));
  const length=lengths.at(-1),radius=space.radiusPx??TRACK_RADIUS_PX;
  const trace={phase:'waiting',progress:0,arc:0,invalid:'',recovering:false,rawPoints:[],snappedPoints:[],travel:0,validTravel:0,observed:0,directionArc:0,peak:0,reverse:0,offset:{x:0,y:0},last:null,observedMiddle:false,bridgedSamples:0,terminal:false,
    result:{ok:false,reason:'尚未書寫。'},
    start(raw){
      this.sourcePoint=raw;
      this.phase='drawing';const p={...space.toScreen(raw),time:raw.time};this.rawPoints.push(p);this.last=p;this.observed=1;
      if(!samples.length||!space.contains(raw)){this.invalid='請在字框內開始。';return;}
      this.offset={x:p.x-samples[0].x,y:p.y-samples[0].y};
      const own=distance(p,samples[0]);
      const competitor=paths.some((ps,j)=>j!==index&&ps.length&&distance(p,ps[0])<8&&distance(p,ps[0])+12<own);
      if(own>radius+.001||competitor)this.invalid=`筆順不符，請從第 ${index+1} 筆數字起點開始。`;
    },
    add(raw){
      this.sourcePoint=raw;
      if(this.phase!=='drawing')return;
      const p={...space.toScreen(raw),time:raw.time};
      if(!space.contains(raw)){this.invalid||='超出字框，請重畫目前這一筆。';return;}
      this.consume(p);
    },
    consume(p){
      const previous=this.last;this.rawPoints.push(p);this.last=p;
      if(this.invalid||!previous)return;
      if(!p.interpolated&&this.progress>=.2&&this.progress<=.8)this.observedMiddle=true;
      const travel=distance(previous,p);if(travel<.0001)return;
      if(!p.interpolated)this.observed++;this.travel+=travel;
      // Follow motion from the previous local cursor, not a permanent start bias.
      // Signed direction has its own cursor so repeated jitter cannot ratchet ink.
      const cursor=project(samples[0],samples,lengths,this.directionArc,this.directionArc)?.point;
      if(cursor)this.offset={x:previous.x-cursor.x,y:previous.y-cursor.y};
      // A real midpoint is required; sparse start/end jumps never buy coverage.
      const limit=Math.max(16,Math.min(54,length*.32));
      if(travel>limit){
        const bridgeTolerance=Math.min(radius*.65,22);
        const bridge=bridgePointerGap(previous,p,limit,samples,lengths,this.arc,Math.max(420,length*1.8),project,this.offset,true,bridgeTolerance);
        if(bridge){this.bridgedSamples+=bridge.length;this.rawPoints.pop();this.last=previous;this.travel-=travel;for(const q of bridge)this.consume(q);return;}
        this.invalid='軌跡不連續，請勿跳過筆畫。';return;
      }
      if(this.progress>=.9&&this.validTravel>=length*.75&&this.observed>=4&&(!this.bridgedSamples||this.observedMiddle)){
        const end=samples.at(-1),tip=samples.at(-2),span=distance(tip,end),dx=p.x-end.x,dy=p.y-end.y;
        const along=(dx*(end.x-tip.x)+dy*(end.y-tip.y))/span,cross=Math.abs(dx*(end.y-tip.y)-dy*(end.x-tip.x))/span;
        this.terminal=along>=0&&along<=Math.max(60,Math.min(120,length*.3))&&cross<=radius;
        if(this.terminal){
          // The real pointer has crossed the endpoint after >=90% valid tracing.
          // Finish the visible tail too, rather than freezing it until release.
          this.arc=length;this.progress=1;this.directionArc=length;this.peak=length;return;
        }
      }
      const window=Math.min(Math.max(24,length*.25),Math.max(8,travel*1.8));
      const aligned={x:p.x-this.offset.x,y:p.y-this.offset.y};
      let match=project(aligned,samples,lengths,Math.max(0,this.directionArc-window),Math.min(length,this.directionArc+window));
      if(!match)return;
      // Corridor distance uses the real pointer, not the start-translated probe.
      // A wider arc search here cannot buy progress: only `match` advances ink.
      const corridor=project(p,samples,lengths,Math.max(0,this.arc-radius),Math.min(length,this.arc+radius+window));
      this.corridorGap=corridor?.gap??Infinity;
      if(this.corridorGap>radius+1){this.recovering=true;return;}
      // At a bend the finger may round the corner while the cursor is still just
      // before it. Catch up only with real forward motion along that nearby branch,
      // within the same physical-travel budget. Sideways jitter buys no progress.
      if(corridor&&corridor.arc>match.arc&&match.arc>=this.directionArc-.001){
        const at=Math.min(length,corridor.arc+2),before=Math.max(0,corridor.arc-2);
        const a=project(samples[0],samples,lengths,before,before)?.point,b=project(samples[0],samples,lengths,at,at)?.point;
        if(a&&b){const dx=p.x-previous.x,dy=p.y-previous.y,span=distance(a,b);
          if(span&&(dx*(b.x-a.x)+dy*(b.y-a.y))/(travel*span)>.35){
            const target=Math.min(corridor.arc,this.directionArc+window);
            match=project(samples[0],samples,lengths,target,target)??match;
          }
        }
      }
      // Track only the current local arc, including crossings and round strokes.
      // Lateral motion cannot accumulate ink: only new arc length earns progress.
      const direction=match;
      if(direction){this.directionArc=direction.arc;this.reverse=Math.max(this.reverse,this.peak-direction.arc);this.peak=Math.max(this.peak,direction.arc);}
      if(this.reverse>Math.max(12,Math.min(20,length*.22))){this.invalid='方向相反，請沿箭頭前進。';return;}
      if(this.recovering)this.recovering=false;
      this.validTravel+=travel;
      this.arc=Math.max(this.arc,match.arc);this.progress=this.arc/length;
    },
    get endpoint(){const p=this.last,limit=Math.min(radius,Math.max(8,length*.13));const gap=p&&samples.length?Math.min(distance(p,samples.at(-1)),distance({x:p.x-this.offset.x,y:p.y-this.offset.y},samples.at(-1))):Infinity;return {distance:gap,limit,ready:this.terminal||gap<=radius+1,verified:this.progress>=.85&&(this.terminal||gap<=radius+1)};},
    wrongShape(){
      if(this.rawPoints.length<4)return false;
      const input=resample(this.rawPoints);
      const error=path=>{const target=resample(path);return target.length?input.reduce((sum,p,i)=>sum+distance(p,target[i]),0)/input.length:Infinity;};
      const own=error(expected);
      return own>12&&paths.some((path,j)=>j!==index&&error(path)<Math.min(6,own-12));
    },
    reason(){return this.invalid||(this.wrongShape()?`筆順不符，現在需要第 ${index+1} 筆。`:'')||(this.recovering?'暫時離開軌道，回到目前筆跡附近可繼續。':'')||(this.observed<4||(this.bridgedSamples&&!this.observedMiddle)||this.progress<.85||this.peak/length<.8||this.validTravel<length*.75?'這一筆還太短或未完成，請沿軌道繼續。':'')||(!this.endpoint.ready?'請沿軌道接近終點。':'');},
    finish(){const reason=this.recovering&&!this.invalid?'放開時仍離開軌道，請重畫目前這一筆。':this.reason();this.result={ok:!reason,reason:reason||'這一筆完成！'};this.phase=reason?'rejected':'accepted';return this.result;},
    finishDirection(){return this.finish();},get readyToRelease(){return this.phase==='drawing'&&!this.reason();},canAutoComplete(){return this.readyToRelease;},
    cancel(){this.invalid='書寫已中斷，請重畫目前這一筆。';this.phase='rejected';this.result={ok:false,reason:this.invalid};},
    afterAnimation(last=false){if(this.phase==='accepted')this.phase=last?'completed':'waiting';},
    get diagnostics(){return {screenSpace:true,radiusPx:radius,progress:this.progress,sourcePoint:this.sourcePoint,screenPoint:this.last,corridorGap:this.corridorGap??null,readyToRelease:this.readyToRelease,reverseTravel:this.reverse,rawTravel:this.travel,recovering:this.recovering,invalid:this.invalid,reason:this.reason()};}
  };return trace;
}




