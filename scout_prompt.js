/**
 * File: scout_prompt.js
 * Rest Your Case - Fast Scout Synthesis Engine & Bridge
 * 
 * Takes the randomized seed packet produced by `sampleCaseDocket()` 
 * and formats the prompt for the fast model (Flash) to synthesize 
 * the narrative background, starter discovery, and the unvarnished truth.
 */

// Note: SCOUT_SYSTEM_INSTRUCTION is securely housed in the Cloudflare Worker.
// It is no longer duplicated here to ensure a single source of truth.

/**
 * Builds the user prompt payload sent to the Scout model
 * @param {object} caseSeed - Output from sampleCaseDocket()
 * @returns {string} Fully articulated synthesis prompt with strict word limits
 */
function buildScoutPrompt(caseSeed) {
  return `Generate a complete criminal defense case docket based on these randomized trial parameters:

PARAMETERS:
- Complexity Level: ${caseSeed.meta.complexity} / 5
- Charge: ${caseSeed.charge.charge} (${caseSeed.meta.genre_name})
- Statutory Definition: ${caseSeed.charge.statutory_definition}
- Required Mens Rea: ${caseSeed.charge.mens_rea}
- Presiding Judge: ${caseSeed.roster.judge.name} (${caseSeed.roster.judge.style})
- Prosecutor: ${caseSeed.roster.da.name} (${caseSeed.roster.da.style})
- Defendant / Client: ${caseSeed.roster.client.name}
- Venue / Setting: ${caseSeed.narrative_seeds.venue.name} (${caseSeed.narrative_seeds.venue.category})
- Primary Evidence Anchor: ${caseSeed.narrative_seeds.primary_evidence_anchor.item} (${caseSeed.narrative_seeds.primary_evidence_anchor.type})
- Constitutional / Evidentiary Flaw: ${caseSeed.narrative_seeds.constitutional_flaw.flaw} (${caseSeed.narrative_seeds.constitutional_flaw.legal_basis})
- Witness Friction: ${caseSeed.narrative_seeds.witness_friction.friction}
- Client Complication: ${caseSeed.narrative_seeds.client_complication.complication}

MANDATORY JSON OUTPUT SCHEMA AND WORD LIMITS:
{
  "case_title": "State v. [Defendant Last Name]",
  "crime_summary": "A 1-2 sentence punchy factual allegation summarizing what the State claims occurred (Max 40 words).",
  "starter_exhibits": [
    {
      "id": "Ex. 1",
      "name": "[Title of Evidence Anchor Item]",
      "type": "${caseSeed.narrative_seeds.primary_evidence_anchor.type}",
      "status": "Marked",
      "details": "Precise chain of custody log, timestamps, and physical description containing the subtle procedural or factual flaw (Max 25 words)."
    },
    {
      "id": "Ex. 2",
      "name": "[Title of Corroborating Report, Dispatch, or Photo]",
      "type": "Documentary",
      "status": "Marked",
      "details": "Preliminary police report, coroner note, or witness statement setting the state's timeline (Max 25 words)."
    }
  ],
  "unencrypted_truth": "The absolute, unvarnished reality of what actually occurred at the venue, who did it, and how the flaw explains the police mistake (Max 50 words).",
  "client_opening_dialogue": "Exactly two direct sentences spoken by the defendant in holding to Lead Defense Counsel to open Phase 1 intake."
}`;
}

/**
 * Normalizes the Scout model's JSON response and validates all required keys.
 * @param {string|object} rawResponse - The text or parsed JSON returned by the model
 * @returns {object} Clean case brief ready for local client hydration and Main Engine handshake
 * @throws {Error} If the JSON is malformed or missing required schema keys
 */
function parseScoutResponse(rawResponse) {
  let parsed;
  if (typeof rawResponse === "string") {
    // Strip accidental markdown fences if returned despite JSON mode
    const cleanJson = rawResponse.replace(/```(?:json)?/gi, "").trim();
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error("Failed to parse Scout response. Model returned malformed JSON.");
    }
  } else {
    parsed = rawResponse;
  }

  // Strict Validation: Ensure all requested keys exist so the engine doesn't crash on Turn 1
  if (!parsed.case_title || !parsed.crime_summary || !parsed.starter_exhibits || !parsed.unencrypted_truth || !parsed.client_opening_dialogue) {
    throw new Error("Model returned incomplete JSON schema. Missing required case fields.");
  }

  if (!Array.isArray(parsed.starter_exhibits) || parsed.starter_exhibits.length < 2) {
    throw new Error("Model failed to generate the required starter exhibits.");
  }

  return {
    caseTitle: parsed.case_title,
    crimeSummary: parsed.crime_summary,
    starterExhibits: parsed.starter_exhibits,
    unencryptedTruth: parsed.unencrypted_truth, // Returned as plain text for the engine payload
    clientDialogue: parsed.client_opening_dialogue
  };
}

// Module export for Node or Browser inclusion
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildScoutPrompt,
    parseScoutResponse
  };
}
