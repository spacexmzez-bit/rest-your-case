# Rest Your Case — Extreme Foundation update

This patch is built against `rest-your-case-main-5.zip` (GitHub archive commit `6d1ec86503bfc4caa535979360851487d2afee31`). It contains only new and modified files. Keep all other repository files, including the existing photos, icons, Standard data and prompts.

## Install using the existing GitHub deployment

1. Extract this ZIP. Copy its contents into the repository root, preserving paths. The workflow belongs at `.github/workflows/deploy-worker.yml` (plural **workflows**). Replace the included existing files; add the new ones. Do not replace the repository with only this patch.
2. Keep your existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets. Keep the existing Cloudflare Worker name `rest-your-case` and `GEMINI_API_KEY` Worker secret. An optional browser API key continues to work for both modes.
3. `wrangler.toml` adds the `EXTREME_CASES` binding and SQLite class `ExtremeCase` under migration tag `extreme-v1`. If your deployed Worker already has this class/tag from an earlier Extreme update, preserve that exact migration history and binding. Do not rename an applied migration or create a replacement namespace. This supplied pre-Extreme ZIP contained no previous binding/history; the patch introduces its first documented binding.
4. Commit the files. GitHub Actions runs syntax/SQL checks, installs Chromium, runs the browser suite, and then deploys `worker.js` and its imported `extreme-worker.js` using Wrangler. No code needs pasting into the Cloudflare dashboard.
5. Wait for **Deploy RYC Worker** to pass before using Extreme. Keep your existing frontend/GitHub Pages publishing setup and all unchanged files. Frontend and Worker deployments can finish at different times; `/extreme` reports a structured deployment error until the backend is ready.
6. Hard-refresh the site. Open **Extreme terminal** from the sidebar, or **Generate Extreme brief** from the overview. The archive has independent **Standard** and **Extreme** tabs with generation available during active trials.

The frontend keeps the existing Worker endpoint (`https://rest-your-case.spacexmzez.workers.dev/`). The new API is its `/extreme` path. If you change this endpoint later, update the constant in `extreme.js` as well as the existing Standard constants.

## Code organization

- `extreme-worker.js`: one consolidated Extreme backend containing catalog, strict runtime schemas, Scout and engine prompts, durable case state, event archive, role access, deterministic retrieval, Clerk, generation/verdict jobs and purge/migration handling.
- `extreme.js`: one consolidated browser file containing isolated storage, transport, recovery, archive and terminal rendering.
- `extreme.html`: separate terminal HTML. `extreme.css`: scoped styles shared with the Extreme archive controls.
- `worker.js`: preserves existing Standard prompts and routes; adds `/extreme` dispatch and the requested second Light fallback.
- Existing HTML pages add navigation; overview/archive add independent generation. `game.js` adds a protective legacy Extreme redirect. `archive-trial.js` lets Standard acceptance reuse its existing purge semantics atomically.

Both main Extreme JavaScript files are below 1,500 lines. Test files are separate from application logic.

## Model routing

| Purpose | Cascade |
| --- | --- |
| Standard Scout | `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` |
| Standard engine, Smart preference | `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` |
| Standard engine, Light preference | `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` |
| Extreme Scout, localization, actors, consequential review, verdict | The four-model Smart cascade only |
| Extreme Clerk | The two-model Light cascade only |

Extreme ignores the Standard engine preference. Its case creation contract requires `engineMode: smart`; later requests cannot supply state deltas or change that selection. The original Standard Scout, court, Partner and Diaz prompts are unchanged. Extreme generation and gameplay use separate versioned prompts and schemas; they do not receive the Standard prompts or case seed.

The ZIP's original Light route had only the first Light model. This patch supplies the requested second fallback. A cascade failure remains explicit; Extreme never falls back from Smart to Light. Authentication failures stop the cascade. Defaults in Wrangler match the documented first model and are validated by the backend. Verify these exact model names and access in your Gemini project before live use.

## Playing Foundation

Only bank cases are enabled in the new generator. Two scenario directions are implemented: disputed robbery/aggravation, and bank funds/false entries. A case has six fixed witnesses, twelve exhibits and eight investigation leads. E01–E04 are initially marked. Each lead unlocks its corresponding E05–E12. A08 becomes visible after four courtroom question turns. Investigation costs are 1 or 2 AP and are charged once on a successful commit.

