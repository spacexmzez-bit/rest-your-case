/* extreme-server.js — consolidated source sections; existing behavior retained. */
import { validateBlueprint, copy, fail, canonical, phaseName, prosecutionAgenda, availableLeads, modelFor, validateBrief, budget, publicSnapshot, xmlSpeech, validateRequest, id, shape, RETENTION, registry, visible, event, exchange, officialEvents } from "./extreme-rules.js";
import catalog from './extreme-data.v1.json' with { type: 'json' };
import { modelJSON, buildPacket, validateActor, reviewConsequential, ACTOR_SCHEMA_V2, actorPromptV2, BLUEPRINT_SCHEMA, BRIEF_SCHEMA, GENERATE_PROMPT, MATERIALIZE_PROMPT, memoryStatus, refreshMemory, freezeReview, stepReview } from './extreme-ai.js';

// BEGIN SOURCE: extreme-db.js
/* File name: extreme-db.js — synchronous SQLite transactions and paged immutable sources. */
export const DDL = `CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,operation_id TEXT NOT NULL,kind TEXT NOT NULL,actor_id TEXT,recipient_id TEXT,visibility TEXT NOT NULL,sworn INTEGER NOT NULL DEFAULT 0,reverted INTEGER NOT NULL DEFAULT 0,json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_actor ON events(actor_id,seq);
CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,status TEXT NOT NULL,base_revision INTEGER NOT NULL,response_json TEXT,input_json TEXT,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memories(actor_id TEXT NOT NULL,scope TEXT NOT NULL,version INTEGER NOT NULL,through_seq INTEGER NOT NULL,generation INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(actor_id,scope));
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,generation INTEGER NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_usage(id TEXT PRIMARY KEY,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,created_revision INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL);`;
export class CaseDB {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec(DDL);
  }
  rows(q, ...p) {
    return Array.from(this.sql.exec(q, ...p));
  }
  get(k) {
    const r = this.rows('SELECT json FROM meta WHERE key=?', k)[0];
    return r ? JSON.parse(r.json) : null;
  }
  set(k, v) {
    this.sql.exec('INSERT OR REPLACE INTO meta(key,json) VALUES(?,?)', k, JSON.stringify(v));
  }
  tx(fn) {
    return this.storage.transactionSync(fn);
  }
  state() {
    const s = this.get('caseState');
    if (!s) return null;
    return {
      ...s,
      blueprint: this.get('blueprint'),
      publicHistory: [],
      testimony: []
    };
  }
  save(s) {
    const {
      blueprint,
      publicHistory,
      testimony,
      testimonyIds,
      ...state
    } = s;
    this.set('caseState', state);
    if (blueprint && !this.get('blueprint')) this.set('blueprint', blueprint);
  }
  append(e) {
    this.sql.exec('INSERT INTO events(seq,event_id,operation_id,kind,actor_id,recipient_id,visibility,sworn,reverted,json) VALUES(?,?,?,?,?,?,?,?,0,?)', e.seq, e.id, e.operationId, e.kind, e.actorId, e.recipientId, e.visibility, e.sworn ? 1 : 0, JSON.stringify(e));
  }
  page(after = 0, limit = 50) {
    return this.rows('SELECT json FROM events WHERE seq>? AND reverted=0 ORDER BY seq LIMIT ?', after, limit).map(r => JSON.parse(r.json));
  }
  event(id) {
    const r = this.rows('SELECT json FROM events WHERE event_id=? AND reverted=0', id)[0];
    return r ? JSON.parse(r.json) : null;
  }
  recent(n = 8) {
    return this.rows('SELECT json FROM events WHERE reverted=0 ORDER BY seq DESC LIMIT ?', n).reverse().map(r => JSON.parse(r.json));
  }
  operation(id) {
    const r = this.rows('SELECT * FROM operations WHERE id=?', id)[0];
    return r ? {
      ...r,
      response: r.response_json ? JSON.parse(r.response_json) : null,
      input: r.input_json ? JSON.parse(r.input_json) : null
    } : null;
  }
  op(id, hash, status, revision, input, response = null) {
    this.sql.exec('INSERT OR REPLACE INTO operations VALUES(?,?,?,?,?,?,?)', id, hash, status, revision, response ? JSON.stringify(response) : null, input ? JSON.stringify(input) : null, Date.now());
  }
  job(j) {
    this.sql.exec('INSERT OR REPLACE INTO jobs VALUES(?,?,?,?,?)', j.id, j.kind, j.status, j.generation, JSON.stringify(j));
  }
  getJob(id) {
    const r = this.rows('SELECT json FROM jobs WHERE id=?', id)[0];
    return r ? JSON.parse(r.json) : null;
  }
  clear() {
    for (const table of ['events', 'operations', 'memories', 'jobs', 'proposals', 'model_usage', 'meta']) this.sql.exec('DELETE FROM ' + table);
  }
}
// END SOURCE: extreme-db.js

