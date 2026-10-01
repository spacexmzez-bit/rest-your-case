// game.js
let appState = {
  hasActiveCase: false, profile: { title: '', client: '', judge: '', da: '' },
  phase: 'Phase 1: Intake', turn: 1, ap: 4, strikes: 0, maxStrikes: 3, notes: '',
  transcript: [], docket: [], facts: [], difficulty: 'Normal', complexity: 3, 
  selectedModel: 'gemini-3.8-flash',
  trashedFacts: [], hiddenFacts: [], exhibitNotes: {}, hasSeenTrashWarning: false
};

let trialHistory = [];
let partnerHistory = [];
let diazHistory = [];
let activeAssistantTab = 'partner';
let engineLocked = false;
let pendingTrashFactId = null;
let customGeminiKey = null; // BYOK State
const WORKER_URL = "https://rest-your-case.spacexmzez.workers.dev/";

// BATCH 5: #16 Loading Tips Array
let loadingInterval;
const loadingTips = [
  "TIP: Premeditation turns 2nd Degree Murder into 1st Degree.",
  "TIP: A hostile witness cannot be lead on cross-examination... wait, yes they can.",
  "TIP: Subpoenas cost 1 AP. Make sure you actually need the records.",
  "TIP: Hearsay has exceptions. Excited utterances are often admissible.",
  "TIP: Don't let the DA badger your client. Object aggressively."
];

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
  const saved = localStorage.getItem('rest_your_case_state');
  if (saved) { 
    try { 
      const parsed = JSON.parse(saved); 
      appState = { ...appState, ...parsed }; 
      if (!appState.trashedFacts) appState.trashedFacts = [];
      if (!appState.hiddenFacts) appState.hiddenFacts = [];
      if (!appState.exhibitNotes) appState.exhibitNotes = {};
    } catch (e) {} 
  }
  
  const savedHistory = localStorage.getItem('rest_your_case_history');
  if (savedHistory) { try { trialHistory = JSON.parse(savedHistory); } catch (e) {} }

  const savedPartnerHistory = localStorage.getItem('rest_your_case_partner_history');
  if (savedPartnerHistory) { try { partnerHistory = JSON.parse(savedPartnerHistory); } catch (e) {} }

  const savedDiazHistory = localStorage.getItem('rest_your_case_diaz_history');
  if (savedDiazHistory) { try { diazHistory = JSON.parse(savedDiazHistory); } catch (e) {} }

  const savedDraft = localStorage.getItem('terminal_draft');
  if (savedDraft) document.getElementById('court-user-input').value = savedDraft;

  // Init BYOK
  customGeminiKey = localStorage.getItem('rest_your_case_custom_gemini_key') || null;
  updateKeyIndicator();

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

  // Handle cross-page intake trigger from index.html
  const triggerStart = sessionStorage.getItem('trigger_intake_start');
  if (triggerStart) {
    sessionStorage.removeItem('trigger_intake_start');
    try {
      const { diff, comp, cat } = JSON.parse(triggerStart);
      const initPrompt = `/start --mode=web --difficulty=${diff} --complexity=${comp} --category="${cat}"\n\nFAST-START MANDATE:\n1. Roll Roster (Judge, DA, Client).\n2. Generate Case Title and a 1-sentence crime summary.\n3. Mark exactly TWO starting exhibits in the docket.\n4. Output 2 lines of dialogue from the Client in holding.\n5. Enclose all state in the checkpoint block and keep the total output under 200 words.`;
      sendCourtAction(initPrompt, true);
    } catch (e) {}
  }
}

function persist() { 
  localStorage.setItem('rest_your_case_state', JSON.stringify(appState)); 
}

function saveDraft() {
  localStorage.setItem('terminal_draft', document.getElementById('court-user-input').value);
}

