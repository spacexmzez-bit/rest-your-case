# Rest Your Case ⚖️
### Companion Dashboard & Courtroom Simulation Suite

A tactical, fair-play criminal defense mystery simulation engine powered by Google Gemini. Sift through tainted evidence, preserve constitutional protections, command your private investigator, and dismantle the prosecution's case before the jury deliberates.

---

## 🏛️ Core Pillars

* **Fair-Play Deduction:** Ground truth is cryptographically locked into a sealed Base64 hash at Turn 2. Every contradiction, procedural loophole, and exculpatory fact can be solved directly from discovery documents and witness statements.
* **Strict Single-Actor Engine:** No script-heavy NPC banter. The simulated Judge or Assistant District Attorney yields the floor directly to defense counsel after every statement.
* **Bilingual Legal Term-Binding:** Native support for high-stakes English trial work or Arabic procedural law with bracketed US doctrine (e.g., `استدعاء قضائي [Subpoena]`).

---

## 🎮 Anatomy of a Trial

1. **Phase 1: Client Intake**  
   Interrogate your client in holding. Assess credibility, uncover baseline secrets, and detect fabrications before formal court proceedings begin.
2. **Phase 2: Pre-Trial & Motions**  
   Direct your private investigator (Diaz) using Action Points (AP). Subpoena cell records, canvass scenes, or file motions to suppress evidence obtained through questionable warrants.
3. **Phase 3: The Trial**  
   Cross-examine state witnesses, introduce exhibits, and lodge formal objections (`FRE 802`, `FRE 611c`, etc.) against prosecution violations. Frivolous objections earn Judicial Strikes.
4. **Phase 4: Closing & Verdict**  
   Deliver your closing argument highlighting reasonable doubt. Await the jury's verdict, then unseal the Turn 2 Base64 vault to reveal what actually transpired.

---

## 📁 Repository Structure

```text
.
├── index.html          # Single-page dashboard (Tailwind CSS, Alpine/Vanilla JS)
├── SYSTEM_PROMPT.md    # Master Gemini Gem prompt & case simulation rules
└── README.md           # Documentation & setup guide
