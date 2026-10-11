/* extreme-cases.js — consolidated source sections; existing behavior retained. */
// BEGIN SOURCE: extreme-store.js
/* File name: extreme-store.js — Extreme-only IndexedDB; atomic activation and durable requests. */
window.RYCExtremeStore = (() => {
  let opened;
  const request = r => new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  function open() {
    return opened ??= new Promise((ok, no) => {
      const r = indexedDB.open('ryc_extreme_v2', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const [name, keyPath] of [['cases', 'caseId'], ['events', ['caseId', 'seq']], ['meta', 'name'], ['notes', ['caseId', 'noteId']], ['drafts', ['caseId', 'channel', 'recipientId']], ['requests', ['caseId', 'operationId']], ['outbox', 'jobId']]) db.createObjectStore(name, {
          keyPath
        });
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          opened = null;
        };
        ok(r.result);
      };
      r.onerror = () => {
        opened = null;
        no(r.error);
      };
      r.onblocked = () => {
        opened = null;
        no(new Error('Close other RYC tabs to finish the storage update.'));
      };
    });
  }
  async function tx(names, mode, fn) {
    const db = await open();
    return new Promise((ok, no) => {
      const t = db.transaction(names, mode),
        s = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
      let value, error;
      Promise.resolve().then(() => fn(s, request)).then(x => value = x, e => {
        error = e;
        try {
          t.abort();
        } catch {}
      });
      t.oncomplete = () => {
        if (mode === 'readwrite') notify();
        ok(value);
      };
      t.onerror = t.onabort = () => no(error || t.error || new Error('Could not save Extreme data.'));
    });
  }
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ryc-extreme-state') : null;
  function notify() {
    channel?.postMessage({
      changed: true
    });
  }
  const get = (name, key) => tx([name], 'readonly', (s, r) => r(s[name].get(key)));
  const all = name => tx([name], 'readonly', (s, r) => r(s[name].getAll()));
  const put = (name, value) => ['notes', 'drafts', 'requests'].includes(name) ? tx([name, 'cases'], 'readwrite', async (s, r) => {
    const c = await r(s.cases.get(value.caseId));
    if (!c || c.lifecycle === 'purgePending') throw new Error('This case was deleted or is awaiting deletion.');
    return r(s[name].put(value));
  }) : tx([name], 'readwrite', (s, r) => r(s[name].put(value)));
  const remove = (name, key) => tx([name], 'readwrite', (s, r) => r(s[name].delete(key)));
  async function active() {
    const m = await get('meta', 'activeCaseId');
    return m?.value ? get('cases', m.value) : null;
  }
  async function saveSnapshot(rec, snapshot, events = []) {
    return tx(['cases', 'events'], 'readwrite', async (s, r) => {
      const old = await r(s.cases.get(rec.caseId));
      if (!old) throw new Error('This case was removed in another tab.');
      if (old.lifecycle === 'purgePending') throw new Error('This case is awaiting permanent deletion.');
      if (old.localRevision !== rec.localRevision) throw new Error('Extreme data changed in another tab. Reload before continuing.');
      if (snapshot.revision < old.snapshot.revision) throw new Error('Server response is older than this save.');
      if (snapshot.generation !== old.snapshot.generation) throw new Error('Server generation does not match this save.');
      for (const e of events) s.events.put({
        ...e,
        caseId: rec.caseId
      });
      let through = old.cacheCursorVersion === 2 || old.cacheReduced ? old.lastSyncedSeq || 0 : 0;
      while (await r(s.events.get([rec.caseId, through + 1]))) through++;
      const next = {
        ...old,
        snapshot,
        localRevision: (old.localRevision || 0) + 1,
        lastSyncedSeq: through,
        cacheCursorVersion: 2,
        lifecycle: snapshot.stage === 'ended' ? 'ended' : old.lifecycle
      };
      s.cases.put(next);
      return next;
    });
  }
  async function cacheEvents(caseId, events) {
    await tx(['events', 'cases'], 'readwrite', async (s, r) => {
      const current = await r(s.cases.get(caseId));
      if (!current || current.lifecycle === 'purgePending') throw new Error('This case was deleted or is awaiting deletion.');
      for (const e of events) s.events.put({
        ...e,
        caseId
      });
    });
  }
  async function activate(candidate, expectedId, oldJob) {
    return tx(['cases', 'meta', 'requests', 'outbox'], 'readwrite', async (s, r) => {
      const pointer = await r(s.meta.get('activeCaseId'));
      if ((pointer?.value || null) !== expectedId) throw new Error('The active Extreme case changed. Review it again.');
      const c = await r(s.cases.get(candidate.caseId));
      if (!c || c.localRevision !== candidate.localRevision || c.lifecycle === 'purgePending') throw new Error('The candidate case changed. Reload the archive.');
      if (expectedId === c.caseId) return c;
      if (expectedId) {
        const old = await r(s.cases.get(expectedId));
        if (!old || !oldJob) throw new Error('Confirm the current case deletion first.');
        if (old.lifecycle === 'purgePending' || old.snapshot.revision !== oldJob.request.expectedRevision || old.snapshot.generation !== oldJob.request.expectedGeneration) throw new Error('Current case changed after deletion confirmation. Review it again.');
        old.lifecycle = 'purgePending';
        s.cases.put(old);
        s.outbox.put(oldJob);
      }
      c.lifecycle = 'active';
      c.localRevision++;
      s.cases.put(c);
      s.meta.put({
        name: 'activeCaseId',
        value: c.caseId
      });
      return c;
    });
  }
  async function enqueuePurge(rec, job) {
    return tx(['cases', 'meta', 'outbox'], 'readwrite', async (s, r) => {
      const old = await r(s.cases.get(rec.caseId));
      if (!old || old.lifecycle === 'purgePending' || old.localRevision !== rec.localRevision || old.snapshot.revision !== job.request.expectedRevision || old.snapshot.generation !== job.request.expectedGeneration) throw new Error('Case changed before deletion. Sync and confirm again.');
      old.lifecycle = 'purgePending';
      s.cases.put(old);
      s.outbox.put(job);
      const m = await r(s.meta.get('activeCaseId'));
      if (m?.value === rec.caseId) s.meta.delete('activeCaseId');
    });
  }
  async function cleanup(caseId, jobId) {
    await tx(['cases', 'events', 'notes', 'drafts', 'requests', 'outbox', 'meta'], 'readwrite', s => {
      s.cases.delete(caseId);
      s.outbox.delete(jobId);
      const backupRequest = s.meta.get('migrationBackup');
      backupRequest.onsuccess = () => {
        const backup = backupRequest.result;
        if (!backup) return;
        const b = backup.value;
        for (const g of b.groups || []) if (Array.isArray(g.list)) {
          g.list = g.list.filter(x => (x.extreme || x.activeCaseSeed?.extreme)?.caseId !== caseId);
          g.raw = JSON.stringify(g.list);
        }
        try {
          const a = JSON.parse(b.activeRaw || 'null');
          if ((a?.extreme || a?.activeCaseSeed?.extreme)?.caseId === caseId) b.activeRaw = null;
        } catch {}
        s.meta.put(backup);
      };
      s.meta.delete('recipient:' + caseId);
      s.meta.delete('verdict:' + caseId);
      s.meta.delete('verdictRequest:' + caseId);
      for (const name of ['events', 'notes', 'drafts', 'requests']) {
        const c = s[name].openCursor();
        c.onsuccess = () => {
          const cursor = c.result;
          if (!cursor) return;
          if (cursor.value.caseId === caseId) cursor.delete();
          cursor.continue();
        };
      }
    });
  }
  async function lock(fn) {
    if (navigator.locks) return navigator.locks.request('ryc-extreme-active', fn);
    return fn();
  }
  async function discardSyncedCache(rec) {
    await tx(['events', 'cases'], 'readwrite', async (s, r) => {
      const current = await r(s.cases.get(rec.caseId));
      if (!current || current.localRevision !== rec.localRevision) throw new Error('Case changed; sync before clearing cache.');
      const cursor = s.events.openCursor(IDBKeyRange.bound([rec.caseId, 0], [rec.caseId, Math.max(0, current.lastSyncedSeq - 50)]));
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        c.delete();
        c.continue();
      };
      current.cacheReduced = true;
      s.cases.put(current);
    });
  }
  return {
    discardSyncedCache,
    open,
    tx,
    get,
    all,
    put,
    remove,
    active,
    saveSnapshot,
    cacheEvents,
    activate,
    enqueuePurge,
    cleanup,
    lock,
    channel
  };
})();
// END SOURCE: extreme-store.js

