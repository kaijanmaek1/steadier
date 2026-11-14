// Navigation policy only: classifications are estimates, never a mood guarantee.
export function advanceVideo({active,target,retry},next,{style=getComputedStyle}={}) {
  if(retry && next) {next.click();return;}
  if(retry) {
    for(let node=active.video.parentElement;node;node=node.parentElement) {
      if(node.scrollHeight>node.clientHeight+20 && /auto|scroll/.test(style(node).overflowY)) {
        node.scrollBy({top:Math.max(1,node.clientHeight),behavior:'instant'});return;
      }
    }
  }
  if(target) target.video.scrollIntoView({behavior:'instant',block:'center'});
  else if(next) next.click();
}
export function createAutoSkip({limit=10,cooldown=700,backoff=5000}={}) {
  let session=null, attempted=new Map(), count=0, last=-Infinity, clearSince=null, retryAfter=0;
  function reset(key=null) {session=key;attempted=new Map();count=0;last=-Infinity;clearSince=null;retryAfter=0;}
  function next({key,enabled,visible=true,paused=false,items,now=Date.now(),height,canAdvance=false}) {
    if (key!==session) reset(key);
    if (!key || !enabled || !visible || paused) return null;
    const ordered=items.filter(item=>item.connected && item.rect.width>0 && item.rect.height>0)
      .sort((a,b)=>a.rect.top-b.rect.top);
    const active=ordered.map(item=>({item,overlap:Math.max(0,Math.min(height,item.rect.bottom)-Math.max(0,item.rect.top))}))
      .filter(({item,overlap})=>overlap>=Math.min(item.rect.height,height)*.5)
      .sort((a,b)=>b.overlap-a.overlap)[0]?.item;
    if (!active) return null;
    if (!active.blocked || active.revealed) {
      clearSince ??= now;
      if(now-clearSince>=3000) {count=0;attempted.clear();retryAfter=0;}
      return null;
    }
    clearSince=null;
    if(now<retryAfter) return null;
    if(count>=limit) {count=0;retryAfter=now+backoff;return {waiting:true};}
    const attempt=attempted.get(active.id);
    if(now-last<cooldown || (attempt && now<attempt.after)) return null;
    const upcoming=ordered.slice(ordered.indexOf(active)+1,ordered.indexOf(active)+11);
    // Prefer an already-loaded permitted item; otherwise advance one item to load more.
    const target=upcoming.find(item=>!item.blocked || item.revealed) || upcoming[0] || null;
    if (!target && !canAdvance) return null;
    const tries=(attempt?.tries || 0)+1;
    attempted.set(active.id,{tries,after:now+(tries%3===0 ? backoff : cooldown)});count++;last=now;
    return {active:active.item,target:target?.item || null,retry:tries>1};
  }
  return {next,reset};
}
