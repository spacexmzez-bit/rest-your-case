/* File name: extreme-worker-case.js — Foundation v2 Durable Object, stable namespace and compatibility. */
import catalog from './extreme-data.v1.json' with {type:'json'};
import {fail,copy,validateBlueprint,validateBrief,budget,publicSnapshot,xmlSpeech} from './extreme-state.js';
import {modelJSON} from './extreme-ai.js';
import {BLUEPRINT_SCHEMA,BRIEF_SCHEMA,GENERATE_PROMPT,MATERIALIZE_PROMPT} from './extreme-prompts.js';
import {validateRequest,id,shape} from './extreme-contracts.js';
import {RETENTION,modelFor} from './extreme-config.js';
import {CaseDB} from './extreme-db.js';
import {CaseActions} from './extreme-actions.js';
import {canonical,registry,visible} from './extreme-access.js';
import {event,exchange,officialEvents} from './extreme-events.js';
import {memoryStatus,refreshMemory} from './extreme-memory.js';
import {migrateLegacy} from './extreme-migration.js';
import {freezeReview,stepReview} from './extreme-verdict.js';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const choose=a=>a[crypto.getRandomValues(new Uint32Array(1))[0]%a.length];
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export class ExtremeCase{
 constructor(ctx,env){this.ctx=ctx;this.env={...env};this.queue=Promise.resolve();this.db=new CaseDB(ctx.storage);this.env.onModelUsage=usage=>{this.db.sql.exec('INSERT INTO model_usage VALUES(?,?)',crypto.randomUUID(),JSON.stringify({...usage,caseIdHash:this.contextHash,operationId:this.contextOperation||null,generation:this.db.get('caseState')?.generation||1,createdAt:Date.now()}));};}
 fetch(request){const result=this.queue.then(()=>this.handle(request));this.queue=result.catch(()=>{});return result;}
 async alarm(){return this.queue=this.queue.catch(()=>{}).then(async()=>{if(this.db.get('tombstone')){await this.cleanupRevoked();return;}const s=this.db.state();if(s&&Date.now()-s.lastActive>=RETENTION)await this.revoke(s,'expired');else if(s)await this.schedule(s);});}
 async schedule(s){try{await this.ctx.storage.setAlarm(s.lastActive+RETENTION);}catch{/* Committed receipts remain successful; access also enforces expiry. */}}
 snapshot(s,lang){const p=publicSnapshot(s,lang);p.history=[];return {...p,schemaVersion:2,revision:s.revision,generation:s.generation,lastSeq:s.lastSeq,roster:registry(s),verdictJob:this.activeVerdict(s),standId:s.standId,foundations:s.foundations||{},usage:this.db.rows("SELECT count(*) AS calls,sum(CASE WHEN json_extract(json,'$.usageReported')=0 OR (json_extract(json,'$.usageReported') IS NULL AND json_extract(json,'$.errorCode') IS NOT NULL) THEN 1 ELSE 0 END) AS unknownUsageCalls,coalesce(sum(json_extract(json,'$.inputTokens')),0) AS inputTokens,coalesce(sum(json_extract(json,'$.outputTokens')),0) AS outputTokens,coalesce(sum(json_extract(json,'$.thinkingTokens')),0) AS thinkingTokens FROM model_usage")[0],memory:registry(s).filter(a=>a.id!=='DEFENSE').map(a=>memoryStatus(this.db,s,a.id)),migrationWarning:s.migrationWarning||null};}
 activeVerdict(s){const row=this.db.rows("SELECT json FROM jobs WHERE kind='verdict' AND status IN ('pending','reviewing','ready') ORDER BY rowid LIMIT 1")[0];if(!row)return null;const j=JSON.parse(row.json);return j.revision===s.revision&&j.generation===s.generation?{id:j.id,status:j.status,reviewed:j.batches.filter(b=>b.status==='reviewed').length,total:j.batches.length}:null;}
 response(s,lang,extra={}){return {apiVersion:2,caseId:s.caseId,revision:s.revision,generation:s.generation,snapshot:this.snapshot(s,lang),activeModel:modelFor('actor',this.env),...extra};}
 async revoke(s,reason,receipt=null){this.db.tx(()=>{this.db.clear();this.db.set('tombstone',{caseId:s.caseId,tokenHash:s.tokenHash,reason,receipt,cleanupPending:true,at:Date.now()});});await this.cleanupRevoked();}
 async cleanupRevoked(){const tomb=this.db.get('tombstone');if(!tomb)return;try{const keys=await this.ctx.storage.list();for(const key of keys.keys())await this.ctx.storage.delete(key);if(tomb.cleanupPending){tomb.cleanupPending=false;this.db.set('tombstone',tomb);}try{await this.ctx.storage.deleteAlarm();}catch{}}catch{try{await this.ctx.storage.setAlarm(Date.now()+60000);}catch{}/* The denial and purge receipt are committed; retry legacy cleanup without restoring the case. */}}
 normalizeLegacy(body,s){
  if(body.apiVersion===2)return body;
  const b={apiVersion:2,op:body.op,caseId:body.caseId,language:body.language,operationId:body.operationId};
  if(body.op==='create')return {...b,genre:body.genre==='random'?'bank':body.genre,difficulty:body.difficulty,engineMode:body.engineMode};
  if(body.op==='snapshot'){delete b.operationId;return b;}
  const match=(body.message||'').trim().match(/^\/(\w+)(?:\s+([AEW]\d{2}))?/i);const cmd=match?.[1]?.toLowerCase();if(cmd==='verdict')return {...b,op:'verdict',expectedRevision:body.expectedRevision,expectedGeneration:s?.generation||1};
  const recipient=canonical(body.recipient==='court'?'judge':body.recipient?.startsWith('witness:')?s?.blueprint.witnesses.find(w=>'witness:'+w.name===body.recipient)?.id:body.recipient)||'JUDGE';
  return {...b,expectedRevision:body.expectedRevision,expectedGeneration:s?.generation||1,channel:body.channel,recipientId:recipient,command:cmd||'message',message:body.message,targetId:match?.[2]?.toUpperCase()};
 }
 async handle(request){let body;
  try{
   body=await request.json();if(!id(body?.caseId))fail('INVALID_CASE_ID','Invalid case ID.');
   const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!id(token)||token.length<32)fail('CASE_ACCESS_REQUIRED','Saved case capability is missing.',401);const hash=await digest(token);this.contextHash=await digest(body.caseId);this.contextOperation=body.operationId;
   await migrateLegacy(this.db,this.ctx.storage);let s=this.db.state(),tomb=this.db.get('tombstone');
   if(tomb){if(tomb.tokenHash!==hash||tomb.caseId!==body.caseId)fail('CASE_ACCESS_DENIED','Case capability does not match.',403);await this.cleanupRevoked();if(body.op==='purge'&&tomb.receipt?.operationId===body.operationId)return json(tomb.receipt);fail('CASE_'+tomb.reason.toUpperCase(),'This case was permanently deleted or expired.',410);}
   if(s&&(s.caseId!==body.caseId||s.tokenHash!==hash))fail('CASE_ACCESS_DENIED','Case capability does not match.',403);
   if(s&&Date.now()-s.lastActive>RETENTION){await this.revoke(s,'expired');fail('CASE_EXPIRED','Case expired after 90 days without activity.',410);}
   const legacy=body.apiVersion!==2,legacySignature=JSON.stringify([body.channel,body.recipient,body.message,body.kind||'message']);if(legacy&&body.engineMode!=='smart')fail('EXTREME_REQUIRES_SMART','Extreme gameplay requires Smart.');body=this.normalizeLegacy(body,s);validateRequest(body);
   const key=request.headers.get('X-Custom-Gemini-Key')?.trim()||this.env.GEMINI_API_KEY?.trim();
   if(body.op==='create'){let result=await this.create(body,s,hash,key);if(legacy&&result.creationStatus==='blueprintReady')result=await this.create(body,this.db.state(),hash,key);return json(result);}
   if(!s?.brief)fail('CASE_NOT_READY','Finish generating this case first.',404);
   s.lastActive=Date.now();this.db.save(s);await this.schedule(s);
   if(body.op==='snapshot')return json(this.response(s,body.language));
   if(['archive','search'].includes(body.op)){
    const limit=Math.max(1,Math.min(Number.isSafeInteger(body.limit)?body.limit:50,50)),events=[];let cursor=body.afterSeq||0,more=false;
    while(events.length<limit){const page=this.db.page(cursor,50);if(!page.length)break;for(const e of page){cursor=e.seq;const match=visible(e,'DEFENSE')&&(!body.sourceId||e.id===body.sourceId)&&(!body.actorId||e.actorId===body.actorId)&&(!body.exhibitId||e.exhibitRefs.includes(body.exhibitId))&&(!body.query||e.text.normalize('NFKC').toLowerCase().includes(body.query.normalize('NFKC').toLowerCase()));if(match)events.push(e);if(events.length>=limit)break;}}
    more=this.db.page(cursor,1).length>0;return json({apiVersion:2,caseId:s.caseId,events,nextSeq:cursor,hasMore:more});
   }
   if(body.op==='operation'){const op=this.db.operation(body.operationId);return json({apiVersion:2,caseId:s.caseId,status:op?.status||'missing',language:op?.input?.language||null,receipt:op?.response||null,retryAfter:op?.status==='running'?Math.max(0,90000-(Date.now()-op.updated_at)):0});}
   if(body.op==='clerk'){
    if(body.scope!=='permitted')fail('INVALID_SCOPE','Use permitted actor memory only.');const result=await refreshMemory(this.db,s,body.actorId,body.throughSeq,key,this.env);const job=this.db.getJob('clerk:'+body.actorId);if(job){job.status=result.status.throughSeq>=job.throughSeq?'completed':'pending';this.db.job(job);}return json({apiVersion:2,caseId:s.caseId,...result});
   }
   if(body.op==='continue'){
    const j=this.db.getJob(body.jobId);if(!j||j.kind!=='verdict')fail('UNKNOWN_JOB','Review job not found.',404);if(j.status==='committed')return json(this.response(s,body.language,{job:{id:j.id,status:j.status},receipt:this.db.operation(j.operationId)?.response}));
    const result=await stepReview(this.db,s,j,key,this.env,body.language);
    if(result.verdict){const current=this.db.state();if(current.revision!==j.revision||current.generation!==j.generation)fail('JOB_CANCELLED','Case record changed.',409);s.verdict=result.verdict;s.stage='ended';s.revision++;s.turn++;s.lastActive=Date.now();const e=event(s,{...body,operationId:j.operationId,command:'verdict',recipientId:'JUDGE'},'JUDGE','speech',result.verdict.speech,{visibility:'PUBLIC_COURT',audienceActorIds:[],payload:{verdict:true}}),receipt={operationId:j.operationId,events:[e],verdict:result.verdict};this.db.tx(()=>{this.db.append(e);this.db.save(s);j.status='committed';this.db.job(j);const op=this.db.operation(j.operationId);this.db.op(j.operationId,op.request_hash,'committed',j.revision,op.input,receipt);});await this.schedule(s);}
    return json(this.response(s,body.language,{job:{id:j.id,status:j.status,reviewed:j.batches.filter(b=>b.status==='reviewed').length,total:j.batches.length},usage:result.usage}));
   }
   if(body.op==='purgePreview'){const nonce=crypto.randomUUID();this.db.set('purgePreview',{nonce,revision:s.revision,generation:s.generation,tokenHash:hash,expiresAt:Date.now()+600000});return json({apiVersion:2,caseId:s.caseId,purgeNonce:nonce,revision:s.revision,generation:s.generation,title:s.brief.title,stage:s.stage,turn:s.turn,expiresAt:Date.now()+600000});}
   const requestHash=await digest(JSON.stringify(body)),prior=this.db.operation(body.operationId);
   if(prior){if(prior.status==='legacy'&&legacy&&prior.request_hash===legacySignature)return json(this.response(s,body.language,prior.response));if(prior.request_hash!==requestHash)fail('ACTION_ID_REUSED','Operation ID belongs to different input.',409);if(prior.status==='committed'||prior.status==='reviewing')return json(this.response(s,body.language,{receipt:prior.response,operationId:body.operationId,...(prior.response?.jobId?{job:{id:prior.response.jobId,status:'reviewing'}}:{})}));if(prior.status==='running'&&Date.now()-prior.updated_at<90000)fail('OPERATION_RUNNING','Poll the saved operation before retrying.',409);}
   if(body.expectedRevision!==s.revision||body.expectedGeneration!==s.generation)fail('STALE_CASE','Sync the case before another official action.',409);
   if(body.op==='purge'){
    const preview=this.db.get('purgePreview');if(!preview||preview.nonce!==body.purgeNonce||preview.tokenHash!==hash||preview.revision!==s.revision||preview.generation!==s.generation||preview.expiresAt<Date.now()||body.confirmedTitle!==s.brief.title)fail('PURGE_CONFIRMATION_STALE','Request a fresh purge preview and confirm the exact title.',409);
    const receipt={apiVersion:2,caseId:s.caseId,operationId:body.operationId,deleted:true};await this.revoke(s,'purged',receipt);return json(receipt);
   }
   if(body.op==='verdict'){
    if(s.stage!=='closing')fail('WRONG_PHASE','Complete closing arguments first.',409);const active=this.activeVerdict(s);if(active)fail('VERDICT_IN_PROGRESS','Continue the existing verdict review after syncing.',409);if(!this.db.rows("SELECT seq FROM events WHERE reverted=0 AND visibility='PUBLIC_COURT' AND actor_id='DEFENSE' AND json_extract(json,'$.payload.closingArgument')=1 LIMIT 1").length)fail('CLOSING_ARGUMENT_REQUIRED','Submit your closing argument to the judge before requesting a verdict.',409);let j;this.db.tx(()=>{j=freezeReview(this.db,s,body.operationId);this.db.op(body.operationId,requestHash,'reviewing',s.revision,body,{jobId:j.id});});return json(this.response(s,body.language,{job:{id:j.id,status:j.status},operationId:body.operationId}));
   }
   if(body.op!=='action')fail('INVALID_OPERATION','Unsupported operation.');
   if(this.db.rows("SELECT id FROM jobs WHERE kind='verdict' AND status IN ('pending','reviewing','ready')").length)fail('VERDICT_IN_PROGRESS','Finish the frozen verdict review before another action.',409);
   this.validateChannel(body,s);
   this.db.op(body.operationId,requestHash,'running',s.revision,body);
   try{
    const next=copy(s),legacyBody={...body,originalChannel:body.channel,recipient:({CLIENT:'client',JUDGE:'judge',PROSECUTOR:'prosecutor',PARTNER:'partner',DIAZ:'diaz'})[body.recipientId]||body.recipientId,channel:body.channel==='interview'?'court':body.channel,message:body.command==='message'?body.message.trim():'/'+body.command+(body.targetId?' '+body.targetId:'')+(body.message&&!['prepare','trial','close','prosecution'].includes(body.command)?' '+body.message:'')};
    const out=await new CaseActions(this.db,this.env).action(next,legacyBody,key);const events=exchange(next,body,out);if(next.stage==='closing'&&body.command==='message'&&body.channel==='court'&&body.recipientId==='JUDGE')events[0].payload.closingArgument=true;
    officialEvents(s,next,body,out,events);const current=this.db.state();if(current.revision!==s.revision||current.generation!==s.generation)fail('STALE_CASE','Case changed before commit.',409);
    next.revision++;next.lastActive=Date.now();const receipt={operationId:body.operationId,events,usage:out.usage};
    this.db.tx(()=>{events.forEach(e=>this.db.append(e));this.db.save(next);this.db.op(body.operationId,requestHash,'committed',s.revision,body,receipt);this.db.job({id:'clerk:'+canonical(out.entry.actorId),kind:'clerk',status:'pending',generation:next.generation,actorId:canonical(out.entry.actorId),throughSeq:next.lastSeq});});await this.schedule(next);
    return json(this.response(next,body.language,{...receipt,receipt,...(legacy?{reply:xmlSpeech(out.entry.name,out.entry.role,out.entry.speech)}:{})}));
   }catch(e){if(this.db.operation(body.operationId)?.status!=='committed')this.db.op(body.operationId,requestHash,'failed',s.revision,body,{error:e.code||'ACTION_FAILED'});throw e;}
  }catch(e){return json({error:e.code||'EXTREME_ERROR',details:e.code?e.message:'Could not complete the Extreme request.',retryable:!e.code||[429,500,502,503,504].includes(e.status),operationId:body?.operationId},e.status||500);}
 }
 validateChannel(b,s){
  if(b.recipientId==='DEFENSE')fail('INVALID_ACTOR','Select a responding character.');
  if(b.channel==='partner'&&(b.recipientId!=='PARTNER'||b.command!=='message')||b.channel==='diaz'&&(b.recipientId!=='DIAZ'||!['message','investigate','subpoena','inspect'].includes(b.command))||b.channel==='interview'&&(!/^W\d/.test(b.recipientId)&&b.recipientId!=='CLIENT'||b.command!=='message')||b.channel==='court'&&['PARTNER','DIAZ'].includes(b.recipientId))fail('INVALID_CHANNEL','Actor and action do not match this channel.');
  if(b.command==='message'&&/^\s*\//.test(b.message))fail('TYPED_COMMAND_REQUIRED','Use a typed action for slash commands.');
  if(['prepare','trial','close','admit','suppress','prosecution','safety'].includes(b.command)&&(b.channel!=='court'||b.recipientId!=='JUDGE'))fail('COURT_REQUIRED','Address official actions to the judge.');
  if(b.command==='call'&&(b.channel!=='court'||b.recipientId!==b.targetId))fail('WITNESS_REQUIRED','Select the witness being called.');
 }
 async create(b,s,tokenHash,key){
  if(b.genre!=='bank'||!['Sandbox','Easy','Normal','Hard'].includes(b.difficulty)||b.engineMode!=='smart')fail('INVALID_INTAKE','Foundation generates bank cases using Smart only.');
  const signature=JSON.stringify([b.genre,b.difficulty,b.language]);if(s&&s.creationSignature!==signature)fail('CASE_ID_REUSED','This case belongs to another search.',409);if(s?.brief)return this.response(s,b.language);
  if(!s){const genre=catalog.genres.find(g=>g.id==='bank');s={schemaVersion:2,generation:1,lastSeq:0,revision:0,caseId:b.caseId,tokenHash,creationSignature:signature,genre:copy(genre),subgenre:choose(genre.subgenres),judge:choose(catalog.judges),prosecutor:choose(catalog.prosecutors),clientAttitude:choose(catalog.clientAttitudes),pattern:choose([{C01:false,C02:false},{C01:true,C02:false},{C01:true,C02:true}]),difficulty:b.difficulty,language:b.language,lastActive:Date.now()};this.db.tx(()=>{this.db.save(s);this.db.set('schemaVersion',2);});await this.schedule(s);}
  if(!s.blueprint){const r=await modelJSON(key,GENERATE_PROMPT,{template:s.genre,subgenre:s.subgenre,venue:catalog.jurisdiction,judge:s.judge,prosecutor:s.prosecutor,clientAttitude:s.clientAttitude,witnessProfiles:catalog.witnessProfiles,lawCards:catalog.lawCards,responsibilityPattern:s.pattern,nonce:s.caseId},BLUEPRINT_SCHEMA,'generation',this.env);shape(r.value,BLUEPRINT_SCHEMA);const mechanics=validateBlueprint(r.value,s.pattern,[s.judge.name,s.prosecutor.name]);s.blueprint=r.value;s.blueprintHash=await digest(JSON.stringify(r.value));Object.assign(s,mechanics);this.db.tx(()=>this.db.save(s));return {apiVersion:2,caseId:s.caseId,creationStatus:'blueprintReady',retrySameCreate:true,usage:r.usage};}
  const bp=s.blueprint,r=await modelJSON(key,MATERIALIZE_PROMPT,{language:b.language,title:bp.title,summary:bp.summary,exhibits:bp.evidence.filter(e=>['E01','E02','E03','E04'].includes(e.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(({id,name,details})=>({id,name,details})),witnesses:bp.witnesses.map(({id,publicBio})=>({id,bio:publicBio})),leads:bp.leads.filter(a=>a.availablePhase==='preparation').map(({id,label,description})=>({id,label,description})),client:{name:bp.client.name,initialStatement:'I dispute the accusation. I need to understand the evidence before I explain my part.'}},BRIEF_SCHEMA,'brief',this.env);shape(r.value,BRIEF_SCHEMA);s.brief=validateBrief(r.value,bp);
  Object.assign(s,{initialAP:budget(s.difficulty,s.baseAP),ap:budget(s.difficulty,s.baseAP),stage:'intake',turn:1,trialTurns:0,strikes:0,maxStrikes:['Easy','Sandbox'].includes(s.difficulty)?4:s.difficulty==='Hard'?2:3,revision:1,completedLeads:[],discovered:['E01','E02','E03','E04'],evidenceStatus:{},localizedExhibits:{},heardWitnesses:[],prosecutionPresented:[],safeWitnesses:[],publicFacts:[],standId:null,trialLeadAnnounced:false,foundations:{},lastActive:Date.now()});
  const e=event(s,{...b,command:'message',recipientId:'CLIENT'},'CLIENT','speech',s.brief.openingSpeech,{visibility:'INTERVIEW',audienceActorIds:['DEFENSE','CLIENT']});this.db.tx(()=>{this.db.append(e);this.db.save(s);});await this.schedule(s);return this.response(s,b.language,{events:[e],usage:r.usage});
 }
}
export async function routeExtreme(request,env,cors){
 if(!env.EXTREME_CASES)return new Response(JSON.stringify({error:'EXTREME_NOT_CONFIGURED',details:'Deploy the Foundation Worker first.'}),{status:503,headers:{...cors,'Content-Type':'application/json'}});
 try{const reader=request.body?.getReader();if(!reader)fail('INVALID_JSON','Missing request body.');let size=0,chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>32768){await reader.cancel();fail('PAYLOAD_TOO_LARGE','Request exceeds 32 KiB.',413);}chunks.push(r.value);}const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length;}const body=JSON.parse(new TextDecoder().decode(bytes));if(!id(body.caseId))fail('INVALID_CASE_ID','Invalid case ID.');if(!['create','action','verdict','purge'].includes(body.op)&&size>16384)fail('PAYLOAD_TOO_LARGE','Read request exceeds 16 KiB.',413);const response=await env.EXTREME_CASES.get(env.EXTREME_CASES.idFromName(body.caseId)).fetch(new Request('https://extreme.internal/',{method:'POST',headers:request.headers,body:JSON.stringify(body)}));return new Response(response.body,{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}catch(e){return new Response(JSON.stringify({error:e.code||'INVALID_JSON',details:e.code?e.message:'Invalid request.',retryable:false}),{status:e.status||400,headers:{...cors,'Content-Type':'application/json'}});}
}
