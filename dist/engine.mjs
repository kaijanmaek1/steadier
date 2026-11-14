export const categories = ['Nature','Music','Creativity','Connection','News','Comparison'];
export function fresh(){return {version:1,consent:false,sessions:[],active:null,preferences:Object.fromEntries(categories.map(c=>[c,'adaptive']))};}
export function scoreCategory(state,category){
 const relevant=state.sessions.filter(s=>s.seen.some(p=>p.category===category));
 let votes=0,total=0;
 for(const s of relevant){for(const p of s.seen.filter(p=>p.category===category)){const v=s.feedback[p.id];if(v){votes+=v;total++;}}}
 const direct=total?votes/(total+3):0;
 // Session changes are shared associations, shrunk strongly and only used after 3 sessions.
 const association=relevant.length>=3?relevant.reduce((n,s)=>n+(s.after-s.before)/100,0)/(relevant.length+5):0;
 return {score:Math.max(-1,Math.min(1,direct*.85+association*.15)),sessions:relevant.length,votes:total};
}
export function hidden(state,category){const p=state.preferences[category];return p==='hide'||(p==='adaptive'&&scoreCategory(state,category).score<-.22);}
export function finish(state,after,worthwhile){if(!state.active)throw new Error('No active session');if(!Number.isInteger(after)||after<0||after>100)throw new Error('Invalid mood');const s={...state.active,after,worthwhile,endedAt:Date.now()};state.sessions.push(s);state.active=null;return s;}
