/* ===== Merged from: ryc-dialogue.js ===== */
/* File name: ryc-dialogue.js — dialogue extraction; generated text is never HTML. */
const RYCDialogue = (() => {
  const roles=new Set(['client','judge','prosecutor','da','witness','investigator','partner','court','defense','clerk','narrator']);
  const instruction='Return spoken content as <DIALOGUE><SPEAKER name="Full name" role="client|judge|prosecutor|witness|investigator|partner|court|defense|clerk|narrator">Spoken text</SPEAKER></DIALOGUE>. Use the actual speaker name, without a role suffix in name. Put HUD, roster, evidence lists, notes and STATE_CHECKPOINT outside DIALOGUE. Do not put metadata or sealed truth inside spoken text. Escape &, <, > and quotes as XML entities where needed. Preserve the existing single-actor rule; the parser can also read multiple speakers when the game rules permit them. Every court/assistant reply needs nonempty dialogue; Scout generation stays JSON only. On an actual final verdict set trialEnded:true in STATE_CHECKPOINT; closing arguments alone do not end the trial.';
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{
    const known={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(known[m.toLowerCase()])return known[m.toLowerCase()];
    const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):'�';
  });
  function clean(raw,cutAppendix=true) {
    const text=String(raw??'').replace(/<!--[\s\S]*?-->/g,'')
      .replace(/={3,}\s*SEALED CASE GROUND TRUTH\s*={3,}[\s\S]*?(?:={3,}|$)/gi,'')
      .replace(/<SEALED_TRUTH\b[^>]*>[\s\S]*?<\/SEALED_TRUTH>/gi,'')
      .replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,'')
      .replace(/^\s*`?\[(?:STATE|ROSTER|DOCKET):[^\n]*$/gmi,'');
    return (cutAppendix?text.replace(/^\s*(?:#{1,6}\s*)?(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|SEALED (?:TRUTH|RECORD)|GROUND TRUTH|APPENDIX|METADATA)\b[^\n]*[\s\S]*$/im,''):text).trim();
  }
  function fail(message) {const e=new Error(message);e.name='ResponseValidationError';e.code='DIALOGUE_FORMAT_ERROR';throw e;}
  function parse(raw,{strict=false,fallback='Court record'}={}) {
    raw=String(raw??'');
    const blocks=[...raw.matchAll(/<DIALOGUE\s*>([\s\S]*?)<\/DIALOGUE\s*>/gi)];
    const hinted=/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw);
    if(blocks.length!==1){if(strict||hinted)fail('Reply must contain one complete DIALOGUE block. No case update was applied.');return legacy(raw,fallback);}
    if(/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw.replace(blocks[0][0],'').replace(/<!--[\s\S]*?-->/g,'')))fail('Reply contains stray dialogue tags outside its complete block.');
    const body=blocks[0][1], speakers=[...body.matchAll(/<SPEAKER\s+([^>]+)>([\s\S]*?)<\/SPEAKER\s*>/gi)];
    if(!speakers.length||body.replace(/<SPEAKER\s+[^>]+>[\s\S]*?<\/SPEAKER\s*>/gi,'').trim())fail('Dialogue contains missing or malformed speaker tags.');
    return speakers.map(s=>{
      const attrs=[...s[1].matchAll(/(name|role)\s*=\s*("([^"]*)"|'([^']*)')/gi)];
      if(attrs.length!==2||new Set(attrs.map(a=>a[1].toLowerCase())).size!==2||s[1].replace(/(name|role)\s*=\s*("[^"]*"|'[^']*')/gi,'').trim())fail('Each speaker needs only a name and role.');
      const values=Object.fromEntries(attrs.map(a=>[a[1].toLowerCase(),decode(a[3]??a[4])]));
      const name=values.name.replace(/\s*\[[^\]]{1,50}\]\s*$/,'').trim(),role=values.role.toLowerCase().trim();
      if(!name||name.length>120||/[\r\n]/.test(name)||!roles.has(role))fail('Speaker name or role is invalid.');
      if(/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(s[2]))fail('Nested dialogue tags are invalid.');
      const text=clean(decode(s[2]));
      if(!text)fail('Speaker dialogue is empty.');
      return {name,role:role==='da'?'prosecutor':role,text};
    });
  }
  function legacy(raw,fallback) {
    const text=clean(raw,false);if(!text)return [];
    const messages=[];let speaker={name:fallback,role:'court'},lines=[],metadata=false;
    const flush=()=>{const body=lines.join('\n').trim();if(body)messages.push({...speaker,text:body});lines=[];};
    for(const line of text.split('\n')) {
      const unmarked=line.replace(/\*\*/g,'').replace(/^#{1,3}\s+/,'').trim();
      if(/^(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|APPENDIX|METADATA|CASE TITLE|TITLE|CHARGE|SEALED (?:TRUTH|RECORD)|GROUND TRUTH)\b/i.test(unmarked)){metadata=true;continue;}
      const match=unmarked.match(/^\[?(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)\s+([^\]:]+)\]?\s*:?\s*(.*)$/i)
        || unmarked.match(/^([^:]{1,120}?)\s*\[(Client|Witness|Judge|Prosecutor|Investigator|Partner)\]\s*:\s*(.*)$/i);
      const plain=unmarked.match(/^([^:]{1,100}?)\s*:\s*(.+)$/);
      if(match){flush();metadata=false;const roleFirst=/^(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)$/i.test(match[1]);let role=(roleFirst?match[1]:match[2]).toLowerCase();role=role==='ada'?'prosecutor':role==='senior partner'?'partner':role;speaker={name:(roleFirst?match[2]:match[1]).trim().replace(/^\((.+)\)$/,'$1'),role};if(match[3])lines.push(match[3]);}
      else if(plain&&!metadata&&!/^(?:phase|turn|ap|strikes|exhibit|case|charge|difficulty|complexity|engine|mode|notes?)\b/i.test(plain[1])){flush();speaker={name:plain[1].replace(/\s*\(witness\)$/i,'').trim(),role:/\(witness\)/i.test(plain[1])?'witness':'court'};lines.push(plain[2]);}
      else if(!metadata&&!/^\s*(?:\|.*\||`{3}|[-=]{3,}|\s*(?:phase|turn|ap|strikes|undos|resources|status|facts|exhibits|engine|complexity|difficulty|mode)\s*:)/i.test(line))lines.push(line);
    }
    flush();return messages;
  }
  const ended=state=>state?.trialEnded===true||/^(?:trial ended|completed|case closed|concluded)$/i.test(state?.phase||'');
  return {parse,clean,instruction,ended};
})();
if(typeof window!=='undefined')window.RYCDialogue=RYCDialogue;
/* ===== Merged from: game-scene.js ===== */
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
  function rawName(key) {
    if (key.startsWith('witness:')) return key.slice(8) + ' (witness)';
    const name=value=>typeof value==='string'&&value.trim()&&!/^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim())?value:null;
    return ({court: 'The court', judge: name(profile().judge) || 'Judge', witness: 'Witness', client: name(profile().client) || 'Your client', da: name(profile().da) || 'Prosecutor', partner: 'Senior partner', diaz: 'Investigator Diaz'})[key];
  }
  function displayName(key) {return key.startsWith('witness:')?RYCStandard.nameLabel(state(),key.slice(8))+' (witness)':RYCStandard.nameLabel(state(),rawName(key));}
  function knownWitnesses() {
    const names = new Map();
    const add = value => {
      if (typeof value !== 'string') return;
      const name = value.replace(/[*\[\]]/g, '').trim();
      if (!name || name.length > 100 || /[\n\r<>]/.test(name) || /^(?:unknown|TBD|witness|name)$/i.test(name)) return;
      names.set(name.toLocaleLowerCase(), name);
    };
    (state().knownWitnesses || []).forEach(add);
    (state().activeCaseSeed?.seed?.roster?.witnesses || []).forEach(p=>add(p.name));
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
    witnesses.forEach(name=>options.push(['witness:'+name,RYCStandard.nameLabel(state(),name)+' (witness)']));
    if(recipient.startsWith('witness:') && !witnesses.includes(recipient.slice(8))) options.push([recipient,displayName(recipient)]);
    select.replaceChildren(...options.map(([value,label])=>new Option(label,value)));
    select.value=recipient;
    const picker=byId('witness-select');
    picker.replaceChildren(new Option('Select a known witness',''),...witnesses.map(name=>new Option(RYCStandard.nameLabel(state(),name)+' (witness)',name)));
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
    const targets = {judge:rawName('judge'),client:rawName('client'),da:rawName('da')};
    const target=recipient.startsWith('witness:')?rawName(recipient):targets[recipient];
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
    el.append(node('p', RYCStandard.nameLabel(state(),sender), 'message-speaker'), node('div', String(text), 'message-text'));
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
    refreshDocument();
  }
  function refreshDocument() {
    const dialog=byId('scene-document');if(!dialog.open)return;
    const editor=document.activeElement;
    const saved=dialog.contains(editor) && editor.matches('textarea') ? {
      exhibitId:editor.dataset.exid,caseNotes:editor.dataset.caseNotes,value:editor.value,
      start:editor.selectionStart,end:editor.selectionEnd,scroll:editor.scrollTop
    } : null;
    const scroll=dialog.scrollTop;
    // New discoveries must appear even while the player is writing an annotation.
    // Rebuild the record, then restore the editor's unsaved text and selection.
    fillDocument(openKind);
    if(saved){
      const replacement=[...dialog.querySelectorAll('textarea')].find(el=>saved.exhibitId!==undefined ? el.dataset.exid===saved.exhibitId : saved.caseNotes==='true' && el.dataset.caseNotes==='true');
      if(replacement){replacement.value=saved.value;replacement.focus({preventScroll:true});replacement.setSelectionRange(saved.start,saved.end);replacement.scrollTop=saved.scroll;}
    }
    dialog.scrollTop=scroll;
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
      documentText(body,'Prosecutor',RYCStandard.nameLabel(state(),profile().da)||'Not yet assigned');
      if(da)for(const [key,label]of [['style','Style'],['temperament','Temperament'],['profile','Overview'],['tactic','Typical tactics'],['courtroom_behavior','Courtroom behavior'],['tactical_guidance','Preparation guidance']])if(da[key])documentText(body,label,da[key]);
      else body.append(node('p','Traits are unavailable for this prosecutor.'));
    } else if (kind==='brief') {
      documentText(body,'Case',profile().title || 'Active case');
      for (const [key,label] of [['client','Client'],['judge','Judge'],['da','Prosecutor']]) documentText(body,label,RYCStandard.nameLabel(state(),profile()[key])||'Not yet assigned');
      const victim=state().activeCaseSeed?.seed?.roster?.victim;if(victim)documentText(body,'Victim',RYCStandard.nameLabel(state(),victim.name));
      documentText(body,'Client occupation',RYCState.occupationLabel(RYCState.clientOccupation(state())));
      documentText(body,'Current phase',state().phase);
      documentText(body,'Resources',`${RYCState.apLabel(state())} AP · ${state().strikes}/${state().maxStrikes} judicial strikes · Turn ${state().turn}`);
      const facts=knownFacts(); body.append(node('h3','Established facts'));
      if (!facts.length) body.append(node('p','No facts entered yet.'));
      const list=node('ul'); facts.forEach(f=>list.append(node('li',f)));body.append(list);
    } else if (kind==='offers') {
      body.append(node('p','Offers are proposals from the prosecutor. Requesting or rejecting one does not resolve the case. Acceptance asks the judge to approve the exact saved terms. Disclosure records are kept here and linked to the evidence docket.'));
      const action=async prompt=>{if(engineLocked||caseConflict)return;closeDocument();selectRoom('da');await sendCourtAction(prompt);openDocument('offers');};
      const ask=button('Request an offer',()=>action('/offer request'));
      const disclose=button('Request disclosure',()=>action(`To ${profile().da}: Please disclose the prosecution exhibits and any known exculpatory material. Save disclosure records and each newly disclosed exhibit in the docket; do not fabricate an outstanding discovery response.`));
      ask.disabled=disclose.disabled=engineLocked||caseConflict||RYCDialogue.ended(state())||RYCState.intakeStatus(state())!=='ready';body.append(ask,disclose);
      const offers=state().offers||[];
      if(!offers.length)body.append(node('p','No offers have been made. The prosecutor may decline to offer terms.'));
      for(const offer of offers){
        const card=node('article',null,'document-exhibit');
        const active=offer.status==='proposed' && state().turn<offer.expiresTurn && !RYCDialogue.ended(state());
        card.append(node('h3',offer.title),node('p',`${offer.id} · ${offer.status==='proposed'&&!active?'expired / unavailable':offer.status} · expires at turn ${offer.expiresTurn}`),node('p',offer.terms),node('p','Basis: '+offer.basis));
        if(offer.reducedCharge)card.append(node('p','Proposed charge: '+offer.reducedCharge));
        card.append(node('p','Referenced exhibits: '+(offer.sourceExhibitIds.join(', ')||'None')));
        if(active){const accept=button('Ask judge to approve',()=>{if(confirm('Accept these exact terms and ask the judge to end the case?\n\n'+offer.terms))action('/offer accept '+offer.id);});
          const reject=button('Reject offer',()=>action('/offer reject '+offer.id));accept.disabled=reject.disabled=engineLocked||caseConflict;card.append(accept,reject);}
        body.append(card);
      }
      body.append(node('h3','Disclosures'));
      if(!(state().disclosures||[]).length)body.append(node('p','No disclosure records received.'));
      for(const disclosure of state().disclosures||[])body.append(node('h4',disclosure.id),node('p',disclosure.text),node('p','Exhibits: '+(disclosure.exhibitIds.join(', ')||'No exhibits attached')));
      body.append(button('Open evidence docket',()=>{openKind='evidence';fillDocument('evidence');}));
    } else if (kind==='evidence') {
      const dock=Array.isArray(state().docket)?state().docket:[];
      if (!dock.length) body.append(node('p','No exhibits marked yet.'));
      dock.forEach((item,index)=>{
        const card=node('article',null,'document-exhibit');
        card.append(node('h3',`${item.id||item.tag||'Exhibit'} · ${item.name||item.title||'Untitled'}`),node('p',item.status||'Marked','exhibit-status'));
        for(const key of ['type','facts','details','description','foundation']) if(item[key] && !(key==='details' && item.details===item.facts)) documentText(card,key.charAt(0).toUpperCase()+key.slice(1),String(item[key]));
        const label=node('label','Your exhibit notes');
        const notes=node('textarea');notes.dataset.exid=item.id||item.tag||'';notes.value=state().exhibitNotes?.[item.id||item.tag]||'';notes.setAttribute('aria-label',`Notes for ${item.id||item.tag||index}`);
        notes.addEventListener('input',()=>saveExhibitNote(item.id||item.tag,notes.value));
        card.append(label,notes,button('Inspect',()=>{closeDocument(byId('court-user-input'));switchTab('terminal');selectRoom('court');quickAction('/inspect '+(item.id||item.tag||item.name));}));
        card.append(button('Prepare presentation',()=>{closeDocument(byId('court-user-input'));switchTab('terminal');selectRoom('court');quickAction('I ask to introduce Exhibit '+(item.id||item.tag||item.name)+'. ');}));
        if(item.isManual){card.append(button('Edit manual exhibit',()=>{closeDocument();openAddExhibitModal(index);}));card.append(button('Delete manual exhibit',async()=>{await deleteExhibit(index);fillDocument('evidence');}));}
        card.append(button('Manage exhibit',()=>{closeDocument(byId('tab-notebook'));switchTab('notebook');setTimeout(()=>byId('docket-list').scrollIntoView({block:'start'}),0);}));
        body.append(card);
      });
      const reports=(state().investigations||[]).filter(r=>r.status==='completed');
      if(reports.length)body.append(node('h3','Investigation findings'));
      for(const report of reports){body.append(node('h4',report.id),node('p',report.summary),node('p','Exhibits: '+((report.exhibitIds||[]).join(', ')||'No exhibit; factual finding only')));for(const fact of report.facts||[])body.append(node('p',fact));}
      body.append(button('+ Manual entry',()=>{closeDocument(null);lastTrigger=null;openAddExhibitModal();}));
    } else if (kind==='board') {
      body.append(node('p','Established facts and your preparation notes. These notes do not create evidence.'));
      const list=node('ul',null,'board-facts'); knownFacts().forEach(f=>list.append(node('li',f)));body.append(list);
      const notes=node('textarea');notes.dataset.caseNotes='true';notes.value=state().notes||'';notes.setAttribute('aria-label','Defense preparation notes');
      notes.addEventListener('input',()=>{byId('attorney-notes').value=notes.value;saveCaseNotes(notes.value);});body.append(notes);
    } else {
      let entries;
      if (kind==='reports' || kind==='advice') entries=(kind==='reports'?diazHistory:partnerHistory).filter(e=>e.role==='model').map(e=>e.parts?.[0]?.text||'');
      else entries=(state().transcript||[]).filter(e=>!e.isUser).map(e=>e.text);
      if (!entries.length) body.append(node('p',kind==='reports'?'No investigation reports received yet.':kind==='advice'?'No advice recorded yet.':'No case conversation recorded yet.'));
      if (kind==='offers') body.append(node('p','The recorded case conversation appears below. Only terms explicitly offered by the prosecutor are an offer; this view creates no new agreement.'));
      if (kind==='statement') body.append(node('p','Review the recorded conversation for your client’s statements. This view does not introduce new testimony.'));
      entries.forEach(t=>{try{const messages=RYCDialogue.parse(t,{fallback:kind==='reports'?'Investigator Diaz':kind==='advice'?'Senior partner':'Case conversation'});messages.forEach(m=>body.append(node('h3',RYCStandard.nameLabel(state(),m.name)),node('div',m.text,'document-record')));}catch(_){body.append(node('p','A saved reply has an unreadable dialogue format.'));}});
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
/* ===== Merged from: game.js ===== */
/* File name: game.js */
// game.js
let appState = {
  hasActiveCase: false, 
  profile: { title: '', client: '', judge: '', da: '', clientOccupation: 'civilian' },
  phase: 'Phase 1: Intake', 
  turn: 1, 
  ap: 10, 
  strikes: 0, 
  maxStrikes: 3, 
  notes: '',
  transcript: [], 
  docket: [], 
  facts: [], 
  difficulty: 'Normal', 
  complexity: 3, 
  category: 'Random Case File',
  selectedModel: 'gemini-3.8-flash',
  activeCaseSeed: null,
  trashedFacts: [], 
  hiddenFacts: [], 
  exhibitNotes: {}, 
  hasSeenTrashWarning: false
};

let recoveryOriginal = null;
let savedCaseRaw = null;
let caseConflict = false;
let caseSaveQueue = Promise.resolve();
let activeEngineController = null;
let autoInitialize = false;
const pendingRequests = {};
let trialHistory = [];
let partnerHistory = [];
let diazHistory = [];
let activeAssistantTab = 'partner';
let engineLocked = false;
let pendingTrashFactId = null;
let customGeminiKey = null; // BYOK State
const GAME_WORKER_URL = "https://rest-your-case.spacexmzez.workers.dev/";

// Loading Tips
let loadingInterval;
const loadingTips = [
  "TIP: Premeditation turns 2nd Degree Murder into 1st Degree.",
  "TIP: A hostile witness cannot be lead on cross-examination... wait, yes they can.",
  "TIP: Subpoenas cost 1 AP. All investigative actions are capped at 2 AP maximum.",
  "TIP: Object with FRE 404(b) whenever the DA brings up uncharged bad acts.",
  "TIP: Suppressing tainted evidence removes all derivative fruits under the 4th Amendment.",
  "TIP: Consult your Senior Partner (/consult) without spending any AP."
];

function escapeGameText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function hashFact(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  return hash.toString();
}

function toggleNavDrawer() {
  document.getElementById('nav-drawer').classList.toggle('-translate-x-full');
  document.getElementById('nav-drawer-backdrop').classList.toggle('hidden');
}

function switchTab(tabId) {
  if(tabId==='notebook'){renderDocket();document.getElementById('attorney-notes').value=appState.notes;}
  const tabs = ['terminal', 'notebook'];
  tabs.forEach(t => {
    const view = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-${t}-btn`);
    if (view) view.classList.toggle('hidden', t !== tabId);
    
    if (btn) {
      btn.className = (t === tabId) 
        ? 'w-full text-left px-3 py-2.5 rounded bg-brand-border text-white border border-brand-gold/40 transition'
        : 'w-full text-left px-3 py-2.5 rounded text-brand-muted hover:text-white hover:bg-brand-surface transition';
    }
  });

  if (tabId === 'terminal') {
    const feed = document.getElementById('transcript-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

function navToTab(tabId) {
  switchTab(tabId);
  toggleNavDrawer();
}

function updateShelfBadge() {
  if (typeof getShelfCases === 'function') {
    const count = getShelfCases().length;
    const navBadge = document.getElementById('nav-shelf-badge');
    const drawerBadge = document.getElementById('drawer-shelf-count');
    if (navBadge) navBadge.innerText = count;
    if (drawerBadge) drawerBadge.innerText = count;
  }
}

function updateActiveModelDisplay() {
  const label = RYCModels.label();
  const statusBadge = document.getElementById('engine-status');
  if (statusBadge && !engineLocked) statusBadge.innerText = `Active (${label})`;
  const modelSpan = document.getElementById('nb-model');
  if (modelSpan) modelSpan.innerText = label;
}

// =====================================
// BYOK HANDLERS
// =====================================
function updateKeyIndicator() {
  const indicator = document.getElementById('nav-key-indicator');
  if (indicator) {
    indicator.className = customGeminiKey 
      ? 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] transition-colors duration-300' 
      : 'w-2 h-2 rounded-full bg-slate-600 transition-colors duration-300';
  }
}

function openKeyModal() {
  document.getElementById('key-input').value = customGeminiKey || '';
  document.getElementById('key-input').type = 'password';
  document.getElementById('engine-mode').value = RYCModels.get();
      document.getElementById('settings-error').hidden = true;
      document.getElementById('key-modal').classList.remove('hidden');
}

function closeKeyModal() {
  document.getElementById('key-modal').classList.add('hidden');
}

function toggleKeyVisibility() {
  const input = document.getElementById('key-input');
  input.type = input.type === 'password' ? 'text' : 'password';
  const button=document.getElementById('key-visibility-btn');
  if(button)button.textContent=input.type==='password'?'Show key':'Hide key';
}

function saveCustomKey() {
  const val = document.getElementById('key-input').value.trim();
  try {
    RYCModels.set(document.getElementById('engine-mode').value);
    if (val) localStorage.setItem('rest_your_case_custom_gemini_key', val);
    else localStorage.removeItem('rest_your_case_custom_gemini_key');
    customGeminiKey = val || null;
    updateKeyIndicator();
    if (typeof updateActiveModelDisplay === 'function') updateActiveModelDisplay();
    closeKeyModal();
  } catch (error) {
    const notice = document.getElementById('settings-error');
    notice.textContent = 'Could not save settings: ' + error.message;
    notice.hidden = false;
  }
}

function clearCustomKey() {
  localStorage.removeItem('rest_your_case_custom_gemini_key');
  customGeminiKey = null;
  document.getElementById('key-input').value = '';
  updateKeyIndicator();
  closeKeyModal();
}

function initApp() {
  let saved = null;
  try { saved = localStorage.getItem('rest_your_case_state'); } catch (_) { storageNotice('Browser storage is unavailable. Saving may fail.'); }
  savedCaseRaw = saved;
  let parsed = null;
  if (saved) {
    try { parsed = JSON.parse(saved); } catch (_) { storageNotice('The saved case could not be read. A backup will be kept before saving.'); }
    appState = RYCState.normalize(parsed, appState);
    if (RYCState.needsRecovery(parsed)) {
      recoveryOriginal = saved;
      storageNotice('Some saved fields need recovery. Valid case data has been retained.');
    }
  }
  const loadHistory = (channel, key) => {
    let value = parsed?._histories?.[channel];
    if (value === undefined) { try { value = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { value = []; } }
    return RYCState.history(value);
  };
  trialHistory = loadHistory('court','rest_your_case_history');
  partnerHistory = loadHistory('partner','rest_your_case_partner_history');
  diazHistory = loadHistory('diaz','rest_your_case_diaz_history');
  if(RYCState.object(parsed?._requests)) for(const ch of ['court','partner','diaz']) {
    const request=parsed._requests[ch];
    if(RYCState.object(request)&&typeof request.prompt==='string') pendingRequests[ch]={prompt:request.prompt,isInit:request.isInit===true,started:request.started===true,response:RYCState.object(request.response)?request.response:undefined,error:typeof request.error==='string'&&request.error?request.error:'This action was interrupted. Retry when ready.'};
  }

  if(appState.hasActiveCase&&!appState.caseId)appState.caseId=RYCCaseStore.id();
  if(typeof appState.intakeComplete!=='boolean')appState.intakeComplete=RYCState.intakeStatus(appState)==='ready';

  let savedDraft=null;try{savedDraft=localStorage.getItem('terminal_draft');}catch(_){}
  if (savedDraft) document.getElementById('court-user-input').value = savedDraft;

  // Init BYOK & Shelf count
  try{customGeminiKey=localStorage.getItem('rest_your_case_custom_gemini_key')||null;}catch(_){}
  updateKeyIndicator();
  try{updateShelfBadge();}catch(_){storageNotice('The archive could not be read. Your active case is still available.');}

  // Check URL Hash for initial tab
  const hash = window.location.hash.replace('#', '');
  if (hash === 'notebook') {
    switchTab('notebook');
  } else {
    switchTab('terminal');
  }

  renderUI();
  renderAssistantFeeds();
  updateActiveModelDisplay();

  // Old session flags are hints only. Never initialize an inactive or completed trial.
  let flag=null;
  try {
    flag=sessionStorage.getItem('trigger_engine_handshake')||sessionStorage.getItem('trigger_intake_start');
    sessionStorage.removeItem('trigger_engine_handshake');sessionStorage.removeItem('trigger_intake_start');
  } catch (_) {}
  autoInitialize=!!flag&&RYCState.intakeStatus(appState)==='incomplete'&&!pendingRequests.court;

}

/**
 * Builds the rich, context-packed Turn 1 initialization prompt for the Courtroom Engine.
 * Uses the already-synthesized Scout data and sampled parameters.
 */
function executeEngineInitializationHandshake(caseObj) {
  caseObj=RYCState.repairOccupationRecord(caseObj,appState.profile.clientOccupation);
  const error=RYCState.seedError(caseObj);if(error)throw new Error(error);
  const seed = caseObj.seed;
  const scout = caseObj.scout;
  const diff = caseObj.difficulty || appState.difficulty || 'Normal';

  // Encode the ground truth in Base64 for the sealed block
  let base64Truth = "";
  try {
    base64Truth = btoa(unescape(encodeURIComponent(scout.unencryptedTruth || "No truth specified.")));
  } catch (e) {
    base64Truth = scout.unencryptedTruth || "No truth specified.";
  }

  const exhibitsDesc = (scout.starterExhibits || []).map(e => `[${e.id}]: ${e.name} (${e.type}) - ${e.details}`).join('\n');

  const handshakePrompt = `/start --mode=web --difficulty=${diff} --complexity=${seed.meta.complexity}

CASE INTAKE PARAMETERS & ESTABLISHED GROUND RECORD:
- Case Title: ${scout.caseTitle}
- Presiding Judge: ${seed.roster.judge.name} (${seed.roster.judge.style} | Temperament: ${seed.roster.judge.temperament})
- Prosecutor: ${seed.roster.da.name} (${seed.roster.da.style} | Tactic: ${seed.roster.da.tactic})
- Defendant / Client: ${seed.roster.client.name}
- Client occupation: ${RYCState.recordOccupation(caseObj) ?? "Unclassified legacy client; resolve from the established story before locking."}
- Initial AP: ${appState.ap}
- Maximum judicial strikes: ${appState.maxStrikes}
- Charge: ${seed.charge.charge}
- Statutory Definition: ${seed.charge.statutory_definition}
- Required Mens Rea: ${seed.charge.mens_rea}
- Crime Summary: ${scout.crimeSummary}
- Setting / Venue: ${seed.narrative_seeds.venue.name} (${seed.narrative_seeds.venue.category})
- Primary Evidence Anchor: ${seed.narrative_seeds.primary_evidence_anchor.item} (${seed.narrative_seeds.primary_evidence_anchor.type})
- Hidden Constitutional Flaw: ${seed.narrative_seeds.constitutional_flaw.flaw} (Legal Basis: ${seed.narrative_seeds.constitutional_flaw.legal_basis})
- Witness Friction: ${seed.narrative_seeds.witness_friction.friction}
- Client Complication: ${seed.narrative_seeds.client_complication.complication}
- Planned DA Misconduct Trap: ${seed.mechanics.da_misconduct_trap.name} (${seed.mechanics.da_misconduct_trap.legal_basis})
- Jury Verdict Pivot: ${seed.mechanics.jury_verdict_guide.pivot} (Acquittal Standard: ${seed.mechanics.jury_verdict_guide.acquittal_test})

INITIAL DISCOVERY PACKET:
${exhibitsDesc}

[ENGINE INTERNAL - SEALED RECORD TRUTH]:
"${scout.unencryptedTruth}"

MANDATORY TURN 1 INITIALIZATION DIRECTIVE:
1. Output the Sealed Case Ground Truth block using this exact Base64 string:
==================== SEALED CASE GROUND TRUTH ====================
${base64Truth}
(DO NOT DECODE UNTIL THE VERDICT HAS BEEN RENDERED)
==================================================================
2. Mark the 2 starter exhibits as (Marked) in the docket.
3. Yield the floor IMMEDIATELY to **[Client ${seed.roster.client.name}]** in holding, speaking exactly two sentences of opening dialogue to Lead Defense Counsel.
4. Output dialogue for NO OTHER NPC. Enclose the state checkpoint at the bottom.`;

  return sendCourtAction(handshakePrompt, true);
}

// State and histories commit in one localStorage value. Legacy history keys are mirrors.
function storageNotice(message) {
  let notice=document.getElementById('save-notice');
  if(!notice){notice=document.createElement('p');notice.id='save-notice';notice.setAttribute('role','alert');document.body.append(notice);}
  notice.textContent=message;notice.hidden=false;
}
function invalidateCase() {
  caseConflict=true;
  activeEngineController?.abort();
  for(const ch of Object.keys(pendingRequests))delete pendingRequests[ch];
  storageNotice('This trial changed in another tab. Reload to use the latest saved case. Keep a copy of any unsent text before reloading.');
  if(window.RYCScene?.ready)RYCScene.refresh();
}
function ensureCaseCurrent() {
  if(caseConflict)throw RYCCaseStore.conflict();
  try{RYCCaseStore.check(savedCaseRaw);}catch(error){if(error.name==='CaseConflictError')invalidateCase();throw error;}
}
function persist() { return commitCase(state=>state); }
function commitCase(next, histories={}, requests, options={}) {
  const run=async()=>{
    try {
      ensureCaseCurrent();
      const proposed=typeof next==='function'?next(RYCState.clone(appState)):next;
      const nextHistories={court:histories.court??trialHistory,partner:histories.partner??partnerHistory,diaz:histories.diaz??diazHistory};
      const existing={court:trialHistory,partner:partnerHistory,diaz:diazHistory};
      const source=Object.keys(histories).find(ch=>nextHistories[ch].length>existing[ch].length);
      RYCTokenCore.capture(appState,proposed,{id:source?RYCTokenCore.sourceId(source,nextHistories[source].length-1,nextHistories[source].at(-1)):'player-or-case-update'});
      RYCTokenCore.preserveReplacedSources(proposed,existing,nextHistories);
      const nextRequests=requests??pendingRequests;
      const saved=await RYCCaseStore.write(savedCaseRaw,{...proposed,_histories:nextHistories,_requests:nextRequests},{backup:recoveryOriginal,...options});
      savedCaseRaw=saved.raw;appState=RYCState.normalize(saved.state,RYCState.emptyState());
      trialHistory=nextHistories.court;partnerHistory=nextHistories.partner;diazHistory=nextHistories.diaz;
      if(requests!==undefined){for(const ch of Object.keys(pendingRequests))delete pendingRequests[ch];Object.assign(pendingRequests,requests);}
      recoveryOriginal=null;
      const notice=document.getElementById('save-notice');if(notice)notice.hidden=true;
      return true;
    } catch(error) {
      if(error.name==='CaseConflictError')invalidateCase();
      else storageNotice('Could not save this case. Your browser storage may be full or unavailable. Keep this page open to retain unsaved text.');
      throw error;
    }
  };
  const result=caseSaveQueue.then(run);caseSaveQueue=result.catch(()=>{});return result;
}

function saveDraft() {
  if(caseConflict)return;
  try{ensureCaseCurrent();localStorage.setItem('terminal_draft', document.getElementById('court-user-input').value);}catch(_){storageNotice('Your draft could not be saved. Keep this page open.');}
}

// Autocomplete logic with strictly enforced 2-AP cap
function handleInputDraft() {
  saveDraft();
  const input = document.getElementById('court-user-input');
  const val = input.value.trim().toLowerCase();
  const menu = document.getElementById('autocomplete-menu');
  
  if (val.startsWith('/inspect')) {
    const exhibits = (appState.docket || []).map(e => e.id || e.tag).filter(Boolean);
    if (exhibits.length > 0) {
      menu.replaceChildren();
      exhibits.forEach(ex => {
        const option=document.createElement('button');option.type='button';
        option.className='block w-full text-left px-3 py-2';
        const label=document.createElement('span');label.textContent=ex;
        const cost=document.createElement('span');cost.textContent=' · 0 AP';
        option.append(label,cost);
        option.addEventListener('click',()=>fillAutocomplete('/inspect '+ex));
        menu.append(option);
      });
      menu.classList.remove('hidden');
    } else {
      menu.innerHTML = `<div class="px-3 py-2 text-[10px] text-brand-muted italic">No marked exhibits in docket yet.</div>`;
      menu.classList.remove('hidden');
    }
  } else if (val.startsWith('/subpoena')) {
    const targets = [
      { name: "Cell Tower Telemetry & Pings", desc: "1 AP - Carrier timing offsets", cost: "1 AP" },
      { name: "911 Dispatch & CAD Run Logs", desc: "1 AP - Audio buffer", cost: "1 AP" },
      { name: "Transit Turnstile & Badge Logs", desc: "1 AP - Access telemetry", cost: "1 AP" },
      { name: "Bank & Transaction Records", desc: "1 AP - Financial timeline", cost: "1 AP" },
      { name: "Optical Sensors / CCTV Sweep", desc: "2 AP - Field video canvass", cost: "2 AP" },
      { name: "Forensic Biological / Ballistics Audit", desc: "2 AP - Independent re-test", cost: "2 AP" }
    ];
    menu.innerHTML = targets.map(t => `
      <button type="button" onmousedown="fillAutocomplete('/subpoena ${t.name}')" class="block w-full text-left px-3 py-2 bg-brand-dark hover:bg-brand-surface text-slate-200 hover:text-brand-gold transition flex items-center justify-between">
        <div>
          <span class="block">${t.name}</span>
          <span class="text-[9px] text-brand-muted">${t.desc}</span>
        </div>
        <span class="text-[10px] text-brand-gold font-bold">${t.cost}</span>
      </button>
    `).join('');
    menu.classList.remove('hidden');
  } else if (val.startsWith('/consult')) {
    menu.innerHTML = `
      <button type="button" onmousedown="fillAutocomplete('/consult ')" class="block w-full text-left px-3 py-2 bg-brand-dark hover:bg-brand-surface text-slate-200 hover:text-brand-gold transition flex items-center justify-between">
        <span>Consult Senior Partner</span>
        <span class="text-[10px] text-emerald-400">0 AP / 0 Strikes</span>
      </button>`;
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
}

function fillAutocomplete(text) {
  const input = document.getElementById('court-user-input');
  input.value = text + ' ';
  document.getElementById('autocomplete-menu').classList.add('hidden');
  input.focus();
  saveDraft();
}

function quickAction(cmd, event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('court-user-input');
  input.value = cmd;
  input.focus();
  handleInputDraft();
}

function toggleObjectionMenu(event) {
  if (event) event.stopPropagation();
  document.getElementById('objection-menu').classList.toggle('hidden');
}

document.addEventListener('click', function(event) {
  const objMenu = document.getElementById('objection-menu');
  if (objMenu && !objMenu.contains(event.target)) {
    objMenu.classList.add('hidden');
  }

  const autoMenu = document.getElementById('autocomplete-menu');
  const inputField = document.getElementById('court-user-input');
  if (autoMenu && !autoMenu.contains(event.target) && event.target !== inputField) {
    autoMenu.classList.add('hidden');
  }
});

window.saveExhibitNote = async function(exhibitId, value) {
  if (!exhibitId || ['__proto__','constructor','prototype'].includes(exhibitId)) return;
  try{await commitCase(next=>{next.exhibitNotes[exhibitId]=value;return next;});}
  catch(_){return false;}
  document.querySelectorAll('textarea[data-exid]').forEach(input=>{if(input.dataset.exid===exhibitId&&input!==document.activeElement)input.value=value;});
  return true;
}

function renderUI() {
  document.getElementById('view-no-case-notebook').classList.toggle('hidden', appState.hasActiveCase);
  document.getElementById('view-active-case-notebook').classList.toggle('hidden', !appState.hasActiveCase);
  
  if (appState.hasActiveCase) {
    document.getElementById('term-turn').innerText = appState.turn;
    document.getElementById('term-ap').innerText = RYCState.apLabel(appState);
    document.getElementById('term-strikes').innerText = `${appState.strikes}/${appState.maxStrikes}`;
    document.getElementById('nb-casetitle').innerText = appState.profile.title || 'State v. Unknown';
    document.getElementById('nb-phase').innerText = appState.phase;
    const notes=document.getElementById('attorney-notes');if(document.activeElement!==notes)notes.value=appState.notes||'';
    
    const diffSpan = document.getElementById('nb-diff');
    const compSpan = document.getElementById('nb-comp');
    if (diffSpan) diffSpan.innerText = appState.difficulty || 'Normal';
    if (compSpan) compSpan.innerText = 'Level ' + (appState.complexity || 3);

    renderDocket(); 
    renderFactLedger();
    renderTerminalSidePanel();
  }
  renderTranscriptFeed();
  updateActiveModelDisplay();
  window.RYCScene?.refresh();
}

function renderTerminalSidePanel() {
  if (!appState.hasActiveCase) return;
  
  const titleEl = document.getElementById('panel-case-title');
  const clientEl = document.getElementById('panel-client-name');
  const judgeEl = document.getElementById('panel-judge-name');
  const daEl = document.getElementById('panel-da-name');

  if (titleEl) titleEl.innerText = appState.profile.title || 'State v. Unknown';
  if (clientEl) clientEl.innerText = RYCStandard.nameLabel(appState,appState.profile.client) || 'TBD';
  if (judgeEl) judgeEl.innerText = RYCStandard.nameLabel(appState,appState.profile.judge) || 'TBD';
  if (daEl) daEl.innerText = RYCStandard.nameLabel(appState,appState.profile.da) || 'TBD';

  const evList = document.getElementById('panel-evidence-list');
  const evCount = document.getElementById('panel-evidence-count');
  if (evList && evCount) {
    evCount.innerText = (appState.docket || []).length;
    if (!appState.docket || appState.docket.length === 0) {
      evList.innerHTML = `<div class="text-[10px] text-brand-muted italic py-1">No discovery marked yet.</div>`;
    } else {
      evList.innerHTML = appState.docket.map(item => `
        <div class="p-1.5 rounded bg-brand-surface/70 border border-brand-border flex justify-between items-center text-[10px]">
          <span class="text-brand-gold font-bold truncate max-w-[140px]">${escapeGameText(item.id || item.tag)}: ${escapeGameText(item.name || item.title)}</span>
          <span class="text-[8px] px-1 rounded ${item.status === 'Admitted' ? 'text-emerald-400 bg-emerald-950' : item.status === 'SUPPRESSED' ? 'text-rose-400 line-through bg-rose-950/40' : 'text-amber-400 bg-amber-950/40'}">${escapeGameText(item.status || 'Marked')}</span>
        </div>
      `).join('');
    }
  }

  const factList = document.getElementById('panel-fact-list');
  if (factList) {
    const visibleFacts = (appState.facts || []).filter(fact => {
      const id = hashFact(fact);
      return !appState.hiddenFacts.includes(id) && !appState.trashedFacts.includes(id);
    });

    if (visibleFacts.length === 0) {
      factList.innerHTML = `<div class="text-[10px] text-brand-muted italic py-1">Awaiting preliminary statements.</div>`;
    } else {
      factList.innerHTML = visibleFacts.map(fact => {
        const id = hashFact(fact);
        return `
          <div class="py-1 border-b border-brand-border/40 last:border-0 flex justify-between items-start gap-1">
            <span class="leading-relaxed flex-grow">• ${escapeGameText(fact)}</span>
            <div class="flex gap-1 shrink-0 pt-0.5">
              <button onclick="toggleFactVisibility('${id}')" class="text-brand-muted hover:text-white px-1 text-[10px]" title="Hide from Terminal">Hide</button>
              <button onclick="trashFact('${id}')" class="text-brand-muted hover:text-rose-400 px-1 text-[10px]" title="Archive Fact">Archive</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function selectObjection(ruleStr) {
  const input = document.getElementById('court-user-input');
  input.value = `OBJECTION: ${ruleStr} - `;
  document.getElementById('objection-menu').classList.add('hidden');
  input.focus();
}

function toggleAssistantsDrawer() { RYCScene.selectRoom('partner'); }

function switchAssistantTab(tabId) { RYCScene.selectRoom(tabId); }

async function saveCaseNotes(value) {
  try{await commitCase(next=>{next.notes=value;return next;});return true;}catch(_){return false;}
}
function saveNotes() { return saveCaseNotes(document.getElementById('attorney-notes').value); }

function openWipeModal() { 
  document.getElementById('wipe-confirm-input').value = ''; 
  document.getElementById('wipe-modal').classList.remove('hidden');
  document.getElementById('wipe-confirm-input').focus(); 
}

function closeWipeModal() { 
  document.getElementById('wipe-modal').classList.add('hidden'); 
}

async function executeWipe() {
  if(engineLocked){alert('Wait for the current action to finish before purging the case.');return false;}
  if(document.getElementById('wipe-confirm-input').value!=='CONFIRM'){alert("Type exactly 'CONFIRM'");return false;}
  try{await commitCase(next=>RYCState.emptyState(next),{court:[],partner:[],diaz:[]},{},{clearTrialExtras:true});}
  catch(error){alert('The case could not be purged: '+error.message);return false;}
  closeWipeModal();window.location.href='index.html';return true;
}
async function completeCaseIntake() {
  if(engineLocked||caseConflict||RYCState.intakeStatus(appState)!=='incomplete')return false;
  const pending=pendingRequests.court;
  if(pending&&(pending.isInit||/^\/start(?:\s|$)/i.test(pending.prompt.trim()))){pending.isInit=true;return sendCourtAction('',true,true);}
  if(pending){
    // A failed player question is not initialization. Retain the visible transcript and start setup.
    const requests={...pendingRequests};delete requests.court;
    engineLocked=true;RYCScene.refresh();
    try{await commitCase(state=>state,{},requests);}catch(_){return false;}
    finally{engineLocked=false;RYCScene.refresh();}
  }
  const record=appState.activeCaseSeed;
  if(record&&!RYCState.seedError(record))return executeEngineInitializationHandshake(record);
  if(record)storageNotice('The saved intake is incomplete. Setup will use the valid roster, evidence and facts already in your case.');
  const prompt=`/start --mode=web --difficulty=${appState.difficulty} --complexity=${appState.complexity} --category="${appState.category}"\nInitialize this unfinished intake. Preserve the known case information below; fill in missing title and roster, mark exactly two starter exhibits, let the client open the conversation, and include a complete STATE_CHECKPOINT. Keep sealed truth hidden.\nKnown case: ${JSON.stringify({profile:appState.profile,docket:appState.docket,facts:appState.facts})}`;
  return sendCourtAction(prompt,true);
}

let editingExhibitId = null;
function openAddExhibitModal(index) {
  if(engineLocked)return;
  const item=Number.isInteger(index)?appState.docket[index]:null;
  if(item && !item.isManual)return;
  editingExhibitId=item?(item.id||item.tag):null;
  document.querySelector('#exhibit-modal h3').textContent=item?'Edit manual exhibit':'Log manual exhibit';
  for(const [id,value] of [['modal-tag',item?.id||item?.tag||''],['modal-title',item?.name||item?.title||''],['modal-details',item?.facts||item?.details||''],['modal-type',item?.type||'Documentary']])document.getElementById(id).value=value;
  document.getElementById('exhibit-modal').classList.remove('hidden');
  document.getElementById('modal-title').focus();
}
function closeAddExhibitModal() {
  document.activeElement?.blur();
  document.getElementById('exhibit-modal').classList.add('hidden');
  editingExhibitId=null;
}
async function saveNewExhibit() {
  if(engineLocked)return false;
  const previousId=editingExhibitId;
  const item={id:document.getElementById('modal-tag').value.trim(),name:document.getElementById('modal-title').value.trim()||'Untitled',type:document.getElementById('modal-type').value,facts:document.getElementById('modal-details').value.trim(),status:'Marked',isManual:true};
  item.details=item.facts;
  if(!item.facts){alert('Enter the exhibit details.');return false;}
  try {
    await commitCase(next=>{
      if(!item.id){let number=next.docket.length+1;while(next.docket.some(e=>(e.id||e.tag)===`Ex. ${number}`))number++;item.id=`Ex. ${number}`;}
      RYCState.exhibit(item);
      if(next.docket.some(e=>(e.id||e.tag)===item.id && (e.id||e.tag)!==previousId))throw new Error('Choose a unique exhibit identifier.');
      if(previousId){const at=next.docket.findIndex(e=>(e.id||e.tag)===previousId && e.isManual);if(at<0)throw new Error('Manual exhibit no longer exists.');item.status=next.docket[at].status;next.docket[at]=item;
        if(previousId!==item.id){next.exhibitNotes[item.id]=next.exhibitNotes[previousId]||'';delete next.exhibitNotes[previousId];}}
      else next.docket.push(item);
      return next;
    });
    closeAddExhibitModal();renderDocket();RYCScene.refresh();return true;
  }catch(error){alert(error.message);return false;}
}
async function setExhibitStatus(index, newStatus) {
  const id=appState.docket[index]?.id||appState.docket[index]?.tag;
  try{await commitCase(next=>{const item=next.docket.find(e=>(e.id||e.tag)===id);if(item)item.status=newStatus;return next;});renderDocket();}catch(_){}
}
async function deleteExhibit(index) {
  if(engineLocked)return;
  const item=appState.docket[index];if(!item?.isManual || !confirm('Delete this manual exhibit and its notes?'))return;
  const id=item.id||item.tag;
  try{await commitCase(next=>{next.docket=next.docket.filter(e=>!((e.id||e.tag)===id && e.isManual));delete next.exhibitNotes[id];return next;});renderDocket();}catch(_){}
}

function renderDocket() {
  const container = document.getElementById('docket-list');
  if (!container) return;
  const focused=container.contains(document.activeElement)&&document.activeElement.matches('textarea,input')?{id:document.activeElement.dataset.exid,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd,value:document.activeElement.value}:null; 
  container.innerHTML = '';
  if(focused)requestAnimationFrame(()=>{const target=[...container.querySelectorAll('textarea,input')].find(el=>el.dataset.exid===focused.id);if(target){target.value=focused.value;target.focus({preventScroll:true});target.setSelectionRange(focused.start,focused.end);}});
  
  const findings=(appState.investigations||[]).filter(r=>r.status==='completed');
  const findingCards=()=>{for(const r of findings)container.innerHTML+=`<article class="p-3 rounded border border-brand-border font-mono text-xs"><strong>Investigation result · ${escapeGameText(r.id)}</strong><p>${escapeGameText(r.summary)}</p><p>${escapeGameText((r.exhibitIds||[]).join(', '))}</p>${(r.facts||[]).map(f=>`<p>${escapeGameText(f)}</p>`).join('')}</article>`;};
  if (!appState.docket || appState.docket.length === 0) { 
    container.innerHTML = `<div class="col-span-full p-4 border border-brand-border border-dashed rounded text-brand-muted text-xs font-mono text-center">No evidence discovered yet.</div>`;
    findingCards();return; 
  }
  
  appState.docket.forEach((item, index) => {
    const isSuppressed = item.status === 'SUPPRESSED';
    const tag = escapeGameText(item.id || item.tag || '');
    const notes = escapeGameText(appState.exhibitNotes[item.id || item.tag || ''] || '');
    const itemType = escapeGameText(item.type || 'Documentary');
    
    const typeBadgeColor = 
      itemType === 'Physical' ? 'text-blue-400 bg-blue-950 border-blue-800' :
      itemType === 'Digital' ? 'text-cyan-400 bg-cyan-950 border-cyan-800' :
      itemType === 'Forensic' ? 'text-purple-400 bg-purple-950 border-purple-800' :
      'text-amber-400 bg-amber-950 border-amber-800';

    let controlsHtml = '';
    if (item.isManual) {
      controlsHtml = `
        <div class="flex justify-between items-center pt-2 border-t border-brand-border/50 mt-2">
          <div class="space-x-1 text-[10px]">
            <button title="Manually override to Admitted" onclick="setExhibitStatus(${index}, 'Admitted')" class="px-2 py-0.5 rounded bg-brand-dark border border-brand-border hover:text-emerald-400">Admit</button>
            <button title="Manually override to Marked" onclick="setExhibitStatus(${index}, 'Marked')" class="px-2 py-0.5 rounded bg-brand-dark border border-brand-border hover:text-amber-400">Mark</button>
            <button title="Manually override to Suppress" onclick="setExhibitStatus(${index}, 'SUPPRESSED')" class="px-2 py-0.5 rounded bg-brand-dark border border-brand-border hover:text-rose-400">Suppress</button>
          </div><button onclick="openAddExhibitModal(${index})" class="text-brand-gold text-[10px]">Edit</button><button onclick="deleteExhibit(${index})" class="text-brand-muted hover:text-rose-400 text-[10px]">Del</button>
        </div>
      `;
    }

    container.innerHTML += `
      <div class="p-3 rounded border flex flex-col ${isSuppressed ? 'bg-brand-surface/20 border-brand-border/40 opacity-50' : 'bg-brand-surface border-brand-border'} space-y-2 font-mono text-xs">
        <div class="flex justify-between items-start gap-2">
          <div class="flex flex-col">
            <span class="font-bold ${isSuppressed ? 'text-brand-muted line-through' : 'text-brand-gold'}">${escapeGameText(item.id || item.tag)}: ${escapeGameText(item.name || item.title)}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded border w-fit mt-1 ${typeBadgeColor}">${itemType}</span>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${item.status === 'Admitted' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : item.status === 'Marked' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}">${escapeGameText(item.status || 'Logged')}</span>
            ${item.isApi ? '<span class="text-[8px] text-brand-muted uppercase tracking-widest" title="Generated by Court Engine">Locked</span>' : '<span class="text-[8px] text-brand-gold uppercase tracking-widest" title="Added Manually">Manual</span>'}
          </div>
        </div>
        <p class="text-brand-muted text-[11px] font-sans flex-grow">${escapeGameText(item.facts || item.details || 'No forensic notes.')}</p>
        <div class="mt-2 pt-2 border-t border-brand-border/30">
          <textarea placeholder="Defense Annotations..." data-exid="${tag}" oninput="saveExhibitNote(this.dataset.exid, this.value)" class="w-full bg-brand-dark border border-brand-border rounded p-1.5 text-slate-300 text-[10px] font-mono outline-none resize-none focus:border-brand-gold" rows="2">${notes}</textarea>
        </div>
        ${controlsHtml}
      </div>`;
  });
  findingCards();
  renderTerminalSidePanel(); 
}

window.toggleFactVisibility = async function(factId) {
  try{await commitCase(next=>{next.hiddenFacts=next.hiddenFacts.includes(factId)?next.hiddenFacts.filter(f=>f!==factId):[...next.hiddenFacts,factId];return next;});renderUI();}catch(_){}
}

window.trashFact = function(factId) {
  if (!appState.hasSeenTrashWarning) {
    pendingTrashFactId = factId;
    document.getElementById('trash-warning-modal').classList.remove('hidden');
  } else {
    executeTrashFact(factId);
  }
}

window.closeTrashWarning = function() {
  pendingTrashFactId = null;
  document.getElementById('trash-warning-modal').classList.add('hidden');
}

window.confirmTrashWarning = async function() {
  const id=pendingTrashFactId;
  document.getElementById('trash-warning-modal').classList.add('hidden');pendingTrashFactId=null;
  if(id)return executeTrashFact(id,true);
}
window.executeTrashFact = async function(factId, acknowledged=false) {
  try{await commitCase(next=>{if(acknowledged)next.hasSeenTrashWarning=true;if(!next.trashedFacts.includes(factId))next.trashedFacts.push(factId);next.hiddenFacts=next.hiddenFacts.filter(f=>f!==factId);return next;});renderUI();}catch(_){}
}
window.restoreFact = async function(factId) {
  try{await commitCase(next=>{next.trashedFacts=next.trashedFacts.filter(f=>f!==factId);return next;});renderUI();}catch(_){}
}


function renderFactLedger() {
  const activeContainer = document.getElementById('fact-ledger');
  const archiveContainer = document.getElementById('fact-archive-ledger');
  if (!activeContainer || !archiveContainer) return; 
  
  activeContainer.innerHTML = '';
  archiveContainer.innerHTML = '';
  
  let activeCount = 0;
  let archiveCount = 0;

  if (appState.facts && appState.facts.length > 0) {
    appState.facts.forEach(fact => {
      const id = hashFact(fact);
      const isHidden = appState.hiddenFacts.includes(id);
      const isTrashed = appState.trashedFacts.includes(id);

      if (isTrashed) {
        archiveCount++;
        archiveContainer.innerHTML += `
          <div class="pb-2 border-b border-brand-border/40 last:border-0 flex justify-between items-start gap-2">
            <span class="pr-2 line-through text-slate-500">• ${escapeGameText(fact)}</span>
            <button onclick="restoreFact('${id}')" class="text-[10px] px-2 py-0.5 rounded border border-emerald-900/50 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900 transition shrink-0" title="Restore to active record">Restore</button>
          </div>`;
      } else {
        activeCount++;
        activeContainer.innerHTML += `
          <div class="pb-2 border-b border-brand-border/50 last:border-0 flex justify-between items-start gap-2">
            <span class="pr-2 ${isHidden ? 'opacity-40 line-through' : ''}">• ${escapeGameText(fact)}</span>
            <div class="flex gap-1.5 shrink-0 pt-0.5">
              <button onclick="toggleFactVisibility('${id}')" class="px-1.5 py-0.5 rounded border border-brand-border bg-brand-dark hover:border-brand-gold text-slate-300 hover:text-white transition text-xs" title="${isHidden ? 'Show in Terminal' : 'Hide from Terminal'}">
                ${isHidden ? 'Show' : 'Hide'}
              </button>
              <button onclick="trashFact('${id}')" class="px-1.5 py-0.5 rounded border border-brand-border bg-brand-dark hover:border-rose-700 text-slate-400 hover:text-rose-400 transition text-xs" title="Move to Archive">
                Archive
              </button>
            </div>
          </div>`;
      }
    });
  }

  if (activeCount === 0) activeContainer.innerHTML = `<span class="text-brand-muted italic">Awaiting witness statements and rulings...</span>`;
  if (archiveCount === 0) archiveContainer.innerHTML = `<span class="text-brand-muted/50 italic">Archive empty.</span>`;
  
  renderTerminalSidePanel(); 
}

function parseTranscriptFormat(text) {
  const raw=String(text).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
  try{return RYCDialogue.parse(raw).map(m=>'<p class="message-speaker">'+escapeGameText(RYCStandard.nameLabel(appState,m.name))+'</p><div class="message-text">'+escapeGameText(m.text).replace(/\n/g,'<br>')+'</div>').join('');}
  catch(_){return '<p>A saved reply has an unreadable dialogue format.</p>';}
}

function retryAction(encodedPrompt, isAssistant) {
  const prompt = decodeURIComponent(encodedPrompt);
  if (isAssistant) {
    sendAssistantAction(prompt, true);
  } else {
    sendCourtAction(prompt, false, true);
  }
}

function appendErrorAlert(rawError,lastPrompt,isAssistant=false,assistantTab=activeAssistantTab) {
  const ch=isAssistant?assistantTab:'court';
  if(window.RYCScene?.ready)return RYCScene.errorAlert(String(rawError),lastPrompt,ch);
  pendingRequests[ch]={prompt:lastPrompt,error:String(rawError)};
  storageNotice('Could not complete the action: '+String(rawError));
}

async function appendTranscriptMessage(sender, text, isUser=false) {
  await commitCase(next=>{next.transcript.push({sender,text,isUser});return next;});renderTranscriptFeed();
}

function renderTranscriptFeed() {
  if (window.RYCScene?.ready) return RYCScene.renderCourtFeed();
  const feed = document.getElementById('transcript-feed');
  if (!feed) return; 
  feed.innerHTML = '';
  if (!appState.transcript || appState.transcript.length === 0) { 
    feed.innerHTML = `<div class="p-3 text-center text-brand-muted text-xs font-mono">Courtroom feed pending initialization...</div>`; 
    return; 
  }
  appState.transcript.forEach(entry => {
    const item = document.createElement('div');
    item.className = "flex flex-col space-y-1 mb-4";
    const tagColor = entry.isUser ? "text-brand-gold" : "text-emerald-400";
    const displayHtml = entry.isUser ? escapeGameText(entry.text) : parseTranscriptFormat(escapeGameText(entry.text));
    item.innerHTML = `<span class="text-[10px] font-bold ${tagColor} uppercase tracking-wider font-mono">${escapeGameText(entry.sender)}</span>
                      <div class="text-slate-200 text-sm leading-relaxed ${entry.isUser ? 'pl-2 border-l border-brand-gold/50 text-brand-gold/90' : ''}">${displayHtml}</div>`;
    feed.appendChild(item);
  });
  feed.scrollTop = feed.scrollHeight;
}

function renderAssistantFeeds() {
  if (window.RYCScene?.ready) return RYCScene.renderAssistantFeeds();
  ['partner', 'diaz'].forEach(tab => {
    const feed = document.getElementById(`${tab}-feed`);
    if (!feed) return;
    const hist = tab === 'partner' ? partnerHistory : diazHistory;
    
    const headerText = tab === 'partner' 
      ? '<div class="text-brand-muted text-[10px] font-mono italic text-center mt-6 mb-4">Private legal strategy channel. Consultations cost 0 AP.</div>'
      : '<div class="text-brand-muted text-[10px] font-mono italic text-center mt-6 mb-4">Private investigation channel. Actions strictly capped at 2 AP.</div>';
      
    feed.innerHTML = headerText;
    
    hist.forEach(entry => {
      const isUser = entry.role === 'user';
      let rawText = entry.parts[0].text;
      rawText = rawText.replace(/\[(SENIOR PARTNER CONSULTATION\vert{}INVESTIGATOR CONSULTATION)\]:\s*/g, '');
      
      const senderName = isUser ? 'YOU' : (tab === 'partner' ? 'SENIOR PARTNER' : 'INV. DIAZ');
      const item = document.createElement('div');
      item.className = "flex flex-col space-y-1 mb-4";
      const tagColor = isUser ? "text-brand-muted" : "text-brand-gold";
      const displayHtml = isUser ? escapeGameText(rawText) : parseTranscriptFormat(escapeGameText(rawText));
      item.innerHTML = `<span class="text-[10px] font-bold ${tagColor} uppercase tracking-wider font-mono">${senderName}</span>
                        <div class="text-slate-200 text-sm leading-relaxed ${isUser ? 'pl-2 border-l border-brand-muted/50 text-brand-muted' : ''}">${displayHtml}</div>`;
      feed.appendChild(item);
    });
    feed.scrollTop = feed.scrollHeight;
  });
}

function appendAssistantMessage(tabId, sender, text, isUser = false, isSeed = false) {
  const hist = tabId === 'partner' ? partnerHistory : diazHistory;
  if (isSeed) {
    hist.push({ role: 'model', parts: [{ text }] });
    localStorage.setItem(`rest_your_case_${tabId}_history`, JSON.stringify(hist));
  } else {
    renderAssistantFeeds();
  }
}

function showLoadingScreen() {
  const overlay = document.getElementById('init-loading-overlay');
  const tipEl = document.getElementById('loading-tip-text');
  if (!overlay || !tipEl) return;
  
  clearInterval(loadingInterval);
  overlay.classList.remove('hidden');
  let tipIndex = 0;
  tipEl.innerText = loadingTips[tipIndex];
  tipEl.style.opacity = '1';
  
  loadingInterval = setInterval(() => {
    tipEl.style.opacity = '0';
    setTimeout(() => {
      tipIndex = (tipIndex + 1) % loadingTips.length;
      tipEl.innerText = loadingTips[tipIndex];
      tipEl.style.opacity = '1';
    }, 500);
  }, 3500);
}

function hideLoadingScreen() {
  const overlay = document.getElementById('init-loading-overlay');
  if (overlay) overlay.classList.add('hidden');
  clearInterval(loadingInterval);
}

function toggleTypingIndicator(feedId, show, label = "Processing") {
  const feed = document.getElementById(feedId);
  if (!feed) return;
  const existing = document.getElementById(feedId + '-typing');
  if (show && !existing) {
    const html = `
      <div id="${feedId}-typing" class="flex flex-col space-y-1 mb-4">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">${label}</span>
        <div class="text-slate-200 text-sm flex items-center gap-1 mt-1">
          <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typingBounce" style="animation-delay: -0.32s"></div>
          <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typingBounce" style="animation-delay: -0.16s"></div>
          <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typingBounce"></div>
        </div>
      </div>`;
    feed.insertAdjacentHTML('beforeend', html);
    feed.scrollTop = feed.scrollHeight;
  } else if (!show && existing) {
    existing.remove();
  }
}

function handleCourtActionSubmit(e) { 
  e.preventDefault();
  if (window.RYCScene) return RYCScene.submitCourt(); 
  const input = document.getElementById('court-user-input'); 
  const val = input.value.trim(); 
  if (!val) return; 
  input.value = ""; 
  document.getElementById('autocomplete-menu').classList.add('hidden'); 
  sendCourtAction(val, false); 
}

function handleAssistantSubmit(e) { 
  e.preventDefault();
  if (window.RYCScene) return RYCScene.submitAssistant(); 
  const input = document.getElementById('assistant-input'); 
  const val = input.value.trim(); 
  if (!val) return; 
  input.value = ""; 
  sendAssistantAction(val); 
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller=new AbortController();activeEngineController=controller;
  try{return await RYCRequest.fetchJSON(url,options,{timeoutMs,signal:controller.signal,onProgress:progress=>RYCScene.requestProgress?.(progress)});}
  finally{if(activeEngineController===controller)activeEngineController=null;}
}

async function requestReply(payload) {
  payload={...payload,userText:payload.message,contractVersion:2,operationId:payload.operationId||RYCStandard.id(),caseState:RYCStandard.publicCase(appState)};
  if(payload.targetPersona==='diaz')payload.investigationTruth=appState.activeCaseSeed?.scout?.unencryptedTruth||'';
  // Include the lock in the message as well as metadata, for older worker versions.
  const role=RYCState.clientOccupation(appState);
  const roleInstruction=role
    ? 'clientOccupation='+role+'. Preserve this fixed occupation in narrative and checkpoints.'
    : 'Client occupation is not yet classified. Preserve the existing story. Court only: resolve civilian, police, or expert from established client information and include clientOccupation in the next STATE_CHECKPOINT; use civilian only if no occupation was established. Consultations must not invent or classify the occupation.';
  const legacyContext=!role && payload.targetPersona==='court'
    ? '\nEstablished client information: '+JSON.stringify({client:appState.profile.client,summary:appState.activeCaseSeed?.scout?.crimeSummary ?? '',facts:appState.facts,transcript:appState.transcript}) : '';
  payload={...payload,language:RYCI18n.get(),engineMode:RYCModels.get(),message:payload.message+'\n'+RYCState.apContext(appState)+legacyContext+'\n[CASE METADATA: '+roleInstruction+' Players may address any known witness from either side, on or off stand. Respond as the explicitly addressed person; addressing a witness alone does not call them to the stand, switch the trial phase, or make an informal conversation sworn testimony. Police/expert clients remain defendants; do not infer witness roles from this field. Difficulty='+appState.difficulty+'; complexity='+appState.complexity+'; currentAP='+appState.ap+'; maxStrikes='+appState.maxStrikes+'; trialEnded='+(appState.trialEnded===true)+'.]'};
  const histories={court:trialHistory,[payload.targetPersona]:payload.history||[]};
  const prepared=RYCTokenContext.prepare(appState,histories,payload.targetPersona,payload.userText);
  payload.history=prepared.history;
  payload.contextBrief=prepared.brief;
  payload.tokenSystem=RYCTokenCore.version;
  if(payload.targetPersona==='court' && !/^\s*\/start\b/i.test(payload.userText)) {
    payload.engineReference=RYCTokenCore.privateReference(appState,'court');
    if(!payload.engineReference) {
      const intake=(histories.court||[]).find(e=>e.role==='user' && /^\s*\/start\b/i.test(e.parts?.[0]?.text||''));
      if(intake)payload.engineReference={legacyIntake:intake.parts.map(p=>p.text).join('\n')};
    }
  }
  if(role)payload.clientOccupation=role;
  const headers={'Content-Type':'application/json'};
  if(customGeminiKey)headers['X-Custom-Gemini-Key']=customGeminiKey;
  payload.message+='\n[DIALOGUE FORMAT: '+RYCDialogue.instruction+']';
  let received;
  try{received=await fetchWithTimeout(GAME_WORKER_URL,{method:'POST',headers,body:JSON.stringify(payload)},60000);}
  catch(error){await RYCTokens.record(null,payload.targetPersona);throw error;}
  const {response,data}=received;
  await RYCTokens.record(data?.usage,payload.targetPersona);
  ensureCaseCurrent();
  if(!response.ok) {
    const detail=typeof data?.details==='string'?data.details:typeof data?.error==='string'?data.error:data?.error?.message;
    throw RYCRequest.error('HTTP_'+response.status,detail||'Worker HTTP '+response.status);
  }
  if(!RYCState.object(data)||typeof data.reply!=='string'||!data.reply.trim())throw RYCRequest.error('INVALID_RESPONSE','The server returned an empty or invalid reply. No case update was applied.');
  RYCDialogue.parse(data.reply,{strict:true});
  if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw RYCRequest.error('INVALID_RESPONSE','Invalid model metadata. No case update was applied.');
  return data;
}

async function showRequestError(ch,error,request) {
  if(caseConflict||error.name==='CaseConflictError'){invalidateCase();return;}
  if(error.name==='ResponseValidationError')delete request.response;
  request.error=RYCRequest.format(error);
  // Keep the retry in memory even if storage is unavailable.
  try{await persist();}catch(_){if(caseConflict)return;}
  if(window.RYCScene?.ready)RYCScene.errorAlert(request.error,request.prompt,ch,request.isInit);
  else storageNotice('Could not complete the action: '+request.error);
}
async function sendCourtAction(userPrompt,isInit=false,isRetry=false) {
  if(engineLocked||caseConflict||!appState.hasActiveCase)return false;
  const request=isRetry&&pendingRequests.court?pendingRequests.court:{prompt:userPrompt,isInit,started:false,operationId:RYCStandard.id()};
  if(isRetry&&RYCState.intakeStatus(appState)==='incomplete'&&!request.isInit)return completeCaseIntake();
  if(!request.isInit&&RYCState.intakeStatus(appState)!=='ready'){storageNotice('Finish case setup before sending a trial action.');return false;}
  request.operationId ||= RYCStandard.id();
  pendingRequests.court=request;userPrompt=request.prompt;isInit=request.isInit;
  engineLocked=true;
  try {
    RYCScene.refresh();
    if(isInit)showLoadingScreen();else toggleTypingIndicator('transcript-feed',true,'Court is deliberating');
    if(!request.started) {
      const history=isInit?[]:trialHistory;
      request.started=true;
      try{await commitCase(state=>{if(!isInit)state.transcript.push({sender:'DEFENSE COUNSEL',text:userPrompt,isUser:true});return state;},{court:history});}catch(error){request.started=false;throw error;}
      renderTranscriptFeed();
    }
    request.error='';
    const baseHistory=userPrompt.trim().toLowerCase().startsWith('/undo')?trialHistory.slice(0,-2):trialHistory;
    const data=request.response||await requestReply({message:userPrompt,history:baseHistory,targetPersona:'court',operationId:request.operationId});
    if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw Object.assign(new Error('Invalid model metadata. No case update was applied.'),{name:'ResponseValidationError'});
    ensureCaseCurrent();
    const apply=state=>{
      const result=RYCState.next(state,data.reply,'court',{undo:/^\/undo(?:\s|$)/i.test(userPrompt.trim()),contractVersion:2,requestText:userPrompt});
      if(isInit){
        RYCState.validateInitialization(result.state,data.reply);
        result.state.intakeComplete=true;
      }
      if(data.activeModel)result.state.selectedModel=data.activeModel;
      result.state.transcript.push({sender:'THE BENCH / RECORD',text:result.text,isUser:false});return result.state;
    };
    // Validate before caching. Invalid initialization must fetch a fresh answer on retry.
    apply(RYCState.clone(appState));
    request.response=data;
    const requests={...pendingRequests};delete requests.court;
    await commitCase(apply,{court:[...baseHistory,{role:'user',parts:[{text:userPrompt}]},{role:'model',parts:[{text:data.reply}]}]},requests);
    if(document.getElementById('court-user-input').value)saveDraft();else{try{localStorage.removeItem('terminal_draft');}catch(_){}}
    await RYCTokens.completed('court',appState,request.operationId);
    renderUI();return true;
  } catch(error) {
    // A rendering failure after a successful commit must not replay the action.
    if(caseConflict||error.name==='CaseConflictError')invalidateCase();
    else if(pendingRequests.court)await showRequestError('court',error,request);
    else storageNotice('The action was saved, but the display could not refresh. Reload to continue.');
    return false;
  } finally {
    engineLocked=false;RYCScene.requestProgress?.(null);hideLoadingScreen();toggleTypingIndicator('transcript-feed',false);
    updateActiveModelDisplay();RYCScene.refresh();
  }
}
function buildContextCapsule() {
  return 'Use the supplied public case snapshot as the current record. Private consultations do not act as the judge or change trial phase. The clerk supplies original attributed exchanges; distinguish claims, findings, corrections and open questions.';
}

async function sendAssistantAction(userPrompt,isRetry=false) {
  if(engineLocked||caseConflict||!appState.hasActiveCase)return false;
  if(RYCState.intakeStatus(appState)!=='ready'){storageNotice('Finish case setup before requesting a consultation.');return false;}
  const ch=activeAssistantTab==='diaz'?'diaz':'partner';
  const request=isRetry&&pendingRequests[ch]?pendingRequests[ch]:{prompt:userPrompt,started:false,operationId:RYCStandard.id()};
  request.operationId ||= RYCStandard.id();
  pendingRequests[ch]=request;userPrompt=request.prompt;
  const prefix=ch==='diaz'?'[INVESTIGATOR CONSULTATION]: ':'[SENIOR PARTNER CONSULTATION]: ';
  engineLocked=true;
  try {
    RYCScene.refresh();
    let hist=ch==='diaz'?diazHistory:partnerHistory;
    if(!request.started) {
      request.started=true;
      try{await commitCase(state=>state,{[ch]:[...hist,{role:'user',parts:[{text:prefix+userPrompt}]}]});}catch(error){request.started=false;throw error;}
    }
    hist=ch==='diaz'?diazHistory:partnerHistory;
    renderAssistantFeeds();toggleTypingIndicator(ch+'-feed',true,ch==='diaz'?'Diaz investigating':'Partner reviewing');
    request.error='';
    const directive=ch==='diaz'?'\nReport any completed investigation with a STATE_CHECKPOINT containing the remaining ap and newly discovered docket/facts. Investigations spend at most 2 AP, cannot overspend, and new exhibits are Marked. Advice alone costs 0 AP. Do not change court phase, judge, strikes, or admit evidence. Follow the established case; never expose sealed truth.':'';
    const data=request.response||await requestReply({message:prefix+userPrompt,history:hist.slice(0,-1),targetPersona:ch,operationId:request.operationId,capsule:buildContextCapsule()+directive});
    if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw Object.assign(new Error('Invalid model metadata. No case update was applied.'),{name:'ResponseValidationError'});
    ensureCaseCurrent();
    const apply=state=>{
      if(ch==='diaz' && RYCStandard.checkpoint(data.reply)?.investigation?.id!==request.operationId)RYCStandard.error('Investigation ID does not match this request.');
      const next=ch==='diaz'?RYCState.next(state,data.reply,'diaz',{contractVersion:2,requestText:userPrompt}).state:state;
      if(ch!=='diaz')RYCState.parse(data.reply);
      if(data.activeModel)next.selectedModel=data.activeModel;
      next.clerkMemory||={};next.clerkMemory[ch]={indexedThrough:hist.length,updatedAt:Date.now(),method:'original-source-index'};return next;
    };
    apply(RYCState.clone(appState));request.response=data;
    const requests={...pendingRequests};delete requests[ch];
    await commitCase(apply,{[ch]:[...hist,{role:'model',parts:[{text:data.reply}]}]},requests);
    await RYCTokens.completed(ch,appState,request.operationId);
    renderUI();renderAssistantFeeds();return true;
  } catch(error) {
    if(caseConflict||error.name==='CaseConflictError')invalidateCase();
    else if(pendingRequests[ch])await showRequestError(ch,error,request);
    else storageNotice('The consultation was saved, but the display could not refresh. Reload to continue.');
    return false;
  } finally {
    engineLocked=false;RYCScene.requestProgress?.(null);toggleTypingIndicator(ch+'-feed',false);updateActiveModelDisplay();RYCScene.refresh();
  }
}
async function processCourtResponse(rawText) {
  await commitCase(state=>{const result=RYCState.next(state,rawText,'court');result.state.transcript.push({sender:'THE BENCH / RECORD',text:result.text,isUser:false});return result.state;});renderUI();
}

initApp();
RYCTokens.configure(()=>appState);
RYCScene.init();
window.addEventListener('storage',event=>{
  if(event.key!==RYCCaseStore.key&&event.key!==null)return;
  try{if(RYCCaseStore.read()!==savedCaseRaw)invalidateCase();}catch(_){storageNotice('Could not read the latest case. Reload before continuing.');}
});
if(autoInitialize)completeCaseIntake();
