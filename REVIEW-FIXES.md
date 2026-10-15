# RYC Standard code review — correction patch

Apply this ZIP **over the previously supplied RYC Standard update**, replacing matching files. It contains only files changed by this review. Commit/push the corrected files to deploy the Worker and frontend, then reload the game. The HTML asset versions are updated to fetch the corrected scripts.

If you deploy directly in Cloudflare, replace the complete Worker with `worker-cloudflare.txt` from this patch. That standalone file is regenerated from the corrected modules and still exports the inactive `ExtremeCase` compatibility class. The existing workflow and Wrangler configuration remain applicable.

## Confirmed and corrected bugs

| Priority | Location | Trigger and impact | Correction |
|---|---|---|---|
| High | `standard-support.js`, `mergeDocket` | An existing exhibit has `details`, and its update supplies `facts` or `title`. Older aliases win, silently discarding the new description or name. | Incoming aliases take priority; existing aliases are synchronized. |
| High | `worker.js`, response validation | `/undo` legitimately refunds AP. Browser validation permits it, but Worker validation omitted the undo option, rejects every fallback response, and can consume several model calls. | Worker and browser apply the same explicit undo rule; Hard restrictions remain enforced. |
| High | `standard-support.js`, offer validation | A proposal sets `phase: "Case closed"` without `trialEnded:true`. The old guard allows it; the UI treats the case as ended and can expose the resolution. | Offer requests/proposals/rejections cannot end the case through either completion mechanism without explicit acceptance. |
| High | `standard-support.js`, clerk source extraction | An older untagged court reply contains a sealed-truth appendix. The clerk copies it into Partner context. | Legacy sealed appendices and internal reference sections are removed before retrieval. Original saved transcripts are retained. |
| Medium | `standard-support.js`, public snapshots | Full investigation reports include Diaz's private strategic insight. Sending them to the court also exposes that advice to the DA/judge engine. | Public snapshots include only prior investigation IDs for duplicate detection. Public findings remain available in the docket/facts; full private reports remain saved for the player. |
| Medium | `standard-support.js`, offer expiry | The UI permits acceptance on the last valid turn, but validation advances the turn and expires the offer before processing the choice. | Availability is checked at submission; accepted/rejected choices complete before remaining proposals expire. |
| Medium | `standard-support.js`, legacy evidence | A valid older exhibit has no saved description. A status-only ruling is rejected as if it were an incomplete new exhibit. | Existing sparse records accept incremental updates; new exhibits still require complete content. |
| Medium | `game-scene.js`, open documents | Evidence arrives while an annotation has focus. The entire document refresh is skipped, leaving the visible docket stale. | Refresh adds the new evidence and restores the active editor's text, selection and scroll position. |

## Verification

The original 18 checks passed before the review. Seven newly added regression tests failed against the delivered code, then passed with these corrections. The existing document-control test was extended to cover arrivals during annotation editing. The final suite has **25 passing tests**.

Additional checks: modified JavaScript syntax, HTML inline scripts and dependency order, actual Node import of the modular Worker, and consistency/execution of the standalone Worker snapshot. Provider responses and document controls are tested with mocks/adapters. No real-browser, live Gemini, or production Cloudflare deployment test was performed. These findings do not establish that every possible bug has been eliminated.

Run the checks from the repository root:

```bash
node --test tests/standard-update.test.mjs
node --input-type=module --check < worker.js
```
