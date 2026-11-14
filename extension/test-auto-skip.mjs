import assert from 'node:assert/strict';
import {createAutoSkip,advanceVideo,filterPresentation,silenceFlagged,forwardTarget,findNextVideoControl} from './auto-skip.mjs';
import {selectCurrent} from './panel-state.mjs';
import {parseIntent,filterReason} from './intent.mjs';
const video=(id,top,blocked=true,extra={})=>({id,item:{id},connected:true,rect:{top,bottom:top+800,width:450,height:800},blocked,...extra});
const policy=createAutoSkip();
const input={key:'one',enabled:true,height:800,now:0,items:[video('bad',0),video('bad-next',800),video('allowed',1600,false)]};
const mode={blocked:true,platform:'TikTok',automatic:true,active:true};
assert.equal(filterPresentation(mode),'skip','automatic TikTok never enters the cover/Reveal rendering branch');
assert.equal(filterPresentation({...mode,automatic:false}),'cover','manual mode retains Reveal overlay');
assert.equal(filterPresentation({...mode,platform:'Instagram'}),'skip');
assert.equal(filterPresentation({...mode,platform:'Instagram',canAdvance:false}),'cover','no safe navigation retains a paused cover rather than displaying blocked content');
assert.equal(filterPresentation({...mode,platform:'Other'}),'cover');
assert.equal(filterPresentation({...mode,active:false,blocked:false}),'show');
assert.equal(filterPresentation({...mode,revealed:true}),'show');
// Real control selection rejects disabled/hidden and non-reel carousel arrows.
const control=(label,extra={})=>({disabled:false,hidden:false,getBoundingClientRect:()=>({width:44,height:44}),getAttribute:name=>name==='aria-label'?label:null,querySelector:()=>null,...extra});
const hidden=control('Next',{getBoundingClientRect:()=>({width:0,height:0})});
const disabled=control('Next',{disabled:true});
const wrong=control('Next photo');
const reel=control('Next reel');
const fixture=(pathname,buttons)=>({location:{pathname},querySelectorAll:()=>buttons});
assert.equal(findNextVideoControl(fixture('/reels/test/',[wrong,hidden,disabled,reel]),'Instagram'),reel);
assert.equal(findNextVideoControl(fixture('/',[reel]),'Instagram'),null,'home carousel Next cannot advance the feed');
assert.equal(findNextVideoControl(fixture('/p/test/',[reel]),'Instagram'),null);
const svg=control(null,{querySelector:()=>({getAttribute:()=>null,querySelector:()=>({textContent:'Next'})})});
assert.equal(findNextVideoControl(fixture('/reels/test/',[svg]),'Instagram'),svg,'Instagram SVG title navigation');
assert.equal(findNextVideoControl(fixture('/foryou',[disabled,reel]),'TikTok'),reel);
assert.equal(findNextVideoControl(fixture('/reels/test/',[control('Previous reel')]),'Instagram'),null);
// The saved focused prompt drives the same future-item navigation on either
// platform: skip known-unrelated and unreadable posts towards a physics match.
const requestState={preferences:{},active:{intent:{plan:parseIntent('I want to see physics content'),focused:true,mode:'both'}}};
const upcoming=[['dance','Unknown','dance'],['cooking','Food','recipe'],['unreadable','Unknown',''],['physics','Learning','quantum mechanics']].map(([id,category,matchText],index)=>video(id,index*800,!!filterReason(requestState,{category,matchText,analysis:{kind:'Unknown'}})));
for(const platform of ['TikTok','Instagram']) {
  assert.equal(filterPresentation({...mode,platform,blocked:upcoming[0].blocked}),'skip');
  assert.equal(createAutoSkip().next({...input,items:upcoming}).target.id,'physics');
}
// Focused topic browsing must not cycle through unrelated posts or use native
// next-button retries that abandon the already verified matching target.
const focused=createAutoSkip();
const focusedInput={...input,matchingOnly:true,canAdvance:true};
const nonmatches=upcoming.slice(0,3);
assert.deepEqual(focused.next({...focusedInput,items:nonmatches}),{noMatch:true});
assert.deepEqual(focused.next({...focusedInput,now:10000,items:nonmatches}),{noMatch:true},'no native-next hunting after a delay');
assert.deepEqual(focused.next({...focusedInput,items:[video('current',0),video('revealed-unrelated',800,true,{revealed:true})]}),{noMatch:true},'revealing an unrelated post does not make it a topic match');
const focusedJump=focused.next({...focusedInput,items:upcoming});
assert.equal(focusedJump.target.id,'physics');assert.equal(focusedJump.matchingOnly,true);
assert.equal(focused.next({...focusedInput,now:1000,items:upcoming}).retry,true);
const distant=[video('current',0),...Array.from({length:12},(_,index)=>video(`unrelated-${index}`,(index+1)*800)),video('physics-distant',13*800,false)];
assert.equal(createAutoSkip().next({...focusedInput,items:distant}).target.id,'physics-distant','focused search can use any already-loaded forward match');
let pauses=0;const silenced={video:{muted:false,pause(){pauses++;}}};
silenceFlagged(silenced,true);silenceFlagged(silenced,true);assert.equal(silenced.video.muted,true);assert.equal(pauses,2);
silenceFlagged(silenced,false);assert.equal(silenced.video.muted,false);assert.ok(!Object.hasOwn(silenced,'originalMuted'));
silenced.video.muted=true;silenceFlagged(silenced,true);silenceFlagged(silenced,false);assert.equal(silenced.video.muted,true,'existing mute restored');
assert.equal(selectCurrent([{video:{isConnected:true},since:1,autoSkipping:true}],3000),null,'skipped posts never count as watched');
assert.equal(forwardTarget([video('current',0,false),video('flagged',800),video('acceptable',1600,false)],800).id,'acceptable','forward gesture jumps over loaded flagged card');
assert.equal(forwardTarget([video('current',0,false),video('acceptable',800,false)],800),null,'normal scroll retained when next video acceptable');
assert.equal(forwardTarget([video('current',0,false),video('flagged',800)],800),null,'no invented positive target when more videos need loading');
assert.equal(policy.next(input).target.id,'allowed','jump past loaded flagged items');
assert.equal(policy.next({...input,now:2000}).retry,true,'failed navigation retries instead of permanently suppressing the video');
assert.equal(policy.next({...input,key:null}),null,'inactive sessions do not navigate');
for(const extra of [{enabled:false},{visible:false},{paused:true}]) {
  policy.reset();assert.equal(policy.next({...input,...extra}),null);
}
policy.reset();
assert.equal(policy.next({...input,items:[video('only',0)]}),null,'wait for loaded items or an explicit next control');
assert.equal(policy.next({...input,items:[video('only',0)],canAdvance:true}).target,null,'native next fallback');
policy.reset();
assert.equal(policy.next({...input,items:[video('revealed',0,true,{revealed:true}),video('next',800)]}),null,'manual reveal wins');
assert.equal(policy.next({...input,items:[video('offscreen',-900),video('good',0,false)]}),null,'offscreen blocked media does not trigger navigation');
policy.reset();
policy.next(input);
assert.equal(policy.next({...input,now:500,items:[video('new',0),video('next',800)]}),null,'navigation is throttled');
assert.ok(policy.next({...input,key:'new-session',now:500}),'new session resets previous item ownership');
const bounded=createAutoSkip({limit:2});
bounded.next(input);
bounded.next({...input,now:2000,items:[video('second',0),video('third',800)]});
assert.deepEqual(bounded.next({...input,now:4000,items:[video('third',0),video('fourth',800)]}),{waiting:true});
bounded.next({...input,now:4100,items:[video('allowed',0,false)]});
assert.equal(bounded.next({...input,now:4200,items:[video('third',0),video('fourth',800)]}),null,'transient permitted items do not bypass backoff');
bounded.next({...input,now:5000,items:[video('allowed',0,false)]});
bounded.next({...input,now:8100,items:[video('allowed',0,false)]});
assert.ok(bounded.next({...input,now:8200,items:[video('third',0),video('fourth',800)]}).target,'sustained permitted viewing resets consecutive skip budget');
bounded.reset('one');assert.ok(bounded.next(input),'explicit resume resets limit');
const retrying=createAutoSkip({limit:2});
retrying.next(input);retrying.next({...input,now:1000});
assert.deepEqual(retrying.next({...input,now:2000}),{waiting:true});
assert.equal(retrying.next({...input,now:3000}),null);
assert.ok(retrying.next({...input,now:7000}).retry,'burst cap automatically resumes after backoff');
assert.equal(retrying.next({...input,now:8000}),null,'third failed attempt has longer backoff');
assert.ok(retrying.next({...input,now:12000}).retry);
assert.equal(retrying.next({...input,key:'fresh',now:12001}).retry,false,'retry work belongs to its session');
let native=0,scrolled=0,jumped=0;
const feed={scrollHeight:2400,clientHeight:800,parentElement:null,scrollBy(options){scrolled=options.top;}};
const active={video:{parentElement:feed}},target={video:{scrollIntoView(){jumped++;}}};
const options={style:()=>({overflowY:'auto'})};
advanceVideo({active,target,retry:false},null,options);assert.equal(jumped,1);
advanceVideo({active,target,retry:true},{click(){native++;}},options);assert.equal(native,1);assert.equal(scrolled,0);
advanceVideo({active,target,retry:true},null,options);assert.equal(scrolled,800,'failed direct scroll falls back to verified scrollable ancestor');
feed.scrollHeight=800;scrolled=0;advanceVideo({active,target,retry:true},null,options);assert.equal(scrolled,0);assert.equal(jumped,2);
native=0;scrolled=0;jumped=0;feed.scrollHeight=2400;
advanceVideo({active,target,retry:true,matchingOnly:true},{click(){native++;}},options);
assert.equal(jumped,1);assert.equal(native,0);assert.equal(scrolled,0,'focused retry stays on its matching target');
advanceVideo({active,target:null,retry:true,matchingOnly:true},{click(){native++;}},options);
assert.equal(jumped,1);assert.equal(native,0);assert.equal(scrolled,0,'no target never triggers blind navigation');
console.log('Passed auto-skip: lookahead, reveal, session/edit/visibility gates, throttle, bounded retries, automatic backoff recovery, native/scroll-container fallbacks.');


