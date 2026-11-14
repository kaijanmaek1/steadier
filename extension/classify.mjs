import {aliases as rules} from './intent.mjs';
export function classify(text){const tokens=new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]));let best='Unknown',max=0;for(const [category,words] of Object.entries(rules)){const n=words.filter(w=>tokens.has(w)).length;if(n>max){max=n;best=category;}}return best;}
const memeTerms=[/\bmeme\b/i,/\bsatire\b/i,/\bparody\b/i,/\bshitpost\b/i,/\bcomedy\b/i,/\bjoking\b/i,/\bjust a joke\b/i,/\bfor legal reasons.{0,15}joke\b/i,/\blmao\b/i,/\blmfao\b/i,/\blol\b/i,/😂|🤣/u];
const infoTerms=[/\btutorial\b/i,/\bexplained\b/i,/\beducational\b/i,/\bresearch\b/i,/\bstudy\b/i,/\bsource[s]?\b/i,/\bevidence\b/i,/\bhow to\b/i,/\bnews\b/i,/\bfact[s]?\b/i];
const hits=(text,terms)=>terms.filter(r=>r.test(text)).length;
export function analyse({caption='',hashtags='',subtitles='',comments=[]}={}){
 const primary=[caption,hashtags,subtitles].join(' ');const topicScores=Object.fromEntries(Object.keys(rules).map(c=>[c,0]));
 for(const [text,weight] of [[primary,3],[comments.slice(0,5).join(' '),1]]){const tokens=new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);for(const [c,words] of Object.entries(rules))topicScores[c]+=weight*words.filter(w=>tokens.has(w)).length;}
 const ordered=Object.entries(topicScores).sort((a,b)=>b[1]-a[1]);const category=ordered[0][1]>0&&ordered[0][1]>ordered[1][1]?ordered[0][0]:'Unknown';
 const sample=comments.slice(0,5);const meme=hits(primary,memeTerms)*2+Math.min(3,sample.reduce((n,c)=>n+Math.min(1,hits(c,memeTerms)),0));const info=hits(primary,infoTerms)*2+Math.min(2,sample.reduce((n,c)=>n+Math.min(1,hits(c,infoTerms)),0));
 const kind=meme>=2&&meme>info?'Meme / humour':info>=2&&info>meme?'Informational style':meme&&info?'Mixed / uncertain':'Unknown';
 return {category,kind,confidence:kind==='Unknown'||kind==='Mixed / uncertain'?'Low':Math.abs(meme-info)>=5?'Moderate':'Low',commentCount:sample.length,sources:[caption&&'caption',hashtags&&'hashtags',subtitles&&'on-screen subtitles',sample.length&&'visible comments'].filter(Boolean),verification:'Not fact-checked'};
}
export function clampPosition(x,y,width,height,viewportWidth,viewportHeight){return {x:Math.max(0,Math.min(x,Math.max(0,viewportWidth-width))),y:Math.max(0,Math.min(y,Math.max(0,viewportHeight-height)))};}
export function allowedPage(host,path){return /(^|\.)tiktok\.com$/.test(host)?!/^\/(messages|inbox|login|signup|settings)(\/|$)/.test(path):/(^|\.)instagram\.com$/.test(host)&&!/^\/(direct|accounts|settings)(\/|$)/.test(path);}
