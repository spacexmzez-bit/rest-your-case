/* Shared trial files (reuse these names in EVERY later trial):
 * token-core.js, token-context.js, token-runtime.js, game.js, game.html,
 * worker.js, standard-support.js, index.html, shelf.html, cases.js,
 * .github/workflows/deploy-worker.yml, tests/standard-update.test.mjs,
 * worker-cloudflare.txt.
 * Trial: mix-1-2-v1. No provider/model changes, Clerk calls or summary generation.
 * The original state/_histories remain authoritative and backward compatible.
 */
(() => {
  'use strict';
  const version = 'mix-1-2-v1';
  const clone = x => JSON.parse(JSON.stringify(x));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  function sourceId(channel,index,entry) {
    const text=JSON.stringify(entry);let hash=2166136261;
    for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return channel+':'+index+':'+(hash>>>0).toString(16)+'-'+text.length;
  }
  function preserveReplacedSources(state,previous,next) {
    const journal=state.clerkMemory?.liveRecord;if(!journal)return;
    journal.replacedSources||=[];
    for(const channel of ['court','partner','diaz'])for(let index=0;index<(previous[channel]||[]).length;index++) {
      const entry=previous[channel][index];
      if(same(entry,next[channel]?.[index]))continue;
      const id=sourceId(channel,index,entry);
      if(!journal.replacedSources.some(e=>e.id===id))journal.replacedSources.push({id,channel,entry:clone(entry),reason:'replaced or undone; historical only'});
    }
  }
  const fields = ['profile','phase','turn','ap','strikes','trialEnded','apGrants','caseOutcome'];
  // Optional metadata lives in the existing, preserved clerkMemory container.
  // This is a deterministic change journal, not an AI-generated factual summary.
  function capture(previous, next, source = {}) {
    if (!next.hasActiveCase) return next;
    const prior = previous.caseId === next.caseId ? previous : {};
    const memory = next.clerkMemory ||= {};
    const journal = clone(prior.clerkMemory?.liveRecord || {schema:1,events:[]});
    if (journal.schema !== 1 || !Array.isArray(journal.events)) throw new Error('Unsupported live-record journal; original save retained.');
    const changes = [];
    const put = (path,before,after) => { if(!same(before,after)) changes.push({path,before:before??null,after:after??null}); };
    for (const field of fields) put(field,prior[field],next[field]);
    for (const field of ['docket','offers','investigations','disclosures']) {
      const old = new Map((prior[field]||[]).map(x=>[x.id||x.tag,x]));
      const current = new Map((next[field]||[]).map(x=>[x.id||x.tag,x]));
      for (const id of new Set([...old.keys(),...current.keys()])) put(field+':'+id,old.get(id),current.get(id));
    }
    for (const field of ['facts','trashedFacts','hiddenFacts']) {
      const before=prior[field]||[],after=next[field]||[];
      for (const value of before) if(!after.includes(value)) changes.push({path:field,before:value,after:null});
      for (const value of after) if(!before.includes(value)) changes.push({path:field,before:null,after:value});
    }
    // Retain edits/deletions of player notes without promoting them to case truth.
    for (const field of ['notes','exhibitNotes']) put('private:'+field,prior[field],next[field]);
    if(changes.length) journal.events.push({id:'change:'+journal.events.length,turn:next.turn,
      revision:(prior.revision||0)+1,at:Date.now(),source:source.id||'player-or-case-update',changes});
    memory.liveRecord=journal;
    return next;
  }
  function modelRecord(state) {
    const record=RYCStandard.publicCase(state);
    record.roster=clone(state.roster||record.roster||{});
    record.allegation=state.allegation??record.allegation;
    record.docket=(record.docket||[]).map(e=>{
      const value={id:e.id||e.tag,name:e.name||e.title,type:e.type,status:e.status,
        details:e.details||e.facts||e.description||'',source:e.source,foundation:e.foundation};
      // Keep custom evidence fields, but remove identical display aliases only.
      for(const [k,v] of Object.entries(e)) {
        if(k==='isApi' || (k==='tag'&&v===value.id) || (k==='title'&&v===value.name)
          || (['facts','description'].includes(k)&&v===value.details))continue;
        if(!(k in value))value[k]=v;
      }
      if(e.isManual)value.authority='UNVERIFIED_PLAYER_ENTRY';
      return value;
    });
    record.caseOutcome=state.caseOutcome||null;
    return record;
  }
  function privateReference(state,channel) {
    if(!['court','diaz'].includes(channel))return null;
    const original=state.activeCaseSeed;
    if(!original?.scout?.unencryptedTruth)return null;
    if(channel==='diaz')return {truth:original.scout.unencryptedTruth};
    const n=original.seed?.narrative_seeds||{};
    return {truth:original.scout.unencryptedTruth,constitutionalFlaw:n.constitutional_flaw,
      witnessFriction:n.witness_friction,clientComplication:n.client_complication,mechanics:original.seed?.mechanics};
  }
  const contract = `LIVE RECORD AND SOURCE CONTRACT: The supplied current record is the current mechanical state. Old dialogue is attributed testimony, not a second state snapshot or established truth. Preserve exact source wording, uncertainty, conflicting claims and provenance. A later claim is not automatically a certified correction. Keep all mandatory response formats and gameplay rules. Checkpoints may give incremental facts/docket changes; omit unchanged evidence rather than resending it. Omission never deletes evidence. Deleted or manually edited exhibits must not be restored from older dialogue. Player-entered evidence and private notes are unverified, never independent corroboration. Use source IDs to identify supporting originals when helpful. Never reconstruct an absent quotation. Ask for clarification when a source is missing. No extra AP or discoveries from retrieval. Private engine reference is for fixed-case adjudication only: it grants no character knowledge. Only expose a finding through the existing permitted discovery/gameplay rules.`;
  globalThis.RYCTokenCore={version,capture,sourceId,preserveReplacedSources,modelRecord,privateReference,contract};
})();
