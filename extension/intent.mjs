export const aliases={Nature:['nature','forest','garden','hiking','wildlife','sunset','ocean','outdoors','calm','relaxing'],Music:['music','song','singing','guitar','piano','playlist','concert'],Creativity:['art','drawing','painting','craft','sketch','creative','pottery'],Connection:['friendship','friends','community','kindness','family','together'],News:['news','politics','election','breaking','war','conflict'],Comparison:['comparison','luxury','millionaire','bodygoals','dreamlife','glowup'],Animals:['animals','animal','pets','dogs','dog','cats','cat'],Food:['food','cooking','recipe','recipes','baking'],Gaming:['gaming','games','game','minecraft','fortnite'],Fitness:['fitness','workout','exercise','gym','yoga'],Learning:['learning','education','educational','science','tutorial','history'],Travel:['travel','holiday','vacation','tourism'],Technology:['technology','tech','coding','programming','ai'],Sports:['sports','sport','football','basketball','tennis']};
const stop=new Set('i me my want would please like videos video content something some see to the a an of for with on just give feed about sort stuff today more show include only less no avoid without not exclude dont don t any and but or calm relaxing serious memes meme humour humor funny comedy real information informational mix mixed both prefer'.split(' '));
const tokens=text=>(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
const species={dog:['dog','dogs','puppy','puppies','canine','canines'],cat:['cat','cats','kitten','kittens','feline','felines']};
const subject=word=>Object.keys(species).find(key=>species[key].includes(word));
export function parseIntent(prompt=''){
 const include=new Set(),exclude=new Set(),includeTerms=new Set(),excludeTerms=new Set(),wantedStyles=new Set(),avoidedStyles=new Set();let mode='both',negative=false;
 const normalised=prompt.toLowerCase().replace(/don[’']t|do not/g,'avoid').replace(/\b(?:avoid|not)\s+(?:show|include|give|want|see)\b/g,'avoid').replace(/\bno\s+more\b/g,'avoid');
 const parts=normalised.split(/([,;\n]|\b(?:and|but|or)\b)|\b(?=(?:no|less|avoid|without|exclude|more|include|show|only|not)\b)/).filter(s=>s&&s.trim());
 for(const part of parts){if(/^\s*(?:[,;\n]|and|or)\s*$/.test(part))continue;if(/^\s*but\s*$/.test(part)){negative=false;continue;}
  if(/^\s*(no|less|avoid|without|not|exclude)\b/.test(part))negative=true;
  else if(/^\s*(more|include|show|only|(?:i\s+)?want|prefer|give)\b/.test(part))negative=false;
  const words=tokens(part),target=negative?exclude:include,styles=negative?avoidedStyles:wantedStyles;const used=new Set();
  for(const word of words)if(subject(word)){(negative?excludeTerms:includeTerms).add(subject(word));used.add(word);}
  for(const [category,terms]of Object.entries(aliases))for(const word of words)if(terms.includes(word)&&!subject(word)){target.add(category);used.add(word);}
  if(/\b(memes?|comedy|funny|humou?r)\b/.test(part))styles.add('memes');
  if(/\b(serious|informational|educational|real)\b/.test(part))styles.add('serious');
  for(const word of words)if(!used.has(word)&&!stop.has(word)&&word.length>2)(negative?excludeTerms:includeTerms).add(word);
 }
 for(const category of exclude)include.delete(category);for(const word of excludeTerms)includeTerms.delete(word);
 const styles=['memes','serious'].filter(style=>!avoidedStyles.has(style)&&(!wantedStyles.size||wantedStyles.has(style)));
 if(styles.length===1)mode=styles[0];
 return {include:[...include],exclude:[...exclude],includeTerms:[...includeTerms].slice(0,12),excludeTerms:[...excludeTerms].slice(0,12),mode};
}
export function matchesTerm(text,term){
 const words=tokens(text),family=species[subject(term)]||[term];
 if(words.some(word=>family.includes(word)))return true;
 // Common explicit topic hashtags, without matching unrelated ordinary words.
 const suffixes=['softiktok','sofinstagram','video','videos','meme','memes','life','love','lover','lovers','training'];
 return [...text.toLowerCase().matchAll(/#([\p{L}\p{N}_]+)/gu)].some(([,tag])=>family.some(word=>suffixes.some(suffix=>tag.replaceAll('_','')===word+suffix)));
}
export function positiveSearchQuery(prompt='') {
 const plan=parseIntent(prompt),words=tokens(prompt);
 const context=new Set('am have has feel feeling suffering suffer from depression depressed anxiety anxious mood recovery recovering mental health illness treatment therapy medication suicidal suicide selfharm'.split(' '));
 const topics=plan.include.map(category=>words.find(word=>aliases[category].includes(word)&&!subject(word))||category.toLowerCase());
 const terms=plan.includeTerms.filter(term=>!context.has(term)&&!/^\d+$/.test(term)).map(term=>words.find(word=>matchesTerm(word,term))||term);
 return [...new Set([...topics,...terms])].join(' ').slice(0,120);
}
const matchesCategory=(text,category)=>(aliases[category]||[]).some(term=>matchesTerm(text,term));
export function filterReason(state,item,softened=[]){
 const settings=state.active?.intent;if(!state.active)return '';
 const plan=typeof settings?.prompt==='string'?parseIntent(settings.prompt):settings?.plan||parseIntent(''),text=item.matchText||'',kind=item.analysis?.kind||'Unknown';
 if(plan.exclude.some(category=>category===item.category||matchesCategory(text,category))||plan.excludeTerms.some(t=>matchesTerm(text,t)))return 'Your prompt: less of this topic';
 if(state.preferences[item.category]==='hide')return `Your preference: ${item.category}`;
 const mode=settings?.mode||'both';
 if(mode==='memes'&&kind==='Informational style')return 'Your session choice: memes';
 if(mode==='serious'&&kind==='Meme / humour')return 'Your session choice: serious content';
 const hasTopics=plan.include.length||plan.includeTerms.length;
 const positiveText=item.primaryText??text;
 // Comments can inform exclusions/style, but cannot alone satisfy a wanted topic.
 const match=plan.include.some(category=>matchesCategory(positiveText,category)||(item.primaryText===undefined&&category===item.category))||plan.includeTerms.some(t=>matchesTerm(positiveText,t));
 const unknown=(item.category==='Unknown'&&!match)||(mode!=='both'&&(kind==='Unknown'||kind==='Mixed / uncertain'));
 if(settings?.strict&&unknown)return 'Uncertain content: focused mode';
 if(settings?.focused&&hasTopics){
  if(!match)return positiveText.trim()?'Outside your requested topics':'No readable text matching your request';
 }
 if(state.preferences[item.category]!=='show'&&softened.includes(item.category))return `Learned filter: ${item.category}`;
 return '';
}
export function summariseIntent(plan,mode){return `Style: ${mode}. More: ${[...plan.include,...plan.includeTerms].join(', ')||'any topic'}. Less: ${[...plan.exclude,...plan.excludeTerms].join(', ')||'nothing specified'}.`;}
