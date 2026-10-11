/* standard.js — consolidated source sections; existing behavior retained. */
// BEGIN SOURCE: game-state.js
/* File name: game-state.js */
/* Pure validation: rejected replies never mutate the current case. */
const RYCState = (() => {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key);
  const placeholder = value => typeof value !== 'string' || !value.trim() || /^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim());
  const occupations = Object.freeze({
    civilian: 'Civilian',
    police: 'Police officer',
    expert: 'Expert'
  });
  const validOccupation = value => typeof value === 'string' && Object.prototype.hasOwnProperty.call(occupations, value);
  // Null means a legacy case still needs classification, not a fourth occupation.
  const occupation = value => validOccupation(value) ? value : null;
  const recordOccupation = record => occupation(record?.seed?.roster?.client?.occupation) ?? occupation(record?.scout?.clientOccupation);
  const clientOccupation = state => occupation(state?.activeCaseSeed?.seed?.roster?.client?.occupation) ?? occupation(state?.profile?.clientOccupation) ?? recordOccupation(state?.activeCaseSeed);
  const occupationLabel = value => validOccupation(value) ? occupations[value] : 'Not yet classified';
  function repairOccupationRecord(record, fallback = null) {
    if (!object(record)) return record;
    const repaired = clone(record);
    const role = occupation(repaired.seed?.roster?.client?.occupation) ?? occupation(fallback) ?? occupation(repaired.scout?.clientOccupation);
    if (object(repaired.seed?.roster?.client)) {
      if (role) repaired.seed.roster.client.occupation = role;else delete repaired.seed.roster.client.occupation;
    }
    if (object(repaired.scout)) {
      if (role) repaired.scout.clientOccupation = role;else delete repaired.scout.clientOccupation;
    }
    return repaired;
  }
  function intakeStatus(state) {
    if (!state?.hasActiveCase) return 'none';
    if (['title', 'client', 'judge', 'da'].some(key => placeholder(state.profile?.[key]))) return 'incomplete';
    if (typeof state.intakeComplete === 'boolean') return state.intakeComplete ? 'ready' : 'incomplete';
    // Legacy saves have no explicit marker. Player messages alone never prove initialization.
    return Array.isArray(state.transcript) && state.transcript.some(e => object(e) && e.isUser !== true && typeof e.text === 'string' && e.text.trim()) ? 'ready' : 'incomplete';
  }
  function seedError(record) {
    if (record?.extreme?.version === 1) {
      const e = record.extreme,
        s = e.snapshot;
      if (typeof e.caseId !== 'string' || typeof e.token !== 'string' || e.token.length < 32 || !object(s) || s.caseId !== e.caseId || !Number.isSafeInteger(s.serverRevision) || s.serverRevision < 1 || !Array.isArray(s.docket) || s.docket.length < 4 || !Array.isArray(s.witnesses) || s.witnesses.length !== 6 || !object(record.seed) || !object(record.scout)) return 'The Extreme case is missing its access token or public case record.';
      return '';
    }
    if (!object(record?.seed) || !object(record?.scout)) return 'The saved intake is missing its case seed or scout record.';
    const seeded = record.seed.roster?.client?.occupation,
      scouted = record.scout.clientOccupation;
    if (seeded !== undefined && !validOccupation(seeded) || scouted !== undefined && !validOccupation(scouted)) return 'The saved intake has an invalid client occupation.';
    if (seeded !== undefined && scouted !== undefined && seeded !== scouted) return 'The saved intake has conflicting client occupations.';
    const paths = ['meta.genre_key', 'roster.client.name', 'roster.judge.name', 'roster.judge.style', 'roster.judge.temperament', 'roster.da.name', 'roster.da.style', 'roster.da.tactic', 'charge.charge', 'charge.statutory_definition', 'charge.mens_rea', 'narrative_seeds.venue.name', 'narrative_seeds.venue.category', 'narrative_seeds.primary_evidence_anchor.item', 'narrative_seeds.primary_evidence_anchor.type', 'narrative_seeds.constitutional_flaw.flaw', 'narrative_seeds.constitutional_flaw.legal_basis', 'narrative_seeds.witness_friction.friction', 'narrative_seeds.client_complication.complication', 'mechanics.da_misconduct_trap.name', 'mechanics.da_misconduct_trap.legal_basis', 'mechanics.jury_verdict_guide.pivot', 'mechanics.jury_verdict_guide.acquittal_test'];
    for (const path of paths) {
      const value = path.split('.').reduce((v, k) => v?.[k], record.seed);
      if (typeof value !== 'string' || !value.trim()) return 'The saved intake is missing ' + path + '.';
    }
    if (!Number.isInteger(record.seed.meta.complexity) || record.seed.meta.complexity < 1 || record.seed.meta.complexity > 5) return 'The saved intake has an invalid complexity.';
    for (const field of ['caseTitle', 'crimeSummary', 'unencryptedTruth']) if (typeof record.scout[field] !== 'string' || !record.scout[field].trim()) return 'The saved intake is missing ' + field + '.';
    if (!Array.isArray(record.scout.starterExhibits) || record.scout.starterExhibits.length !== 2) return 'The saved intake needs two starter exhibits.';
    try {
      record.scout.starterExhibits.forEach(exhibit);
      const ids = record.scout.starterExhibits.map(e => e.id || e.tag);
      if (new Set(ids).size !== ids.length) return 'Starter exhibit identifiers must be unique.';
    } catch (error) {
      return error.message;
    }
    return '';
  }
  // Versioned budgets are fixed at intake. Existing saves retain their AP.
  const AP_VERSION = 2;
  function apBudget(difficulty = 'Normal', complexity = 3) {
    const level = Math.max(1, Math.min(5, Number(complexity) || 3));
    const base = 4 + 2 * Math.round(level);
    return difficulty === 'Sandbox' ? 1000000 : Math.ceil(base * (difficulty === 'Easy' ? 1.5 : difficulty === 'Hard' ? 0.75 : 1));
  }
  const apLabel = state => state.difficulty === 'Sandbox' ? 'Unlimited' : String(state.ap);
  const apGrantLimit = state => apBudget('Normal', state.complexity);
  function apContext(state) {
    return `AP policy v2: difficulty=${state.difficulty}; complexity=${state.complexity}; currentAP=${state.ap}; initialAP=${state.initialAP ?? apBudget(state.difficulty, state.complexity)}; phase=${state.phase}; trialEnded=${state.trialEnded === true}; grantedAP=${state.apGrantsTotal || 0}; grantLimit=${apGrantLimit(state)}; awardedDevelopments=${JSON.stringify(state.apGrants || [])}. Keep numeric AP in checkpoints, including Sandbox. Never reset AP at phase changes. Only court can grant 2 AP for a genuinely new trial lead using apGrant:{id,reason,fact} or apGrant:{id,reason,exhibitId}. Reference a NEW exact fact or NEW exhibit ID included in the same checkpoint. Reuse stable IDs for the same development; previously awarded references cannot receive another grant. Checkpoint ap must equal currentAP + eligible grant - completed costs (0 to 2). Sandbox uses numeric deductions but all player-facing AP labels say Unlimited.`;
  }
  function emptyState(previous = {}) {
    return {
      hasActiveCase: false,
      caseId: null,
      intakeComplete: false,
      profile: {
        title: '',
        client: '',
        judge: '',
        da: '',
        clientOccupation: 'civilian'
      },
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
      selectedModel: typeof previous.selectedModel === 'string' ? previous.selectedModel : 'gemini-3.8-flash',
      activeCaseSeed: null,
      trashedFacts: [],
      hiddenFacts: [],
      exhibitNotes: {},
      hasSeenTrashWarning: previous.hasSeenTrashWarning === true
    };
  }
  function invalid(message) {
    const error = new Error(message);
    error.name = 'ResponseValidationError';
    throw error;
  }
  function history(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(e => object(e) && ['user', 'model'].includes(e.role) && Array.isArray(e.parts) && e.parts.length && e.parts.every(p => object(p) && typeof p.text === 'string')).map(e => ({
      role: e.role,
      parts: e.parts.map(p => ({
        text: p.text
      }))
    }));
  }
  function exhibit(value) {
    if (!object(value)) invalid('An exhibit must be an object.');
    const id = value.id || value.tag;
    if (typeof id !== 'string' || !id.trim() || id.length > 120 || !safeKey(id)) invalid('An exhibit has an invalid identifier.');
    for (const field of ['id', 'tag', 'name', 'title', 'type', 'status', 'facts', 'details', 'description', 'foundation']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') invalid('Invalid exhibit field: ' + field);
    }
    const result = {};
    for (const [key, val] of Object.entries(value)) if (safeKey(key)) result[key] = val;
    return result;
  }
  function normalize(saved, defaults) {
    const result = clone(defaults);
    if (!object(saved)) return result;
    for (const key of ['hasActiveCase', 'hasSeenTrashWarning', 'intakeComplete', 'trialEnded']) if (typeof saved[key] === 'boolean') result[key] = saved[key];
    if (typeof saved.caseId === 'string') result.caseId = saved.caseId;
    if (Number.isSafeInteger(saved.revision) && saved.revision >= 0) result.revision = saved.revision;
    for (const key of ['phase', 'notes', 'difficulty', 'category', 'selectedModel']) if (typeof saved[key] === 'string') result[key] = saved[key];
    for (const key of ['turn', 'ap', 'strikes', 'maxStrikes', 'complexity']) if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) result[key] = saved[key];
    result.apVersion = saved.apVersion === AP_VERSION ? AP_VERSION : 1;
    result.initialAP = Number.isSafeInteger(saved.initialAP) && saved.initialAP >= 0 ? saved.initialAP : null;
    result.apGrants = Array.isArray(saved.apGrants) ? saved.apGrants.filter(g => object(g) && typeof g.id === 'string' && typeof g.reference === 'string' && typeof g.reason === 'string' && g.amount === 2).map(g => ({
      id: g.id,
      reference: g.reference,
      reason: g.reason,
      amount: 2
    })) : [];
    result.apGrantsTotal = result.apGrants.length * 2;
    if (object(saved.profile)) for (const key of ['title', 'client', 'judge', 'da']) if (typeof saved.profile[key] === 'string') result.profile[key] = saved.profile[key];
    for (const key of ['facts', 'trashedFacts', 'hiddenFacts']) result[key] = Array.isArray(saved[key]) ? saved[key].filter(v => typeof v === 'string') : [];
    result.knownWitnesses = Array.isArray(saved.knownWitnesses) ? [...new Set(saved.knownWitnesses.filter(v => typeof v === 'string' && v.trim() && v.length <= 100 && !/[<>\r\n]/.test(v)).map(v => v.trim()))] : [];
    result.transcript = Array.isArray(saved.transcript) ? saved.transcript.filter(e => object(e) && typeof e.text === 'string').map(e => ({
      sender: typeof e.sender === 'string' ? e.sender : 'Court record',
      text: e.text,
      isUser: e.isUser === true
    })) : [];
    result.docket = [];
    if (Array.isArray(saved.docket)) for (const e of saved.docket) {
      try {
        result.docket.push(exhibit(e));
      } catch (_) {}
    }
    result.exhibitNotes = Object.fromEntries(object(saved.exhibitNotes) ? Object.entries(saved.exhibitNotes).filter(([k, v]) => safeKey(k) && typeof v === 'string') : []);
    if (object(saved.extreme) && saved.extreme.version === 1 && typeof saved.extreme.caseId === 'string' && typeof saved.extreme.token === 'string' && object(saved.extreme.snapshot)) result.extreme = clone(saved.extreme);
    const repairedRecord = repairOccupationRecord(saved.activeCaseSeed, saved.profile?.clientOccupation);
    if (object(repairedRecord) && !seedError(repairedRecord)) result.activeCaseSeed = repairedRecord;
    result.profile.clientOccupation = occupation(result.activeCaseSeed?.seed?.roster?.client?.occupation) ?? occupation(saved.profile?.clientOccupation) ?? recordOccupation(result.activeCaseSeed);
    if (!result.hasActiveCase && result.profile.clientOccupation === null) result.profile.clientOccupation = 'civilian';
    return result;
  }
  function needsRecovery(saved) {
    if (!object(saved)) return true;
    for (const key of ['hasActiveCase', 'hasSeenTrashWarning', 'intakeComplete']) if (saved[key] !== undefined && typeof saved[key] !== 'boolean') return true;
    for (const key of ['phase', 'notes', 'difficulty', 'category', 'selectedModel']) if (saved[key] !== undefined && typeof saved[key] !== 'string') return true;
    for (const key of ['turn', 'ap', 'strikes', 'maxStrikes', 'complexity']) if (saved[key] !== undefined && (!Number.isSafeInteger(saved[key]) || saved[key] < 0)) return true;
    if (saved.profile !== undefined) {
      if (!object(saved.profile)) return true;
      for (const key of ['title', 'client', 'judge', 'da']) if (saved.profile[key] !== undefined && typeof saved.profile[key] !== 'string') return true;
    }
    for (const key of ['facts', 'trashedFacts', 'hiddenFacts']) if (saved[key] !== undefined && (!Array.isArray(saved[key]) || saved[key].some(v => typeof v !== 'string'))) return true;
    if (saved.docket !== undefined) {
      if (!Array.isArray(saved.docket)) return true;
      try {
        saved.docket.forEach(exhibit);
      } catch (_) {
        return true;
      }
    }
    if (saved.transcript !== undefined && (!Array.isArray(saved.transcript) || saved.transcript.some(e => !object(e) || typeof e.text !== 'string'))) return true;
    if (saved.exhibitNotes !== undefined && (!object(saved.exhibitNotes) || Object.entries(saved.exhibitNotes).some(([k, v]) => !safeKey(k) || typeof v !== 'string'))) return true;
    if (saved.activeCaseSeed != null && seedError(saved.activeCaseSeed)) return true;
    if (saved.profile?.clientOccupation !== undefined && saved.profile.clientOccupation !== null && !validOccupation(saved.profile.clientOccupation)) return true;
    const seededRole = recordOccupation(saved.activeCaseSeed);
    if (seededRole && validOccupation(saved.profile?.clientOccupation) && seededRole !== saved.profile.clientOccupation) return true;
    return false;
  }
  function parse(raw) {
    if (typeof raw !== 'string' || !raw.trim()) invalid('The server returned an empty or invalid reply.');
    const blocks = [...raw.matchAll(/<!--STATE_CHECKPOINT:\s*([\s\S]*?)-->/g)];
    if (blocks.length > 1) invalid('The reply contains multiple state checkpoints.');
    if (raw.includes('<!--STATE_CHECKPOINT:') && !blocks.length) invalid('The state checkpoint is incomplete.');
    let update = null;
    if (blocks.length) {
      try {
        update = JSON.parse(blocks[0][1]);
      } catch (_) {
        invalid('The state checkpoint is not valid JSON.');
      }
      if (!object(update)) invalid('The state checkpoint must be an object.');
    }
    return {
      text: raw.replace(/<!--[\s\S]*?-->/g, '').trim(),
      update
    };
  }
  function validateInitialization(state, raw) {
    if (!parse(raw).update) invalid('Setup response is missing its state checkpoint. Retry setup.');
    if (['title', 'client', 'judge', 'da'].some(key => placeholder(state.profile[key])) || state.docket.length < 2) invalid('Setup response did not initialize the roster and two starter exhibits. Retry setup.');
  }
  function next(current, raw, channel = 'court', options = {}) {
    const parsed = parse(raw),
      next = clone(current),
      u = parsed.update;
    if (!u || !current.hasActiveCase) {
      if (channel === 'court' && current.hasActiveCase) next.turn++;
      return {
        state: next,
        text: parsed.text
      };
    }
    if (channel === 'partner') invalid('Consultations cannot update case resources.');
    let grant = 0;
    if (u.apGrant !== undefined) {
      const g = u.apGrant,
        phase = u.phase ?? current.phase;
      if (channel !== 'court' || !/^Phase 3(?:\.5)?(?:\b|:)/i.test(String(phase)) || current.trialEnded || u.trialEnded === true) invalid('AP grants require a new court development during trial.');
      if (!object(g) || typeof g.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(g.id) || typeof g.reason !== 'string' || !g.reason.trim() || g.reason.length > 500) invalid('Invalid AP development identifier or reason.');
      if (typeof g.fact === 'string' === (typeof g.exhibitId === 'string')) invalid('An AP development must reference one new fact or exhibit.');
      const reference = typeof g.fact === 'string' ? 'fact:' + g.fact.trim().toLowerCase() : 'exhibit:' + g.exhibitId.trim().toLowerCase();
      const awarded = current.apGrants || [];
      const duplicate = awarded.some(a => a.id === g.id || a.reference === reference);
      if (!duplicate) {
        const newFact = typeof g.fact === 'string' && g.fact.trim() && Array.isArray(u.facts) && u.facts.includes(g.fact) && !(current.facts || []).some(f => f.trim().toLowerCase() === g.fact.trim().toLowerCase());
        const newExhibit = typeof g.exhibitId === 'string' && Array.isArray(u.docket) && u.docket.some(e => object(e) && (e.id || e.tag) === g.exhibitId) && !(current.docket || []).some(e => String(e.id || e.tag).trim().toLowerCase() === g.exhibitId.trim().toLowerCase());
        if (!newFact && !newExhibit) invalid('AP grants must reference newly disclosed evidence or a fact.');
        if (awarded.length * 2 + 2 > apGrantLimit(current)) invalid('The case has reached its trial development AP allowance.');
        grant = 2;
        next.apGrants = [...awarded, {
          id: g.id,
          reference,
          reason: g.reason.trim(),
          amount: 2
        }];
        next.apGrantsTotal = next.apGrants.length * 2;
      }
    }
    if (u.ap === undefined && grant) next.ap = current.ap + grant;
    if (u.trialEnded !== undefined) {
      if (typeof u.trialEnded !== 'boolean') invalid('Invalid checkpoint trialEnded.');
      if (channel === 'court') next.trialEnded = u.trialEnded;
    }
    const lockedRole = clientOccupation(current);
    const reportedRoles = [u.clientOccupation, u.case?.clientOccupation].filter(value => value !== undefined);
    for (const value of reportedRoles) {
      if (!validOccupation(value) || lockedRole && value !== lockedRole) invalid('Checkpoint cannot change the client occupation.');
    }
    if (new Set(reportedRoles).size > 1) invalid('Checkpoint has conflicting client occupations.');
    // Only the court can classify an unresolved legacy client, once.
    next.profile.clientOccupation = lockedRole ?? (channel === 'court' ? reportedRoles[0] ?? null : null);
    if (next.profile.clientOccupation && object(next.activeCaseSeed)) next.activeCaseSeed = repairOccupationRecord(next.activeCaseSeed, next.profile.clientOccupation);
    for (const key of ['turn', 'ap', 'strikes']) if (u[key] !== undefined) {
      if (!Number.isSafeInteger(u[key]) || u[key] < 0) invalid('Invalid checkpoint ' + key + '.');
      if (channel === 'court' || key === 'ap') next[key] = u[key];
    }
    for (const key of ['phase', 'caseTitle', 'clientName', 'judge', 'da']) if (u[key] !== undefined && typeof u[key] !== 'string') invalid('Invalid checkpoint ' + key + '.');
    if (u.case !== undefined) {
      if (!object(u.case)) invalid('Invalid checkpoint case.');
      for (const key of ['title', 'client']) if (u.case[key] !== undefined && typeof u.case[key] !== 'string') invalid('Invalid case ' + key + '.');
    }
    if (u.facts !== undefined) {
      if (!Array.isArray(u.facts) || u.facts.some(f => typeof f !== 'string')) invalid('Checkpoint facts must be a list of text.');
      next.facts = channel === 'diaz' ? [...new Set([...next.facts, ...u.facts])] : u.facts;
    }
    if (u.docket !== undefined) {
      if (!Array.isArray(u.docket)) invalid('Checkpoint docket must be a list.');
      const incoming = u.docket.map(e => ({
        ...exhibit(e),
        isApi: true
      }));
      const ids = incoming.map(e => e.id || e.tag);
      if (new Set(ids).size !== ids.length) invalid('Duplicate exhibit identifiers.');
      if (channel === 'diaz') {
        // A private report is incremental; do not erase prior court exhibits.
        const merged = new Map(next.docket.map(e => [e.id || e.tag, e]));
        for (const e of incoming) {
          const old = merged.get(e.id || e.tag);
          merged.set(e.id || e.tag, {
            ...old,
            ...e,
            status: old?.status || 'Marked'
          });
        }
        next.docket = [...merged.values()];
      } else next.docket = [...incoming, ...next.docket.filter(e => e.isManual && !ids.includes(e.id || e.tag))];
    }
    // No model-driven refills; an explicit undo may refund a single action.
    const undoRefund = channel === 'court' && options.undo === true && current.difficulty !== 'Hard' && !grant ? 2 : 0;
    if (channel === 'court' && next.ap > current.ap + grant + undoRefund) invalid('AP cannot increase without an eligible trial development.');
    if (channel === 'court' && current.ap + grant - next.ap > 2) invalid('A reply cannot spend more than 2 AP.');
    if (grant && (next.ap > current.ap + grant || next.ap < current.ap + grant - 2)) invalid('Incorrect AP total for the trial development.');
    if (channel === 'diaz') {
      if (next.ap > current.ap || current.ap - next.ap > 2) invalid('An investigation cannot increase AP or spend more than 2 AP.');
      next.turn = current.turn + 1;
    } else {
      if (u.phase !== undefined) next.phase = u.phase;
      if (u.case?.title !== undefined || u.caseTitle !== undefined) next.profile.title = u.caseTitle ?? u.case.title;
      if (u.case?.client !== undefined || u.clientName !== undefined) next.profile.client = u.clientName ?? u.case.client;
      for (const key of ['judge', 'da']) if (u[key] !== undefined) next.profile[key] = u[key];
    }
    return {
      state: next,
      text: parsed.text
    };
  }
  return {
    AP_VERSION,
    apBudget,
    apLabel,
    apContext,
    apGrantLimit,
    occupations,
    validOccupation,
    occupation,
    recordOccupation,
    clientOccupation,
    occupationLabel,
    repairOccupationRecord,
    object,
    clone,
    history,
    normalize,
    needsRecovery,
    next,
    parse,
    exhibit,
    placeholder,
    intakeStatus,
    seedError,
    emptyState,
    validateInitialization
  };
})();
// END SOURCE: game-state.js

