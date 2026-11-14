import assert from 'node:assert/strict';
import {topicSearchUrl,findMatchingVideoLink} from './topic-navigation.mjs';

const policy=prompt=>({preferences:{},active:{intent:{prompt,focused:true,mode:'both',strict:false}}});
const anchor=(href,text='',extra={})=>({
  hidden:false,innerText:text,rect:{width:200,height:220,top:10,bottom:230},style:{display:'block',visibility:'visible'},
  getAttribute(name){return name==='href'?href:name==='aria-label'?extra.label||'':null;},
  querySelectorAll(){return (extra.alts||[]).map(alt=>({getAttribute:()=>alt}));},
  getBoundingClientRect(){return this.rect;},closest(){return null;},...extra
});
const document=(platform,anchors,path)=>({
  location:{href:`https://www.${platform==='TikTok'?'tiktok':'instagram'}.com${path||(platform==='TikTok'?'/search/video?q=physics':'/explore/search/keyword/?q=physics')}`},
  defaultView:{innerHeight:800,getComputedStyle:element=>element.style},querySelectorAll:()=>anchors
});

for(const platform of ['TikTok','Instagram']) {
  const url=new URL(topicSearchUrl(platform,'quantum physics & gravity'));
  assert.equal(url.searchParams.get('q'),'quantum physics & gravity');
  assert.equal(url.hash,'#steadier-find-match');
  assert.equal(url.pathname,platform==='TikTok'?'/search/video':'/explore/search/keyword/');
}
assert.equal(topicSearchUrl('Unknown','physics'),null);
assert.equal(topicSearchUrl('TikTok','  '),null);
assert.equal(topicSearchUrl('TikTok',null),null);

const physics=policy('I want to see physics content');
for(const platform of ['TikTok','Instagram']) {
  const prefix=platform==='TikTok'?'/@teacher/video/':'/reel/';
  const candidates=[anchor(prefix+'dance','lip sync dance'),anchor(prefix+'history','history tutorial'),anchor(prefix+'empty'),anchor(prefix+'match?tracking=removed','quantum mechanics explained')];
  assert.equal(findMatchingVideoLink(document(platform,candidates),platform,physics),`https://www.${platform==='TikTok'?'tiktok':'instagram'}.com${prefix}match`);
  assert.equal(findMatchingVideoLink(document(platform,candidates.slice(0,3)),platform,physics),null,'unrelated results do not cause blind navigation');
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'cat','cats kittens'),anchor(prefix+'dog','puppy playing')]),platform,policy('dogs')),`https://www.${platform==='TikTok'?'tiktok':'instagram'}.com${prefix}dog`);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'mixed','quantum mechanics politics')]),platform,policy('physics, no politics')),null,'explicit exclusions still win');
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'hidden','physics',{hidden:true})]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'hidden','physics',{style:{visibility:'hidden'}})]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'offscreen','physics',{rect:{width:200,height:200,top:900,bottom:1100}})]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'inert','physics',{closest:()=>({})})]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor('https://attacker.example'+prefix+'one','physics')]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor('/messages/physics','physics')]),platform,physics),null);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'alt','',{alts:['gravity experiment']})]),platform,physics),`https://www.${platform==='TikTok'?'tiktok':'instagram'}.com${prefix}alt`);
  assert.equal(findMatchingVideoLink(document(platform,[anchor(prefix+'label','',{label:'physics experiment'})]),platform,physics),`https://www.${platform==='TikTok'?'tiktok':'instagram'}.com${prefix}label`);
  assert.equal(findMatchingVideoLink(document(platform,candidates),platform,{preferences:{},active:null}),null);
  assert.equal(findMatchingVideoLink(document(platform,candidates),platform,policy('no politics')),null,'exclusion-only request does not pick an arbitrary result');
  assert.equal(findMatchingVideoLink(document(platform,candidates),platform,policy('')),null);
  assert.equal(findMatchingVideoLink(document(platform,candidates),platform,{...physics,active:{intent:{...physics.active.intent,focused:false}}}),null);
}
assert.equal(findMatchingVideoLink(document('Instagram',[anchor('/p/photo','physics')]),'Instagram',physics),null,'photo posts do not become video targets');
assert.equal(findMatchingVideoLink(document('TikTok',[anchor('/@teacher/video/one','physics')],'/messages/'),'TikTok',physics),null,'private routes never select targets');
assert.equal(findMatchingVideoLink(document('Instagram',[anchor('/reel/one','physics')],'/direct/inbox/'),'Instagram',physics),null);
assert.equal(findMatchingVideoLink(document('TikTok',[anchor('/@teacher/video/one','physics')]),'Instagram',physics),null,'platform must match current origin');
assert.equal(findMatchingVideoLink(document('TikTok',[anchor('/@teacher/video/one','',{textContent:'hidden physics'})]),'TikTok',physics),null,'empty rendered text does not borrow hidden text content');
console.log('Passed topic result navigation: encoded topic search, actual visible matching video links, physics/species/exclusions, no arbitrary results, visibility and route/origin guards.');

