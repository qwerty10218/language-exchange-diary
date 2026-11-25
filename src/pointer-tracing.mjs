
// Only bridge fresh pointer samples along a verified, nearly straight section.
// No timestamps (offline QA), pauses, corners and large teleports stay strict.
export function bridgePointerGap(previous,point,limit,samples,lengths,arc,side,project,offset={x:0,y:0},allowEnd=false,corridorTolerance=null){
  const travel=Math.hypot(previous.x-point.x,previous.y-point.y),elapsed=point.time-previous.time;
  if(travel<=limit||!(elapsed>=0&&elapsed<=120)||travel>side*.4)return null;
  const count=Math.ceil(travel/(limit*.5)),result=[];
  let cursor=arc;
  const tolerance=corridorTolerance??Math.min(side*.025,lengths.at(-1)*.03);
  for(let i=1;i<=count;i++){
    const t=i/count,p={x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t,interpolated:true,time:previous.time+elapsed*t};
    const probe={x:p.x-offset.x,y:p.y-offset.y};
    const match=project(probe,samples,lengths,cursor,Math.min(lengths.at(-1),arc+travel*1.6));
    if(!match)return null;
    if(match.gap>tolerance){
      const end=samples.at(-1),tip=project(end,samples,lengths,Math.max(0,lengths.at(-1)-24),Math.max(0,lengths.at(-1)-24))?.point;
      if(!allowEnd||!tip||match.arc<lengths.at(-1)-.01)return null;
      const span=Math.hypot(end.x-tip.x,end.y-tip.y),dx=probe.x-end.x,dy=probe.y-end.y;
      const along=(dx*(end.x-tip.x)+dy*(end.y-tip.y))/span,cross=Math.abs(dx*(end.y-tip.y)-dy*(end.x-tip.x))/span;
      if(along<0||along>side*.2||cross>tolerance)return null;
    }
    cursor=match.arc;result.push(p);
  }
  return result;
}

export const insideDrawingArea=(p,padding=0)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-padding&&p.y>=-padding&&p.x<=1024+padding&&p.y<=1024+padding;
