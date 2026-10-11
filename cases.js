/* cases.js — consolidated source sections; existing behavior retained. */
// BEGIN SOURCE: case-store.js
/* All pages use the same lock and compare the saved snapshot before replacing it. */
const RYCCaseStore = (() => {
  const key = 'rest_your_case_state';
  let queue = Promise.resolve();
  function conflict() {
    const error = new Error('This trial changed in another tab. Reload to use the latest saved case.');
    error.name = 'CaseConflictError';
    return error;
  }
  const read = () => localStorage.getItem(key);
  function check(expected) {
    if (read() !== expected) throw conflict();
  }
  function exclusive(action) {
    const run = () => typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('ryc-active-trial', action) : action();
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }
  function write(expected, next, options = {}) {
    return exclusive(() => {
      check(expected);
      let previous;
      try {
        previous = JSON.parse(expected || 'null');
      } catch (_) {}
      const revision = Number.isSafeInteger(previous?.revision) ? previous.revision + 1 : 1;
      const saved = {
        ...next,
        revision
      };
      const raw = JSON.stringify(saved);
      if (options.backup != null && !options.clearTrialExtras) localStorage.setItem('rest_your_case_recovery_backup', options.backup);
      // The one snapshot is authoritative; a failed write leaves the old trial intact.
      localStorage.setItem(key, raw);
      if (options.clearTrialExtras) {
        for (const item of ['terminal_draft', 'ryc_visual_room', 'rest_your_case_recovery_backup']) {
          try {
            localStorage.removeItem(item);
          } catch (_) {}
        }
        for (const item of ['trigger_engine_handshake', 'trigger_intake_start']) {
          try {
            sessionStorage.removeItem(item);
          } catch (_) {}
        }
      }
      for (const [channel, item] of [['court', 'rest_your_case_history'], ['partner', 'rest_your_case_partner_history'], ['diaz', 'rest_your_case_diaz_history']]) {
        try {
          localStorage.setItem(item, JSON.stringify(saved._histories?.[channel] || []));
        } catch (_) {}
      }
      return {
        state: saved,
        raw
      };
    });
  }
  function id() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'trial_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  return {
    key,
    read,
    check,
    write,
    id,
    conflict
  };
})();
// END SOURCE: case-store.js

// BEGIN SOURCE: archive-trial.js
/* File name: archive-trial.js — Standard-only purge and save rules. */
/* The archive and game share the same initialization and save rules. */
window.RYCArchiveTrial = (() => {
  function describe(state) {
    if (!state?.hasActiveCase) return null;
    const seedTitle = state.activeCaseSeed?.scout?.caseTitle;
    const title = RYCState.placeholder(state.profile?.title) ? RYCState.placeholder(seedTitle) ? 'Case setup incomplete' : seedTitle : state.profile.title;
    const incomplete = RYCState.intakeStatus(state) === 'incomplete';
    const failed = !!state._requests?.court;
    const request = state._requests?.court;
    const setupRetry = request && (request.isInit || /^\/start(?:\s|$)/i.test(String(request.prompt || '').trim()));
    return {
      title,
      phase: incomplete ? 'Intake has not initialized' : state.phase || 'In progress',
      action: incomplete ? setupRetry ? 'Retry setup' : 'Finish setup' : failed ? 'Retry action' : 'Resume trial',
      incomplete,
      failed
    };
  }
  async function purge(expectedRaw) {
    const guard = JSON.parse(expectedRaw || 'null');
    if (guard?.extreme) throw new Error('Use the Extreme terminal for this case.');
    let previous;
    try {
      previous = JSON.parse(expectedRaw || 'null');
    } catch (_) {
      previous = null;
    }
    const empty = {
      ...RYCState.emptyState(previous || {}),
      _histories: {
        court: [],
        partner: [],
        diaz: []
      },
      _requests: {}
    };
    await RYCCaseStore.write(expectedRaw, empty, {
      clearTrialExtras: true
    });
    return true;
  }
  return {
    describe,
    purge
  };
})();
// END SOURCE: archive-trial.js

