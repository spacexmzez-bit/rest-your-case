/**
 * File: cases.js
 * Rest Your Case - Shelf Storage & Procedural Generation Broker
 * 
 * Manages the lifecycle of pending intakes and archived case files.
 */

const WORKER_URL = "https://rest-your-case.spacexmzez.workers.dev/";
const RYCRequest = (()=>{
  const error=(code,message)=>Object.assign(new Error(message),{code,name:code==='CANCELLED'?'AbortError':code==='INVALID_RESPONSE'?'ResponseValidationError':'RequestError'});
  function format(e) {
    const code=e?.code || (e?.name==='ResponseValidationError'?'INVALID_RESPONSE':e?.name==='AbortError'?'CANCELLED':e instanceof TypeError?'NETWORK_ERROR':/storage|quota|save/i.test(e?.message||'')?'STORAGE_ERROR':/checkpoint|reply|response/i.test(e?.message||'')?'INVALID_RESPONSE':'ACTION_ERROR');
    return `[${code}] ${e?.message||String(e)}`;
  }
  async function fetchJSON(url,options={},config={}) {
    const timeoutMs=config.timeoutMs??60000,signal=config.signal||options.signal,controller=new AbortController();
    if(signal?.aborted)throw error('CANCELLED','Search cancelled.');
    let timeout,interval,onAbort,closed=false;
    const start=Date.now();
    const update=()=>{try{config.onProgress?.({elapsed:Math.floor((Date.now()-start)/1000),slow:Date.now()-start>=(config.warnAfterMs??15000)});}catch(_) {}};
    const stopped=new Promise((_,reject)=>{
      timeout=setTimeout(()=>{closed=true;controller.abort();reject(error('TIMEOUT',`No complete response within ${timeoutMs/1000} seconds. Retry when ready.`));},timeoutMs);
      onAbort=()=>{closed=true;controller.abort();reject(error('CANCELLED','Search cancelled.'));};
      signal?.addEventListener('abort',onAbort,{once:true});
    });
    update();interval=setInterval(update,1000);
    const request=(async()=>{
      let response;try{response=await fetch(url,{...options,signal:controller.signal});}catch(e){if(closed)throw e;throw error('NETWORK_ERROR','Could not reach the server. '+(e.message||String(e)));}
      if(closed)throw error('CANCELLED','Request already ended.');
      let data;try{data=await response.json();}catch(e){if(closed)throw e;if(response.ok)throw error('INVALID_RESPONSE','The server returned invalid JSON.');}
      if(closed)throw error('CANCELLED','Request already ended.');
      return {response,data};
    })();
    try{return await Promise.race([stopped,request]);}
    finally {closed=true;clearTimeout(timeout);clearInterval(interval);signal?.removeEventListener('abort',onAbort);config.onController?.(null);}
  }
  return {fetchJSON,format,error};
})();
let failedScout=null;

// =========================================================================
// STORAGE HELPERS (Pending & Shelf)
// =========================================================================

function getPendingCases() {
  try {
    const data = localStorage.getItem('ryc_pending_cases');
    const list=data?JSON.parse(data):[];
    if(!Array.isArray(list))throw new Error('Saved case collection is damaged.');
    return list;
  } catch (e) { throw new Error('Cannot read the case collection: '+e.message); }
}

function savePendingCases(cases) {
  try {
    // Cap pending cases at 10 to prevent bloat
    if (cases.length > 10) cases = cases.slice(-10);
    localStorage.setItem('ryc_pending_cases', JSON.stringify(cases));
  } catch (e) { throw new Error('Could not save pending cases. Check browser storage.'); }
}

function getShelfCases() {
  try {
    const data = localStorage.getItem('ryc_shelf_cases');
    const list=data?JSON.parse(data):[];
    if(!Array.isArray(list))throw new Error('Saved case collection is damaged.');
    return list;
  } catch (e) { throw new Error('Cannot read the case collection: '+e.message); }
}