// BEGIN SOURCE: ryc-dialogue.js
/* File name: ryc-dialogue.js — dialogue extraction; generated text is never HTML. */
const RYCDialogue = (() => {
  const roles = new Set(['client', 'judge', 'prosecutor', 'da', 'witness', 'investigator', 'partner', 'court', 'defense', 'clerk', 'narrator']);
  const instruction = 'Return spoken content as <DIALOGUE><SPEAKER name="Full name" role="client|judge|prosecutor|witness|investigator|partner|court|defense|clerk|narrator">Spoken text</SPEAKER></DIALOGUE>. Use the actual speaker name, without a role suffix in name. Put HUD, roster, evidence lists, notes and STATE_CHECKPOINT outside DIALOGUE. Do not put metadata or sealed truth inside spoken text. Escape &, <, > and quotes as XML entities where needed. Preserve the existing single-actor rule; the parser can also read multiple speakers when the game rules permit them. Every court/assistant reply needs nonempty dialogue; Scout generation stays JSON only. On an actual final verdict set trialEnded:true in STATE_CHECKPOINT; closing arguments alone do not end the trial.';
  const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi, m => {
    const known = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'"
    };
    if (known[m.toLowerCase()]) return known[m.toLowerCase()];
    const n = m[2].toLowerCase() === 'x' ? parseInt(m.slice(3, -1), 16) : parseInt(m.slice(2, -1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '�';
  });
  function clean(raw, cutAppendix = true) {
    const text = String(raw ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/={3,}\s*SEALED CASE GROUND TRUTH\s*={3,}[\s\S]*?(?:={3,}|$)/gi, '').replace(/<SEALED_TRUTH\b[^>]*>[\s\S]*?<\/SEALED_TRUTH>/gi, '').replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g, '').replace(/^\s*`?\[(?:STATE|ROSTER|DOCKET):[^\n]*$/gmi, '');
    return (cutAppendix ? text.replace(/^\s*(?:#{1,6}\s*)?(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|SEALED (?:TRUTH|RECORD)|GROUND TRUTH|APPENDIX|METADATA)\b[^\n]*[\s\S]*$/im, '') : text).trim();
  }
  function fail(message) {
    const e = new Error(message);
    e.name = 'ResponseValidationError';
    e.code = 'DIALOGUE_FORMAT_ERROR';
    throw e;
  }
  function parse(raw, {
    strict = false,
    fallback = 'Court record'
  } = {}) {
    raw = String(raw ?? '');
    const blocks = [...raw.matchAll(/<DIALOGUE\s*>([\s\S]*?)<\/DIALOGUE\s*>/gi)];
    const hinted = /<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw);
    if (blocks.length !== 1) {
      if (strict || hinted) fail('Reply must contain one complete DIALOGUE block. No case update was applied.');
      return legacy(raw, fallback);
    }
    if (/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw.replace(blocks[0][0], '').replace(/<!--[\s\S]*?-->/g, ''))) fail('Reply contains stray dialogue tags outside its complete block.');
    const body = blocks[0][1],
      speakers = [...body.matchAll(/<SPEAKER\s+([^>]+)>([\s\S]*?)<\/SPEAKER\s*>/gi)];
    if (!speakers.length || body.replace(/<SPEAKER\s+[^>]+>[\s\S]*?<\/SPEAKER\s*>/gi, '').trim()) fail('Dialogue contains missing or malformed speaker tags.');
    return speakers.map(s => {
      const attrs = [...s[1].matchAll(/(name|role)\s*=\s*("([^"]*)"|'([^']*)')/gi)];
      if (attrs.length !== 2 || new Set(attrs.map(a => a[1].toLowerCase())).size !== 2 || s[1].replace(/(name|role)\s*=\s*("[^"]*"|'[^']*')/gi, '').trim()) fail('Each speaker needs only a name and role.');
      const values = Object.fromEntries(attrs.map(a => [a[1].toLowerCase(), decode(a[3] ?? a[4])]));
      const name = values.name.replace(/\s*\[[^\]]{1,50}\]\s*$/, '').trim(),
        role = values.role.toLowerCase().trim();
      if (!name || name.length > 120 || /[\r\n]/.test(name) || !roles.has(role)) fail('Speaker name or role is invalid.');
      if (/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(s[2])) fail('Nested dialogue tags are invalid.');
      const text = clean(decode(s[2]));
      if (!text) fail('Speaker dialogue is empty.');
      return {
        name,
        role: role === 'da' ? 'prosecutor' : role,
        text
      };
    });
  }
  function legacy(raw, fallback) {
    const text = clean(raw, false);
    if (!text) return [];
    const messages = [];
    let speaker = {
        name: fallback,
        role: 'court'
      },
      lines = [],
      metadata = false;
    const flush = () => {
      const body = lines.join('\n').trim();
      if (body) messages.push({
        ...speaker,
        text: body
      });
      lines = [];
    };
    for (const line of text.split('\n')) {
      const unmarked = line.replace(/\*\*/g, '').replace(/^#{1,3}\s+/, '').trim();
      if (/^(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|APPENDIX|METADATA|CASE TITLE|TITLE|CHARGE|SEALED (?:TRUTH|RECORD)|GROUND TRUTH)\b/i.test(unmarked)) {
        metadata = true;
        continue;
      }
      const match = unmarked.match(/^\[?(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)\s+([^\]:]+)\]?\s*:?\s*(.*)$/i) || unmarked.match(/^([^:]{1,120}?)\s*\[(Client|Witness|Judge|Prosecutor|Investigator|Partner)\]\s*:\s*(.*)$/i);
      const plain = unmarked.match(/^([^:]{1,100}?)\s*:\s*(.+)$/);
      if (match) {
        flush();
        metadata = false;
        const roleFirst = /^(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)$/i.test(match[1]);
        let role = (roleFirst ? match[1] : match[2]).toLowerCase();
        role = role === 'ada' ? 'prosecutor' : role === 'senior partner' ? 'partner' : role;
        speaker = {
          name: (roleFirst ? match[2] : match[1]).trim().replace(/^\((.+)\)$/, '$1'),
          role
        };
        if (match[3]) lines.push(match[3]);
      } else if (plain && !metadata && !/^(?:phase|turn|ap|strikes|exhibit|case|charge|difficulty|complexity|engine|mode|notes?)\b/i.test(plain[1])) {
        flush();
        speaker = {
          name: plain[1].replace(/\s*\(witness\)$/i, '').trim(),
          role: /\(witness\)/i.test(plain[1]) ? 'witness' : 'court'
        };
        lines.push(plain[2]);
      } else if (!metadata && !/^\s*(?:\|.*\||`{3}|[-=]{3,}|\s*(?:phase|turn|ap|strikes|undos|resources|status|facts|exhibits|engine|complexity|difficulty|mode)\s*:)/i.test(line)) lines.push(line);
    }
    flush();
    return messages;
  }
  const ended = state => state?.trialEnded === true || /^(?:trial ended|completed|case closed|concluded)$/i.test(state?.phase || '');
  return {
    parse,
    clean,
    instruction,
    ended
  };
})();
if (typeof window !== 'undefined') window.RYCDialogue = RYCDialogue;
// END SOURCE: ryc-dialogue.js

