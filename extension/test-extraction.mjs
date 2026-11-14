import assert from 'node:assert/strict';
import {extract} from './extract.mjs';
import {createMediaMask} from './panel-state.mjs';

// Small DOM-shaped tree fixture with selector traversal, geometry and ancestry.
// It tests extraction boundaries; it does not emulate browser layout or live sites.
class Element {
 constructor(tag='div',attributes={},text='',style={}){
  this.tagName=tag;this.attributes=new Map(Object.entries(attributes));this.parentElement=null;
  this.nodeType=1;this.childNodes=[];this.isConnected=true;this.style={display:'block',visibility:'visible',...style};
  this.rect={width:100,height:25,top:10,bottom:35};this.textTracks=[];
  if(text)this.childNodes.push({nodeType:3,textContent:text});
 }
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get hidden(){return this.attributes.has('hidden');}
 get textContent(){return this.childNodes.map(node=>node.textContent).join(' ');}
 get innerText(){return this.textContent;}
 getAttribute(name){return this.attributes.get(name)??null;}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 removeAttribute(name){this.attributes.delete(name);}
 append(...children){for(const node of children){node.parentElement=this;this.childNodes.push(node);}return this;}
 getBoundingClientRect(){return this.rect;}
 matches(selector){return selector.split(',').some(part=>matchesChain(this,part.trim()));}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const result=[];const walk=node=>{for(const child of node.children){if(child.matches(selector))result.push(child);walk(child);}};walk(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function simple(element,selector){
 const tag=selector.match(/^[a-z][a-z0-9]*/i)?.[0];if(tag&&tag!==element.tagName)return false;
 const id=selector.match(/#([\w-]+)/)?.[1];if(id&&element.getAttribute('id')!==id)return false;
 for(const match of selector.matchAll(/\[([^\s\]*=]+)(\*?=)?(?:"([^"]*)"|'([^']*)'|([^\]]+))?\]/g)){
  const value=element.getAttribute(match[1]),expected=match[3]??match[4]??match[5];
  if(value===null||match[2]==='='&&value!==expected||match[2]==='*='&&!value.includes(expected))return false;
 }
 return true;
}
function matchesChain(element,selector){
 const parts=selector.split(/\s+(?![^\[]*\])/).filter(Boolean);
 const visit=(node,index)=>{
  if(!node||!simple(node,parts[index]))return false;
  if(index===0)return true;
  if(parts[index-1]==='>')return visit(node.parentElement,index-2);
  for(let parent=node.parentElement;parent;parent=parent.parentElement)if(visit(parent,index-1))return true;
  return false;
 };
 return visit(element,parts.length-1);
}
globalThis.innerHeight=900;
globalThis.getComputedStyle=node=>node.style;
globalThis.location={hostname:'www.tiktok.com',pathname:'/foryou'};
const caption=text=>new Element('div',{'data-e2e':'video-desc'},text);
const comment=text=>new Element('div',{'data-e2e':'comment-level-1'}).append(new Element('p',{'data-e2e':'comment-text'},text));

// Caption/hashtag siblings lie above six nested video wrappers.
const video=new Element('video'),root=new Element().append(video);let outer=root;
for(let i=0;i<6;i++)outer=new Element().append(outer);
const card=new Element('article').append(outer,caption('A puppy playing'),new Element('a',{href:'/tag/dogs'},'#dogs'));
const page=new Element('main').append(card,new Element('article').append(new Element('video'),caption('Other video: politics')));
assert.equal(extract(video,root).caption,'A puppy playing');
assert.equal(extract(video,root).hashtags,'#dogs');
assert.ok(!extract(video,root).caption.includes('politics'));

// Do not widen to a parent containing multiple videos even when it has markers.
const bareVideo=new Element('video'),bareRoot=new Element().append(bareVideo);
new Element('div').append(bareRoot,new Element('video'),caption('Wrong video caption'));
assert.equal(extract(bareVideo,bareRoot).caption,'');

// Metadata remains useful offscreen, but comments must currently be visible.
const offscreen=caption('Offscreen metadata: dogs');offscreen.rect={width:100,height:20,top:1200,bottom:1220};
const boxless=caption('Visible contents: puppy');boxless.style.display='contents';boxless.rect={width:0,height:0,top:0,bottom:0};
const visibleComment=comment('Visible comment'),hiddenComment=comment('Offscreen comment');
hiddenComment.children[0].rect={width:100,height:20,top:1200,bottom:1220};
const metadataRoot=new Element('article').append(video,offscreen,boxless,visibleComment,hiddenComment);
let evidence=extract(video,metadataRoot);
assert.match(evidence.caption,/Offscreen metadata: dogs/);assert.match(evidence.caption,/Visible contents: puppy/);
assert.deepEqual(evidence.comments,['Visible comment']);

// Hidden ancestry, detached nodes and our overlay text must not be evidence.
const hidden=new Element('div',{},'',{display:'none'}).append(caption('Hidden politics'));
const ariaHidden=new Element('div',{'aria-hidden':'true'}).append(caption('Aria hidden politics'));
const invisible=new Element('div',{},'',{visibility:'hidden'}).append(caption('Invisible politics'));
const detached=caption('Detached politics');detached.isConnected=false;
const overlay=new Element('div',{'aria-label':'Video softened by Steadier'}).append(caption('Overlay politics'));
const hiddenDescendant=caption('Visible puppy');hiddenDescendant.append(new Element('span',{hidden:''},'Hidden descendant politics'));
const cleanRoot=new Element('article').append(video,hidden,ariaHidden,invisible,detached,overlay,hiddenDescendant);
assert.equal(extract(video,cleanRoot).caption,'Visible puppy');

// A Steadier-owned aria mask must not erase previously readable metadata.
const mask=createMediaMask(cleanRoot,overlay);
assert.equal(hiddenDescendant.getAttribute('aria-hidden'),'true');
assert.equal(extract(video,cleanRoot).caption,'Visible puppy');
mask.restore();
assert.equal(hiddenDescendant.getAttribute('aria-hidden'),null);

// Only the current video's single-video dialog contributes visible comments.
const dialogVideo=new Element('video'),dialogRoot=new Element().append(dialogVideo);
const dialog=new Element('div',{role:'dialog'}).append(dialogRoot,caption('Current video'),comment('Current comment'));
new Element('main').append(dialog,new Element('div',{role:'dialog'}).append(new Element('video'),caption('Unrelated dialog'),comment('Unrelated comment')));
assert.deepEqual(extract(dialogVideo,dialogRoot).comments,['Current comment']);
globalThis.location.pathname='/messages';assert.equal(extract(dialogVideo,dialogRoot).caption,'');
globalThis.location={hostname:'www.instagram.com',pathname:'/reels/example/'};
const instaVideo=new Element('video'),instaRoot=new Element().append(instaVideo);
new Element('article').append(instaRoot,new Element('h1',{},'A cat caption'),new Element('a',{href:'/explore/tags/cats/'},'#cats'));
assert.equal(extract(instaVideo,instaRoot).caption,'A cat caption');
assert.equal(extract(instaVideo,instaRoot).hashtags,'#cats');
globalThis.location.pathname='/direct/inbox/';assert.deepEqual(extract(instaVideo,instaRoot),{caption:'',hashtags:'',comments:[],subtitles:''});
console.log('Passed extraction: bounded single-video scopes, caption/hashtag siblings, offscreen metadata, display:contents, visible-only comments, hidden/overlay exclusion and Steadier-mask preservation.');