function saveShelfCases(cases) {
  try {
    // Cap shelf cases at 30 (FIFO - drop oldest)
    if (cases.length > 30) cases = cases.slice(0,30);
    localStorage.setItem('ryc_shelf_cases', JSON.stringify(cases));
  } catch (e) { throw new Error('Could not save the archive. Check browser storage.'); }
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
  const signature=JSON.stringify([diff,comp,cat]);
  if(!failedScout || failedScout.signature!==signature) {
    const seed=sampleCaseDocket(comp,cat);
    failedScout={signature,seed,prompt:buildScoutPrompt(seed)};
  }
  const pendingRequest={...failedScout};failedScout=pendingRequest;
  const customKey=localStorage.getItem('rest_your_case_custom_gemini_key');
  const headers={'Content-Type':'application/json'};
  if(customKey)headers['X-Custom-Gemini-Key']=customKey;
  try {
    const {response,data}=await RYCRequest.fetchJSON(WORKER_URL,{method:'POST',headers,body:JSON.stringify({message:pendingRequest.prompt,history:[],targetPersona:'scout',engineMode:RYCModels.get()})},{signal,onProgress});
    if(!response.ok)throw RYCRequest.error('HTTP_'+response.status,typeof data?.details==='string'?data.details:typeof data?.error==='string'?data.error:data?.error?.message||'Server returned HTTP '+response.status+'.');
    let scout;try{scout=parseScoutResponse(data?.reply,pendingRequest.seed);}catch(e){throw RYCRequest.error('INVALID_RESPONSE',e.message);}
    const finalCase={id:'case_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),timestamp:Date.now(),difficulty:diff,seed:pendingRequest.seed,scout};
    const pending=getPendingCases();pending.push(finalCase);savePendingCases(pending);
    if(failedScout===pendingRequest)failedScout=null;return finalCase;
  } catch(e) {if(e.code==='CANCELLED'&&failedScout===pendingRequest)failedScout=null;throw e;}
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
  caseObj=RYCState.repairOccupationRecord(caseObj);
  const seedError=RYCState.seedError(caseObj);if(seedError)throw new Error(seedError);
  // Check for active trial collision
  const existingStateStr = localStorage.getItem('rest_your_case_state');
  let existingState=null;
  if(existingStateStr){try{existingState=JSON.parse(existingStateStr);}catch(_){throw new Error('The current trial cannot be read. Recover or purge it before starting another case.');}}
  if(existingState?.hasActiveCase&&!confirm("You currently have an active trial. Accepting this case will permanently discard your active progress. Proceed?"))return false;


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

  const partnerGreeting = `I reviewed ${caseObj.scout.caseTitle}. Consult me for strategy at 0 AP.`;
  const diazGreeting = `Diaz here. Subpoenas cost 1 AP; field canvassing and forensic audits cost 2 AP. Advice costs 0 AP.`;
  freshState._histories={court:[],partner:[{role:'model',parts:[{text:partnerGreeting}]}],diaz:[{role:'model',parts:[{text:diazGreeting}]}]};
  freshState._requests={};
  await RYCCaseStore.write(existingStateStr,freshState,{clearTrialExtras:true});
  // If session storage is unavailable the game still offers Finish case setup.
  try{sessionStorage.setItem('trigger_engine_handshake',freshState.caseId);}catch(_){}

  // The trial is saved before archive cleanup. A cleanup failure must not lose it.
  try {
    const pending=getPendingCases().filter(c=>c.id!==caseObj.id);
    const shelf=getShelfCases().filter(c=>c.id!==caseObj.id);
    saveShelfCases([...pending.reverse(),...shelf]);savePendingCases([]);
  }catch(error){console.warn(error.message);}
  window.location.href='game.html#terminal';
  return true;
}

// Module export for Node or Browser inclusion
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getPendingCases, savePendingCases, getShelfCases, saveShelfCases, archivePending, generateCase, startTrialWithCase
  };
}