// BEGIN SOURCE: extreme-client.js
/* File name: extreme-client.js — transport only; no Standard save or appState coupling. */
window.RYCExtreme = (() => {
  const endpoint = () => (window.RYC_WORKER_URL || 'https://rest-your-case.spacexmzez.workers.dev/').replace(/\/$/, '') + '/extreme';
  function validateSnapshot(s) {
    if (!s || s.schemaVersion !== 2 || !Number.isSafeInteger(s.revision) || !Number.isSafeInteger(s.generation) || !Number.isSafeInteger(s.ap) || !Array.isArray(s.witnesses) || s.witnesses.length !== 6 || !Array.isArray(s.docket) || !s.title || !['intake', 'preparation', 'trial', 'closing', 'ended'].includes(s.stage)) throw new Error('Invalid Extreme server snapshot.');
    for (const key of ['truth', 'blueprint', 'pattern', 'defenseRoute', 'tokenHash']) if (key in s) throw new Error('Private server field in response.');
    return s;
  }
  async function call(rec, fields, config = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + rec.capability
    };
    const key = localStorage.getItem('rest_your_case_custom_gemini_key');
    if (key) headers['X-Custom-Gemini-Key'] = key;
    const {
      response,
      data
    } = await RYCRequest.fetchJSON(endpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        apiVersion: 2,
        caseId: rec.caseId,
        language: RYCI18n.get(),
        ...fields
      })
    }, {
      timeoutMs: fields.op === 'create' ? 90000 : fields.op === 'snapshot' || fields.op === 'archive' || fields.op === 'search' ? 20000 : 60000,
      ...config
    });
    if (!response.ok) throw Object.assign(RYCRequest.error(data?.error || 'HTTP_' + response.status, data?.details || 'Extreme request failed.'), {
      status: response.status,
      retryable: data?.retryable
    });
    if (data?.caseId !== rec.caseId) throw new Error('Case response identity mismatch.');
    if (data.snapshot) validateSnapshot(data.snapshot);
    return data;
  }
  const mutation = (rec, op, fields = {}) => ({
    op,
    language: RYCI18n.get(),
    operationId: crypto.randomUUID(),
    expectedRevision: rec.snapshot.revision,
    expectedGeneration: rec.snapshot.generation,
    ...fields
  });
  return {
    call,
    mutation,
    validateSnapshot
  };
})();
// END SOURCE: extreme-client.js

