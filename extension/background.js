import {fresh,categories,hidden,finish} from './engine.mjs';
import {parseIntent} from './intent.mjs';
import {allowedPage} from './classify.mjs';
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 queue=queue.catch(()=>{}).then(async()=>{
  if(!msg||typeof msg!=='object'||!sender.tab||!/^https:\/\/www\.(tiktok|instagram)\.com\//.test(sender.url||'')||(sender.frameId!==undefined&&sender.frameId!==0))throw Error('Unsupported page');
  const page=new URL(sender.url),platform=page.hostname.includes('tiktok')?'TikTok':'Instagram';
  if(!['get','reset'].includes(msg.type)&&!allowedPage(page.hostname,page.pathname))throw Error('Steadier does not record activity on private or account pages');
  const all=(await chrome.storage.local.get('steadier')).steadier||{TikTok:fresh(),Instagram:fresh()};const s=all[platform];
  if(msg.type!=='get'&&msg.resetEpoch!==undefined&&msg.resetEpoch!==(s.resetEpoch||0))throw Error('This action was created before data was deleted');
  for(const c of categories)if(!s.preferences[c])s.preferences[c]='adaptive';
  function sessionIntent(){const options=msg.intent||{};if(typeof (options.prompt||'')!=='string'||(options.prompt||'').length>500)throw Error('Prompt must be at most 500 characters');const prompt=options.prompt||'',plan=parseIntent(prompt);if(options.mode&&!['both','memes','serious'].includes(options.mode))throw Error('Invalid content style');return {prompt,plan,mode:options.mode&&options.mode!=='both'?options.mode:plan.mode,focused:options.focused!==false,strict:options.strict===true};}
  const validCategory=c=>categories.includes(c)||c==='Unknown';
  const sessionMutation=['end','intent','seen','vote','category','update','like'].includes(msg.type);
  if(sessionMutation){if(!s.active)throw Error('Start a session first');if((msg.sessionId!==undefined&&msg.sessionId!==s.active.sessionId)||(s.active.protocol===2&&msg.sessionId!==s.active.sessionId))throw Error('This action belongs to an expired session');}
  if(msg.type==='start'){if(s.active)throw Error('Finish the existing session first');if(msg.consent!==true)throw Error('Consent is required');if(!Number.isInteger(msg.mood)||msg.mood<0||msg.mood>100)throw Error('Invalid mood');if(msg.protocol!==undefined&&msg.protocol!==2)throw Error('Unsupported session protocol');const intent=sessionIntent();s.consent=true;s.lastIntent=intent;s.active={before:msg.mood,startedAt:Date.now(),seen:[],feedback:{},platform,intent,...(msg.protocol===2?{protocol:2,sessionId:crypto.randomUUID()}:{})};}
  else if(msg.type==='intent'){if(!s.active)throw Error('Start a session first');s.active.intent=sessionIntent();s.lastIntent=s.active.intent;}
  else if(msg.type==='end'){finish(s,msg.mood,'unsure');}
  else if(msg.type==='seen'||msg.type==='vote'||msg.type==='category'||msg.type==='update'||msg.type==='like'){
   if(!s.active)throw Error('Start a session first');if(typeof msg.id!=='string'||!msg.id.trim()||msg.id.length>300||/[\u0000-\u001f\u007f]/.test(msg.id)||['__proto__','constructor','prototype'].includes(msg.id)||!validCategory(msg.category))throw Error('Invalid video');
   let p=s.active.seen.find(p=>p.id===msg.id);if(!p){p={id:msg.id,category:msg.category};s.active.seen.push(p);}if(msg.type==='category'){p.category=msg.category;p.manual=true;}if(msg.type==='update'&&!p.manual)p.category=msg.category;if(['Meme / humour','Informational style','Mixed / uncertain','Unknown'].includes(msg.kind))p.kind=msg.kind;
   if(msg.type==='vote'){if(![-1,0,1].includes(msg.value))throw Error('Invalid rating');s.active.feedback[msg.id]=msg.value;}
   if(msg.type==='like'){if(typeof msg.liked!=='boolean')throw Error('Invalid like state');s.likes||={};if(msg.liked)s.likes[msg.id]={category:p.category,liked:true};else delete s.likes[msg.id];p.liked=msg.liked;}
   if(s.likes?.[msg.id]&&(msg.type==='category'||msg.type==='update'))s.likes[msg.id].category=p.category;
  }else if(msg.type==='preference'){if(!categories.includes(msg.category)||!['adaptive','show','hide'].includes(msg.value))throw Error('Invalid preference');s.preferences[msg.category]=msg.value;}
  else if(msg.type==='reset'){all[platform]={...fresh(),resetEpoch:(s.resetEpoch||0)+1};}
  else if(msg.type!=='get')throw Error('Unknown action');
  if(msg.type!=='get')await chrome.storage.local.set({steadier:all});
  return {state:all[platform],platform,softened:categories.filter(c=>hidden(all[platform],c))};
 }).then(reply,e=>reply({error:e.message}));return true;
});
