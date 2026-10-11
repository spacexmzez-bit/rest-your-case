/* File name: extreme-access.js — filter sources before building any model packet. */
export const canonical=x=>({client:'CLIENT',judge:'JUDGE',court:'JUDGE',da:'PROSECUTOR',prosecutor:'PROSECUTOR',partner:'PARTNER',diaz:'DIAZ',defense:'DEFENSE'})[x]||x;
export function visible(e,actor){if(e.reverted||e.visibility==='BACKEND_ONLY')return false;if(['PUBLIC_COURT','SYSTEM_PUBLIC'].includes(e.visibility))return true;if(actor==='DEFENSE')return true;if(e.visibility==='INTERVIEW')return e.audienceActorIds.includes(actor);return ['CLIENT','PARTNER','DIAZ'].includes(actor)&&e.audienceActorIds.includes(actor);}
export function audience(s,body,actor,sworn=false){
 if(sworn||['prepare','trial','close','prosecution','admit','suppress','safety'].includes(body.command)||body.command==='message'&&body.channel==='court'&&['JUDGE','PROSECUTOR'].includes(actor))return {visibility:'PUBLIC_COURT',audienceActorIds:[]};
 if(/^W\d/.test(actor)||actor==='CLIENT')return {visibility:'INTERVIEW',audienceActorIds:['DEFENSE',actor]};
 return {visibility:'DEFENSE_PRIVATE',audienceActorIds:['DEFENSE','CLIENT','PARTNER','DIAZ']};
}
export function registry(s){return [{id:'DEFENSE',name:'Defense counsel',role:'defense'},{id:'CLIENT',name:s.blueprint.client.name,role:'client'},{id:'JUDGE',name:s.judge.name,role:'judge'},{id:'PROSECUTOR',name:s.prosecutor.name,role:'prosecutor'},{id:'PARTNER',name:s.language==='ar'?'الشريك القانوني':'Senior Partner',role:'partner'},{id:'DIAZ',name:s.language==='ar'?'المحقق دياز':'Investigator Diaz',role:'investigator'},...s.blueprint.witnesses.map(w=>({id:w.id,name:w.name,role:'witness'}))];}
export function knowledge(s,actor){const b=s.blueprint,w=b.witnesses.find(x=>x.id===actor),ids=actor==='CLIENT'?b.client.knownFactIds:w?.knownFactIds||[];return b.truth.facts.filter(f=>ids.includes(f.id));}
