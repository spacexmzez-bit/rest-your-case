/* Permission-filtered, bounded original-source retrieval; questions and answers travel together. */
import {visible,canonical,knowledge} from './extreme-access.js';
import {fail} from './extreme-state.js';
const slim=e=>({id:e.id,seq:e.seq,operationId:e.operationId,recipientId:e.recipientId,kind:e.kind,speakerId:e.actorId,text:e.text,visibility:e.visibility,sworn:e.sworn,exhibitRefs:e.exhibitRefs,sourceEventIds:e.sourceEventIds});
export function retrieve(db,s,actor,request){
 actor=canonical(actor);const text=request.message||'',ids=[...new Set(text.match(/\bE(?:0[1-9]|1[0-2])\b/gi)?.map(id=>id.toUpperCase())||[])];
 for(const id of request.requiredExhibitIds||[])if(!ids.includes(id))ids.push(id);
 if(request.targetId?.startsWith('E')&&!ids.includes(request.targetId))ids.push(request.targetId);
 const selected=new Map(),mandatory=new Set(),explicit=(text.match(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi)||[]).map(id=>id.toLowerCase());
 const add=(e,required=false)=>{if(!e||!visible(e,actor))return;selected.set(e.id,e);if(required)mandatory.add(e.id);};
 for(const eid of explicit){const e=db.event(eid);if(!e||!visible(e,actor))fail('SOURCE_UNAVAILABLE','The requested source is unavailable to this actor.');add(e,true);}
 // Filter in SQL before LIMIT: another actor's private records must not crowd out permitted sources.
 const acl=actor==='DEFENSE'?"visibility!='BACKEND_ONLY'":"(visibility IN ('PUBLIC_COURT','SYSTEM_PUBLIC') OR (visibility='INTERVIEW' OR visibility='DEFENSE_PRIVATE' AND ? IN ('CLIENT','PARTNER','DIAZ')) AND EXISTS (SELECT 1 FROM json_each(events.json,'$.audienceActorIds') WHERE value=?))";
 const params=actor==='DEFENSE'?[]:[actor,actor];
 const find=(where,args=[],order='DESC',limit=8)=>db.rows('SELECT json FROM events WHERE reverted=0 AND '+acl+' AND ('+where+') ORDER BY seq '+order+' LIMIT ?',...params,...args,limit).map(r=>JSON.parse(r.json));
 for(const eid of ids){
  if(s.foundations?.[eid])add(db.event(s.foundations[eid]),true);
  find("kind='ruling' AND json_extract(json,'$.exhibitRefs') LIKE ?",['%'+eid+'%'],'DESC',1).forEach(e=>add(e,true));
  const where="(actor_id=? OR kind='system') AND (json_extract(json,'$.text') LIKE ? OR json_extract(json,'$.exhibitRefs') LIKE ?)";
  // Early and recent accounts stay available; every repeated mention is not permanently mandatory.
  find(where,[actor,'%'+eid+'%','%'+eid+'%'],'ASC',2).forEach(e=>add(e));
  find(where,[actor,'%'+eid+'%','%'+eid+'%'],'DESC',4).forEach(e=>add(e));
 }
 const recent=find('1=1',[],'DESC',8).reverse();recent.forEach(e=>add(e));
 const terms=text.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>=3).slice(0,6);
 for(const term of terms)find("lower(json_extract(json,'$.text')) LIKE ?",['%'+term.replace(/[\\%_]/g,'')+'%'],'DESC',8).forEach(e=>{if(selected.size<32)add(e);});
 const row=db.rows('SELECT json FROM memories WHERE actor_id=? AND scope=?',actor,'permitted')[0],memory=row?JSON.parse(row.json):null;
 const entries=memory?.generation===s.generation?memory.entries.filter(e=>ids.some(id=>e.exhibitIds.includes(id))||terms.some(t=>e.text.toLowerCase().includes(t))).slice(-18):[];
 for(const e of entries)for(const id of [...e.sourceEventIds,...e.correctsSourceIds])add(db.event(id),e.kind==='correction');
 // Old saves may lack question links. Pair them by their original operation ID as well.
 const visited=new Set();while(true){const next=[...selected.values()].find(e=>!visited.has(e.id+':'+mandatory.has(e.id)));if(!next)break;visited.add(next.id+':'+mandatory.has(next.id));const required=mandatory.has(next.id);for(const id of next.sourceEventIds||[])add(db.event(id),required);if(['question','speech'].includes(next.kind))for(const row of db.rows("SELECT json FROM events WHERE operation_id=? AND reverted=0 AND kind IN ('question','speech')",next.operationId))add(JSON.parse(row.json),required);}
 const originals=[...selected.values()].sort((a,b)=>a.seq-b.seq).map(slim);
 if(JSON.stringify(originals.filter(e=>mandatory.has(e.id))).length>28000)fail('CONTEXT_TOO_LARGE','Requested originals are too long for one action; ask about fewer sources.',409);
 while(JSON.stringify(originals).length>30000){const e=originals.find(e=>!mandatory.has(e.id)&&!originals.some(x=>x.operationId===e.operationId&&mandatory.has(x.id)));if(!e)break;for(let i=originals.length-1;i>=0;i--)if(originals[i].operationId===e.operationId)originals.splice(i,1);}
 const retained=new Set(originals.map(e=>e.id)),recentIds=new Set(recent.filter(e=>retained.has(e.id)).map(e=>e.id));
 return {originals:originals.filter(e=>!recentIds.has(e.id)),memory:{version:memory?.version||0,throughSeq:memory?.throughSeq||0,entries:entries.filter(e=>[...e.sourceEventIds,...e.correctsSourceIds].every(id=>retained.has(id)))},recent:recent.filter(e=>retained.has(e.id)).map(slim),relevantIds:ids,allowedFactIds:knowledge(s,actor).map(f=>f.id)};
}
