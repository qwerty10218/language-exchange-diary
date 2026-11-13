const initials=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const vowels=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const finals=['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const mixed={ㅘ:['ㅗ','ㅏ'],ㅙ:['ㅗ','ㅐ'],ㅚ:['ㅗ','ㅣ'],ㅝ:['ㅜ','ㅓ'],ㅞ:['ㅜ','ㅔ'],ㅟ:['ㅜ','ㅣ'],ㅢ:['ㅡ','ㅣ']};
export function syllableParts(text){
  const offset=text.codePointAt(0)-0xac00;
  if([...text].length!==1||offset<0||offset>=11172)return null;
  return {initial:initials[Math.floor(offset/588)],vowel:vowels[Math.floor(offset%588/28)],final:[...finals[offset%28]]};
}
// Rectangles describe actual syllable positions, never separate exercise steps.
export function syllableLayout(text){
  const parts=syllableParts(text);if(!parts)return null;
  const height=parts.final.length?540:800,top=100,bottom=top+height;
  let pieces;
  if(mixed[parts.vowel]){
    const [horizontal,vertical]=mixed[parts.vowel];
    pieces=[{letter:parts.initial,box:[120,top,410,height*.57]},
      {letter:horizontal,box:[110,top+height*.65,530,height*.35]},
      {letter:vertical,box:[680,top,220,height]}];
  }else if('ㅗㅛㅜㅠㅡ'.includes(parts.vowel)){
    pieces=[{letter:parts.initial,box:[170,top,680,height*.48]},
      {letter:parts.vowel,box:[120,top+height*.62,780,height*.38]}];
  }else pieces=[{letter:parts.initial,box:[120,top,430,height]},
    {letter:parts.vowel,box:[640,top,260,height]}];
  if(parts.final.length){
    const count=parts.final.length;
    parts.final.forEach((letter,i)=>pieces.push({letter,box:count===1?[200,730,620,190]:[150+i*390,730,330,190]}));
  }
  return pieces;
}
// The installed Korean assets deliberately use only these absolute SVG commands.
// Unknown commands fail closed instead of emitting a plausible but wrong glyph.
function commands(path){
  const tokens=path.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];
  const result=[];let i=0,command;
  const lengths={M:2,L:2,H:1,V:1,C:6};
  while(i<tokens.length){
    if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++];
    const count=lengths[command];if(!count)throw Error(`Unsupported Korean SVG command: ${command}`);
    const values=tokens.slice(i,i+count).map(Number);if(values.length!==count||values.some(v=>!Number.isFinite(v)))throw Error('Invalid Korean path');
    result.push([command,values]);i+=count;if(command==='M')command='L';
  }
  return result;
}
function bounds(paths){
  const xs=[],ys=[];
  for(const path of paths)for(const [command,values] of commands(path)){
    if(command==='H')xs.push(...values);else if(command==='V')ys.push(...values);
    else for(let i=0;i<values.length;i+=2){xs.push(values[i]);ys.push(values[i+1]);}
  }
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
export const inversePoint=(p,frame)=>({x:(p.x-frame.tx)/frame.sx,y:(p.y-frame.ty)/frame.sy});
export const transformPoint=(p,frame)=>({x:p.x*frame.sx+frame.tx,y:p.y*frame.sy+frame.ty});
export function composeSyllable(text,characters){
  const layout=syllableLayout(text);if(!layout)return null;
  const paths=[],starts=[],strokeTypes=[],strokeFrames=[],components=[];
  for(const {letter,box} of layout){
    const source=characters.find(c=>c.language==='ko'&&c.display===letter);
    if(!source?.paths.length||source.technicalStatus!=='passed')return null;
    const b=bounds(source.paths),[x,y,width,height]=box;
    let sx=b.width>0?width/b.width:height/b.height,sy=b.height>0?height/b.height:sx;
    if(source.category==='ko_consonants'){
      const distortion=letter==='ㅇ'?1.1:1.6;
      sx=Math.min(sx,sy*distortion);sy=Math.min(sy,sx*distortion);
    }
    const frame={sx,sy,tx:x+(width-b.width*sx)/2-b.x*sx,ty:y+(height-b.height*sy)/2-b.y*sy,sourceId:source.id};
    components.push({display:letter,creator:source.creator,license:source.license,source:source.source});
    source.paths.forEach((path,index)=>{
      paths.push(commands(path).map(([command,values])=>command+values.map((value,i)=>{
        const isX=command==='H'||command!=='V'&&i%2===0;
        return Number((value*(isX?sx:sy)+(isX?frame.tx:frame.ty)).toFixed(6));
      }).join(' ')).join(' '));
      const start=source.starts[index],p=transformPoint({x:start[0],y:start[1]},frame);
      const dx=start[2]*sx,dy=start[3]*sy,length=Math.hypot(dx,dy);
      starts.push([p.x,p.y,dx/length*60,dy/length*60]);
      strokeTypes.push(source.strokeTypes[index]);strokeFrames.push({...frame,sourceIndex:index});
    });
  }
  return {id:`ko-block-${text.codePointAt(0).toString(16)}`,display:text,language:'ko',category:'ko_syllable',label:'韓文音節',reading:text,romanization:'',paths,starts,strokeCount:paths.length,order:paths.map((_,i)=>i+1),directions:starts.map(p=>({from:p.slice(0,2),vector:p.slice(2)})),strokeTypes,strokeFrames,components,humanStatus:'pending',technicalStatus:'pending',issues:[],missingReason:null,source:null,license:'CC-BY-SA-4.0',modification:'既有中心線仿射縮放及音節字塊定位；原組件來源與授權分別保留。',creator:null,sourceHash:null,sourceFile:null,pronunciationNote:'',readingSource:'https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-18/'};
}
