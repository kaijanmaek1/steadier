import assert from 'node:assert/strict';
import {parseIntent,filterReason} from './intent.mjs';

const policy=(prompt,extra={})=>({preferences:{},active:{intent:{plan:parseIntent(prompt),mode:'both',focused:true,strict:false,...extra}}});
const item=(category,text,kind='Unknown')=>({category,matchText:text,analysis:{kind}});

// Exclusions match all readable evidence, not just the single winning category.
assert.ok(filterReason(policy('no politics'),item('Nature','nature forest politics election')));
assert.ok(filterReason(policy('no politics'),item('Unknown','#politics #nature')));
assert.equal(filterReason(policy('no politics'),item('Nature','a forest walk')),'');
assert.equal(filterReason(policy('no politics'),item('Nature','a politicality word')),'');
assert.equal(filterReason(policy('nature'),item('Learning','forest science tutorial')),'');
assert.ok(filterReason(policy('nature'),item('Learning','a science tutorial')));

// Negation applies to lists until an explicit positive instruction or "but".
assert.ok(parseIntent('I want not politics').exclude.includes('News'));
assert.deepEqual(parseIntent('no politics and comparison').include,[]);
assert.ok(parseIntent('no politics and comparison').exclude.includes('Comparison'));
assert.ok(parseIntent('no politics but show dogs').includeTerms.includes('dog'));
assert.ok(parseIntent('don’t show politics').exclude.includes('News'));
assert.equal(parseIntent('a mix of memes and serious content').mode,'both');
assert.deepEqual(parseIntent('a mix of memes and serious content').includeTerms,[]);
assert.equal(parseIntent('no memes, show serious content').mode,'serious');
assert.equal(parseIntent('no serious content, more memes').mode,'memes');

// A known topic does not make an unknown style certain in a style-only session.
assert.ok(filterReason(policy('',{mode:'serious',strict:true}),item('Nature','forest walk','Unknown')));
assert.ok(filterReason(policy('',{mode:'memes',strict:true}),item('Nature','forest walk','Mixed / uncertain')));
assert.equal(filterReason(policy('',{mode:'serious',strict:false}),item('Nature','forest walk','Unknown')),'');
assert.equal(filterReason(policy('',{mode:'both',strict:true}),item('Nature','forest walk','Unknown')),'');
assert.ok(filterReason(policy('',{strict:true}),item('Unknown','','Meme / humour')));

// Run the real service worker handler against isolated, cloned local storage.
let handler,db={};
globalThis.chrome={runtime:{onMessage:{addListener(fn){handler=fn;}}},storage:{local:{async get(){return structuredClone(db);},async set(value){db=structuredClone(value);}}}};
await import('./background.js');
const sender={tab:{id:1},frameId:0,url:'https://www.tiktok.com/foryou'};
const call=(message,from=sender)=>new Promise(resolve=>handler(message,from,resolve));
const start=()=>call({type:'start',protocol:2,consent:true,mood:50});
let result=await start();
const first=result.state.active.sessionId;assert.match(first,/^[0-9a-f-]{36}$/i);
assert.ok((await call({type:'seen',id:'video',category:'Nature'})).error);
assert.equal((await call({type:'get'})).state.active.seen.length,0);
await call({type:'seen',id:'video',category:'Nature',sessionId:first});
assert.equal((await call({type:'get'})).state.active.seen.length,1);

for(const url of ['https://www.tiktok.com/messages','https://www.instagram.com/direct/inbox/']){
 const privateSender={...sender,url};
 assert.ok((await call({type:'start',protocol:2,consent:true,mood:50},privateSender)).error);
 assert.ok((await call({type:'seen',id:'private-video',category:'Nature',sessionId:first},privateSender)).error);
 assert.ok(!(await call({type:'get'},privateSender)).error);
}
assert.ok((await call({type:'seen',id:'frame-video',category:'Nature',sessionId:first},{...sender,frameId:1})).error);
for(const id of ['', ' ', '__proto__','constructor','prototype','a\ncaption','x'.repeat(301)])assert.ok((await call({type:'seen',id,category:'Nature',sessionId:first})).error);
assert.equal((await call({type:'get'})).state.active.seen.length,1);

// In-flight work cannot recreate records after reset or affect a new session.
await call({type:'reset'});
assert.ok((await call({type:'like',id:'old-video',category:'Nature',liked:true,sessionId:first})).error);
result=await start();const second=result.state.active.sessionId;assert.notEqual(second,first);
for(const type of ['seen','vote','category','update','like','intent','end']){
 const stale=await call({type,id:'old-video',category:'Nature',liked:true,value:1,mood:60,sessionId:first,intent:{prompt:'old prompt'}});
 assert.ok(stale.error,`stale ${type} rejected`);
}
result=await call({type:'get'});assert.equal(result.state.active.sessionId,second);assert.equal(result.state.active.seen.length,0);assert.equal(result.state.likes,undefined);
await call({type:'end',mood:60,sessionId:second});assert.equal((await call({type:'get'})).state.sessions.length,1);
assert.ok((await call({type:'seen',id:'late-video',category:'Nature',sessionId:second})).error);

// Existing legacy clients and stored sessions remain usable.
await call({type:'start',consent:true,mood:40});
assert.ok(!(await call({type:'seen',id:'legacy-video',category:'Music'})).error);
await call({type:'end',mood:45});assert.equal((await call({type:'get'})).state.sessions.length,2);
// A protocol-2 event must not fall through when another tab starts a legacy session.
await call({type:'reset'});await call({type:'start',consent:true,mood:40});
for(const type of ['seen','vote','category','update','like','intent','end']){
 const stale=await call({type,id:'stale-modern-video',category:'Nature',liked:true,value:1,mood:60,sessionId:first,intent:{prompt:'stale modern prompt'}});
 assert.ok(stale.error,`modern ${type} rejected in a new legacy session`);
}
result=await call({type:'get'});assert.equal(result.state.active.before,40);assert.equal(result.state.active.seen.length,0);assert.equal(result.state.likes,undefined);assert.equal(result.state.sessions.length,0);
assert.ok(!(await call({type:'seen',id:'genuine-legacy-video',category:'Music'})).error);
assert.ok(!(await call({type:'end',mood:45})).error);
// Every current-client write is fenced across deletion, including non-session writes.
const oldEpoch=(await call({type:'get'})).state.resetEpoch||0;
result=await call({type:'reset',resetEpoch:oldEpoch});const newEpoch=result.state.resetEpoch;
assert.equal(newEpoch,oldEpoch+1);
assert.ok((await call({type:'preference',category:'News',value:'hide',resetEpoch:oldEpoch})).error);
assert.ok((await call({type:'start',protocol:2,consent:true,mood:40,intent:{prompt:'stale prompt'},resetEpoch:oldEpoch})).error);
assert.ok((await call({type:'reset',resetEpoch:oldEpoch})).error);
result=await call({type:'get'});assert.equal(result.state.resetEpoch,newEpoch);assert.equal(result.state.active,null);assert.equal(result.state.lastIntent,undefined);assert.equal(result.state.preferences.News,'adaptive');
assert.ok(!(await call({type:'preference',category:'News',value:'hide',resetEpoch:newEpoch})).error);
result=await call({type:'start',protocol:2,consent:true,mood:40,resetEpoch:newEpoch});assert.ok(result.state.active.sessionId);
assert.ok(!(await call({type:'reset',resetEpoch:newEpoch})).error);
console.log('Passed: mixed-topic exclusions, negation lists, mixed style, strict uncertainty, protocol-2 stale-session protection, private-route exclusion, identity bounds and legacy compatibility.');
