/* File name: game-scene.js — labeled room controls and recipient routing. */
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
    if (key.startsWith('witness:')) return key.slice(8) + ' (witness)';
    const name=value=>typeof value==='string'&&value.trim()&&!/^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim())?value:null;
    return ({court: 'The court', judge: name(profile().judge) || 'Judge', witness: 'Witness', client: name(profile().client) || 'Your client', da: name(profile().da) || 'Prosecutor', partner: 'Senior partner', diaz: 'Investigator Diaz'})[key];
  }
  function knownWitnesses() {
    const names = new Map();
    const add = value => {
      if (typeof value !== 'string') return;
      const name = value.replace(/[*\[\]]/g, '').trim();
      if (!name || name.length > 100 || /[\n\r<>]/.test(name) || /^(?:unknown|TBD|witness|name)$/i.test(name)) return;
      names.set(name.toLocaleLowerCase(), name);
    };
    (state().knownWitnesses || []).forEach(add);
    // Read only public records, never the sealed truth or the private case seed.
    const publicEntries=[...(state().transcript||[]),...diazHistory.filter(e=>e.role==='model').map(e=>({text:e.parts?.[0]?.text||''}))];
    for (const entry of publicEntries) {
      if (entry.isUser) continue;
      try{for(const message of RYCDialogue.parse(entry.text))if(message.role==='witness')add(message.name);}catch(_) {}
      for (const line of plain(entry.text).split('\n')) {
        const clean = line.replace(/[*#\[\]]/g, '').trim();
        const match = clean.match(/^(.{1,100}?)\s*\(witness\)\s*:/i)
          || clean.match(/^witness\s*\(([^)]+)\)\s*:/i)
          || clean.match(/^(?:state(?:'s)?|defense|prosecution)?\s*witness\s*[-–:]\s*([^:]{1,100}):/i)
          || clean.match(/^(?:state(?:'s)?|defense|prosecution)?\s*witness\s+([^:]{1,100}):/i)
          || clean.match(/^(?:state(?:'s)?|defense|prosecution)\s+witness\s*:\s*([^:]{1,100})$/i);
        if (match) add(match[1]);
      }
    }
    return [...names.values()].sort((a,b)=>a.localeCompare(b));
  }
  function refreshRecipients() {
    const select = byId('scene-recipient');
    const options = ['court','judge','client','da','partner','diaz'].map(key=>[key,displayName(key)]);
    options.push(['witness','Choose a witness…']);
    const witnesses=knownWitnesses();
    witnesses.forEach(name=>options.push(['witness:'+name,name+' (witness)']));
    if(recipient.startsWith('witness:') && !witnesses.includes(recipient.slice(8))) options.push([recipient,displayName(recipient)]);
    select.replaceChildren(...options.map(([value,label])=>new Option(label,value)));
    select.value=recipient;
    const picker=byId('witness-select');
    picker.replaceChildren(new Option('Select a known witness',''),...witnesses.map(name=>new Option(name+' (witness)',name)));
    picker.value=recipient.startsWith('witness:')?recipient.slice(8):'';
    byId('witness-status').textContent=witnesses.length?'Choose anyone from either side, or enter another known witness’s name.':'Enter a witness’s name from your case to address them.';
  }
  function openWitnessPicker() {
    byId('witness-picker').hidden=false;
    refreshRecipients();
    byId(knownWitnesses().length?'witness-select':'witness-name').focus();
    byId('witness-picker').scrollIntoView({block:'nearest'});
  }
  async function addWitness() {
    const input=byId('witness-name'), name=input.value.trim();
    const status=byId('witness-status');
    if(!name || name.length>100 || /[\r\n<>]/.test(name)) {status.textContent='Enter a name between 1 and 100 characters.';return;}
    if(!state().hasActiveCase || caseConflict) {status.textContent='Open an active case first.';return;}
    const save=byId('witness-add');save.disabled=true;
    try {
      await commitCase(next=>{next.knownWitnesses=[...new Set([...(next.knownWitnesses||[]),name])];return next;});
      input.value='';selectRecipient('witness:'+name);
    } catch(error) {status.textContent=String(error.message||error);}
    finally {save.disabled=false;}
  }
  function rememberDraft() {
    const ch = channel();
    drafts.set(ch, byId(ch === 'court' ? 'court-user-input' : 'assistant-input').value);
  }
  function selectRoom(id, keepRecipient = false) {
    if (!rooms[id] || !ready) return;
    rememberDraft();
    current = id;
    byId('witness-picker').hidden=true;
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
    const scale=Math.min(camera.clientWidth/img.naturalWidth,camera.clientHeight/img.naturalHeight);
    const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
    plane.style.width=width+'px';plane.style.height=height+'px';
    plane.style.left=(camera.clientWidth-width)/2+'px';
    plane.style.top=(camera.clientHeight-height)/2+'px';
  }
  function selectRecipient(value) {
    if(value==='witness') {openWitnessPicker();byId('scene-recipient').value=recipient;return;}
    const map = {court:'court', judge:'court', witness:'court', client:'intake', da:'da', partner:'partner', diaz:'diaz'};
    if(value.startsWith('witness:'))map[value]='court';
    if (!map[value]) return;
    recipient = value;
    byId('witness-picker').hidden=true;
    selectRoom(map[value], true);
  }
  function button(label, action, className = '') {
    const el = node('button', label, className); el.type = 'button'; el.addEventListener('click', action); return el;
  }
  // Coordinates are percentages of the complete image plane: [x,y,width,height].
  const controls = {
    court:[
      ['Speak to judge','judge',[46,35,14,17],[41,47,19,14]],
      ['Speak to DA','da',[71,60,28,19],[70,64,29,13]],
      ['Witnesses','witness',[33,44,11,18],[20,55,19,16]],
      ['Investigator Diaz','diaz',[0,72,13,17],[0,73,13,8]],
      ['Notebook','notebook',[16,79,19,17],[17,78,28,10]],
      ['Evidence docket','evidence',[65,33,12,25],[67,46,20,18]]
    ],
    office:[['Case board','board',[21,7,42,44],[4,18,76,28]],['Notebook','notebook',[31,79,16,13],[8,70,35,14]],['Case folder','brief',[52,77,19,15],[50,69,39,15]],['Legal library','library',[85,12,14,66],[92,6,8,47]]],
    diaz:[['Clues board','board',[4,6,40,50],[0,16,65,38]],['Reports','reports',[8,68,60,29],[3,68,76,19]]],
    partner:[['Speak to partner','partner',[40,40,19,31],[27,50,40,22]],['Advice notes','advice',[24,33,16,36],[3,51,23,20]]],
    da:[['Speak to DA','da',[39,45,18,29],[30,52,36,20]],['DA overview','da-overview',[5,75,17,17],[0,72,18,10]],['Offers & disclosure','offers',[57,76,15,14],[58,74,31,10]]],
    intake:[['Speak to client','client',[38,35,17,20],[41,59,37,14]],['Client statement','statement',[76,42,23,13],[79,59,20,13]]]
  };
  function controlAction(kind) {
    if(['judge','da','client','partner','diaz'].includes(kind))selectRecipient(kind);
    else if(kind==='witness')openWitnessPicker();
    else if(kind==='library')location.href='library.html';
    else openDocument(kind);
  }
  function hotspot([label,kind,wide,portrait]) {
    const el=button('',()=>controlAction(kind),'scene-hotspot');
    el.append(node('span',label));el.setAttribute('aria-label',label);el.dataset.kind=kind;
    for(const [prefix,values]of [['desktop',wide],['portrait',portrait]])for(const [index,key]of ['x','y','w','h'].entries())el.style.setProperty(`--${prefix}-${key}`,values[index]+'%');
    return el;
  }
  function renderObjects() {
    byId('scene-objects').replaceChildren(...controls[current].map(hotspot));
  }
  function renderActions() {
    const group = byId('scene-actions'); group.replaceChildren();
    const items = {
      court: [['Object', (event) => { recipient='judge'; byId('scene-recipient').value='judge'; toggleObjectionMenu(event); refresh(); }], ['Present evidence', () => openDocument('evidence')], ['Recap', () => quickAction('/recap')]],
      office: [['Notebook', () => openDocument('notebook')], ['Case folder', () => openDocument('brief')], ['Defense board', () => openDocument('board')]],
      diaz: [['Reports', () => openDocument('reports')], ['Clues board', () => openDocument('board')]],
      partner: [['Advice notes', () => openDocument('advice')], ['Legal library', () => { location.href='library.html'; }]],
      da: [['Offers & disclosure', () => openDocument('offers')], ['Case folder', () => openDocument('brief')]],
      intake: [['Client statement', () => openDocument('statement')], ['Evidence', () => openDocument('evidence')]]
    };
    items[current].forEach(([label, action]) => group.append(button(label, action)));
    const extras=controls[current].filter(([label])=>!items[current].some(([existing])=>existing===label));
    extras.forEach(([label,kind])=>group.append(button(label,()=>controlAction(kind))));
  }
  async function submitCourt() {
    const input = byId('court-user-input'); const text = input.value.trim();
    if (!text || engineLocked || caseConflict || RYCState.intakeStatus(state())!=='ready') return;
    const targets = {judge:displayName('judge'),client:displayName('client'),da:displayName('da')};
    const target=recipient.startsWith('witness:')?displayName(recipient):targets[recipient];
    const prompt = !text.startsWith('/') && target ? `To ${target}: ${text}` : text;
    input.value=''; drafts.set('court',''); byId('autocomplete-menu').classList.add('hidden');
    const ok=await sendCourtAction(prompt, false);
    if(!ok&&!input.value){input.value=text;drafts.set('court',text);saveDraft();}
    return ok;
  }
  async function submitAssistant() {
    const input = byId('assistant-input'); const text = input.value.trim();
    if (!text || engineLocked || caseConflict || RYCState.intakeStatus(state())!=='ready') return;
    activeAssistantTab = channel() === 'diaz' ? 'diaz' : 'partner';
    const ch=channel();input.value=''; drafts.set(ch,'');
    const ok=await sendAssistantAction(text);
    if(!ok){drafts.set(ch,text);if(channel()===ch&&!input.value)input.value=text;}return ok;
  }
  function plain(text) {
    return String(text ?? '').replace(/<!--[\s\S]*?-->/g,'').replace(/\*\*(.*?)\*\*/gs,'$1').replace(/^#{1,3}\s+/gm,'').replace(/={5,}\s*SEALED CASE GROUND TRUTH\s*={5,}[\s\S]*?(?:={5,}|$)/gi, '[Sealed case record withheld]').replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,'[Sealed record withheld]');
  }
  function appendMessage(feed, sender, text, user, last) {
    if(!user) {
      let messages;try{messages=RYCDialogue.parse(text,{fallback:sender});}catch(error){messages=[{name:'Formatting error',text:'This saved reply could not be read as dialogue.'}];}
      for(const message of messages)appendDialogue(feed,message.name,message.text,false,last);
      return;
    }
    appendDialogue(feed,sender,text,true,last);
  }
  function appendDialogue(feed,sender,text,user,last) {
    const el = node('article', null, 'dialogue-entry' + (user ? ' player-message' : '') + (last ? ' current-message' : ''));
    el.append(node('p', sender, 'message-speaker'), node('div', String(text), 'message-text'));
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
    byId('scene-case-title').textContent = /^(?:assigning case[.\s…]*|TBD)$/i.test(profile().title||'') ? (state().activeCaseSeed?.scout?.caseTitle||'Case setup incomplete') : profile().title || (active ? 'Active case' : 'No active case');
    const incomplete=RYCState.intakeStatus(state())==='incomplete';
    const locked=engineLocked||caseConflict;
    byId('intake-recovery').hidden=!(incomplete&&!locked);
    const request=pendingRequests.court;
    byId('intake-recovery').querySelector('button').textContent=request&&(request.isInit||/^\/start(?:\s|$)/i.test(request.prompt.trim()))?'Retry case setup':'Finish case setup';
    byId('purge-case-btn').hidden=!active;
    byId('case-resolution-btn').hidden=!RYCDialogue.ended(state());
    byId('scene-phase').textContent = state().phase || 'Case preparation';
    byId('no-case-notice').hidden = active;
    byId('court-submit-btn').disabled = !active || locked || incomplete;
    byId('assistant-submit-btn').disabled = !active || locked || incomplete;
    byId('dialogue-title').textContent = displayName(recipient);
    refreshRecipients();
    document.querySelectorAll('button[data-room]').forEach(el => el.classList.toggle('has-update', unread.has(el.dataset.room)));
    byId('scene-activity').textContent = unread.size ? 'New conversation updates available' : '';
    // Open documents are snapshots. Never replace an active editor on request completion.
  }
  function renderRequestError(ch) {
    const request=pendingRequests[ch];if(!request?.error)return;
    const feed=byId(ch==='court'?'transcript-feed':ch+'-feed');
    feed.querySelectorAll('.request-error').forEach(el=>el.remove());
    const card=node('article',null,'request-error');card.setAttribute('role','alert');
    card.append(node('h3','Action not completed'),node('p',request.error));
    const details=node('details');details.append(node('summary','Show error'),node('pre',request.error));
    card.append(details,button('Retry',()=>{
      if(engineLocked||caseConflict)return;
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
  function requestProgress(progress) {
    const text=progress?`${progress.slow?'Taking longer than usual…':'Waiting for a reply…'} ${progress.elapsed}s / 60s`:'';
    for(const id of ['request-progress','loading-request-status']) {const el=byId(id);if(el){el.textContent=text;el.hidden=!progress;}}
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
    const labels={brief:'Case brief', evidence:'Evidence docket', board:current==='diaz'?'Clues board':'Defense board', reports:'Investigation reports', advice:'Partner’s advice notes', offers:'Offers & disclosure', statement:'Client statement','da-overview':'DA overview',resolution:'Case resolution'};
    byId('scene-document-title').textContent = labels[kind] || 'Case document';
    byId('scene-document').dataset.paper = ({board:'board', evidence:'exhibit', reports:'report',advice:'advice',offers:'offer',statement:'statement'})[kind] || 'report';
    if (!state().hasActiveCase) { body.append(node('p','Open a case from the archive to begin.')); return; }
    if(kind==='resolution') {
      if(!RYCDialogue.ended(state())) {body.append(node('p','The sealed record is available after the trial ends.'));return;}
      let truth=state().activeCaseSeed?.scout?.unencryptedTruth;
      if(!truth&&typeof atob==='function')for(const entry of state().transcript||[]) {
        const block=entry.text?.match(/={3,}\s*SEALED CASE GROUND TRUTH\s*={3,}([\s\S]*?)={3,}/i)?.[1];
        if(!block)continue;
        const encoded=block.split('\n').map(s=>s.trim()).filter(s=>/^[A-Za-z0-9+/]{8,}={0,2}$/.test(s)).join('');
        if(encoded)try{truth=decodeURIComponent(Array.from(atob(encoded),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));break;}catch(_) {}
      }
      body.append(node('h3','Case resolution'),node('p',truth||'No original sealed record is available in this legacy save.'));return;
    } else if(kind==='da-overview') {
      const da=state().activeCaseSeed?.seed?.roster?.da || GAME_DATA.district_attorneys.find(d=>d.name===profile().da);
      documentText(body,'Prosecutor',profile().da||'Not yet assigned');
      if(da)for(const [key,label]of [['style','Style'],['temperament','Temperament'],['profile','Overview'],['tactic','Typical tactics'],['courtroom_behavior','Courtroom behavior'],['tactical_guidance','Preparation guidance']])if(da[key])documentText(body,label,da[key]);
      else body.append(node('p','Traits are unavailable for this prosecutor.'));
    } else if (kind==='brief') {
      documentText(body,'Case',profile().title || 'Active case');
      for (const [key,label] of [['client','Client'],['judge','Judge'],['da','Prosecutor']]) documentText(body,label,profile()[key]||'Not yet assigned');
      documentText(body,'Client occupation',RYCState.occupationLabel(RYCState.clientOccupation(state())));
      documentText(body,'Current phase',state().phase);
      documentText(body,'Resources',`${RYCState.apLabel(state())} AP · ${state().strikes}/${state().maxStrikes} judicial strikes · Turn ${state().turn}`);
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
      notes.addEventListener('input',()=>{byId('attorney-notes').value=notes.value;saveCaseNotes(notes.value);});body.append(notes);
    } else {
      let entries;
      if (kind==='reports' || kind==='advice') entries=(kind==='reports'?diazHistory:partnerHistory).filter(e=>e.role==='model').map(e=>e.parts?.[0]?.text||'');
      else entries=(state().transcript||[]).filter(e=>!e.isUser).map(e=>e.text);
      if (!entries.length) body.append(node('p',kind==='reports'?'No investigation reports received yet.':kind==='advice'?'No advice recorded yet.':'No case conversation recorded yet.'));
      if (kind==='offers') body.append(node('p','The recorded case conversation appears below. Only terms explicitly offered by the prosecutor are an offer; this view creates no new agreement.'));
      if (kind==='statement') body.append(node('p','Review the recorded conversation for your client’s statements. This view does not introduce new testimony.'));
      entries.forEach(t=>{try{const messages=RYCDialogue.parse(t,{fallback:kind==='reports'?'Investigator Diaz':kind==='advice'?'Senior partner':'Case conversation'});messages.forEach(m=>body.append(node('h3',m.name),node('div',m.text,'document-record')));}catch(_){body.append(node('p','A saved reply has an unreadable dialogue format.'));}});
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
    byId('witness-select').addEventListener('change',e=>{if(e.target.value)selectRecipient('witness:'+e.target.value);});
    byId('witness-add').addEventListener('click',addWitness);
    byId('witness-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addWitness();}});
    byId('witness-close').addEventListener('click',()=>{byId('witness-picker').hidden=true;byId('scene-recipient').focus();});
    byId('history-toggle').addEventListener('click',()=>{const on=byId('dialogue-panel').classList.toggle('show-history');byId('history-toggle').setAttribute('aria-pressed',String(on));byId('history-toggle').textContent=on?'Current dialogue':'History';});
    byId('document-close').addEventListener('click',()=>byId('scene-document').close());
    byId('scene-document').addEventListener('close',()=>{if(byId('scene-document').open)return;openKind='';if(lastTrigger?.isConnected!==false)lastTrigger?.focus();});
    byId('scene-document').addEventListener('click',e=>{if(e.target===byId('scene-document')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){byId('witness-picker').hidden=true;byId('objection-menu').classList.add('hidden');byId('autocomplete-menu').classList.add('hidden');if(!byId('tab-notebook').classList.contains('hidden'))switchTab('terminal');byId('room-menu').hidden=true;byId('room-menu-toggle').setAttribute('aria-expanded','false');}});
    document.addEventListener('click',e=>{if(!e.target.closest('.room-menu-wrap')){byId('room-menu').hidden=true;byId('room-menu-toggle').setAttribute('aria-expanded','false');}});
    byId('scene-background').addEventListener('error',()=>byId('scene-image-notice').hidden=false);
    byId('scene-background').addEventListener('load',()=>{byId('scene-image-notice').hidden=true;fitScene();});
    window.addEventListener('resize',fitScene);
    const portraitQuery=matchMedia('(max-width:899px), (hover:none) and (pointer:coarse)');portraitQuery.addEventListener?.('change',fitScene);
    if(typeof ResizeObserver!=='undefined') {
      new ResizeObserver(fitScene).observe(byId('scene-camera'));
      new ResizeObserver(()=>document.documentElement.style.setProperty('--composer-height',byId('composer-controls').getBoundingClientRect().height+'px')).observe(byId('composer-controls'));
    }
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
      document.documentElement.style.setProperty('--keyboard-offset',Math.max(0,window.innerHeight-viewport.height-(viewport.offsetTop||0))+'px');
    };
    viewport?.addEventListener('resize',fit);document.addEventListener('focusin',fit);document.addEventListener('focusout',()=>setTimeout(fit,0));
    window.addEventListener('resize',fit);fit();fitScene();
  }
  return {get ready(){return ready;},init,refresh,selectRoom,selectRecipient,submitCourt,submitAssistant,renderCourtFeed,renderAssistantFeeds,openDocument,errorAlert,knownWitnesses,controls,requestProgress};
})();
