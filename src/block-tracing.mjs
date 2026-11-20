import {inversePoint} from './hangul-blocks.mjs';
import {createTracingStroke} from './tracing-engine.mjs';
import {distance} from './stroke-engine.mjs';
// Normalize both input and reference into the original component's coordinate
// system. Rendering a small component never expands its accepted hit region.
export function createBlockStroke(strokes,index,frame,options){
  const normalized=strokes.map(points=>points.map(p=>inversePoint(p,frame)));
  const trace=createTracingStroke(normalized,index,options),sourceLengths=[0],renderLengths=[0];
  for(let i=1;i<strokes[index].length;i++){
    sourceLengths.push(sourceLengths[i-1]+distance(normalized[index][i-1],normalized[index][i]));
    renderLengths.push(renderLengths[i-1]+distance(strokes[index][i-1],strokes[index][i]));
  }
  return {start:p=>trace.start(inversePoint(p,frame)),add:p=>trace.add(inversePoint(p,frame)),finish:()=>trace.finish(),cancel:()=>trace.cancel(),afterAnimation:last=>trace.afterAnimation(last),get progress(){
    const target=trace.progress*sourceLengths.at(-1);let i=1;while(i<sourceLengths.length-1&&sourceLengths[i]<target)i++;
    const span=sourceLengths[i]-sourceLengths[i-1],fraction=span?(target-sourceLengths[i-1])/span:0;
    return (renderLengths[i-1]+fraction*(renderLengths[i]-renderLengths[i-1]))/renderLengths.at(-1);
  },get invalid(){return trace.invalid;},get recovering(){return trace.recovering;}};
}
