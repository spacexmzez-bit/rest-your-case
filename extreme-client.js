/* File name: extreme-client.js — transport only; no Standard save or appState coupling. */
window.RYCExtreme=(()=>{
 const endpoint=()=>((window.RYC_WORKER_URL||'https://rest-your-case.spacexmzez.workers.dev/').replace(/\/$/,'')+'/extreme');
 function validateSnapshot(s){if(!s||s.schemaVersion!==2||!Number.isSafeInteger(s.revision)||!Number.isSafeInteger(s.generation)||!Number.isSafeInteger(s.ap)||!Array.isArray(s.witnesses)||s.witnesses.length!==6||!Array.isArray(s.docket)||!s.title||!['intake','preparation','trial','closing','ended'].includes(s.stage))throw new Error('Invalid Extreme server snapshot.');for(const key of ['truth','blueprint','pattern','defenseRoute','tokenHash'])if(key in s)throw new Error('Private server field in response.');return s;}
 async function call(rec,fields,config={}){
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+rec.capability};const key=localStorage.getItem('rest_your_case_custom_gemini_key');if(key)headers['X-Custom-Gemini-Key']=key;
  const {response,data}=await RYCRequest.fetchJSON(endpoint(),{method:'POST',headers,body:JSON.stringify({apiVersion:2,caseId:rec.caseId,language:RYCI18n.get(),...fields})},{timeoutMs:fields.op==='create'?90000:fields.op==='snapshot'||fields.op==='archive'||fields.op==='search'?20000:60000,...config});
  if(!response.ok)throw Object.assign(RYCRequest.error(data?.error||'HTTP_'+response.status,data?.details||'Extreme request failed.'),{status:response.status,retryable:data?.retryable});if(data?.caseId!==rec.caseId)throw new Error('Case response identity mismatch.');if(data.snapshot)validateSnapshot(data.snapshot);return data;
 }
 const mutation=(rec,op,fields={})=>({op,language:RYCI18n.get(),operationId:crypto.randomUUID(),expectedRevision:rec.snapshot.revision,expectedGeneration:rec.snapshot.generation,...fields});
 return {call,mutation,validateSnapshot};
})();
