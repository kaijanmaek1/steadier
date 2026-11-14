import assert from 'node:assert/strict';
import {isolateEditableKeys} from './keyboard.mjs';
const host={},editor={matches:()=>true},dragHandle={matches:()=>false};
for(const key of ['c','r',' ','Tab','ArrowLeft','Process']) {
 const window=new EventTarget();let shortcuts=0;
 window.addEventListener('keydown',event=>isolateEditableKeys(event,host,editor));
 window.addEventListener('keydown',()=>shortcuts++);
 const event=new Event('keydown',{cancelable:true});
 Object.defineProperties(event,{key:{value:key},isComposing:{value:key==='Process'},composedPath:{value:()=>[host,window]}});
 window.dispatchEvent(event);
 assert.equal(shortcuts,0,`${key} does not reach later site handlers`);
 assert.equal(event.defaultPrevented,false,`${key} keeps native editing/focus/IME behavior`);
}
let stopped=0;const keyEvent={composedPath:()=>[host],stopImmediatePropagation(){stopped++;}};
assert.equal(isolateEditableKeys(keyEvent,host,dragHandle),false,'drag handle arrow handler remains reachable');
assert.equal(isolateEditableKeys({...keyEvent,composedPath:()=>[]},host,editor),false,'page shortcuts outside panel unaffected');
assert.equal(stopped,0);
console.log('Passed editable keyboard isolation: c/r/space, native Tab/arrows/IME defaults, drag handle and outside page keys. Native browser typing remains a manual check.');
