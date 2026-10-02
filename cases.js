/**
 * File: cases.js
 * Rest Your Case - Shelf Storage & Procedural Generation Broker
 * 
 * Manages the lifecycle of pending intakes and archived case files.
 */

const WORKER_URL = "https://rest-your-case.spacexmzez.workers.dev/";

// =========================================================================
// STORAGE HELPERS (Pending & Shelf)
// =========================================================================

function getPendingCases() {
  try {
    const data = localStorage.getItem('ryc_pending_cases');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function savePendingCases(cases) {
  try {
    // Cap pending cases at 10 to prevent bloat
    if (cases.length > 10) cases = cases.slice(-10);
    localStorage.setItem('ryc_pending_cases', JSON.stringify(cases));
  } catch (e) { console.warn("Failed to save pending cases:", e); }
}

function getShelfCases() {
  try {
    const data = localStorage.getItem('ryc_shelf_cases');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveShelfCases(cases) {
  try {
    // Cap shelf cases at 30 (FIFO - drop oldest)
    if (cases.length > 30) cases = cases.slice(-30);
    localStorage.setItem('ryc_shelf_cases', JSON.stringify(cases));
  } catch (e) { console.warn("Failed to save shelf cases:", e); }
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
 * Retries exactly once on malformed JSON or transient upstream failure.
 * 
 * @param {string} diff - Trial Difficulty (Easy, Normal, Hard)
 * @param {number} comp - Case Complexity (1-5)
 * @param {string} cat - Charge Category string
 * @param {AbortSignal} signal - Optional abort signal to cancel request
 * @returns {Promise<object>} The fully assembled Case Object
 */
async function generateCase(diff, comp, cat, signal) {
  let attempt = 0;
  let lastErrorMsg = "Failed to generate case.";

  // Retrieve BYOK custom key if present
  const customKey = localStorage.getItem('rest_your_case_custom_gemini_key');
  const reqHeaders = { "Content-Type": "application/json" };
  if (customKey) reqHeaders["X-Custom-Gemini-Key"] = customKey;

  while (attempt < 2) {
    attempt++;
    try {
      // 1. Procedurally sample static variables
      const caseSeed = sampleCaseDocket(comp, cat);
      const scoutPromptText = buildScoutPrompt(caseSeed);

      // 2. Fetch Scout Generation
      const fetchOptions = {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          message: scoutPromptText,
          history: [],
          targetPersona: 'scout'
        })
      };
      
      if (signal) fetchOptions.signal = signal;

      const response = await fetch(WORKER_URL, fetchOptions);
      const data = await response.json().catch(() => null);

      if (response.status === 429) {
        throw new Error("API Quota Exhausted. Please plug in a personal API key in settings.");
      }
      
      if (!response.ok || !data) {
        throw new Error(data?.error?.message || data?.details || data?.error || `Server Error (${response.status})`);
      }

      // 3. Parse and strictly validate the JSON
      const parsedScout = parseScoutResponse(data.reply);

      // 4. Assemble the final case entity
      const finalCase = {
        id: "case_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        difficulty: diff,
        seed: caseSeed,
        scout: parsedScout
      };

      // Add to pending array
      const pending = getPendingCases();
      pending.push(finalCase);
      savePendingCases(pending);

      return finalCase;

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error("Search cancelled.");
      }
      lastErrorMsg = err.message;
      if (attempt >= 2) {
        throw new Error(`Generation failed: ${lastErrorMsg}`);
      }
    }
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
function startTrialWithCase(caseObj) {
  // Check for active trial collision
  const existingStateStr = localStorage.getItem('rest_your_case_state');
  if (existingStateStr) {
    try {
      const existingState = JSON.parse(existingStateStr);
      if (existingState.hasActiveCase) {
        const confirmWipe = confirm("You currently have an active trial. Accepting this case will permanently discard your active progress. Proceed?");
        if (!confirmWipe) return;
      }
    } catch (e) {}
  }

  // Calculate mechanical variables
  const diff = caseObj.difficulty || 'Normal';
  const startingAP = (diff === 'Easy') ? 6 : (diff === 'Hard') ? 3 : 4;
  const strikesMax = (diff === 'Easy') ? 4 : (diff === 'Hard') ? 2 : 3;
  
  // Format initial docket format with AI generation locks
  const startingDocket = (caseObj.scout.starterExhibits || []).map(ex => ({ ...ex, isApi: true }));

  // Preserve trash warning preference
  let prevWarning = false;
  if (existingStateStr) {
    try { prevWarning = JSON.parse(existingStateStr).hasSeenTrashWarning || false; } catch (e) {}
  }

  // 1. Build the fresh Game Engine State
  const freshState = {
    hasActiveCase: true,
    profile: { 
      title: caseObj.scout.caseTitle, 
      client: caseObj.seed.roster.client.name, 
      judge: caseObj.seed.roster.judge.name, 
      da: caseObj.seed.roster.da.name 
    },
    phase: "Phase 1: Intake", 
    turn: 1, 
    ap: startingAP, 
    strikes: 0, 
    maxStrikes: strikesMax, 
    notes: '',
    transcript: [], 
    docket: startingDocket, 
    facts: [`Defendant is formally charged with ${caseObj.seed.charge.charge}.`], 
    difficulty: diff, 
    complexity: caseObj.seed.meta.complexity,
    category: caseObj.seed.meta.genre_key,
    selectedModel: 'gemini-3.8-flash', // Default, will update dynamically on first engine turn
    activeCaseSeed: caseObj, // Store the entire object for the Engine's Turn 1 prompt
    trashedFacts: [], 
    hiddenFacts: [], 
    exhibitNotes: {}, 
    hasSeenTrashWarning: prevWarning
  };

  // 2. Wipe old histories and apply fresh state
  localStorage.setItem('rest_your_case_state', JSON.stringify(freshState));
  localStorage.removeItem('rest_your_case_history');
  localStorage.removeItem('terminal_draft');

  // 3. Seed Assistants
  const partnerGreeting = `I reviewed the preliminary docket for ${caseObj.scout.caseTitle}. We're in front of ${caseObj.seed.roster.judge.name}, and ${caseObj.seed.roster.da.name} has the file. Keep an eye on our AP budget and consult me anytime at 0 AP.`;
  const diazGreeting = `Diaz here. I'm assigned to ${caseObj.scout.caseTitle}. Subpoenas are 1 AP; field canvassing and forensic audits cost 2 AP. Let's dig in.`;
  
  localStorage.setItem('rest_your_case_partner_history', JSON.stringify([{ role: 'model', parts: [{ text: partnerGreeting }] }]));
  localStorage.setItem('rest_your_case_diaz_history', JSON.stringify([{ role: 'model', parts: [{ text: diazGreeting }] }]));

  // 4. Remove case from Storage (Shelf or Pending)
  const pending = getPendingCases().filter(c => c.id !== caseObj.id);
  savePendingCases(pending);
  const shelf = getShelfCases().filter(c => c.id !== caseObj.id);
  saveShelfCases(shelf);

  // 5. Trigger auto-initialization via sessionStorage and Redirect
  sessionStorage.setItem('trigger_engine_handshake', 'true');
  window.location.href = 'game.html#terminal';
}

// Module export for Node or Browser inclusion
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getPendingCases, savePendingCases, getShelfCases, saveShelfCases, archivePending, generateCase, startTrialWithCase
  };
}
