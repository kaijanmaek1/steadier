const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&getComputedStyle(e).visibility!=='hidden';};
const texts=(scope,selector,limit=10)=>[...scope.querySelectorAll(selector)].filter(visible).map(e=>(e.innerText||e.textContent||'').trim()).filter(Boolean).filter((t,i,a)=>a.indexOf(t)===i).slice(0,limit);
export function extract(video,root){
 // Only read comments from this video's container or a dialog containing this video.
 const dialog=video.closest('[role="dialog"]');
 let scope=dialog&&dialog.querySelectorAll('video').length===1?dialog:root;
 if(scope===root){let parent=root.parentElement;for(let i=0;i<5&&parent&&!parent.matches('body,main,html');i++,parent=parent.parentElement){if(parent.querySelectorAll('video').length!==1)break;if(parent.querySelector('[data-e2e="comment-list"],[data-e2e="comment-level-1"],ul ul li')){scope=parent;break;}}}
 const tiktok=location.hostname.includes('tiktok');
 const captionSelectors=tiktok?'[data-e2e="video-desc"],[data-e2e="browse-video-desc"],[data-e2e="search-card-video-caption"]':'h1,[data-steadier-caption],ul h2,div[role="button"] > span[dir="auto"]';
 let caption=texts(scope,captionSelectors,3).join(' ').slice(0,4000);
 if(!caption&&!tiktok){caption=[...scope.querySelectorAll('span[dir="auto"]')].filter(visible).filter(e=>!e.closest('ul ul,[role="button"],button,time')).map(e=>(e.innerText||e.textContent||'').trim()).filter(t=>t.length>25).slice(0,2).join(' ').slice(0,4000);}
 if(!caption&& !tiktok){caption=[...scope.querySelectorAll('img[alt]')].filter(visible).map(e=>e.alt).join(' ').slice(0,1500);}
 const hashtags=texts(scope,'a[href*="/tag/"],a[href*="/tags/"],a[href*="/explore/tags/"]',25).join(' ').slice(0,1000);
 const comments=tiktok?texts(scope,'[data-e2e="comment-level-1"] [data-e2e="comment-text"],[data-e2e="comment-item"] [data-e2e="comment-level-1"],[data-e2e="comment-level-1"] p',5):texts(scope,'ul ul li span[dir="auto"],ul ul li h3 ~ div span[dir="auto"],[data-steadier-comment]',5);
 // HTML subtitle overlays and active browser text-track cues; no audio/video capture.
 const overlay=texts(root,'[data-e2e*="subtitle"],[data-e2e*="caption-text"],[class*="DivSubtitle"],[data-steadier-subtitle],[aria-live="off"] [class*="caption"]',5).join(' ');
 const cues=[];for(const track of video.textTracks||[])if(track.mode!=='disabled')for(const cue of track.activeCues||[])if(cue.text)cues.push(cue.text);
 return {caption,hashtags,comments:comments.map(s=>s.slice(0,500)),subtitles:[overlay,...cues].join(' ').slice(0,2000)};
}
