/* Pure validation: rejected replies never mutate the current case. */
const RYCState = (() => {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key);
  const placeholder = value => typeof value !== 'string' || !value.trim() || /^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim());
  function intakeStatus(state) {
    if (!state?.hasActiveCase) return 'none';
    if (['title','client','judge','da'].some(key => placeholder(state.profile?.[key]))) return 'incomplete';
    if (typeof state.intakeComplete === 'boolean') return state.intakeComplete ? 'ready' : 'incomplete';
    // Legacy saves have no explicit marker. Player messages alone never prove initialization.
    return Array.isArray(state.transcript) && state.transcript.some(e => object(e) && e.isUser !== true && typeof e.text === 'string' && e.text.trim()) ? 'ready' : 'incomplete';
  }
  function seedError(record) {
    if (!object(record?.seed) || !object(record?.scout)) return 'The saved intake is missing its case seed or scout record.';
    const paths = ['meta.genre_key','roster.client.name','roster.judge.name','roster.judge.style','roster.judge.temperament','roster.da.name','roster.da.style','roster.da.tactic','charge.charge','charge.statutory_definition','charge.mens_rea','narrative_seeds.venue.name','narrative_seeds.venue.category','narrative_seeds.primary_evidence_anchor.item','narrative_seeds.primary_evidence_anchor.type','narrative_seeds.constitutional_flaw.flaw','narrative_seeds.constitutional_flaw.legal_basis','narrative_seeds.witness_friction.friction','narrative_seeds.client_complication.complication','mechanics.da_misconduct_trap.name','mechanics.da_misconduct_trap.legal_basis','mechanics.jury_verdict_guide.pivot','mechanics.jury_verdict_guide.acquittal_test'];
    for (const path of paths) {
      const value = path.split('.').reduce((v, k) => v?.[k], record.seed);
      if (typeof value !== 'string' || !value.trim()) return 'The saved intake is missing ' + path + '.';
    }
    if (!Number.isInteger(record.seed.meta.complexity) || record.seed.meta.complexity < 1 || record.seed.meta.complexity > 5) return 'The saved intake has an invalid complexity.';
    for (const field of ['caseTitle','crimeSummary','unencryptedTruth']) if (typeof record.scout[field] !== 'string' || !record.scout[field].trim()) return 'The saved intake is missing ' + field + '.';
    if (!Array.isArray(record.scout.starterExhibits) || record.scout.starterExhibits.length !== 2) return 'The saved intake needs two starter exhibits.';
    try {
      record.scout.starterExhibits.forEach(exhibit);
      const ids = record.scout.starterExhibits.map(e => e.id || e.tag);
      if (new Set(ids).size !== ids.length) return 'Starter exhibit identifiers must be unique.';
    } catch (error) { return error.message; }
    return '';
  }
  function emptyState(previous = {}) {
    return {hasActiveCase:false,caseId:null,intakeComplete:false,profile:{title:'',client:'',judge:'',da:''},phase:'Phase 1: Intake',turn:1,ap:4,strikes:0,maxStrikes:3,notes:'',transcript:[],docket:[],facts:[],difficulty:'Normal',complexity:3,category:'Random Case File',selectedModel:typeof previous.selectedModel==='string'?previous.selectedModel:'gemini-3.8-flash',activeCaseSeed:null,trashedFacts:[],hiddenFacts:[],exhibitNotes:{},hasSeenTrashWarning:previous.hasSeenTrashWarning===true};
  }
  function invalid(message) { const error = new Error(message); error.name = 'ResponseValidationError'; throw error; }
  function history(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(e => object(e) && ['user','model'].includes(e.role) && Array.isArray(e.parts) && e.parts.length && e.parts.every(p => object(p) && typeof p.text === 'string'))
      .map(e => ({role:e.role, parts:e.parts.map(p => ({text:p.text}))}));
  }
  function exhibit(value) {
    if (!object(value)) invalid('An exhibit must be an object.');
    const id = value.id || value.tag;
    if (typeof id !== 'string' || !id.trim() || id.length > 120 || !safeKey(id)) invalid('An exhibit has an invalid identifier.');
    for (const field of ['id','tag','name','title','type','status','facts','details','description','foundation']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') invalid('Invalid exhibit field: ' + field);
    }
    const result = {};
    for (const [key,val] of Object.entries(value)) if(safeKey(key)) result[key]=val;
    return result;
  }
  function normalize(saved, defaults) {
    const result = clone(defaults);
    if (!object(saved)) return result;
    for (const key of ['hasActiveCase','hasSeenTrashWarning','intakeComplete']) if(typeof saved[key]==='boolean') result[key]=saved[key];
    if(typeof saved.caseId==='string') result.caseId=saved.caseId;
    if(Number.isSafeInteger(saved.revision)&&saved.revision>=0)result.revision=saved.revision;
    for (const key of ['phase','notes','difficulty','category','selectedModel']) if(typeof saved[key]==='string') result[key]=saved[key];
    for (const key of ['turn','ap','strikes','maxStrikes','complexity']) if(Number.isSafeInteger(saved[key]) && saved[key]>=0) result[key]=saved[key];
    if (object(saved.profile)) for(const key of ['title','client','judge','da']) if(typeof saved.profile[key]==='string') result.profile[key]=saved.profile[key];
    for (const key of ['facts','trashedFacts','hiddenFacts']) result[key]=Array.isArray(saved[key])?saved[key].filter(v=>typeof v==='string'):[];
    result.transcript=Array.isArray(saved.transcript)?saved.transcript.filter(e=>object(e)&&typeof e.text==='string').map(e=>({sender:typeof e.sender==='string'?e.sender:'Court record',text:e.text,isUser:e.isUser===true})):[];
    result.docket=[];
    if(Array.isArray(saved.docket)) for(const e of saved.docket) { try{result.docket.push(exhibit(e));}catch(_){} }
    result.exhibitNotes=Object.fromEntries(object(saved.exhibitNotes)?Object.entries(saved.exhibitNotes).filter(([k,v])=>safeKey(k)&&typeof v==='string'):[]);
    if(object(saved.activeCaseSeed)&&!seedError(saved.activeCaseSeed)) result.activeCaseSeed=saved.activeCaseSeed;
    return result;
  }
  function needsRecovery(saved) {
    if(!object(saved))return true;
    for(const key of ['hasActiveCase','hasSeenTrashWarning','intakeComplete'])if(saved[key]!==undefined&&typeof saved[key]!=='boolean')return true;
    for(const key of ['phase','notes','difficulty','category','selectedModel'])if(saved[key]!==undefined&&typeof saved[key]!=='string')return true;
    for(const key of ['turn','ap','strikes','maxStrikes','complexity'])if(saved[key]!==undefined&&(!Number.isSafeInteger(saved[key])||saved[key]<0))return true;
    if(saved.profile!==undefined){if(!object(saved.profile))return true;for(const key of ['title','client','judge','da'])if(saved.profile[key]!==undefined&&typeof saved.profile[key]!=='string')return true;}
    for(const key of ['facts','trashedFacts','hiddenFacts'])if(saved[key]!==undefined&&(!Array.isArray(saved[key])||saved[key].some(v=>typeof v!=='string')))return true;
    if(saved.docket!==undefined){if(!Array.isArray(saved.docket))return true;try{saved.docket.forEach(exhibit);}catch(_){return true;}}
    if(saved.transcript!==undefined&&(!Array.isArray(saved.transcript)||saved.transcript.some(e=>!object(e)||typeof e.text!=='string')))return true;
    if(saved.exhibitNotes!==undefined&&(!object(saved.exhibitNotes)||Object.entries(saved.exhibitNotes).some(([k,v])=>!safeKey(k)||typeof v!=='string')))return true;
    if(saved.activeCaseSeed!=null && seedError(saved.activeCaseSeed))return true;
    return false;
  }
  function parse(raw) {
    if(typeof raw!=='string'||!raw.trim()) invalid('The server returned an empty or invalid reply.');
    const blocks=[...raw.matchAll(/<!--STATE_CHECKPOINT:\s*([\s\S]*?)-->/g)];
    if(blocks.length>1) invalid('The reply contains multiple state checkpoints.');
    if(raw.includes('<!--STATE_CHECKPOINT:')&&!blocks.length) invalid('The state checkpoint is incomplete.');
    let update=null;
    if(blocks.length) {try{update=JSON.parse(blocks[0][1]);}catch(_){invalid('The state checkpoint is not valid JSON.');}if(!object(update))invalid('The state checkpoint must be an object.');}
    return {text:raw.replace(/<!--[\s\S]*?-->/g,'').trim(), update};
  }
  function validateInitialization(state, raw) {
    if (!parse(raw).update) invalid('Setup response is missing its state checkpoint. Retry setup.');
    if (['title','client','judge','da'].some(key=>placeholder(state.profile[key])) || state.docket.length < 2)
      invalid('Setup response did not initialize the roster and two starter exhibits. Retry setup.');
  }
  function next(current, raw, channel='court') {
    const parsed=parse(raw), next=clone(current), u=parsed.update;
    if(!u || !current.hasActiveCase) { if(channel==='court'&&current.hasActiveCase)next.turn++;return {state:next,text:parsed.text}; }
    for(const key of ['turn','ap','strikes']) if(u[key]!==undefined) {
      if(!Number.isSafeInteger(u[key])||u[key]<0) invalid('Invalid checkpoint '+key+'.');
      if(channel==='court'||key==='ap')next[key]=u[key];
    }
    for(const key of ['phase','caseTitle','clientName','judge','da']) if(u[key]!==undefined&&typeof u[key]!=='string')invalid('Invalid checkpoint '+key+'.');
    if(u.case!==undefined) { if(!object(u.case))invalid('Invalid checkpoint case.');for(const key of ['title','client'])if(u.case[key]!==undefined&&typeof u.case[key]!=='string')invalid('Invalid case '+key+'.'); }
    if(u.facts!==undefined) {if(!Array.isArray(u.facts)||u.facts.some(f=>typeof f!=='string'))invalid('Checkpoint facts must be a list of text.');next.facts=channel==='diaz'?[...new Set([...next.facts,...u.facts])]:u.facts;}
    if(u.docket!==undefined) {
      if(!Array.isArray(u.docket))invalid('Checkpoint docket must be a list.');
      const incoming=u.docket.map(e=>({...exhibit(e),isApi:true}));
      const ids=incoming.map(e=>e.id||e.tag);if(new Set(ids).size!==ids.length)invalid('Duplicate exhibit identifiers.');
      if(channel==='diaz') {
        // A private report is incremental; do not erase prior court exhibits.
        const merged=new Map(next.docket.map(e=>[e.id||e.tag,e]));
        for(const e of incoming){const old=merged.get(e.id||e.tag);merged.set(e.id||e.tag,{...old,...e,status:old?.status||'Marked'});}
        next.docket=[...merged.values()];
      } else next.docket=[...incoming,...next.docket.filter(e=>e.isManual&&!ids.includes(e.id||e.tag))];
    }
    if(channel==='diaz') {
      if(next.ap>current.ap||current.ap-next.ap>2)invalid('An investigation cannot increase AP or spend more than 2 AP.');
      next.turn=current.turn+1;
    } else {
      if(u.phase!==undefined)next.phase=u.phase;
      if(u.case?.title!==undefined||u.caseTitle!==undefined)next.profile.title=u.caseTitle??u.case.title;
      if(u.case?.client!==undefined||u.clientName!==undefined)next.profile.client=u.clientName??u.case.client;
      for(const key of ['judge','da'])if(u[key]!==undefined)next.profile[key]=u[key];
    }
    return {state:next,text:parsed.text};
  }
  return {object,clone,history,normalize,needsRecovery,next,parse,exhibit,placeholder,intakeStatus,seedError,emptyState,validateInitialization};
})();
