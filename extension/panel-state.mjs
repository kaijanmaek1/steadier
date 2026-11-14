// Small, browser-independent state helpers for the extension panel.
export function createActionQueue(){
 let tail=Promise.resolve();
 return task=>{const result=tail.then(task);tail=result.catch(()=>{});return result;};
}

export function sessionKey(state){
 const active=state?.active;
 return active?active.sessionId||`${active.platform||''}:${active.startedAt}`:null;
}

export function createPanelState(){
 return {mood:50,touched:false,consent:false,intent:null,intentDirty:false,ending:false,confirmDelete:false};
}

export function reconcilePanelState(panel,previous,next,{reset=false}={}){
 const changed=sessionKey(previous)!==sessionKey(next);
 const epochChanged=!!previous&&(previous.resetEpoch||0)!==(next?.resetEpoch||0);
 if(reset||changed||epochChanged){
  Object.assign(panel,createPanelState());
  panel.intent=next?.active?.intent||next?.lastIntent||null;
 }else if(!panel.intentDirty){
  panel.intent=next?.active?.intent||next?.lastIntent||panel.intent;
 }
 return changed||reset||epochChanged;
}

export function selectCurrent(items,now=Date.now()){
 return [...items].filter(item=>item.video.isConnected&&item.since&&now-item.since>=2000&&!item.autoSkipping&&(!item.cover||item.revealed))
  .sort((a,b)=>b.since-a.since)[0]||null;
}

// Attribute ownership permits two masks to temporarily cover the same subtree.
// Each attribute is restored to its original value only when its final owner exits.
const maskedElements=new Map();
export function createMediaMask(root,overlay){
 const owner={},owned=new Set();let active=true;
 function release(element){
  const record=maskedElements.get(element);owned.delete(element);
  if(!record)return;
  record.owners.delete(owner);
  if(record.owners.size)return;
  for(const [name,value] of Object.entries(record.before)){
   if(value===null)element.removeAttribute(name);else element.setAttribute(name,value);
  }
  maskedElements.delete(element);
 }
 function refresh(){
  if(!active)return;
  const children=new Set([...root.children].filter(element=>element!==overlay));
  for(const element of [...owned])if(!children.has(element))release(element);
  for(const element of children){
   let record=maskedElements.get(element);
   if(!record){record={before:{inert:element.getAttribute('inert'),'aria-hidden':element.getAttribute('aria-hidden')},owners:new Set()};maskedElements.set(element,record);}
   record.owners.add(owner);owned.add(element);
   element.setAttribute('inert','');element.setAttribute('aria-hidden','true');
  }
 }
 function restore(){if(!active)return;active=false;for(const element of [...owned])release(element);}
 refresh();return {refresh,restore};
}
