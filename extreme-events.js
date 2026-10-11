/* File name: extreme-events.js — original dialogue and official consequences are distinct events. */
import {canonical,audience} from './extreme-access.js';
export function event(s,body,actor,kind,text,extra={}){return {schemaVersion:1,id:crypto.randomUUID(),seq:++s.lastSeq,turn:s.turn,operationId:body.operationId,actorId:canonical(actor),recipientId:canonical(body.recipientId)||null,kind,text,language:body.language,...audience(s,body,canonical(actor),extra.sworn),sworn:false,exhibitRefs:[],sourceEventIds:[],payload:{},generation:s.generation,createdAt:Date.now(),...extra};}
export function exchange(s,body,out){const actor=canonical(out.entry.actorId),scope=audience(s,body,actor,out.entry.sworn),question=event(s,body,'DEFENSE','question',body.command==='message'?body.message:'/'+body.command+(body.targetId?' '+body.targetId:'')+(body.message?' '+body.message:''),scope);return [question,event(s,body,actor,'speech',out.entry.speech,{...scope,sworn:out.entry.sworn,sourceEventIds:[question.id],exhibitRefs:out.exhibitRefs||[],payload:{assertions:out.assertions||[],foundationClaims:out.foundationClaims||[]}})];}
export function officialEvents(before,s,body,out,events){
 const answer=events[events.length-1];
 if(before.stage!==s.stage)events.push(event(s,body,'JUDGE','phase',s.stage,{visibility:'SYSTEM_PUBLIC',audienceActorIds:[],payload:{from:before.stage,to:s.stage}}));
 for(const e of s.discovered.filter(id=>!before.discovered.includes(id))){const d=s.localizedExhibits[e]||s.blueprint.evidence.find(x=>x.id===e);events.push(event(s,body,'DIAZ','discovery',d.details,{visibility:'DEFENSE_PRIVATE',audienceActorIds:['DEFENSE','CLIENT','PARTNER','DIAZ'],exhibitRefs:[e],payload:{exhibitId:e}}));events.push(event(s,body,'DIAZ','system',d.details,{visibility:'PUBLIC_COURT',audienceActorIds:[],exhibitRefs:[e],payload:{disclosure:true,exhibitId:e}}));}
 if(out.ruling){events.push(event(s,body,'JUDGE','ruling',out.ruling.reason,{visibility:'PUBLIC_COURT',audienceActorIds:[],exhibitRefs:out.ruling.exhibitId?[out.ruling.exhibitId]:[],sourceEventIds:[answer.id,...out.ruling.sourceEventIds],payload:{...out.ruling,motionId:body.operationId}}));}
 for(const claim of out.foundationClaims||[])if(claim.authenticates){s.foundations??={};s.foundations[claim.exhibitId]=answer.id;}
 return events;
}
