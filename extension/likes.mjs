// Read only explicit button state; never infer likes from popularity counts.
export function buttonLikeState(button,platform){
 const pressed=button.getAttribute('aria-pressed');if(pressed==='true')return true;if(pressed==='false')return false;
 if(platform==='TikTok'){const icon=button.matches('[data-e2e="like-icon"]')?button:button.querySelector('[data-e2e="like-icon"]');const value=icon?.getAttribute('data-state');if(value==='active')return true;if(value==='inactive')return false;}
 const labels=[button.getAttribute('aria-label'),...Array.from(button.querySelectorAll('svg[aria-label]')).map(e=>e.getAttribute('aria-label'))].filter(Boolean).map(s=>s.trim().toLowerCase());
 if(labels.some(s=>['unlike','unlike video','remove like'].includes(s)))return true;
 if(labels.some(s=>['like','like video'].includes(s)))return false;
 return null;
}
export function likeButtons(root,platform){
 const selector=platform==='TikTok'?'[data-e2e="like-icon"],[data-e2e="browse-like-icon"],button:has([data-e2e="like-icon"]),[role="button"]:has([data-e2e="like-icon"]),button[aria-label="Like video"],button[aria-label="Unlike video"]':'button:has(svg[aria-label="Like"]),button:has(svg[aria-label="Unlike"]),[role="button"]:has(svg[aria-label="Like"]),[role="button"]:has(svg[aria-label="Unlike"]),button[aria-label="Like"],button[aria-label="Unlike"]';
 return [...new Set([...root.querySelectorAll(selector)].map(e=>e.closest('button,[role="button"]')||e))].filter(e=>!e.closest('[data-e2e="comment-item"],[data-e2e="comment-level-1"],ul ul li'));
}