// BEGIN SOURCE: extreme-migration.js
export async function migrateLegacy(db, storage) {
  if (db.get('tombstone') || db.get('schemaVersion') === 2) return;
  const old = await storage.get('case');
  if (!old) return;
  if (!old.blueprint || !old.brief) {
    db.tx(() => {
      db.save({
        ...old,
        generation: 1,
        lastSeq: 0,
        schemaVersion: 2,
        revision: old.revision || 0
      });
      db.set('schemaVersion', 2);
    });
    return;
  }
  validateBlueprint(old.blueprint, old.pattern, [old.judge.name, old.prosecutor.name]);
  const entries = [...(old.publicHistory || []), ...(old.testimony || [])];
  for (const id of old.testimonyIds || []) {
    const t = await storage.get('testimony:' + id);
    if (!t) fail('INCOMPLETE_LEGACY_RECORD', 'A saved testimony row is missing; migration was not committed.', 503);
    entries.push(t);
  }
  const dedup = new Map(entries.map(e => [e.operationId, e]));
  const s = {
    ...copy(old),
    schemaVersion: 2,
    generation: 1,
    lastSeq: 0,
    foundations: {},
    migrationWarning: 'Some older non-sworn events may have been trimmed by the previous version. Surviving originals were preserved; no testimony was invented.'
  };
  const ops = await storage.list({
    prefix: 'op:'
  });
  db.tx(() => {
    for (const h of [...dedup.values()].sort((a, b) => a.turn - b.turn)) {
      const actor = canonical(h.actorId),
        pub = h.sworn === true || h.channel === 'court' && ['JUDGE', 'PROSECUTOR'].includes(actor),
        visibility = pub ? 'PUBLIC_COURT' : actor === 'CLIENT' || /^W\d/.test(actor) ? 'INTERVIEW' : 'DEFENSE_PRIVATE',
        audience = pub ? [] : ['DEFENSE', actor];
      let questionId;
      for (const [speaker, kind, text] of [['DEFENSE', 'question', h.message], [actor, 'speech', h.speech]]) if (typeof text === 'string' && text.trim()) {
        const eid = crypto.randomUUID();
        db.append({
          schemaVersion: 1,
          id: eid,
          seq: ++s.lastSeq,
          turn: h.turn,
          operationId: h.operationId,
          actorId: speaker,
          recipientId: actor,
          kind,
          text,
          language: s.language,
          visibility,
          audienceActorIds: audience,
          sworn: kind === 'speech' && h.sworn === true,
          exhibitRefs: [],
          sourceEventIds: kind === 'speech' && questionId ? [questionId] : [],
          payload: {
            legacy: true,
            ...(kind === 'question' && h.stage === 'closing' && actor === 'JUDGE' ? {
              closingArgument: true
            } : {})
          },
          generation: 1,
          createdAt: s.lastActive
        });
        if (kind === 'question') questionId = eid;
      }
    }
    db.save(s);
    db.set('schemaVersion', 2);
    db.set('migrationStatus', {
      completed: true,
      warning: s.migrationWarning
    });
    for (const [key, op] of ops) db.op(key.slice(3), op.signature, 'legacy', old.revision, null, op.response);
  });
  const check = db.state();
  if (check.ap !== old.ap || check.stage !== old.stage || check.blueprintHash !== old.blueprintHash) fail('MIGRATION_FAILED', 'Legacy state verification failed.', 503);
  // Keep legacy keys quarantined until migration is verified; then remove the live duplicate.
  await storage.delete(['case', ...Array.from(ops.keys())]);
  for (const id of old.testimonyIds || []) await storage.delete('testimony:' + id);
}
// END SOURCE: extreme-migration.js

