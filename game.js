// game.js
let appState = {
  hasActiveCase: false, 
  profile: { title: '', client: '', judge: '', da: '', clientOccupation: 'civilian' },
  phase: 'Phase 1: Intake', 
  turn: 1, 
  ap: 4, 
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
  const statusBadge = document.getElementById('engine-status');
  if (statusBadge && !engineLocked) {
    if (appState.selectedModel) {
      let text = appState.selectedModel.replace('gemini-', '').replace('-', ' ');
      text = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      statusBadge.innerText = `Active (${text})`;
    } else {
      statusBadge.innerText = "Active";
    }
  }

  const modelSpan = document.getElementById('nb-model');
  if (modelSpan) {
    if (appState.selectedModel) {
      let clean = appState.selectedModel.replace('gemini-', '').replace('-flash', ' Flash').replace('-pro', ' Pro');
      modelSpan.innerText = clean;
    } else {
      modelSpan.innerText = "3.8 Flash";
    }
  }
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
  document.getElementById('key-modal').classList.remove('hidden');
}

function closeKeyModal() {
  document.getElementById('key-modal').classList.add('hidden');
}

function toggleKeyVisibility() {
  const input = document.getElementById('key-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function saveCustomKey() {
  const val = document.getElementById('key-input').value.trim();
  if (val) {
    localStorage.setItem('rest_your_case_custom_gemini_key', val);
    customGeminiKey = val;
  } else {
    localStorage.removeItem('rest_your_case_custom_gemini_key');
    customGeminiKey = null;
  }
  updateKeyIndicator();
  closeKeyModal();
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
    document.getElementById('term-ap').innerText = appState.ap;
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
  if (clientEl) clientEl.innerText = appState.profile.client || 'TBD';
  if (judgeEl) judgeEl.innerText = appState.profile.judge || 'TBD';
  if (daEl) daEl.innerText = appState.profile.da || 'TBD';

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
              <button onclick="toggleFactVisibility('${id}')" class="text-brand-muted hover:text-white px-1 text-[10px]" title="Hide from Terminal">👁</button>
              <button onclick="trashFact('${id}')" class="text-brand-muted hover:text-rose-400 px-1 text-[10px]" title="Archive Fact">🗑</button>
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

function openAddExhibitModal() { 
  document.getElementById('exhibit-modal').classList.remove('hidden'); 
}

function closeAddExhibitModal() { 
  document.getElementById('exhibit-modal').classList.add('hidden'); 
  document.getElementById('modal-tag').value = ''; 
  document.getElementById('modal-title').value = ''; 
  document.getElementById('modal-details').value = ''; 
}

async function saveNewExhibit() {
  const entered=document.getElementById('modal-tag').value.trim();
  const item={id:entered,name:document.getElementById('modal-title').value.trim()||'Untitled',type:document.getElementById('modal-type')?.value||'Documentary',facts:document.getElementById('modal-details').value.trim(),status:'Admitted',isManual:true};
  try {
    await commitCase(next=>{
      if(!entered){let number=next.docket.length+1;while(next.docket.some(e=>(e.id||e.tag)===`Ex. ${number}`))number++;item.id=`Ex. ${number}`;}
      RYCState.exhibit(item);
      if(next.docket.some(e=>(e.id||e.tag)===item.id))throw new Error('An exhibit with this identifier already exists. Choose a different identifier.');
      next.docket.push(item);return next;
    });
    renderDocket();closeAddExhibitModal();return true;
  } catch(error){alert(error.message);return false;}
}
async function setExhibitStatus(index, newStatus) {
  const id=appState.docket[index]?.id||appState.docket[index]?.tag;
  try{await commitCase(next=>{const item=next.docket.find(e=>(e.id||e.tag)===id);if(item)item.status=newStatus;return next;});renderDocket();}catch(_){}
}
async function deleteExhibit(index) {
  const id=appState.docket[index]?.id||appState.docket[index]?.tag;
  try{await commitCase(next=>{next.docket=next.docket.filter(e=>(e.id||e.tag)!==id);return next;});renderDocket();}catch(_){}
}

function renderDocket() {
  const container = document.getElementById('docket-list');
  if (!container || container.contains(document.activeElement)) return; 
  container.innerHTML = '';
  
  if (!appState.docket || appState.docket.length === 0) { 
    container.innerHTML = `<div class="col-span-full p-4 border border-brand-border border-dashed rounded text-brand-muted text-xs font-mono text-center">No evidence discovered yet.</div>`; 
    return; 
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
          </div><button onclick="deleteExhibit(${index})" class="text-brand-muted hover:text-rose-400 text-[10px]">Del</button>
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
          <textarea placeholder="Defense Annotations..." data-exid="${tag}" onchange="saveExhibitNote(this.dataset.exid, this.value)" class="w-full bg-brand-dark border border-brand-border rounded p-1.5 text-slate-300 text-[10px] font-mono outline-none resize-none focus:border-brand-gold" rows="2">${notes}</textarea>
        </div>
        ${controlsHtml}
      </div>`;
  });
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
                ${isHidden ? '🙈' : '👁'}
              </button>
              <button onclick="trashFact('${id}')" class="px-1.5 py-0.5 rounded border border-brand-border bg-brand-dark hover:border-rose-700 text-slate-400 hover:text-rose-400 transition text-xs" title="Move to Archive">
                🗑
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
  text = text.replace(/`?\[(?:STATE|ROSTER|DOCKET):.*?\]`?/gim, '');
  text = text.replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g, '<span class="text-[10px] text-brand-muted italic bg-brand-dark px-2 py-0.5 rounded border border-brand-border">[SEALED TRUTH HASH HIDDEN FROM RECORD]</span>');

  let parsed = text.replace(/^###\s+/gm, ''); 
  parsed = parsed.replace(/^(?:\*\*)?\[?([A-Za-z\s\-\.\']+(?:Client\vert{}Counsel\vert{}Judge\vert{}Witness\vert{}DA\vert{}Defendant\vert{}Prosecut[a-z]+\vert{}Defen[a-z]+\vert{}Sterling\vert{}Vance\vert{}Diaz\vert{}Bench\vert{}Court)?)\]?(?:\*\*)?\s*:\s*/gim, (match, name) => {
     let color = 'text-brand-gold'; 
     let lower = name.toLowerCase();
     if (lower.includes('judge') || lower.includes('bench') || lower.includes('court')) color = 'text-slate-300';
     else if (lower.includes('prosecut') || lower.includes('da ')) color = 'text-rose-400';
     else if (lower.includes('witness') || lower.includes('diaz')) color = 'text-emerald-400';
     name = name.replace(/\*/g, '').replace(/[\[\]]/g, '').trim();
     return `<br><span class="block mt-4 mb-1 text-sm font-bold tracking-wide uppercase ${color}">${name}</span>`;
  });
  parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                 .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
                 .replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-brand-gold pl-3 ml-1 my-2 italic text-brand-muted">$1</blockquote>')
                 .replace(/\n/g, '<br/>');
  return parsed.replace(/^(<br>)+/, ''); 
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();activeEngineController=controller;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try{data=await response.json();}
    catch(error){
      if(controller.signal.aborted)throw error;
      if(response.ok){const invalid=new Error('The server returned invalid JSON. No case update was applied.');invalid.name='ResponseValidationError';throw invalid;}
    }
    return {response,data};
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if(activeEngineController===controller)activeEngineController=null;
  }
}

async function requestReply(payload) {
  // Include the lock in the message as well as metadata, for older worker versions.
  const role=RYCState.clientOccupation(appState);
  const roleInstruction=role
    ? 'clientOccupation='+role+'. Preserve this fixed occupation in narrative and checkpoints.'
    : 'Client occupation is not yet classified. Preserve the existing story. Court only: resolve civilian, police, or expert from established client information and include clientOccupation in the next STATE_CHECKPOINT; use civilian only if no occupation was established. Consultations must not invent or classify the occupation.';
  const legacyContext=!role && payload.targetPersona==='court'
    ? '\nEstablished client information: '+JSON.stringify({client:appState.profile.client,summary:appState.activeCaseSeed?.scout?.crimeSummary ?? '',facts:appState.facts,transcript:appState.transcript}) : '';
  payload={...payload,message:payload.message+legacyContext+'\n[CASE METADATA: '+roleInstruction+' Police/expert clients remain defendants; do not infer witness roles from this field. Difficulty='+appState.difficulty+'; complexity='+appState.complexity+'; currentAP='+appState.ap+'; maxStrikes='+appState.maxStrikes+'.]'};
  if(role)payload.clientOccupation=role;
  const headers={'Content-Type':'application/json'};
  if(customGeminiKey)headers['X-Custom-Gemini-Key']=customGeminiKey;
  for(let attempt=0;attempt<3;attempt++) {
    ensureCaseCurrent();
    let response,data;
    try {({response,data}=await fetchWithTimeout(GAME_WORKER_URL,{method:'POST',headers,body:JSON.stringify(payload)},45000));}
    catch(error){ensureCaseCurrent();if(error.name==='ResponseValidationError'||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,1000));continue;}
    ensureCaseCurrent();
    if(!response.ok) {
      const detail=typeof data?.details==='string'?data.details:typeof data?.error==='string'?data.error:data?.error?.message;
      const error=new Error(detail||`Worker HTTP ${response.status}`);
      if(response.status>=500 && attempt<2){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
      throw error;
    }
    if(!RYCState.object(data)||typeof data.reply!=='string'||!data.reply.trim())throw new Error('The server returned an empty or invalid reply. No case update was applied.');
    if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw Object.assign(new Error('Invalid model metadata. No case update was applied.'),{name:'ResponseValidationError'});
    return data;
  }
}
async function showRequestError(ch,error,request) {
  if(caseConflict||error.name==='CaseConflictError'){invalidateCase();return;}
  if(error.name==='ResponseValidationError')delete request.response;
  request.error=String(error.message||error);
  // Keep the retry in memory even if storage is unavailable.
  try{await persist();}catch(_){if(caseConflict)return;}
  if(window.RYCScene?.ready)RYCScene.errorAlert(request.error,request.prompt,ch,request.isInit);
  else storageNotice('Could not complete the action: '+request.error);
}
async function sendCourtAction(userPrompt,isInit=false,isRetry=false) {
  if(engineLocked||caseConflict||!appState.hasActiveCase)return false;
  const request=isRetry&&pendingRequests.court?pendingRequests.court:{prompt:userPrompt,isInit,started:false};
  if(isRetry&&RYCState.intakeStatus(appState)==='incomplete'&&!request.isInit)return completeCaseIntake();
  if(!request.isInit&&RYCState.intakeStatus(appState)!=='ready'){storageNotice('Finish case setup before sending a trial action.');return false;}
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
    const data=request.response||await requestReply({message:userPrompt,history:baseHistory,targetPersona:'court'});
    if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw Object.assign(new Error('Invalid model metadata. No case update was applied.'),{name:'ResponseValidationError'});
    ensureCaseCurrent();
    const apply=state=>{
      const result=RYCState.next(state,data.reply,'court');
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
    renderUI();return true;
  } catch(error) {
    // A rendering failure after a successful commit must not replay the action.
    if(caseConflict||error.name==='CaseConflictError')invalidateCase();
    else if(pendingRequests.court)await showRequestError('court',error,request);
    else storageNotice('The action was saved, but the display could not refresh. Reload to continue.');
    return false;
  } finally {
    engineLocked=false;hideLoadingScreen();toggleTypingIndicator('transcript-feed',false);
    updateActiveModelDisplay();RYCScene.refresh();
  }
}
function buildContextCapsule() {
  if(!appState.hasActiveCase)return 'No active case.';
  return `Case: ${appState.profile.title} | Client: ${appState.profile.client} | Client occupation: ${RYCState.clientOccupation(appState) ?? "Unclassified; preserve established story"} | Judge: ${appState.profile.judge} | DA: ${appState.profile.da} | Phase: ${appState.phase} | AP: ${appState.ap} | Strikes: ${appState.strikes}\nMarked Docket: ${JSON.stringify(appState.docket)}\nEstablished Court Facts: ${JSON.stringify(appState.facts)}`;
}
async function sendAssistantAction(userPrompt,isRetry=false) {
  if(engineLocked||caseConflict||!appState.hasActiveCase)return false;
  if(RYCState.intakeStatus(appState)!=='ready'){storageNotice('Finish case setup before requesting a consultation.');return false;}
  const ch=activeAssistantTab==='diaz'?'diaz':'partner';
  const request=isRetry&&pendingRequests[ch]?pendingRequests[ch]:{prompt:userPrompt,started:false};
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
    const data=request.response||await requestReply({message:prefix+userPrompt,history:hist.slice(0,-1),targetPersona:ch,capsule:buildContextCapsule()+directive});
    if(data.activeModel!==undefined&&typeof data.activeModel!=='string')throw Object.assign(new Error('Invalid model metadata. No case update was applied.'),{name:'ResponseValidationError'});
    ensureCaseCurrent();
    const apply=state=>{
      const next=ch==='diaz'?RYCState.next(state,data.reply,'diaz').state:state;
      if(ch!=='diaz')RYCState.parse(data.reply);
      if(data.activeModel)next.selectedModel=data.activeModel;return next;
    };
    apply(RYCState.clone(appState));request.response=data;
    const requests={...pendingRequests};delete requests[ch];
    await commitCase(apply,{[ch]:[...hist,{role:'model',parts:[{text:data.reply}]}]},requests);
    renderUI();renderAssistantFeeds();return true;
  } catch(error) {
    if(caseConflict||error.name==='CaseConflictError')invalidateCase();
    else if(pendingRequests[ch])await showRequestError(ch,error,request);
    else storageNotice('The consultation was saved, but the display could not refresh. Reload to continue.');
    return false;
  } finally {
    engineLocked=false;toggleTypingIndicator(ch+'-feed',false);updateActiveModelDisplay();RYCScene.refresh();
  }
}
async function processCourtResponse(rawText) {
  await commitCase(state=>{const result=RYCState.next(state,rawText,'court');result.state.transcript.push({sender:'THE BENCH / RECORD',text:result.text,isUser:false});return result.state;});renderUI();
}

initApp();
RYCScene.init();
window.addEventListener('storage',event=>{
  if(event.key!==RYCCaseStore.key&&event.key!==null)return;
  try{if(RYCCaseStore.read()!==savedCaseRaw)invalidateCase();}catch(_){storageNotice('Could not read the latest case. Reload before continuing.');}
});
if(autoInitialize)completeCaseIntake();
