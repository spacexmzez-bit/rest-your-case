# JavaScript consolidation report

This update consolidates existing code only. It intentionally preserves existing game behavior and defects. No deployment was performed.

## Result

- Gameplay JavaScript: **38 files → 11 files**, counting the unchanged game.js/data.js and the existing Worker entry point. The previous plan’s “9” excluded game.js and data.js; 11 is the comparable total.
- All root JavaScript, including the excluded translation/library/service-worker files: **42 → 15**.
- **35 source modules → 8 consolidated files**. Two destination names already existed; 33 old paths are removed and six new paths are added.
- Largest consolidated file: **1,194 lines**. All remain below 1,500 lines. Counts include comments and blank lines.
- Smaller cohesive groups remain smaller instead of being padded or mixed with unrelated code.

| Consolidated file | Lines | Original sections |
|---|---:|---|
| extreme-rules.js | 585 | extreme-config.js, extreme-state.js, extreme-access.js, extreme-contracts.js, extreme-events.js |
| extreme-ai.js | 896 | extreme-prompts.js, extreme-ai.js, extreme-retrieval.js, extreme-actor.js, extreme-memory.js, extreme-verdict.js |
| extreme-server.js | 1128 | extreme-db.js, extreme-migration.js, extreme-actions.js, extreme-worker-case.js |
| ryc-runtime.js | 303 | ryc-i18n.js, ryc-models.js, ryc-request.js |
| standard.js | 1194 | game-state.js, ryc-dialogue.js, game-scene.js |
| cases.js | 491 | case-store.js, archive-trial.js, scout_prompt.js, cases.js |
| extreme-cases.js | 967 | extreme-store.js, extreme-client.js, extreme-browser-migration.js, extreme-archive.js, extreme-intake.js, extreme-catalog.js, extreme-shell.js, ryc-foundation-bridge.js |
| extreme.js | 754 | extreme-history.js, extreme-terminal.js |

The action handlers are grouped with the authoritative server lifecycle in extreme-server.js. Keeping them in extreme-rules.js would create a rules/AI initialization cycle; the handler bodies themselves are unchanged.

## Preservation checks

- All 35 merged source bodies compare equal as parsed JavaScript after accounting for import relocation, two private binding renames, and the two explicitly relocated startup calls. No gameplay statements or exported APIs were dropped.
- The prompt module’s private `str` and `ACTORS` bindings are named `promptString` and `actorInstructions` in the combined AI file to avoid collisions. Their values and references are preserved.
- Archive and Standard startup bodies remain intact and are invoked at their original HTML script positions through RYCStartArchive() and RYCStartStandard().
- All pre-existing inline HTML scripts are unchanged. Script URLs and dependency loading point to the merged files.
- worker.js changes only the two Extreme module references. The ExtremeCase export, Worker route logic, Durable Object identity, and wrangler.toml are retained.
- Service-worker changes are limited to its cache version and merged asset paths.
- game.js, data.js, SYSTEM_PROMPT, extreme-data.v1.json, translation dictionaries, and legal-library JavaScript remain byte-for-byte unchanged.
- Existing storage keys, database tables, capabilities, operation identities, AP calculations, prompts, evidence permissions, recovery logic, and model settings are retained.

game.js SHA-256: `d3c3c3c5e331acd55cd3c11e10fa3e4fc3c4b452591e65f372aa741f62040317`.

## Validation

**139 automated checks passed:** all 128 pre-merge checks still pass, plus nine consolidation/layout checks and two complete-bundle integration checks.

| Suite | Passed checks |
|---|---:|
| foundation-bugfix.test.mjs | 12 |
| foundation-client.test.cjs | 1 |
| foundation-hardening.test.mjs | 9 |
| foundation-intake.test.cjs | 1 |
| foundation-language-startup.test.cjs | 8 |
| foundation-migration.test.cjs | 4 |
| foundation-review.test.mjs | 15 |
| foundation-store.test.cjs | 8 |
| foundation-terminal.test.cjs | 24 |
| foundation.test.mjs | 19 |
| merge-bundles.test.cjs | 2 |
| merge-layout.test.cjs | 9 |
| standard-ap.test.cjs | 15 |
| standard-intake.test.cjs | 4 |
| standard-language.test.cjs | 8 |

All 15 root JavaScript files passed syntax checks. The complete-bundle checks load actual consolidated browser scripts and exercise case generation, activation, terminal initialization, durable actions, phase progression, and isolation of the Standard save in English and Arabic. DOM and IndexedDB are simulated; model responses are mocked. Existing SQL regressions include the 200–300-turn scenarios.

Real-browser execution was attempted but Chromium is absent in this environment. Live Gemini behavior and browser rendering were not verified. The existing real-browser CI gates remain in the deployment workflow, with the new checks added before them.

Unit tests read named source sections from the actual deployed bundles through tests/merged-source.cjs. This retains their original isolation and expectations without maintaining copies of production code or obsolete runtime wrapper files. Complete-bundle checks separately verify the combined loading behavior.

## Existing issue observed and deliberately preserved

**Corrupt legacy Standard JSON can block Extreme startup.** In extreme-cases.js, the `extreme-browser-migration.js` section, `RYCExtremeMigration.run()` parses `rest_your_case_state` and the old archive arrays without guarding malformed JSON. The terminal awaits this migration during startup. The same SyntaxError was reproduced against the pre-merge and merged implementations. No fix was applied.

## Apply this update

1. Apply this package to the current audited Foundation project, including the archive-startup hotfix.
2. Copy every file in the ZIP to its matching repository path, including the .github workflow and tests. Keep all other assets and files.
3. Delete the 33 obsolete repository paths listed in MERGE-REMOVED-FILES.txt in the same commit. A ZIP overlay alone cannot remove those files.
4. Use the repository’s normal deployment process for both the site and Worker. This package has not been deployed.

No save clearing, storage reset, or new Durable Object migration is required. Keep game.js as it is.