AP uses the essential route, including required dependencies: Sandbox stores 1,000,000 and displays Unlimited; Easy uses 2.50×, Normal (displayed Medium) 1.75×, Hard 1.00×. Stage changes do not replenish AP. Software/model failures do not spend AP or add strikes.

Accept the brief, prepare/investigate and interview, begin trial, call witnesses, question them, authenticate source exhibits, disclose discoveries, make admission/exclusion motions, release the witness, enter closing, submit defense closing arguments and request a verdict. The verdict job reviews every required original public source in batches, consolidates reviewed findings and decides both counts separately. Private truth and consultations never enter its proof record. Excluded/marked items remain labeled and cannot act as admitted exhibit evidence. The sealed resolution becomes available after the verdict.

Controls issue typed backend commands. The compose box also recognizes `/investigate A01`, `/call W01`, `/foundation E01 question`, `/admit E01 argument`, `/exclude E01 argument`, `/disclose E01`, `/trial`, `/release`, `/closing` and `/verdict`. Choose recipients explicitly for ordinary messages. Partner and Diaz advice are free consultations; paid investigation goes through the named lead control.

Clerk is an incremental record organizer. It receives only the actor's permitted original records, cites source IDs and has a separate memory version. An ordinary action saves first; the browser then explicitly requests a Clerk step when work is pending. **Refresh Clerk memory** and **Continue saved jobs** resume remaining work. Background alarms never run models or store an API key.

## Storage, recovery and deletion

Extreme uses `ryc_extreme_v2` IndexedDB and a separate active pointer, locks and broadcast channel. Standard retains its existing keys and save format. Switching archive tabs does not accept or delete anything.

Each mutation identity is saved before sending. A lost reply leaves a visible pending action: check status, retry the same identity, or discard a confirmed uncommitted action. A committed receipt cannot spend AP or append events twice. A new revision requires reviewing the saved text before issuing a new request. Generation freezes truth before localization, so localization retries do not regenerate the mystery.

The SQL archive retains original questions, answers, official rulings and private exchanges separately; it has no FIFO cap. Court/Clerk packets are bounded, but archived records are retained. Required-source overflow produces an explicit narrowing/review error rather than silent deletion. Verdict jobs store source references rather than a second giant transcript value.

Offline, cached records are readable and notes/drafts remain editable. Official actions require the backend. A return brief appears after six hours and is also available from the Case panel. Clearing synced event-cache pages retains ownership, drafts and notes and permits a later re-download.

Extreme deletion requires the exact title and a second confirmation with **Keep case** focused. Replacement switches the new active pointer and saves an old-case cleanup job atomically. Failed cleanup stays visibly **Deletion pending**, with retry and fresh-review controls. Purge is idempotent, revokes the case and deletes SQL records plus legacy KV recovery copies; it retains a minimal denial receipt. It cannot erase provider backups or copies you exported yourself.

Case ownership is browser-bound. A shared Gemini key is not a recovery credential. Live cases expire after 90 days of inactivity; model/Clerk background work does not refresh that period. After the initial tombstone retention, a minimal revoked ID stays blocked to prevent stale creation from resurrecting it.

## Legacy boundary

The supplied ZIP had no Extreme implementation or legacy Extreme fixtures. Its Standard saves do not need a format migration. Marked browser Extreme entries with usable case ownership are copied into isolated storage before Standard collections are changed; backups remain. Supported legacy server records import surviving testimony/history/receipts conservatively. Unrecognized formats are quarantined with original data preserved, rather than fabricated or overwritten. Previously trimmed events cannot be reconstructed.

Compatibility reads are available through an API v1 adapter; v1 gameplay mutations require migration. Exact compatibility with the missing older Extreme blueprint/layout, and continuation of its non-bank catalogs, cannot be certified from this starting ZIP. Do not roll this update onto an existing Extreme namespace without testing its actual stored fixtures on a test namespace first. No old Standard data or assets are discarded to handle that uncertainty.

## Verification and remaining release gates

See `FOUNDATION-VALIDATION.md`. The deterministic suite uses actual SQLite and mocked model responses. Run:

```sh
node --test tests/foundation.test.mjs
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install --with-deps chromium
node tests/foundation.browser.mjs
```

Browser screenshots and test output are temporary and excluded from the delivery ZIP. No real API keys, browser ownership credentials or generated private game records are included.

## Platform references

The storage/transaction, migration and structured-output implementation follows the [Cloudflare SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Cloudflare migration documentation](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output) and [Gemini token counting documentation](https://ai.google.dev/gemini-api/docs/tokens). These references do not establish access to any particular model in your account.
