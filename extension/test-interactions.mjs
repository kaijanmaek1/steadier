import assert from 'node:assert/strict';
import {createActionQueue,createPanelState,reconcilePanelState,sessionKey,selectCurrent,isolatePanelKeyboard,clampPanelSize,resizePanelRect} from './panel-state.mjs';

// Panel keyboard isolation must leave browser typing defaults intact.
const keyboardTarget=new EventTarget();
isolatePanelKeyboard(keyboardTarget);
for(const type of ['keydown','keypress','keyup']){
 const event=new Event(type,{bubbles:true,cancelable:true});
 let stopped=false;
 event.stopPropagation=()=>{stopped=true;};
 keyboardTarget.dispatchEvent(event);
 assert.equal(stopped,true);assert.equal(event.defaultPrevented,false);
}
assert.deepEqual(clampPanelSize(400,500,1200,900),{width:400,height:500});
assert.deepEqual(clampPanelSize(2000,2000,800,600),{width:784,height:584});
assert.deepEqual(clampPanelSize(50,50,800,600),{width:280,height:180});
assert.deepEqual(clampPanelSize(400,500,240,160),{width:224,height:144});

// Every edge/corner moves only its selected boundaries and anchors opposites.
const rect={x:200,y:150,width:400,height:300};
for(const direction of ['n','s','e','w','nw','ne','sw','se']){
 const result=resizePanelRect(rect,direction,30,20,1200,900);
 assert.equal(result.x,direction.includes('w')?230:200);
 assert.equal(result.y,direction.includes('n')?170:150);
 assert.equal(result.x+result.width,direction.includes('e')?630:600);
 assert.equal(result.y+result.height,direction.includes('s')?470:450);
}
assert.deepEqual(resizePanelRect(rect,'nw',1000,1000,1200,900),{x:320,y:270,width:280,height:180});
assert.deepEqual(resizePanelRect(rect,'nw',-1000,-1000,1200,900),{x:0,y:0,width:600,height:450});
assert.deepEqual(resizePanelRect(rect,'se',1000,1000,1200,900),{x:200,y:150,width:1000,height:750});
assert.deepEqual(resizePanelRect(rect,'se',-1000,-1000,1200,900),{x:200,y:150,width:280,height:180});
assert.deepEqual(resizePanelRect({x:8,y:8,width:224,height:144},'nw',100,100,240,160),{x:8,y:8,width:224,height:144});
assert.deepEqual(resizePanelRect({x:0,y:0,width:280,height:180},'nw',1000,1000,1200,900),{x:0,y:0,width:280,height:180});
assert.deepEqual(resizePanelRect({x:0,y:0,width:280,height:180},'se',2000,2000,1200,900),{x:0,y:0,width:1184,height:884});

// Same-session storage updates/preferences must not erase a confirmed mood,
// checkbox consent, unfinished request, or end-session reflection.
const form=createPanelState();
const idle={consent:false,active:null,lastIntent:{prompt:'nature',mode:'both'}};
reconcilePanelState(form,undefined,idle);
form.mood=37;form.touched=true;form.consent=true;
form.intent={prompt:'dogs, less politics',mode:'memes'};form.intentDirty=true;
assert.equal(reconcilePanelState(form,idle,{...idle,preferences:{Music:'hide'}}),false);
assert.equal(form.mood,37);assert.equal(form.touched,true);assert.equal(form.consent,true);
assert.equal(form.intent.prompt,'dogs, less politics');

// Structural changes caused by another tab reset the appropriate local form.
const active={...idle,consent:true,active:{sessionId:'first',startedAt:100,intent:{prompt:'music',mode:'both'}}};
assert.equal(reconcilePanelState(form,idle,active),true);
assert.equal(form.touched,false);assert.equal(form.mood,50);assert.equal(form.intent.prompt,'music');
form.ending=true;form.mood=61;form.touched=true;
assert.equal(reconcilePanelState(form,active,{...active}),false);
assert.equal(form.ending,true);assert.equal(form.mood,61);assert.equal(form.touched,true);
assert.equal(reconcilePanelState(form,active,{...idle,consent:true}),true);
assert.equal(form.ending,false);assert.equal(form.touched,false);

// Deletion is meaningful even if neither tab had an active session.
form.consent=true;form.intent={prompt:'private saved request'};form.intentDirty=true;form.confirmDelete=true;
assert.equal(reconcilePanelState(form,idle,{active:null,consent:false},{reset:true}),true);
assert.equal(form.intent,null);assert.equal(form.consent,false);assert.equal(form.intentDirty,false);assert.equal(form.confirmDelete,false);
form.intent={prompt:'new idle draft'};form.intentDirty=true;form.mood=73;form.touched=true;
assert.equal(reconcilePanelState(form,{active:null,consent:false,resetEpoch:1},{active:null,consent:false,resetEpoch:2}),true);
assert.equal(form.intent,null);assert.equal(form.touched,false);assert.equal(form.mood,50);
assert.notEqual(sessionKey(active),sessionKey({...active,active:{...active.active,sessionId:'second'}}));

// No previous video may stay current when it is removed, covered or out of view.
const now=10_000;
const old={id:'old',video:{isConnected:true},since:6000};
const next={id:'next',video:{isConnected:true},since:7500};
assert.equal(selectCurrent([old,next],now),next);
next.cover={};assert.equal(selectCurrent([old,next],now),old);
old.since=0;assert.equal(selectCurrent([old,next],now),null);
next.revealed=true;assert.equal(selectCurrent([old,next],now),next);
next.video.isConnected=false;assert.equal(selectCurrent([old,next],now),null);
const justVisible={video:{isConnected:true},since:9000};
assert.equal(selectCurrent([justVisible],now),null);

// Rapid interactions are queued rather than discarded. A failed write must
// reject its own caller, skip success cleanup, and allow the next action.
const queue=createActionQueue(),events=[];
let release;
const gate=new Promise(resolve=>{release=resolve;});
const first=queue(async()=>{events.push('first started');await gate;throw Error('write failed');});
const second=queue(async()=>{events.push('second saved');return 'saved';});
let successCleanup=false;
const caught=first.then(()=>{successCleanup=true;},error=>{assert.equal(error.message,'write failed');events.push('first rejected');});
await Promise.resolve();assert.deepEqual(events,['first started']);
release();await caught;assert.equal(await second,'saved');assert.equal(successCleanup,false);
assert.ok(events.indexOf('second saved')>events.indexOf('first started'));
console.log('Passed: confirmed form preservation, cross-tab session transitions, idle reset privacy, current-video selection, queued actions and failure recovery.');

