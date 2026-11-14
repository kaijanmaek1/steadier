import assert from 'node:assert/strict';
import {fresh,scoreCategory,hidden,finish} from './dist/engine.mjs';
const s=fresh();assert.equal(hidden(s,'News'),false);
for(let i=0;i<4;i++){s.active={before:50,startedAt:Date.now(),seen:[{id:'a',category:'News'}],feedback:{a:-1}};finish(s,35,'no');}
assert.equal(s.sessions.length,4);assert.equal(s.active,null);assert.ok(scoreCategory(s,'News').score<0);assert.equal(hidden(s,'News'),true);
s.preferences.News='show';assert.equal(hidden(s,'News'),false);s.preferences.Nature='hide';assert.equal(hidden(s,'Nature'),true);assert.equal(scoreCategory(s,'Music').score,0);
s.active={before:50,startedAt:Date.now(),seen:[],feedback:{}};assert.throws(()=>finish(s,101,'yes'));assert.ok(s.active);assert.equal(finish(s,60,'yes').after,60);
console.log('Passed: mood validation, session persistence, conservative learning, filtering and preference overrides.');