// BEGIN SOURCE: game-scene.js
/* File name: game-scene.js — labeled room controls and recipient routing. */
window.RYCScene = (() => {
  const rooms = {
    court: {
      title: 'Courtroom',
      image: 'Court',
      recipient: 'court',
      hint: 'Address the bench, examine a witness, or challenge the prosecution.'
    },
    office: {
      title: 'Your office',
      image: 'Office',
      recipient: 'court',
      hint: 'Review your case and prepare your next move. Writing notes does not send a message.'
    },
    diaz: {
      title: 'Investigator Diaz',
      image: 'Diaz',
      recipient: 'diaz',
      hint: 'Private investigation channel. The existing engine controls investigation costs.'
    },
    partner: {
      title: 'Senior partner',
      image: 'Partner',
      recipient: 'partner',
      hint: 'Private legal strategy channel. Consultations cost 0 AP.'
    },
    da: {
      title: 'DA’s office',
      image: 'DA',
      recipient: 'da',
      hint: 'Discuss an offer or request disclosure from the prosecutor.'
    },
    intake: {
      title: 'Client interview',
      image: 'Intake',
      recipient: 'client',
      hint: 'Speak to your client and review their statement.'
    }
  };
  let ready = false,
    current = 'intake',
    recipient = 'client',
    lastTrigger,
    openKind = '';
  let roomTimer,
    sequence = 0;
  const drafts = new Map();
  const counts = {
    court: 0,
    partner: 0,
    diaz: 0
  };
  const unread = new Set();
  const byId = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const channel = () => current === 'partner' || current === 'diaz' ? current : 'court';
  const state = () => appState;
  const profile = () => state().profile || {};
  function displayName(key) {
    if (key.startsWith('witness:')) return key.slice(8) + ' (witness)';
    const name = value => typeof value === 'string' && value.trim() && !/^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim()) ? value : null;
    return {
      court: 'The court',
      judge: name(profile().judge) || 'Judge',
      witness: 'Witness',
      client: name(profile().client) || 'Your client',
      da: name(profile().da) || 'Prosecutor',
      partner: 'Senior partner',
      diaz: 'Investigator Diaz'
    }[key];
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
    const publicEntries = [...(state().transcript || []), ...diazHistory.filter(e => e.role === 'model').map(e => ({
      text: e.parts?.[0]?.text || ''
    }))];
    for (const entry of publicEntries) {
      if (entry.isUser) continue;
      try {
        for (const message of RYCDialogue.parse(entry.text)) if (message.role === 'witness') add(message.name);
      } catch (_) {}
      for (const line of plain(entry.text).split('\n')) {
        const clean = line.replace(/[*#\[\]]/g, '').trim();
        const match = clean.match(/^(.{1,100}?)\s*\(witness\)\s*:/i) || clean.match(/^witness\s*\(([^)]+)\)\s*:/i) || clean.match(/^(?:state(?:'s)?|defense|prosecution)?\s*witness\s*[-–:]\s*([^:]{1,100}):/i) || clean.match(/^(?:state(?:'s)?|defense|prosecution)?\s*witness\s+([^:]{1,100}):/i) || clean.match(/^(?:state(?:'s)?|defense|prosecution)\s+witness\s*:\s*([^:]{1,100})$/i);
        if (match) add(match[1]);
      }
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }
  function refreshRecipients() {
    const select = byId('scene-recipient');
    const options = ['court', 'judge', 'client', 'da', 'partner', 'diaz'].map(key => [key, displayName(key)]);
    options.push(['witness', 'Choose a witness…']);
    const witnesses = knownWitnesses();
    witnesses.forEach(name => options.push(['witness:' + name, name + ' (witness)']));
    if (recipient.startsWith('witness:') && !witnesses.includes(recipient.slice(8))) options.push([recipient, displayName(recipient)]);
    select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    select.value = recipient;
    const picker = byId('witness-select');
    picker.replaceChildren(new Option('Select a known witness', ''), ...witnesses.map(name => new Option(name + ' (witness)', name)));
    picker.value = recipient.startsWith('witness:') ? recipient.slice(8) : '';
    byId('witness-status').textContent = witnesses.length ? 'Choose anyone from either side, or enter another known witness’s name.' : 'Enter a witness’s name from your case to address them.';
  }
  function openWitnessPicker() {
    byId('witness-picker').hidden = false;
    refreshRecipients();
    byId(knownWitnesses().length ? 'witness-select' : 'witness-name').focus();
    byId('witness-picker').scrollIntoView({
      block: 'nearest'
    });
  }
  async function addWitness() {
    const input = byId('witness-name'),
      name = input.value.trim();
    const status = byId('witness-status');
    if (!name || name.length > 100 || /[\r\n<>]/.test(name)) {
      status.textContent = 'Enter a name between 1 and 100 characters.';
      return;
    }
    if (!state().hasActiveCase || caseConflict) {
      status.textContent = 'Open an active case first.';
      return;
    }
    const save = byId('witness-add');
    save.disabled = true;
    try {
      await commitCase(next => {
        next.knownWitnesses = [...new Set([...(next.knownWitnesses || []), name])];
        return next;
      });
      input.value = '';
      selectRecipient('witness:' + name);
    } catch (error) {
      status.textContent = String(error.message || error);
    } finally {
      save.disabled = false;
    }
  }
  function rememberDraft() {
    const ch = channel();
    drafts.set(ch, byId(ch === 'court' ? 'court-user-input' : 'assistant-input').value);
  }
  function selectRoom(id, keepRecipient = false) {
    if (!rooms[id] || !ready) return;
    rememberDraft();
    current = id;
    byId('witness-picker').hidden = true;
    if (!keepRecipient) recipient = rooms[id].recipient;
    activeAssistantTab = id === 'diaz' ? 'diaz' : 'partner';
    try {
      localStorage.setItem('ryc_visual_room', current);
    } catch (_) {}
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
    document.querySelectorAll('button[data-room]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.room === id));
    });
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
      renderObjects();
      fitScene();
      scene.classList.remove('scene-changing');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120);
    renderActions();
    refresh();
  }
  function fitScene() {
    const camera = byId('scene-camera'),
      img = byId('scene-background'),
      plane = byId('scene-plane');
    if (!plane || !img.naturalWidth || !camera.clientWidth) return;
    const scale = Math.min(camera.clientWidth / img.naturalWidth, camera.clientHeight / img.naturalHeight);
    const width = img.naturalWidth * scale,
      height = img.naturalHeight * scale;
    plane.style.width = width + 'px';
    plane.style.height = height + 'px';
    plane.style.left = (camera.clientWidth - width) / 2 + 'px';
    plane.style.top = (camera.clientHeight - height) / 2 + 'px';
  }
  function selectRecipient(value) {
    if (value === 'witness') {
      openWitnessPicker();
      byId('scene-recipient').value = recipient;
      return;
    }
    const map = {
      court: 'court',
      judge: 'court',
      witness: 'court',
      client: 'intake',
      da: 'da',
      partner: 'partner',
      diaz: 'diaz'
    };
    if (value.startsWith('witness:')) map[value] = 'court';
    if (!map[value]) return;
    recipient = value;
    byId('witness-picker').hidden = true;
    selectRoom(map[value], true);
  }
  function button(label, action, className = '') {
    const el = node('button', label, className);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  // Coordinates are percentages of the complete image plane: [x,y,width,height].
  const controls = {
    court: [['Speak to judge', 'judge', [46, 35, 14, 17], [41, 47, 19, 14]], ['Speak to DA', 'da', [71, 60, 28, 19], [70, 64, 29, 13]], ['Witnesses', 'witness', [33, 44, 11, 18], [20, 55, 19, 16]], ['Investigator Diaz', 'diaz', [0, 72, 13, 17], [0, 73, 13, 8]], ['Notebook', 'notebook', [16, 79, 19, 17], [17, 78, 28, 10]], ['Evidence docket', 'evidence', [65, 33, 12, 25], [67, 46, 20, 18]]],
    office: [['Case board', 'board', [21, 7, 42, 44], [4, 18, 76, 28]], ['Notebook', 'notebook', [31, 79, 16, 13], [8, 70, 35, 14]], ['Case folder', 'brief', [52, 77, 19, 15], [50, 69, 39, 15]], ['Legal library', 'library', [85, 12, 14, 66], [92, 6, 8, 47]]],
    diaz: [['Clues board', 'board', [4, 6, 40, 50], [0, 16, 65, 38]], ['Reports', 'reports', [8, 68, 60, 29], [3, 68, 76, 19]]],
    partner: [['Speak to partner', 'partner', [40, 40, 19, 31], [27, 50, 40, 22]], ['Advice notes', 'advice', [24, 33, 16, 36], [3, 51, 23, 20]]],
    da: [['Speak to DA', 'da', [39, 45, 18, 29], [30, 52, 36, 20]], ['DA overview', 'da-overview', [5, 75, 17, 17], [0, 72, 18, 10]], ['Offers & disclosure', 'offers', [57, 76, 15, 14], [58, 74, 31, 10]]],
    intake: [['Speak to client', 'client', [38, 35, 17, 20], [41, 59, 37, 14]], ['Client statement', 'statement', [76, 42, 23, 13], [79, 59, 20, 13]]]
  };
  function controlAction(kind) {
    if (['judge', 'da', 'client', 'partner', 'diaz'].includes(kind)) selectRecipient(kind);else if (kind === 'witness') openWitnessPicker();else if (kind === 'library') location.href = 'library.html';else openDocument(kind);
  }
  function hotspot([label, kind, wide, portrait]) {
    const el = button('', () => controlAction(kind), 'scene-hotspot');
    el.append(node('span', label));
    el.setAttribute('aria-label', label);
    el.dataset.kind = kind;
    for (const [prefix, values] of [['desktop', wide], ['portrait', portrait]]) for (const [index, key] of ['x', 'y', 'w', 'h'].entries()) el.style.setProperty(`--${prefix}-${key}`, values[index] + '%');
    return el;
  }
  function renderObjects() {
    byId('scene-objects').replaceChildren(...controls[current].map(hotspot));
  }
  function renderActions() {
    const group = byId('scene-actions');
    group.replaceChildren();
    const items = {
      court: [['Object', event => {
        recipient = 'judge';
        byId('scene-recipient').value = 'judge';
        toggleObjectionMenu(event);
        refresh();
      }], ['Present evidence', () => openDocument('evidence')], ['Recap', () => quickAction('/recap')]],
      office: [['Notebook', () => openDocument('notebook')], ['Case folder', () => openDocument('brief')], ['Defense board', () => openDocument('board')]],
      diaz: [['Reports', () => openDocument('reports')], ['Clues board', () => openDocument('board')]],
      partner: [['Advice notes', () => openDocument('advice')], ['Legal library', () => {
        location.href = 'library.html';
      }]],
      da: [['Offers & disclosure', () => openDocument('offers')], ['Case folder', () => openDocument('brief')]],
      intake: [['Client statement', () => openDocument('statement')], ['Evidence', () => openDocument('evidence')]]
    };
    items[current].forEach(([label, action]) => group.append(button(label, action)));
    const extras = controls[current].filter(([label]) => !items[current].some(([existing]) => existing === label));
    extras.forEach(([label, kind]) => group.append(button(label, () => controlAction(kind))));
  }
  async function submitCourt() {
    const input = byId('court-user-input');
    const text = input.value.trim();
    if (!text || engineLocked || caseConflict || RYCState.intakeStatus(state()) !== 'ready') return;
    const targets = {
      judge: displayName('judge'),
      client: displayName('client'),
      da: displayName('da')
    };
    const target = recipient.startsWith('witness:') ? displayName(recipient) : targets[recipient];
    const prompt = !text.startsWith('/') && target ? `To ${target}: ${text}` : text;
    input.value = '';
    drafts.set('court', '');
    byId('autocomplete-menu').classList.add('hidden');
    const ok = await sendCourtAction(prompt, false);
    if (!ok && !input.value) {
      input.value = text;
      drafts.set('court', text);
      saveDraft();
    }
    return ok;
  }
  async function submitAssistant() {
    const input = byId('assistant-input');
    const text = input.value.trim();
    if (!text || engineLocked || caseConflict || RYCState.intakeStatus(state()) !== 'ready') return;
    activeAssistantTab = channel() === 'diaz' ? 'diaz' : 'partner';
    const ch = channel();
    input.value = '';
    drafts.set(ch, '');
    const ok = await sendAssistantAction(text);
    if (!ok) {
      drafts.set(ch, text);
      if (channel() === ch && !input.value) input.value = text;
    }
    return ok;
  }
  function plain(text) {
    return String(text ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\*\*(.*?)\*\*/gs, '$1').replace(/^#{1,3}\s+/gm, '').replace(/={5,}\s*SEALED CASE GROUND TRUTH\s*={5,}[\s\S]*?(?:={5,}|$)/gi, '[Sealed case record withheld]').replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g, '[Sealed record withheld]');
  }
  function appendMessage(feed, sender, text, user, last) {
    if (!user) {
      let messages;
      try {
        messages = RYCDialogue.parse(text, {
          fallback: sender
        });
      } catch (error) {
        messages = [{
          name: 'Formatting error',
          text: 'This saved reply could not be read as dialogue.'
        }];
      }
      for (const message of messages) appendDialogue(feed, message.name, message.text, false, last);
      return;
    }
    appendDialogue(feed, sender, text, true, last);
  }
  function appendDialogue(feed, sender, text, user, last) {
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
    const feed = byId('transcript-feed');
    feed.replaceChildren();
    const entries = Array.isArray(state().transcript) ? state().transcript : [];
    if (!entries.length) feed.append(node('p', state().hasActiveCase ? 'Your case is ready. Begin with your client or review the file.' : 'Choose a case to begin your defense.', 'feed-empty'));
    entries.forEach((e, i) => appendMessage(feed, e.sender || 'Court record', e.text, e.isUser, i === entries.length - 1));
    renderRequestError('court');
    updated('court', entries.length);
    feed.scrollTop = feed.scrollHeight;
  }
  function renderAssistantFeeds() {
    for (const ch of ['partner', 'diaz']) {
      const feed = byId(ch + '-feed');
      feed.replaceChildren();
      const entries = ch === 'partner' ? partnerHistory : diazHistory;
      if (!entries.length) feed.append(node('p', ch === 'partner' ? 'Your senior partner is available for a private consultation.' : 'Ask Diaz to examine a lead or review the known evidence.', 'feed-empty'));
      entries.forEach((e, i) => appendMessage(feed, e.role === 'user' ? 'Defense counsel' : displayName(ch), (e.parts?.[0]?.text || '').replace(/^\[(?:SENIOR PARTNER|INVESTIGATOR) CONSULTATION\]:\s*/, ''), e.role === 'user', i === entries.length - 1));
      renderRequestError(ch);
      updated(ch, entries.length);
      feed.scrollTop = feed.scrollHeight;
    }
  }
  function refresh() {
    if (!ready) return;
    const active = !!state().hasActiveCase;
    byId('scene-case-title').textContent = /^(?:assigning case[.\s…]*|TBD)$/i.test(profile().title || '') ? state().activeCaseSeed?.scout?.caseTitle || 'Case setup incomplete' : profile().title || (active ? 'Active case' : 'No active case');
    const incomplete = RYCState.intakeStatus(state()) === 'incomplete';
    const locked = engineLocked || caseConflict;
    byId('intake-recovery').hidden = !(incomplete && !locked);
    const request = pendingRequests.court;
    byId('intake-recovery').querySelector('button').textContent = request && (request.isInit || /^\/start(?:\s|$)/i.test(request.prompt.trim())) ? 'Retry case setup' : 'Finish case setup';
    byId('purge-case-btn').hidden = !active;
    byId('case-resolution-btn').hidden = !RYCDialogue.ended(state());
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
    const request = pendingRequests[ch];
    if (!request?.error) return;
    const feed = byId(ch === 'court' ? 'transcript-feed' : ch + '-feed');
    feed.querySelectorAll('.request-error').forEach(el => el.remove());
    const card = node('article', null, 'request-error');
    card.setAttribute('role', 'alert');
    card.append(node('h3', 'Action not completed'), node('p', request.error));
    const details = node('details');
    details.append(node('summary', 'Show error'), node('pre', request.error));
    card.append(details, button('Retry', () => {
      if (engineLocked || caseConflict) return;
      selectRoom(ch === 'court' ? 'court' : ch);
      if (ch === 'court') sendCourtAction(request.prompt, request.isInit, true);else {
        activeAssistantTab = ch;
        sendAssistantAction(request.prompt, true);
      }
    }));
    feed.append(card);
  }
  function errorAlert(rawError, prompt, ch, isInit = false) {
    pendingRequests[ch] = {
      ...pendingRequests[ch],
      prompt,
      isInit,
      error: String(rawError)
    };
    renderRequestError(ch);
    if (channel() !== ch) unread.add(ch);
    refresh();
  }
  function requestProgress(progress) {
    const text = progress ? `${progress.slow ? 'Taking longer than usual…' : 'Waiting for a reply…'} ${progress.elapsed}s / 60s` : '';
    for (const id of ['request-progress', 'loading-request-status']) {
      const el = byId(id);
      if (el) {
        el.textContent = text;
        el.hidden = !progress;
      }
    }
  }
  function closeDocument(nextFocus) {
    // Choose the destination before close: native close events run asynchronously.
    lastTrigger = nextFocus || lastTrigger;
    byId('scene-document').close();
  }
  function documentText(parent, title, value) {
    parent.append(node('h3', title), node('p', value));
  }
  function knownFacts() {
    return (Array.isArray(state().facts) ? state().facts : []).filter(f => !(state().trashedFacts || []).includes(hashFact(f)) && !(state().hiddenFacts || []).includes(hashFact(f)));
  }
  function fillDocument(kind) {
    const body = byId('document-body');
    body.replaceChildren();
    const labels = {
      brief: 'Case brief',
      evidence: 'Evidence docket',
      board: current === 'diaz' ? 'Clues board' : 'Defense board',
      reports: 'Investigation reports',
      advice: 'Partner’s advice notes',
      offers: 'Offers & disclosure',
      statement: 'Client statement',
      'da-overview': 'DA overview',
      resolution: 'Case resolution'
    };
    byId('scene-document-title').textContent = labels[kind] || 'Case document';
    byId('scene-document').dataset.paper = {
      board: 'board',
      evidence: 'exhibit',
      reports: 'report',
      advice: 'advice',
      offers: 'offer',
      statement: 'statement'
    }[kind] || 'report';
    if (!state().hasActiveCase) {
      body.append(node('p', 'Open a case from the archive to begin.'));
      return;
    }
    if (kind === 'resolution') {
      if (!RYCDialogue.ended(state())) {
        body.append(node('p', 'The sealed record is available after the trial ends.'));
        return;
      }
      let truth = state().activeCaseSeed?.scout?.unencryptedTruth;
      if (!truth && typeof atob === 'function') for (const entry of state().transcript || []) {
        const block = entry.text?.match(/={3,}\s*SEALED CASE GROUND TRUTH\s*={3,}([\s\S]*?)={3,}/i)?.[1];
        if (!block) continue;
        const encoded = block.split('\n').map(s => s.trim()).filter(s => /^[A-Za-z0-9+/]{8,}={0,2}$/.test(s)).join('');
        if (encoded) try {
          truth = decodeURIComponent(Array.from(atob(encoded), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
          break;
        } catch (_) {}
      }
      body.append(node('h3', 'Case resolution'), node('p', truth || 'No original sealed record is available in this legacy save.'));
      return;
    } else if (kind === 'da-overview') {
      const da = state().activeCaseSeed?.seed?.roster?.da || GAME_DATA.district_attorneys.find(d => d.name === profile().da);
      documentText(body, 'Prosecutor', profile().da || 'Not yet assigned');
      if (da) for (const [key, label] of [['style', 'Style'], ['temperament', 'Temperament'], ['profile', 'Overview'], ['tactic', 'Typical tactics'], ['courtroom_behavior', 'Courtroom behavior'], ['tactical_guidance', 'Preparation guidance']]) if (da[key]) documentText(body, label, da[key]);else body.append(node('p', 'Traits are unavailable for this prosecutor.'));
    } else if (kind === 'brief') {
      documentText(body, 'Case', profile().title || 'Active case');
      for (const [key, label] of [['client', 'Client'], ['judge', 'Judge'], ['da', 'Prosecutor']]) documentText(body, label, profile()[key] || 'Not yet assigned');
      documentText(body, 'Client occupation', RYCState.occupationLabel(RYCState.clientOccupation(state())));
      documentText(body, 'Current phase', state().phase);
      documentText(body, 'Resources', `${RYCState.apLabel(state())} AP · ${state().strikes}/${state().maxStrikes} judicial strikes · Turn ${state().turn}`);
      const facts = knownFacts();
      body.append(node('h3', 'Established facts'));
      if (!facts.length) body.append(node('p', 'No facts entered yet.'));
      const list = node('ul');
      facts.forEach(f => list.append(node('li', f)));
      body.append(list);
    } else if (kind === 'evidence') {
      const dock = Array.isArray(state().docket) ? state().docket : [];
      if (!dock.length) body.append(node('p', 'No exhibits marked yet.'));
      dock.forEach((item, index) => {
        const card = node('article', null, 'document-exhibit');
        card.append(node('h3', `${item.id || item.tag || 'Exhibit'} · ${item.name || item.title || 'Untitled'}`), node('p', item.status || 'Marked', 'exhibit-status'));
        for (const key of ['type', 'facts', 'details', 'description', 'foundation']) if (item[key]) documentText(card, key.charAt(0).toUpperCase() + key.slice(1), String(item[key]));
        const label = node('label', 'Your exhibit notes');
        const notes = node('textarea');
        notes.dataset.exid = item.id || item.tag || '';
        notes.value = state().exhibitNotes?.[item.id || item.tag] || '';
        notes.setAttribute('aria-label', `Notes for ${item.id || item.tag || index}`);
        notes.addEventListener('input', () => saveExhibitNote(item.id || item.tag, notes.value));
        card.append(label, notes, button('Inspect', () => {
          closeDocument(byId('court-user-input'));
          switchTab('terminal');
          selectRoom('court');
          quickAction('/inspect ' + (item.id || item.tag || item.name));
        }));
        card.append(button('Prepare presentation', () => {
          closeDocument(byId('court-user-input'));
          switchTab('terminal');
          selectRoom('court');
          quickAction('I ask to introduce Exhibit ' + (item.id || item.tag || item.name) + '. ');
        }));
        card.append(button('Manage exhibit', () => {
          closeDocument(byId('tab-notebook'));
          switchTab('notebook');
          setTimeout(() => byId('docket-list').scrollIntoView({
            block: 'start'
          }), 0);
        }));
        body.append(card);
      });
      body.append(button('+ Manual entry', () => {
        closeDocument(null);
        lastTrigger = null;
        openAddExhibitModal();
      }));
    } else if (kind === 'board') {
      body.append(node('p', 'Established facts and your preparation notes. These notes do not create evidence.'));
      const list = node('ul', null, 'board-facts');
      knownFacts().forEach(f => list.append(node('li', f)));
      body.append(list);
      const notes = node('textarea');
      notes.value = state().notes || '';
      notes.setAttribute('aria-label', 'Defense preparation notes');
      notes.addEventListener('input', () => {
        byId('attorney-notes').value = notes.value;
        saveCaseNotes(notes.value);
      });
      body.append(notes);
    } else {
      let entries;
      if (kind === 'reports' || kind === 'advice') entries = (kind === 'reports' ? diazHistory : partnerHistory).filter(e => e.role === 'model').map(e => e.parts?.[0]?.text || '');else entries = (state().transcript || []).filter(e => !e.isUser).map(e => e.text);
      if (!entries.length) body.append(node('p', kind === 'reports' ? 'No investigation reports received yet.' : kind === 'advice' ? 'No advice recorded yet.' : 'No case conversation recorded yet.'));
      if (kind === 'offers') body.append(node('p', 'The recorded case conversation appears below. Only terms explicitly offered by the prosecutor are an offer; this view creates no new agreement.'));
      if (kind === 'statement') body.append(node('p', 'Review the recorded conversation for your client’s statements. This view does not introduce new testimony.'));
      entries.forEach(t => {
        try {
          const messages = RYCDialogue.parse(t, {
            fallback: kind === 'reports' ? 'Investigator Diaz' : kind === 'advice' ? 'Senior partner' : 'Case conversation'
          });
          messages.forEach(m => body.append(node('h3', m.name), node('div', m.text, 'document-record')));
        } catch (_) {
          body.append(node('p', 'A saved reply has an unreadable dialogue format.'));
        }
      });
    }
  }
  function openDocument(kind) {
    if (kind === 'notebook') {
      switchTab('notebook');
      byId('tab-notebook').setAttribute('tabindex', '-1');
      byId('tab-notebook').focus();
      return;
    }
    lastTrigger = document.activeElement;
    openKind = kind;
    fillDocument(kind);
    byId('scene-document').showModal();
  }
  function init() {
    ready = true;
    drafts.set('court', byId('court-user-input').value);
    document.querySelectorAll('button[data-room]').forEach(b => b.addEventListener('click', () => selectRoom(b.dataset.room)));
    byId('room-menu-toggle').addEventListener('click', () => {
      const menu = byId('room-menu');
      menu.hidden = !menu.hidden;
      byId('room-menu-toggle').setAttribute('aria-expanded', String(!menu.hidden));
    });
    byId('scene-recipient').addEventListener('change', e => selectRecipient(e.target.value));
    byId('witness-select').addEventListener('change', e => {
      if (e.target.value) selectRecipient('witness:' + e.target.value);
    });
    byId('witness-add').addEventListener('click', addWitness);
    byId('witness-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWitness();
      }
    });
    byId('witness-close').addEventListener('click', () => {
      byId('witness-picker').hidden = true;
      byId('scene-recipient').focus();
    });
    byId('history-toggle').addEventListener('click', () => {
      const on = byId('dialogue-panel').classList.toggle('show-history');
      byId('history-toggle').setAttribute('aria-pressed', String(on));
      byId('history-toggle').textContent = on ? 'Current dialogue' : 'History';
    });
    byId('document-close').addEventListener('click', () => byId('scene-document').close());
    byId('scene-document').addEventListener('close', () => {
      if (byId('scene-document').open) return;
      openKind = '';
      if (lastTrigger?.isConnected !== false) lastTrigger?.focus();
    });
    byId('scene-document').addEventListener('click', e => {
      if (e.target === byId('scene-document')) {
        const r = e.target.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        byId('witness-picker').hidden = true;
        byId('objection-menu').classList.add('hidden');
        byId('autocomplete-menu').classList.add('hidden');
        if (!byId('tab-notebook').classList.contains('hidden')) switchTab('terminal');
        byId('room-menu').hidden = true;
        byId('room-menu-toggle').setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.room-menu-wrap')) {
        byId('room-menu').hidden = true;
        byId('room-menu-toggle').setAttribute('aria-expanded', 'false');
      }
    });
    byId('scene-background').addEventListener('error', () => byId('scene-image-notice').hidden = false);
    byId('scene-background').addEventListener('load', () => {
      byId('scene-image-notice').hidden = true;
      fitScene();
    });
    window.addEventListener('resize', fitScene);
    const portraitQuery = matchMedia('(max-width:899px), (hover:none) and (pointer:coarse)');
    portraitQuery.addEventListener?.('change', fitScene);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(fitScene).observe(byId('scene-camera'));
      new ResizeObserver(() => document.documentElement.style.setProperty('--composer-height', byId('composer-controls').getBoundingClientRect().height + 'px')).observe(byId('composer-controls'));
    }
    let initial = /intake/i.test(state().phase || '') ? 'intake' : 'court';
    try {
      const saved = localStorage.getItem('ryc_visual_room');
      if (rooms[saved] && !(state().hasActiveCase && state().turn === 1 && !(state().transcript || []).length)) initial = saved;
    } catch (_) {}
    selectRoom(initial);
    renderCourtFeed();
    renderAssistantFeeds();
    const viewport = window.visualViewport;
    const fit = () => {
      if (!viewport) return;
      const focused = document.activeElement;
      const editing = focused?.tagName === 'INPUT' || focused?.tagName === 'TEXTAREA';
      const full = Math.max(document.documentElement.clientHeight || 0, window.innerHeight);
      document.body.classList.toggle('keyboard-open', editing && full - viewport.height > 120);
      document.documentElement.style.setProperty('--visible-height', viewport.height + 'px');
      document.documentElement.style.setProperty('--keyboard-offset', Math.max(0, window.innerHeight - viewport.height - (viewport.offsetTop || 0)) + 'px');
    };
    viewport?.addEventListener('resize', fit);
    document.addEventListener('focusin', fit);
    document.addEventListener('focusout', () => setTimeout(fit, 0));
    window.addEventListener('resize', fit);
    fit();
    fitScene();
  }
  return {
    get ready() {
      return ready;
    },
    get recipient() {
      return recipient;
    },
    init,
    refresh,
    selectRoom,
    selectRecipient,
    submitCourt,
    submitAssistant,
    renderCourtFeed,
    renderAssistantFeeds,
    openDocument,
    errorAlert,
    knownWitnesses,
    controls,
    requestProgress
  };
})();
// END SOURCE: game-scene.js
