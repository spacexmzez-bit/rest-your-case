/* Visual rooms sit above the existing game engine. No model or save-schema migration. */
window.RYCScene = (() => {
  const rooms = {
    court: { title: 'Courtroom', image: 'Court', recipient: 'court', hint: 'Address the bench, examine a witness, or challenge the prosecution.' },
    office: { title: 'Your office', image: 'Office', recipient: 'court', hint: 'Review your case and prepare your next move. Writing notes does not send a message.' },
    diaz: { title: 'Investigator Diaz', image: 'Diaz', recipient: 'diaz', hint: 'Private investigation channel. The existing engine controls investigation costs.' },
    partner: { title: 'Senior partner', image: 'Partner', recipient: 'partner', hint: 'Private legal strategy channel. Consultations cost 0 AP.' },
    da: { title: 'DA’s office', image: 'DA', recipient: 'da', hint: 'Discuss an offer or request disclosure from the prosecutor.' },
    intake: { title: 'Client interview', image: 'Intake', recipient: 'client', hint: 'Speak to your client and review their statement.' }
  };
  let ready = false, current = 'intake', recipient = 'client', lastTrigger, openKind = '';
  let roomTimer, sequence = 0;
  const drafts = new Map();
  const counts = {court: 0, partner: 0, diaz: 0};
  const unread = new Set();
  const byId = id => document.getElementById(id);
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
  const channel = () => current === 'partner' || current === 'diaz' ? current : 'court';
  const state = () => appState;
  const profile = () => state().profile || {};
  function displayName(key) {
    return ({court: 'The court', judge: profile().judge || 'Judge', witness: 'Witness', client: profile().client || 'Your client', da: profile().da || 'Prosecutor', partner: 'Senior partner', diaz: 'Investigator Diaz'})[key];
  }
  function rememberDraft() {
    const ch = channel();
    drafts.set(ch, byId(ch === 'court' ? 'court-user-input' : 'assistant-input').value);
  }
  function selectRoom(id, keepRecipient = false) {
    if (!rooms[id] || !ready) return;
    rememberDraft();
    current = id;
    if (!keepRecipient) recipient = rooms[id].recipient;
    activeAssistantTab = id === 'diaz' ? 'diaz' : 'partner';
    try { localStorage.setItem('ryc_visual_room', current); } catch (_) {}
    unread.delete(channel());
    document.body.dataset.room = id;
    byId('room-title').textContent = rooms[id].title;
    byId('channel-hint').textContent = rooms[id].hint;
    byId('scene-recipient').value = recipient;
    byId('scene-channel').textContent = id === 'office' ? 'Case preparation' : displayName(recipient);
    byId('dialogue-title').textContent = displayName(recipient);
    const assistant = channel() !== 'court';
    for (const key of ['court', 'partner', 'diaz']) byId(key === 'court' ? 'transcript-feed' : key + '-feed').classList.toggle('hidden', key !== channel());
    byId('court-action-form').classList.toggle('hidden', assistant);
    byId('assistant-form').classList.toggle('hidden', !assistant);
    const input = byId(assistant ? 'assistant-input' : 'court-user-input');
    input.value = drafts.get(channel()) || '';
    if (assistant) {
      input.placeholder = id === 'diaz' ? 'Ask Diaz to check a lead…' : 'Ask for legal strategy advice…';
      byId('assistant-submit-btn').textContent = id === 'diaz' ? 'Ask Diaz' : 'Consult';
    }
    byId('room-menu').hidden = true;
    byId('room-menu-toggle').setAttribute('aria-expanded', 'false');
    document.querySelectorAll('button[data-room]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.room === id)); });
    const scene = byId('room-scene');
    scene.dataset.focus = recipient;
    scene.classList.add('scene-changing');
    clearTimeout(roomTimer);
    const seq = ++sequence;
    // Paint the new image only inside the fade; rapid navigation cancels the old timer.
    roomTimer = setTimeout(() => {
      if (seq !== sequence) return;
      byId('scene-portrait').srcset = `bg_props/game/bg/${rooms[id].image}_PT.jpg`;
      byId('scene-background').src = `bg_props/game/bg/${rooms[id].image}_LS.jpg`;
      byId('scene-background').alt = rooms[id].title;
      byId('scene-image-notice').hidden = true;
      renderObjects();fitScene();
      scene.classList.remove('scene-changing');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120);
    renderActions();
    refresh();
  }
  function fitScene() {
    const camera=byId('scene-camera'),img=byId('scene-background'),plane=byId('scene-plane');
    if(!plane||!img.naturalWidth||!camera.clientWidth)return;
    const scale=Math.max(camera.clientWidth/img.naturalWidth,camera.clientHeight/img.naturalHeight);
    const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
    plane.style.width=width+'px';plane.style.height=height+'px';
    plane.style.left=(camera.clientWidth-width)/2+'px';
    plane.style.top=(camera.clientHeight-height)*(matchMedia('(orientation: portrait)').matches?.7:.5)+'px';
  }
  function selectRecipient(value) {
    const map = {court:'court', judge:'court', witness:'court', client:'intake', da:'da', partner:'partner', diaz:'diaz'};
    if (!map[value]) return;
    recipient = value;
    selectRoom(map[value], true);
  }
  function button(label, action, className = '') {
    const el = node('button', label, className); el.type = 'button'; el.addEventListener('click', action); return el;
  }
  // Replace these CSS silhouettes with character PNGs later without changing routing.
  function character(key, x, y, size) {
    const el = button('', () => selectRecipient(key), 'scene-character');
    el.dataset.character = key; el.style.setProperty('--desktop-x', x + '%'); el.style.setProperty('--desktop-y', y + '%'); el.style.setProperty('--size', size + '%');
    el.setAttribute('aria-label', 'Speak to ' + displayName(key));
    const shape = node('span', '', 'silhouette'); shape.setAttribute('aria-hidden','true');
    const label = node('span', displayName(key), 'character-label');
    el.append(shape, label); return el;
  }
  function hotspot(label, kind, x, y, w, h, asset) {
    const el = button(label, () => openDocument(kind), 'scene-hotspot');
    if(asset){const art=node('img');art.src='bg_props/props/'+asset+'.png';art.alt='';art.setAttribute('aria-hidden','true');el.textContent='';el.append(art,node('span',label));el.classList.add('scene-prop');}
    el.style.left = x + '%'; el.style.top = y + '%'; el.style.width = w + '%'; el.style.height = h + '%'; return el;
  }
  function renderObjects() {
    const group = byId('scene-objects'); group.replaceChildren();
    if (current === 'court') {
      group.append(character('judge', 60, 64, 9), character('witness', 79, 70, 8), character('da', 29, 80, 10), hotspot('Evidence', 'evidence', 11, 81, 20, 12, 'paper-b-4'));
    } else if (current === 'office') {
      group.append(hotspot('Case board', 'board', 29, 8, 35, 42), hotspot('Notebook', 'notebook', 31, 79, 16, 13, 'paper-a-1'), hotspot('Case folder', 'brief', 52, 77, 19, 15));
    } else if (current === 'diaz') {
      group.append(hotspot('Clues board', 'board', 4, 10, 40, 47), hotspot('Reports', 'reports', 33, 59, 23, 15, 'details-2'));
    } else if (current === 'partner') {
      group.append(character('partner', 52, 58, 13), hotspot('Advice notes', 'advice', 66, 77, 23, 14, 'paper-b-1'));
    } else if (current === 'da') {
      group.append(character('da', 53, 57, 13), hotspot('Offers & disclosure', 'offers', 63, 77, 28, 13, 'paper-b-2'));
    } else {
      group.append(character('client', 55, 58, 12), hotspot('Client statement', 'statement', 22, 73, 28, 15, 'paper-b-3'));
    }
  }
  function renderActions() {
    const group = byId('scene-actions'); group.replaceChildren();
    const items = {
      court: [['Object', (event) => { recipient='judge'; byId('scene-recipient').value='judge'; toggleObjectionMenu(event); refresh(); }], ['Present evidence', () => openDocument('evidence')], ['Judge', () => selectRecipient('judge')], ['Witness', () => selectRecipient('witness')], ['Recap', () => quickAction('/recap')]],
      office: [['Notebook', () => openDocument('notebook')], ['Case folder', () => openDocument('brief')], ['Defense board', () => openDocument('board')]],
      diaz: [['Reports', () => openDocument('reports')], ['Clues board', () => openDocument('board')]],
      partner: [['Advice notes', () => openDocument('advice')], ['Legal library', () => { location.href='library.html'; }]],
      da: [['Offers & disclosure', () => openDocument('offers')], ['Case folder', () => openDocument('brief')]],
      intake: [['Client statement', () => openDocument('statement')], ['Evidence', () => openDocument('evidence')]]
    };
    items[current].forEach(([label, action]) => group.append(button(label, action)));
  }
  async function submitCourt() {
    const input = byId('court-user-input'); const text = input.value.trim();
    if (!text || engineLocked || !state().hasActiveCase) return;
    const targets = {judge:'the judge', witness:'the witness currently on the stand', client:'my client', da:'the prosecutor'};
    const prompt = !text.startsWith('/') && targets[recipient] ? `To ${targets[recipient]}: ${text}` : text;
    input.value=''; drafts.set('court',''); byId('autocomplete-menu').classList.add('hidden');
    const ok=await sendCourtAction(prompt, false);
    if(!ok&&!input.value){input.value=text;drafts.set('court',text);saveDraft();}
    return ok;
  }
  async function submitAssistant() {
    const input = byId('assistant-input'); const text = input.value.trim();
    if (!text || engineLocked || !state().hasActiveCase) return;
    activeAssistantTab = channel() === 'diaz' ? 'diaz' : 'partner';
    const ch=channel();input.value=''; drafts.set(ch,'');
    const ok=await sendAssistantAction(text);
    if(!ok){drafts.set(ch,text);if(channel()===ch&&!input.value)input.value=text;}return ok;
  }
  function plain(text) {
    return String(text ?? '').replace(/<!--[\s\S]*?-->/g,'').replace(/\*\*(.*?)\*\*/gs,'$1').replace(/^#{1,3}\s+/gm,'').replace(/={5,}\s*SEALED CASE GROUND TRUTH\s*={5,}[\s\S]*?(?:={5,}|$)/gi, '[Sealed case record withheld]').replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,'[Sealed record withheld]');
  }
  function appendMessage(feed, sender, text, user, last) {
    const el = node('article', null, 'dialogue-entry' + (user ? ' player-message' : '') + (last ? ' current-message' : ''));
    el.append(node('p', sender, 'message-speaker'), node('div', plain(text), 'message-text'));
    feed.append(el);
  }
  function updated(ch, count) {
    if (count > counts[ch] && channel() !== ch) unread.add(ch);
    counts[ch] = count;
    refresh();
  }
  function renderCourtFeed() {
    const feed = byId('transcript-feed'); feed.replaceChildren();
    const entries = Array.isArray(state().transcript) ? state().transcript : [];
    if (!entries.length) feed.append(node('p', state().hasActiveCase ? 'Your case is ready. Begin with your client or review the file.' : 'Choose a case to begin your defense.', 'feed-empty'));
    entries.forEach((e, i) => appendMessage(feed, e.sender || 'Court record', e.text, e.isUser, i === entries.length-1));
    renderRequestError('court');
    updated('court', entries.length); feed.scrollTop = feed.scrollHeight;
  }
  function renderAssistantFeeds() {
    for (const ch of ['partner','diaz']) {
      const feed = byId(ch+'-feed'); feed.replaceChildren();
      const entries = ch === 'partner' ? partnerHistory : diazHistory;
      if (!entries.length) feed.append(node('p', ch==='partner' ? 'Your senior partner is available for a private consultation.' : 'Ask Diaz to examine a lead or review the known evidence.', 'feed-empty'));
      entries.forEach((e,i) => appendMessage(feed, e.role==='user' ? 'Defense counsel' : displayName(ch), (e.parts?.[0]?.text || '').replace(/^\[(?:SENIOR PARTNER|INVESTIGATOR) CONSULTATION\]:\s*/,'') , e.role==='user', i===entries.length-1));
      renderRequestError(ch);
      updated(ch,entries.length); feed.scrollTop = feed.scrollHeight;
    }
  }
  function refresh() {
    if (!ready) return;
    const active = !!state().hasActiveCase;
    byId('scene-case-title').textContent = profile().title || (active ? 'Active case' : 'No active case');
    byId('scene-phase').textContent = state().phase || 'Case preparation';
    byId('no-case-notice').hidden = active;
    byId('court-submit-btn').disabled = !active || engineLocked;
    byId('assistant-submit-btn').disabled = !active || engineLocked;
    byId('dialogue-title').textContent = displayName(recipient);
    document.querySelectorAll('button[data-room]').forEach(el => el.classList.toggle('has-update', unread.has(el.dataset.room)));
    byId('scene-activity').textContent = unread.size ? 'New conversation updates available' : '';
    // Open documents are snapshots. Never replace an active editor on request completion.
  }
  function renderRequestError(ch) {
    const request=pendingRequests[ch];if(!request?.error)return;
    const feed=byId(ch==='court'?'transcript-feed':ch+'-feed');
    feed.querySelectorAll('.request-error').forEach(el=>el.remove());
    const card=node('article',null,'request-error');card.setAttribute('role','alert');
    card.append(node('h3','Action not completed'),node('p','Review the error below and retry when ready.'));
    const details=node('details');details.append(node('summary','Show error'),node('pre',request.error));
    card.append(details,button('Retry',()=>{
      if(engineLocked)return;
      selectRoom(ch==='court'?'court':ch);
      if(ch==='court')sendCourtAction(request.prompt,request.isInit,true);
      else{activeAssistantTab=ch;sendAssistantAction(request.prompt,true);}
    }));feed.append(card);
  }
  function errorAlert(rawError,prompt,ch,isInit=false) {
    pendingRequests[ch]={...pendingRequests[ch],prompt,isInit,error:String(rawError)};
    renderRequestError(ch);
    if(channel()!==ch)unread.add(ch);
    refresh();
  }
  function closeDocument(nextFocus) {
    // Choose the destination before close: native close events run asynchronously.
    lastTrigger=nextFocus||lastTrigger;
    byId('scene-document').close();
  }
  function documentText(parent, title, value) { parent.append(node('h3',title),node('p',value)); }
  function knownFacts() {
    return (Array.isArray(state().facts) ? state().facts : []).filter(f => !(state().trashedFacts||[]).includes(hashFact(f)) && !(state().hiddenFacts||[]).includes(hashFact(f)));
  }
  function fillDocument(kind) {
    const body = byId('document-body'); body.replaceChildren();
    const labels={brief:'Case brief', evidence:'Evidence docket', board:current==='diaz'?'Clues board':'Defense board', reports:'Investigation reports', advice:'Partner’s advice notes', offers:'Offers & disclosure', statement:'Client statement'};
    byId('scene-document-title').textContent = labels[kind] || 'Case document';
    byId('scene-document').dataset.paper = ({board:'board', evidence:'exhibit', reports:'report',advice:'advice',offers:'offer',statement:'statement'})[kind] || 'report';
    if (!state().hasActiveCase) { body.append(node('p','Open a case from the archive to begin.')); return; }
    if (kind==='brief') {
      documentText(body,'Case',profile().title || 'Active case');
      for (const [key,label] of [['client','Client'],['judge','Judge'],['da','Prosecutor']]) documentText(body,label,profile()[key]||'Not yet assigned');
      documentText(body,'Current phase',state().phase);
      documentText(body,'Resources',`${state().ap} AP · ${state().strikes}/${state().maxStrikes} judicial strikes · Turn ${state().turn}`);
      const facts=knownFacts(); body.append(node('h3','Established facts'));
      if (!facts.length) body.append(node('p','No facts entered yet.'));
      const list=node('ul'); facts.forEach(f=>list.append(node('li',f)));body.append(list);
    } else if (kind==='evidence') {
      const dock=Array.isArray(state().docket)?state().docket:[];
      if (!dock.length) body.append(node('p','No exhibits marked yet.'));
      dock.forEach((item,index)=>{
        const card=node('article',null,'document-exhibit');
        card.append(node('h3',`${item.id||item.tag||'Exhibit'} · ${item.name||item.title||'Untitled'}`),node('p',item.status||'Marked','exhibit-status'));
        for(const key of ['type','facts','details','description','foundation']) if(item[key]) documentText(card,key.charAt(0).toUpperCase()+key.slice(1),String(item[key]));
        const label=node('label','Your exhibit notes');
        const notes=node('textarea');notes.dataset.exid=item.id||item.tag||'';notes.value=state().exhibitNotes?.[item.id||item.tag]||'';notes.setAttribute('aria-label',`Notes for ${item.id||item.tag||index}`);
        notes.addEventListener('input',()=>saveExhibitNote(item.id||item.tag,notes.value));
        card.append(label,notes,button('Inspect',()=>{closeDocument(byId('court-user-input'));switchTab('terminal');selectRoom('court');quickAction('/inspect '+(item.id||item.tag||item.name));}));
        card.append(button('Prepare presentation',()=>{closeDocument(byId('court-user-input'));switchTab('terminal');selectRoom('court');quickAction('I ask to introduce Exhibit '+(item.id||item.tag||item.name)+'. ');}));
        card.append(button('Manage exhibit',()=>{closeDocument(byId('tab-notebook'));switchTab('notebook');setTimeout(()=>byId('docket-list').scrollIntoView({block:'start'}),0);}));
        body.append(card);
      });
      body.append(button('+ Manual entry',()=>{closeDocument(null);lastTrigger=null;openAddExhibitModal();}));
    } else if (kind==='board') {
      body.append(node('p','Established facts and your preparation notes. These notes do not create evidence.'));
      const list=node('ul',null,'board-facts'); knownFacts().forEach(f=>list.append(node('li',f)));body.append(list);
      const notes=node('textarea');notes.value=state().notes||'';notes.setAttribute('aria-label','Defense preparation notes');
      notes.addEventListener('input',()=>{state().notes=notes.value;byId('attorney-notes').value=notes.value;try{persist();}catch(_){}});body.append(notes);
    } else {
      let entries;
      if (kind==='reports' || kind==='advice') entries=(kind==='reports'?diazHistory:partnerHistory).filter(e=>e.role==='model').map(e=>e.parts?.[0]?.text||'');
      else entries=(state().transcript||[]).filter(e=>!e.isUser).map(e=>e.text);
      if (!entries.length) body.append(node('p',kind==='reports'?'No investigation reports received yet.':kind==='advice'?'No advice recorded yet.':'No case conversation recorded yet.'));
      if (kind==='offers') body.append(node('p','The recorded case conversation appears below. Only terms explicitly offered by the prosecutor are an offer; this view creates no new agreement.'));
      if (kind==='statement') body.append(node('p','Review the recorded conversation for your client’s statements. This view does not introduce new testimony.'));
      entries.forEach(t=>body.append(node('div',plain(t),'document-record')));
    }
  }
  function openDocument(kind) {
    if(kind==='notebook'){switchTab('notebook');byId('tab-notebook').setAttribute('tabindex','-1');byId('tab-notebook').focus();return;}
    lastTrigger=document.activeElement;openKind=kind;fillDocument(kind);byId('scene-document').showModal();
  }
  function init() {
    ready=true;
    drafts.set('court',byId('court-user-input').value);
    document.querySelectorAll('button[data-room]').forEach(b=>b.addEventListener('click',()=>selectRoom(b.dataset.room)));
    byId('room-menu-toggle').addEventListener('click',()=>{const menu=byId('room-menu');menu.hidden=!menu.hidden;byId('room-menu-toggle').setAttribute('aria-expanded',String(!menu.hidden));});
    byId('scene-recipient').addEventListener('change',e=>selectRecipient(e.target.value));
    byId('history-toggle').addEventListener('click',()=>{const on=byId('dialogue-panel').classList.toggle('show-history');byId('history-toggle').setAttribute('aria-pressed',String(on));byId('history-toggle').textContent=on?'Current dialogue':'History';});
    byId('document-close').addEventListener('click',()=>byId('scene-document').close());
    byId('scene-document').addEventListener('close',()=>{if(byId('scene-document').open)return;openKind='';if(lastTrigger?.isConnected!==false)lastTrigger?.focus();});
    byId('scene-document').addEventListener('click',e=>{if(e.target===byId('scene-document')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){byId('objection-menu').classList.add('hidden');byId('autocomplete-menu').classList.add('hidden');if(!byId('tab-notebook').classList.contains('hidden'))switchTab('terminal');byId('room-menu').hidden=true;byId('room-menu-toggle').setAttribute('aria-expanded','false');}});
    document.addEventListener('click',e=>{if(!e.target.closest('.room-menu-wrap')){byId('room-menu').hidden=true;byId('room-menu-toggle').setAttribute('aria-expanded','false');}});
    byId('scene-background').addEventListener('error',()=>byId('scene-image-notice').hidden=false);
    byId('scene-background').addEventListener('load',()=>{byId('scene-image-notice').hidden=true;fitScene();});
    window.addEventListener('resize',fitScene);
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitScene).observe(byId('scene-camera'));
    let initial=/intake/i.test(state().phase||'')?'intake':'court';
    try{const saved=localStorage.getItem('ryc_visual_room');if(rooms[saved] && !(state().hasActiveCase && state().turn===1 && !(state().transcript||[]).length))initial=saved;}catch(_){}
    selectRoom(initial);renderCourtFeed();renderAssistantFeeds();
    const viewport=window.visualViewport;
    const fit=()=>{
      if(!viewport)return;
      const focused=document.activeElement;
      const editing=focused?.tagName==='INPUT'||focused?.tagName==='TEXTAREA';
      const full=Math.max(document.documentElement.clientHeight||0,window.innerHeight);
      document.body.classList.toggle('keyboard-open',editing&&full-viewport.height>120);
      document.documentElement.style.setProperty('--visible-height',viewport.height+'px');
    };
    viewport?.addEventListener('resize',fit);document.addEventListener('focusin',fit);document.addEventListener('focusout',()=>setTimeout(fit,0));
    window.addEventListener('resize',fit);fit();fitScene();
  }
  return {get ready(){return ready;},init,refresh,selectRoom,selectRecipient,submitCourt,submitAssistant,renderCourtFeed,renderAssistantFeeds,openDocument,errorAlert};
})();
