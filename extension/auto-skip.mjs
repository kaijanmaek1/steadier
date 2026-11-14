// Navigation policy only: classifications are estimates, never a mood guarantee.
export function filterPresentation({blocked,revealed,allowed=true,platform,automatic,active,canAdvance=true}) {
  if(!allowed || !blocked || revealed) return 'show';
  return ['TikTok','Instagram'].includes(platform) && automatic && active && canAdvance ? 'skip' : 'cover';
}
// Only explicit feed navigation controls are eligible. Instagram carousel
// arrows on the home feed are not reel navigation and must never be clicked.
export function findNextVideoControl(document,platform) {
  if(!['TikTok','Instagram'].includes(platform)) return null;
  if(platform==='Instagram' && !/^\/reels?\//.test(document.location?.pathname||'')) return null;
  const selector=platform==='TikTok' ? 'button[data-e2e="arrow-right"],button[data-e2e="arrow-down"]' : 'button,[role="button"]';
  for(const button of document.querySelectorAll(selector)) {
    const rect=button.getBoundingClientRect();
    if(button.disabled || button.hidden || button.getAttribute('aria-disabled')==='true' || rect.width<=0 || rect.height<=0) continue;
    const style=document.defaultView?.getComputedStyle(button);
    if(style && (style.visibility==='hidden' || style.display==='none')) continue;
    if(platform==='Instagram') {
      const icon=button.querySelector('svg');
      const labels=[button.getAttribute('aria-label'),button.getAttribute('title'),icon?.getAttribute('aria-label'),icon?.querySelector('title')?.textContent];
      if(!labels.some(label=>/^(?:next(?: reel| video)?|go to next(?: reel| video)?)$/i.test(label?.trim()||''))) continue;
    }
    return button;
  }
  return null;
}
export function silenceFlagged(item,enabled) {
  if(enabled) {
    if(!Object.hasOwn(item,'originalMuted')) item.originalMuted=item.video.muted;
    item.video.muted=true;item.video.pause();
  } else if(Object.hasOwn(item,'originalMuted')) {
    item.video.muted=item.originalMuted;delete item.originalMuted;
  }
}
export function forwardTarget(items,height) {
  const ordered=items.filter(item=>item.connected && item.rect.width>0 && item.rect.height>0).sort((a,b)=>a.rect.top-b.rect.top);
  const index=ordered.findIndex(item=>item.rect.top<=height*.25 && item.rect.bottom>=height*.75);
  if(index<0 || !ordered[index+1]?.blocked || ordered[index+1]?.revealed) return null;
  return ordered.slice(index+2,index+11).find(item=>!item.blocked || item.revealed)?.item || null;
}
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