// BEGIN SOURCE: extreme-browser-migration.js
/* File name: extreme-browser-migration.js — staged legacy copies; Standard keys change only after verification. */
window.RYCExtremeMigration = (() => {
  const isExtreme = x => !!(x?.extreme?.caseId && x.extreme.token) || !!x?.activeCaseSeed?.extreme;
  async function run() {
    return RYCExtremeStore.lock(async () => {
      const activeRaw = localStorage.getItem('rest_your_case_state'),
        active = activeRaw ? JSON.parse(activeRaw) : null;
      const groups = ['ryc_pending_cases', 'ryc_shelf_cases'].map(key => ({
        key,
        raw: localStorage.getItem(key),
        list: JSON.parse(localStorage.getItem(key) || '[]')
      }));
      if (groups.some(g => !Array.isArray(g.list))) throw new Error('Legacy archive needs recovery before migration.');
      const draft = localStorage.getItem('terminal_draft') || '',
        extraHistories = Object.fromEntries(['court', 'partner', 'diaz'].map((ch, i) => {
          try {
            return [ch, JSON.parse(localStorage.getItem(['rest_your_case_history', 'rest_your_case_partner_history', 'rest_your_case_diaz_history'][i]) || '[]')];
          } catch {
            return [ch, []];
          }
        }));
      const migratingActive = isExtreme(active) ? active : null,
        activeExtreme = migratingActive?.extreme || migratingActive?.activeCaseSeed?.extreme;
      const candidates = groups.flatMap(g => g.list.filter(isExtreme));
      if (activeExtreme) candidates.push({
        id: activeExtreme.caseId,
        extreme: activeExtreme
      });
      // A played save and its original shelf brief can name the same server case.
      // Validate every capability, then import the newest snapshot once.
      const unique = new Map();
      for (const record of candidates) {
        const x = record.extreme || record.activeCaseSeed?.extreme;
        if (!x?.caseId || !x?.token || !x?.snapshot) throw new Error('An old Extreme capability or snapshot is missing. Original data retained.');
        const previous = unique.get(x.caseId),
          prior = previous?.extreme || previous?.activeCaseSeed?.extreme;
        if (prior && prior.token !== x.token) throw new Error('Two different capabilities claim the same case ID. Original files are retained.');
        if (!prior || (x.snapshot.serverRevision ?? x.snapshot.revision ?? 0) >= (prior.snapshot.serverRevision ?? prior.snapshot.revision ?? 0)) unique.set(x.caseId, record);
      }
      const records = [...unique.values()];
      if (!records.length) return {
        migrated: 0
      };
      const existing = await RYCExtremeStore.active();
      let chosenActive = activeExtreme?.caseId || existing?.caseId || null;
      if (activeExtreme && existing && existing.caseId !== activeExtreme.caseId) {
        const ar = RYCI18n.get() === 'ar',
          pick = window.prompt((ar ? 'عُثر على قضيتين قصويتين نشطتين. سنحفظ القضيتين ونستورد القديمة دون حذف أي منهما. اختر القضية النشطة:' : 'Two active Extreme saves were found. Both will be retained; importing does not delete either. Choose the active case:') + '\n1. ' + existing.snapshot.title + '\n2. ' + activeExtreme.snapshot.title + '\n' + (ar ? 'اكتب 1 أو 2، أو ألغِ للاحتفاظ بالملفات كما هي.' : 'Type 1 or 2, or cancel to leave the original files unchanged.'));
        if (!['1', '2'].includes(pick)) throw new Error(ar ? 'أُلغيت الاستعادة. الملفات الأصلية محفوظة.' : 'Recovery cancelled. Original files are retained.');
        chosenActive = pick === '1' ? existing.caseId : activeExtreme.caseId;
      }
      const sourceHashes = {};
      for (const record of records) {
        const x = record.extreme || record.activeCaseSeed?.extreme;
        if (x?.snapshot) {
          const bytes = new TextEncoder().encode(JSON.stringify(x.snapshot)),
            hash = await crypto.subtle.digest('SHA-256', bytes);
          sourceHashes[x.caseId] = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
        }
      }
      await RYCExtremeStore.tx(['cases', 'meta', 'notes', 'drafts', 'requests'], 'readwrite', async (s, r) => {
        for (const record of records) {
          const x = record.extreme || record.activeCaseSeed?.extreme;
          const prior = await r(s.cases.get(x.caseId));
          if (prior && prior.capability !== x.token) throw new Error('Two different capabilities claim the same case ID. Original files are retained.');
          if (!prior) s.cases.put({
            caseId: x.caseId,
            capability: x.token,
            snapshot: {
              ...x.snapshot,
              revision: x.snapshot.serverRevision ?? x.snapshot.revision ?? 0,
              generation: 1,
              schemaVersion: 2,
              lastSeq: 0
            },
            localRevision: 1,
            lastSyncedSeq: 0,
            lifecycle: x.caseId === chosenActive ? 'active' : 'brief',
            createdAt: record.timestamp || Date.now(),
            legacy: true,
            legacyChecksum: sourceHashes[x.caseId],
            recoveredLocal: activeExtreme?.caseId === x.caseId ? {
              transcript: migratingActive.transcript || [],
              histories: migratingActive._histories || extraHistories,
              exhibitNotes: migratingActive.exhibitNotes || {},
              draft
            } : null
          });
        }
        s.meta.put({
          name: 'migrationManifest',
          value: {
            sourceHashes,
            chosenActive,
            at: Date.now()
          }
        });
        s.meta.put({
          name: 'migrationBackup',
          value: {
            activeRaw,
            groups,
            at: Date.now()
          }
        });
        if (activeExtreme) {
          const id = activeExtreme.caseId;
          s.meta.put({
            name: 'activeCaseId',
            value: chosenActive
          });
          if (existing && existing.caseId !== chosenActive) {
            const prior = await r(s.cases.get(existing.caseId));
            if (prior) {
              prior.lifecycle = 'brief';
              prior.localRevision++;
              s.cases.put(prior);
            }
          }
          const chosen = await r(s.cases.get(chosenActive));
          if (chosen && chosen.lifecycle !== 'active' && chosen.lifecycle !== 'ended') {
            chosen.lifecycle = 'active';
            chosen.localRevision++;
            s.cases.put(chosen);
          }
          if (!(await r(s.notes.get([id, 'main'])))) s.notes.put({
            caseId: id,
            noteId: 'main',
            text: migratingActive.notes || ''
          });
          if (draft && !(await r(s.drafts.get([id, 'interview', 'CLIENT'])))) s.drafts.put({
            caseId: id,
            channel: 'interview',
            recipientId: 'CLIENT',
            text: draft
          });
          for (const [exhibit, text] of Object.entries(migratingActive.exhibitNotes || {})) if (!(await r(s.notes.get([id, 'exhibit:' + exhibit])))) s.notes.put({
            caseId: id,
            noteId: 'exhibit:' + exhibit,
            text: String(text)
          });
          for (const [channel, q] of Object.entries(migratingActive._requests || {})) if (q?.extremeOperationId && !(await r(s.requests.get([id, q.extremeOperationId])))) s.requests.put({
            caseId: id,
            operationId: q.extremeOperationId,
            legacy: true,
            original: q,
            channel
          });
        }
      });
      for (const record of records) {
        const x = record.extreme || record.activeCaseSeed?.extreme,
          copy = await RYCExtremeStore.get('cases', x.caseId);
        if (!copy || copy.capability !== x.token) throw new Error('Staged case verification failed. Original files remain unchanged.');
      }
      // CAS across localStorage: an intervening Standard tab must never be overwritten.
      if (localStorage.getItem('rest_your_case_state') !== activeRaw || groups.some(g => localStorage.getItem(g.key) !== g.raw)) throw new Error('Legacy data changed during migration. Copies are safe; reload before cleanup.');
      for (const g of groups) localStorage.setItem(g.key, JSON.stringify(g.list.filter(x => !isExtreme(x))));
      if (activeExtreme) {
        localStorage.removeItem('rest_your_case_state');
        try {
          const backup = JSON.parse(localStorage.getItem('rest_your_case_recovery_backup') || 'null');
          if ((backup?.extreme || backup?.activeCaseSeed?.extreme)?.caseId === activeExtreme.caseId) localStorage.removeItem('rest_your_case_recovery_backup');
        } catch {}
        for (const key of ['terminal_draft', 'rest_your_case_history', 'rest_your_case_partner_history', 'rest_your_case_diaz_history']) localStorage.removeItem(key);
      }
      return {
        migrated: records.length
      };
    });
  }
  return {
    run,
    isExtreme
  };
})();
// END SOURCE: extreme-browser-migration.js

