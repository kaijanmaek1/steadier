import {originalAriaHidden} from './panel-state.mjs';
const excluded='[hidden],#steadier-extension,[data-steadier-reason],[aria-label="Video softened by Steadier"]';
function readable(element){
 if(!element||element.isConnected===false)return false;
 if(element.closest?.(excluded))return false;
 for(let node=element;node;node=node.parentElement){
  if(node.hidden||originalAriaHidden(node)==='true')return false;
  const style=getComputedStyle(node);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
 }
 return true;
}
function visible(element){
 if(!readable(element))return false;
 const r=element.getBoundingClientRect();
 if(r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight)return true;
 // A display:contents wrapper has no rectangle, but its comment text can be visible.
 return getComputedStyle(element).display==='contents'&&[...(element.children||[])].some(visible);
}
function readText(element){
 if(!readable(element))return '';
 // Walking native text nodes omits hidden descendants even for display:contents.
 if(element.childNodes?.length)return [...element.childNodes].map(node=>node.nodeType===3?node.textContent:node.nodeType===1?readText(node):'').join(' ');
 return element.innerText||element.textContent||'';
}
const texts=(scope,selector,limit=10,{viewport=false}={})=>[...scope.querySelectorAll(selector)].filter(viewport?visible:readable).map(e=>readText(e).trim()).filter(Boolean).filter((t,i,a)=>a.indexOf(t)===i).slice(0,limit);
export function extract(video,root){
 const empty={caption:'',hashtags:'',comments:[],subtitles:''};
 const path=location.pathname||'';
 if(!root||video.isConnected===false||/^\/(direct|accounts|messages|inbox|login|signup|settings)(\/|$)/.test(path))return empty;
 const tiktok=location.hostname.includes('tiktok');
 const captionSelectors=tiktok?'[data-e2e="video-desc"],[data-e2e="browse-video-desc"],[data-e2e="search-card-video-caption"]':'h1,[data-steadier-caption],ul h2,div[role="button"] > span[dir="auto"]';
 const hashtagSelectors='a[href*="/tag/"],a[href*="/tags/"],a[href*="/explore/tags/"]';
 // Only read comments from this video's container or a dialog containing this video.
 const dialog=video.closest('[role="dialog"]');
 let scope=dialog&&dialog.querySelectorAll('video').length===1?dialog:root;
 const markers=captionSelectors+','+hashtagSelectors+',[data-e2e="comment-list"],[data-e2e="comment-level-1"],ul ul li';
 if(scope===root&&!root.querySelector?.(markers)){
  let parent=root.parentElement;
  for(let depth=0;depth<10&&parent&&!parent.matches('body,main,html');depth++,parent=parent.parentElement){
   const videos=parent.querySelectorAll('video');
   if(videos.length!==1||videos[0]!==video)break;
   if(parent.querySelector(markers)){scope=parent;break;}
   if(parent.matches('[role="dialog"]'))break;
  }
 }
 let caption=texts(scope,captionSelectors,3).join(' ').slice(0,4000);
 if(!caption&&!tiktok){caption=[...scope.querySelectorAll('span[dir="auto"]')].filter(readable).filter(e=>!e.closest('ul ul,[role="button"],button,time')).map(e=>readText(e).trim()).filter(t=>t.length>25).slice(0,2).join(' ').slice(0,4000);}
 if(!caption&& !tiktok){caption=[...scope.querySelectorAll('img[alt]')].filter(readable).map(e=>e.alt).join(' ').slice(0,1500);}
 const hashtags=texts(scope,hashtagSelectors,25).join(' ').slice(0,1000);
 const comments=tiktok?texts(scope,'[data-e2e="comment-level-1"] [data-e2e="comment-text"],[data-e2e="comment-item"] [data-e2e="comment-level-1"],[data-e2e="comment-level-1"] p',5,{viewport:true}):texts(scope,'ul ul li span[dir="auto"],ul ul li h3 ~ div span[dir="auto"],[data-steadier-comment]',5,{viewport:true});
 // HTML subtitle overlays and active browser text-track cues; no audio/video capture.
 const overlay=texts(root,'[data-e2e*="subtitle"],[data-e2e*="caption-text"],[class*="DivSubtitle"],[data-steadier-subtitle],[aria-live="off"] [class*="caption"]',5).join(' ');
 const cues=[];if(readable(video))for(const track of video.textTracks||[])if(track.mode!=='disabled')for(const cue of track.activeCues||[])if(cue.text)cues.push(cue.text);
 return {caption,hashtags,comments:comments.map(s=>s.slice(0,500)),subtitles:[overlay,...cues].join(' ').slice(0,2000)};
}