// BEGIN SOURCE: extreme-actions.js
const phrases = {
  en: {
    advanced: 'The case has moved to ',
    completed: 'This case has ended.',
    unavailable: 'That investigation is not available yet.',
    duplicate: 'That investigation is already complete; no AP was spent.',
    lead: 'New mid-trial investigation available: A08. Its AP was included in your starting budget.',
    safety: 'A witness safety request was recorded. It does not decide credibility or guarantee testimony.'
  },
  ar: {
    advanced: 'انتقلت القضية إلى ',
    completed: 'انتهت القضية.',
    unavailable: 'هذا التحقيق غير متاح بعد.',
    duplicate: 'اكتمل هذا التحقيق سابقاً؛ لم تُخصم نقاط إضافية.',
    lead: 'ظهر التحقيق A08 أثناء المحاكمة. تكلفته محسوبة ضمن رصيدك الأساسي.',
    safety: 'سُجل طلب حماية الشاهد. لا يقرر ذلك مصداقيته ولا يضمن شهادته.'
  }
};
export class CaseActions {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }
  async action(s, body, apiKey) {
    const lang = body.language,
      b = s.blueprint,
      t = phrases[lang],
      message = body.message.trim();
    if (s.stage === 'ended') fail('CASE_ENDED', t.completed, 409);
    if (body.channel === 'partner' && /^\/(investigate|subpoena|inspect|admit|suppress|call|safety|prosecution)\b/i.test(message)) fail('CONSULTATION_ONLY', 'Use the court or Investigator Diaz for case actions. Partner advice is free.');
    if (message.length > 2400) fail('INVALID_MESSAGE', 'Message too long.');
    let role = body.channel === 'partner' ? 'partner' : body.channel === 'diaz' ? 'investigator' : 'judge';
    let actor = role === 'partner' ? {
      id: 'partner',
      name: lang === 'ar' ? 'الشريك القانوني' : 'Senior Partner'
    } : role === 'investigator' ? {
      id: 'diaz',
      name: lang === 'ar' ? 'المحقق دياز' : 'Investigator Diaz'
    } : {
      id: 'judge',
      name: s.judge.name,
      style: s.judge.style
    };
    const witness = b.witnesses.find(w => w.id === body.recipient || 'witness:' + w.name === body.recipient);
    if (body.channel === 'court') {
      if (body.recipient === 'client') {
        role = 'client';
        actor = {
          id: 'client',
          name: b.client.name
        };
      } else if (body.recipient === 'da' || body.recipient === 'prosecutor') {
        role = 'prosecutor';
        actor = {
          id: 'prosecutor',
          name: s.prosecutor.name,
          style: s.prosecutor.style
        };
      } else if (witness) {
        role = 'witness';
        actor = {
          id: witness.id,
          name: witness.name
        };
      } else if (!['court', 'judge', undefined].includes(body.recipient)) fail('UNKNOWN_ACTOR', 'Choose a witness from this case.');
    }
    let result = null,
      rulingRequest = null,
      systemMessage = message,
      forcedSpeech = null,
      prosecutionExhibit = null;
    if (/^\/prosecution\s*$/i.test(message)) {
      if (body.channel !== 'court' || s.stage !== 'trial') fail('TRIAL_REQUIRED', 'Hear the prosecution during the trial.');
      const agenda = prosecutionAgenda(s);
      if (agenda.complete) fail('PROSECUTION_COMPLETE', 'The disclosed prosecution evidence has already been presented.');
      if (agenda.witnessIds.length) {
        const w = b.witnesses.find(w => w.id === agenda.witnessIds[0]);
        s.standId = w.id;
        role = 'witness';
        actor = {
          id: w.id,
          name: w.name
        };
        systemMessage = 'The prosecution has called you to testify. Give your assigned statement and explain the source of records you can authenticate. Do not speak as counsel or another witness.';
      } else {
        const e = b.evidence.find(e => e.id === agenda.exhibitIds[0]);
        prosecutionExhibit = e.id;
        role = 'judge';
        actor = {
          id: 'judge',
          name: s.judge.name,
          style: s.judge.style
        };
        rulingRequest = {
          id: e.id,
          kind: 'admit',
          foundationReady: !!s.foundations?.[e.id],
          exclusionReady: false,
          knownIssue: ''
        };
        systemMessage = 'The prosecution requests admission of ' + e.id + ' after its source witness testimony. Rule on foundation and relevant public objections. Admit if the foundation and evidence rules permit it; otherwise explain denial. The player can subsequently challenge or move to suppress it.';
      }
    }
    const command = message.match(/^\/(investigate|subpoena|inspect|admit|suppress|call|safety)\s+([AEW]\d{2})\b/i);
    if (command) {
      const kind = command[1].toLowerCase(),
        id = command[2].toUpperCase();
      if (!['investigate', 'subpoena', 'inspect'].includes(kind) && body.channel !== 'court') fail('COURT_REQUIRED', 'Use the court for witness calls and evidence motions.');
      if (['investigate', 'subpoena'].includes(kind)) {
        const a = b.leads.find(a => a.id === id);
        if (!a) fail('UNKNOWN_LEAD', 'Use an available investigation ID such as A01.');
        if (s.completedLeads.includes(id)) {
          forcedSpeech = t.duplicate;
        } else {
          if (!availableLeads(s).some(a => a.id === id)) fail('LEAD_LOCKED', t.unavailable);
          if (s.ap < a.cost) fail('INSUFFICIENT_AP', 'Not enough AP for this investigation. Advice and trial discussion remain free.', 409);
          s.ap -= a.cost;
          s.completedLeads.push(id);
          a.evidenceIds.forEach(e => {
            if (!s.discovered.includes(e)) s.discovered.push(e);
          });
          result = {
            leadId: id,
            cost: a.cost,
            exhibits: b.evidence.filter(e => a.evidenceIds.includes(e.id)).map(({
              id,
              name,
              details,
              type
            }) => ({
              id,
              name,
              details,
              type
            }))
          };
        }
        role = 'investigator';
        actor = {
          id: 'diaz',
          name: lang === 'ar' ? 'المحقق دياز' : 'Investigator Diaz'
        };
      } else if (kind === 'inspect') {
        const e = b.evidence.find(e => e.id === id);
        if (!e || !s.discovered.includes(id)) fail('UNKNOWN_EXHIBIT', 'Inspect only an exhibit already in your case file.');
        result = {
          exhibits: [{
            id: e.id,
            name: e.name,
            details: e.details
          }],
          cost: 0
        };
        role = 'investigator';
        actor = {
          id: 'diaz',
          name: lang === 'ar' ? 'المحقق دياز' : 'Investigator Diaz'
        };
      } else if (kind === 'call') {
        if (s.stage !== 'trial') fail('TRIAL_REQUIRED', 'Begin the trial before calling a witness.');
        const w = b.witnesses.find(w => w.id === id);
        if (!w) fail('UNKNOWN_WITNESS', 'Choose one of W01–W06.');
        s.standId = id;
        role = 'witness';
        actor = {
          id: w.id,
          name: w.name
        };
        systemMessage = 'You have been called to testify. Give your assigned initial statement briefly. ' + message;
      } else if (kind === 'safety') {
        if (!b.witnesses.some(w => w.id === id)) fail('UNKNOWN_WITNESS', 'Unknown witness.');
        if (!s.safeWitnesses.includes(id)) s.safeWitnesses.push(id);
        forcedSpeech = t.safety;
        role = 'judge';
        actor = {
          id: 'judge',
          name: s.judge.name
        };
      } else {
        const e = b.evidence.find(e => e.id === id);
        if (!e || !s.discovered.includes(id)) fail('UNKNOWN_EXHIBIT', 'Use an exhibit already discovered.');
        if (!['preparation', 'trial'].includes(s.stage)) fail('WRONG_PHASE', 'Evidence motions are available in preparation or trial.');
        if (kind === 'admit' && s.evidenceStatus[id] === 'Excluded') fail('EXHIBIT_EXCLUDED', lang === 'ar' ? 'استُبعد هذا الدليل ولا يمكن إعادته بطلب قبول عادي.' : 'This exhibit was excluded and cannot be restored by an ordinary admission request.');
        role = 'judge';
        actor = {
          id: 'judge',
          name: s.judge.name,
          style: s.judge.style
        };
        rulingRequest = {
          id: e.id,
          kind,
          foundationReady: !!s.foundations?.[e.id],
          exclusionReady: !!e.legalIssue && e.excludeWithEvidenceIds.length > 0 && e.excludeWithEvidenceIds.every(id => s.discovered.includes(id)),
          knownIssue: e.excludeWithEvidenceIds.every(id => s.discovered.includes(id)) ? e.legalIssue : '',
          supportingExhibitIds: e.excludeWithEvidenceIds.filter(id => s.discovered.includes(id))
        };
      }
    } else if (/^\/(investigate|subpoena|inspect|admit|suppress|call|safety)\b/i.test(message)) fail('COMMAND_ID_REQUIRED', 'Use the ID shown on the Extreme case board, for example /investigate A01.');
    if (/^\/(prepare|trial|close|verdict)\s*$/i.test(message)) {
      if (body.channel !== 'court') fail('COURT_REQUIRED', 'Use the court for phase changes.');
      const cmd = message.slice(1).toLowerCase();
      const expected = {
        prepare: 'intake',
        trial: 'preparation',
        close: 'trial',
        verdict: 'closing'
      };
      if (s.stage !== expected[cmd]) fail('WRONG_PHASE', 'Finish the preceding stage before using this command.');
      if (cmd === 'close' && !prosecutionAgenda(s).complete) fail('PROSECUTION_PENDING', lang === 'ar' ? 'استمع إلى شهود وأدلة الادعاء أولاً. استخدم زر متابعة قضية الادعاء.' : 'Hear the prosecution witnesses and evidence first. Use Continue prosecution case.');
      if (cmd === 'close' && s.trialTurns < 3) fail('DISCOVERY_PENDING', lang === 'ar' ? 'أكمل ثلاث جولات في المحكمة حتى يظهر التحقيق المقرر أثناء المحاكمة قبل المرافعة الختامية.' : 'Complete three court turns so the planned mid-trial lead can appear before closing arguments.');
      role = 'judge';
      actor = {
        id: 'judge',
        name: s.judge.name,
        style: s.judge.style
      };
      if (cmd === 'verdict') fail('USE_VERDICT_JOB', 'Use the source review verdict control.');
      s.stage = {
        prepare: 'preparation',
        trial: 'trial',
        close: 'closing'
      }[cmd];
      s.standId = null;
      systemMessage = 'The server has advanced to ' + phaseName(s.stage) + '. Explain the next step briefly. ' + message;
    } else if (/^\/(undo|start|end|reset)\b/i.test(message)) fail('UNSUPPORTED_EXTREME_COMMAND', 'Use the Extreme case controls. Completed investigations and testimony cannot be undone.');
    if (s.stage === 'trial' && body.channel === 'court') s.trialTurns++;
    if (s.trialTurns >= 3 && !s.trialLeadAnnounced) {
      s.trialLeadAnnounced = true;
      s.publicFacts.push(t.lead);
      systemMessage += '\n' + t.lead;
    }
    const packet = buildPacket(this.db, s, role, actor, body, systemMessage, lang, result, rulingRequest);
    packet.lawCards = catalog.lawCards.filter(c => role === 'judge' || role === 'partner' || c.id === 'safety');
    if (forcedSpeech) return this.finish(s, body, actor, role, forcedSpeech, {});
    const ai = await modelJSON(apiKey, actorPromptV2(role), packet, ACTOR_SCHEMA_V2, 'actor', this.env),
      v = ai.value;
    validateActor(v, s, actor, packet, result, rulingRequest);
    if (v.ruling) {
      await reviewConsequential(apiKey, v, packet, this.env);
      if (v.ruling.decision === 'admit') s.evidenceStatus[v.ruling.exhibitId] = 'Admitted';
      if (v.ruling.decision === 'exclude') s.evidenceStatus[v.ruling.exhibitId] = 'Excluded';
    }
    if (v.foundationClaims.some(c => c.authenticates)) await reviewConsequential(apiKey, v, packet, this.env);
    if (prosecutionExhibit && !s.prosecutionPresented.includes(prosecutionExhibit)) s.prosecutionPresented.push(prosecutionExhibit);
    const expectedExhibits = result?.exhibits?.map(e => e.id) || [];
    if (!Array.isArray(v.localizedExhibits) || v.localizedExhibits.length !== expectedExhibits.length || new Set(v.localizedExhibits.map(e => e.id)).size !== expectedExhibits.length || v.localizedExhibits.some(e => !expectedExhibits.includes(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 200 || typeof e.details !== 'string' || !e.details.trim() || e.details.length > 1500)) fail('INVALID_EXHIBIT_TRANSLATION', 'Investigation result is incomplete; retry manually. No AP was spent.', 502);
    for (const e of v.localizedExhibits) s.localizedExhibits[e.id] = {
      name: e.name,
      details: e.details
    };
    return {
      ...this.finish(s, body, actor, role, v.speech, ai.usage),
      assertions: v.assertions,
      foundationClaims: v.foundationClaims,
      ruling: v.ruling,
      exhibitRefs: [...new Set(v.assertions.flatMap(x => x.sourceIds.filter(id => /^E\d/.test(id))))]
    };
  }
  finish(s, body, actor, role, speech, usage) {
    s.turn++;
    const sworn = role === 'witness' && s.stage === 'trial' && s.standId === actor.id && body.originalChannel !== 'interview';
    if (sworn && !s.heardWitnesses.includes(actor.id)) s.heardWitnesses.push(actor.id);
    const entry = {
      operationId: body.operationId,
      channel: body.channel,
      actorId: actor.id,
      name: actor.name,
      role,
      speech,
      message: body.message,
      sworn,
      stage: s.stage,
      turn: s.turn
    };
    return {
      entry,
      usage,
      activeModel: modelFor('actor', this.env)
    };
  }
}
// END SOURCE: extreme-actions.js