// BEGIN SOURCE: extreme-archive.js
/* File name: extreme-archive.js — same-mode acceptance and multiple-confirmation permanent purge. */
window.RYCExtremeArchive = (() => {
  const tr = (en, ar) => RYCI18n.get() === 'ar' ? ar : en;
  function dialog(content) {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'extreme-dialog';
      d.setAttribute('data-no-i18n', '');
      const title = document.createElement('h2');
      title.textContent = content.title;
      const p = document.createElement('p');
      p.textContent = content.text;
      const keep = document.createElement('button');
      keep.textContent = tr('Keep case', 'احتفظ بالقضية');
      keep.autofocus = true;
      keep.onclick = () => {
        d.close();
        resolve(null);
      };
      d.append(title, p);
      let input;
      if (content.typeTitle) {
        const label = document.createElement('label');
        label.textContent = tr('Type the exact case title: ', 'اكتب عنوان القضية بالضبط: ') + content.typeTitle;
        input = document.createElement('input');
        input.autocomplete = 'off';
        label.append(input);
        d.append(label);
      }
      const proceed = document.createElement('button');
      proceed.textContent = tr('Continue deletion', 'تابع الحذف');
      proceed.disabled = !!input;
      if (input) input.oninput = () => proceed.disabled = input.value !== content.typeTitle;
      proceed.onclick = () => {
        d.close();
        resolve(true);
      };
      d.append(keep, proceed);
      d.oncancel = () => resolve(null);
      d.onclose = () => d.remove();
      document.body.append(d);
      d.showModal();
      keep.focus();
    });
  }
  async function confirmPurge(rec) {
    const p = await RYCExtreme.call(rec, {
        op: 'purgePreview'
      }),
      title = p.title;
    if (!(await dialog({
      title: tr('Permanently delete this Extreme case?', 'حذف هذه القضية القصوى نهائياً؟'),
      text: title + ' · ' + tr('Stage: ', 'المرحلة: ') + p.stage + ' · ' + tr('Turns: ', 'الجولات: ') + p.turn + '\n' + tr('All progress, conversations and notes will be removed. The game cannot restore them.', 'ستُحذف جميع المحادثات والملاحظات والتقدم. لا تستطيع اللعبة استعادتها.'),
      typeTitle: title
    }))) return null;
    if (!(await dialog({
      title: tr('Final confirmation', 'التأكيد النهائي'),
      text: tr('Delete ', 'احذف ') + title + tr(' permanently? Keep case cancels deletion.', ' نهائياً؟ اختر «احتفظ بالقضية» لإلغاء الحذف.')
    }))) return null;
    return {
      jobId: crypto.randomUUID(),
      oldCaseId: rec.caseId,
      capability: rec.capability,
      request: {
        ...RYCExtreme.mutation(rec, 'purge'),
        expectedRevision: p.revision,
        expectedGeneration: p.generation,
        purgeNonce: p.purgeNonce,
        confirmedTitle: title
      },
      confirmedTitle: title,
      attempts: 0
    };
  }
  async function flush() {
    const jobs = await RYCExtremeStore.all('outbox'),
      results = [];
    for (const job of jobs) {
      if (!job.request) continue;
      try {
        await RYCExtreme.call({
          caseId: job.oldCaseId,
          capability: job.capability
        }, job.request);
        await RYCExtremeStore.cleanup(job.oldCaseId, job.jobId);
        results.push({
          deleted: true
        });
      } catch (e) {
        if (e.status === 410) {
          await RYCExtremeStore.cleanup(job.oldCaseId, job.jobId);
          results.push({
            deleted: true
          });
          continue;
        }
        job.error = RYCRequest.format(e);
        job.attempts++;
        await RYCExtremeStore.put('outbox', job);
        results.push({
          pending: true,
          error: job.error,
          job
        });
      }
    }
    return results;
  }
  async function retryPending(job) {
    const rec = {
      caseId: job.oldCaseId,
      capability: job.capability,
      snapshot: {
        revision: job.request.expectedRevision,
        generation: job.request.expectedGeneration
      }
    };
    const fresh = await RYCExtreme.call(rec, {
      op: 'snapshot'
    });
    rec.snapshot = fresh.snapshot;
    const newJob = await confirmPurge(rec);
    if (!newJob) return false;
    newJob.jobId = job.jobId;
    await RYCExtremeStore.put('outbox', newJob);
    await flush();
    return true;
  }
  async function accept(id) {
    const candidate = await RYCExtremeStore.get('cases', id);
    if (!candidate || candidate.lifecycle === 'purgePending') throw new Error('Case unavailable.');
    const data = await RYCExtreme.call(candidate, {
      op: 'snapshot'
    });
    const synced = await RYCExtremeStore.saveSnapshot(candidate, data.snapshot);
    let old = await RYCExtremeStore.active();
    if (old?.caseId === id) {
      location.href = 'extreme.html?caseId=' + encodeURIComponent(id);
      return true;
    }
    let job = null;
    if (old) {
      const fresh = await RYCExtreme.call(old, {
        op: 'snapshot'
      });
      old = await RYCExtremeStore.saveSnapshot(old, fresh.snapshot);
      job = await confirmPurge(old);
      if (!job) return false;
    }
    await RYCExtremeStore.lock(() => RYCExtremeStore.activate(synced, old?.caseId || null, job));
    await flush();
    location.href = 'extreme.html?caseId=' + encodeURIComponent(id);
    return true;
  }
  async function purge(rec) {
    const fresh = await RYCExtreme.call(rec, {
      op: 'snapshot'
    });
    rec = await RYCExtremeStore.saveSnapshot(rec, fresh.snapshot);
    const job = await confirmPurge(rec);
    if (!job) return false;
    await RYCExtremeStore.lock(() => RYCExtremeStore.enqueuePurge(rec, job));
    await flush();
    return true;
  }
  return {
    accept,
    purge,
    flush,
    retryPending,
    confirmPurge
  };
})();
// END SOURCE: extreme-archive.js

