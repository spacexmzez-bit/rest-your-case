/* File name: extreme-migration.js — freeze legacy truth, preserve surviving originals and retry receipts. */
import {validateBlueprint,copy,fail} from './extreme-state.js';
import {canonical} from './extreme-access.js';
export async function migrateLegacy(db,storage){
 if(db.get('schemaVersion')===2)return;
 const old=await storage.get('case');if(!old)return;
 if(!old.blueprint||!old.brief){db.tx(()=>{db.save({...old,generation:1,lastSeq:0,schemaVersion:2,revision:old.revision||0});db.set('schemaVersion',2);});return;}
 validateBlueprint(old.blueprint,old.pattern,[old.judge.name,old.prosecutor.name]);
 const entries=[...(old.publicHistory||[]),...(old.testimony||[])];for(const id of old.testimonyIds||[]){const t=await storage.get('testimony:'+id);if(!t)fail('INCOMPLETE_LEGACY_RECORD','A saved testimony row is missing; migration was not committed.',503);entries.push(t);}
 const dedup=new Map(entries.map(e=>[e.operationId,e]));const s={...copy(old),schemaVersion:2,generation:1,lastSeq:0,foundations:{},migrationWarning:'Some older non-sworn events may have been trimmed by the previous version. Surviving originals were preserved; no testimony was invented.'};
 const ops=await storage.list({prefix:'op:'});
 db.tx(()=>{
  for(const h of [...dedup.values()].sort((a,b)=>a.turn-b.turn)){
   const actor=canonical(h.actorId),pub=h.sworn===true,visibility=pub?'PUBLIC_COURT':'DEFENSE_PRIVATE',audience=pub?[]:['DEFENSE',actor];
   for(const [speaker,kind,text] of [['DEFENSE','question',h.message],[actor,'speech',h.speech]])if(typeof text==='string'&&text.trim())db.append({schemaVersion:1,id:crypto.randomUUID(),seq:++s.lastSeq,turn:h.turn,operationId:h.operationId,actorId:speaker,recipientId:actor,kind,text,language:s.language,visibility,audienceActorIds:audience,sworn:kind==='speech'&&pub,exhibitRefs:[],sourceEventIds:[],payload:{legacy:true},generation:1,createdAt:s.lastActive});
  }
  db.save(s);db.set('schemaVersion',2);db.set('migrationStatus',{completed:true,warning:s.migrationWarning});
  for(const [key,op] of ops)db.op(key.slice(3),op.signature,'legacy',old.revision,null,op.response);
 });
 const check=db.state();if(check.ap!==old.ap||check.stage!==old.stage||check.blueprintHash!==old.blueprintHash)fail('MIGRATION_FAILED','Legacy state verification failed.',503);
 // Keep legacy keys quarantined until migration is verified; then remove the live duplicate.
 await storage.delete(['case',...Array.from(ops.keys())]);for(const id of old.testimonyIds||[])await storage.delete('testimony:'+id);
}
