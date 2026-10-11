/* File name: extreme-ai.js — measured input limits, explicit Smart/Clerk models, no hidden fallback. */
import {shape} from './extreme-contracts.js';
import {fail} from './extreme-state.js';
import {LIMITS,modelFor} from './extreme-config.js';
export async function modelJSON(apiKey,system,packet,schema,purpose='actor',env={}){
 if(!apiKey)fail('NO_API_KEY','Configure GEMINI_API_KEY or enter your Gemini key in Settings.',401);
 const model=modelFor(purpose,env);if(!/^[a-zA-Z0-9._-]+$/.test(model))fail('INVALID_MODEL','Invalid configured model.',503);
 let attemptUsage={},attemptError=null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000),started=Date.now();
 const base={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(packet)}]}]};
 const headers={'Content-Type':'application/json','x-goog-api-key':apiKey},url='https://generativelanguage.googleapis.com/v1beta/models/'+model;
 try{
  const counted=await fetch(url+':countTokens',{method:'POST',headers,signal:controller.signal,body:JSON.stringify({generateContentRequest:{model:'models/'+model,...base}})});
  if(!counted.ok)fail('TOKEN_COUNT_FAILED','Could not verify this model’s input budget. Check model access.',counted.status===429?429:502);
  const {totalTokens}=await counted.json();if(!Number.isSafeInteger(totalTokens)||totalTokens>LIMITS[purpose].input)fail('CONTEXT_TOO_LARGE','The required sources exceed this request budget. Narrow the question or use a source review.',409);
  const response=await fetch(url+':generateContent',{method:'POST',headers,signal:controller.signal,body:JSON.stringify({...base,generationConfig:{temperature:purpose==='clerk'?0:0.3,maxOutputTokens:LIMITS[purpose].output,responseMimeType:'application/json',responseSchema:schema}})});
  let data;try{data=await response.json();}catch{fail('AI_INVALID_RESPONSE','The model returned invalid JSON; no official action was committed.',502);}
  if(!response.ok)fail(response.status===429?'QUOTA_EXHAUSTED':'AI_HTTP_ERROR','Model returned HTTP '+response.status+'. Check API key and model access.',[401,403,429].includes(response.status)?response.status:502);
  attemptUsage=data.usageMetadata||{};const c=data.candidates?.[0];if(!c||c.finishReason!=='STOP')fail('AI_INCOMPLETE','The model did not finish; retry the same request.',502);
  const text=(c.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');let value;try{value=JSON.parse(text);}catch{fail('AI_INVALID_JSON','The model returned invalid structured data.',502);}
  shape(value,schema);
  return {value,usage:{...(data.usageMetadata||{}),countedInputTokens:totalTokens,purpose,model,latencyMs:Date.now()-started},model};
 }catch(e){attemptError=e.code||'MODEL_NETWORK_ERROR';if(controller.signal.aborted)fail('AI_TIMEOUT','Model timed out. Retry the same request; no uncommitted AP was spent.',504);throw e;}finally{clearTimeout(timer);try{env.onModelUsage?.({purpose,model,usageReported:Object.keys(attemptUsage).length>0,inputTokens:attemptUsage.promptTokenCount??null,outputTokens:attemptUsage.candidatesTokenCount??null,thinkingTokens:attemptUsage.thoughtsTokenCount??null,cachedTokens:attemptUsage.cachedContentTokenCount??null,latencyMs:Date.now()-started,formatValidated:!attemptError,errorCode:attemptError});}catch{/* Telemetry is auxiliary and never changes gameplay. */}}
}
export const smartJSON=(key,system,packet,schema,_output=1800,env={})=>modelJSON(key,system,packet,schema,'actor',env);
export const clerkJSON=(key,system,packet,schema,env={})=>modelJSON(key,system,packet,schema,'clerk',env);