// BEGIN SOURCE: extreme-intake.js
/* File name: extreme-intake.js — generation is independent of both active trials. */
window.RYCExtremeIntake = (() => {
  const tr = (en, ar) => RYCI18n.get() === 'ar' ? ar : en;
  async function generate(difficulty, onProgress) {
    const language = RYCI18n.get(),
      signature = JSON.stringify([difficulty, 'bank', language]),
      name = 'search:' + signature;
    let saved = await RYCExtremeStore.get('meta', name);
    if (!saved) {
      saved = {
        name,
        value: {
          caseId: crypto.randomUUID(),
          capability: crypto.randomUUID() + crypto.randomUUID().replaceAll('-', ''),
          operationId: crypto.randomUUID()
        }
      };
      await RYCExtremeStore.put('meta', saved);
    }
    const current = structuredClone(saved.value),
      fields = {
        op: 'create',
        language,
        operationId: current.operationId,
        genre: 'bank',
        difficulty,
        engineMode: 'smart'
      };
    let data = await RYCExtreme.call(current, fields, {
      onProgress
    });
    if (data.creationStatus === 'blueprintReady') data = await RYCExtreme.call(current, fields, {
      onProgress
    });
    if (!data.snapshot) throw new Error('Case generation is incomplete. Retry the same search.');
    const rec = {
      caseId: current.caseId,
      capability: current.capability,
      snapshot: data.snapshot,
      localRevision: 1,
      lastSyncedSeq: 0,
      lifecycle: 'brief',
      createdAt: Date.now()
    };
    await RYCExtremeStore.tx(['cases', 'events', 'meta'], 'readwrite', async (s, r) => {
      const old = await r(s.cases.get(rec.caseId));
      if (!old) s.cases.put(rec);
      for (const e of data.events || []) s.events.put({
        ...e,
        caseId: rec.caseId
      });
      const latest = await r(s.meta.get(name));
      if (latest?.value.caseId === current.caseId) s.meta.delete(name);
    });
    return rec;
  }
  function mount(container, after) {
    const title = document.createElement('h2');
    title.textContent = tr('Generate an Extreme brief', 'أنشئ ملخص قضية قصوى');
    const note = document.createElement('p');
    note.textContent = tr('Foundation: two bank-robbery scenarios, Smart only, free. Generate briefs while either trial continues.', 'النسخة التأسيسية: مساران لقضايا السطو على البنوك، باستخدام Smart فقط، مجاناً. يمكنك إنشاء ملخصات أثناء اللعب.');
    const select = document.createElement('select');
    select.setAttribute('aria-label', tr('Difficulty', 'الصعوبة'));
    for (const [value, en, ar] of [['Sandbox', 'Sandbox · Unlimited AP', 'تجريبي · نقاط غير محدودة'], ['Easy', 'Easy · 250% AP', 'سهل · 250% من النقاط'], ['Normal', 'Medium · 175% AP', 'متوسط · 175% من النقاط'], ['Hard', 'Hard · 100% AP', 'صعب · 100% من النقاط']]) select.add(new Option(tr(en, ar), value));
    select.value = 'Normal';
    const button = document.createElement('button');
    button.textContent = tr('Generate brief', 'أنشئ ملخصاً');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    button.onclick = async () => {
      button.disabled = true;
      select.disabled = true;
      try {
        status.textContent = tr('Generating. You may keep your current cases.', 'جارٍ الإنشاء. تبقى قضاياك الحالية محفوظة.');
        const rec = await generate(select.value, p => {
          status.textContent = tr('Generating · ', 'جارٍ الإنشاء · ') + p.elapsed + tr(' seconds', ' ثانية');
        });
        status.textContent = tr('Brief saved. Review it below.', 'حُفظ الملخص. راجعه أدناه.');
        await after?.(rec);
      } catch (e) {
        status.textContent = tr('Search not completed. Retry keeps the same frozen case. ', 'لم يكتمل البحث. إعادة المحاولة تحافظ على القضية نفسها. ') + RYCRequest.format(e);
      } finally {
        button.disabled = false;
        select.disabled = false;
      }
    };
    container.append(title, note, select, button, status);
  }
  return {
    generate,
    mount
  };
})();
// END SOURCE: extreme-intake.js

