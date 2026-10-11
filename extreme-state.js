/* File name: extreme-state.js — server-only blueprint validation, AP and public projection. */
export function fail(code,details,status=400){throw Object.assign(new Error(details),{code,status});}
export const copy=x=>structuredClone(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function text(x,max=1500){if(typeof x!=='string'||!x.trim()||x.length>max||/[\u0000]/.test(x))fail('INVALID_BLUEPRINT','Case contains a missing or excessive text field.',502);}
function refs(list,allowed,label,empty=true){if(!Array.isArray(list)||(!empty&&!list.length)||list.length>40||new Set(list).size!==list.length||list.some(x=>!allowed.has(x)))fail('INVALID_BLUEPRINT','Invalid references: '+label,502);}
function collection(list,prefix,n){if(!Array.isArray(list)||list.length!==n)fail('INVALID_BLUEPRINT',`Expected ${n} ${prefix} records.`,502);const expected=new Set(Array.from({length:n},(_,i)=>prefix+String(i+1).padStart(2,'0')));if(list.some(x=>!plain(x)||!expected.has(x.id))||new Set(list.map(x=>x.id)).size!==n)fail('INVALID_BLUEPRINT','Case IDs are missing or duplicated.',502);return expected;}
export function validateBlueprint(b,pattern,reservedNames=[]){
  if(!plain(b)||!plain(b.client)||!plain(b.truth)||!plain(b.defenseRoute))fail('INVALID_BLUEPRINT','Case structure is incomplete.',502);
  text(b.title,180);text(b.summary,1000);text(b.client.name,100);text(b.client.attitude,600);text(b.truth.account,4000);text(b.truth.accountArabic,5000);
  if(!Array.isArray(b.truth.facts)||b.truth.facts.length<8||b.truth.facts.length>30)fail('INVALID_BLUEPRINT','Case needs 8–30 fixed facts.',502);
  const facts=new Set();for(const f of b.truth.facts){if(!plain(f)||!/^F(?:0[1-9]|[12][0-9]|30)$/.test(f.id)||facts.has(f.id))fail('INVALID_BLUEPRINT','Invalid fact ID.',502);facts.add(f.id);text(f.text,700);}
  const ws=collection(b.witnesses,'W',6),es=collection(b.evidence,'E',12),as=collection(b.leads,'A',8),cs=collection(b.counts,'C',2);
  refs(b.client.knownFactIds,facts,'client knowledge',false);refs(b.client.withheldFactIds,new Set(b.client.knownFactIds),'client withholding',false);
  if(/[<>\r\n]/.test(b.client.name)||/^(?:TBD|unknown|anonymous)$/i.test(b.client.name)||reservedNames.some(n=>n.toLowerCase()===b.client.name.toLowerCase()))fail('INVALID_BLUEPRINT','Client needs a distinct usable name.',502);
  const names=new Set([b.client.name.toLowerCase(),...reservedNames.map(n=>n.toLowerCase())]);
  for(const w of b.witnesses){for(const key of ['name','role','publicBio','initialStatement'])text(w[key],key==='name'?100:900);if(/[<>\r\n]/.test(w.name)||names.has(w.name.toLowerCase()))fail('INVALID_BLUEPRINT','People must have distinct names.',502);names.add(w.name.toLowerCase());for(const key of ['prior','lieStatement'])if(typeof w[key]!=='string'||w[key].length>900)fail('INVALID_BLUEPRINT','Invalid witness field.',502);for(const key of ['fear','cooperation'])if(!Number.isInteger(w[key])||w[key]<0||w[key]>3)fail('INVALID_BLUEPRINT','Witness scores must be 0–3.',502);refs(w.knownFactIds,facts,'witness knowledge',false);refs(w.lieFactIds,new Set(w.knownFactIds),'authorized lie');refs(w.correctionEvidenceIds,es,'witness correction');if(w.lieStatement&&!w.lieFactIds.length)fail('INVALID_BLUEPRINT','A lie needs a bounded fact assignment.',502);}
  if(b.witnesses.filter(w=>w.fear>=2).length<2||!b.witnesses.some(w=>w.cooperation<=1)||!b.witnesses.some(w=>w.lieStatement&&w.lieFactIds.length))fail('INVALID_BLUEPRINT','Extreme needs frightened, reluctant and specifically unreliable witnesses.',502);
  for(const e of b.evidence){text(e.name,180);text(e.details,1000);if(!['Physical','Documentary','Digital','Forensic'].includes(e.type)||!ws.has(e.foundationWitnessId)||typeof e.legalIssue!=='string'||e.legalIssue.length>600)fail('INVALID_BLUEPRINT','Evidence source or type invalid.',502);refs(e.factIds,facts,'evidence facts',false);refs(e.excludeWithEvidenceIds,es,'suppression');if(e.excludeWithEvidenceIds.includes(e.id)||(!e.legalIssue&&e.excludeWithEvidenceIds.length))fail('INVALID_BLUEPRINT','Suppression route has no valid basis.',502);}
  for(const a of b.leads){text(a.label,150);text(a.description,600);if(![1,2].includes(a.cost)||a.availablePhase!==(a.id==='A08'?'trial':'preparation'))fail('INVALID_BLUEPRINT','Lead cost or stage invalid.',502);const index=Number(a.id.slice(1));if(JSON.stringify(a.evidenceIds)!==JSON.stringify(['E'+String(index+4).padStart(2,'0')]))fail('INVALID_BLUEPRINT','Each lead must unlock its assigned exhibit.',502);refs(a.requiresEvidenceIds,es,'lead prerequisites');if(a.requiresEvidenceIds.length>1||a.requiresEvidenceIds.some(id=>Number(id.slice(1))>=index+4))fail('INVALID_BLUEPRINT','Lead prerequisites must point to earlier evidence.',502);}
  // A lower-number dependency graph guarantees reachability from the four starters.
  refs(b.defenseRoute.leadIds,as,'defense route',false);refs(b.defenseRoute.coversChargeIds,cs,'route counts',false);
  if(b.defenseRoute.leadIds.length<6||!b.defenseRoute.leadIds.includes('A08')||b.defenseRoute.coversChargeIds.length!==2)fail('INVALID_BLUEPRINT','Route must cover both charges and the mid-trial lead.',502);
  const reached=new Set(['E01','E02','E03','E04']);let cost=0;
  for(const id of [...b.defenseRoute.leadIds].sort()){const a=b.leads.find(x=>x.id===id);if(a.requiresEvidenceIds.some(e=>!reached.has(e)))fail('INVALID_BLUEPRINT','Essential route omits a prerequisite.',502);a.evidenceIds.forEach(e=>reached.add(e));cost+=a.cost;}
  if(cost>24)fail('INVALID_BLUEPRINT','Essential route is too costly.',502);
  for(const c of b.counts){if(typeof c.factuallyResponsible!=='boolean'||c.factuallyResponsible!==pattern[c.id])fail('INVALID_BLUEPRINT','Responsibility pattern changed.',502);refs(c.coreEvidenceIds,es,'count evidence',false);refs(c.challengeEvidenceIds,es,'count challenge',false);text(c.resolutionHint,1200);text(c.resolutionHintArabic,1500);if(c.challengeEvidenceIds.some(e=>!reached.has(e)))fail('INVALID_BLUEPRINT','A charge challenge is missing from the fair route.',502);}
  return {essentialCost:cost,baseAP:Math.max(24,Math.ceil(cost*1.25)+5)};
}
export function budget(difficulty,base){return difficulty==='Sandbox'?1000000:Math.ceil(base*(difficulty==='Easy'?2.5:difficulty==='Normal'?1.75:1));}
export function validateBrief(p,b){
  if(!plain(p))fail('INVALID_BRIEF','Public case brief is missing.',502);for(const k of ['title','summary','openingSpeech'])text(p[k],k==='title'?180:1600);
  collection(p.exhibits,'E',4);collection(p.witnesses,'W',6);collection(p.leads,'A',7);
  for(const e of p.exhibits){text(e.name,180);text(e.details,1400);}
  for(const w of p.witnesses)text(w.bio,900);
  for(const a of p.leads){text(a.label,180);text(a.description,900);}
  // Names/IDs are never localized by the model; canonical names come from b.
  return p;
}
const tr=(lang,en,ar)=>lang==='ar'?ar:en;
export function phaseName(stage){return ({intake:'Phase 1: Intake',preparation:'Phase 2: Discovery',trial:'Phase 3: Trial',closing:'Phase 4: Closing arguments',ended:'Completed'})[stage];}
export function availableLeads(s){if(!['intake','preparation','trial'].includes(s.stage))return [];return s.blueprint.leads.filter(a=>!s.completedLeads.includes(a.id)&&(a.availablePhase==='preparation'||(s.stage==='trial'&&s.trialLeadAnnounced))&&a.requiresEvidenceIds.every(e=>s.discovered.includes(e)));}
export function prosecutionAgenda(s){
  const proofIds=[...new Set(['E01','E02','E03','E04',...s.blueprint.counts.flatMap(c=>c.coreEvidenceIds)])].filter(id=>s.discovered.includes(id)&&(s.evidenceStatus[id]||'Marked')!=='Excluded');
  const pending=proofIds.filter(id=>!(s.prosecutionPresented||[]).includes(id));
  const witnesses=[...new Set(pending.map(id=>s.blueprint.evidence.find(e=>e.id===id).foundationWitnessId))].filter(id=>!s.heardWitnesses.includes(id));
  return {complete:pending.length===0,witnessIds:witnesses,exhibitIds:pending};
}
export function publicSnapshot(s,language=s.language){
  const b=s.blueprint,p=s.brief;
  const charges=s.genre.charges.map(c=>({id:c.id,name:tr(language,c.name,c.ar+' ['+c.name+']'),statute:c.statute,elements:tr(language,c.elements,c.elementsAr),source:c.source,outcome:s.verdict?.counts.find(x=>x.id===c.id)?.outcome||'',reason:s.verdict?.counts.find(x=>x.id===c.id)?.reason||''}));
  return {caseId:s.caseId,serverRevision:s.revision,title:p.title,summary:p.summary,client:b.client.name,judge:s.judge.name,prosecutor:s.prosecutor.name,judgeProfile:{style:tr(language,s.judge.style,s.judge.ar)},prosecutorProfile:{style:tr(language,s.prosecutor.style,s.prosecutor.ar)},genre:tr(language,s.genre.name,s.genre.ar),genreId:s.genre.id,venue:tr(language,'US District Court — Northern District of Illinois','المحكمة الاتحادية — المنطقة الشمالية من إلينوي'),phase:phaseName(s.stage),stage:s.stage,prosecution:prosecutionAgenda(s),trialTurns:s.trialTurns,turn:s.turn,ap:s.ap,initialAP:s.initialAP,baseAP:s.baseAP,essentialCost:s.essentialCost,difficulty:s.difficulty,strikes:s.strikes,maxStrikes:s.maxStrikes,trialEnded:s.stage==='ended',charges,witnesses:b.witnesses.map(w=>({id:w.id,name:w.name,role:w.role,bio:p.witnesses.find(x=>x.id===w.id)?.bio||w.publicBio,heard:s.heardWitnesses.includes(w.id)})),docket:s.discovered.map(id=>{const e=b.evidence.find(x=>x.id===id);const localized=s.localizedExhibits[id]||p.exhibits.find(x=>x.id===id);return {id:e.id,name:localized?.name||e.name,type:e.type,details:localized?.details||e.details,status:s.evidenceStatus[id]||'Marked',foundation:tr(language,'Source witness: ','شاهد مصدر الدليل: ')+b.witnesses.find(w=>w.id===e.foundationWitnessId).name};}),leads:s.stage==='ended'?[]:availableLeads(s).map(a=>{const l=p.leads.find(x=>x.id===a.id);return {id:a.id,label:l?.label||tr(language,a.label,'تحقيق إضافي في المعروض '+a.evidenceIds[0]),description:l?.description||tr(language,a.description,'طلب التحقيق في معلومة ظهرت أثناء المحاكمة.'),cost:a.cost,availablePhase:a.availablePhase};}),completedLeads:[...s.completedLeads],facts:[tr(language,'The allegation is disputed; statements are claims unless supported by evidence.','الاتهام محل نزاع؛ الأقوال ادعاءات ما لم تسندها الأدلة.'),...s.publicFacts],resolution:s.stage==='ended'?tr(language,b.truth.account,b.truth.accountArabic):'',resolutionHints:s.stage==='ended'?b.counts.map(c=>({id:c.id,explanation:tr(language,c.resolutionHint,c.resolutionHintArabic)})):[],history:s.publicHistory.slice(-120),language:s.language,access:'free',expiresAt:s.lastActive+90*86400000};
}
export function xmlSpeech(name,role,speech){const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));return `<DIALOGUE><SPEAKER name="${esc(name)}" role="${role}">${esc(speech)}</SPEAKER></DIALOGUE>`;}
export function actorPacket(s,role,actor,message,language,result=null,rulingRequest=null){
  const b=s.blueprint;const facts=ids=>b.truth.facts.filter(f=>ids.includes(f.id));
  const pub={title:s.brief.title,summary:s.brief.summary,phase:phaseName(s.stage),charges:s.genre.charges.map(({id,name,statute,elements})=>({id,name,statute,elements})),evidence:s.discovered.map(id=>{const e=b.evidence.find(x=>x.id===id);return {id,name:e.name,details:e.details,status:s.evidenceStatus[id]||'Marked'};})};
  const packet={language,actor,publicCase:pub,playerMessage:message,recentDialogue:s.publicHistory.filter(h=>h.actorId===actor.id||h.sworn).slice(-6),completedInvestigation:result,rulingRequest};
  if(role==='client'){packet.actor={...actor,attitude:b.client.attitude,knowledge:facts(b.client.knownFactIds),withheldFactIds:b.client.withheldFactIds};}
  if(role==='witness'){const w=b.witnesses.find(w=>w.id===actor.id);packet.actor={...actor,roleDescription:w.role,prior:w.prior,fear:w.fear,cooperation:w.cooperation,knowledge:facts(w.knownFactIds),initialStatement:w.initialStatement,authorizedLie:w.lieStatement,lieFactIds:w.lieFactIds,correctionAuthorized:w.correctionEvidenceIds.length>0&&w.correctionEvidenceIds.every(e=>s.discovered.includes(e)),safetyRequested:s.safeWitnesses.includes(w.id)};}
  // Judge/prosecutor/partner receive no private truth, route, credibility scores or witness knowledge.
  return packet;
}