// BEGIN SOURCE: extreme-worker-case.js
const json = (x, status = 200) => new Response(JSON.stringify(x), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  }
});
const choose = a => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export class ExtremeCase {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = {
      ...env
    };
    this.queue = Promise.resolve();
    this.db = new CaseDB(ctx.storage);
    this.env.onModelUsage = usage => {
      this.db.sql.exec('INSERT INTO model_usage VALUES(?,?)', crypto.randomUUID(), JSON.stringify({
        ...usage,
        caseIdHash: this.contextHash,
        operationId: this.contextOperation || null,
        generation: this.db.get('caseState')?.generation || 1,
        createdAt: Date.now()
      }));
    };
  }
  fetch(request) {
    const result = this.queue.then(() => this.handle(request));
    this.queue = result.catch(() => {});
    return result;
  }
  async alarm() {
    return this.queue = this.queue.catch(() => {}).then(async () => {
      if (this.db.get('tombstone')) {
        await this.cleanupRevoked();
        return;
      }
      const s = this.db.state();
      if (s && Date.now() - s.lastActive >= RETENTION) await this.revoke(s, 'expired');else if (s) await this.schedule(s);
    });
  }
  async schedule(s) {
    try {
      await this.ctx.storage.setAlarm(s.lastActive + RETENTION);
    } catch {/* Committed receipts remain successful; access also enforces expiry. */}
  }
  snapshot(s, lang) {
    const p = publicSnapshot(s, lang);
    p.history = [];
    return {
      ...p,
      schemaVersion: 2,
      revision: s.revision,
      generation: s.generation,
      lastSeq: s.lastSeq,
      roster: registry(s),
      verdictJob: this.activeVerdict(s),
      standId: s.standId,
      foundations: s.foundations || {},
      usage: this.db.rows("SELECT count(*) AS calls,sum(CASE WHEN json_extract(json,'$.usageReported')=0 OR (json_extract(json,'$.usageReported') IS NULL AND json_extract(json,'$.errorCode') IS NOT NULL) THEN 1 ELSE 0 END) AS unknownUsageCalls,coalesce(sum(json_extract(json,'$.inputTokens')),0) AS inputTokens,coalesce(sum(json_extract(json,'$.outputTokens')),0) AS outputTokens,coalesce(sum(json_extract(json,'$.thinkingTokens')),0) AS thinkingTokens FROM model_usage")[0],
      memory: registry(s).filter(a => a.id !== 'DEFENSE').map(a => memoryStatus(this.db, s, a.id)),
      migrationWarning: s.migrationWarning || null
    };
  }
  activeVerdict(s) {
    const row = this.db.rows("SELECT json FROM jobs WHERE kind='verdict' AND status IN ('pending','reviewing','ready') ORDER BY rowid LIMIT 1")[0];
    if (!row) return null;
    const j = JSON.parse(row.json);
    return j.revision === s.revision && j.generation === s.generation ? {
      id: j.id,
      status: j.status,
      reviewed: j.batches.filter(b => b.status === 'reviewed').length,
      total: j.batches.length
    } : null;
  }
  response(s, lang, extra = {}) {
    return {
      apiVersion: 2,
      caseId: s.caseId,
      revision: s.revision,
      generation: s.generation,
      snapshot: this.snapshot(s, lang),
      activeModel: modelFor('actor', this.env),
      ...extra
    };
  }
  async revoke(s, reason, receipt = null) {
    this.db.tx(() => {
      this.db.clear();
      this.db.set('tombstone', {
        caseId: s.caseId,
        tokenHash: s.tokenHash,
        reason,
        receipt,
        cleanupPending: true,
        at: Date.now()
      });
    });
    await this.cleanupRevoked();
  }
  async cleanupRevoked() {
    const tomb = this.db.get('tombstone');
    if (!tomb) return;
    try {
      const keys = await this.ctx.storage.list();
      for (const key of keys.keys()) await this.ctx.storage.delete(key);
      if (tomb.cleanupPending) {
        tomb.cleanupPending = false;
        this.db.set('tombstone', tomb);
      }
      try {
        await this.ctx.storage.deleteAlarm();
      } catch {}
    } catch {
      try {
        await this.ctx.storage.setAlarm(Date.now() + 60000);
      } catch {} /* The denial and purge receipt are committed; retry legacy cleanup without restoring the case. */
    }
  }
  normalizeLegacy(body, s) {
    if (body.apiVersion === 2) return body;
    const b = {
      apiVersion: 2,
      op: body.op,
      caseId: body.caseId,
      language: body.language,
      operationId: body.operationId
    };
    if (body.op === 'create') return {
      ...b,
      genre: body.genre === 'random' ? 'bank' : body.genre,
      difficulty: body.difficulty,
      engineMode: body.engineMode
    };
    if (body.op === 'snapshot') {
      delete b.operationId;
      return b;
    }
    const match = (body.message || '').trim().match(/^\/(\w+)(?:\s+([AEW]\d{2}))?/i);
    const cmd = match?.[1]?.toLowerCase();
    if (cmd === 'verdict') return {
      ...b,
      op: 'verdict',
      expectedRevision: body.expectedRevision,
      expectedGeneration: s?.generation || 1
    };
    const recipient = canonical(body.recipient === 'court' ? 'judge' : body.recipient?.startsWith('witness:') ? s?.blueprint.witnesses.find(w => 'witness:' + w.name === body.recipient)?.id : body.recipient) || 'JUDGE';
    return {
      ...b,
      expectedRevision: body.expectedRevision,
      expectedGeneration: s?.generation || 1,
      channel: body.channel,
      recipientId: recipient,
      command: cmd || 'message',
      message: body.message,
      targetId: match?.[2]?.toUpperCase()
    };
  }
  async handle(request) {
    let body;
    try {
      body = await request.json();
      if (!id(body?.caseId)) fail('INVALID_CASE_ID', 'Invalid case ID.');
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!id(token) || token.length < 32) fail('CASE_ACCESS_REQUIRED', 'Saved case capability is missing.', 401);
      const hash = await digest(token);
      this.contextHash = await digest(body.caseId);
      this.contextOperation = body.operationId;
      await migrateLegacy(this.db, this.ctx.storage);
      let s = this.db.state(),
        tomb = this.db.get('tombstone');
      if (tomb) {
        if (tomb.tokenHash !== hash || tomb.caseId !== body.caseId) fail('CASE_ACCESS_DENIED', 'Case capability does not match.', 403);
        await this.cleanupRevoked();
        if (body.op === 'purge' && tomb.receipt?.operationId === body.operationId) return json(tomb.receipt);
        fail('CASE_' + tomb.reason.toUpperCase(), 'This case was permanently deleted or expired.', 410);
      }
      if (s && (s.caseId !== body.caseId || s.tokenHash !== hash)) fail('CASE_ACCESS_DENIED', 'Case capability does not match.', 403);
      if (s && Date.now() - s.lastActive > RETENTION) {
        await this.revoke(s, 'expired');
        fail('CASE_EXPIRED', 'Case expired after 90 days without activity.', 410);
      }
      const legacy = body.apiVersion !== 2,
        legacySignature = JSON.stringify([body.channel, body.recipient, body.message, body.kind || 'message']);
      if (legacy && body.engineMode !== 'smart') fail('EXTREME_REQUIRES_SMART', 'Extreme gameplay requires Smart.');
      body = this.normalizeLegacy(body, s);
      validateRequest(body);
      const key = request.headers.get('X-Custom-Gemini-Key')?.trim() || this.env.GEMINI_API_KEY?.trim();
      if (body.op === 'create') {
        let result = await this.create(body, s, hash, key);
        if (legacy && result.creationStatus === 'blueprintReady') result = await this.create(body, this.db.state(), hash, key);
        return json(result);
      }
      if (!s?.brief) fail('CASE_NOT_READY', 'Finish generating this case first.', 404);
      s.lastActive = Date.now();
      this.db.save(s);
      await this.schedule(s);
      if (body.op === 'snapshot') return json(this.response(s, body.language));
      if (['archive', 'search'].includes(body.op)) {
        const limit = Math.max(1, Math.min(Number.isSafeInteger(body.limit) ? body.limit : 50, 50)),
          events = [];
        let cursor = body.afterSeq || 0,
          more = false;
        while (events.length < limit) {
          const page = this.db.page(cursor, 50);
          if (!page.length) break;
          for (const e of page) {
            cursor = e.seq;
            const match = visible(e, 'DEFENSE') && (!body.sourceId || e.id === body.sourceId) && (!body.actorId || e.actorId === body.actorId) && (!body.exhibitId || e.exhibitRefs.includes(body.exhibitId)) && (!body.query || e.text.normalize('NFKC').toLowerCase().includes(body.query.normalize('NFKC').toLowerCase()));
            if (match) events.push(e);
            if (events.length >= limit) break;
          }
        }
        more = this.db.page(cursor, 1).length > 0;
        return json({
          apiVersion: 2,
          caseId: s.caseId,
          events,
          nextSeq: cursor,
          hasMore: more
        });
      }
      if (body.op === 'operation') {
        const op = this.db.operation(body.operationId);
        return json({
          apiVersion: 2,
          caseId: s.caseId,
          status: op?.status || 'missing',
          language: op?.input?.language || null,
          receipt: op?.response || null,
          retryAfter: op?.status === 'running' ? Math.max(0, 90000 - (Date.now() - op.updated_at)) : 0
        });
      }
      if (body.op === 'clerk') {
        if (body.scope !== 'permitted') fail('INVALID_SCOPE', 'Use permitted actor memory only.');
        const result = await refreshMemory(this.db, s, body.actorId, body.throughSeq, key, this.env);
        const job = this.db.getJob('clerk:' + body.actorId);
        if (job) {
          job.status = result.status.throughSeq >= job.throughSeq ? 'completed' : 'pending';
          this.db.job(job);
        }
        return json({
          apiVersion: 2,
          caseId: s.caseId,
          ...result
        });
      }
      if (body.op === 'continue') {
        const j = this.db.getJob(body.jobId);
        if (!j || j.kind !== 'verdict') fail('UNKNOWN_JOB', 'Review job not found.', 404);
        if (j.status === 'committed') return json(this.response(s, body.language, {
          job: {
            id: j.id,
            status: j.status
          },
          receipt: this.db.operation(j.operationId)?.response
        }));
        const result = await stepReview(this.db, s, j, key, this.env, body.language);
        if (result.verdict) {
          const current = this.db.state();
          if (current.revision !== j.revision || current.generation !== j.generation) fail('JOB_CANCELLED', 'Case record changed.', 409);
          s.verdict = result.verdict;
          s.stage = 'ended';
          s.revision++;
          s.turn++;
          s.lastActive = Date.now();
          const e = event(s, {
              ...body,
              operationId: j.operationId,
              command: 'verdict',
              recipientId: 'JUDGE'
            }, 'JUDGE', 'speech', result.verdict.speech, {
              visibility: 'PUBLIC_COURT',
              audienceActorIds: [],
              payload: {
                verdict: true
              }
            }),
            receipt = {
              operationId: j.operationId,
              events: [e],
              verdict: result.verdict
            };
          this.db.tx(() => {
            this.db.append(e);
            this.db.save(s);
            j.status = 'committed';
            this.db.job(j);
            const op = this.db.operation(j.operationId);
            this.db.op(j.operationId, op.request_hash, 'committed', j.revision, op.input, receipt);
          });
          await this.schedule(s);
        }
        return json(this.response(s, body.language, {
          job: {
            id: j.id,
            status: j.status,
            reviewed: j.batches.filter(b => b.status === 'reviewed').length,
            total: j.batches.length
          },
          usage: result.usage
        }));
      }
      if (body.op === 'purgePreview') {
        const nonce = crypto.randomUUID();
        this.db.set('purgePreview', {
          nonce,
          revision: s.revision,
          generation: s.generation,
          tokenHash: hash,
          expiresAt: Date.now() + 600000
        });
        return json({
          apiVersion: 2,
          caseId: s.caseId,
          purgeNonce: nonce,
          revision: s.revision,
          generation: s.generation,
          title: s.brief.title,
          stage: s.stage,
          turn: s.turn,
          expiresAt: Date.now() + 600000
        });
      }
      const requestHash = await digest(JSON.stringify(body)),
        prior = this.db.operation(body.operationId);
      if (prior) {
        if (prior.status === 'legacy' && legacy && prior.request_hash === legacySignature) return json(this.response(s, body.language, prior.response));
        if (prior.request_hash !== requestHash) fail('ACTION_ID_REUSED', 'Operation ID belongs to different input.', 409);
        if (prior.status === 'committed' || prior.status === 'reviewing') return json(this.response(s, body.language, {
          receipt: prior.response,
          operationId: body.operationId,
          ...(prior.response?.jobId ? {
            job: {
              id: prior.response.jobId,
              status: 'reviewing'
            }
          } : {})
        }));
        if (prior.status === 'running' && Date.now() - prior.updated_at < 90000) fail('OPERATION_RUNNING', 'Poll the saved operation before retrying.', 409);
      }
      if (body.expectedRevision !== s.revision || body.expectedGeneration !== s.generation) fail('STALE_CASE', 'Sync the case before another official action.', 409);
      if (body.op === 'purge') {
        const preview = this.db.get('purgePreview');
        if (!preview || preview.nonce !== body.purgeNonce || preview.tokenHash !== hash || preview.revision !== s.revision || preview.generation !== s.generation || preview.expiresAt < Date.now() || body.confirmedTitle !== s.brief.title) fail('PURGE_CONFIRMATION_STALE', 'Request a fresh purge preview and confirm the exact title.', 409);
        const receipt = {
          apiVersion: 2,
          caseId: s.caseId,
          operationId: body.operationId,
          deleted: true
        };
        await this.revoke(s, 'purged', receipt);
        return json(receipt);
      }
      if (body.op === 'verdict') {
        if (s.stage !== 'closing') fail('WRONG_PHASE', 'Complete closing arguments first.', 409);
        const active = this.activeVerdict(s);
        if (active) fail('VERDICT_IN_PROGRESS', 'Continue the existing verdict review after syncing.', 409);
        if (!this.db.rows("SELECT seq FROM events WHERE reverted=0 AND visibility='PUBLIC_COURT' AND actor_id='DEFENSE' AND json_extract(json,'$.payload.closingArgument')=1 LIMIT 1").length) fail('CLOSING_ARGUMENT_REQUIRED', 'Submit your closing argument to the judge before requesting a verdict.', 409);
        let j;
        this.db.tx(() => {
          j = freezeReview(this.db, s, body.operationId);
          this.db.op(body.operationId, requestHash, 'reviewing', s.revision, body, {
            jobId: j.id
          });
        });
        return json(this.response(s, body.language, {
          job: {
            id: j.id,
            status: j.status
          },
          operationId: body.operationId
        }));
      }
      if (body.op !== 'action') fail('INVALID_OPERATION', 'Unsupported operation.');
      if (this.db.rows("SELECT id FROM jobs WHERE kind='verdict' AND status IN ('pending','reviewing','ready')").length) fail('VERDICT_IN_PROGRESS', 'Finish the frozen verdict review before another action.', 409);
      this.validateChannel(body, s);
      this.db.op(body.operationId, requestHash, 'running', s.revision, body);
      try {
        const next = copy(s),
          legacyBody = {
            ...body,
            originalChannel: body.channel,
            recipient: {
              CLIENT: 'client',
              JUDGE: 'judge',
              PROSECUTOR: 'prosecutor',
              PARTNER: 'partner',
              DIAZ: 'diaz'
            }[body.recipientId] || body.recipientId,
            channel: body.channel === 'interview' ? 'court' : body.channel,
            message: body.command === 'message' ? body.message.trim() : '/' + body.command + (body.targetId ? ' ' + body.targetId : '') + (body.message && !['prepare', 'trial', 'close', 'prosecution'].includes(body.command) ? ' ' + body.message : '')
          };
        const out = await new CaseActions(this.db, this.env).action(next, legacyBody, key);
        const events = exchange(next, body, out);
        if (next.stage === 'closing' && body.command === 'message' && body.channel === 'court' && body.recipientId === 'JUDGE') events[0].payload.closingArgument = true;
        officialEvents(s, next, body, out, events);
        const current = this.db.state();
        if (current.revision !== s.revision || current.generation !== s.generation) fail('STALE_CASE', 'Case changed before commit.', 409);
        next.revision++;
        next.lastActive = Date.now();
        const receipt = {
          operationId: body.operationId,
          events,
          usage: out.usage
        };
        this.db.tx(() => {
          events.forEach(e => this.db.append(e));
          this.db.save(next);
          this.db.op(body.operationId, requestHash, 'committed', s.revision, body, receipt);
          this.db.job({
            id: 'clerk:' + canonical(out.entry.actorId),
            kind: 'clerk',
            status: 'pending',
            generation: next.generation,
            actorId: canonical(out.entry.actorId),
            throughSeq: next.lastSeq
          });
        });
        await this.schedule(next);
        return json(this.response(next, body.language, {
          ...receipt,
          receipt,
          ...(legacy ? {
            reply: xmlSpeech(out.entry.name, out.entry.role, out.entry.speech)
          } : {})
        }));
      } catch (e) {
        if (this.db.operation(body.operationId)?.status !== 'committed') this.db.op(body.operationId, requestHash, 'failed', s.revision, body, {
          error: e.code || 'ACTION_FAILED'
        });
        throw e;
      }
    } catch (e) {
      return json({
        error: e.code || 'EXTREME_ERROR',
        details: e.code ? e.message : 'Could not complete the Extreme request.',
        retryable: !e.code || [429, 500, 502, 503, 504].includes(e.status),
        operationId: body?.operationId
      }, e.status || 500);
    }
  }
  validateChannel(b, s) {
    if (b.recipientId === 'DEFENSE') fail('INVALID_ACTOR', 'Select a responding character.');
    if (b.channel === 'partner' && (b.recipientId !== 'PARTNER' || b.command !== 'message') || b.channel === 'diaz' && (b.recipientId !== 'DIAZ' || !['message', 'investigate', 'subpoena', 'inspect'].includes(b.command)) || b.channel === 'interview' && (!/^W\d/.test(b.recipientId) && b.recipientId !== 'CLIENT' || b.command !== 'message') || b.channel === 'court' && ['PARTNER', 'DIAZ'].includes(b.recipientId)) fail('INVALID_CHANNEL', 'Actor and action do not match this channel.');
    if (b.command === 'message' && /^\s*\//.test(b.message)) fail('TYPED_COMMAND_REQUIRED', 'Use a typed action for slash commands.');
    if (['prepare', 'trial', 'close', 'admit', 'suppress', 'prosecution', 'safety'].includes(b.command) && (b.channel !== 'court' || b.recipientId !== 'JUDGE')) fail('COURT_REQUIRED', 'Address official actions to the judge.');
    if (b.command === 'call' && (b.channel !== 'court' || b.recipientId !== b.targetId)) fail('WITNESS_REQUIRED', 'Select the witness being called.');
  }
  async create(b, s, tokenHash, key) {
    if (b.genre !== 'bank' || !['Sandbox', 'Easy', 'Normal', 'Hard'].includes(b.difficulty) || b.engineMode !== 'smart') fail('INVALID_INTAKE', 'Foundation generates bank cases using Smart only.');
    const signature = JSON.stringify([b.genre, b.difficulty, b.language]);
    if (s && s.creationSignature !== signature) fail('CASE_ID_REUSED', 'This case belongs to another search.', 409);
    if (s?.brief) return this.response(s, b.language);
    if (!s) {
      const genre = catalog.genres.find(g => g.id === 'bank');
      s = {
        schemaVersion: 2,
        generation: 1,
        lastSeq: 0,
        revision: 0,
        caseId: b.caseId,
        tokenHash,
        creationSignature: signature,
        genre: copy(genre),
        subgenre: choose(genre.subgenres),
        judge: choose(catalog.judges),
        prosecutor: choose(catalog.prosecutors),
        clientAttitude: choose(catalog.clientAttitudes),
        pattern: choose([{
          C01: false,
          C02: false
        }, {
          C01: true,
          C02: false
        }, {
          C01: true,
          C02: true
        }]),
        difficulty: b.difficulty,
        language: b.language,
        lastActive: Date.now()
      };
      this.db.tx(() => {
        this.db.save(s);
        this.db.set('schemaVersion', 2);
      });
      await this.schedule(s);
    }
    if (!s.blueprint) {
      const r = await modelJSON(key, GENERATE_PROMPT, {
        template: s.genre,
        subgenre: s.subgenre,
        venue: catalog.jurisdiction,
        judge: s.judge,
        prosecutor: s.prosecutor,
        clientAttitude: s.clientAttitude,
        witnessProfiles: catalog.witnessProfiles,
        lawCards: catalog.lawCards,
        responsibilityPattern: s.pattern,
        nonce: s.caseId
      }, BLUEPRINT_SCHEMA, 'generation', this.env);
      shape(r.value, BLUEPRINT_SCHEMA);
      const mechanics = validateBlueprint(r.value, s.pattern, [s.judge.name, s.prosecutor.name]);
      s.blueprint = r.value;
      s.blueprintHash = await digest(JSON.stringify(r.value));
      Object.assign(s, mechanics);
      this.db.tx(() => this.db.save(s));
      return {
        apiVersion: 2,
        caseId: s.caseId,
        creationStatus: 'blueprintReady',
        retrySameCreate: true,
        usage: r.usage
      };
    }
    const bp = s.blueprint,
      r = await modelJSON(key, MATERIALIZE_PROMPT, {
        language: b.language,
        title: bp.title,
        summary: bp.summary,
        exhibits: bp.evidence.filter(e => ['E01', 'E02', 'E03', 'E04'].includes(e.id)).sort((a, b) => a.id.localeCompare(b.id)).map(({
          id,
          name,
          details
        }) => ({
          id,
          name,
          details
        })),
        witnesses: bp.witnesses.map(({
          id,
          publicBio
        }) => ({
          id,
          bio: publicBio
        })),
        leads: bp.leads.filter(a => a.availablePhase === 'preparation').map(({
          id,
          label,
          description
        }) => ({
          id,
          label,
          description
        })),
        client: {
          name: bp.client.name,
          initialStatement: 'I dispute the accusation. I need to understand the evidence before I explain my part.'
        }
      }, BRIEF_SCHEMA, 'brief', this.env);
    shape(r.value, BRIEF_SCHEMA);
    s.brief = validateBrief(r.value, bp);
    Object.assign(s, {
      initialAP: budget(s.difficulty, s.baseAP),
      ap: budget(s.difficulty, s.baseAP),
      stage: 'intake',
      turn: 1,
      trialTurns: 0,
      strikes: 0,
      maxStrikes: ['Easy', 'Sandbox'].includes(s.difficulty) ? 4 : s.difficulty === 'Hard' ? 2 : 3,
      revision: 1,
      completedLeads: [],
      discovered: ['E01', 'E02', 'E03', 'E04'],
      evidenceStatus: {},
      localizedExhibits: {},
      heardWitnesses: [],
      prosecutionPresented: [],
      safeWitnesses: [],
      publicFacts: [],
      standId: null,
      trialLeadAnnounced: false,
      foundations: {},
      lastActive: Date.now()
    });
    const e = event(s, {
      ...b,
      command: 'message',
      recipientId: 'CLIENT'
    }, 'CLIENT', 'speech', s.brief.openingSpeech, {
      visibility: 'INTERVIEW',
      audienceActorIds: ['DEFENSE', 'CLIENT']
    });
    this.db.tx(() => {
      this.db.append(e);
      this.db.save(s);
    });
    await this.schedule(s);
    return this.response(s, b.language, {
      events: [e],
      usage: r.usage
    });
  }
}
export async function routeExtreme(request, env, cors) {
  if (!env.EXTREME_CASES) return new Response(JSON.stringify({
    error: 'EXTREME_NOT_CONFIGURED',
    details: 'Deploy the Foundation Worker first.'
  }), {
    status: 503,
    headers: {
      ...cors,
      'Content-Type': 'application/json'
    }
  });
  try {
    const reader = request.body?.getReader();
    if (!reader) fail('INVALID_JSON', 'Missing request body.');
    let size = 0,
      chunks = [];
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > 32768) {
        await reader.cancel();
        fail('PAYLOAD_TOO_LARGE', 'Request exceeds 32 KiB.', 413);
      }
      chunks.push(r.value);
    }
    const bytes = new Uint8Array(size);
    let n = 0;
    for (const c of chunks) {
      bytes.set(c, n);
      n += c.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!id(body.caseId)) fail('INVALID_CASE_ID', 'Invalid case ID.');
    if (!['create', 'action', 'verdict', 'purge'].includes(body.op) && size > 16384) fail('PAYLOAD_TOO_LARGE', 'Read request exceeds 16 KiB.', 413);
    const response = await env.EXTREME_CASES.get(env.EXTREME_CASES.idFromName(body.caseId)).fetch(new Request('https://extreme.internal/', {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body)
    }));
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e.code || 'INVALID_JSON',
      details: e.code ? e.message : 'Invalid request.',
      retryable: false
    }), {
      status: e.status || 400,
      headers: {
        ...cors,
        'Content-Type': 'application/json'
      }
    });
  }
}
// END SOURCE: extreme-worker-case.js
