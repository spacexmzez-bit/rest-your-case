# Foundation validation report

## Result

Implementation and local mechanical verification completed. This is not a claim that all of the execution PDF's production release gates have passed.

| Check | Result |
| --- | --- |
| Application and inline JavaScript syntax | Passed |
| Deterministic tests with actual SQLite storage | 22 passed |
| 300-turn mocked trial: originals, order, fixed truth, AP, exclusions and verdict coverage | Passed |
| 40 English + 40 Arabic explicit-source/privacy retrieval probes with synthetic records | Passed |
| Smart/Light cascades and separate Standard Scout/engine prompts | Passed with mocked upstream responses |
| Late/replayed operations, expired cases, conflicting tabs and SQL rollback | Passed with injected failures |
| Original Standard prompts | Byte-identical to supplied ZIP |
| Standard `data.js`, `game-state.js`, `scout_prompt.js`, photos/icons | Unchanged |
| Browser test suite | Included; not executed successfully here |
| Actual Cloudflare runtime/deployed migration | Not run here |
| Live Gemini schema/model access, role semantics, cost and latency | Not run here |
| Exact migration of the missing previous Extreme version/non-bank cases | Not certified; unknown originals are preserved/quarantined |

This session had the Playwright JavaScript package but no Chromium executable. Downloading Chromium was blocked by the session network policy (HTTP 403). The included GitHub workflow installs it and requires the browser suite to pass before deploying the Worker. A failed browser gate stops deployment and reports its failing step.

The browser suite uses actual Chromium and the real application files, with an in-process SQLite-backed server and mocked model responses. It checks draft resume, the playable court controls, lost-response recovery, offline notes, RTL/mobile width, sidebar navigation, archive tab isolation, new generation, title-confirmed replacement and preservation of Standard browser storage. Those checks are currently pending, not counted among the 22 local passes.

## Remaining live gates from the specification

Before declaring a production Foundation release, use a test Worker namespace and real permitted Gemini keys to:

1. Confirm access/schema/token-count support for every requested cascade model. The test responses cannot establish actual model availability.
2. Run the Chromium suite and manual real-browser checks in both languages, including storage quota, multiple tabs and multi-day resume.
3. Test actual old Extreme records if there are any on the deployed namespace. The provided baseline contains no old Extreme schema or fixtures; unknown records must remain preserved until an exact adapter is tested.
4. Review at least four real end-to-end cases across both languages and difficulties, including two reaching 200 turns.
5. Annotate at least 40 live retrieval probes per language. Require all critical privacy/explicit-source checks and at least 95% relevant-source recall.
6. Evaluate assigned lies, uncertainty, authentication and rulings semantically. Require no consequential unsupported ruling and no role/private-data breach in the evaluation set; aim below 1% unsupported factual assertions in the annotated sample.
7. Measure total tokens across cascades, Clerk and retries, and ordinary actor input p95. No live usage, cost or latency numbers were measured here.

The implementation rejects unknown references and mechanical state changes, preserves every original source, and requires source coverage for verdict commitment. Those checks cannot prove that a model interpreted every source correctly.

## Fixed tuning used by this build

- API version 2; new blueprint/state version 2; actor/generation/brief prompts v2; Clerk extraction v1.
- Storage: SQLite case objects; `ryc_extreme_v2` browser database version 1.
- Public archive pages: 50 events maximum. UI exchanges show the latest 30 cached events; the Archive panel pages the complete record.
- Message length: 1–2,400 characters; read body 16 KiB, mutation body 32 KiB.
- Per-model call deadline: 35 seconds. Client action window: 60 seconds; initial generation step window: 90 seconds. Persisted operation recovery lease: 6 minutes, covering the whole configured cascade.
- Actor input ceiling: 10,000 tokens; Clerk 6,000; generation/verdict review/synthesis 12,000; public brief 8,000. The final serialized prompt is counted using `countTokens`.
- Output ceilings: actor 1,200; Clerk 1,000; generation 10,000; brief 6,000; source review 2,000; consolidation/final verdict 3,000.
- Clerk scheduling: 16 new permitted event rows (eight exchanges), or a conservative 12,000-character preflight, then exact final token checking. At most one model job purpose is executed in each explicit continue request. Semantic review is an additional Smart call only for a consequential authentication/ruling action.
- Inactivity expiry: 90 days. Purge title nonce: 10 minutes. Archived originals are never silently removed to meet a prompt budget.

This consolidates the specification's proposed small modules into two substantial runtime files. There are no Phase 1 advanced selectors, Phase 2 enhanced workspace, hired lawyers/rollback, Keyo, accounts, new art or player PDF reports in this update.