// BEGIN SOURCE: extreme-catalog.js
/* File name: extreme-catalog.js — public intake choices; no private case information. */
window.RYC_EXTREME_GENRES = [{
  "id": "organized",
  "name": "Organized crime",
  "ar": "الجريمة المنظمة"
}, {
  "id": "bank",
  "name": "Armed bank robbery",
  "ar": "السطو المسلح على بنك"
}, {
  "id": "hijacking",
  "name": "Aircraft hijacking",
  "ar": "اختطاف طائرة"
}, {
  "id": "drugs",
  "name": "Large drug network",
  "ar": "شبكة واسعة لتوزيع المخدرات"
}, {
  "id": "mass",
  "name": "Mass killing on federal property",
  "ar": "قتل جماعي في موقع اتحادي"
}, {
  "id": "targeted",
  "name": "Targeted killing of a federal official",
  "ar": "قتل مستهدف لمسؤول اتحادي"
}];
// END SOURCE: extreme-catalog.js

// BEGIN SOURCE: extreme-shell.js
/* File name: extreme-shell.js — archive tabs and independent brief generation entry points. */
const RYCStartArchive = async () => {
  const tr = (en, ar) => RYCI18n.get() === 'ar' ? ar : en,
    S = RYCExtremeStore,
    mode = new URLSearchParams(location.search).get('mode') || 'standard';
  async function renderArchive() {
    const panel = document.getElementById('extreme-archive');
    if (!panel) return;
    panel.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = tr('Extreme archive', 'أرشيف القضايا القصوى');
    panel.append(heading);
    const intake = document.createElement('div');
    panel.append(intake);
    RYCExtremeIntake.mount(intake, renderArchive);
    const cleanup = await RYCExtremeArchive.flush();
    for (const r of cleanup.filter(x => x.pending)) {
      const warning = document.createElement('div');
      warning.className = 'extreme-warning';
      warning.textContent = tr('Deletion pending. ', 'الحذف معلّق. ') + r.error;
      const retry = document.createElement('button');
      retry.textContent = tr('Review deletion again', 'راجع الحذف مجدداً');
      retry.onclick = async () => {
        try {
          await RYCExtremeArchive.retryPending(r.job);
          await renderArchive();
        } catch (e) {
          warning.textContent = RYCRequest.format(e);
        }
      };
      warning.append(retry);
      panel.append(warning);
    }
    const active = await S.active();
    if (active) {
      const p = document.createElement('p'),
        a = document.createElement('a');
      a.href = 'extreme.html?caseId=' + encodeURIComponent(active.caseId);
      a.textContent = tr('Resume: ', 'استأنف: ') + active.snapshot.title;
      p.append(a);
      panel.append(p);
    }
    const records = (await S.all('cases')).filter(c => c.lifecycle !== 'purgePending').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    let offset = 0;
    const list = document.createElement('div'),
      next = document.createElement('button');
    next.textContent = tr('Show more files', 'اعرض ملفات إضافية');
    panel.append(list, next);
    function page() {
      for (const c of records.slice(offset, offset + 20)) {
        const d = document.createElement('article');
        d.className = 'extreme-case-card';
        const h = document.createElement('h3');
        h.textContent = c.snapshot.title;
        const summary = document.createElement('p');
        summary.textContent = c.snapshot.summary;
        const state = document.createElement('small');
        state.textContent = tr('Stage: ', 'المرحلة: ') + c.snapshot.stage + ' · ' + (c.snapshot.difficulty === 'Normal' ? tr('Medium', 'متوسط') : RYCI18n.t(c.snapshot.difficulty));
        const review = document.createElement('details'),
          title = document.createElement('summary');
        title.textContent = tr('Review the public brief', 'راجع الملخص العام');
        review.append(title);
        for (const e of c.snapshot.docket || []) {
          const p = document.createElement('p');
          p.textContent = e.id + ' · ' + e.name + '\n' + e.details;
          review.append(p);
        }
        const accept = document.createElement('button');
        accept.textContent = c.caseId === active?.caseId ? tr('Resume', 'استأنف') : tr('Accept case', 'اقبل القضية');
        accept.onclick = async () => {
          accept.disabled = true;
          try {
            await RYCExtremeArchive.accept(c.caseId);
          } catch (e) {
            state.textContent = RYCRequest.format(e);
          } finally {
            accept.disabled = false;
          }
        };
        const del = document.createElement('button');
        del.textContent = tr('Delete permanently', 'احذف نهائياً');
        del.onclick = async () => {
          del.disabled = true;
          try {
            if (await RYCExtremeArchive.purge(c)) await renderArchive();
          } catch (e) {
            state.textContent = RYCRequest.format(e);
          } finally {
            del.disabled = false;
          }
        };
        d.append(h, summary, state, review, accept, del);
        list.append(d);
      }
      offset += 20;
      next.hidden = offset >= records.length;
    }
    next.onclick = page;
    page();
    if (!records.length) {
      const p = document.createElement('p');
      p.textContent = tr('No Extreme briefs yet. Generate one above.', 'لا توجد ملخصات قصوى بعد. أنشئ واحداً أعلاه.');
      list.append(p);
    }
  }
  try {
    await RYCExtremeMigration.run();
    if (document.getElementById('standard-archive')) {
      document.getElementById('standard-archive').hidden = mode === 'extreme';
      document.getElementById('extreme-archive').hidden = mode !== 'extreme';
      document.getElementById('mode-standard').setAttribute('aria-current', mode === 'standard' ? 'page' : 'false');
      document.getElementById('mode-extreme').setAttribute('aria-current', mode === 'extreme' ? 'page' : 'false');
      if (mode === 'extreme') await renderArchive();else mountStandardIntake();
    }
    const entry = document.getElementById('extreme-entry');
    if (entry) {
      const active = await S.active();
      const a = document.createElement('a');
      a.className = 'primary';
      a.href = active ? 'extreme.html?caseId=' + encodeURIComponent(active.caseId) : 'shelf.html?mode=extreme';
      a.textContent = active ? tr('Resume Extreme case', 'استأنف القضية القصوى') : tr('Open Extreme · Foundation', 'افتح المستوى القصوى · النسخة التأسيسية');
      entry.append(a);
      const note = document.createElement('p');
      note.textContent = tr('A separate terminal and archive. Your Standard case stays independently playable.', 'محطة وأرشيف مستقلان. تبقى قضيتك العادية قابلة للعب بصورة مستقلة.');
      entry.append(note);
    }
  } catch (e) {
    const warning = document.createElement('p');
    warning.className = 'extreme-warning';
    warning.setAttribute('role', 'alert');
    warning.textContent = RYCRequest.format(e);
    document.body.prepend(warning);
  }
  function mountStandardIntake() {
    const panel = document.getElementById('standard-generation');
    if (!panel) return;
    panel.setAttribute('data-no-i18n', '');
    const label = document.createElement('h2');
    label.textContent = tr('Generate a Standard brief', 'أنشئ ملخص قضية عادية');
    const d = document.createElement('select');
    for (const v of ['Sandbox', 'Easy', 'Normal', 'Hard']) d.add(new Option(RYCI18n.t(v), v));
    d.setAttribute('aria-label', tr('Difficulty', 'الصعوبة'));
    const c = document.createElement('select');
    for (let i = 1; i <= 5; i++) c.add(new Option(tr('Level ', 'المستوى ') + i, i));
    c.value = '3';
    c.setAttribute('aria-label', tr('Complexity', 'التعقيد'));
    const g = document.createElement('select');
    for (const name of ['Random Case File', 'Violent Felony', 'White-Collar Fraud', 'Cybercrime / Espionage', 'Substance / Narcotics', 'Overcharge / Manslaughter']) g.add(new Option(RYCI18n.t(name), name));
    g.setAttribute('aria-label', tr('Genre', 'نوع القضية'));
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary';
    b.textContent = tr('Generate brief', 'أنشئ ملخصاً');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    b.onclick = async () => {
      b.disabled = true;
      try {
        await generateCase(d.value, Number(c.value), g.value, undefined, p => {
          status.textContent = tr('Generating · ', 'جارٍ الإنشاء · ') + p.elapsed + 's';
        });
        archivePending();
        window.dispatchEvent(new Event('ryc-standard-brief'));
        status.textContent = tr('Brief saved to the Standard archive.', 'حُفظ الملخص في الأرشيف العادي.');
      } catch (e) {
        status.textContent = RYCRequest.format(e);
      } finally {
        b.disabled = false;
      }
    };
    panel.append(label, d, c, g, b, status);
  }
};
// END SOURCE: extreme-shell.js

// BEGIN SOURCE: ryc-foundation-bridge.js
/* File name: ryc-foundation-bridge.js — migrate before Standard can initialize a legacy Extreme save. */
const RYCStartStandard = async () => {
  try {
    const raw = localStorage.getItem('rest_your_case_state'),
      old = (() => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })(),
      wasExtreme = RYCExtremeMigration.isExtreme(old);
    try {
      await RYCExtremeMigration.run();
    } catch (e) {
      if (wasExtreme) throw e;
      const p = document.createElement('p');
      p.setAttribute('role', 'alert');
      p.textContent = e.message;
      document.body.prepend(p);
    }
    if (wasExtreme) {
      const active = await RYCExtremeStore.active();
      location.replace('extreme.html' + (active ? '?caseId=' + encodeURIComponent(active.caseId) : ''));
      return;
    }
    const script = document.createElement('script');
    script.src = 'game.js?v=foundation-2-review2';
    document.body.append(script);
  } catch (e) {
    const p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.textContent = RYCI18n.t('Could not open the saved trial: ') + e.message;
    document.body.prepend(p);
    for (const b of document.querySelectorAll('button')) b.disabled = true;
  }
};
// END SOURCE: ryc-foundation-bridge.js