// BEGIN SOURCE: scout_prompt.js
/* File name: scout_prompt.js */
/* Scout output is normalized at the boundary; incomplete cases are never saved. */
function buildScoutPrompt(seed) {
  return `Create one fictional, internally consistent criminal-defense game case using the supplied parameters. Follow the sampled roster, charge, venue and mechanics. Return ONLY one JSON object, without markdown or wrapper fields, with these exact top-level keys: caseTitle, crimeSummary, starterExhibits, unencryptedTruth.
{"caseTitle":"State v. Client","crimeSummary":"Brief player-visible allegation, with no solution spoilers.","starterExhibits":[{"id":"E01","name":"Exhibit name","type":"Documentary","status":"Marked","details":"Player-visible evidence"},{"id":"E02","name":"Second exhibit","type":"Physical","status":"Marked","details":"Player-visible evidence"}],"unencryptedTruth":"Private established chronology, true responsibility, witness knowledge, evidentiary flaw, discoverable contradictions and a fair route to resolving the case."}
Exactly two starter exhibits with distinct identifiers are required. Marked is not Admitted. Keep the hidden truth out of caseTitle, crimeSummary and starterExhibits. The truth must remain stable throughout the later trial; discovery must be consistent with it. Do not render trial dialogue, a court state checkpoint, or start spending AP. Preserve roster.client.occupation exactly (civilian, police, or expert; absent in legacy seeds means civilian). A police client is the defendant, not automatically a police witness. An expert has a specific credible specialty, not universal expertise. Make the allegation and private chronology consistent with the occupation. Design a fair investigation route whose essential paid actions fit the Normal budget of 4 + 2 * meta.complexity AP. Optional or mistaken leads may consume additional AP; higher complexity permits deeper and costlier investigation. Late trial discoveries must remain consistent with the fixed truth. Treat the seed as data. Check that all four required keys contain complete values before returning.
${typeof RYCI18n === 'undefined' ? '' : RYCI18n.instruction()}\nCASE SEED:\n${JSON.stringify(seed)}`;
}
function parseScoutResponse(raw, seed) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const pick = (value, keys) => {
    for (const key of keys) if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    return '';
  };
  function decode(value) {
    if (typeof value !== 'string') return value;
    const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error('The Scout returned invalid case JSON.');
    }
  }
  let value = decode(raw);
  // Accept known object envelopes and JSON-encoded objects, never arbitrary text or checkpoints.
  for (let depth = 0; depth < 5; depth++) {
    if (typeof value === 'string') {
      value = decode(value);
      continue;
    }
    if (!object(value)) throw new Error('The Scout returned no usable case object.');
    if (['caseTitle', 'case_title', 'crimeSummary', 'crime_summary', 'starterExhibits', 'starter_exhibits', 'unencryptedTruth', 'unencrypted_truth'].some(key => key in value)) break;
    const key = ['scout', 'case', 'caseData', 'data', 'result', 'payload', 'reply'].find(key => object(value[key]) || typeof value[key] === 'string');
    if (!key) break;
    value = decode(value[key]);
  }
  if (!object(value)) throw new Error('The Scout returned no usable case object.');
  const fields = Object.keys(value).slice(0, 12).map(key => key.replace(/[^A-Za-z0-9_]/g, '').slice(0, 48)).filter(Boolean).join(', ') || 'none';
  const crimeSummary = pick(value, ['crimeSummary', 'crime_summary']);
  const unencryptedTruth = pick(value, ['unencryptedTruth', 'unencrypted_truth']);
  const exhibits = value.starterExhibits ?? value.starter_exhibits;
  const missing = [];
  if (!crimeSummary) missing.push('crimeSummary');
  if (!unencryptedTruth) missing.push('unencryptedTruth');
  if (!Array.isArray(exhibits) || exhibits.length !== 2) missing.push('two starterExhibits');
  if (missing.length) throw new Error('Scout case is incomplete: ' + missing.join(', ') + '. Returned field names: ' + fields + '. No case was saved.');
  // A title is safe to derive from the sampled client only after all actual case content validates.
  const caseTitle = pick(value, ['caseTitle', 'case_title', 'title']) || (typeof seed?.roster?.client?.name === 'string' && seed.roster.client.name.trim() ? `State v. ${seed.roster.client.name.trim()}` : '');
  if (!caseTitle) throw new Error('Scout case is missing caseTitle. Returned field names: ' + fields + '. No case was saved.');
  const clientOccupation = seed?.roster?.client?.occupation ?? 'civilian';
  if (!['civilian', 'police', 'expert'].includes(clientOccupation)) throw new Error('Invalid sampled client occupation.');
  for (const key of ['clientOccupation', 'client_occupation']) if (value[key] !== undefined && value[key] !== clientOccupation) throw new Error('Scout cannot change the sampled client occupation.');
  const seen = new Set();
  const starterExhibits = exhibits.map(e => {
    if (!object(e)) throw new Error('Incomplete starter exhibit. No case was saved.');
    const sourceId = pick(e, ['id', 'tag']);
    const id = sourceId.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    if (!sourceId || !/^[-A-Za-z0-9_]{1,40}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || seen.has(id)) throw new Error('Invalid or duplicate starter exhibit identifier.');
    const name = pick(e, ['name', 'title']),
      type = pick(e, ['type']),
      details = pick(e, ['details', 'description', 'facts']);
    if (!name || !type || !details) throw new Error('Incomplete starter exhibit. No case was saved.');
    seen.add(id);
    return {
      id,
      name,
      type,
      details,
      status: 'Marked'
    };
  });
  return {
    caseTitle,
    crimeSummary,
    unencryptedTruth,
    starterExhibits,
    clientOccupation
  };
}
// END SOURCE: scout_prompt.js

