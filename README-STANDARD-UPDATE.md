# RYC Standard update

This patch is based on the supplied pre-Extreme `rest-your-case-main.zip`. It includes only changed or new files. It retains Standard complexities 1–5, existing case storage, AP rules, occupation locks, courtroom behavior and the Scout/Engine separation. It does not activate Extreme.

## Install

1. Extract this ZIP into the root of your existing RYC repository, replacing matching files. Keep your existing images, icons and other unchanged files.
2. Commit **all files from this patch**, including `standard-support.js`, `tests/standard-update.test.mjs` and `.github/workflows/deploy-worker.yml`, and push to `main`. Deleting files in Codespaces alone does not change GitHub until the deletion is committed and pushed.
3. GitHub Actions checks the supplied scripts and runs the included dependency-free tests, then deploys the Worker through the existing `wrangler.toml`. Keep your existing `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and Worker `GEMINI_API_KEY` configuration.
4. Let your existing GitHub Pages deployment publish the frontend, then reload the site. Both the updated frontend and Worker are required. Keep the new dependency alongside `game-state.js` anywhere that script is reused.

If your ZIP viewer hides `.github`, `deploy-worker.yml.txt` is a visible copy. Its content belongs at `.github/workflows/deploy-worker.yml`, not at the repository root as a YAML workflow. The test file referenced by the workflow is included.

### Direct Cloudflare editor alternative

`worker-cloudflare.txt` is a **self-contained** copy of the new Worker with its shared code already combined. Paste its entire contents into the existing Cloudflare Worker and deploy. It includes the inactive `ExtremeCase` compatibility export; do not remove that class from an account with an existing namespace. This patch does not delete Durable Objects or require a new binding.

The repository's `worker.js` imports `standard-support.js`, `data.js` and `game-state.js`; **do not paste that modular file alone** into a single-file dashboard editor. GitHub/Wrangler deployment uses those imported files. A subsequent repository deployment will overwrite a dashboard edit, so keep repository files current whichever installation route you choose. The TXT is a generated convenience snapshot, not the repository entry point.

## Changes

- Court and Diaz evidence updates merge by stable exhibit ID. An omitted row no longer removes earlier evidence. Existing suppression/admission status survives Diaz updates. Newly discovered facts accumulate.
- Diaz must return an atomic investigation report: remaining AP, cost, saved exhibits or factual findings, a result summary and an additional insight spoken in chat. A malformed result is rejected before state or AP changes; the Worker can try the next model. Negative searches remain findable under investigation findings even when they create no exhibit. New discoveries are Marked, not automatically admitted.
- Notebook evidence refreshes while play progresses. Manual exhibits have Edit/Delete controls in the notebook and evidence document; editing retains annotations and status. New manual entries start Marked. Deletion asks for confirmation and removes that entry's annotations. Manual notes do not establish evidence independently of the game.
- Diaz and Partner receive their own last eight original history entries, relevant older originals, recent court exchanges and older correction records. Original histories remain saved. Their private conversations are kept separate. The clerk is a deterministic index, so it adds no AI request. Retrieval is bounded and cannot guarantee perfect recall; ambiguous questions should receive clarification rather than invented memory. A fresh consultation always includes the immediately preceding exchange. Private intake initialization is excluded from consultation retrieval; only Diaz receives the fixed investigation reference for resolving discoverable work. Partner sees the public case record.
- New violent-crime cases sample a named victim from `data.js` naming pools, with a fixed gender, and require that name in the public allegation and private chronology. Named witness rosters are sampled as well. Existing case identities and truths are not regenerated.
- Character labels show `[F]` or `[M]` where explicit roster/registry metadata exists. Diaz and Partner are excluded. Legacy characters without metadata are not assigned a gender by guessing their names.
- Archive and purge shortcuts are removed from the Rooms menu. Existing archive access elsewhere and the separate purge control remain available.
- Partner guidance varies by Sandbox/Easy/Normal/Hard. The `!` button beside Trial Rules in brief generation explains the difference. Sandbox gives obvious directional hints without revealing the solution; Hard gives minimal general clarification.
- Offers & disclosure now reads structured records. **The chosen design is hybrid:** offer categories and constraints live in `GAME_DATA.offer_rules`; the AI writes case-specific terms from the known record. The DA may decline. Offer IDs and original terms are immutable; changed proposals need a new ID. The player can reject, or ask the judge to approve exact saved terms. Only explicit acceptance plus judicial approval resolves the case as a negotiated outcome. Requests/discussions cannot silently accept a deal. Proposals have turn-based expiration and reference existing evidence. Disclosures link to docket exhibits. These are fictional gameplay proposals, not a statutory sentencing database.
- The small **Dev · tokens** tab opens a development meter. It records overall and last-request input/output, reported thinking, provider-cached input and identical full-input repeats. Output includes reported thinking; cached input is already part of input and is not added twice. Cascade attempts, including rejected but billed model output, count when usage is reported. A network failure or missing usage is unknown, not zero-cost usage. Exact full-input repeats are separate from prefix repetition and provider cache hits; they do not imply discounted billing. Counts and hashes are stored in this browser, never API keys or request text. Reset affects only this meter.

Model routing remains separate: Smart uses 3.8 → 3.7 → 3.6 → 3.5 Flash; Light uses 3.5 Flash Lite → 3.1 Flash Lite. Standard Scout uses the Lite cascade independently of the chosen Engine mode. Engine and Scout retain their different prompts and response formats.

## Validation

Run from the repository root with Node 24:

```bash
node --test tests/standard-update.test.mjs
node --input-type=module --check < worker.js
```

Automated coverage includes incremental evidence/fact updates, admission preservation, invalid investigation rollback, zero-cost advice, duplicate operations, manual entry/edit/delete, private-context isolation, violent-case sampling, explicit genders, offer acceptance/rejection/expiration, disclosures, legacy state normalization, model cascades, token aggregation, page dependency order, inline script syntax and document control behavior. API responses are mocked; tests spend no model tokens and deploy nothing.

The self-contained Worker is checked against the modular sources and exercised with the same mocked runtime. All supplied JavaScript and HTML inline scripts passed syntax checks. Browser document tests use a lightweight DOM adapter. **A real Chromium browser was unavailable here, so live visual/browser testing and a real Cloudflare/Gemini deployment have not been performed.**

After deployment, check: generate a violent case; open the `!` explanation; ask Diaz for a subpoena and follow-up; compare his reply with the docket; edit/delete a manual entry; request disclosure and an offer in the DA office; reject one proposal or explicitly ask the judge to approve one; inspect the token meter. Old conversations are preserved, but previously omitted findings cannot be reconstructed reliably from nowhere—ask Diaz a specific follow-up if an older result was never saved.

Provider usage field reference: [Gemini UsageMetadata](https://ai.google.dev/api/generate-content#UsageMetadata). Workflow Node setup follows the [official setup-node action](https://github.com/actions/setup-node).
