import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMediaMask} from './panel-state.mjs';

// A small attribute/child fixture exercises the production mask helper without
// claiming to emulate browser focus, accessibility trees or native inert behaviour.
function element(attributes={}){
 const values=new Map(Object.entries(attributes));
 return {
  children:[],
  getAttribute:name=>values.has(name)?values.get(name):null,
  setAttribute:(name,value)=>values.set(name,String(value)),
  removeAttribute:name=>values.delete(name)
 };
}
const root=element(),videoWrapper=element(),caption=element({'aria-hidden':'false'}),alreadyHidden=element({inert:'existing','aria-hidden':'true'}),overlay=element();
root.children=[videoWrapper,caption,alreadyHidden,overlay];
const mask=createMediaMask(root,overlay);
for(const node of [videoWrapper,caption,alreadyHidden]){
 assert.equal(node.getAttribute('inert'),'','Covered content must be inert');
 assert.equal(node.getAttribute('aria-hidden'),'true','Covered content must be hidden from assistive technology');
}
assert.equal(overlay.getAttribute('inert'),null,'The Reveal overlay must remain interactive');
assert.equal(overlay.getAttribute('aria-hidden'),null,'The Reveal overlay must stay available to assistive technology');

const inserted=element({'aria-hidden':'false'});
root.children.push(inserted);mask.refresh();
assert.equal(inserted.getAttribute('inert'),'','Content inserted during filtering must also be masked');
assert.equal(inserted.getAttribute('aria-hidden'),'true');
root.children=root.children.filter(node=>node!==inserted);mask.refresh();
assert.equal(inserted.getAttribute('inert'),null,'A node moved outside the covered root must be restored');
assert.equal(inserted.getAttribute('aria-hidden'),'false');

// A second owner may mask the same children while the first cover is removed.
const secondMask=createMediaMask(root,overlay);mask.restore();
assert.equal(videoWrapper.getAttribute('inert'),'','One remaining cover must retain masking');
secondMask.restore();
assert.equal(videoWrapper.getAttribute('inert'),null);
assert.equal(videoWrapper.getAttribute('aria-hidden'),null);
assert.equal(caption.getAttribute('aria-hidden'),'false','Restore an explicit false value exactly');
assert.equal(alreadyHidden.getAttribute('inert'),'existing','Restore pre-existing inert values exactly');
assert.equal(alreadyHidden.getAttribute('aria-hidden'),'true');
secondMask.restore();secondMask.refresh();
assert.equal(videoWrapper.getAttribute('inert'),null,'Repeated cleanup and refresh after cleanup are harmless');

// Contrast checks use the actual stylesheet declarations, including the final
// shared secondary-text rule. This is source-level contrast verification only.
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^@import.*$/gm,'');
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({
 selectors:selector.trim().split(',').map(s=>s.trim()),
 declarations:Object.fromEntries(body.split(';').map(d=>d.split(':').map(s=>s.trim())).filter(pair=>pair.length===2))
}));
function property(selector,name){
 let value;
 for(const rule of rules)if(rule.selectors.includes(selector)&&rule.declarations[name])value=rule.declarations[name];
 assert.ok(value,`Missing ${name} for ${selector}`);
 const variable=value.match(/^var\((--[\w-]+)\)$/);
 return variable?property(':root',variable[1]):value;
}
function luminance(colour){
 if(colour==='white')colour='#ffffff';
 const hex=colour.replace('#','');assert.match(hex,/^[a-f\d]{6}$/i);
 const values=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return values.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
}
const backgrounds=['#ffffff',property('aside','background'),property('.checkin','background'),property('.pill','background'),property('.filtered','background'),property('.badge','background')];
for(const selector of ['.sub','.note','.empty','.workspace','.ends','.quiet','.stat small','.step p','.author small','.badge','footer','.consent']){
 const colour=property(selector,'color');
 for(const background of backgrounds){
  const [dark,light]=[luminance(colour),luminance(background)].sort((a,b)=>a-b);
  const ratio=(light+.05)/(dark+.05);
  assert.ok(ratio>=4.5,`${selector}: ${colour} on ${background} has insufficient normal-text contrast (${ratio.toFixed(2)}:1)`);
 }
}
console.log('Passed: covered-media masking/restoration, accessible Reveal exclusion, inserted/moved content, overlapping ownership and source-level secondary-text contrast.');
console.log('Not verified here: browser focus/tab order, screen-reader output, browser-computed CSS or live TikTok/Instagram layouts.');
