/* File name: extreme-actions.js — typed authoritative gameplay; isolated single-actor Smart calls. */
import catalog from './extreme-data.v1.json' with {type:'json'};
import {fail,phaseName,prosecutionAgenda,availableLeads} from './extreme-state.js';
import {modelJSON} from './extreme-ai.js';
import {modelFor} from './extreme-config.js';
import {buildPacket,validateActor,reviewConsequential} from './extreme-actor.js';
import {ACTOR_SCHEMA_V2,actorPromptV2} from './extreme-prompts.js';
const phrases={en:{advanced:'The case has moved to ',completed:'This case has ended.',unavailable:'That investigation is not available yet.',duplicate:'That investigation is already complete; no AP was spent.',lead:'New mid-trial investigation available: A08. Its AP was included in your starting budget.',safety:'A witness safety request was recorded. It does not decide credibility or guarantee testimony.'},ar:{advanced:'انتقلت القضية إلى ',completed:'انتهت القضية.',unavailable:'هذا التحقيق غير متاح بعد.',duplicate:'اكتمل هذا التحقيق سابقاً؛ لم تُخصم نقاط إضافية.',lead:'ظهر التحقيق A08 أثناء المحاكمة. تكلفته محسوبة ضمن رصيدك الأساسي.',safety:'سُجل طلب حماية الشاهد. لا يقرر ذلك مصداقيته ولا يضمن شهادته.'}};
export class CaseActions {
 constructor(db,env){this.db=db;this.env=env;}
  async action(s,body,apiKey){
    const lang=body.language,b=s.blueprint,t=phrases[lang],message=body.message.trim();
    if(s.stage==='ended')fail('CASE_ENDED',t.completed,409);
    if(body.channel==='partner'&&/^\/(investigate|subpoena|inspect|admit|suppress|call|safety|prosecution)\b/i.test(message))fail('CONSULTATION_ONLY','Use the court or Investigator Diaz for case actions. Partner advice is free.');
    if(message.length>2400)fail('INVALID_MESSAGE','Message too long.');
    let role=body.channel==='partner'?'partner':body.channel==='diaz'?'investigator':'judge';
    let actor=role==='partner'?{id:'partner',name:lang==='ar'?'الشريك القانوني':'Senior Partner'}:role==='investigator'?{id:'diaz',name:lang==='ar'?'المحقق دياز':'Investigator Diaz'}:{id:'judge',name:s.judge.name,style:s.judge.style};
    const witness=b.witnesses.find(w=>w.id===body.recipient||'witness:'+w.name===body.recipient);
    if(body.channel==='court'){
      if(body.recipient==='client'){role='client';actor={id:'client',name:b.client.name};}
      else if(body.recipient==='da'||body.recipient==='prosecutor'){role='prosecutor';actor={id:'prosecutor',name:s.prosecutor.name,style:s.prosecutor.style};}
      else if(witness){role='witness';actor={id:witness.id,name:witness.name};}
      else if(!['court','judge',undefined].includes(body.recipient))fail('UNKNOWN_ACTOR','Choose a witness from this case.');
    }
    let result=null,rulingRequest=null,systemMessage=message,forcedSpeech=null,prosecutionExhibit=null;
    if(/^\/prosecution\s*$/i.test(message)){
      if(body.channel!=='court'||s.stage!=='trial')fail('TRIAL_REQUIRED','Hear the prosecution during the trial.');
      const agenda=prosecutionAgenda(s);
      if(agenda.complete)fail('PROSECUTION_COMPLETE','The disclosed prosecution evidence has already been presented.');
      if(agenda.witnessIds.length){
        const w=b.witnesses.find(w=>w.id===agenda.witnessIds[0]);s.standId=w.id;role='witness';actor={id:w.id,name:w.name};
        systemMessage='The prosecution has called you to testify. Give your assigned statement and explain the source of records you can authenticate. Do not speak as counsel or another witness.';
      }else{
        const e=b.evidence.find(e=>e.id===agenda.exhibitIds[0]);prosecutionExhibit=e.id;role='judge';actor={id:'judge',name:s.judge.name,style:s.judge.style};
        rulingRequest={id:e.id,kind:'admit',foundationReady:!!s.foundations?.[e.id],exclusionReady:false,knownIssue:''};
        systemMessage='The prosecution requests admission of '+e.id+' after its source witness testimony. Rule on foundation and relevant public objections. Admit if the foundation and evidence rules permit it; otherwise explain denial. The player can subsequently challenge or move to suppress it.';
      }
    }
    const command=message.match(/^\/(investigate|subpoena|inspect|admit|suppress|call|safety)\s+([AEW]\d{2})\b/i);
    if(command){const kind=command[1].toLowerCase(),id=command[2].toUpperCase();
      if(!['investigate','subpoena','inspect'].includes(kind)&&body.channel!=='court')fail('COURT_REQUIRED','Use the court for witness calls and evidence motions.');
      if(['investigate','subpoena'].includes(kind)){
        const a=b.leads.find(a=>a.id===id);if(!a)fail('UNKNOWN_LEAD','Use an available investigation ID such as A01.');
        if(s.completedLeads.includes(id)){forcedSpeech=t.duplicate;}
        else{
          if(!availableLeads(s).some(a=>a.id===id))fail('LEAD_LOCKED',t.unavailable);
          if(s.ap<a.cost)fail('INSUFFICIENT_AP','Not enough AP for this investigation. Advice and trial discussion remain free.',409);
          s.ap-=a.cost;s.completedLeads.push(id);a.evidenceIds.forEach(e=>{if(!s.discovered.includes(e))s.discovered.push(e);});
          result={leadId:id,cost:a.cost,exhibits:b.evidence.filter(e=>a.evidenceIds.includes(e.id)).map(({id,name,details,type})=>({id,name,details,type}))};
        }
        role='investigator';actor={id:'diaz',name:lang==='ar'?'المحقق دياز':'Investigator Diaz'};
      }else if(kind==='inspect'){
        const e=b.evidence.find(e=>e.id===id);if(!e||!s.discovered.includes(id))fail('UNKNOWN_EXHIBIT','Inspect only an exhibit already in your case file.');
        result={exhibits:[{id:e.id,name:e.name,details:e.details}],cost:0};role='investigator';actor={id:'diaz',name:lang==='ar'?'المحقق دياز':'Investigator Diaz'};
      }else if(kind==='call'){
        if(s.stage!=='trial')fail('TRIAL_REQUIRED','Begin the trial before calling a witness.');const w=b.witnesses.find(w=>w.id===id);if(!w)fail('UNKNOWN_WITNESS','Choose one of W01–W06.');s.standId=id;role='witness';actor={id:w.id,name:w.name};systemMessage='You have been called to testify. Give your assigned initial statement briefly. '+message;
      }else if(kind==='safety'){
        if(!b.witnesses.some(w=>w.id===id))fail('UNKNOWN_WITNESS','Unknown witness.');if(!s.safeWitnesses.includes(id))s.safeWitnesses.push(id);forcedSpeech=t.safety;role='judge';actor={id:'judge',name:s.judge.name};
      }else{
        const e=b.evidence.find(e=>e.id===id);if(!e||!s.discovered.includes(id))fail('UNKNOWN_EXHIBIT','Use an exhibit already discovered.');
        if(!['preparation','trial'].includes(s.stage))fail('WRONG_PHASE','Evidence motions are available in preparation or trial.');
        if(kind==='admit'&&s.evidenceStatus[id]==='Excluded')fail('EXHIBIT_EXCLUDED',lang==='ar'?'استُبعد هذا الدليل ولا يمكن إعادته بطلب قبول عادي.':'This exhibit was excluded and cannot be restored by an ordinary admission request.');
        role='judge';actor={id:'judge',name:s.judge.name,style:s.judge.style};rulingRequest={id:e.id,kind,foundationReady:!!s.foundations?.[e.id],exclusionReady:!!e.legalIssue&&e.excludeWithEvidenceIds.length>0&&e.excludeWithEvidenceIds.every(id=>s.discovered.includes(id)),knownIssue:e.excludeWithEvidenceIds.every(id=>s.discovered.includes(id))?e.legalIssue:''};
      }
    }else if(/^\/(investigate|subpoena|inspect|admit|suppress|call|safety)\b/i.test(message))fail('COMMAND_ID_REQUIRED','Use the ID shown on the Extreme case board, for example /investigate A01.');
    if(/^\/(prepare|trial|close|verdict)\s*$/i.test(message)){
      if(body.channel!=='court')fail('COURT_REQUIRED','Use the court for phase changes.');
      const cmd=message.slice(1).toLowerCase();const expected={prepare:'intake',trial:'preparation',close:'trial',verdict:'closing'};
      if(s.stage!==expected[cmd])fail('WRONG_PHASE','Finish the preceding stage before using this command.');
      if(cmd==='close'&&!prosecutionAgenda(s).complete)fail('PROSECUTION_PENDING',lang==='ar'?'استمع إلى شهود وأدلة الادعاء أولاً. استخدم زر متابعة قضية الادعاء.':'Hear the prosecution witnesses and evidence first. Use Continue prosecution case.');
      if(cmd==='close'&&s.trialTurns<3)fail('DISCOVERY_PENDING',lang==='ar'?'أكمل ثلاث جولات في المحكمة حتى يظهر التحقيق المقرر أثناء المحاكمة قبل المرافعة الختامية.':'Complete three court turns so the planned mid-trial lead can appear before closing arguments.');
      role='judge';actor={id:'judge',name:s.judge.name,style:s.judge.style};
      if(cmd==='verdict')fail('USE_VERDICT_JOB','Use the source review verdict control.');
      s.stage=({prepare:'preparation',trial:'trial',close:'closing'})[cmd];s.standId=null;
      systemMessage='The server has advanced to '+phaseName(s.stage)+'. Explain the next step briefly. '+message;
    }else if(/^\/(undo|start|end|reset)\b/i.test(message))fail('UNSUPPORTED_EXTREME_COMMAND','Use the Extreme case controls. Completed investigations and testimony cannot be undone.');
    if(s.stage==='trial'&&body.channel==='court')s.trialTurns++;
    if(s.trialTurns>=3&&!s.trialLeadAnnounced){s.trialLeadAnnounced=true;s.publicFacts.push(t.lead);systemMessage+='\n'+t.lead;}
    const packet=buildPacket(this.db,s,role,actor,body,systemMessage,lang,result,rulingRequest);packet.lawCards=catalog.lawCards.filter(c=>role==='judge'||role==='partner'||c.id==='safety');
    if(forcedSpeech)return this.finish(s,body,actor,role,forcedSpeech,{});
    const ai=await modelJSON(apiKey,actorPromptV2(role),packet,ACTOR_SCHEMA_V2,'actor',this.env),v=ai.value;
    validateActor(v,s,actor,packet,result,rulingRequest);
    if(v.ruling){
      await reviewConsequential(apiKey,v,packet,this.env);
      if(v.ruling.decision==='admit')s.evidenceStatus[v.ruling.exhibitId]='Admitted';
      if(v.ruling.decision==='exclude')s.evidenceStatus[v.ruling.exhibitId]='Excluded';
    }
    if(v.foundationClaims.some(c=>c.authenticates))await reviewConsequential(apiKey,v,packet,this.env);
    if(prosecutionExhibit&&!s.prosecutionPresented.includes(prosecutionExhibit))s.prosecutionPresented.push(prosecutionExhibit);
    const expectedExhibits=result?.exhibits?.map(e=>e.id)||[];
    if(!Array.isArray(v.localizedExhibits)||v.localizedExhibits.length!==expectedExhibits.length||new Set(v.localizedExhibits.map(e=>e.id)).size!==expectedExhibits.length||v.localizedExhibits.some(e=>!expectedExhibits.includes(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>200||typeof e.details!=='string'||!e.details.trim()||e.details.length>1500))fail('INVALID_EXHIBIT_TRANSLATION','Investigation result is incomplete; retry manually. No AP was spent.',502);
    for(const e of v.localizedExhibits)s.localizedExhibits[e.id]={name:e.name,details:e.details};
    return {...this.finish(s,body,actor,role,v.speech,ai.usage),assertions:v.assertions,foundationClaims:v.foundationClaims,ruling:v.ruling,exhibitRefs:[...new Set(v.assertions.flatMap(x=>x.sourceIds.filter(id=>/^E\d/.test(id))))]};
  }
  finish(s,body,actor,role,speech,usage){
    s.turn++;const sworn=role==='witness'&&s.stage==='trial'&&s.standId===actor.id&&body.originalChannel!=='interview';
    if(sworn&&!s.heardWitnesses.includes(actor.id))s.heardWitnesses.push(actor.id);
    const entry={operationId:body.operationId,channel:body.channel,actorId:actor.id,name:actor.name,role,speech,message:body.message,sworn,stage:s.stage,turn:s.turn};
    return {entry,usage,activeModel:modelFor('actor',this.env)};
  }
}
