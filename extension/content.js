(async () => {
  let keyboardHost = null, keyboardShadow = null, isolateKeys = null;
  // Register before asynchronous imports and before the site's shortcut handlers.
  for (const type of ['keydown','keypress','keyup']) window.addEventListener(type,event => {
    if (isolateKeys && keyboardHost) isolateKeys(event,keyboardHost,keyboardShadow?.activeElement);
  },true);
  const {analyse, allowedPage, clampPosition} = await import(chrome.runtime.getURL('classify.mjs'));
  const {extract} = await import(chrome.runtime.getURL('extract.mjs'));
  const {isolateEditableKeys} = await import(chrome.runtime.getURL('keyboard.mjs'));
  isolateKeys = isolateEditableKeys;
  const {createAutoSkip,advanceVideo,filterPresentation,silenceFlagged,forwardTarget} = await import(chrome.runtime.getURL('auto-skip.mjs'));
  const {aliases, parseIntent, filterReason, summariseIntent,positiveSearchQuery} = await import(chrome.runtime.getURL('intent.mjs'));
  const {likeButtons, buttonLikeState} = await import(chrome.runtime.getURL('likes.mjs'));
  const {createActionQueue, createPanelState, reconcilePanelState, sessionKey, selectCurrent, createMediaMask} = await import(chrome.runtime.getURL('panel-state.mjs'));
  const categories = Object.keys(aliases);
  const scopedTypes = new Set(['end', 'intent', 'seen', 'vote', 'category', 'update', 'like']);
  if (document.readyState === 'loading') await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const host = document.createElement('div');
  host.id = 'steadier-extension';
  host.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:2147483647';
  document.documentElement.append(host);
  const shadow = host.attachShadow({mode:'closed'});
  keyboardHost = host;keyboardShadow = shadow;
  shadow.innerHTML = `<style>
    :host{all:initial;font:14px system-ui;color:#233d37}*{box-sizing:border-box}
    section{width:min(350px,calc(100vw - 16px));max-height:85vh;overflow:auto;background:#f8faf5;border:1px solid #cbd8c2;border-radius:16px;padding:18px;box-shadow:0 8px 40px #0003}
    h2{margin:0;font-size:20px}h3{font-size:15px;margin:16px 0 8px}
    p,small{line-height:1.5;color:#4b6048}p{font-size:13px}small,label{font-size:12px}
    textarea{width:100%;min-height:80px;resize:vertical;font:13px system-ui;padding:9px;border:1px solid #8a9f82;border-radius:7px;color:#233d37}
    button,select{font:inherit;border:1px solid #8a9f82;border-radius:7px;background:white;padding:10px;color:#345239;cursor:pointer;min-height:44px}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,#drag-handle:focus-visible,summary:focus-visible{outline:3px solid #9a6723;outline-offset:2px}
    button:disabled{opacity:.55;cursor:wait}.primary{background:#365c43;color:white;width:100%;margin-top:10px}
    input[type=range]{width:100%;accent-color:#537953;margin:15px 0;min-height:32px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:6px}.score{font-size:32px;text-align:center;margin:15px}
    .pref{margin:9px 0;font-size:12px}.pref select{font-size:12px;padding:7px}
    summary{cursor:pointer;margin:14px 0;padding:8px 0;min-height:40px}
    #message,#video-update-note{font-size:12px;line-height:1.5}#message:empty,#video-update-note:empty{display:none}#message[data-error=true]{color:#8b2828}
    #drag-handle{cursor:grab;touch-action:none;user-select:none}button[aria-pressed=true]{background:#dcebd6;border-color:#58784c;font-weight:600}
    .checkbox{display:block;margin:10px 0;line-height:1.5}.checkbox input{margin-right:7px;accent-color:#537953}
  </style><section aria-label="Steadier wellbeing panel"><div class="row" id="drag-handle" tabindex="0" role="group" aria-label="Move Steadier panel by dragging or with arrow keys"><h2>Steadier</h2><button id="collapse" aria-label="Minimise panel" aria-expanded="true" aria-controls="body">-</button></div><div id="body"></div><p id="message" role="status" aria-live="polite" aria-atomic="true"></p></section>`;
  const $ = selector => shadow.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const panel = createPanelState(), tracked = new Map(), ephemeralIds = new WeakMap();
  const requestQueue = createActionQueue(), actionQueue = createActionQueue();
  let data = null, current = null, minimised = false, saving = false, polling = false;
  let position = null, drag = null;
  const autoSkip = createAutoSkip();
  let autoSkipEnabled = true;

  function announce(message, error = false) {
    $('#message').textContent = message;
    $('#message').dataset.error = String(error);
  }
  function captureMessage(message) {
    const captured = {...message};
    if (scopedTypes.has(message.type) && !Object.hasOwn(captured,'sessionId')) captured.sessionId = data?.state.active?.sessionId;
    if (message.type !== 'get' && !Object.hasOwn(captured,'resetEpoch')) captured.resetEpoch = data?.state.resetEpoch || 0;
    return captured;
  }
  function resetTrackedSession(next) {
    autoSkip.reset(sessionKey(next));
    current = null;
    for (const item of tracked.values()) {
      const stored = next.active?.seen.find(video => video.id === item.id);
      item.manual = !!stored?.manual;
      item.category = item.manual ? stored.category : item.analysis.category;
      item.revealed = false;
      item.since = item.inView && !document.hidden ? Date.now() : 0;
      item.lastLike = readLike(item);
    }
  }
  function request(message) {
    const captured = captureMessage(message);
    return requestQueue(async () => {
      const response = await chrome.runtime.sendMessage(captured);
      if (!response || response.error) throw Error(response?.error || 'Steadier did not receive a response. Refresh the page and try again.');
      const previous = data?.state;
      const reset = captured.type === 'reset' || (!!previous?.consent && !response.state.consent);
      const structureChanged = reconcilePanelState(panel, previous, response.state, {reset});
      data = response;
      if (structureChanged) resetTrackedSession(response.state);
      else for (const item of tracked.values()) {
        const stored = response.state.active?.seen.find(video => video.id === item.id);
        if (stored?.manual) {item.manual = true;item.category = stored.category;}
      }
      return {...response, structureChanged};
    });
  }
  function canSubmitMood() {return panel.touched && (!!data?.state.consent || panel.consent);}
  function updateBusyControls() {
    for (const button of shadow.querySelectorAll('#submit,#yes,#apply-intent')) button.disabled = saving || (button.id === 'submit' && !canSubmitMood());
    $('#body').setAttribute('aria-busy', String(saving));
    if ($('#find-videos')) $('#find-videos').disabled = saving || !data?.state.active || !positiveSearchQuery(readIntent().prompt);
  }
  function perform(message, {onSuccess, focusId, successMessage} = {}) {
    const captured = captureMessage(message);
    return actionQueue(async () => {
      saving = true;updateBusyControls();
      try {
        const response = await request(captured);
        if (onSuccess) onSuccess(response);
        render({focusId});applyFilters();
        if (successMessage) announce(successMessage);
        return true;
      } catch (error) {
        try {
          const refreshed = await request({type:'get'});
          if (refreshed.structureChanged) render({focusId:refreshed.state.active ? 'session-status' : 'mood'});
        } catch (_) { /* Preserve the original action error. */ }
        announce(error.message, true);return false;
      } finally {saving = false;updateBusyControls();}
    });
  }
  function intentOptions() {return panel.intent || data?.state.active?.intent || data?.state.lastIntent || {mode:'both',prompt:'',focused:true,strict:false};}
  function intentForm() {
    const options = intentOptions();
    return `<div id="intent-form"><h3>What would you like to see?</h3><label for="style">Content style</label><select id="style" style="width:100%;margin:7px 0"><option value="both" ${options.mode === 'both' ? 'selected' : ''}>A mix / follow my prompt</option><option value="memes" ${options.mode === 'memes' ? 'selected' : ''}>Memes and humour</option><option value="serious" ${options.mode === 'serious' ? 'selected' : ''}>Serious / informational content</option></select><label for="request">Tell Steadier what you want</label><textarea id="request" maxlength="500" placeholder="Calm nature videos and dogs, less politics">${escape(options.prompt || '')}</textarea>${data.platform === 'TikTok' ? `<p id="search-query"></p><button id="find-videos" type="button" ${data.state.active ? '' : 'disabled'}>Find videos on TikTok</button>${!data.state.active ? '<p><small>Start a session to search with these filters.</small></p>' : ''}` : ''}<label class="checkbox"><input id="focused" type="checkbox" ${options.focused !== false ? 'checked' : ''}>Soften topics outside my request</label><label class="checkbox"><input id="strict" type="checkbox" ${options.strict ? 'checked' : ''}>Also soften uncertain videos</label><small id="intent-summary" aria-live="polite"></small><p><small>Find videos opens TikTok search. Steadier filters loaded results and cannot control their ranking. Local English rules match readable text. Dogs matches dog/puppy words, not all animals. Unknown videos may pass unless you enable uncertain filtering. Your prompt is saved locally.</small></p></div>`;
  }
  function readIntent() {
    if (!$('#request')) return {...intentOptions()};
    return {mode:$('#style').value,prompt:$('#request').value,focused:$('#focused').checked,strict:$('#strict').checked};
  }
  function focusSnapshot() {
    const element = shadow.activeElement;
    let start, end;
    try {start = element?.selectionStart;end = element?.selectionEnd;} catch (_) {}
    return {id:element?.id,start,end,videoId:element?.closest('#current')?.dataset.videoId,scroll:shadow.querySelector('section').scrollTop};
  }
  function restoreFocus(snapshot, requestedId) {
    let id = requestedId || snapshot.id;
    if (!requestedId && snapshot.videoId && snapshot.videoId !== current?.id) id = 'current-heading';
    const element = id && shadow.getElementById(id);
    if (element) {
      element.focus({preventScroll:!requestedId});
      if (!requestedId && typeof snapshot.start === 'number' && element.setSelectionRange) {
        try {element.setSelectionRange(snapshot.start,snapshot.end);} catch (_) {}
      }
    }
    if (!requestedId) shadow.querySelector('section').scrollTop = snapshot.scroll;
  }
  function render({focusId} = {}) {
    if (!data) return;
    const snapshot = focusSnapshot();
    const openDetails = new Set([...shadow.querySelectorAll('details[open]')].map(element => element.id));
    const state = data.state;
    $('#body').hidden = minimised;
    $('#collapse').textContent = minimised ? '+' : '-';
    $('#collapse').setAttribute('aria-label', minimised ? 'Expand panel' : 'Minimise panel');
    $('#collapse').setAttribute('aria-expanded', String(!minimised));
    if (minimised) return;
    if (!allowedPage(location.hostname,location.pathname)) {
      $('#body').innerHTML = '<p>Filtering is paused here. Open a feed or video page to use Steadier.</p>';
      restoreFocus(snapshot,focusId);return;
    }
    const active = !!state.active, last = state.sessions.at(-1);
    const moodForm = `<h3 id="mood-heading">${panel.ending ? 'How do you feel after browsing?' : 'How are you feeling before browsing?'}</h3><div class="score"><output id="value" for="mood">${panel.mood}</output><small> /100</small></div><label for="mood">Your current mood: 0 very low, 100 very good</label><input id="mood" type="range" min="0" max="100" value="${panel.mood}" aria-describedby="mood-help">${!state.consent ? `<label class="checkbox"><input type="checkbox" id="consent" ${panel.consent ? 'checked' : ''}>Store mood, topic labels, likes, prompts and ratings locally in this extension. No captions or video recordings are saved.</label>` : ''}${!panel.ending ? intentForm() : ''}<button id="submit" class="primary" ${canSubmitMood() && !saving ? '' : 'disabled'}>${panel.ending ? 'Save final mood' : 'Start session'}</button><p id="mood-help"><small>${panel.touched ? 'Your mood score is confirmed.' : 'Move the slider to confirm your score, even if you choose 50.'}</small></p>${panel.ending ? '<button id="continue">Continue browsing</button>' : ''}`;
    $('#body').innerHTML = `<p>${data.platform} web / text and comment estimates</p>${!active || panel.ending ? moodForm : `<p id="session-status" tabindex="-1">Session active / starting mood <b>${state.active.before}/100</b><br><span id="view-count">${state.active.seen.length}</span> videos viewed / <span id="likes-count">${Object.keys(state.likes || {}).length}</span> learned likes</p><div id="current"></div><button id="end" class="primary">End session & check mood</button><p><small>Use End session before leaving. An interrupted session resumes when you return.</small></p>`}${active && !panel.ending ? `<details id="session-request"><summary>Change my session request</summary>${intentForm()}<button id="apply-intent" class="primary">Apply request</button></details>` : ''}<details id="preferences"><summary>Feed preferences</summary>${categories.map(category => `<div class="row pref"><label for="pref-${category}">${category}</label><select id="pref-${category}" data-pref="${category}">${[['adaptive','Adaptive'],['show','Always show'],['hide','Soften']].map(([value,label]) => `<option value="${value}" ${state.preferences[category] === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`).join('')}<small>Filters apply during an active session. Unknown topics stay visible unless you choose to soften uncertain videos. Always show bypasses learned filtering; session requests can still soften a topic.</small></details><details id="history"><summary>History & privacy (${state.sessions.length} sessions)</summary><p>${last ? `Last session: ${last.before} to ${last.after} (${last.after-last.before >= 0 ? '+' : ''}${last.after-last.before} points)` : 'No completed sessions yet.'}</p><p>Data stays in extension storage. TikTok and Instagram have separate histories, separate from the demo website.</p><button id="export">Export data</button> <button id="delete">Delete data</button><div id="confirm">${panel.confirmDelete ? '<p>Delete this platform\'s history, saved prompts, preferences and active session?</p><button id="cancel-delete">Cancel</button> <button id="yes">Delete permanently</button>' : ''}</div><p>Reads available captions, hashtags, subtitle text and visible comments. Does not fact-check claims or read text burned into video images. Does not change platform recommendations directly.</p></details>`;
    for (const details of shadow.querySelectorAll('details')) if (openDetails.has(details.id)) details.open = true;
    bindForms();renderCurrent({force:true});restoreFocus(snapshot,focusId);updateBusyControls();
    if (active && !panel.ending && data.platform === 'TikTok') {
      const label = document.createElement('label');label.className = 'checkbox';
      const toggle = document.createElement('input');toggle.type = 'checkbox';toggle.id = 'auto-skip';toggle.checked = autoSkipEnabled;
      label.append(toggle,document.createTextNode('Automatically skip softened TikTok videos'));
      $('#session-status').after(label);
      toggle.onchange = () => {autoSkipEnabled = toggle.checked;autoSkip.reset(sessionKey(data.state));applyFilters();skipSoftened();announce(autoSkipEnabled ? 'Automatic skipping enabled.' : 'Automatic skipping paused. Reveal controls remain available.');};
    }
  }
  function bindForms() {
    if ($('#mood')) {
      $('#mood').oninput = () => {
        panel.mood = Number($('#mood').value);panel.touched = true;
        $('#value').textContent = panel.mood;$('#mood-help').textContent = 'Your mood score is confirmed.';updateBusyControls();
      };
      if ($('#consent')) $('#consent').onchange = () => {panel.consent = $('#consent').checked;updateBusyControls();};
      $('#submit').onclick = () => {
        if (!canSubmitMood() || saving) return;
        const ending = panel.ending, score = panel.mood, before = data.state.active?.before;
        perform(ending ? {type:'end',mood:score} : {type:'start',protocol:2,mood:score,consent:true,intent:readIntent()}, {
          onSuccess:() => {panel.ending = false;panel.intentDirty = false;},focusId:ending ? 'mood' : 'session-status',
          successMessage:ending ? `Session saved. Mood change: ${score-before >= 0 ? '+' : ''}${score-before} points.` : 'Session started. Your filters are active.'
        });
      };
    }
    if ($('#end')) $('#end').onclick = () => {panel.ending = true;panel.mood = 50;panel.touched = false;render({focusId:'mood'});};
    if ($('#continue')) $('#continue').onclick = () => {panel.ending = false;render({focusId:'end'});};
    if ($('#request')) {
      const updateIntent = () => {panel.intent = readIntent();panel.intentDirty = true;updateIntentSummary();};
      for (const id of ['request','style','focused','strict']) $('#'+id).addEventListener('input',updateIntent);
      updateIntentSummary();
      if ($('#find-videos')) $('#find-videos').onclick = async () => {
        if (saving || !data.state.active) return;
        const intent = readIntent(), query = positiveSearchQuery(intent.prompt), origin = sessionKey(data.state), epoch = data.state.resetEpoch || 0;
        if (!query) return;
        const saved = await perform({type:'intent',intent},{onSuccess:response => {panel.intent = response.state.active.intent;panel.intentDirty = false;}});
        if (saved && sessionKey(data.state) === origin && (data.state.resetEpoch || 0) === epoch) location.assign(`https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`);
      };
      if ($('#apply-intent')) $('#apply-intent').onclick = () => perform({type:'intent',intent:readIntent()},{onSuccess:response => {panel.intent = response.state.active.intent;panel.intentDirty = false;},successMessage:'Session request applied.'});
    }
    for (const select of shadow.querySelectorAll('[data-pref]')) select.onchange = () => perform({type:'preference',category:select.dataset.pref,value:select.value},{successMessage:'Preference saved.'});
    if ($('#export')) $('#export').onclick = exportData;
    if ($('#delete')) $('#delete').onclick = () => {panel.confirmDelete = true;render({focusId:'cancel-delete'});};
    if ($('#cancel-delete')) $('#cancel-delete').onclick = () => {panel.confirmDelete = false;render({focusId:'delete'});};
    if ($('#yes')) $('#yes').onclick = () => perform({type:'reset'},{focusId:'mood',successMessage:'This platform\'s local history and preferences have been deleted.'});
  }
  function updateIntentSummary() {
    const options = readIntent(), plan = parseIntent(options.prompt);
    $('#intent-summary').textContent = summariseIntent(plan,options.mode === 'both' ? plan.mode : options.mode);
    const query = positiveSearchQuery(options.prompt);
    if ($('#search-query')) $('#search-query').textContent = query ? `Search topic sent to TikTok: ${query}. Mood and history are not sent. Search results still use your local filters.` : 'Add a topic such as dogs to search. Exclusions alone do not create a search.';
    updateBusyControls();
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.state,null,2)],{type:'application/json'}));
    const link = document.createElement('a');link.href = url;link.download = `steadier-${data.platform}.json`;link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);announce('Your data export has been prepared.');
  }
  function itemIsCurrent(item) {
    return !!data?.state.active && current === item && tracked.get(item.video) === item && item.video.isConnected && !!item.since && Date.now()-item.since >= 2000 && !item.autoSkipping && (!item.cover || item.revealed) && !document.hidden;
  }
  function rejectStaleControl(item,originSession) {
    if (itemIsCurrent(item) && sessionKey(data.state) === originSession) return false;
    announce('That video is no longer current. Move focus away from these controls to review the video now in view.',true);return true;
  }
  function renderCurrent({force=false} = {}) {
    const container = $('#current');
    if (!container) return;
    if (!force && container.contains(shadow.activeElement)) {
      const note = $('#video-update-note');
      if (note) note.textContent = container.dataset.videoId !== (current?.id || '') ? 'The video in view has changed. Leave these controls to review it.' : '';
      return;
    }
    const item = current;
    container.dataset.videoId = item?.id || '';
    if (!item) {container.innerHTML = `<h3 id="current-heading" tabindex="-1">No current video</h3><p>Keep a video in view for two seconds. ${data.platform === 'TikTok' && autoSkipEnabled ? 'Softened videos are skipped automatically. Turn off automatic skipping to reveal or correct one.' : 'If it is covered, use Reveal video to inspect or correct its topic.'}</p>`;return;}
    const originSession = sessionKey(data.state), vote = data.state.active?.feedback[item.id];
    container.innerHTML = `<h3 id="current-heading" tabindex="-1">Current video topic</h3><label for="category">Correct the estimated topic</label><select id="category">${['Unknown',...categories].map(category => `<option ${category === item.category ? 'selected' : ''}>${category}</option>`).join('')}</select><p><small>${escape(item.analysis.kind)} / ${escape(item.analysis.confidence)} confidence<br>${escape(item.analysis.verification)}<br>Sources: ${escape(item.analysis.sources.join(', ') || 'No readable text')}<br>${item.analysis.commentCount} loaded comments read in display order.</small></p><p><small>Open comments to include them. Estimates can be wrong.</small></p><div class="row"><button id="helpful" aria-pressed="${vote === 1}">Helpful</button><button id="unhelpful" aria-pressed="${vote === -1}">Unhelpful</button></div><p id="video-update-note" role="status" aria-live="polite"></p>`;
    $('#category').onchange = event => {
      if (rejectStaleControl(item,originSession)) return;
      const category = event.target.value;
      perform({type:'category',id:item.id,category,sessionId:data.state.active.sessionId},{onSuccess:response => {
        const stored = response.state.active.seen.find(video => video.id === item.id);
        if (stored) {item.category = stored.category;item.manual = true;}
      },successMessage:'Video topic corrected.'});
    };
    for (const [id,value] of [['helpful',1],['unhelpful',-1]]) $('#'+id).onclick = () => {
      if (rejectStaleControl(item,originSession)) return;
      const existing = data.state.active.feedback[item.id];
      perform({type:'vote',id:item.id,category:item.category,value:existing === value ? 0 : value,sessionId:data.state.active.sessionId},{successMessage:'Feedback saved.'});
    };
    container.onfocusout = () => queueMicrotask(() => {if (!container.contains(shadow.activeElement)) renderCurrent();});
  }
  function updateSummary() {
    if ($('#view-count')) $('#view-count').textContent = data.state.active?.seen.length || 0;
    if ($('#likes-count')) $('#likes-count').textContent = Object.keys(data.state.likes || {}).length;
  }
  function syncCurrent() {
    const next = data?.state.active && !document.hidden && allowedPage(location.hostname,location.pathname) ? selectCurrent(tracked.values()) : null;
    const changed = current !== next || (!!$('#current') && $('#current').dataset.videoId !== (next?.id || ''));
    current = next;if (changed) renderCurrent();return changed;
  }
  function move(x,y) {
    const rect = host.getBoundingClientRect();
    position = clampPosition(x,y,rect.width,rect.height,innerWidth,innerHeight);
    Object.assign(host.style,{left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto'});
  }
  const handle = $('#drag-handle');
  handle.onpointerdown = event => {
    if (event.target.closest('button') || event.button !== 0) return;
    const rect = host.getBoundingClientRect();drag = {x:event.clientX-rect.left,y:event.clientY-rect.top};
    handle.setPointerCapture(event.pointerId);handle.style.cursor = 'grabbing';event.preventDefault();
  };
  handle.onpointermove = event => {if (drag) move(event.clientX-drag.x,event.clientY-drag.y);};
  const finishDrag = () => {
    if (!drag) return;drag = null;handle.style.cursor = 'grab';
    if (position) chrome.storage.local.set({steadierPanelPosition:position}).catch(() => announce('Panel moved, but its position could not be saved.',true));
  };
  handle.onpointerup = finishDrag;handle.onpointercancel = finishDrag;
  handle.onkeydown = event => {
    if (event.target !== handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();const rect = host.getBoundingClientRect(), step = event.shiftKey ? 40 : 10;
    move(rect.left+(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),rect.top+(event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0));
    chrome.storage.local.set({steadierPanelPosition:position}).catch(() => announce('Panel moved, but its position could not be saved.',true));
  };
  chrome.storage.local.get('steadierPanelPosition').then(result => {
    const saved = result.steadierPanelPosition;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) move(saved.x,saved.y);
  }).catch(() => {});
  window.addEventListener('resize',() => {if (position) move(position.x,position.y);});
  new ResizeObserver(() => {if (position) move(position.x,position.y);}).observe(host);
  $('#collapse').onclick = () => {minimised = !minimised;render();};
  function context(video) {
    const article = video.closest('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"]');
    if (article) return article;
    let root = video.parentElement;
    for (let depth=0;depth<5 && root?.parentElement;depth++) {
      const parent = root.parentElement;
      if (parent.matches('main,body') || parent.querySelectorAll('video').length !== 1) break;
      root = parent;
    }
    return root || video.parentElement;
  }
  function identity(root) {
    const link = root.querySelector('a[href*="/video/"],a[href*="/reel/"],a[href*="/reels/"],a[href*="/p/"]');
    if (!link) return null;
    const pathname = new URL(link.href).pathname;
    return /^\/(?:@[^/]+\/)?(?:video|reel|reels|p)\/[^/]+\/?$/.test(pathname) ? pathname : null;
  }
  function fallbackId(text) {
    let hash = 2166136261;
    for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0),16777619);
    return `text-hash:${hash>>>0}:${text.length}`;
  }
  function scan() {
    if (!data) return;
    if (!allowedPage(location.hostname,location.pathname)) {current = null;applyFilters();return;}
    const videos = [...document.querySelectorAll('video')];
    for (const video of videos) {
      const root = context(video);
      if (!root) continue;
      const evidence = extract(video,root), analysis = analyse(evidence);
      const routeId = videos.length === 1 && /^\/(?:@[^/]+\/)?(?:video|reel|reels|p)\/[^/]+\/?$/.test(location.pathname) ? location.pathname : null;
      const stableId = identity(root) || routeId;
      const text = [evidence.caption,evidence.hashtags].join(' ').trim();
      const source = video.currentSrc || video.getAttribute('src');
      if (!ephemeralIds.has(video)) ephemeralIds.set(video,`unidentified:${crypto.randomUUID()}`);
      const id = stableId || (text ? fallbackId(text) : source ? `media-${fallbackId(source)}` : ephemeralIds.get(video));
      const matchText = [evidence.caption,evidence.hashtags,evidence.subtitles,...evidence.comments].join(' ');
      let item = tracked.get(video);
      if (item?.id === id) {
        if (item.root !== root) {removeCover(item);item.root = root;}
        item.matchText = matchText;
        const previous = JSON.stringify(item.analysis);
        item.analysis = analysis;
        if (!item.manual) item.category = analysis.category;
        if (current === item && previous !== JSON.stringify(analysis) && !panel.ending) renderCurrent();
        continue;
      }
      if (item) {removeCover(item);silenceFlagged(item,false);observer.unobserve(video);if (current === item) current = null;}
      const stored = data.state.active?.seen.find(known => known.id === id);
      item = {video,root,id,category:stored?.manual ? stored.category : analysis.category,manual:!!stored?.manual,analysis,matchText,since:0,inView:false,revealed:false};
      item.lastLike = readLike(item);tracked.set(video,item);observer.observe(video);
    }
    for (const [video,item] of tracked) if (!video.isConnected) {removeCover(item);silenceFlagged(item,false);tracked.delete(video);observer.unobserve(video);if (current === item) current = null;}
    applyFilters();
  }
  function removeCover(item,{restoreFocus=false} = {}) {
    restoreFocus = restoreFocus || !!item.cover?.contains(document.activeElement);
    item.mask?.restore();item.mask = null;
    item.cover?.remove();item.cover = null;
    if (item.wasPosition !== undefined) {item.root.style.position = item.wasPosition;delete item.wasPosition;}
    if (restoreFocus) {
      const target = item.preCoverFocus?.isConnected ? item.preCoverFocus : item.video;
      const tabindex = target.getAttribute('tabindex');
      if (tabindex === null) target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
      if (tabindex === null) target.removeAttribute('tabindex');
    }
    item.preCoverFocus = null;
  }
  function applyFilters() {
    if (!data) return;
    const activeRoots = [];
    const items = [...tracked.values()].sort((a,b) => a.root === b.root ? 0 : a.root.contains(b.root) ? -1 : b.root.contains(a.root) ? 1 : 0);
    for (const item of items) {
      const reason = filterReason(data.state,item,data.softened);
      const presentation = filterPresentation({blocked:!!reason,revealed:item.revealed,allowed:allowedPage(location.hostname,location.pathname),platform:data.platform,automatic:autoSkipEnabled,active:!!data.state.active});
      silenceFlagged(item,presentation === 'skip');
      item.autoSkipping = presentation === 'skip';
      if (presentation === 'skip') {removeCover(item);continue;}
      const coveredByParent = activeRoots.some(root => root === item.root || root.contains(item.root));
      const shouldCover = allowedPage(location.hostname,location.pathname) && !!reason && !item.revealed && !coveredByParent;
      if (!shouldCover) {removeCover(item);continue;}
      activeRoots.push(item.root);
      if (item.cover && !item.cover.isConnected) removeCover(item);
      if (!item.cover) {
        const cover = document.createElement('div');
        cover.dataset.steadierCover = '';
        cover.style.cssText = 'position:absolute;inset:0;z-index:2147483646;background:#edf2e8;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#365c43;font:14px system-ui;text-align:center;padding:20px';
        cover.setAttribute('role','group');cover.setAttribute('aria-label','Video softened by Steadier');
        const label = document.createElement('p');label.dataset.steadierReason = '';
        const reveal = document.createElement('button');reveal.textContent = 'Reveal video';
        reveal.style.cssText = 'min-height:44px;padding:12px;border:1px solid #53774a;border-radius:8px;background:white;color:#365c43;cursor:pointer';
        reveal.onclick = () => {item.revealed = true;removeCover(item,{restoreFocus:true});item.since = item.inView && !document.hidden ? Date.now() : 0;syncCurrent();announce('Video revealed. Playback remains paused until you choose to resume it.');};
        cover.append(label,reveal);
        if (getComputedStyle(item.root).position === 'static') {item.wasPosition = item.root.style.position;item.root.style.position = 'relative';}
        const previousFocus = document.activeElement;
        item.root.append(cover);item.cover = cover;
        if (previousFocus && item.root.contains(previousFocus) && !cover.contains(previousFocus)) {item.preCoverFocus = previousFocus;reveal.focus({preventScroll:true});}
        item.mask = createMediaMask(item.root,cover);
      }
      const label = item.cover.querySelector('[data-steadier-reason]');
      const message = `Steadier: ${reason}`;
      if (label.textContent !== message) label.textContent = message;
      const revealButton = item.cover.querySelector('button');
      revealButton.hidden = false;
      const focus = document.activeElement;
      if (focus && item.root.contains(focus) && !item.cover.contains(focus)) {
        if (!item.preCoverFocus) item.preCoverFocus = focus;
        item.cover.querySelector('button').focus({preventScroll:true});
      }
      item.mask.refresh();item.video.pause();
    }
  }
  document.addEventListener('play',event => {
    if ([...tracked.values()].some(item => (item.cover || item.autoSkipping) && item.root.contains(event.target))) event.target.pause();
  },true);
  function readLike(item) {
    const values = likeButtons(item.root,data.platform).map(button => buttonLikeState(button,data.platform)).filter(value => value !== null);
    return values.length ? values[0] : null;
  }
  function skipSoftened() {
    if (!data || data.platform !== 'TikTok') return;
    const focused = document.activeElement;
    const editing = shadow.activeElement?.matches('textarea,select,input:not([type="checkbox"]):not([type="radio"])') || focused?.closest('textarea,select,input:not([type="checkbox"]):not([type="radio"]),[contenteditable="true"],[role="dialog"]');
    const next = [...document.querySelectorAll('button[data-e2e="arrow-right"],button[data-e2e="arrow-down"]')]
      .find(button => !button.disabled && button.getBoundingClientRect().width>0 && button.getBoundingClientRect().height>0);
    const result = autoSkip.next({key:sessionKey(data.state),enabled:autoSkipEnabled,
      visible:!document.hidden,paused:panel.ending || saving || !!editing || !allowedPage(location.hostname,location.pathname),height:innerHeight,
      canAdvance:!!next && !next.disabled && next.getBoundingClientRect().width>0,
      items:[...tracked.values()].map(item=>({item,id:item.id,connected:item.video.isConnected,rect:item.video.getBoundingClientRect(),blocked:!!filterReason(data.state,item,data.softened),revealed:item.revealed}))});
    if (!result) return;
    if (result.waiting) return;
    // Never click generic controls or send platform feedback.
    advanceVideo(result,next && !next.disabled && next.getBoundingClientRect().width ? next : null);
  }
  function preemptForward(event) {
    if (!event.isTrusted || !data?.state.active || data.platform !== 'TikTok' || !autoSkipEnabled || panel.ending || saving || document.hidden || !allowedPage(location.hostname,location.pathname)) return;
    if (event.type === 'wheel' ? event.deltaY <= 0 || Math.abs(event.deltaX)>Math.abs(event.deltaY) : event.key !== 'ArrowDown') return;
    if (event.composedPath().includes(host) || document.activeElement?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
    const target = forwardTarget([...tracked.values()].map(item=>({item,connected:item.video.isConnected,rect:item.video.getBoundingClientRect(),blocked:!!filterReason(data.state,item,data.softened),revealed:item.revealed})),innerHeight);
    if (target) {event.preventDefault();event.stopImmediatePropagation();target.video.scrollIntoView({behavior:'instant',block:'center'});}
  }
  document.addEventListener('wheel',preemptForward,{capture:true,passive:false});
  document.addEventListener('keydown',preemptForward,true);
  function watchLike(event) {
    if (!event.isTrusted || !data?.state.active || !allowedPage(location.hostname,location.pathname)) return;
    const item = [...tracked.values()].find(candidate => candidate.root.contains(event.target) && (event.type === 'dblclick' ? candidate.video === event.target : likeButtons(candidate.root,data.platform).some(button => button.contains(event.target))));
    if (!item) return;
    const before = event.type === 'dblclick' ? (item.lastLike ?? readLike(item)) : readLike(item);
    const id = item.id, originSession = sessionKey(data.state), sessionId = data.state.active.sessionId, resetEpoch = data.state.resetEpoch || 0;
    let confirmed = false;
    for (const delay of [400,1000,2200]) setTimeout(async () => {
      if (confirmed || !item.video.isConnected || tracked.get(item.video)?.id !== id || sessionKey(data.state) !== originSession) return;
      const after = readLike(item);
      if (after === null || after === before) return;
      confirmed = true;item.lastLike = after;
      try {
        const response = await request({type:'like',id,category:item.category,liked:after,kind:item.analysis.kind,sessionId,resetEpoch});
        if (response.structureChanged) render(); else updateSummary();
        announce(after ? 'Like detected. A small preference signal was saved.' : 'Unlike detected. Its preference signal was removed.');applyFilters();
      } catch (error) {announce(error.message,true);}
    },delay);
  }
  document.addEventListener('click',watchLike,true);
  document.addEventListener('dblclick',watchLike,true);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = tracked.get(entry.target);
      if (!item) continue;
      item.inView = entry.isIntersecting && entry.intersectionRatio >= .5;
      item.since = item.inView && !document.hidden ? Date.now() : 0;
    }
    syncCurrent();skipSoftened();
  },{threshold:[0,.25,.5,.75]});
  document.addEventListener('visibilitychange',() => {
    for (const item of tracked.values()) item.since = !document.hidden && item.inView ? Date.now() : 0;
    syncCurrent();
  });
  let lastRoute = location.pathname;
  await request({type:'get'});render();scan();
  let fastScanTimer = null;
  function scheduleScan() {
    if (fastScanTimer !== null) return;
    fastScanTimer = setTimeout(() => {fastScanTimer = null;scan();syncCurrent();skipSoftened();},32);
  }
  new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('[data-steadier-cover],#steadier-extension') &&
      [...record.addedNodes,...record.removedNodes].some(node => node.nodeType !== 1 || !node.matches?.('[data-steadier-cover],#steadier-extension')))) scheduleScan();
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('scroll',scheduleScan,{capture:true,passive:true});
  setInterval(skipSoftened,200);
  setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      if (lastRoute !== location.pathname) {lastRoute = location.pathname;render();}
      scan();syncCurrent();skipSoftened();
      if (!current || !data.state.active || document.hidden) return;
      const item = current, stored = data.state.active.seen.find(video => video.id === item.id);
      const message = !stored ? {type:'seen',id:item.id,category:item.category,kind:item.analysis.kind}
        : !item.manual && (stored.category !== item.category || stored.kind !== item.analysis.kind) ? {type:'update',id:item.id,category:item.category,kind:item.analysis.kind} : null;
      if (message) {const response = await request(message);if (response.structureChanged) render();updateSummary();}
    } catch (error) {announce(error.message,true);} finally {polling = false;}
  },1500);
  chrome.storage.onChanged.addListener(async (changes,area) => {
    if (area !== 'local' || !changes.steadier) return;
    try {
      const previousIntent = JSON.stringify(data?.state.active?.intent);
      const response = await request({type:'get'});
      const intentChanged = previousIntent !== JSON.stringify(data.state.active?.intent);
      if (response.structureChanged || (intentChanged && !panel.intentDirty && !$('#intent-form')?.contains(shadow.activeElement))) render({focusId:response.structureChanged ? data.state.active ? 'session-status' : 'mood' : undefined});
      else {updateSummary();renderCurrent();}
      for (const select of shadow.querySelectorAll('[data-pref]')) if (select !== shadow.activeElement) select.value = data.state.preferences[select.dataset.pref];
      applyFilters();syncCurrent();
    } catch (error) {announce(error.message,true);}
  });
})().catch(error => console.error('Steadier could not start:',error));
