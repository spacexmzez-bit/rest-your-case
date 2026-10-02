/**
 * File: scout_prompt.js
 * Rest Your Case - Fast Scout Synthesis Engine & Bridge
 * 
 * Takes the randomized seed packet produced by `sampleCaseDocket()` 
 * and formats the prompt for the fast model (Flash) to synthesize 
 * the narrative background, starter discovery, and sealed Base64 truth.
 */

const SCOUT_SYSTEM_INSTRUCTION = `You are the Fast Scout narrative synthesizer for "Rest Your Case", a fair-play procedural legal mystery simulation.
Your sole job is to take raw procedural case seeds and assemble them into a coherent, realistic criminal case file.

CORE GENERATION RULES:
1. FAIR-PLAY HARMONY: The Venue, Evidence Anchor, Constitutional Flaw, Witness Friction, and Client Complication must weave together logically.
2. DIRTY HANDS / CULPABILITY LEVEL:
   - Level 1-2: Client is factually innocent; prosecution relies on mistaken identity or faulty forensics.
   - Level 3: Client is innocent of the primary charge, but was engaged in an uncharged illicit act explaining their suspicious actions or timeline gaps.
   - Level 4: Client committed the physical act, but the statutory charge is an overreach (e.g. lack of premeditation or heat of passion).
   - Level 5: Client is factually guilty; the case relies on constitutional suppression of tainted evidence.
3. OUTPUT FORMAT: Respond strictly with a valid JSON object matching the exact schema provided. Do not enclose in markdown code fences unless required.`;

/**
 * Builds the user prompt payload sent to the Scout model
 * @param {object} caseSeed - Output from sampleCaseDocket()
 * @returns {string} Fully articulated synthesis prompt
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

MANDATORY JSON OUTPUT SCHEMA:
{
  "case_title": "State v. [Defendant Last Name]",
  "crime_summary": "A 1-2 sentence punchy factual allegation summarizing what the State claims occurred.",
  "starter_exhibits": [
    {
      "id": "Ex. 1",
      "name": "[Title of Evidence Anchor Item]",
      "type": "${caseSeed.narrative_seeds.primary_evidence_anchor.type}",
      "status": "Marked",
      "details": "Precise chain of custody log, timestamps, and physical description containing the subtle procedural or factual flaw."
    },
    {
      "id": "Ex. 2",
      "name": "[Title of Corroborating Report, Dispatch, or Photo]",
      "type": "Documentary",
      "status": "Marked",
      "details": "Preliminary police report, coroner note, or witness statement setting the state's timeline."
    }
  ],
  "unencrypted_truth": "The absolute, unvarnished reality of what actually occurred at the venue, who actually did it, the client's actual actions, and how the flaw explains the police mistake.",
  "client_opening_dialogue": "Exactly two direct sentences spoken by the defendant in holding to Lead Defense Counsel to open Phase 1 intake."
}`;
}

/**
 * Normalizes the Scout model's JSON response and encodes the Base64 Ground Truth
 * @param {string|object} rawResponse - The text or parsed JSON returned by the model
 * @returns {object} Clean case brief ready for local client hydration and Main Engine handshake
 */
function parseScoutResponse(rawResponse) {
  let parsed;
  if (typeof rawResponse === "string") {
    // Strip accidental markdown fences if returned
    const cleanJson = rawResponse.replace(/```(?:json)?/gi, "").trim();
    parsed = JSON.parse(cleanJson);
  } else {
    parsed = rawResponse;
  }

  // Encode the ground truth into Base64 (browser window.btoa or Node Buffer)
  const truthText = parsed.unencrypted_truth || "No ground truth specified.";
  let base64Truth = "";
  if (typeof btoa === "function") {
    base64Truth = btoa(unescape(encodeURIComponent(truthText)));
  } else if (typeof Buffer !== "undefined") {
    base64Truth = Buffer.from(truthText, "utf-8").toString("base64");
  }

  return {
    caseTitle: parsed.case_title,
    crimeSummary: parsed.crime_summary,
    starterExhibits: parsed.starter_exhibits,
    groundTruthBase64: base64Truth,
    clientDialogue: parsed.client_opening_dialogue
  };
}

// Module export for Node or Browser inclusion
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCOUT_SYSTEM_INSTRUCTION,
    buildScoutPrompt,
    parseScoutResponse
  };
}
