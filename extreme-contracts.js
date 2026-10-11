/* File name: extreme-contracts.js — strict runtime contracts; prices and roles are never client state. */
import {fail} from './extreme-state.js';
import {ACTORS} from './extreme-config.js';
export const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,90}$/.test(x);
export function exact(x,keys,label='payload'){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))fail('INVALID_SCHEMA','Unexpected fields in '+label);}
export function shape(value,schema,path='output'){
  if(value===null&&schema.nullable)return;
  const t=schema.type;
  if(t==='OBJECT'){try{exact(value,Object.keys(schema.properties),path);}catch(e){e.status=502;throw e;}for(const k of schema.required||[])if(!(k in value))fail('INVALID_SCHEMA','Missing '+path+'.'+k,502);for(const k in value)shape(value[k],schema.properties[k],path+'.'+k);}
  else if(t==='ARRAY'){if(!Array.isArray(value)||value.length>100)fail('INVALID_SCHEMA','Invalid array '+path,502);value.forEach((x,i)=>shape(x,schema.items,path+'.'+i));}
  else if(t==='STRING'){if(typeof value!=='string'||value.length>12000||value.includes('\0'))fail('INVALID_SCHEMA','Invalid text '+path,502);}
  else if(t==='INTEGER'){if(!Number.isSafeInteger(value))fail('INVALID_SCHEMA','Invalid number '+path,502);}
  else if(t==='BOOLEAN'&&typeof value!=='boolean')fail('INVALID_SCHEMA','Invalid boolean '+path,502);
  if(schema.enum&&!schema.enum.includes(value))fail('INVALID_SCHEMA','Invalid enum '+path,502);
}
const extras={create:['genre','difficulty','engineMode'],snapshot:[],archive:['afterSeq','limit'],search:['actorId','exhibitId','sourceId','query','afterSeq','limit'],action:['channel','recipientId','command','message','targetId'],operation:[],clerk:['actorId','scope','throughSeq'],verdict:[],continue:['jobId'],purgePreview:[],purge:['purgeNonce','confirmedTitle']};
export function validateRequest(b){
  if(!b||!Object.hasOwn(extras,b.op))fail('INVALID_OPERATION','Unknown Extreme operation.');
  exact(b,['apiVersion','op','caseId','language','operationId','expectedRevision','expectedGeneration',...extras[b.op]]);
  if(b.apiVersion!==2||!id(b.caseId)||!['en','ar'].includes(b.language))fail('INVALID_REQUEST','Invalid version, case ID or language.');
  if(['create','action','verdict','purge'].includes(b.op)&&!id(b.operationId))fail('INVALID_ACTION_ID','A stable operation ID is required.');
  if(['action','verdict','purge'].includes(b.op)&&(!Number.isSafeInteger(b.expectedRevision)||!Number.isSafeInteger(b.expectedGeneration)))fail('INVALID_REVISION','Revision and generation are required.');
  if(b.op==='action'){
    if(!['court','partner','diaz','interview'].includes(b.channel)||!ACTORS.includes(b.recipientId)||!['message','prepare','trial','close','investigate','subpoena','inspect','call','safety','admit','suppress','prosecution'].includes(b.command))fail('INVALID_ACTION','Unknown action or actor.');
    if(b.message!==undefined&&(typeof b.message!=='string'||b.message.length>2400||b.message.includes('\0')))fail('INVALID_MESSAGE','Use at most 2400 characters.');
    if(b.command==='message'&&!b.message?.trim())fail('INVALID_MESSAGE','Write a message.');
    const prefix={investigate:'A',subpoena:'A',inspect:'E',call:'W',safety:'W',admit:'E',suppress:'E'}[b.command];if(prefix&&!(new RegExp('^'+prefix+'0[1-9]$|^'+prefix+'1[0-2]$')).test(b.targetId||'')||!prefix&&b.targetId!==undefined)fail('INVALID_TARGET','Choose a valid target ID for this action.');
  }
  if(b.op==='search'&&(b.query!==undefined&&(typeof b.query!=='string'||b.query.length>300)||b.actorId&&!ACTORS.includes(b.actorId)||b.exhibitId&&!/^E(0[1-9]|1[0-2])$/.test(b.exhibitId)))fail('INVALID_SEARCH','Invalid search filter.');
  if(b.op==='operation'&&!id(b.operationId))fail('INVALID_ACTION_ID','Invalid operation ID.');
  if(b.op==='search'&&b.sourceId!==undefined&&!id(b.sourceId))fail('INVALID_SOURCE','Invalid source ID.');
  if(b.op==='clerk'&&(!ACTORS.includes(b.actorId)||b.scope!=='permitted'||!Number.isSafeInteger(b.throughSeq)||b.throughSeq<0))fail('INVALID_MEMORY_REQUEST','Invalid actor or source cutoff.');
  if(b.op==='continue'&&!id(b.jobId))fail('INVALID_JOB_ID','Invalid review job ID.');
  if(['archive','search'].includes(b.op)&&b.afterSeq!==undefined&&(!Number.isSafeInteger(b.afterSeq)||b.afterSeq<0))fail('INVALID_CURSOR','Invalid page cursor.');
}
export const str={type:'STRING'},array=items=>({type:'ARRAY',items}),object=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