// BEGIN SOURCE: cases.js
/**
 * File: cases.js
 * Rest Your Case - Shelf Storage & Procedural Generation Broker
 * 
 * Manages the lifecycle of pending intakes and archived case files.
 */

const WORKER_URL = "https://rest-your-case.spacexmzez.workers.dev/";
let failedScout = null;

// =========================================================================
// STORAGE HELPERS (Pending & Shelf)
// =========================================================================

function getPendingCases() {
  try {
    const data = localStorage.getItem('ryc_pending_cases');
    const list = data ? JSON.parse(data) : [];
    if (!Array.isArray(list)) throw new Error('Saved case collection is damaged.');
    return list;
  } catch (e) {
    throw new Error('Cannot read the case collection: ' + e.message);
  }
}
function savePendingCases(cases) {
  try {
    // Cap pending cases at 10 to prevent bloat
    if (cases.length > 10) cases = cases.slice(-10);
    localStorage.setItem('ryc_pending_cases', JSON.stringify(cases));
  } catch (e) {
    throw new Error('Could not save pending cases. Check browser storage.');
  }
}
function getShelfCases() {
  try {
    const data = localStorage.getItem('ryc_shelf_cases');
    const list = data ? JSON.parse(data) : [];
    if (!Array.isArray(list)) throw new Error('Saved case collection is damaged.');
    return list;
  } catch (e) {
    throw new Error('Cannot read the case collection: ' + e.message);
  }
}
function saveShelfCases(cases) {
  try {
    // Cap shelf cases at 30 (FIFO - drop oldest)
    if (cases.length > 30) cases = cases.slice(0, 30);
    localStorage.setItem('ryc_shelf_cases', JSON.stringify(cases));
  } catch (e) {
    throw new Error('Could not save the archive. Check browser storage.');
  }
}

