// Opt-in local diagnostics. Phase0 calls this only in Vite DEV with
// ?writingDebug=1. Nothing is persisted, uploaded, or added to the layout.
export function recordWritingDiagnostic(target,event,svg,details={}){
  const rect=svg?.getBoundingClientRect(),matrix=svg?.getScreenCTM();
  const rows=target.__writingDebug??(target.__writingDebug=[]);
  rows.push({time:performance.now(),event,svgRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
    svgMatrix:matrix?{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f}:null,...details});
  if(rows.length>1000)rows.splice(0,rows.length-1000);
}
