# Extreme HTTP 400 fix

Apply this patch on top of the previously supplied Foundation update. It contains only:

- `extreme-worker.js`
- `extreme.js`
- `tests/foundation.test.mjs`
- This instruction file

## Install

Replace these files in the same GitHub repository, preserving their paths. Commit the update, wait for **Deploy RYC Worker** to succeed, and hard-refresh the site. The existing workflow detects changes to the backend and test file and deploys the backend using Wrangler. No Worker dashboard paste, migration change, secret change or data deletion is needed.

To retry the failed generation, open **Extreme archive** and press **Continue saved jobs** on its unfinished brief. That reuses the saved case identity and any already generated blueprint. Avoid deleting the failed brief merely to retry it.

## Corrected defect

The REST `countTokens` request wrongly placed `systemInstruction` beside `contents` at the top level. Google accepts the complete request inside `generateContentRequest`, with the model, contents, system instructions and generation configuration nested there. The corrected code counts the same request that it later sends for generation.

The screenshot's generic HTTP 400 hid which call failed. Provider errors now identify model/method/status and include the provider's error message, while redacting API keys and complete prompt strings. Raw provider bodies are not exposed. Non-JSON gateway bodies are not displayed wholesale.

The browser also clears its misleading Working status when an operation fails, while preserving the request for retry.

Smart remains the four-model 3.8→3.7→3.6→3.5 Flash cascade; Light remains 3.5→3.1 Flash Lite. Extreme Scout/engine stay Smart and Clerk stays Light. Existing Standard code, case logic, prompts, storage and migration configuration are not changed by this patch.

## Verification

All 24 local SQLite/transport/syntax tests passed. The new tests exercise the real HTTP dispatcher with a provider-shaped stub that rejects the malformed token request, and verify provider-message reporting and redaction. These tests use simulated upstream responses; no live Gemini call was verified in this session. If another request is rejected, the new detailed error should identify the remaining cause.

Official request-body reference: https://ai.google.dev/api/tokens
