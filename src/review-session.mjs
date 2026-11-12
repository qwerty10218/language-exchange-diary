/** @typedef {import('./types').Entry} Entry */
/** @typedef {{queue: Entry[]|null,index:number,revealed:boolean,remembered:number}} Session */
/** @returns {Session} */
export function emptySession() { return {queue:null,index:0,revealed:false,remembered:0}; }
/**
 * @param {Session} state
 * @param {{type:'start',queue:Entry[]}|{type:'reveal'}|{type:'answer',status:'remembered'|'forgotten'}|{type:'setup'}} action
 * @returns {Session}
 */
export function reviewSession(state,action) {
  switch(action.type) {
    case 'start': return {queue:[...action.queue],index:0,revealed:false,remembered:0};
    case 'reveal': return state.queue?.[state.index]?{...state,revealed:true}:state;
    case 'answer': return state.revealed && state.queue?.[state.index]?{...state,index:state.index+1,revealed:false,remembered:state.remembered+(action.status==='remembered'?1:0)}:state;
    case 'setup': return emptySession();
    default: return state;
  }
}
