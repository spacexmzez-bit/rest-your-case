/* File name: extreme.js
 * Foundation browser: isolated IndexedDB, resumable transport, archive and terminal.
 * Standard storage is read only for explicitly marked legacy Extreme migration.
 */
(() => {
  'use strict';
  const ENDPOINT = 'https://rest-your-case.spacexmzez.workers.dev/extreme';
  const STORES = ['cases', 'events', 'meta', 'notes', 'drafts', 'requests', 'outbox'];
  const $ = id => document.getElementById(id);
  const uid = () => crypto.randomUUID();
  const tr = {
    Menu: 'القائمة', 'Close menu': 'إغلاق القائمة', Settings: 'الإعدادات', Overview: 'نظرة عامة',
    'Standard terminal': 'طرفية القضايا العادية', 'Extreme terminal': 'طرفية Extreme',
    'Standard archive': 'أرشيف القضايا العادية', 'Extreme archive': 'أرشيف Extreme', 'Legal library': 'المكتبة القانونية',
    'Generate Extreme brief': 'إنشاء موجز Extreme', 'Generate brief': 'إنشاء موجز', Sync: 'مزامنة', 'Purge case': 'حذف القضية نهائياً',
    'Choose an Extreme case or generate a new brief. Your Standard case stays independent.': 'اختر قضية Extreme أو أنشئ موجزاً جديداً. تبقى قضيتك العادية مستقلة.',
    Court: 'المحكمة', Case: 'القضية', Evidence: 'الأدلة', Witnesses: 'الشهود', Archive: 'الأرشيف', Notes: 'الملاحظات', Consultation: 'الاستشارة',
    'Search original records': 'البحث في السجلات الأصلية', Actor: 'الشخصية', 'Exhibit ID': 'معرّف الدليل', Search: 'بحث', 'Load more': 'تحميل المزيد',
    'Private defense notes': 'ملاحظات الدفاع الخاصة', 'Discard synced event cache': 'إزالة النسخة المحلية للسجلات المتزامنة',
    'Partner consultation and Diaz advice cost 0 AP. Investigations use the listed lead cost.': 'استشارة الشريك ونصيحة دياز مجاناً. التحقيقات تستهلك النقاط الموضحة لكل مسار.',
    'Senior Partner': 'الشريك الأول', Diaz: 'دياز', 'Refresh Clerk memory': 'تحديث ذاكرة كاتب السجل', Recipient: 'المستلم', 'Your message': 'رسالتك', Send: 'إرسال',
    'Case access belongs to this browser. Clearing browser data can lose access. Cases expire after 90 inactive days.': 'الوصول إلى القضية مرتبط بهذا المتصفح. مسح بياناته قد يفقد الوصول. تنتهي القضية بعد 90 يوماً دون نشاط.',
    Standard: 'عادي', Extreme: 'Extreme', 'Accept case': 'قبول القضية', 'Review brief': 'مراجعة الموجز', Resume: 'استئناف',
    Delete: 'حذف', Cancel: 'إلغاء', 'Keep case': 'الاحتفاظ بالقضية', 'Confirm permanent deletion': 'تأكيد الحذف النهائي',
    'Type the exact title': 'اكتب العنوان كما هو', 'Permanently delete': 'حذف نهائي', 'Deletion pending': 'الحذف قيد الانتظار',
    'Begin trial': 'بدء المحاكمة', 'Enter closing': 'بدء المرافعات الختامية', 'Request verdict': 'طلب الحكم',
    'Release witness': 'إنهاء شهادة الشاهد', Interview: 'مقابلة', 'Call witness': 'استدعاء الشاهد', Authenticate: 'توثيق الدليل',
    Disclose: 'إفصاح', 'Move to admit': 'طلب قبول الدليل', 'Move to exclude': 'طلب استبعاد الدليل',
    'Run investigation': 'تنفيذ التحقيق', 'Return brief': 'موجز العودة', Stage: 'المرحلة', Turn: 'الجولة', AP: 'نقاط العمل', Unlimited: 'بلا حدود',
    intake: 'الموجز الأولي', preparation: 'التحضير', trial: 'المحاكمة', closing: 'المرافعات الختامية', ended: 'منتهية',
    Sandbox: 'تجريبي', Easy: 'سهل', Normal: 'متوسط', Medium: 'متوسط', Hard: 'صعب', Marked: 'محدد', Admitted: 'مقبول', Excluded: 'مستبعد',
    client: 'الموكل', judge: 'القاضي', prosecutor: 'المدعي العام', witness: 'شاهد', investigator: 'المحقق', partner: 'الشريك',
    'No witness on stand': 'لا يوجد شاهد على المنصة', 'On stand': 'على منصة الشهادة',
    'Review pending deletion': 'مراجعة الحذف المعلّق', 'Private interview': 'مقابلة خاصة', 'Private consultation': 'استشارة خاصة', 'Public court': 'سجل المحكمة العام',
    'Sworn testimony': 'شهادة تحت القسم', 'Original record': 'السجل الأصلي', 'Defense counsel': 'محامي الدفاع',
    'Pending action': 'إجراء معلّق', Retry: 'إعادة المحاولة', 'Check status': 'التحقق من الحالة', 'Discard unsent action': 'إلغاء الإجراء غير المنفذ',
    'Continue saved jobs': 'متابعة العمليات المحفوظة', 'Saved locally': 'محفوظ محلياً', 'No saved Extreme cases yet.': 'لا توجد قضايا Extreme محفوظة بعد.',
    'Smart · four-model cascade': 'Smart · تسلسل أربعة نماذج', 'Light Clerk · two-model cascade': 'كاتب السجل Light · تسلسل نموذجين',
    'Generate': 'إنشاء', 'Bank scenario': 'نوع القضية البنكية', 'Bank robbery': 'سطو على بنك', 'Bank entries': 'قيود بنك', Random: 'عشوائي',
    Difficulty: 'الصعوبة', 'Gemini API key (optional)': 'مفتاح Gemini API (اختياري)', Save: 'حفظ',
    'Leave blank to use the Worker key. Extreme Scout and engine always use Smart.': 'اتركه فارغاً لاستخدام مفتاح الخادم. يستخدم منشئ موجز Extreme ومحركه Smart دائماً.',
    'Working…': 'جارٍ التنفيذ…', 'Synced': 'تمت المزامنة', 'Offline: showing saved records. Official actions require the server.': 'غير متصل: تُعرض السجلات المحفوظة. تتطلب الإجراءات الرسمية اتصالاً بالخادم.',
    'Public allegation': 'الادعاء العام', 'Count': 'التهمة', 'Source witness': 'شاهد المصدر', 'Completed': 'مكتمل', 'Prerequisites': 'المتطلبات السابقة',
    'View history': 'عرض السجل', 'Page': 'الصفحة', 'Previous': 'السابق', 'Next': 'التالي', 'No records found.': 'لم يُعثر على سجلات.',
    'Generate Standard brief': 'إنشاء موجز عادي', 'Brief ready': 'الموجز جاهز', 'Preparing brief': 'تحضير الموجز',
    'Permanent deletion removes the live case and its history, notes and drafts. Provider backups and your own copies can have separate retention.': 'يحذف هذا الإجراء القضية النشطة وسجلها وملاحظاتها ومسوداتها نهائياً. قد تكون للنسخ الاحتياطية لدى المزود ونسخك الشخصية مدة احتفاظ مستقلة.',
    'Replacing this Extreme case permanently deletes it. Standard cases are unaffected.': 'استبدال قضية Extreme هذه يحذفها نهائياً. لا تتأثر القضايا العادية.',
    'Case not found in this browser. Open its archive in the browser that owns it.': 'هذه القضية غير موجودة في هذا المتصفح. افتح أرشيفها في المتصفح الذي يملكها.',
    'Last examined witness': 'آخر شاهد تم استجوابه', 'Memory lag': 'تأخر الذاكرة', 'Visible unfinished leads': 'مسارات ظاهرة غير مكتملة', 'Last official changes': 'آخر تغييرات رسمية',
    'Draft saved': 'المسودة محفوظة', 'A local save failed. Keep this page open and resolve browser storage before proceeding.': 'تعذر الحفظ المحلي. أبقِ الصفحة مفتوحة وعالج مساحة المتصفح قبل المتابعة.'
  };
  let language = 'ar';
  try { language = localStorage.getItem('ryc_language') || 'ar'; } catch {}
  const t = s => language === 'ar' ? tr[s] || s : s === 'Normal' ? 'Medium' : s;
  let dbPromise, broadcast, terminalCase, busy = false, recipient = 'CLIENT', panel = 'court';
  let archiveCursor = 0, archiveFilters = {}, archiveHasMore = false, shelfPage = 0;
  let jobs = [], warningText = '', dialogBusy = false, notesTimer, draftTimer;
  function element(tag, text, className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  }
  function button(text, run, className = '') {
    const el = element('button', t(text), className); el.type = 'button';
    el.addEventListener('click', () => runSafely(run)); return el;
  }
  function status(text) { if ($('ex-status')) $('ex-status').textContent = text; }
  function warn(text) {
    warningText = text;
    let notice = $('ex-warning');
    if (!notice) { notice = element('div', '', 'ex-warning'); notice.id = 'ex-warning'; document.querySelector('main')?.prepend(notice); }
    if (notice) { notice.textContent = text; notice.hidden = !text; }
  }
  async function runSafely(run) {
    try { await run(); } catch (e) { warn(`[${e.code || 'ERROR'}] ${e.message}`); }
  }
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open('ryc_extreme_v2', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        const cases = d.createObjectStore('cases', { keyPath: 'caseId' }); cases.createIndex('createdAt', 'createdAt');
        d.createObjectStore('events', { keyPath: ['caseId', 'seq'] }); d.createObjectStore('meta', { keyPath: 'name' });
        d.createObjectStore('notes', { keyPath: ['caseId', 'noteId'] });
        d.createObjectStore('drafts', { keyPath: ['caseId', 'channel', 'recipientId'] });
        d.createObjectStore('requests', { keyPath: ['caseId', 'operationId'] }); d.createObjectStore('outbox', { keyPath: 'jobId' });
      };
      r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
      r.onerror = () => reject(r.error); r.onblocked = () => warn('Close other tabs using the old Extreme database to finish upgrading.');
    });
    return dbPromise;
  }
  const requestValue = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  async function transact(names, mode, callback) {
    const d = await db(), tx = d.transaction(names, mode);
    const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.')); });
    try {
      const value = await callback(Object.fromEntries(names.map(n => [n, tx.objectStore(n)])));
      await done; return value;
    } catch (e) {
      try { tx.abort(); } catch {} await done.catch(() => {});
      if (mode === 'readwrite') warn(t('A local save failed. Keep this page open and resolve browser storage before proceeding.'));
      throw e;
    }
  }
  const read = (store, key) => transact([store], 'readonly', s => requestValue(s[store].get(key)));
  const all = store => transact([store], 'readonly', s => requestValue(s[store].getAll()));
  const put = (store, value) => transact([store], 'readwrite', s => { s[store].put(value); });
  const remove = (store, key) => transact([store], 'readwrite', s => { s[store].delete(key); });
  function notify() { broadcast?.postMessage({ refresh: true }); }
  async function lock(run) {
    if (navigator.locks) return navigator.locks.request('ryc-extreme-active', run);
    // IndexedDB's readwrite transactions still compare revisions atomically when Web Locks is unavailable.
    return run();
  }
  async function api(c, op, fields = {}, timeout = 60000, rawBody = null) {
    const body = rawBody || { apiVersion: 2, caseId: c.caseId, language, op, ...fields };
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${c.capability}` };
      const key = localStorage.getItem('rest_your_case_custom_gemini_key'); if (key) headers['X-Custom-Gemini-Key'] = key;
      const r = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      let data; try { data = await r.json(); } catch { throw Object.assign(new Error('The server returned invalid JSON.'), { code: 'INVALID_RESPONSE' }); }
      if (!r.ok) throw Object.assign(new Error(data.details || data.error || `HTTP ${r.status}`), { code: data.error, status: r.status });
      return data;
    } catch (e) {
      if (controller.signal.aborted) throw Object.assign(new Error('Request window ended. Its identity is saved. Check status before retrying.'), { code: 'REQUEST_PENDING' });
      throw e;
    } finally { clearTimeout(timer); }
  }
  function mutation(c, op, fields) {
    return { apiVersion: 2, caseId: c.caseId, op, language, operationId: uid(),
      expectedRevision: c.snapshot?.revision || 0, expectedGeneration: c.snapshot?.generation || 1, ...fields };
  }
  async function persistResult(c, data, requestId) {
    const next = { ...c, snapshot: data.state || c.snapshot, lastAccess: Date.now() };
    if (next.lifecycle !== 'purgePending' && next.snapshot?.stage === 'ended') next.lifecycle = 'ended';
    if (data.state) next.localRevision = (c.localRevision || 0) + 1;
    await transact(['cases', 'events', 'requests'], 'readwrite', async s => {
      const current = await requestValue(s.cases.get(c.caseId));
      if (current?.localRevision !== c.localRevision) throw Object.assign(new Error('Another tab updated this case. Sync and recover the pending receipt.'), { code: 'LOCAL_CONFLICT' });
      s.cases.put(next);
      for (const e of data.events || []) s.events.put({ ...e, caseId: c.caseId });
      if (requestId && data.receipt) s.requests.delete([c.caseId, requestId]);
    });
    if (terminalCase?.caseId === c.caseId) terminalCase = next;
    notify(); return next;
  }
  async function pageEvents(c, afterSeq = 0) {
    const data = await api(c, 'archive', { afterSeq, limit: 50 });
    const next = { ...c, lastSyncedSeq: data.cursor, localRevision: (c.localRevision || 0) + 1 };
    await transact(['cases', 'events'], 'readwrite', async s => {
      const current = await requestValue(s.cases.get(c.caseId));
      if (current?.localRevision !== c.localRevision) throw new Error('Another tab updated the event cache. Sync again.');
      for (const e of data.events) s.events.put({ ...e, caseId: c.caseId });
      s.cases.put(next);
    });
    return { c: next, hasMore: data.hasMore };
  }
  async function sync(c, full = true) {
    const data = await api(c, 'snapshot'); jobs = data.jobs || [];
    c = await persistResult(c, data);
    if (full && data.state) {
      let more = true;
      while (more) { const page = await pageEvents(c, c.lastSyncedSeq || 0); c = page.c; more = page.hasMore; }
    }
    if (terminalCase?.caseId === c.caseId) terminalCase = c;
    return c;
  }
  async function submit(c, body) {
    const pending = { caseId: c.caseId, operationId: body.operationId, body, createdAt: Date.now() };
    await put('requests', pending);
    const result = await api(c, body.op, {}, 60000, body);
    if (result.status === 'running') { renderPending(); return result; }
    c = await persistResult(c, result, body.operationId);
    if (result.receipt) status(t('Synced'));
    if (result.jobId) {
      c = await driveJob(c, result.jobId);
      const finished = await api(c, 'operation', { operationId: body.operationId });
      if (finished.status === 'committed') await persistResult(c, finished.result, body.operationId);
    }
    return result;
  }
  async function driveJob(c, jobId) {
    let data;
    do {
      status(t('Working…'));
      data = await api(c, 'continue', { jobId }, c.snapshot ? 60000 : 90000);
      if (data.state) {
        c = await persistResult(c, data, data.operationId);
        status(t('Brief ready'));
      }
    } while (data.status !== 'committed');
    return c;
  }
  async function recoverPending(c, retry = false) {
    const requests = (await all('requests')).filter(x => x.caseId === c.caseId);
    for (const saved of requests) {
      const result = await api(c, 'operation', { operationId: saved.operationId });
      if (result.status === 'committed') c = await persistResult(c, result.result, saved.operationId);
      else if (result.result?.jobId && ['queued', 'pending', 'reviewing', 'failed'].includes(result.status)) {
        if (retry) {
          c = await driveJob(c, result.result.jobId);
          const finished = await api(c, 'operation', { operationId: saved.operationId });
          if (finished.status === 'committed') c = await persistResult(c, finished.result, saved.operationId);
        }
      } else if (retry && (['unknown', 'failed'].includes(result.status) || result.leaseExpired)) {
        if (saved.body.expectedRevision !== c.snapshot?.revision && c.snapshot) {
          throw new Error('This unsent action belongs to an earlier revision. Its text is preserved. Discard it, review the new state, and submit a new action.');
        }
        const data = await api(c, saved.body.op, {}, 60000, saved.body);
        c = await persistResult(c, data, saved.operationId);
      }
    }
    terminalCase = terminalCase?.caseId === c.caseId ? c : terminalCase;
    return c;
  }
  async function generate(difficulty, scenarioId) {
    const c = { caseId: uid(), capability: uid().replaceAll('-', '') + uid().replaceAll('-', ''), snapshot: null,
      lifecycle: 'brief', createdAt: Date.now(), localRevision: 0, lastSyncedSeq: 0 };
    const body = mutation(c, 'create', { genre: 'bank', difficulty, engineMode: 'smart', ...(scenarioId ? { scenarioId } : {}), expectedGeneration: 0 });
    await transact(['cases', 'requests'], 'readwrite', s => {
      s.cases.put(c); s.requests.put({ caseId: c.caseId, operationId: body.operationId, body, createdAt: Date.now() });
    });
    // A generation has its own identity before the first network await.
    const result = await api(c, 'create', {}, 90000, body);
    await put('cases', { ...c, generationJobId: result.jobId });
    const fresh = await driveJob(await read('cases', c.caseId), result.jobId);
    notify(); return fresh;
  }
  async function purgePreparation(c) {
    const preview = await api(c, 'purgePreview');
    const agreed = await ask('Purge case', content => {
      content.append(element('h3', preview.title), element('p', `${t('Stage')}: ${t(preview.stage)} · ${t('Turn')}: ${preview.turns}`),
        element('p', t('Permanent deletion removes the live case and its history, notes and drafts. Provider backups and your own copies can have separate retention.')));
      const label = element('label', t('Type the exact title')), input = element('input'); input.autocomplete = 'off'; label.append(input); content.append(label);
      return () => { if (input.value !== preview.title) throw new Error(t('Type the exact title')); return true; };
    }, 'Permanently delete', 'Keep case');
    if (!agreed) return null;
    const final = await ask('Confirm permanent deletion', content => { content.append(element('p', preview.title)); }, 'Permanently delete', 'Keep case');
    if (!final) return null;
    return { purgeNonce: preview.purgeNonce, confirmedTitle: preview.title };
  }
  async function deleteLocal(s, caseId) {
    s.cases.delete(caseId);
    for (const store of ['events', 'notes', 'drafts', 'requests']) {
      await new Promise((resolve, reject) => {
        const r = s[store].openCursor();
        r.onerror = () => reject(r.error);
        r.onsuccess = () => { const cursor = r.result; if (!cursor) return resolve(); if (cursor.value.caseId === caseId) cursor.delete(); cursor.continue(); };
      });
    }
  }
  async function accept(c) {
    c = await sync(c);
    if (!c.snapshot) throw new Error('Finish generating this brief first.');
    let existingId = (await read('meta', 'activeCaseId'))?.value;
    if (existingId === c.caseId && c.snapshot.stage !== 'intake') { location.href = `extreme.html?caseId=${c.caseId}`; return; }
    let old = existingId && existingId !== c.caseId ? await read('cases', existingId) : null;
    let deletion;
    if (old) {
      old = await sync(old);
      warn(t('Replacing this Extreme case permanently deletes it. Standard cases are unaffected.'));
      deletion = await purgePreparation(old); if (!deletion) return;
    }
    if (c.snapshot.stage === 'intake') {
      await submit(c, mutation(c, 'action', { channel: 'court', recipientId: 'JUDGE', command: 'accept' }));
      c = await read('cases', c.caseId);
    }
    await lock(() => transact(['cases', 'meta', 'requests', 'outbox'], 'readwrite', async s => {
      const actual = await requestValue(s.meta.get('activeCaseId'));
      if ((actual?.value || undefined) !== existingId) throw new Error('Another tab changed the active case. Review the replacement again.');
      const candidate = await requestValue(s.cases.get(c.caseId));
      if (candidate.localRevision !== c.localRevision) throw new Error('Candidate changed in another tab. Review it again.');
      candidate.lifecycle = 'active'; candidate.localRevision++; s.cases.put(candidate); s.meta.put({ name: 'activeCaseId', value: c.caseId });
      if (old) {
        const actualOld = await requestValue(s.cases.get(old.caseId));
        if (actualOld.localRevision !== old.localRevision) throw new Error('Current case changed in another tab. Review deletion again.');
        actualOld.lifecycle = 'purgePending'; s.cases.put(actualOld);
        s.outbox.put({ jobId: uid(), caseId: old.caseId, capability: old.capability, snapshot: old.snapshot, ...deletion,
          operationId: uid(), createdAt: Date.now() });
      }
    }));
    await cleanup(); notify(); location.href = `extreme.html?caseId=${c.caseId}`;
  }
  async function purge(c) {
    c = await sync(c, false);
    const deletion = await purgePreparation(c); if (!deletion) return;
    await lock(() => transact(['cases', 'meta', 'outbox'], 'readwrite', async s => {
      const current = await requestValue(s.cases.get(c.caseId));
      if (current.localRevision !== c.localRevision) throw new Error('Case changed in another tab. Review deletion again.');
      current.lifecycle = 'purgePending'; s.cases.put(current);
      const active = await requestValue(s.meta.get('activeCaseId'));
      if (active?.value === c.caseId) s.meta.delete('activeCaseId');
      s.outbox.put({ jobId: uid(), caseId: c.caseId, capability: c.capability, snapshot: c.snapshot,
        ...deletion, operationId: uid(), createdAt: Date.now() });
    }));
    await cleanup(); notify();
    if (terminalCase?.caseId === c.caseId) location.href = 'extreme.html'; else await renderShelf();
  }
  async function cleanup() {
    for (const job of await all('outbox')) {
      try {
        const body = job.body || mutation(job, 'purge', { operationId: job.operationId,
          purgeNonce: job.purgeNonce, confirmedTitle: job.confirmedTitle });
        if (!job.body) { job.body = body; await put('outbox', job); }
        const result = await api(job, 'purge', {}, 60000, body);
        if (!result.receipt?.purged) throw new Error('Deletion not acknowledged.');
        await transact(['cases', 'events', 'notes', 'drafts', 'requests', 'outbox'], 'readwrite', async s => {
          await deleteLocal(s, job.caseId); s.outbox.delete(job.jobId);
        });
      } catch (e) {
        // Expired confirmation or a changed old case needs a fresh player review, never an automatic new nonce.
        warn(`${t('Deletion pending')}: ${job.confirmedTitle} · ${e.message}`);
      }
    }
  }
  function dialog() {
    let el = $('ex-dialog');
    if (!el) { el = element('dialog', undefined, 'ex-dialog'); el.id = 'ex-dialog'; const content = element('div'); content.id = 'ex-dialog-content'; el.append(content); document.body.append(el); }
    return el;
  }
  function ask(title, build, yes = 'Save', no = 'Cancel') {
    if (dialogBusy) return Promise.reject(new Error('Close the current dialog first.'));
    dialogBusy = true;
    return new Promise(resolve => {
      const el = dialog(), content = $('ex-dialog-content'); content.replaceChildren(element('h2', t(title)));
      const getter = build(content), error = element('p', '', 'ex-warning'); error.hidden = true; error.setAttribute('role', 'alert'); content.append(error);
      const actions = element('div', undefined, 'ex-actions');
      const finish = value => { el.close(); dialogBusy = false; resolve(value); };
      const cancel = button(no, () => finish(null)); cancel.autofocus = true;
      actions.append(cancel, button(yes, () => { try { finish(getter ? getter() : true); } catch (e) { error.textContent = e.message; error.hidden = false; } }));
      content.append(actions); el.oncancel = event => { event.preventDefault(); finish(null); }; el.showModal(); cancel.focus();
    });
  }
  async function generationDialog() {
    const answer = await ask('Generate Extreme brief', content => {
      const difficulty = element('select'); for (const value of ['Sandbox', 'Easy', 'Normal', 'Hard']) difficulty.add(new Option(t(value), value)); difficulty.value = 'Normal';
      const scenario = element('select'); for (const [label, value] of [['Random', ''], ['Bank robbery', 'robbery'], ['Bank entries', 'entries']]) scenario.add(new Option(t(label), value));
      const label = element('label', t('Difficulty')); label.append(difficulty);
      const second = element('label', t('Bank scenario')); second.append(scenario);
      content.append(element('p', t('Smart · four-model cascade')), label, second);
      return () => ({ difficulty: difficulty.value, scenarioId: scenario.value });
    }, 'Generate');
    if (!answer) return;
    await withBusy(async () => {
      const c = await generate(answer.difficulty, answer.scenarioId); await reviewBrief(c); await renderShelf();
    });
  }
  async function reviewBrief(c) {
    if (!c.snapshot) {
      await withBusy(async () => { c = await recoverPending(c, true); c = await sync(c); });
      if (!c.snapshot) return;
    }
    const chosen = await ask('Review brief', content => {
      const s = c.snapshot;
      content.append(element('h3', s.title), element('p', s.allegations), element('p', `${t('Difficulty')}: ${t(s.difficulty)} · ${t('AP')}: ${s.difficulty === 'Sandbox' ? t('Unlimited') : s.ap}`));
      for (const e of s.exhibits) content.append(element('h4', `${e.id} · ${e.name}`), element('p', e.details));
    }, c.lifecycle === 'active' || c.lifecycle === 'ended' ? 'Resume' : 'Accept case');
    if (chosen) await accept(c);
  }
  async function settings() {
    const value = await ask('Settings', content => {
      const label = element('label', t('Gemini API key (optional)')), input = element('input'); input.type = 'password'; input.autocomplete = 'off';
      input.value = localStorage.getItem('rest_your_case_custom_gemini_key') || ''; label.append(input);
      content.append(label, element('p', t('Leave blank to use the Worker key. Extreme Scout and engine always use Smart.')));
      return () => ({ key: input.value.trim() });
    });
    if (!value) return;
    if (value.key) localStorage.setItem('rest_your_case_custom_gemini_key', value.key); else localStorage.removeItem('rest_your_case_custom_gemini_key');
  }
  async function withBusy(run) {
    if (busy) return; busy = true; status(t('Working…')); updateDisabled();
    try { await run(); } finally { busy = false; updateDisabled(); if (terminalCase) { await renderTerminal(); await renderPending(); } }
  }
  function updateDisabled() {
    const offline = !navigator.onLine;
    for (const el of document.querySelectorAll('[data-official], #ex-send, #ex-generate, #ex-refresh-memory, #ex-sync')) el.disabled = busy || offline;
    if (terminalCase?.snapshot?.stage === 'ended' && $('ex-send')) $('ex-send').disabled = true;
  }
  async function action(command, recipientId = recipient, targetId, message) {
    if (!terminalCase?.snapshot) return;
    await saveDraft();
    if ((await all('requests')).some(x => x.caseId === terminalCase.caseId)) throw new Error('Resolve the pending action before sending another.');
    const channel = command === 'investigate' ? 'investigation' : ['PARTNER', 'DIAZ'].includes(recipientId) ? 'consultation' :
      recipientId === 'CLIENT' || /^W/.test(recipientId) && terminalCase.snapshot.standId !== recipientId ? 'interview' : 'court';
    const body = mutation(terminalCase, 'action', { command, recipientId, channel,
      ...(targetId ? { targetId } : {}), ...(message?.trim() ? { message: message.trim() } : {}) });
    await withBusy(async () => {
      const result = await submit(terminalCase, body);
      if (result.receipt && command === 'speak' || result.receipt && command === 'close') {
        $('ex-message').value = ''; await saveDraft();
      }
      // Explicit browser requests process one Clerk batch at a time after official save.
      const snap = await api(terminalCase, 'snapshot'); jobs = snap.jobs || [];
      const clerk = jobs.find(x => x.kind === 'clerk');
      if (clerk) {
        try { await api(terminalCase, 'continue', { jobId: clerk.id }); } catch (e) { warn(`Clerk: ${e.message} · ${t('Synced')}`); }
      }
    });
  }
  async function saveDraft() {
    if (!terminalCase || !$('ex-message')) return;
    await put('drafts', { caseId: terminalCase.caseId, channel: 'compose', recipientId: recipient, text: $('ex-message').value });
  }
  async function chooseRecipient(id, initial = false) {
    if (!initial) await saveDraft(); recipient = id; $('ex-recipient').value = id;
    await put('meta', { name: `recipient:${terminalCase.caseId}`, value: id });
    const draft = await read('drafts', [terminalCase.caseId, 'compose', id]); $('ex-message').value = draft?.text || '';
    updateChannel(); $('ex-message').focus();
  }
  function updateChannel() {
    const s = terminalCase?.snapshot;
    const kind = ['PARTNER', 'DIAZ'].includes(recipient) ? 'Private consultation' : recipient === 'CLIENT' || /^W/.test(recipient) && s?.standId !== recipient ? 'Private interview' : 'Public court';
    if ($('ex-channel')) $('ex-channel').textContent = `${t(kind)} · ${t('AP')}: 0`;
  }
  function switchPanel(next) {
    panel = next;
    document.querySelectorAll('[data-ex-panel]').forEach(el => el.hidden = el.dataset.exPanel !== panel);
    document.querySelectorAll('[data-ex-tab]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.exTab === panel)));
  }
  function eventCard(e) {
    const s = terminalCase?.snapshot, name = e.actorId === 'DEFENSE' ? t('Defense counsel') : s?.roster.find(x => x.id === e.actorId)?.name || e.actorId;
    const card = element('article', undefined, 'ex-event'); card.id = `event-${e.id}`; card.dataset.speaker = e.actorId;
    card.append(element('strong', name), element('small', ` · #${e.seq} · ${t(e.sworn ? 'Sworn testimony' : e.visibility === 'PUBLIC_COURT' || e.visibility === 'SYSTEM_PUBLIC' ? 'Public court' : 'Private interview')}`), element('p', e.text));
    const source = element('a', `${t('Original record')}: ${e.id}`); source.href = `#event=${e.id}`; source.dir = 'ltr';
    source.addEventListener('click', event => { event.preventDefault(); runSafely(() => showSource(e.id)); }); card.append(source);
    for (const id of e.sourceEventIds || []) card.append(button(id, () => showSource(id)));
    return card;
  }
  async function showSource(id) {
    switchPanel('archive'); archiveFilters = { query: id }; archiveCursor = 0;
    // Exact UUID lookup searches cached originals or pages the complete archive; never treats ID as speech text.
    let e = (await all('events')).find(x => x.caseId === terminalCase.caseId && x.id === id);
    if (!e && navigator.onLine) {
      const sources = await api(terminalCase, 'search', { query: id, limit: 50 });
      e = sources.events.find(x => x.id === id);
    }
    $('ex-archive').replaceChildren(e ? eventCard(e) : element('p', t('No records found.')));
    $('ex-more').hidden = true;
  }
  async function renderTerminal() {
    if (!$('ex-terminal')) return;
    const s = terminalCase?.snapshot;
    $('ex-empty').hidden = !!s; $('ex-terminal').hidden = !s; if (!s) return;
    $('ex-title').textContent = s.title;
    $('ex-hud').textContent = `${t(s.stage)} · ${t(s.difficulty)} · ${t('AP')}: ${s.difficulty === 'Sandbox' ? t('Unlimited') : s.ap} · ${t('Turn')}: ${s.turn} · r${s.revision}`;
    $('ex-stand').textContent = s.standId ? `${t('On stand')}: ${s.roster.find(x => x.id === s.standId)?.name}` : t('No witness on stand');
    const controls = $('ex-phase-buttons'); controls.replaceChildren();
    const officialButton = (label, run) => { const b = button(label, run); b.dataset.official = ''; return b; };
    if (s.stage === 'intake') controls.append(officialButton('Accept case', () => accept(terminalCase)));
    if (s.stage === 'preparation') controls.append(officialButton('Begin trial', () => action('trial', 'JUDGE')));
    if (s.stage === 'trial') controls.append(officialButton(s.standId ? 'Release witness' : 'Enter closing', () => action(s.standId ? 'release' : 'closing', 'JUDGE')));
    if (s.stage === 'closing') controls.append(officialButton('Request verdict', () => withBusy(() => submit(terminalCase, mutation(terminalCase, 'verdict', {})))));
    if (jobs.some(x => x.status !== 'committed')) controls.append(officialButton('Continue saved jobs', () => continueJobs()));
    const options = s.roster.map(x => new Option(`${x.name} · ${t(x.role)} [${x.id}]`, x.id));
    $('ex-recipient').replaceChildren(...options); $('ex-recipient').value = recipient;
    if ($('ex-search-actor').options.length === 1) $('ex-search-actor').append(...s.roster.map(x => new Option(x.name, x.id)));
    const cached = (await all('events')).filter(x => x.caseId === terminalCase.caseId);
    $('ex-exchanges').replaceChildren(...cached.slice(-30).map(eventCard));
    const casePanel = $('ex-case'); casePanel.replaceChildren(element('h2', t('Public allegation')), element('p', s.allegations), element('p', `${s.venue} · ${s.federalHook}`));
    casePanel.append(button('Return brief', renderReturnBrief));
    for (const count of s.charges) casePanel.append(element('h3', `${count.id} · ${count.statute} · ${count.name}`), element('p', count.elements.join('\n')));
    if (s.stage === 'intake') casePanel.append(element('h3', s.roster.find(x => x.id === 'CLIENT').name), element('p', s.openingStatement));
    $('ex-leads').replaceChildren(...s.leads.map(lead => {
      const card = element('article', undefined, 'ex-card'); card.append(element('h3', `${lead.id} · ${lead.label}`), element('p', lead.description),
        element('p', `${t('AP')}: ${lead.cost} · ${lead.completed ? t('Completed') : `${t('Prerequisites')}: ${lead.requiresLeadIds.join(', ') || '—'}`}`));
      const b = officialButton('Run investigation', () => action('investigate', 'DIAZ', lead.id, lead.description));
      b.disabled = !lead.available || s.ap < lead.cost || !['preparation', 'trial'].includes(s.stage);
      if (!b.disabled) b.dataset.official = ''; else delete b.dataset.official;
      card.append(b); return card;
    }));
    $('ex-evidence').replaceChildren(...s.exhibits.map(e => {
      const card = element('article', undefined, 'ex-card'); card.append(element('h3', `${e.id} · ${e.name}`), element('p', e.details),
        element('p', `${t(e.status)} · ${t('Source witness')}: ${e.sourceActorId}`));
      const actions = element('div', undefined, 'ex-actions');
      if (s.stage === 'trial' && s.standId === e.sourceActorId && !e.foundation) actions.append(officialButton('Authenticate', async () => {
        const text = await ask('Authenticate', content => { const input = element('input'); input.value = language === 'ar' ? `هل يمكنك تحديد الدليل ${e.id} وشرح معرفتك الشخصية به؟` : `Can you identify ${e.id} and explain your personal knowledge of it?`; content.append(input); return () => input.value; }, 'Send');
        if (text) await action('foundation', e.sourceActorId, e.id, text);
      }));
      if (!e.disclosed) actions.append(officialButton('Disclose', () => action('disclose', 'JUDGE', e.id)));
      if (s.stage === 'trial' && e.disclosed) {
        for (const [cmd, label] of [['admit', 'Move to admit'], ['exclude', 'Move to exclude']]) {
          const b = officialButton(label, async () => {
            const text = await ask(label, content => { content.append(element('p', `${e.id} · ${e.name}`));
              const input = element('textarea'); input.maxLength = 2400; content.append(input); return () => {
                if (!input.value.trim()) throw new Error(t('Your message')); return input.value;
              }; }, 'Send');
            if (text) await action(cmd, 'JUDGE', e.id, text);
          });
          if (cmd === 'admit' && (!e.foundation || e.status === 'Excluded')) { b.disabled = true; delete b.dataset.official; }
          actions.append(b);
        }
      }
      card.append(actions); return card;
    }));
    $('ex-witnesses').replaceChildren(...s.roster.filter(x => x.id === 'CLIENT' || /^W/.test(x.id)).map(p => {
      const card = element('article', undefined, 'ex-card'); card.append(element('h3', `${p.name} [${p.id}]`), element('p', p.bio));
      card.append(button('Interview', () => chooseRecipient(p.id)), button('View history', async () => {
        switchPanel('archive'); archiveFilters = { actorId: p.id }; archiveCursor = 0; await loadArchive(true);
      }));
      if (s.stage === 'trial' && !s.standId && /^W/.test(p.id)) card.append(officialButton('Call witness', async () => { await action('call', 'JUDGE', p.id); await chooseRecipient(p.id); }));
      return card;
    }));
    const verdict = $('ex-verdict'); verdict.hidden = !s.verdict;
    if (s.verdict) {
      verdict.replaceChildren(element('h2', t('Request verdict')), element('p', s.verdict.speech));
      for (const count of s.verdict.counts) verdict.append(element('h3', `${count.id}: ${count.outcome}`), element('p', count.reason));
      verdict.append(element('p', s.resolution));
    }
    $('ex-memory').replaceChildren(element('p', t('Light Clerk · two-model cascade')),
      ...s.memoryLag.map(m => element('p', `${m.actorId}: ${t('Memory lag')} ${m.pending} · v${m.version}`)));
    if (s.migrationWarning) warn(s.migrationWarning);
    updateChannel(); updateDisabled();
  }
  async function renderPending() {
    if (!$('ex-pending') || !terminalCase) return;
    const requests = (await all('requests')).filter(x => x.caseId === terminalCase.caseId);
    const box = $('ex-pending'); box.hidden = requests.length === 0; box.replaceChildren();
    for (const request of requests) {
      box.append(element('p', `${t('Pending action')}: ${request.body.command || request.body.op}`), element('p', request.body.message || ''),
        button('Check status', () => withBusy(async () => { terminalCase = await recoverPending(terminalCase); terminalCase = await sync(terminalCase); })),
        button('Retry', () => withBusy(async () => { terminalCase = await recoverPending(terminalCase, true); terminalCase = await sync(terminalCase); })),
        button('Discard unsent action', async () => {
          const r = await api(terminalCase, 'operation', { operationId: request.operationId });
          if (['running', 'queued'].includes(r.status)) throw new Error('This operation is still running. Check its status first.');
          if (r.status === 'committed') { terminalCase = await persistResult(terminalCase, r.result, request.operationId); }
          else { await remove('requests', [terminalCase.caseId, request.operationId]); }
          await renderPending();
        }));
    }
    if ($('ex-send') && requests.length) $('ex-send').disabled = true;
  }
  async function renderReturnBrief() {
    const s = terminalCase?.snapshot; if (!s) return;
    const box = $('ex-return'), witnessId = s.standId || s.heardWitnessIds.at(-1);
    const witness = s.roster.find(x => x.id === witnessId)?.name || '—';
    const official = (await all('events')).filter(x => x.caseId === terminalCase.caseId && ['ruling', 'phase'].includes(x.kind)).slice(-3);
    box.hidden = false;
    box.replaceChildren(element('h2', t('Return brief')), element('p', `${t('Stage')}: ${t(s.stage)} · ${t('Last examined witness')}: ${witness}`),
      element('p', `${t('Visible unfinished leads')}: ${s.leads.filter(x => !x.completed).map(x => x.id).join(', ')}`), element('h3', t('Last official changes')),
      ...official.map(e => element('p', `#${e.seq} · ${e.text}`)));
  }
  async function continueJobs() {
    await withBusy(async () => {
      const result = await api(terminalCase, 'snapshot'); jobs = result.jobs || [];
      for (const job of jobs) await driveJob(terminalCase, job.id);
      terminalCase = await sync(terminalCase);
    });
  }
  async function loadArchive(reset = false) {
    if (reset) { archiveCursor = 0; $('ex-archive').replaceChildren(); }
    let data;
    if (navigator.onLine) data = await api(terminalCase, Object.keys(archiveFilters).length ? 'search' : 'archive', { ...archiveFilters, afterSeq: archiveCursor, limit: 50 });
    else {
      const records = (await all('events')).filter(e => e.caseId === terminalCase.caseId && e.seq > archiveCursor &&
        (!archiveFilters.actorId || e.actorId === archiveFilters.actorId) && (!archiveFilters.query || e.text.toLowerCase().includes(archiveFilters.query.toLowerCase())) &&
        (!archiveFilters.exhibitId || e.exhibitRefs.includes(archiveFilters.exhibitId)));
      data = { events: records.slice(0, 50), cursor: records[49]?.seq || records.at(-1)?.seq || archiveCursor, hasMore: records.length > 50 };
    }
    $('ex-archive').append(...data.events.map(eventCard)); archiveCursor = data.cursor; archiveHasMore = data.hasMore;
    $('ex-more').hidden = !archiveHasMore;
    if (reset && !data.events.length) $('ex-archive').append(element('p', t('No records found.')));
  }
  async function casePage(offset = 0, limit = 12) {
    return transact(['cases'], 'readonly', s => new Promise((resolve, reject) => {
      const records = []; let skipped = 0, more = false;
      const r = s.cases.index('createdAt').openCursor(null, 'prev');
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const cursor = r.result; if (!cursor) return resolve({ records, more });
        if (cursor.value.lifecycle === 'purgePending') { cursor.continue(); return; }
        if (skipped++ < offset) { cursor.continue(); return; }
        if (records.length === limit) { more = true; return resolve({ records, more }); }
        records.push(cursor.value); cursor.continue();
      };
    }));
  }
  async function renderShelf() {
    const container = $('ex-shelf'); if (!container) return;
    const { records, more } = await casePage(shelfPage * 12);
    container.replaceChildren();
    if (!records.length) container.append(element('p', t('No saved Extreme cases yet.')));
    for (const c of records) {
      const card = element('article', undefined, 'ex-card');
      const s = c.snapshot;
      card.append(element('h2', s?.title || t('Preparing brief')), element('p', s?.allegations || ''),
        element('p', s ? `${t(s.difficulty)} · ${t(s.stage)} · ${t('Turn')}: ${s.turn}` : c.caseId));
      card.append(button(s ? 'Review brief' : 'Continue saved jobs', async () => {
        const current = await read('cases', c.caseId);
        if (!current.snapshot) {
          await withBusy(async () => {
            const requests = (await all('requests')).filter(x => x.caseId === current.caseId);
            let updated = current;
            for (const request of requests) {
              const r = await api(updated, 'create', {}, 90000, request.body);
              updated = await driveJob(updated, r.jobId);
            }
            await renderShelf();
          });
        } else await reviewBrief(current);
      }), button('Delete', () => purge(c), 'ex-danger'));
      container.append(card);
    }
    const pages = $('ex-shelf-pages'); pages.replaceChildren(element('span', `${t('Page')} ${shelfPage + 1}`));
    const previous = button('Previous', async () => { shelfPage--; await renderShelf(); }); previous.disabled = shelfPage === 0;
    const next = button('Next', async () => { shelfPage++; await renderShelf(); }); next.disabled = !more; pages.append(previous, next);
    for (const job of await all('outbox')) {
      const pending = element('article', undefined, 'ex-warning'); pending.append(element('p', `${t('Deletion pending')}: ${job.confirmedTitle}`));
      pending.append(button('Retry', async () => { await cleanup(); await renderShelf(); }), button('Review pending deletion', async () => {
        let old = await read('cases', job.caseId);
        if (!old) throw new Error('The local deletion credentials are unavailable.');
        old = await sync(old, false);
        const confirmation = await purgePreparation(old); if (!confirmation) return;
        await put('outbox', { ...job, ...confirmation, snapshot: old.snapshot, operationId: uid(), body: null });
        await cleanup(); await renderShelf();
      }));
      container.append(pending);
    }
  }
  function setShelfMode(mode) {
    const standard = $('ex-standard-panel'), extreme = $('ex-extreme-panel');
    if (!standard || !extreme) return;
    standard.hidden = mode === 'extreme'; extreme.hidden = mode !== 'extreme';
    document.querySelectorAll('[data-ex-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.exMode === mode)));
    const url = new URL(location.href); url.searchParams.set('mode', mode); history.replaceState(history.state, '', url);
    if (mode === 'extreme') runSafely(renderShelf);
  }
  function setupShelf() {
    if (!$('ex-extreme-panel')) return;
    document.querySelectorAll('[data-ex-mode]').forEach(el => el.addEventListener('click', () => setShelfMode(el.dataset.exMode)));
    $('ex-shelf-generate').addEventListener('click', () => runSafely(generationDialog));
    $('ex-shelf-settings').addEventListener('click', () => runSafely(settings));
    setShelfMode(new URL(location.href).searchParams.get('mode') === 'extreme' ? 'extreme' : 'standard');
  }
  async function migrateBrowser() {
    const marker = await read('meta', 'legacyMigration'); if (marker?.complete) return;
    const sourceKeys = ['rest_your_case_state', 'ryc_pending_cases', 'ryc_shelf_cases'];
    const sources = sourceKeys.map(key => ({ key, raw: localStorage.getItem(key) }));
    const isExtreme = x => !!x && (x.extreme?.version || x.mode === 'extreme' || x.activeCaseSeed?.extreme?.version);
    const known = [], changes = [], backups = [];
    for (const source of sources) {
      if (!source.raw) continue;
      let value; try { value = JSON.parse(source.raw); } catch { continue; }
      const records = Array.isArray(value) ? value : [value], retained = [];
      for (const old of records) {
        if (!isExtreme(old)) { retained.push(old); continue; }
        const ex = old.extreme || old.activeCaseSeed?.extreme || old;
        const caseId = ex.caseId || old.caseId, capability = ex.capability || old.capability;
        if (!/^[0-9a-f-]{36}$/i.test(caseId || '') || !/^[A-Za-z0-9_-]{32,128}$/.test(capability || '')) {
          retained.push(old); warn('Legacy Extreme ownership is incomplete. Original browser data is retained for recovery.'); continue;
        }
        known.push({ caseId, capability, snapshot: ex.snapshot || null, createdAt: old.timestamp || Date.now(), lastSyncedSeq: 0,
          localRevision: 0, lifecycle: source.key === 'rest_your_case_state' ? 'active' : 'brief', legacyRecovery: old });
        backups.push(source);
      }
      if (retained.length !== records.length) changes.push({ key: source.key, value: Array.isArray(value) ? JSON.stringify(retained) : null });
    }
    if (known.length) {
      await lock(() => transact(STORES, 'readwrite', async s => {
        const active = await requestValue(s.meta.get('activeCaseId'));
        for (const c of known) {
          const present = await requestValue(s.cases.get(c.caseId));
          if (!present) s.cases.put(c);
          s.meta.put({ name: `legacyBackup:${c.caseId}`, value: c.legacyRecovery });
          if (c.lifecycle === 'active' && active?.value && active.value !== c.caseId) throw new Error('Two Extreme active cases need an explicit recovery choice. Neither was overwritten.');
          if (c.lifecycle === 'active') s.meta.put({ name: 'activeCaseId', value: c.caseId });
          const old = c.legacyRecovery;
          if (typeof old.notes === 'string') s.notes.put({ caseId: c.caseId, noteId: 'defense', text: old.notes });
          let seq = 0;
          for (const entry of old.transcript || []) {
            const text = entry.text || entry.content; if (typeof text !== 'string') continue;
            s.events.put({ caseId: c.caseId, seq: ++seq, id: uid(), actorId: 'DEFENSE', text, visibility: 'DEFENSE_PRIVATE',
              audienceActorIds: ['DEFENSE'], sworn: false, sourceEventIds: [], exhibitRefs: [], payload: { recoveredLocal: true } });
          }
          for (const request of Object.values(old._requests || {})) {
            if (request?.body?.apiVersion === 2 && request.body.operationId) s.requests.put({ caseId: c.caseId,
              operationId: request.body.operationId, body: request.body, recovered: true });
          }
        }
        s.meta.put({ name: 'legacyMigration', complete: true, backups });
      }));
      // Compare source strings again; another tab's changes are never cleared.
      for (const change of changes) {
        const original = sources.find(x => x.key === change.key).raw;
        if (localStorage.getItem(change.key) !== original) { warn('Legacy collection changed during migration. Recovery backups remain; no newer data was removed.'); continue; }
        if (change.value === null) localStorage.removeItem(change.key); else localStorage.setItem(change.key, change.value);
      }
    } else await put('meta', { name: 'legacyMigration', complete: true });
  }
  function translatePage() {
    document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ex-label]').forEach(el => el.textContent = t(el.dataset.exLabel));
    if ($('ex-language')) $('ex-language').textContent = language === 'ar' ? 'English' : 'العربية';
    if ($('ex-engine')) $('ex-engine').textContent = t('Smart · four-model cascade');
  }
  function setupTerminal() {
    if (!$('ex-terminal')) return;
    const menu = open => { $('ex-sidebar').hidden = !open; $('ex-backdrop').hidden = !open; $('ex-menu').setAttribute('aria-expanded', String(open)); };
    $('ex-menu').onclick = () => menu($('ex-sidebar').hidden);
    $('ex-menu-close').onclick = () => menu(false); $('ex-backdrop').onclick = () => menu(false);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
    $('ex-language').onclick = () => runSafely(async () => {
      language = language === 'ar' ? 'en' : 'ar'; localStorage.setItem('ryc_language', language); translatePage(); await renderTerminal();
    });
    $('ex-settings').onclick = () => runSafely(settings);
    for (const id of ['ex-generate', 'ex-sidebar-generate', 'ex-empty-generate']) $(id).onclick = () => runSafely(generationDialog);
    $('ex-purge').onclick = () => runSafely(() => purge(terminalCase));
    $('ex-sync').onclick = () => runSafely(() => withBusy(async () => {
      terminalCase = await recoverPending(await read('cases', terminalCase.caseId)); terminalCase = await sync(terminalCase); await cleanup(); status(t('Synced'));
    }));
    $('ex-recipient').onchange = () => runSafely(() => chooseRecipient($('ex-recipient').value));
    $('ex-compose').onsubmit = e => {
      e.preventDefault(); const message = $('ex-message').value.trim();
      if (!message) return;
      let cmd = terminalCase?.snapshot?.stage === 'closing' && ['JUDGE', 'PROSECUTOR'].includes(recipient) ? 'close' : 'speak';
      let target, actor = recipient, text = message;
      const match = message.match(/^\/(investigate|call|admit|exclude|foundation|disclose|trial|release|closing|verdict)\b\s*(\S+)?\s*([\s\S]*)$/i);
      if (match) {
        cmd = match[1].toLowerCase();
        if (cmd === 'verdict') { runSafely(() => withBusy(() => submit(terminalCase, mutation(terminalCase, 'verdict', {})))); return; }
        target = match[2]; text = match[3] || cmd;
        actor = cmd === 'investigate' ? 'DIAZ' : cmd === 'foundation' ? terminalCase.snapshot.standId : 'JUDGE';
      }
      runSafely(() => action(cmd, actor, target, text));
    };
    $('ex-message').oninput = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => runSafely(saveDraft), 150); };
    $('ex-notes').oninput = () => {
      clearTimeout(notesTimer); notesTimer = setTimeout(() => runSafely(async () => {
        await put('notes', { caseId: terminalCase.caseId, noteId: 'defense', text: $('ex-notes').value }); $('ex-note-status').textContent = t('Saved locally');
      }), 200);
    };
    $('ex-clear-cache').onclick = () => runSafely(async () => {
      await transact(['cases', 'events'], 'readwrite', async s => {
        const c = await requestValue(s.cases.get(terminalCase.caseId));
        if (c.localRevision !== terminalCase.localRevision) throw new Error('Another tab updated the case. Sync before discarding its cache.');
        await new Promise(resolve => { const r = s.events.openCursor(); r.onsuccess = () => {
          const cursor = r.result; if (!cursor) return resolve();
          if (cursor.value.caseId === c.caseId && cursor.value.seq <= c.lastSyncedSeq) cursor.delete(); cursor.continue();
        }; });
        c.lastSyncedSeq = 0; c.localRevision++; s.cases.put(c);
      });
      terminalCase = await read('cases', terminalCase.caseId); await renderTerminal();
    });
    document.querySelectorAll('[data-ex-tab]').forEach(el => el.onclick = () => {
      switchPanel(el.dataset.exTab); if (panel === 'archive') runSafely(() => loadArchive(true));
    });
    document.querySelectorAll('[data-ex-recipient]').forEach(el => el.onclick = () => runSafely(() => chooseRecipient(el.dataset.exRecipient)));
    $('ex-search').onsubmit = event => {
      event.preventDefault(); archiveFilters = {};
      for (const [field, id] of [['query', 'ex-query'], ['actorId', 'ex-search-actor'], ['exhibitId', 'ex-search-exhibit']])
        if ($(id).value.trim()) archiveFilters[field] = $(id).value.trim();
      runSafely(() => loadArchive(true));
    };
    $('ex-more').onclick = () => runSafely(() => loadArchive());
    $('ex-refresh-memory').onclick = () => runSafely(() => withBusy(async () => {
      const scope = ['JUDGE', 'PROSECUTOR'].includes(recipient) ? 'public' : 'actor';
      const result = await api(terminalCase, 'clerk', { actorId: recipient, scope, throughSeq: terminalCase.snapshot.lastSeq });
      if (result.jobId) await driveJob(terminalCase, result.jobId);
      terminalCase = await sync(terminalCase, false);
    }));
  }
  async function initialize() {
    translatePage(); setupShelf(); setupTerminal();
    try {
      await db(); await migrateBrowser();
      broadcast = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ryc-extreme-state') : null;
      if (broadcast) broadcast.onmessage = () => runSafely(async () => {
        if (terminalCase && !busy) { terminalCase = await read('cases', terminalCase.caseId); await renderTerminal(); await renderPending(); }
        await renderShelf();
      });
      await renderShelf();
      if ($('ex-terminal')) {
        const caseId = new URL(location.href).searchParams.get('caseId') || (await read('meta', 'activeCaseId'))?.value;
        terminalCase = caseId ? await read('cases', caseId) : null;
        if (terminalCase?.lifecycle === 'purgePending') { terminalCase = null; warn(t('Deletion pending')); }
        if (caseId && !terminalCase) warn(t('Case not found in this browser. Open its archive in the browser that owns it.'));
        if (terminalCase) {
          const gap = Date.now() - (terminalCase.lastAccess || terminalCase.createdAt);
          try { terminalCase = await recoverPending(terminalCase); terminalCase = await sync(terminalCase); status(t('Synced')); }
          catch (e) { warn(`${t('Offline: showing saved records. Official actions require the server.')}\n[${e.code || 'SYNC_ERROR'}] ${e.message}`); }
          const notes = await read('notes', [terminalCase.caseId, 'defense']); $('ex-notes').value = notes?.text || '';
          const savedRecipient = (await read('meta', `recipient:${terminalCase.caseId}`))?.value; if (savedRecipient) recipient = savedRecipient;
          await chooseRecipient(recipient, true);
          if (gap >= 6 * 3600000 && terminalCase.snapshot) await renderReturnBrief();
        }
        await renderTerminal(); await renderPending();
        if (!terminalCase?.snapshot) $('ex-empty').hidden = false;
      }
      if (navigator.onLine) await cleanup();
    } catch (e) { warn(`[${e.code || 'STORAGE_ERROR'}] ${e.message}`); if ($('ex-empty')) $('ex-empty').hidden = false; }
    window.addEventListener('online', () => { updateDisabled(); status('Connection available. Sync to refresh.'); });
    window.addEventListener('offline', () => { updateDisabled(); warn(t('Offline: showing saved records. Official actions require the server.')); });
    window.addEventListener('pagehide', () => {
      if (terminalCase) runSafely(async () => { await saveDraft(); await put('meta', { name: `recipient:${terminalCase.caseId}`, value: recipient }); });
    });
  }
  window.RYCExtreme = { generate: generationDialog, settings, db, read, all, t, migrateBrowser, accept, cleanup };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize); else initialize();
})();
