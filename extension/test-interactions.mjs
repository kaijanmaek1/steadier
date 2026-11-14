import assert from 'node:assert/strict';
import {createActionQueue,createPanelState,reconcilePanelState,sessionKey,selectCurrent} from './panel-state.mjs';

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