// BATCH 5: #8 Command Autocomplete Logic
function handleInputDraft() {
  saveDraft();
  const input = document.getElementById('court-user-input');
  const val = input.value.trim().toLowerCase();
  const menu = document.getElementById('autocomplete-menu');
  
  if (val.startsWith('/inspect')) {
    const exhibits = (appState.docket || []).map(e => e.id || e.tag).filter(Boolean);
    if (exhibits.length > 0) {
      menu.innerHTML = exhibits.map(ex => `
        <button type="button" onmousedown="fillAutocomplete('/inspect ${ex}')" class="block w-full text-left px-3 py-2 bg-brand-dark hover:bg-brand-surface text-slate-200 hover:text-brand-gold transition flex items-center justify-between">
          <span>${ex}</span>
          <span class="text-[10px] text-brand-muted uppercase">Exhibit</span>
        </button>
      `).join('');
      menu.classList.remove('hidden');
    } else {
      menu.innerHTML = `<div class="px-3 py-2 text-[10px] text-brand-muted italic">No marked exhibits in docket yet.</div>`;
      menu.classList.remove('hidden');
    }
  } else if (val.startsWith('/subpoena')) {
    const targets = [
      { name: "Cell Tower Dumps", desc: "Location & call logs" },
      { name: "Bank Statements", desc: "Financial ledger" },
      { name: "Surveillance Footage", desc: "CCTV records" },
      { name: "Medical / Coroner Records", desc: "Toxicology & injuries" },
      { name: "IP & Server Access Logs", desc: "Digital footprint" }
    ];
    menu.innerHTML = targets.map(t => `
      <button type="button" onmousedown="fillAutocomplete('/subpoena ${t.name}')" class="block w-full text-left px-3 py-2 bg-brand-dark hover:bg-brand-surface text-slate-200 hover:text-brand-gold transition flex items-center justify-between">
        <span>${t.name}</span>
        <span class="text-[9px] text-brand-muted">${t.desc}</span>
      </button>
    `).join('');
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

window.saveExhibitNote = function(exhibitId, value) {
  if (!exhibitId) return;
  appState.exhibitNotes[exhibitId] = value;
  persist();
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
    document.getElementById('attorney-notes').value = appState.notes || '';
    
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
          <span class="text-brand-gold font-bold truncate max-w-[150px]">${item.id || item.tag}: ${item.name || item.title}</span>
          <span class="text-[9px] px-1 rounded ${item.status === 'Admitted' ? 'text-emerald-400 bg-emerald-950' : item.status === 'SUPPRESSED' ? 'text-rose-400 line-through' : 'text-amber-400'}">${item.status || 'Marked'}</span>
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
            <span class="leading-relaxed flex-grow">• ${fact}</span>
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

function toggleAssistantsDrawer() { 
  document.getElementById('assistants-drawer').classList.toggle('translate-x-full'); 
}

function switchAssistantTab(tabId) {
  activeAssistantTab = tabId;
  document.getElementById('partner-feed').classList.toggle('hidden', tabId !== 'partner');
  document.getElementById('diaz-feed').classList.toggle('hidden', tabId !== 'diaz');
  
  const pBtn = document.getElementById('tab-partner');
  const dBtn = document.getElementById('tab-diaz');
  
  if (tabId === 'partner') {
    pBtn.className = "px-3 py-1 rounded bg-brand-surface text-brand-gold font-bold border border-brand-gold/30";
    dBtn.className = "px-3 py-1 rounded text-brand-muted hover:text-slate-200 border border-transparent";
    document.getElementById('assistant-submit-btn').innerText = "Consult Partner";
    document.getElementById('assistant-input').placeholder = "Ask for tactical advice...";
  } else {
    dBtn.className = "px-3 py-1 rounded bg-brand-surface text-brand-gold font-bold border border-brand-gold/30";
    pBtn.className = "px-3 py-1 rounded text-brand-muted hover:text-slate-200 border border-transparent";
    document.getElementById('assistant-submit-btn').innerText = "Consult Diaz";
    document.getElementById('assistant-input').placeholder = "Ask for records or alibi check...";
  }
  
  const feed = document.getElementById(tabId + '-feed');
  if (feed) feed.scrollTop = feed.scrollHeight;
}

function saveNotes() { 
  appState.notes = document.getElementById('attorney-notes').value; 
  persist(); 
}

function openWipeModal() { 
  document.getElementById('wipe-confirm-input').value = ''; 
  document.getElementById('wipe-modal').classList.remove('hidden'); 
}

function closeWipeModal() { 
  document.getElementById('wipe-modal').classList.add('hidden'); 
}

function executeWipe() {
  if (document.getElementById('wipe-confirm-input').value === 'CONFIRM') {
    const warningState = appState.hasSeenTrashWarning;
    appState = { 
      hasActiveCase: false, profile: { title: '', client: '', judge: '', da: '' }, 
      phase: 'Phase 1: Intake', turn: 1, ap: 4, strikes: 0, maxStrikes: 3, notes: '', 
      transcript: [], docket: [], facts: [], difficulty: 'Normal', complexity: 3, 
      selectedModel: 'gemini-3.8-flash', trashedFacts: [], hiddenFacts: [], 
      exhibitNotes: {}, hasSeenTrashWarning: warningState 
    };
    trialHistory = []; partnerHistory = []; diazHistory = [];
    localStorage.removeItem('rest_your_case_history');
    localStorage.removeItem('rest_your_case_partner_history');
    localStorage.removeItem('rest_your_case_diaz_history');
    persist(); 
    closeWipeModal(); 
    window.location.href = 'index.html';
  } else { 
    alert("Type exactly 'CONFIRM'"); 
  }
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

function saveNewExhibit() {
  appState.docket.push({ 
    id: document.getElementById('modal-tag').value.trim() || `Ex. ${appState.docket.length + 1}`, 
    name: document.getElementById('modal-title').value.trim() || 'Untitled', 
    facts: document.getElementById('modal-details').value.trim(), 
    status: 'Admitted',
    isManual: true 
  });
  renderDocket(); 
  persist(); 
  closeAddExhibitModal();
}

function setExhibitStatus(index, newStatus) { 
  appState.docket[index].status = newStatus; 
  renderDocket(); 
  persist(); 
}

function deleteExhibit(index) { 
  appState.docket.splice(index, 1); 
  renderDocket(); 
  persist(); 
}

function renderDocket() {
  const container = document.getElementById('docket-list');
  if (!container) return; 
  container.innerHTML = '';
  
  if (!appState.docket || appState.docket.length === 0) { 
    container.innerHTML = `<div class="col-span-full p-4 border border-brand-border border-dashed rounded text-brand-muted text-xs font-mono text-center">No evidence discovered yet.</div>`; 
    return; 
  }
  
  appState.docket.forEach((item, index) => {
    const isSuppressed = item.status === 'SUPPRESSED';
    const tag = item.id || item.tag || '';
    const notes = appState.exhibitNotes[tag] || '';
    
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
          <span class="font-bold ${isSuppressed ? 'text-brand-muted line-through' : 'text-brand-gold'}">${item.id || item.tag}: ${item.name || item.title}</span>
          <div class="flex flex-col items-end gap-1">
            <span class="text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${item.status === 'Admitted' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : item.status === 'Marked' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}">${item.status || 'Logged'}</span>
            ${item.isApi ? '<span class="text-[8px] text-brand-muted uppercase tracking-widest" title="Generated by Court Engine">Locked</span>' : '<span class="text-[8px] text-brand-gold uppercase tracking-widest" title="Added Manually">Manual</span>'}
          </div>
        </div>
        <p class="text-brand-muted text-[11px] font-sans flex-grow">${item.facts || item.details || 'No forensic notes.'}</p>
        <div class="mt-2 pt-2 border-t border-brand-border/30">
          <textarea placeholder="Defense Annotations..." data-exid="${tag}" onchange="saveExhibitNote(this.dataset.exid, this.value)" class="w-full bg-brand-dark border border-brand-border rounded p-1.5 text-slate-300 text-[10px] font-mono outline-none resize-none focus:border-brand-gold" rows="2">${notes}</textarea>
        </div>
        ${controlsHtml}
      </div>`;
  });
  renderTerminalSidePanel(); 
}

window.toggleFactVisibility = function(factId) {
  if (appState.hiddenFacts.includes(factId)) appState.hiddenFacts = appState.hiddenFacts.filter(f => f !== factId);
  else appState.hiddenFacts.push(factId);
  persist(); 
  renderUI();
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

window.confirmTrashWarning = function() {
  appState.hasSeenTrashWarning = true;
  document.getElementById('trash-warning-modal').classList.add('hidden');
  if (pendingTrashFactId) executeTrashFact(pendingTrashFactId);
  pendingTrashFactId = null;
}

window.executeTrashFact = function(factId) {
  if (!appState.trashedFacts.includes(factId)) appState.trashedFacts.push(factId);
  appState.hiddenFacts = appState.hiddenFacts.filter(f => f !== factId);
  persist(); 
  renderUI();
}

window.restoreFact = function(factId) {
  appState.trashedFacts = appState.trashedFacts.filter(f => f !== factId);
  persist(); 
  renderUI();
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
            <span class="pr-2 line-through text-slate-500">• ${fact}</span>
            <button onclick="restoreFact('${id}')" class="text-[10px] px-2 py-0.5 rounded border border-emerald-900/50 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900 transition shrink-0" title="Restore to active record">Restore</button>
          </div>`;
      } else {
        activeCount++;
        activeContainer.innerHTML += `
          <div class="pb-2 border-b border-brand-border/50 last:border-0 flex justify-between items-start gap-2">
            <span class="pr-2 ${isHidden ? 'opacity-40 line-through' : ''}">• ${fact}</span>
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
  text = text.replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g, '<span class="text-[10px] text-brand-muted italic bg-brand-dark px-2 py-0.5 rounded border border-brand-border">[ENCRYPTED TRUTH HASH HIDDEN FROM UI]</span>');

  let parsed = text.replace(/^###\s+/gm, ''); 
  parsed = parsed.replace(/^(?:\*\*)?\[?([A-Za-z\s\-\.\']+(?:Client\vert{}Counsel\vert{}Judge\vert{}Witness\vert{}DA\vert{}Defendant\vert{}Prosecut[a-z]+\vert{}Defen[a-z]+\vert{}Sterling\vert{}Vance\vert{}Diaz\vert{}Bench\vert{}Court)?)\]?(?:\*\*)?\s*:\s*/gim, (match, name) => {
     let color = 'text-brand-gold'; 
     let lower = name.toLowerCase();
     if (lower.includes('judge') || lower.includes('bench') || lower.includes('court') || lower.includes('sterling')) color = 'text-slate-300';
     else if (lower.includes('prosecut') || lower.includes('da ') || lower.includes('vance')) color = 'text-rose-400';
     else if (lower.includes('witness') || lower.includes('diaz') || lower.includes('guard')) color = 'text-emerald-400';
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

function appendErrorAlert(rawError, lastPrompt, isAssistant = false) {
  const feedId = isAssistant ? `${activeAssistantTab}-feed` : 'transcript-feed';
  const feed = document.getElementById(feedId);
  let humanError = "The server link dropped unexpectedly. Check worker availability or resubmit.";
  if (rawError.includes("503") || rawError.includes("high demand") || rawError.includes("UNAVAILABLE")) {
    humanError = "All Gemini endpoints are experiencing peak traffic. Please wait a few seconds and hit Retry.";
  } else if (rawError.includes("MAX_TOKENS") || rawError.includes("token limit")) {
    humanError = "The maximum token limit per request was reached. Rephrase your inquiry or run /recap to condense the record context.";
  } else if (rawError.includes("429") || rawError.includes("rate limit")) {
    humanError = "API request threshold exceeded. Wait 20–30 seconds before filing your next action.";
  } else if (rawError.includes("timed out")) {
    humanError = "The AI model is taking too long to respond. The request has been aborted to prevent freezing.";
  }
  
  const errorId = 'err-' + Date.now();
  const alertHtml = `
    <div class="bg-rose-950/30 border border-rose-900 rounded p-3 mb-4 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-rose-400 font-bold text-xs uppercase tracking-wider">Transmission Interrupted</span>
          <button onclick="document.getElementById('${errorId}').classList.toggle('hidden')" class="w-4 h-4 rounded-full bg-rose-900 text-rose-300 text-[10px] font-bold flex items-center justify-center hover:bg-rose-700 transition">!</button>
        </div>
        <button onclick="retryAction('${encodeURIComponent(lastPrompt)}', ${isAssistant})" class="px-2 py-1 bg-rose-900 hover:bg-rose-700 text-white rounded text-[10px] font-mono font-bold transition shadow">Retry</button>
      </div>
      <p class="text-rose-200 text-xs font-sans">${humanError}</p>
      <div id="${errorId}" class="hidden mt-2 p-2 bg-brand-dark border border-rose-900/50 rounded text-[10px] font-mono text-rose-400 break-words"><strong>Raw Trace:</strong> ${rawError}</div>
    </div>`;
  feed.insertAdjacentHTML('beforeend', alertHtml);
  feed.scrollTop = feed.scrollHeight;
}

function appendTranscriptMessage(sender, text, isUser = false) {
  if (!appState.transcript) appState.transcript = [];
  appState.transcript.push({ sender, text, isUser });
  renderTranscriptFeed(); 
  persist();
}

function renderTranscriptFeed() {
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
    const displayHtml = entry.isUser ? entry.text : parseTranscriptFormat(entry.text);
    item.innerHTML = `<span class="text-[10px] font-bold ${tagColor} uppercase tracking-wider font-mono">${entry.sender}</span>
                      <div class="text-slate-200 text-sm leading-relaxed ${entry.isUser ? 'pl-2 border-l border-brand-gold/50 text-brand-gold/90' : ''}">${displayHtml}</div>`;
    feed.appendChild(item);
  });
  feed.scrollTop = feed.scrollHeight;
}

function renderAssistantFeeds() {
  ['partner', 'diaz'].forEach(tab => {
    const feed = document.getElementById(`${tab}-feed`);
    if (!feed) return;
    const hist = tab === 'partner' ? partnerHistory : diazHistory;
    
    const headerText = tab === 'partner' 
      ? '<div class="text-brand-muted text-[10px] font-mono italic text-center mt-6 mb-4">Private legal strategy channel. Consultations cost 0 AP.</div>'
      : '<div class="text-brand-muted text-[10px] font-mono italic text-center mt-6 mb-4">Private investigation channel. Discuss logistics or records.</div>';
      
    feed.innerHTML = headerText;
    
    hist.forEach(entry => {
      const isUser = entry.role === 'user';
      let rawText = entry.parts[0].text;
      rawText = rawText.replace(/\[(SENIOR PARTNER CONSULTATION\vert{}INVESTIGATOR CONSULTATION)\]:\s*/g, '');
      
      const senderName = isUser ? 'YOU' : (tab === 'partner' ? 'SENIOR PARTNER' : 'INV. DIAZ');
      const item = document.createElement('div');
      item.className = "flex flex-col space-y-1 mb-4";
      const tagColor = isUser ? "text-brand-muted" : "text-brand-gold";
      const displayHtml = isUser ? rawText : parseTranscriptFormat(rawText);
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
  const input = document.getElementById('court-user-input'); 
  const val = input.value.trim(); 
  if (!val) return; 
  input.value = ""; 
  document.getElementById('autocomplete-menu').classList.add('hidden'); 
  sendCourtAction(val, false); 
}

function handleAssistantSubmit(e) { 
  e.preventDefault(); 
  const input = document.getElementById('assistant-input'); 
  const val = input.value.trim(); 
  if (!val) return; 
  input.value = ""; 
  sendAssistantAction(val); 
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw err;
  }
}

async function sendCourtAction(userPrompt, isInit = false, isRetry = false) {
  if (engineLocked) return;
  engineLocked = true;

  const statusBadge = document.getElementById('engine-status');
  const submitBtn = document.getElementById('court-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  if (!isInit && !isRetry) {
    appendTranscriptMessage("DEFENSE COUNSEL", userPrompt, true);
    localStorage.removeItem('terminal_draft');
  } else if (isInit) {
    trialHistory = [];
    localStorage.removeItem('rest_your_case_history');
  }

  if (userPrompt.trim().toLowerCase().startsWith('/undo') && trialHistory.length >= 2) {
    trialHistory.splice(-2, 2);
  }

  if (isInit) showLoadingScreen();
  else toggleTypingIndicator('transcript-feed', true, 'Court is Deliberating');

  const MAX_RETRIES = 2;
  let attempt = 0;
  let success = false;

  // BATCH 5 BYOK: Attach Custom Headers if saved
  const reqHeaders = { "Content-Type": "application/json" };
  if (customGeminiKey) {
    reqHeaders["X-Custom-Gemini-Key"] = customGeminiKey;
  }

  try {
    while (attempt <= MAX_RETRIES && !success) {
      attempt++;
      if (statusBadge) statusBadge.innerText = attempt === 1 ? "Processing..." : `Retrying (${attempt}/${MAX_RETRIES + 1})...`;

      try {
        const response = await fetchWithTimeout(WORKER_URL, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({ 
            message: userPrompt, 
            history: trialHistory, 
            targetPersona: 'court'
          })
        }, 45000);

        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }

        if (response.status === 429 && data?.error === "QUOTA_EXHAUSTED") {
          if (data.activeModel) {
            appState.selectedModel = data.activeModel;
          }
          appendTranscriptMessage("THE BENCH / RECORD", data.reply, false);
          success = true;
          break;
        }

        if (!response.ok) {
          throw new Error(`Worker HTTP ${response.status}: ${data ? JSON.stringify(data) : 'Unknown error'}`);
        }

        if (data && data.activeModel) {
          appState.selectedModel = data.activeModel;
        }
        
        trialHistory.push({ role: "user", parts: [{ text: userPrompt }] });
        trialHistory.push({ role: "model", parts: [{ text: data.reply }] });
        localStorage.setItem('rest_your_case_history', JSON.stringify(trialHistory));
        processCourtResponse(data.reply);
        success = true;

      } catch (err) {
        console.warn(`Courtroom attempt ${attempt} failed: ${err.message}`);
        if (attempt <= MAX_RETRIES) {
          await new Promise(res => setTimeout(res, 1000));
        } else {
          appendErrorAlert(err.message, userPrompt, false);
        }
      }
    }
  } finally {
    engineLocked = false;
    if (isInit) hideLoadingScreen();
    else toggleTypingIndicator('transcript-feed', false);
    updateActiveModelDisplay();
    if (submitBtn) submitBtn.disabled = false;
  }
}

function buildContextCapsule() {
  if (!appState.hasActiveCase) return "No active case.";
  const docketStr = (appState.docket || []).map(d => `${d.id}(${d.status})`).join(', ') || 'None';
  const factStr = (appState.facts || []).join('; ') || 'None established';
  return `Case: ${appState.profile.title || 'Unknown'} | Phase: ${appState.phase} | Current AP: ${appState.ap} | Strikes: ${appState.strikes}
Marked Docket: ${docketStr}
Established Court Facts: ${factStr}`;
}

async function sendAssistantAction(userPrompt, isRetry = false) {
  if (engineLocked) return;
  engineLocked = true;

  const submitBtn = document.getElementById('assistant-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  const tabId = activeAssistantTab;
  const histArray = tabId === 'partner' ? partnerHistory : diazHistory;
  const rolePrefix = tabId === 'partner' ? '[SENIOR PARTNER CONSULTATION]: ' : '[INVESTIGATOR CONSULTATION]: ';
  const senderName = tabId === 'partner' ? 'SENIOR PARTNER' : 'INV. DIAZ';
  const typingLabel = tabId === 'partner' ? 'Partner Reviewing' : 'Diaz Investigating';

  if (!isRetry) {
    histArray.push({ role: 'user', parts: [{ text: rolePrefix + userPrompt }] });
    renderAssistantFeeds();
  }

  toggleTypingIndicator(`${tabId}-feed`, true, typingLabel);

  // BATCH 5 BYOK: Attach Custom Headers if saved
  const reqHeaders = { "Content-Type": "application/json" };
  if (customGeminiKey) {
    reqHeaders["X-Custom-Gemini-Key"] = customGeminiKey;
  }

  let attempt = 0, success = false;
  try {
    while (attempt <= 2 && !success) {
      attempt++;
      try {
        const response = await fetchWithTimeout(WORKER_URL, {
          method: "POST", 
          headers: reqHeaders,
          body: JSON.stringify({ 
            message: rolePrefix + userPrompt, 
            history: histArray.slice(0, -1),
            targetPersona: tabId,
            capsule: buildContextCapsule()
          })
        }, 30000);

        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }

        if (response.status === 429 && data?.error === "QUOTA_EXHAUSTED") {
          if (data.activeModel) {
            appState.selectedModel = data.activeModel;
          }
          appendAssistantMessage(tabId, senderName, data.reply, false, true);
          renderAssistantFeeds();
          success = true;
          break;
        }

        if (!response.ok) {
          throw new Error(`Worker HTTP ${response.status}`);
        }

        if (data && data.activeModel) {
          appState.selectedModel = data.activeModel;
        }

        histArray.push({ role: "model", parts: [{ text: data.reply }] });
        localStorage.setItem(`rest_your_case_${tabId}_history`, JSON.stringify(histArray));
        
        renderAssistantFeeds();
        success = true;

      } catch (err) {
        if (attempt > 2) appendErrorAlert(err.message, userPrompt, true);
        else await new Promise(res => setTimeout(res, 1000));
      }
    }
  } finally {
    engineLocked = false;
    toggleTypingIndicator(`${tabId}-feed`, false);
    updateActiveModelDisplay();
    if (submitBtn) submitBtn.disabled = false;
  }
}

function processCourtResponse(rawText) {
  const oldAp = appState.ap;
  
  const checkpointMatch = rawText.match(/<!--STATE_CHECKPOINT:\s*({[\s\S]*?})-->/);
  if (checkpointMatch && appState.hasActiveCase) {
    try {
      const stateUpdate = JSON.parse(checkpointMatch[1]);
      appState.turn = stateUpdate.turn ?? appState.turn;
      appState.ap = stateUpdate.ap ?? appState.ap;
      appState.strikes = stateUpdate.strikes ?? appState.strikes;
      appState.phase = stateUpdate.phase ?? appState.phase;
      if (stateUpdate.case && stateUpdate.case.title) appState.profile.title = stateUpdate.case.title;
      if (stateUpdate.caseTitle) appState.profile.title = stateUpdate.caseTitle; 
      if (stateUpdate.case && stateUpdate.case.client) appState.profile.client = stateUpdate.case.client;
      if (stateUpdate.clientName) appState.profile.client = stateUpdate.clientName; 
      if (stateUpdate.judge) appState.profile.judge = stateUpdate.judge;
      if (stateUpdate.da) appState.profile.da = stateUpdate.da;
      if (stateUpdate.facts) appState.facts = stateUpdate.facts;
      
      if (stateUpdate.docket) {
        const manualItems = (appState.docket || []).filter(d => d.isManual);
        const apiItems = stateUpdate.docket.map(d => ({ ...d, isApi: true }));
        appState.docket = [...apiItems, ...manualItems];
      }
    } catch (e) { console.error("Checkpoint parse error", e); }
  } else if (appState.hasActiveCase) { appState.turn++; }

  const cleanText = rawText.replace(/<!--[\s\S]*?-->/g, "").trim();
  appendTranscriptMessage("THE BENCH / RECORD", cleanText, false);
  
  if (appState.hasActiveCase && appState.ap < oldAp) {
     const apDiff = oldAp - appState.ap;
     const alertHtml = `
      <div class="flex items-center justify-center my-4">
        <div class="px-3 py-1 bg-amber-950/40 border border-amber-900/50 rounded-full flex items-center gap-2 shadow-sm">
          <span class="text-amber-500 text-xs">⚡</span>
          <span class="text-amber-400 font-mono text-[10px] font-bold tracking-widest uppercase">-${apDiff} AP Consumed (Remaining: ${appState.ap})</span>
        </div>
      </div>`;
     const feed = document.getElementById('transcript-feed');
     feed.insertAdjacentHTML('beforeend', alertHtml);
     feed.scrollTop = feed.scrollHeight;
  }
  
  persist(); 
  renderUI();
}

// Direct initialization after DOM tree parse
initApp();
