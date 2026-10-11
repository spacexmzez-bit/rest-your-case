/* File name: extreme-retrieval.js — deterministic permission-filtered selection of original sources. */
import {visible,canonical,knowledge} from './extreme-access.js';
import {fail} from './extreme-state.js';
const slim=e=>({id:e.id,seq:e.seq,speakerId:e.actorId,text:e.text,visibility:e.visibility,sworn:e.sworn,exhibitRefs:e.exhibitRefs,sourceEventIds:e.sourceEventIds});
export function retrieve(db,s,actor,request){
 actor=canonical(actor);const text=request.message||'',ids=[...new Set(text.match(/E(?:0[1-9]|1[0-2])/g)||[])];if(request.targetId?.startsWith('E')&&!ids.includes(request.targetId))ids.push(request.targetId);
 const explicit=text.match(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi)||[],selected=new Map(),mandatory=new Set();
 const add=(e,m=false)=>{if(e&&visible(e,actor)){selected.set(e.id,e);if(m)mandatory.add(e.id);}};
 for(const eid of explicit){const e=db.event(eid);if(!e||!visible(e,actor))fail('SOURCE_UNAVAILABLE','The requested source is unavailable to this actor.');add(e,true);}
 // Indexed SQL lookup, then ACL filtering. Private records never enter a model packet.
 for(const eid of ids){if(s.foundations?.[eid])add(db.event(s.foundations[eid]),true);for(const r of db.rows("SELECT json FROM events WHERE reverted=0 AND (json_extract(json,'$.text') LIKE ? OR json_extract(json,'$.exhibitRefs') LIKE ?) ORDER BY seq",'%'+eid+'%','%'+eid+'%')){const e=JSON.parse(r.json);if(e.actorId===actor||e.kind==='ruling'||e.kind==='system')add(e,true);}}
 const recent=[];let cursor=s.lastSeq+1;
 while(recent.length<8&&cursor>1){const page=db.rows('SELECT json FROM events WHERE reverted=0 AND seq<? ORDER BY seq DESC LIMIT 50',cursor).map(r=>JSON.parse(r.json));if(!page.length)break;cursor=page[page.length-1].seq;for(const e of page)if(visible(e,actor)&&recent.length<8)recent.push(e);}
 recent.reverse().forEach(e=>add(e));
 const terms=text.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>=3).slice(0,6);
 for(const term of terms){for(const r of db.rows('SELECT json FROM events WHERE reverted=0 AND lower(json) LIKE ? ORDER BY seq DESC LIMIT 30','%'+term.replace(/[\\%_]/g,'')+'%')){const e=JSON.parse(r.json);if(visible(e,actor)&&selected.size<32)add(e);}}
 const row=db.rows('SELECT json FROM memories WHERE actor_id=? AND scope=?',actor,'permitted')[0];const memory=row?JSON.parse(row.json):null;
 const entries=memory?.generation===s.generation?memory.entries.filter(e=>ids.some(id=>e.exhibitIds.includes(id))||terms.some(t=>e.text.toLowerCase().includes(t))).slice(-18):[];
 for(const e of entries){for(const id of [...e.sourceEventIds,...e.correctsSourceIds])add(db.event(id));}
 // Keep both ends of explicit source corrections; never silently truncate mandatory context.
 for(const e of [...selected.values()])for(const id of e.sourceEventIds||[])add(db.event(id),mandatory.has(e.id));
 const originals=[...selected.values()].sort((a,b)=>a.seq-b.seq).map(slim);
 if(JSON.stringify(originals.filter(e=>mandatory.has(e.id))).length>28000)fail('CONTEXT_TOO_LARGE','Requested originals are too long for one action; ask about fewer sources.',409);
 while(JSON.stringify(originals).length>30000){const i=originals.findIndex(e=>!mandatory.has(e.id));if(i<0)break;originals.splice(i,1);}
 return {originals,memory:{version:memory?.version||0,throughSeq:memory?.throughSeq||0,entries},recent:recent.reverse().slice(0,8).reverse().map(slim),relevantIds:ids,allowedFactIds:knowledge(s,actor).map(f=>f.id)};
}
