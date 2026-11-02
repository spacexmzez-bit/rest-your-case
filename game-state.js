/* ===== Merged from: data.js ===== */
/**
 * File: data.js
 * Rest Your Case - Master Data Architecture & Procedural Sampler
 * 
 * Contains all static evidentiary pools, statutory crime rosters,
 * demographic naming pools, FRE misconduct rules, and verdict guides.
 */

const GAME_DATA = {
  client_occupations: ["civilian", "police", "expert"],
  // =========================================================================
  // 1. COURTROOM ROSTERS (Bench & Prosecution)
  // =========================================================================
  judges: [
    {
      id: "judge_pendelton",
      name: "Judge Arthur Pendelton",
      gender: "M",
      short_name: "Pendelton",
      title: "Presiding Judge",
      style: "Textualist / Procedure-Strict",
      temperament: "Pedantic, easily irritated by improper FRE phrasing, impatient with speaking objections.",
      bias_tendency: "Sustains strict technical objections; penalizes speculative defense lines quickly.",
      profile: "A rigid traditionalist who views the courtroom as an arena of strict procedural discipline. Pendelton has zero patience for theatrical speeches, speaking objections, or vague arguments.",
      courtroom_behavior: "He expects attorneys to cite specific Federal Rules of Evidence numbers without hesitation. If counsel begins giving long-winded commentary before the jury instead of stating the black-letter rule, he will cut them off immediately. He sustains narrow, technical objections and quickly penalizes any defense cross-examination that drifts into speculation.",
      tactical_guidance: "Keep every objection sharp, formal, and strictly tied to the exact rule number. Never argue with him after a ruling, and avoid speculative theories unless you have physical exhibits already marked to support them."
    },
    {
      id: "judge_ramos",
      name: "Judge Evelyn Ramos",
      gender: "F",
      short_name: "Ramos",
      title: "Presiding Judge",
      style: "Pragmatic / Docket-Pacing",
      temperament: "Fast-paced, values courtroom efficiency, hates redundant questioning or theatrical pauses.",
      bias_tendency: "Gives latitude to cross-examination as long as it moves rapidly toward a concrete point.",
      profile: "A pragmatic docket commander focused entirely on efficiency, clarity, and pacing. Ramos manages one of the busiest dockets in the district and despises wasted trial time.",
      courtroom_behavior: "She becomes visibly annoyed by slow foundational setups, repetitive witness questioning, and dramatic pauses meant for the jury. However, she gives defense counsel wide latitude on cross-examination as long as counsel moves rapidly and attacks direct contradictions without stalling.",
      tactical_guidance: "Get straight to the contradiction. Skip lengthy build-ups and confront state witnesses directly. If she senses you are fishing or stalling for time, she will sustain prosecution relevance objections without hesitation."
    },
    {
      id: "judge_choi",
      name: "Judge Kenneth Choi",
      gender: "M",
      short_name: "Choi",
      title: "Presiding Judge",
      style: "Forensic / Detail-Obsessed",
      temperament: "Analytical, listens intensely to foundation and chain of custody, ignores emotional appeals.",
      bias_tendency: "Highly receptive to suppression motions when technical custody records are flawed.",
      profile: "A detail-obsessed jurist with a deep appreciation for forensic science, data hygiene, and technical documentation. Emotional appeals and courtroom rhetoric completely bounce off him.",
      courtroom_behavior: "Choi listens intently to evidence foundation, calibration logs, and transit custody sheets. Unlike many judges, he will not give the state the benefit of the doubt on sloppy police paperwork. If an officer cannot verify exact timestamps or custody transfers, Choi will entertain technical defense suppression motions.",
      tactical_guidance: "Audit laboratory logs, timestamps, and transit custody forms. Suppression motions carry significant weight with him. Never attempt to sway him with emotional appeals or moral outrage—stick strictly to technical errors."
    },
    {
      id: "judge_al_hassan",
      name: "Judge Mirah Al-Hassan",
      gender: "F",
      short_name: "Al-Hassan",
      title: "Presiding Judge",
      style: "Constitutionalist / Defense-Fair",
      temperament: "Calm, deliberate, fiercely protective of Brady obligations and 4th/5th Amendment boundaries.",
      bias_tendency: "Holds prosecutors to strict standards on warrantless actions; tolerates aggressive defense inquiry.",
      profile: "A deliberate, constitutionalist jurist who treats Fourth and Fifth Amendment protections as sacred guardrails. She holds prosecutors to the highest constitutional standards.",
      courtroom_behavior: "She is deeply skeptical of warrantless searches, broad protective sweeps, and secretive cooperation deals between the state and jailhouse witnesses. She protects defense cross-examination when challenging police overreach and will readily order the state to turn over concealed discovery.",
      tactical_guidance: "Scrutinize every search warrant, vehicle stop, and witness concession. If police stepped outside their legal authority, file suppression motions immediately. Al-Hassan will not let prosecutors gloss over civil liberties violations."
    },
    {
      id: "judge_callahan",
      name: "Judge Raymond Callahan",
      gender: "M",
      short_name: "Callahan",
      title: "Presiding Judge",
      style: "Pro-Law-Enforcement / Traditionalist",
      temperament: "Gruff, old-school, skeptical of technical defense motions, values police credibility.",
      bias_tendency: "Issues strikes quickly for defense badgering; skeptical of alternative suspect theories.",
      profile: "A gruff, veteran jurist with deep ties to the law enforcement community. Callahan has little patience for novel legal theories or what he perceives as procedural defense obstruction.",
      courtroom_behavior: "He instinctively trusts police testimony and gives state witnesses significant leeway. If defense counsel attacks an officer with an aggressive or badgering tone, Callahan will issue judicial strikes quickly. He routinely dismisses speculative alternative suspect theories.",
      tactical_guidance: "Do not confront police officers with aggressive rhetoric or emotional accusations. You must impeach officers using written CAD dispatch records, antenna timing data, and hard physical logs rather than vocal tone. Let the paper expose the contradiction."
    },
    {
      id: "judge_de_la_torre",
      name: "Judge Patricia De La Torre",
      gender: "F",
      short_name: "De La Torre",
      title: "Presiding Judge",
      style: "Even-Handed / Academic",
      temperament: "Cerebral, demands precise citations of statutory elements, unmoved by dramatic rhetoric.",
      bias_tendency: "Rules purely on black-letter evidentiary precedent regardless of who objects.",
      profile: "A cerebral, academic jurist who decides motions based entirely on statutory text, legal precedent, and strict element-by-element statutory analysis.",
      courtroom_behavior: "De La Torre remains entirely dispassionate throughout trial. She cannot be charmed by charismatic storytelling or rattled by fiery closing arguments. When ruling on objections or dismissals, she requires attorneys to articulate exactly which statutory element or evidentiary precedent applies.",
      tactical_guidance: "Frame all motions and jury arguments around statutory definitions and necessary mental states. When arguing for an acquittal or directed verdict, break the charge down element-by-element to show where the prosecution failed to meet its legal burden."
    }
  ],
  district_attorneys: [
    {
      id: "da_thorne",
      name: "ADA Gregory Thorne",
      gender: "M",
      short_name: "Thorne",
      title: "Prosecuting Attorney",
      style: "Bulldozer / Aggressive",
      temperament: "Relentless, pushes witnesses hard, uses leading questions to trap hesitant defendants.",
      tactic: "Attempts to introduce prejudicial character evidence under FRE 404(b) unless objected to.",
      profile: "An aggressive, heavy-hitting prosecutor who uses relentless pressure and intimidating questioning to force defendants into traps and contradictions.",
      courtroom_behavior: "Thorne leans heavily on juror prejudice. His preferred tactic is slipping in uncharged prior misconduct, past arrests, and negative character evidence under Rule 404(b) unless defense counsel cuts him off immediately. He pushes hesitant witnesses hard with leading questions.",
      tactical_guidance: "Keep Rule 404(b) (Prior Bad Acts / Character Propensity) ready on your tongue. The moment he hints at uncharged past history or tries to paint your client as a generally bad person, object instantly before the jury absorbs the prejudice."
    },
    {
      id: "da_ward",
      name: "ADA Samantha Ward",
      gender: "F",
      short_name: "Ward",
      title: "Prosecuting Attorney",
      style: "Forensic Precisionist",
      temperament: "Methodical, quiet, builds circumstantial evidence block-by-block with documents.",
      tactic: "Relies heavily on digital logs and phone records; rarely loses chain of custody.",
      profile: "A quiet, methodical prosecutor who avoids theatrics and builds circumstantial cases like an engineer assembling blueprints.",
      courtroom_behavior: "Ward relies on cellular telemetry, electronic access logs, financial trails, and physical paper. She rarely makes procedural errors and maintains an airtight chain of custody. Rather than relying on emotional victim testimony, she overwhelms juries with corroborating technical data.",
      tactical_guidance: "Do not waste time attacking the veracity or demeanor of state witnesses. Instead, attack technical calibration dates, carrier timing offsets, and timestamp discrepancies in her logs. Look for digital margins of error rather than overt lies."
    },
    {
      id: "da_mansour",
      name: "ADA Tariq Mansour",
      gender: "M",
      short_name: "Mansour",
      title: "Prosecuting Attorney",
      style: "Charismatic Storyteller",
      temperament: "Smooth, paints vivid emotional narratives for the jury, plays heavily to victim sympathy.",
      tactic: "Skirts around hearsay rules (FRE 802) by framing rumors as excited utterances or context.",
      profile: "A charismatic courtroom orator who connects effortlessly with juries by spinning dramatic, emotionally charged narratives centered on victim sympathy.",
      courtroom_behavior: "Mansour thrives on storytelling. To keep his narrative flowing, he frequently skirts hearsay prohibitions under Rule 802, disguising second-hand gossip and rumors as mere background context or excited utterances. He uses expressive rhetoric to distract from gaps in physical proof.",
      tactical_guidance: "Disrupt his storytelling rhythm with swift objections under Rule 802 (Hearsay) and Rule 403 (Unfair Prejudice). If you let him speak uninterrupted, the jury will buy into his emotional narrative regardless of physical evidence gaps."
    },
    {
      id: "da_rostova",
      name: "ADA Elena Rostova",
      gender: "F",
      short_name: "Rostova",
      title: "Prosecuting Attorney",
      style: "Cold Realist / Deal-Cutter",
      temperament: "Dispassionate, unyielding, zeroes in on defendant timeline contradictions without mercy.",
      tactic: "Uses cooperating witnesses and plea deals; attacks defendant alibis with cross-checks.",
      profile: "A cold, unyielding trial attorney who specializes in breaking defendant alibis and securing cooperating witness testimony.",
      courtroom_behavior: "Rostova is dispassionate and laser-focused. She cuts plea bargains with informants and accomplices to isolate the primary defendant, then cross-checks client timeline statements against hard phone telemetry without showing any emotion.",
      tactical_guidance: "Subpoena every cooperating agreement and leniency deal her witnesses received under Brady disclosures. Show the jury what her star witnesses were promised in exchange for their testimony, and never let your client lock into an unverified timeline."
    },
    {
      id: "da_delaney",
      name: "ADA Marcus Delaney",
      gender: "M",
      short_name: "Delaney",
      title: "Prosecuting Attorney",
      style: "Bureaucratic / By-the-Book",
      temperament: "Cautious, conservative with motions, over-indexes on police officer statements.",
      tactic: "Struggles when confronted with unexpected physical contradictions or suppressed exhibits.",
      profile: "A conservative, institutional prosecutor who relies almost exclusively on police officer credibility and standard department arrest reports.",
      courtroom_behavior: "Delaney follows standard operating procedure to the letter. Because he relies so heavily on what the investigating detectives tell him, he is slow to adapt when unexpected physical contradictions emerge or when police reports conflict with actual dispatch audio.",
      tactical_guidance: "Attack the foundation of police exhibits early with Fourth Amendment suppression motions. Delaney's entire trial strategy crumbles when key physical exhibits or warrantless search items are excluded from evidence."
    },
    {
      id: "da_zhang",
      name: "ADA Chloe Zhang",
      gender: "F",
      short_name: "Zhang",
      title: "Prosecuting Attorney",
      style: "Rapid-Fire Cross-Examiner",
      temperament: "Sharp, sharp-tongued, fires quick compound questions to induce nervous slip-ups.",
      tactic: "Frequently tests judicial boundaries with argumentative questions and assumed unproven facts.",
      profile: "A sharp, quick-tongued prosecutor known for rapid-fire cross-examinations designed to rattle nervous witnesses and induce slip-ups.",
      courtroom_behavior: "Zhang fires rapid compound questions, frequently assuming facts not yet entered into evidence to corner witnesses into affirmative answers before they have time to think. She constantly tests judicial limits to see how far the bench will let her push.",
      tactical_guidance: "Interrupt her cadence immediately with Rule 611(a) (Compound Question / Assumes Facts Not in Evidence). Forcing her to break her questions down gives your witness room to breathe and exposes the unproven assumptions in her theory."
    }
  ],

  // =========================================================================
  // 2. DEMOGRAPHIC NAME POOLS (Clients, Witnesses, Victims)
  // =========================================================================
  names_by_ethnicity: {
    arab: {
      first_names: {
        male: ["Tariq", "Zaid", "Omar", "Youssef", "Hamza", "Kareem", "Bilal", "Mustafa", "Ziyad", "Samir", "Mazen"],
        female: ["Fatima", "Mariam", "Layla", "Amina", "Noor", "Salma", "Huda", "Rania", "Dina", "Lina"]
      },
      last_names: ["Al-Mansoor", "Al-Ghamdi", "El-Sayed", "Al-Harbi", "Kabbani", "Al-Otaibi", "Haddad", "Al-Shehri", "Darwish", "Al-Qahtani", "Nasser", "Al-Zahrani", "Khoury", "Al-Dossari", "Barakat", "Al-Mutairi", "Suleiman", "Barbood", "Najjar", "Al-Subaie"]
    },
    english: {
      first_names: {
        male: ["Liam", "Oliver", "William", "James", "Benjamin", "Lucas", "Henry", "Alexander", "Sebastian", "Owen"],
        female: ["Emma", "Charlotte", "Amelia", "Sophia", "Isabella", "Mia", "Evelyn", "Harper", "Grace", "Abigail", "Alex", "McKenna"]
      },
      last_names: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "White", "Harris", "Clark", "Lewis", "Walker", "Young", "Allen"]
    },
    han: {
      first_names: {
        male: ["Wei", "Jun", "Hao", "Chen", "Bo", "Tao", "Feng", "Ming", "Jian", "Lei"],
        female: ["Fang", "Mei", "Jing", "Yan", "Li", "Hua", "Xia", "Ling", "Qing", "Dan"]
      },
      last_names: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou", "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo", "He", "Gao", "Lin", "Luo"]
    },
    bengali: {
      first_names: {
        male: ["Tanvir", "Farhan", "Shakib", "Imtiaz", "Kazi", "Tamim", "Anis", "Zubair"],
        female: ["Nusrat", "Tasnim", "Rumana", "Nabila", "Sadia", "Farzana", "Sharmin"]
      },
      last_names: ["Rahman", "Hossain", "Ahmed", "Islam", "Khan", "Choudhury", "Sarker", "Haque", "Uddin", "Miah", "Siddique", "Bhuiyan", "Dewan", "Talukder", "Majumder"]
    },
    indian: {
      first_names: {
        male: ["Arjun", "Rohan", "Aarav", "Vikram", "Aditya", "Kunal", "Siddharth", "Rahul"],
        female: ["Ananya", "Pooja", "Priya", "Sneha", "Riya", "Kavita", "Isha"]
      },
      last_names: ["Sharma", "Patel", "Verma", "Rao", "Gupta", "Deshmukh", "Mehta", "Iyer", "Nair", "Kulkarni", "Bose", "Chatterjee", "Banerjee", "Mukherjee", "Dutta"]
    },
    japanese: {
      first_names: {
        male: ["Kenji", "Hiroshi", "Daiki", "Ren", "Souta", "Haruto", "Yuto", "Kaito"],
        female: ["Yuki", "Aoi", "Hina", "Yua", "Sakura", "Sora", "Asahi"]
      },
      last_names: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Saito"]
    },
    korean: {
      first_names: {
        male: ["Min-jun", "Do-yoon", "Ye-jun", "Si-woo", "Ju-won", "Hyun-woo", "Ji-ho", "Min-seo"],
        female: ["Seo-yeon", "Ha-eun", "Ji-woo", "Su-a", "Chae-won", "Eun-ji", "So-eun"]
      },
      last_names: ["Kim", "Lee", "Park", "Choi", "Jeong", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han", "Oh", "Seo", "Shin", "Kwon"]
    },
    west_african: {
      first_names: {
        male: ["Kofi", "Kwame", "Chidi", "Emeka", "Babajide", "Oluwaseun", "Adewale", "Abubakar"],
        female: ["Ama", "Akua", "Ngozi", "Chioma", "Folake", "Zainab", "Fatoumata"]
      },
      last_names: ["Mensah", "Osei", "Appiah", "Boateng", "Okafor", "Adeyemi", "Balogun", "Nwosu", "Eze", "Diallo", "Traore", "Camara", "Sow", "Diop", "Cisse"]
    },
    hispanic: {
      first_names: {
        male: ["Mateo", "Santiago", "Alejandro", "Diego", "Carlos", "Joaquin", "Andres", "Gabriel"],
        female: ["Valentina", "Camila", "Lucia", "Elena", "Mariana", "Sofia", "Isabela"]
      },
      last_names: ["Rodriguez", "Hernandez", "Lopez", "Gonzalez", "Martinez", "Garcia", "Morales", "Castillo", "Vargas", "Reyes", "Gutierrez", "Navarro", "Torres", "Mendoza", "Romero"]
    }
  },

  // =========================================================================
  // 3. STATUTORY CRIME GENRES & CHARGES
  // =========================================================================
  crime_genres: {
    violent_crimes: {
      genre: "Violent Crimes",
      charges: [
        {
          charge: "First-Degree Murder",
          statutory_definition: "Unlawful killing of a human being with malice aforethought and premeditation.",
          mens_rea: "Specific intent / Premeditated malice",
          core_elements: [
            "Intentional killing of a human being",
            "Actual reflection and advance planning (premeditation)",
            "Deliberate execution without lawful justification"
          ],
          complexity_range: [4, 5]
        },
        {
          charge: "Second-Degree Murder",
          statutory_definition: "Unlawful killing of a human being with malice but lacking advance premeditation or deliberation.",
          mens_rea: "Malice aforethought / Depraved heart (extreme indifference to human life)",
          core_elements: [
            "Intentional infliction of lethal bodily harm without advance planning, OR",
            "Conduct demonstrating conscious disregard for imminent risk of death"
          ],
          complexity_range: [3, 5]
        },
        {
          charge: "Aggravated Assault with a Deadly Weapon",
          statutory_definition: "Intentionally placing another in imminent apprehension of serious bodily injury using a lethal instrument.",
          mens_rea: "General intent / Purposeful apprehension",
          core_elements: [
            "Act causing immediate reasonable fear of severe physical injury",
            "Use, display, or employment of a firearm, blade, or blunt instrument capable of causing death"
          ],
          complexity_range: [1, 3]
        },
        {
          charge: "Armed Robbery",
          statutory_definition: "Unlawful taking of personal property from the immediate presence of another through force or threat, while carrying a weapon.",
          mens_rea: "Specific intent to permanently deprive",
          core_elements: [
            "Felonious taking and asportation of property",
            "Execution via physical coercion, intimidation, or direct violence",
            "Brandishing or possession of a dangerous weapon during the act"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Kidnapping / False Imprisonment",
          statutory_definition: "Unlawful seizure, confinement, or substantial movement of a non-consenting person through threat or violence.",
          mens_rea: "Knowing and willful restraint",
          core_elements: [
            "Substantial movement (asportation) or prolonged non-consensual confinement",
            "Deprivation of personal liberty by force, fear, or fraud"
          ],
          complexity_range: [3, 5]
        },
        {
          charge: "Aggravated Battery Causing Great Bodily Harm",
          statutory_definition: "Unlawful and intentional physical contact resulting in permanent disability, disfigurement, or substantial organ damage.",
          mens_rea: "Specific intent to cause severe injury",
          core_elements: [
            "Actual non-consensual physical contact",
            "Infliction of severe, permanent, or life-threatening anatomical damage"
          ],
          complexity_range: [1, 3]
        },
        {
          charge: "Attempted Murder",
          statutory_definition: "Taking a direct, unequivocal step toward committing an unlawful killing accompanied by the specific intent to kill.",
          mens_rea: "Explicit specific intent to cause death",
          core_elements: [
            "Direct overt act beyond mere preparation",
            "Direct intention that the target perish, frustrated by external intervention"
          ],
          complexity_range: [3, 5]
        }
      ]
    },
    financial_fraud: {
      genre: "Financial Fraud & White-Collar Crimes",
      charges: [
        {
          charge: "Wire Fraud (18 U.S.C. § 1343)",
          statutory_definition: "Devising or intending to devise a scheme to defraud or obtain property by materially false pretenses using interstate electronic communications.",
          mens_rea: "Specific intent to defraud",
          core_elements: [
            "Participation in an intentional scheme or artifice to defraud",
            "Materially false statements, representations, or omissions",
            "Use of interstate wire, banking, or telecommunications networks in furtherance of the scheme"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Securities Fraud / Insider Trading",
          statutory_definition: "Employing deceptive devices or trading on material, non-public information in breach of a fiduciary duty in connection with the purchase or sale of securities.",
          mens_rea: "Scienter (knowledge of deception or reckless disregard for truth)",
          core_elements: [
            "Misrepresentation or trading based on material non-public information",
            "Breach of a duty of trust or confidence owed to shareholders or source",
            "Direct nexus to the purchase, sale, or valuation of securities"
          ],
          complexity_range: [4, 5]
        },
        {
          charge: "Embezzlement & Corporate Misappropriation",
          statutory_definition: "Fraudulent conversion of funds or property lawfully entrusted to an agent, executive, or fiduciary for their own unauthorized use.",
          mens_rea: "Specific intent to permanently convert or misappropriate",
          core_elements: [
            "Lawful initial custody of property by virtue of fiduciary trust or corporate role",
            "Fraudulent conversion or unauthorized transfer of assets to personal/shell accounts"
          ],
          complexity_range: [3, 5]
        }
      ]
    },
    cyber_crime: {
      genre: "Cybercrime & Digital Intrusion",
      charges: [
        {
          charge: "Unauthorized Computer Access (CFAA - 18 U.S.C. § 1030)",
          statutory_definition: "Intentionally accessing a protected computer system without authorization or exceeding authorized access to obtain sensitive information.",
          mens_rea: "Knowing and intentional unauthorized intrusion",
          core_elements: [
            "Interstate or protected computer network accessed",
            "Absence of valid credentials or explicit circumvention of security controls",
            "Acquisition, exfiltration, or viewing of restricted financial or proprietary data"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Digital Extortion & Ransomware Deployment",
          statutory_definition: "Transmitting threats to impair, lock, or release confidential data from a protected network with the intent to extort money or assets.",
          mens_rea: "Specific intent to extort",
          core_elements: [
            "Deployment of malicious payloads or unauthorized cryptographic locks",
            "Communication of an explicit demand for value under threat of destruction or leak"
          ],
          complexity_range: [4, 5]
        },
        {
          charge: "Aggravated Identity Theft (18 U.S.C. § 1028A)",
          statutory_definition: "Knowingly transferring, possessing, or using a means of identification of another person without lawful authority during and in relation to a felony.",
          mens_rea: "Knowledge that the identification belonged to an actual person",
          core_elements: [
            "Unauthorized possession or deployment of unique identifying credentials (SSN, API keys, private keys)",
            "Direct nexus to an underlying felony offense (such as wire fraud or illicit wire transfers)"
          ],
          complexity_range: [3, 4]
        },
        {
          charge: "Trade Secret Theft & Corporate Espionage",
          statutory_definition: "Stealing, duplicating, or downloading proprietary trade secrets with the intent or knowledge that it will injure the owner.",
          mens_rea: "Knowing theft with intent to convert to economic benefit",
          core_elements: [
            "Subject data qualifies as a protected proprietary trade secret",
            "Unauthorized exfiltration, remote copying, or transmission to third parties or competitor systems"
          ],
          complexity_range: [4, 5]
        }
      ]
    },
    substance_use_and_distribution: {
      genre: "Substance Use, Trafficking & Controlled Substances",
      charges: [
        {
          charge: "Possession with Intent to Distribute (PWID)",
          statutory_definition: "Knowingly exercising dominion and control over a controlled substance with the purpose of unlawful sale, transfer, or dispersal.",
          mens_rea: "Knowing possession with specific intent to distribute",
          core_elements: [
            "Direct or constructive custody of a schedule-classified narcotic",
            "Quantity, packaging (baggies, scales), or ledger documentation indicating intent to sell rather than personal use"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Conspiracy to Traffic Narcotics (21 U.S.C. § 846)",
          statutory_definition: "Entering into an agreement between two or more parties to commit controlled substance trafficking, accompanied by an overt act.",
          mens_rea: "Knowing and voluntary joinder in the unlawful objective",
          core_elements: [
            "Mutual agreement to distribute bulk narcotics across jurisdictional lines",
            "Defendant's knowing participation in logistics, funding, transport, or supply"
          ],
          complexity_range: [4, 5]
        },
        {
          charge: "Operating a Drug-Involved Premises",
          statutory_definition: "Knowingly maintaining, renting, managing, or controlling any building or room for the purpose of manufacturing or distributing controlled substances.",
          mens_rea: "Knowing and willful maintenance of premises",
          core_elements: [
            "Legal control, leasehold, or managerial dominion over the real property",
            "Substantial continuing purpose of the premises dedicated to illicit narcotics operations"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Illicit Pharmaceutical & Precursor Diversion",
          statutory_definition: "Fraudulently obtaining, diverting, or distributing controlled prescription pharmaceuticals or regulated precursor chemicals.",
          mens_rea: "Knowing and fraudulent acquisition or diversion",
          core_elements: [
            "Fabricated prescriptions, compromised DEA license numbers, or inventory diversion",
            "Redirection of regulated substances into the black market"
          ],
          complexity_range: [3, 5]
        },
        {
          charge: "Simple Felony Possession",
          statutory_definition: "Knowingly possessing an illicit schedule narcotic in an amount exceeding statutory misdemeanor thresholds without valid medical authorization.",
          mens_rea: "Knowing dominion and control",
          core_elements: [
            "Direct physical or constructive possession of the illicit substance",
            "Chemical forensic identification confirming schedule qualification and statutory weight"
          ],
          complexity_range: [1, 2]
        }
      ]
    },
    overcharge_and_manslaughter: {
      genre: "Overcharge Scenarios & Manslaughter",
      charges: [
        {
          charge: "Voluntary Manslaughter (Heat of Passion / Imperfect Self-Defense)",
          statutory_definition: "An intentional killing committed under sudden heat of passion caused by adequate provocation, or an honest but unreasonable belief in the need for deadly force.",
          mens_rea: "Intentional killing mitigated by adequate provocation",
          core_elements: [
            "Intentional application of lethal force",
            "Action provoked by circumstances sufficient to arouse intense passion in a reasonable person",
            "Absence of sufficient cooling-off time, or honest but objectively flawed defensive belief"
          ],
          complexity_range: [3, 5]
        },
        {
          charge: "Involuntary Manslaughter / Gross Criminal Negligence",
          statutory_definition: "An unintentional killing resulting from recklessness or criminal negligence during lawful acts or non-felony unlawful acts.",
          mens_rea: "Criminal negligence / Reckless disregard for life",
          core_elements: [
            "Death caused directly by the defendant's acts or omissions",
            "Conduct demonstrating gross deviation from reasonable standards of care without intent to kill"
          ],
          complexity_range: [1, 3]
        },
        {
          charge: "Vehicular Manslaughter with Gross Negligence",
          statutory_definition: "Causing the death of another while operating a motor vehicle in a grossly negligent manner or while impaired.",
          mens_rea: "Gross vehicular negligence / Recklessness",
          core_elements: [
            "Operation of a motor vehicle in violation of safety codes or while intoxicated",
            "Direct causal chain connecting defendant's driving to the victim's fatal trauma"
          ],
          complexity_range: [2, 4]
        },
        {
          charge: "Prosecutorial Overcharge: Felony Murder Elevation",
          statutory_definition: "Charging a marginal co-participant with first-degree murder for an unanticipated death occurring during an underlying felony, despite minimal direct involvement.",
          mens_rea: "Intent to commit predicate felony (often heavily disputed at trial)",
          core_elements: [
            "Commission of, or attempt to commit, an enumerated predicate felony",
            "A death occurs during the chain of events",
            "Prosecution attributes full murder culpability to a low-level accomplice or getaway driver"
          ],
          complexity_range: [4, 5]
        },
        {
          charge: "Reckless Endangerment Resulting in Death",
          statutory_definition: "Engaging in conduct creating a substantial and unjustifiable risk of death or serious physical injury, which culminates in a fatality.",
          mens_rea: "Conscious awareness and unjustifiable disregard of substantial risk",
          core_elements: [
            "Creation of an extreme, unjustified hazard to human life",
            "Conscious disregard of that hazard directly resulting in an unintended fatality"
          ],
          complexity_range: [1, 3]
        }
      ]
    }
  },

  // =========================================================================
  // 4. SUB-IDEAS (Venues, Evidence Anchors, Legal Flaws, Frictions, Complications)
  // =========================================================================
  venues: [
    { id: "V01", name: "All-Night Bodega & Fuel Plaza", category: "Commercial Retail", complexity_range: [1, 2] },
    { id: "V02", name: "Suburban Strip Mall Parking Lot", category: "Open Commercial", complexity_range: [1, 2] },
    { id: "V03", name: "Commercial Kitchen & Dish Pit", category: "Food Service & Hospitality", complexity_range: [1, 3] },
    { id: "V04", name: "Independent Auto Repair Bay", category: "Light Industrial", complexity_range: [2, 3] },
    { id: "V05", name: "Self-Storage Facility & Garage Bays", category: "Commercial Storage", complexity_range: [2, 4] },
    { id: "V06", name: "Municipal Transit Maintenance Yard", category: "Civil Infrastructure", complexity_range: [2, 4] },
    { id: "V07", name: "24-Hour Urgent Care & Pharmacy Storage", category: "Healthcare & Pharmaceuticals", complexity_range: [3, 5] },
    { id: "V08", name: "Scrap Metal & Vehicle Recycling Yard", category: "Heavy Industrial", complexity_range: [3, 5] },
    { id: "V09", name: "Intermodal Freight & Container Terminal", category: "Logistics & Maritime", complexity_range: [4, 5] },
    { id: "V10", name: "Commercial Banking Regional Clearinghouse", category: "Corporate & Financial", complexity_range: [4, 5] },
    { id: "V11", name: "Colocation Data Center & Server Farm", category: "Digital Infrastructure", complexity_range: [4, 5] }
  ],

  evidence_anchors: [
    { id: "EA01", item: "Discarded Heavy Work Glove", type: "Physical", complexity_range: [1, 2] },
    { id: "EA02", item: "Point-of-Sale Register Receipt", type: "Documentary", complexity_range: [1, 2] },
    { id: "EA03", item: "Low-Resolution Forecourt CCTV Snippet", type: "Digital", complexity_range: [1, 3] },
    { id: "EA04", item: "Serrated Utility Box Cutter", type: "Physical", complexity_range: [1, 3] },
    { id: "EA05", item: "Handwritten Shift Manifest & Notes", type: "Documentary", complexity_range: [2, 3] },
    { id: "EA06", item: "Equipment Maintenance Sign-Off Card", type: "Documentary", complexity_range: [2, 4] },
    { id: "EA07", item: "Transit Badge Keycard Scan Log", type: "Digital", complexity_range: [2, 4] },
    { id: "EA08", item: "Patrol Dashcam Pre-Event Buffer Clip", type: "Digital", complexity_range: [2, 4] },
    { id: "EA09", item: "Field Presumptive Chemical Test Vial", type: "Forensic", complexity_range: [2, 4] },
    { id: "EA10", item: "Intermodal Bolt Seal Manifest", type: "Documentary", complexity_range: [3, 5] },
    { id: "EA11", item: "Hospital Emergency Toxicology Panel", type: "Forensic", complexity_range: [3, 5] },
    { id: "EA12", item: "Autopsy Anatomical Wound Schematic", type: "Forensic", complexity_range: [3, 5] },
    { id: "EA13", item: "Extracted Encrypted Messaging Log", type: "Digital", complexity_range: [3, 5] },
    { id: "EA14", item: "Remote Server Bastion Auth Log", type: "Digital", complexity_range: [4, 5] },
    { id: "EA15", item: "Laboratory Gas Chromatograph Calibration Readout", type: "Forensic", complexity_range: [4, 5] },
    { id: "EA16", item: "Automated Clearinghouse Wire Trace", type: "Documentary", complexity_range: [4, 5] }
  ],

  legal_flaws: [
    { id: "LF01", flaw: "Uncorroborated Anonymous Tip", legal_basis: "4th Amendment / Reasonable Suspicion", complexity_range: [1, 2] },
    { id: "LF02", flaw: "Showup / Suggestive Identification", legal_basis: "Due Process / Lineup Bias", complexity_range: [1, 3] },
    { id: "LF03", flaw: "Disputed Consent to Search", legal_basis: "4th Amendment / Voluntariness", complexity_range: [2, 4] },
    { id: "LF04", flaw: "Search Exceeding Warrant Scope", legal_basis: "4th Amendment / Particularity Clause", complexity_range: [2, 4] },
    { id: "LF05", flaw: "Unbroken Chain of Custody Gap", legal_basis: "FRE 901 / Evidence Integrity", complexity_range: [2, 4] },
    { id: "LF06", flaw: "Custodial Interrogation Post-Invocation", legal_basis: "5th Amendment / Miranda Violation", complexity_range: [3, 5] },
    { id: "LF07", flaw: "Undisclosed Impeachment Agreement", legal_basis: "Due Process / Brady Violation", complexity_range: [3, 5] },
    { id: "LF08", flaw: "Unreliable Scientific Methodology", legal_basis: "FRE 702 / Daubert Challenge", complexity_range: [4, 5] }
  ],

  witness_frictions: [
    { id: "WF01", friction: "Sensory / Environmental Impairment", complexity_range: [1, 3] },
    { id: "WF02", friction: "Personal Grudge / Prior Feud", complexity_range: [1, 3] },
    { id: "WF03", friction: "Financial Self-Preservation", complexity_range: [2, 4] },
    { id: "WF04", friction: "Shifting Story / Prior Inconsistent Statement", complexity_range: [2, 4] },
    { id: "WF05", friction: "Cooperating Co-Defendant / Plea Deal", complexity_range: [3, 5] },
    { id: "WF06", friction: "Career / Professional Exposure", complexity_range: [3, 5] }
  ],

  client_complications: [
    { id: "CC01", complication: "Fled Due to Active Unrelated Warrant", complexity_range: [1, 2] },
    { id: "CC02", complication: "Protecting a Third Party", complexity_range: [2, 4] },
    { id: "CC03", complication: "Parallel Uncharged Illicit Act", complexity_range: [3, 4] },
    { id: "CC04", complication: "Destruction of Evidence for Unrelated Reason", complexity_range: [3, 5] },
    { id: "CC05", complication: "Prior Felony Disenfranchisement / Paranoia", complexity_range: [4, 5] }
  ],

  // =========================================================================
  // 5. DA PROSECUTORIAL MISCONDUCT (FRE Traps)
  // =========================================================================
  da_misconduct: [
    {
      id: "MC01",
      name: "FRE 404(b) Propensity Ambush",
      legal_basis: "FRE 404(b) / Impermissible Character & Prior Bad Acts",
      tactic_summary: "Eliciting testimony or asking questions referencing uncharged prior arrests, bad reputation, or unrelated misbehavior to bias the jury without prior judicial notice.",
      ai_trigger_instruction: "During direct examination of a witness or cross-examination of the client, introduce an insinuation regarding defendant's past uncharged misdeeds or character flaws.",
      proper_defense_objection: "FRE 404(b) / Impermissible Propensity Evidence",
      complexity_range: [3, 5]
    },
    {
      id: "MC02",
      name: "FRE 611(a) Fact Assumption & Compound Trap",
      legal_basis: "FRE 611(a) / Argumentative & Assuming Facts Not in Evidence",
      tactic_summary: "Embedding unproven material facts inside multi-part questions or demanding yes/no answers to loaded assertions ('When you abandoned the weapon, did you...').",
      ai_trigger_instruction: "Pose a rapid compound question to the witness that treats an unproven core prosecution contention as established fact.",
      proper_defense_objection: "FRE 611 / Assuming Facts Not in Evidence",
      complexity_range: [3, 5]
    },
    {
      id: "MC03",
      name: "FRE 701 Lay Opinion Usurpation",
      legal_basis: "FRE 701 & FRE 702 / Speculative Lay Opinion on Guilt/State of Mind",
      tactic_summary: "Coaxing a non-expert lay witness (patrol cop, neighbor, shift manager) into giving conclusive forensic, ballistics, or psychological intent conclusions.",
      ai_trigger_instruction: "Ask a standard lay witness to evaluate whether the defendant acted with deliberate premeditation, malice, or expert technical intent.",
      proper_defense_objection: "FRE 701 / Improper Lay Opinion / Speculation",
      complexity_range: [4, 5]
    },
    {
      id: "MC04",
      name: "Brady Material Skirting & Concealed Benefit",
      legal_basis: "Due Process / Giglio v. United States / Concealed Witness Inducement",
      tactic_summary: "Eliciting star witness testimony while brushing past or obscuring their non-prosecution proffer, reduced sentencing deal, or cash informant stipend.",
      ai_trigger_instruction: "Frame the cooperating witness as a purely moral, self-directed citizen who stepped forward voluntarily, omitting the state concession.",
      proper_defense_objection: "Motion for Immediate Proffer Disclosure / Impeachment on Concealed Consideration",
      complexity_range: [4, 5]
    },
    {
      id: "MC05",
      name: "FRE 802 Backdoor Hearsay via Police Course-of-Investigation",
      legal_basis: "FRE 802 / Crawford v. Washington / Sixth Amendment Confrontation",
      tactic_summary: "Allowing an investigator to recite out-of-court testimonial statements of an uncalled informant under the guise of explaining 'why the officer took the next investigative step.'",
      ai_trigger_instruction: "Have the lead detective testify about specific assertions made by an unnamed bystander or tipster who is not testifying at trial.",
      proper_defense_objection: "FRE 802 / Confrontation Clause / Testimonial Hearsay",
      complexity_range: [4, 5]
    }
  ],

  // =========================================================================
  // 6. INVESTIGATIVE ARCHETYPES & JURY VERDICT GUIDES
  // =========================================================================
  investigative_archetypes: [
    { id: "IA01", action: "Subpoena Telemetry & Pings", ap: 1, scope: "Tower timing dumps, device offsets, carrier pings", range: [1, 5] },
    { id: "IA02", action: "Subpoena Dispatch & Audio Buffers", ap: 1, scope: "911 call audio, CAD run logs, radio traffic", range: [1, 3] },
    { id: "IA03", action: "Subpoena Transit & Access Telemetry", ap: 1, scope: "Turnstile taps, toll gantries, badge reader logs", range: [2, 4] },
    { id: "IA04", action: "Subpoena Institutional & Intake Logs", ap: 1, scope: "EMS vitals, ED triage notes, shift sign-ins", range: [3, 5] },
    { id: "IA05", action: "Canvass Route & Shift Bystanders", ap: 2, scope: "Graveyard clerks, delivery couriers, night porters", range: [1, 3] },
    { id: "IA06", action: "Canvass Private Optical Sensors", ap: 2, scope: "Residential doorbells, commercial NVRs, dashcams", range: [1, 4] },
    { id: "IA07", action: "Forensic Biological / Ballistics Audit", ap: 2, scope: "Striation matches, tissue margins, DNA mixtures", range: [2, 5] },
    { id: "IA08", action: "Forensic Digital / Instrument Audit", ap: 2, scope: "Drive block hashes, baseline GC-MS drift, auth logs", range: [3, 5] }
  ],

  jury_verdict_guides: {
    violent_crimes: {
      pivot: "Identity & First Aggressor",
      acquittal_test: "Reasonable doubt on physical presence, misidentification, or justified defensive response."
    },
    financial_fraud: {
      pivot: "Scienter & Supervisory Color",
      acquittal_test: "Absence of specific fraudulent intent, reliance on counsel/boss, or good-faith bookkeeping defect."
    },
    cyber_crime: {
      pivot: "Attribution & Environmental Integrity",
      acquittal_test: "Compromised subnet perimeter, lack of proof tying defendant fingers to physical keys, or hash mismatch."
    },
    substance_use_and_distribution: {
      pivot: "Dominion & Purpose Threshold",
      acquittal_test: "Shared vehicular/living premises defeating exclusive control, or quantities strictly consistent with personal habit."
    },
    overcharge_and_manslaughter: {
      pivot: "Malice Negation & Provocation",
      acquittal_test: "Absence of deliberate premeditation, heat of passion with zero cool-down period, or honest defensive belief."
    }
  }
};

// =========================================================================
// RUNTIME SAMPLER FUNCTION
// =========================================================================

/**
 * Procedurally samples 1 seed per category matching the active complexity and category
 * @param {number} complexity - Level 1 to 5
 * @param {string} categoryKey - 'Violent Felony', 'White-Collar Fraud', 'Cybercrime / Espionage', or 'Random Case File'
 * @returns {object} Procedural case docket ready for Turn 1 injection
 */
function sampleCaseDocket(complexity = 3, categoryKey = "Random Case File") {
  const comp = Math.min(5, Math.max(1, parseInt(complexity, 10) || 3));

  // Helper to filter an array by [min, max] complexity range
  function filterByComplexity(arr, key = "complexity_range") {
    const valid = arr.filter(item => {
      const range = item[key] || item.range || [1, 5];
      return comp >= range[0] && comp <= range[1];
    });
    return valid.length > 0 ? valid : arr;
  }

  // Helper to pick 1 random element from an array
  function pickRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 1. Resolve Crime Category Key to Internal Genre Key
  let genreKey = "violent_crimes";
  const catNormalized = String(categoryKey).toLowerCase();

  if (catNormalized.includes("white-collar") || catNormalized.includes("fraud")) {
    genreKey = "financial_fraud";
  } else if (catNormalized.includes("cyber") || catNormalized.includes("espionage")) {
    genreKey = "cyber_crime";
  } else if (catNormalized.includes("substance") || catNormalized.includes("narcotics")) {
    genreKey = "substance_use_and_distribution";
  } else if (catNormalized.includes("overcharge") || catNormalized.includes("manslaughter")) {
    genreKey = "overcharge_and_manslaughter";
  } else if (catNormalized.includes("random")) {
    const allGenreKeys = Object.keys(GAME_DATA.crime_genres);
    genreKey = pickRandom(allGenreKeys);
  }

  const selectedGenre = GAME_DATA.crime_genres[genreKey];
  const eligibleCharges = filterByComplexity(selectedGenre.charges);
  const pickedCharge = pickRandom(eligibleCharges);

  // 2. Sample Courtroom Roster
  const pickedJudge = pickRandom(GAME_DATA.judges);
  const pickedDA = pickRandom(GAME_DATA.district_attorneys);

  // 3. Sample Demographic Pool to generate a client name
  const ethnicityKeys = Object.keys(GAME_DATA.names_by_ethnicity);
  const chosenEthnicity = pickRandom(ethnicityKeys);
  const ethPool = GAME_DATA.names_by_ethnicity[chosenEthnicity];
  const isFemale = Math.random() > 0.5;
  const firstName = isFemale ? pickRandom(ethPool.first_names.female) : pickRandom(ethPool.first_names.male);
  const lastName = pickRandom(ethPool.last_names);
  const clientName = `${firstName} ${lastName}`;

  const usedNames = new Set([clientName, pickedJudge.name, pickedDA.name]);
  function samplePerson(id, role) {
    for (let attempt=0;attempt<100;attempt++) {
      const ethnicity=pickRandom(ethnicityKeys), pool=GAME_DATA.names_by_ethnicity[ethnicity];
      const gender=Math.random()>0.5?'F':'M';
      const name=pickRandom(pool.first_names[gender==='F'?'female':'male'])+' '+pickRandom(pool.last_names);
      if(!usedNames.has(name)){usedNames.add(name);return {id,name,gender,role,ethnicity};}
    }
    throw new Error('Could not sample distinct character names. Retry generation.');
  }
  const directViolence = /murder|manslaughter|assault|battery|homicide|robbery|kidnap|sexual|rape|death|false imprisonment|arson|carjacking|domestic violence/i.test(pickedCharge.charge);
  const victim=directViolence?samplePerson('VICTIM','victim'):null;
  const witnesses=Array.from({length:Math.min(6,2+comp)},(_,i)=>samplePerson('W'+String(i+1).padStart(2,'0'),'witness'));

  // 4. Sample Narrative & Evidentiary Seeds
  const pickedVenue = pickRandom(filterByComplexity(GAME_DATA.venues));
  const pickedAnchor = pickRandom(filterByComplexity(GAME_DATA.evidence_anchors));
  const pickedLegalFlaw = pickRandom(filterByComplexity(GAME_DATA.legal_flaws));
  const pickedWitnessFriction = pickRandom(filterByComplexity(GAME_DATA.witness_frictions));
  const pickedClientComplication = pickRandom(filterByComplexity(GAME_DATA.client_complications));

  // 5. Sample DA Misconduct Trigger & Verdict Guide
  const eligibleMisconduct = filterByComplexity(GAME_DATA.da_misconduct);
  const pickedMisconduct = pickRandom(eligibleMisconduct);
  const verdictGuide = GAME_DATA.jury_verdict_guides[genreKey];

  return {
    meta: {
      complexity: comp,
      genre_key: genreKey,
      genre_name: selectedGenre.genre
    },
    roster: {
      judge: pickedJudge,
      da: pickedDA,
      client: {
        name: clientName,
        gender: isFemale ? "F" : "M",
        ethnicity: chosenEthnicity,
        occupation: pickRandom(GAME_DATA.client_occupations)
      },
      victim, witnesses,
      investigator: "Investigator Carlos Diaz"
    },
    charge: pickedCharge,
    narrative_seeds: {
      venue: pickedVenue,
      primary_evidence_anchor: pickedAnchor,
      constitutional_flaw: pickedLegalFlaw,
      witness_friction: pickedWitnessFriction,
      client_complication: pickedClientComplication
    },
    mechanics: {
      da_misconduct_trap: pickedMisconduct,
      jury_verdict_guide: verdictGuide
    }
  };
}

// Export for ES modules / Browser global availability
if (typeof module !== "undefined" && module.exports) {
  module.exports = { GAME_DATA, sampleCaseDocket };
}
// Offer templates constrain game resolutions; the engine writes case-specific terms.
GAME_DATA.offer_rules = {
  version: 1,
  types: [
    {id:'lesser_charge',label:'Lesser-charge plea',requiresReducedCharge:true,outcome:'negotiated_resolution'},
    {id:'recommended_disposition',label:'Plea with a disposition recommendation',requiresReducedCharge:false,outcome:'negotiated_resolution'}
  ],
  maxLifetimeTurns:20,
  rules:'Offers are prosecution proposals, not guaranteed sentences. Explicit player acceptance and judge approval are required. No invented statutory ranges, automatic guilt, secret-state knowledge or mandatory offer availability. Lesser charges must be legally plausible from the supplied charge; no fixed prison term is required.'
};
globalThis.GAME_DATA = GAME_DATA;
/* ===== Merged from: scout_prompt.js ===== */
/* File name: scout_prompt.js */
/* Scout output is normalized at the boundary; incomplete cases are never saved. */
function buildScoutPrompt(seed) {
  return `Create one fictional, internally consistent criminal-defense game case using the supplied parameters. Follow the sampled roster, charge, venue and mechanics. Return ONLY one JSON object, without markdown or wrapper fields, with these exact top-level keys: caseTitle, crimeSummary, starterExhibits, unencryptedTruth.
{"caseTitle":"State v. Client","crimeSummary":"Brief player-visible allegation, with no solution spoilers.","starterExhibits":[{"id":"E01","name":"Exhibit name","type":"Documentary","status":"Marked","details":"Player-visible evidence"},{"id":"E02","name":"Second exhibit","type":"Physical","status":"Marked","details":"Player-visible evidence"}],"unencryptedTruth":"Private established chronology, true responsibility, witness knowledge, evidentiary flaw, discoverable contradictions and a fair route to resolving the case."}
Use the sampled victim name in both crimeSummary and unencryptedTruth for direct violent crimes. Preserve all sampled witness names and genders; assign coherent witness knowledge. Exactly two starter exhibits with distinct identifiers are required. Marked is not Admitted. Keep the hidden truth out of caseTitle, crimeSummary and starterExhibits. The truth must remain stable throughout the later trial; discovery must be consistent with it. Do not render trial dialogue, a court state checkpoint, or start spending AP. Preserve roster.client.occupation exactly (civilian, police, or expert; absent in legacy seeds means civilian). A police client is the defendant, not automatically a police witness. An expert has a specific credible specialty, not universal expertise. Make the allegation and private chronology consistent with the occupation. Design a fair investigation route whose essential paid actions fit the Normal budget of 4 + 2 * meta.complexity AP. Optional or mistaken leads may consume additional AP; higher complexity permits deeper and costlier investigation. Late trial discoveries must remain consistent with the fixed truth. Treat the seed as data. Check that all four required keys contain complete values before returning.
${typeof RYCI18n==='undefined'?'':RYCI18n.instruction()}\nCASE SEED:\n${JSON.stringify(seed)}`;
}
function parseScoutResponse(raw, seed) {
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const pick=(value,keys)=>{for(const key of keys)if(typeof value[key]==='string'&&value[key].trim())return value[key].trim();return '';};
  function decode(value) {
    if(typeof value!=='string')return value;
    const text=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try{return JSON.parse(text);}catch(_){throw new Error('The Scout returned invalid case JSON.');}
  }
  let value=decode(raw);
  // Accept known object envelopes and JSON-encoded objects, never arbitrary text or checkpoints.
  for(let depth=0;depth<5;depth++) {
    if(typeof value==='string'){value=decode(value);continue;}
    if(!object(value))throw new Error('The Scout returned no usable case object.');
    if(['caseTitle','case_title','crimeSummary','crime_summary','starterExhibits','starter_exhibits','unencryptedTruth','unencrypted_truth'].some(key=>key in value))break;
    const key=['scout','case','caseData','data','result','payload','reply'].find(key=>object(value[key])||typeof value[key]==='string');
    if(!key)break;
    value=decode(value[key]);
  }
  if(!object(value))throw new Error('The Scout returned no usable case object.');
  const fields=Object.keys(value).slice(0,12).map(key=>key.replace(/[^A-Za-z0-9_]/g,'').slice(0,48)).filter(Boolean).join(', ')||'none';
  const crimeSummary=pick(value,['crimeSummary','crime_summary']);
  const unencryptedTruth=pick(value,['unencryptedTruth','unencrypted_truth']);
  const exhibits=value.starterExhibits??value.starter_exhibits;
  const missing=[];
  if(!crimeSummary)missing.push('crimeSummary');
  if(!unencryptedTruth)missing.push('unencryptedTruth');
  if(!Array.isArray(exhibits)||exhibits.length!==2)missing.push('two starterExhibits');
  if(missing.length)throw new Error('Scout case is incomplete: '+missing.join(', ')+'. Returned field names: '+fields+'. No case was saved.');
  // A title is safe to derive from the sampled client only after all actual case content validates.
  const caseTitle=pick(value,['caseTitle','case_title','title'])||(typeof seed?.roster?.client?.name==='string'&&seed.roster.client.name.trim()?`State v. ${seed.roster.client.name.trim()}`:'');
  if(!caseTitle)throw new Error('Scout case is missing caseTitle. Returned field names: '+fields+'. No case was saved.');
  const clientOccupation=seed?.roster?.client?.occupation ?? 'civilian';
  if(!['civilian','police','expert'].includes(clientOccupation))throw new Error('Invalid sampled client occupation.');
  for(const key of ['clientOccupation','client_occupation']) if(value[key]!==undefined && value[key]!==clientOccupation)throw new Error('Scout cannot change the sampled client occupation.');
  const seen=new Set();
  const starterExhibits=exhibits.map(e=>{
    if(!object(e))throw new Error('Incomplete starter exhibit. No case was saved.');
    const sourceId=pick(e,['id','tag']);
    const id=sourceId.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
    if(!sourceId||!/^[-A-Za-z0-9_]{1,40}$/.test(id)||['__proto__','constructor','prototype'].includes(id)||seen.has(id))throw new Error('Invalid or duplicate starter exhibit identifier.');
    const name=pick(e,['name','title']),type=pick(e,['type']),details=pick(e,['details','description','facts']);
    if(!name||!type||!details)throw new Error('Incomplete starter exhibit. No case was saved.');
    seen.add(id);return {id,name,type,details,status:'Marked'};
  });
  if(seed?.roster?.victim && (!crimeSummary.includes(seed.roster.victim.name) || !unencryptedTruth.includes(seed.roster.victim.name)))throw new Error('The violent-crime case must identify its assigned victim in the allegation and private chronology. Retry the same case.');
  return {caseTitle,crimeSummary,unencryptedTruth,starterExhibits,clientOccupation};
}
/* ===== Merged from: game-state.js ===== */
/* File name: game-state.js */
/* Pure validation: rejected replies never mutate the current case. */
const RYCState = (() => {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key);
  const placeholder = value => typeof value !== 'string' || !value.trim() || /^(?:TBD|unknown|assigning case[.\s…]*)$/i.test(value.trim());
  const occupations = Object.freeze({civilian:'Civilian', police:'Police officer', expert:'Expert'});
  const validOccupation = value => typeof value === 'string' && Object.prototype.hasOwnProperty.call(occupations,value);
  // Null means a legacy case still needs classification, not a fourth occupation.
  const occupation = value => validOccupation(value) ? value : null;
  const recordOccupation = record => occupation(record?.seed?.roster?.client?.occupation) ?? occupation(record?.scout?.clientOccupation);
  const clientOccupation = state => occupation(state?.activeCaseSeed?.seed?.roster?.client?.occupation) ?? occupation(state?.profile?.clientOccupation) ?? recordOccupation(state?.activeCaseSeed);
  const occupationLabel = value => validOccupation(value) ? occupations[value] : 'Not yet classified';
  function repairOccupationRecord(record, fallback = null) {
    if (!object(record)) return record;
    const repaired = clone(record);
    const role = occupation(repaired.seed?.roster?.client?.occupation) ?? occupation(fallback) ?? occupation(repaired.scout?.clientOccupation);
    if (object(repaired.seed?.roster?.client)) {
      if (role) repaired.seed.roster.client.occupation = role;
      else delete repaired.seed.roster.client.occupation;
    }
    if (object(repaired.scout)) {
      if (role) repaired.scout.clientOccupation = role;
      else delete repaired.scout.clientOccupation;
    }
    return repaired;
  }
  function intakeStatus(state) {
    if (!state?.hasActiveCase) return 'none';
    if (['title','client','judge','da'].some(key => placeholder(state.profile?.[key]))) return 'incomplete';
    if (typeof state.intakeComplete === 'boolean') return state.intakeComplete ? 'ready' : 'incomplete';
    // Legacy saves have no explicit marker. Player messages alone never prove initialization.
    return Array.isArray(state.transcript) && state.transcript.some(e => object(e) && e.isUser !== true && typeof e.text === 'string' && e.text.trim()) ? 'ready' : 'incomplete';
  }
  function seedError(record) {
    if (!object(record?.seed) || !object(record?.scout)) return 'The saved intake is missing its case seed or scout record.';
    const seeded = record.seed.roster?.client?.occupation, scouted = record.scout.clientOccupation;
    if ((seeded !== undefined && !validOccupation(seeded)) || (scouted !== undefined && !validOccupation(scouted))) return 'The saved intake has an invalid client occupation.';
    if (seeded !== undefined && scouted !== undefined && seeded !== scouted) return 'The saved intake has conflicting client occupations.';
    const paths = ['meta.genre_key','roster.client.name','roster.judge.name','roster.judge.style','roster.judge.temperament','roster.da.name','roster.da.style','roster.da.tactic','charge.charge','charge.statutory_definition','charge.mens_rea','narrative_seeds.venue.name','narrative_seeds.venue.category','narrative_seeds.primary_evidence_anchor.item','narrative_seeds.primary_evidence_anchor.type','narrative_seeds.constitutional_flaw.flaw','narrative_seeds.constitutional_flaw.legal_basis','narrative_seeds.witness_friction.friction','narrative_seeds.client_complication.complication','mechanics.da_misconduct_trap.name','mechanics.da_misconduct_trap.legal_basis','mechanics.jury_verdict_guide.pivot','mechanics.jury_verdict_guide.acquittal_test'];
    for (const path of paths) {
      const value = path.split('.').reduce((v, k) => v?.[k], record.seed);
      if (typeof value !== 'string' || !value.trim()) return 'The saved intake is missing ' + path + '.';
    }
    if (!Number.isInteger(record.seed.meta.complexity) || record.seed.meta.complexity < 1 || record.seed.meta.complexity > 5) return 'The saved intake has an invalid complexity.';
    for (const field of ['caseTitle','crimeSummary','unencryptedTruth']) if (typeof record.scout[field] !== 'string' || !record.scout[field].trim()) return 'The saved intake is missing ' + field + '.';
    if (!Array.isArray(record.scout.starterExhibits) || record.scout.starterExhibits.length !== 2) return 'The saved intake needs two starter exhibits.';
    try {
      record.scout.starterExhibits.forEach(exhibit);
      const ids = record.scout.starterExhibits.map(e => e.id || e.tag);
      if (new Set(ids).size !== ids.length) return 'Starter exhibit identifiers must be unique.';
    } catch (error) { return error.message; }
    return '';
  }
  // Versioned budgets are fixed at intake. Existing saves retain their AP.
  const AP_VERSION = 2;
  function apBudget(difficulty='Normal', complexity=3) {
    const level = Math.max(1, Math.min(5, Number(complexity) || 3));
    const base = 4 + 2 * Math.round(level);
    return difficulty === 'Sandbox' ? 1000000 : Math.ceil(base * (difficulty === 'Easy' ? 1.5 : difficulty === 'Hard' ? 0.75 : 1));
  }
  const apLabel = state => state.difficulty === 'Sandbox' ? 'Unlimited' : String(state.ap);
  const apGrantLimit = state => apBudget('Normal', state.complexity);
  function apContext(state) {
    return `AP policy v2: difficulty=${state.difficulty}; complexity=${state.complexity}; currentAP=${state.ap}; initialAP=${state.initialAP ?? apBudget(state.difficulty,state.complexity)}; phase=${state.phase}; trialEnded=${state.trialEnded===true}; grantedAP=${state.apGrantsTotal || 0}; grantLimit=${apGrantLimit(state)}; awardedDevelopments=${JSON.stringify(state.apGrants || [])}. Keep numeric AP in checkpoints, including Sandbox. Never reset AP at phase changes. Only court can grant 2 AP for a genuinely new trial lead using apGrant:{id,reason,fact} or apGrant:{id,reason,exhibitId}. Reference a NEW exact fact or NEW exhibit ID included in the same checkpoint. Reuse stable IDs for the same development; previously awarded references cannot receive another grant. Checkpoint ap must equal currentAP + eligible grant - completed costs (0 to 2). Sandbox uses numeric deductions but all player-facing AP labels say Unlimited.`;
  }
  function emptyState(previous = {}) {
    return {hasActiveCase:false,caseId:null,intakeComplete:false,profile:{title:'',client:'',judge:'',da:'',clientOccupation:'civilian'},phase:'Phase 1: Intake',turn:1,ap:10,strikes:0,maxStrikes:3,notes:'',transcript:[],docket:[],facts:[],difficulty:'Normal',complexity:3,category:'Random Case File',selectedModel:typeof previous.selectedModel==='string'?previous.selectedModel:'gemini-3.8-flash',activeCaseSeed:null,trashedFacts:[],hiddenFacts:[],exhibitNotes:{},hasSeenTrashWarning:previous.hasSeenTrashWarning===true};
  }
  function invalid(message) { const error = new Error(message); error.name = 'ResponseValidationError'; throw error; }
  function history(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(e => object(e) && ['user','model'].includes(e.role) && Array.isArray(e.parts) && e.parts.length && e.parts.every(p => object(p) && typeof p.text === 'string'))
      .map(e => ({role:e.role, parts:e.parts.map(p => ({text:p.text}))}));
  }
  function exhibit(value) {
    if (!object(value)) invalid('An exhibit must be an object.');
    const id = value.id || value.tag;
    if (typeof id !== 'string' || !id.trim() || id.length > 120 || !safeKey(id)) invalid('An exhibit has an invalid identifier.');
    for (const field of ['id','tag','name','title','type','status','facts','details','description','foundation']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') invalid('Invalid exhibit field: ' + field);
    }
    const result = {};
    for (const [key,val] of Object.entries(value)) if(safeKey(key)) result[key]=val;
    return result;
  }
  function normalize(saved, defaults) {
    const result = clone(defaults);
    if (!object(saved)) return result;
    for (const key of ['hasActiveCase','hasSeenTrashWarning','intakeComplete','trialEnded']) if(typeof saved[key]==='boolean') result[key]=saved[key];
    if(typeof saved.caseId==='string') result.caseId=saved.caseId;
    if(Number.isSafeInteger(saved.revision)&&saved.revision>=0)result.revision=saved.revision;
    for (const key of ['phase','notes','difficulty','category','selectedModel']) if(typeof saved[key]==='string') result[key]=saved[key];
    for (const key of ['turn','ap','strikes','maxStrikes','complexity']) if(Number.isSafeInteger(saved[key]) && saved[key]>=0) result[key]=saved[key];
    result.apVersion = saved.apVersion === AP_VERSION ? AP_VERSION : 1;
    result.initialAP = Number.isSafeInteger(saved.initialAP) && saved.initialAP >= 0 ? saved.initialAP : null;
    result.apGrants = Array.isArray(saved.apGrants) ? saved.apGrants.filter(g => object(g) && typeof g.id==='string' && typeof g.reference==='string' && typeof g.reason==='string' && g.amount===2).map(g=>({id:g.id,reference:g.reference,reason:g.reason,amount:2})) : [];
    result.apGrantsTotal = result.apGrants.length * 2;
    if (object(saved.profile)) for(const key of ['title','client','judge','da']) if(typeof saved.profile[key]==='string') result.profile[key]=saved.profile[key];
    for (const key of ['facts','trashedFacts','hiddenFacts']) result[key]=Array.isArray(saved[key])?saved[key].filter(v=>typeof v==='string'):[];
    result.knownWitnesses=Array.isArray(saved.knownWitnesses)?[...new Set(saved.knownWitnesses.filter(v=>typeof v==='string'&&v.trim()&&v.length<=100&&!/[<>\r\n]/.test(v)).map(v=>v.trim()))]:[];
    result.transcript=Array.isArray(saved.transcript)?saved.transcript.filter(e=>object(e)&&typeof e.text==='string').map(e=>({sender:typeof e.sender==='string'?e.sender:'Court record',text:e.text,isUser:e.isUser===true})):[];
    result.docket=[];
    if(Array.isArray(saved.docket)) for(const e of saved.docket) { try{result.docket.push(exhibit(e));}catch(_){} }
    result.exhibitNotes=Object.fromEntries(object(saved.exhibitNotes)?Object.entries(saved.exhibitNotes).filter(([k,v])=>safeKey(k)&&typeof v==='string'):[]);
    const repairedRecord = repairOccupationRecord(saved.activeCaseSeed, saved.profile?.clientOccupation);
    if(object(repairedRecord)&&!seedError(repairedRecord)) result.activeCaseSeed=repairedRecord;
    result.profile.clientOccupation = occupation(result.activeCaseSeed?.seed?.roster?.client?.occupation) ?? occupation(saved.profile?.clientOccupation) ?? recordOccupation(result.activeCaseSeed);
    if (!result.hasActiveCase && result.profile.clientOccupation === null) result.profile.clientOccupation = 'civilian';
    Object.assign(result, RYCStandard.normalize(saved));
    return result;
  }
  function needsRecovery(saved) {
    if(!object(saved))return true;
    for(const key of ['hasActiveCase','hasSeenTrashWarning','intakeComplete'])if(saved[key]!==undefined&&typeof saved[key]!=='boolean')return true;
    for(const key of ['phase','notes','difficulty','category','selectedModel'])if(saved[key]!==undefined&&typeof saved[key]!=='string')return true;
    for(const key of ['turn','ap','strikes','maxStrikes','complexity'])if(saved[key]!==undefined&&(!Number.isSafeInteger(saved[key])||saved[key]<0))return true;
    if(saved.profile!==undefined){if(!object(saved.profile))return true;for(const key of ['title','client','judge','da'])if(saved.profile[key]!==undefined&&typeof saved.profile[key]!=='string')return true;}
    for(const key of ['facts','trashedFacts','hiddenFacts'])if(saved[key]!==undefined&&(!Array.isArray(saved[key])||saved[key].some(v=>typeof v!=='string')))return true;
    if(saved.docket!==undefined){if(!Array.isArray(saved.docket))return true;try{saved.docket.forEach(exhibit);}catch(_){return true;}}
    if(saved.transcript!==undefined&&(!Array.isArray(saved.transcript)||saved.transcript.some(e=>!object(e)||typeof e.text!=='string')))return true;
    if(saved.exhibitNotes!==undefined&&(!object(saved.exhibitNotes)||Object.entries(saved.exhibitNotes).some(([k,v])=>!safeKey(k)||typeof v!=='string')))return true;
    if(saved.activeCaseSeed!=null && seedError(saved.activeCaseSeed))return true;
    if(saved.profile?.clientOccupation!==undefined && saved.profile.clientOccupation!==null && !validOccupation(saved.profile.clientOccupation))return true;
    const seededRole=recordOccupation(saved.activeCaseSeed);
    if(seededRole && validOccupation(saved.profile?.clientOccupation) && seededRole!==saved.profile.clientOccupation)return true;
    return false;
  }
  function parse(raw) {
    if(typeof raw!=='string'||!raw.trim()) invalid('The server returned an empty or invalid reply.');
    const blocks=[...raw.matchAll(/<!--STATE_CHECKPOINT:\s*([\s\S]*?)-->/g)];
    if(blocks.length>1) invalid('The reply contains multiple state checkpoints.');
    if(raw.includes('<!--STATE_CHECKPOINT:')&&!blocks.length) invalid('The state checkpoint is incomplete.');
    let update=null;
    if(blocks.length) {try{update=JSON.parse(blocks[0][1]);}catch(_){invalid('The state checkpoint is not valid JSON.');}if(!object(update))invalid('The state checkpoint must be an object.');}
    return {text:raw.replace(/<!--[\s\S]*?-->/g,'').trim(), update};
  }
  function validateInitialization(state, raw) {
    if (!parse(raw).update) invalid('Setup response is missing its state checkpoint. Retry setup.');
    if (['title','client','judge','da'].some(key=>placeholder(state.profile[key])) || state.docket.length < 2)
      invalid('Setup response did not initialize the roster and two starter exhibits. Retry setup.');
  }
  function next(current, raw, channel='court', options={}) {
    const parsed=parse(raw), next=clone(current), u=parsed.update;
    if(channel==='diaz' && options.contractVersion===2) RYCStandard.validateDiscovery(raw,current);
    if(!u || !current.hasActiveCase) { if(channel==='court'&&current.hasActiveCase)next.turn++;RYCStandard.applyRecords(next,raw,channel,options.requestText||'',current);return {state:next,text:parsed.text}; }
    if(channel==='court' && u.turn===undefined)next.turn=current.turn+1;
    if(channel==='partner') invalid('Consultations cannot update case resources.');
    let grant = 0;
    if(u.apGrant !== undefined) {
      const g=u.apGrant, phase=u.phase ?? current.phase;
      if(channel!=='court' || !/^Phase 3(?:\.5)?(?:\b|:)/i.test(String(phase)) || current.trialEnded || u.trialEnded===true)
        invalid('AP grants require a new court development during trial.');
      if(!object(g) || typeof g.id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(g.id) || typeof g.reason!=='string' || !g.reason.trim() || g.reason.length>500)
        invalid('Invalid AP development identifier or reason.');
      if((typeof g.fact==='string') === (typeof g.exhibitId==='string')) invalid('An AP development must reference one new fact or exhibit.');
      const reference = typeof g.fact==='string' ? 'fact:'+g.fact.trim().toLowerCase() : 'exhibit:'+g.exhibitId.trim().toLowerCase();
      const awarded=current.apGrants || [];
      const duplicate=awarded.some(a=>a.id===g.id || a.reference===reference);
      if(!duplicate) {
        const newFact=typeof g.fact==='string' && g.fact.trim() && Array.isArray(u.facts) && u.facts.includes(g.fact) && !(current.facts || []).some(f=>f.trim().toLowerCase()===g.fact.trim().toLowerCase());
        const newExhibit=typeof g.exhibitId==='string' && Array.isArray(u.docket) && u.docket.some(e=>object(e) && (e.id||e.tag)===g.exhibitId) && !(current.docket || []).some(e=>String(e.id||e.tag).trim().toLowerCase()===g.exhibitId.trim().toLowerCase());
        if(!newFact && !newExhibit) invalid('AP grants must reference newly disclosed evidence or a fact.');
        if(awarded.length*2 + 2 > apGrantLimit(current)) invalid('The case has reached its trial development AP allowance.');
        grant=2;
        next.apGrants=[...awarded,{id:g.id,reference,reason:g.reason.trim(),amount:2}];
        next.apGrantsTotal=next.apGrants.length*2;
      }
    }
    if(u.ap===undefined && grant) next.ap=current.ap+grant;
    if(u.trialEnded!==undefined){if(typeof u.trialEnded!=='boolean')invalid('Invalid checkpoint trialEnded.');if(channel==='court')next.trialEnded=u.trialEnded;}
    const lockedRole = clientOccupation(current);
    const reportedRoles = [u.clientOccupation,u.case?.clientOccupation].filter(value=>value!==undefined);
    for (const value of reportedRoles) {
      if (!validOccupation(value) || (lockedRole && value !== lockedRole)) invalid('Checkpoint cannot change the client occupation.');
    }
    if (new Set(reportedRoles).size > 1) invalid('Checkpoint has conflicting client occupations.');
    // Only the court can classify an unresolved legacy client, once.
    next.profile.clientOccupation = lockedRole ?? (channel==='court' ? reportedRoles[0] ?? null : null);
    if (next.profile.clientOccupation && object(next.activeCaseSeed)) next.activeCaseSeed=repairOccupationRecord(next.activeCaseSeed,next.profile.clientOccupation);
    for(const key of ['turn','ap','strikes']) if(u[key]!==undefined) {
      if(!Number.isSafeInteger(u[key])||u[key]<0) invalid('Invalid checkpoint '+key+'.');
      if(channel==='court'||key==='ap')next[key]=u[key];
    }
    for(const key of ['phase','caseTitle','clientName','judge','da']) if(u[key]!==undefined&&typeof u[key]!=='string')invalid('Invalid checkpoint '+key+'.');
    if(u.case!==undefined) { if(!object(u.case))invalid('Invalid checkpoint case.');for(const key of ['title','client'])if(u.case[key]!==undefined&&typeof u.case[key]!=='string')invalid('Invalid case '+key+'.'); }
    if(u.facts!==undefined) {if(!Array.isArray(u.facts)||u.facts.some(f=>typeof f!=='string'))invalid('Checkpoint facts must be a list of text.');next.facts=[...new Set([...next.facts,...u.facts])];}
    if(u.docket!==undefined) {
      if(!Array.isArray(u.docket))invalid('Checkpoint docket must be a list.');
      const incoming=u.docket.map(e=>({...exhibit(e),isApi:true}));
      const ids=incoming.map(e=>e.id||e.tag);if(new Set(ids).size!==ids.length)invalid('Duplicate exhibit identifiers.');
      next.docket=RYCStandard.mergeDocket(next.docket,incoming,channel);
    }
    // No model-driven refills; an explicit undo may refund a single action.
    const undoRefund = channel==='court' && options.undo===true && current.difficulty!=='Hard' && !grant ? 2 : 0;
    if(channel==='court' && next.ap > current.ap + grant + undoRefund) invalid('AP cannot increase without an eligible trial development.');
    if(channel==='court' && current.ap + grant - next.ap > 2) invalid('A reply cannot spend more than 2 AP.');
    if(grant && (next.ap > current.ap+grant || next.ap < current.ap+grant-2)) invalid('Incorrect AP total for the trial development.');
    if(channel==='diaz') {
      if(next.ap>current.ap||current.ap-next.ap>2)invalid('An investigation cannot increase AP or spend more than 2 AP.');
      next.turn=current.turn+1;
    } else {
      if(u.phase!==undefined)next.phase=u.phase;
      if(u.case?.title!==undefined||u.caseTitle!==undefined)next.profile.title=u.caseTitle??u.case.title;
      if(u.case?.client!==undefined||u.clientName!==undefined)next.profile.client=u.clientName??u.case.client;
      for(const key of ['judge','da'])if(u[key]!==undefined)next.profile[key]=u[key];
    }
    RYCStandard.applyRecords(next,raw,channel,options.requestText||'',current);
    return {state:next,text:parsed.text};
  }
  return {AP_VERSION,apBudget,apLabel,apContext,apGrantLimit,occupations,validOccupation,occupation,recordOccupation,clientOccupation,occupationLabel,repairOccupationRecord,object,clone,history,normalize,needsRecovery,next,parse,exhibit,placeholder,intakeStatus,seedError,emptyState,validateInitialization};
})();

globalThis.RYCState = RYCState;
