import {analyse,allowedPage} from './classify.mjs';
import {parseIntent,filterReason} from './intent.mjs';

// Search routing is explicit navigation. Only the derived topic query is sent.
export function topicSearchUrl(platform,query) {
  if(typeof query!=='string' || !query.trim()) return null;
  const base=platform==='TikTok' ? 'https://www.tiktok.com/search/video' : platform==='Instagram' ? 'https://www.instagram.com/explore/search/keyword/' : null;
  if(!base) return null;
  const url=new URL(base);
  url.searchParams.set('q',query.trim().slice(0,120));
  url.hash='steadier-find-match';
  return url.href;
}

// Choose only an already-rendered video result whose own readable evidence
// satisfies the saved request. This does not infer relevance from search order.
export function findMatchingVideoLink(document,platform,state) {
  const intent=state?.active?.intent;
  if(!intent?.focused) return null;
  const plan=typeof intent.prompt==='string' ? parseIntent(intent.prompt) : intent.plan;
  if(!plan || !(plan.include?.length || plan.includeTerms?.length)) return null;
  let page;
  try {page=new URL(document.location?.href);} catch {return null;}
  const expectedHost=platform==='TikTok' ? /^(?:www\.)?tiktok\.com$/ : platform==='Instagram' ? /^(?:www\.)?instagram\.com$/ : null;
  if(!expectedHost || page.protocol!=='https:' || !expectedHost.test(page.hostname) || !allowedPage(page.hostname,page.pathname)) return null;
  const route=platform==='TikTok' ? /^\/(?:@[^/]+\/)?video\/[^/]+\/?$/ : /^\/reels?\/[^/]+\/?$/;
  for(const anchor of document.querySelectorAll('a[href]')) {
    if(anchor.hidden || anchor.closest?.('[hidden],[aria-hidden="true"],[inert]')) continue;
    const rect=anchor.getBoundingClientRect();
    if(rect.width<=0 || rect.height<=0 || rect.bottom<=0 || rect.top>=(document.defaultView?.innerHeight??Infinity)) continue;
    const style=document.defaultView?.getComputedStyle(anchor);
    if(style && (style.visibility==='hidden' || style.visibility==='collapse' || style.display==='none')) continue;
    let url;
    try {url=new URL(anchor.getAttribute('href'),page);} catch {continue;}
    if(url.origin!==page.origin || url.protocol!=='https:' || url.username || url.password || !route.test(url.pathname)) continue;
    const rendered=typeof anchor.innerText==='string' ? anchor.innerText : anchor.textContent||'';
    const text=[rendered,anchor.getAttribute('aria-label')||'',...[...anchor.querySelectorAll('img[alt]')].map(img=>img.getAttribute('alt')||'')].join(' ').trim().slice(0,4000);
    if(!text) continue;
    const analysis=analyse({caption:text});
    if(!filterReason({...state,preferences:state.preferences||{}},{category:analysis.category,analysis,matchText:text})) {
      return new URL(url.pathname,page.origin).href;
    }
  }
  return null;
}

