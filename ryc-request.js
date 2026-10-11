/* File name: ryc-request.js — neutral bounded request and safe errors. */
const RYCRequest = (()=>{
  const error=(code,message)=>Object.assign(new Error(message),{code,name:code==='CANCELLED'?'AbortError':code==='INVALID_RESPONSE'?'ResponseValidationError':'RequestError'});
  function format(e) {
    const code=e?.code || (e?.name==='ResponseValidationError'?'INVALID_RESPONSE':e?.name==='AbortError'?'CANCELLED':e instanceof TypeError?'NETWORK_ERROR':/storage|quota|save/i.test(e?.message||'')?'STORAGE_ERROR':/checkpoint|reply|response/i.test(e?.message||'')?'INVALID_RESPONSE':'ACTION_ERROR');
    return `[${code}] ${e?.message||String(e)}`;
  }
  async function fetchJSON(url,options={},config={}) {
    const timeoutMs=config.timeoutMs??60000,signal=config.signal||options.signal,controller=new AbortController();
    if(signal?.aborted)throw error('CANCELLED','Search cancelled.');
    let timeout,interval,onAbort,closed=false;
    const start=Date.now();
    const update=()=>{try{config.onProgress?.({elapsed:Math.floor((Date.now()-start)/1000),slow:Date.now()-start>=(config.warnAfterMs??15000)});}catch(_) {}};
    const stopped=new Promise((_,reject)=>{
      timeout=setTimeout(()=>{closed=true;controller.abort();reject(error('TIMEOUT',`No complete response within ${timeoutMs/1000} seconds. Retry when ready.`));},timeoutMs);
      onAbort=()=>{closed=true;controller.abort();reject(error('CANCELLED','Search cancelled.'));};
      signal?.addEventListener('abort',onAbort,{once:true});
    });
    update();interval=setInterval(update,1000);
    const request=(async()=>{
      let response;try{response=await fetch(url,{...options,signal:controller.signal});}catch(e){if(closed)throw e;throw error('NETWORK_ERROR','Could not reach the server. '+(e.message||String(e)));}
      if(closed)throw error('CANCELLED','Request already ended.');
      let data;try{data=await response.json();}catch(e){if(closed)throw e;if(response.ok)throw error('INVALID_RESPONSE','The server returned invalid JSON.');}
      if(closed)throw error('CANCELLED','Request already ended.');
      return {response,data};
    })();
    try{return await Promise.race([stopped,request]);}
    finally {closed=true;clearTimeout(timeout);clearInterval(interval);signal?.removeEventListener('abort',onAbort);config.onController?.(null);}
  }
  return {fetchJSON,format,error};
})();