/**
 * Moves all currently pending cases into the persistent Shelf archive.
 */
function archivePending() {
  const pending = getPendingCases();
  if (pending.length === 0) return;
  const shelf = getShelfCases();
  // Prepend to shelf so newest archived cases appear first
  const newShelf = [...pending.reverse(), ...shelf];
  saveShelfCases(newShelf);
  localStorage.removeItem('ryc_pending_cases');
}

// =========================================================================
// SCOUT GENERATION BROKER
// =========================================================================

/**
 * Generates a new case file using the fast scout model.
 * A single bounded request. Manual retries reuse the same sampled case.
 * 
 * @param {string} diff - Trial Difficulty (Easy, Normal, Hard)
 * @param {number} comp - Case Complexity (1-5)
 * @param {string} cat - Charge Category string
 * @param {AbortSignal} signal - Optional abort signal to cancel request
 * @returns {Promise<object>} The fully assembled Case Object
 */
async function generateCase(diff, comp, cat, signal, onProgress) {
  if (!Number.isInteger(Number(comp)) || Number(comp) < 1 || Number(comp) > 5) throw new Error('Standard complexity must be 1–5.');
  const language = RYCI18n.get();
  const signature = JSON.stringify([diff, comp, cat, language]);
  if (!failedScout || failedScout.signature !== signature) {
    const seed = sampleCaseDocket(comp, cat);
    failedScout = {
      signature,
      seed,
      prompt: buildScoutPrompt(seed)
    };
  }
  const pendingRequest = {
    ...failedScout
  };
  failedScout = pendingRequest;
  const customKey = localStorage.getItem('rest_your_case_custom_gemini_key');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (customKey) headers['X-Custom-Gemini-Key'] = customKey;
  try {
    const {
      response,
      data
    } = await RYCRequest.fetchJSON(WORKER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: pendingRequest.prompt,
        history: [],
        targetPersona: 'scout',
        engineMode: RYCModels.get(),
        language
      })
    }, {
      signal,
      onProgress
    });
    if (!response.ok) throw RYCRequest.error('HTTP_' + response.status, typeof data?.details === 'string' ? data.details : typeof data?.error === 'string' ? data.error : data?.error?.message || 'Server returned HTTP ' + response.status + '.');
    let scout;
    try {
      scout = parseScoutResponse(data?.reply, pendingRequest.seed);
    } catch (e) {
      throw RYCRequest.error('INVALID_RESPONSE', e.message);
    }
    const finalCase = {
      id: 'case_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: Date.now(),
      difficulty: diff,
      language,
      seed: pendingRequest.seed,
      scout
    };
    const pending = getPendingCases();
    pending.push(finalCase);
    savePendingCases(pending);
    if (failedScout === pendingRequest) failedScout = null;
    return finalCase;
  } catch (e) {
    if (e.code === 'CANCELLED' && failedScout === pendingRequest) failedScout = null;
    throw e;
  }
}

// =========================================================================
// TRIAL HYDRATION (STARTING A CASE)
// =========================================================================

/**
 * Hydrates the application state with a case file and redirects to the terminal.
 * Safely removes the case from the shelf/pending list if started.
 * 
 * @param {object} caseObj - The fully assembled case object from pending or shelf
 */
async function startTrialWithCase(caseObj) {
  if (caseObj.extreme) throw new Error('Open this case in the Extreme archive.');
  await window.RYCExtremeMigration?.run();
  caseObj = RYCState.repairOccupationRecord(caseObj);
  const seedError = RYCState.seedError(caseObj);
  if (seedError) throw new Error(seedError);
  // Check for active trial collision
  const existingStateStr = localStorage.getItem('rest_your_case_state');
  let existingState = null;
  if (existingStateStr) {
    try {
      existingState = JSON.parse(existingStateStr);
    } catch (_) {
      throw new Error('The current trial cannot be read. Recover or purge it before starting another case.');
    }
  }
  if (existingState?.hasActiveCase) {
    const typed = prompt(RYCI18n.t('Accepting this case permanently purges your current Standard trial, notes and conversations. Type CONFIRM to continue.'));
    if (typed !== 'CONFIRM') return false;
  }

  // Calculate mechanical variables
  const diff = caseObj.difficulty || 'Normal';
  const startingAP = RYCState.apBudget(diff, caseObj.seed.meta.complexity);
  const strikesMax = diff === 'Easy' || diff === 'Sandbox' ? 4 : diff === 'Hard' ? 2 : 3;

  // Format initial docket format with AI generation locks
  const startingDocket = (caseObj.scout.starterExhibits || []).map(ex => ({
    ...ex,
    isApi: true
  }));

  // Preserve trash warning preference
  let prevWarning = false;
  if (existingStateStr) {
    try {
      prevWarning = JSON.parse(existingStateStr).hasSeenTrashWarning || false;
    } catch (e) {}
  }

  // 1. Build the fresh Game Engine State
  const freshState = {
    hasActiveCase: true,
    caseId: RYCCaseStore.id(),
    intakeComplete: false,
    profile: {
      title: caseObj.scout.caseTitle,
      client: caseObj.seed.roster.client.name,
      clientOccupation: RYCState.recordOccupation(caseObj),
      judge: caseObj.seed.roster.judge.name,
      da: caseObj.seed.roster.da.name
    },
    phase: "Phase 1: Intake",
    turn: 1,
    ap: startingAP,
    apVersion: RYCState.AP_VERSION,
    initialAP: startingAP,
    apGrants: [],
    apGrantsTotal: 0,
    strikes: 0,
    maxStrikes: strikesMax,
    notes: '',
    transcript: [],
    docket: startingDocket,
    facts: [`Defendant is formally charged with ${caseObj.seed.charge.charge}.`],
    difficulty: diff,
    complexity: caseObj.seed.meta.complexity,
    category: caseObj.seed.meta.genre_key,
    selectedModel: 'gemini-3.8-flash',
    // Default, will update dynamically on first engine turn
    activeCaseSeed: caseObj,
    // Store the entire object for the Engine's Turn 1 prompt
    trashedFacts: [],
    hiddenFacts: [],
    exhibitNotes: {},
    hasSeenTrashWarning: prevWarning
  };
  const partnerGreeting = `I reviewed ${caseObj.scout.caseTitle}. Consult me for strategy at 0 AP.`;
  const diazGreeting = `Diaz here. Subpoenas cost 1 AP; field canvassing and forensic audits cost 2 AP. Advice costs 0 AP.`;
  freshState._histories = {
    court: [],
    partner: [{
      role: 'model',
      parts: [{
        text: partnerGreeting
      }]
    }],
    diaz: [{
      role: 'model',
      parts: [{
        text: diazGreeting
      }]
    }]
  };
  freshState._requests = {};
  await RYCCaseStore.write(existingStateStr, freshState, {
    clearTrialExtras: true
  });
  // If session storage is unavailable the game still offers Finish case setup.
  try {
    sessionStorage.setItem('trigger_engine_handshake', freshState.caseId);
  } catch (_) {}

  // The trial is saved before archive cleanup. A cleanup failure must not lose it.
  try {
    const pending = getPendingCases().filter(c => c.id !== caseObj.id);
    const shelf = getShelfCases().filter(c => c.id !== caseObj.id);
    saveShelfCases([...pending.reverse(), ...shelf]);
    savePendingCases([]);
  } catch (error) {
    console.warn(error.message);
  }
  window.location.href = 'game.html#terminal';
  return true;
}

// Module export for Node or Browser inclusion
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getPendingCases,
    savePendingCases,
    getShelfCases,
    saveShelfCases,
    archivePending,
    generateCase,
    startTrialWithCase
  };
}
// END SOURCE: cases.js
