/* Counter + reset log UI, shared across overview, shelf and game.
 * One atomic localStorage write archives a log AND clears the meter.
 * Logs never contain prompts, case truth, evidence text or API keys.
 * Output includes separately reported thinking once; cached input is a subset.
 */
(() => {
  'use strict';
  const key='ryc_dev_tokens_v1'; // Reuse the original counter; import its totals.
  const copy=x=>JSON.parse(JSON.stringify(x));
  const number=x=>Number.isFinite(x)&&x>=0?x:0;
  function fresh(logs=[]) {
    return {schema:2,version:RYCTokenCore.version,startedAt:new Date().toISOString(),
      totals:{input:0,output:0,thinking:0,cached:0,repeated:0,requests:0,unknown:0},seen:{},
      entries:[],completed:[],logs};
  }
  function createStore(storage,getCase=()=>null) {
    function read() {
      const raw=storage.getItem(key);
      if(!raw)return fresh();
      const saved=JSON.parse(raw);
      if(!saved || !saved.totals || !saved.seen)throw new Error('The saved meter is unreadable; reset was cancelled to preserve it.');
      return {...fresh(),...saved,logs:saved.logs||[],entries:saved.entries||[],completed:saved.completed||[],
        legacyTotals:saved.legacyTotals || saved.schema!==2,startedAt:saved.startedAt||null};
    }
    const write=value=>{storage.setItem(key,JSON.stringify(value));return value;};
    const caseInfo=()=>{
      const value=getCase();
      return value?.hasActiveCase?{caseId:value.caseId||null,caseTitle:value.profile?.title||null,currentCaseTurn:value.turn??null}:null;
    };
    function record(usage,channel) {
      const current=read();
      const next=RYCStandard.usageTotals(current,usage,channel);
      next.schema=2;
      if(!current.totals.requests)next.startedAt=new Date().toISOString();
      next.entries.push({id:globalThis.crypto?.randomUUID?.()||'request_'+Date.now()+'_'+Math.random().toString(36).slice(2),
        at:new Date().toISOString(),version:RYCTokenCore.version,channel,case:channel==='scout'?null:caseInfo(),...copy(next.last),
        // Store only whitelisted provider metadata; no bodies or credentials.
        attempts:(usage?.attempts||[]).map(a=>Object.fromEntries(['model','input','output','thinking','cached','total','status'].map(k=>[k,a[k]??null])))});
      return write(next);
    }
    function completed(channel,state,operationId) {
      const current=read();
      if(current.completed.some(x=>x.operationId===operationId))return current;
      current.completed.push({operationId,channel,caseId:state.caseId||null,caseTitle:state.profile?.title||null,
        turn:state.turn,at:new Date().toISOString()});
      return write(current);
    }
    function reset() {
      const current=read(), t=current.totals, requests=number(t.requests), info=caseInfo();
      const id=globalThis.crypto?.randomUUID?.()||'log_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const cases=[...new Map(current.completed.filter(x=>x.caseId).map(x=>[x.caseId,{id:x.caseId,title:x.caseTitle}])).values()];
      const log={id,createdAt:new Date().toISOString(),startedAt:current.startedAt,
        version:current.version,versions:[...new Set(current.entries.map(e=>e.version))],legacyTotals:current.legacyTotals===true,
        caseId:info?.caseId||cases.at(-1)?.id||null,caseTitle:info?.caseTitle||cases.at(-1)?.title||null,cases,turns:info?.currentCaseTurn??null,
        completedTurns:current.completed.filter(x=>['court','diaz'].includes(x.channel)).length,
        completedActions:current.completed.length,totals:copy(t),
        averages:{inputPerRequest:requests?number(t.input)/requests:0,outputPerRequest:requests?number(t.output)/requests:0},
        attempts:current.entries.reduce((sum,e)=>sum+e.attempts.length,0),
        // Preserve the per-request/per-attempt breakdown for later comparisons.
        requests:copy(current.entries),actions:copy(current.completed)};
      // Do not clear the counter unless the whole log is successfully saved.
      write(fresh([...current.logs,log]));
      return log;
    }
    return {read,record,completed,reset};
  }
  globalThis.RYCTokenRuntime={createStore,key,fresh};
  if(typeof document==='undefined')return;
  let getCase=()=>{try{return JSON.parse(localStorage.getItem('rest_your_case_state')||'null');}catch{return null;}};
  const store=createStore(localStorage,()=>getCase());
  let queue=Promise.resolve(),lastError='';
  function run(action) {
    const task=()=>typeof navigator!=='undefined'&&navigator.locks
      ? navigator.locks.request('ryc-token-meter',action):action();
    const result=queue.then(task);
    queue=result.catch(error=>{lastError=error.message;}).then(()=>render());
    return result;
  }
  const safe=promise=>promise.catch(()=>{});
  globalThis.RYCTokens={
    configure(fn){getCase=fn;},
    record(usage,channel){return safe(run(()=>store.record(usage,channel)));},
    completed(channel,state,operationId){const snapshot=copy(state);return safe(run(()=>store.completed(channel,snapshot,operationId)));},
    flush(){return queue;},
    reset(){return run(()=>store.reset());}
  };
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const row=(container,label,value)=>container.append(el('p',label+': '+value));
  const formatted=value=>number(value).toLocaleString(undefined,{maximumFractionDigits:2});
  function render() {
    const body=document.getElementById('token-counts');if(!body)return;
    body.replaceChildren();
    try {
      const value=store.read(),t=value.totals,l=value.last;
      row(body,'Trial',RYCTokenCore.version);
      row(body,'Overall input',formatted(t.input));row(body,'Overall output (incl. thinking)',formatted(t.output));
      row(body,'Average input / request',formatted(t.requests?t.input/t.requests:0));
      row(body,'Average output / request',formatted(t.requests?t.output/t.requests:0));
      row(body,'Requests',t.requests);row(body,'Completed actions since reset',value.completed.length);
      row(body,'Last request input / output',`${l?.input||0} / ${l?.output||0}`);
      row(body,'Provider cached input · overall / last',`${t.cached||0} / ${l?.cached||0}`);
      row(body,'Exact repeated input · overall / last',`${t.repeated||0} / ${l?.repeated||0}`);
      row(body,'Thinking · overall / last',`${t.thinking||0} / ${l?.thinking||0}`);
      row(body,'Last route',l?l.channel+' · '+l.models.join(' → '):'None');
      row(body,'Unreported usage fields',t.unknown||0);row(body,'Saved reset logs',value.logs.length);
      if(t.unknown)body.append(el('p','Totals contain only reported usage. Averages include all requests and are incomplete when usage is unreported.'));
    }catch(error){lastError=error.message;}
    if(lastError)body.append(el('p','Meter storage: '+lastError));
  }
  function mount() {
    const style=el('style');style.textContent=`
      .ryc-log-button{font:12px system-ui;border:1px solid #967a45;border-radius:5px;padding:5px 12px;background:#292b33;color:#f4dfac;cursor:pointer;align-self:flex-start}
      #ryc-log-dialog{width:min(660px,94vw);max-height:86dvh;overflow:auto;background:#171b23;color:#f1e7cf;border:1px solid #967a45;border-radius:9px;padding:20px;font:14px/1.6 system-ui}
      #ryc-log-dialog::backdrop{background:#000b}#ryc-log-dialog header{display:flex;align-items:center;justify-content:space-between;gap:15px}#ryc-log-dialog button{border:1px solid #967a45;border-radius:5px;padding:6px 12px;background:#292b33;color:#f4dfac;cursor:pointer}#ryc-log-dialog article{border-top:1px solid #665738;margin-top:18px;padding-top:14px;overflow-wrap:anywhere}#ryc-log-dialog p{margin:5px 0}#ryc-log-dialog summary{cursor:pointer}#ryc-log-dialog pre{white-space:pre-wrap;font:11px/1.5 monospace}`;
    document.head.append(style);
    const dialog=el('dialog');dialog.id='ryc-log-dialog';dialog.setAttribute('aria-labelledby','ryc-log-title');
    const header=el('header'),title=el('strong','Token logs');title.id='ryc-log-title';
    const close=el('button','Close ×');close.type='button';close.onclick=()=>dialog.close();
    header.append(title,close);dialog.append(header);const content=el('div');dialog.append(content);document.body.append(dialog);
    async function openLogs() {
      await queue;content.replaceChildren();
      try{
        const logs=store.read().logs;
        content.append(el('p','Reset saves a log before clearing the meter. Logs stay in this browser. Output includes thinking. A request includes all its fallback attempts.'));
        if(!logs.length)content.append(el('p','No logs yet. Press Reset meter to save the current totals.'));
        for(const log of [...logs].reverse()){
          const card=el('article');row(card,'ID',log.id);row(card,'Saved',new Date(log.createdAt).toLocaleString());
          row(card,'Trial',log.versions.join(', ')||log.version||'Earlier version');row(card,'Case',log.caseTitle||'No active case');
          row(card,'Current case turn',log.turns??'—');row(card,'Completed gameplay turns since reset',log.completedTurns);
          row(card,'Completed actions since reset',log.completedActions);row(card,'Requests',log.totals.requests);
          row(card,'Overall input / output',`${formatted(log.totals.input)} / ${formatted(log.totals.output)}`);
          row(card,'Average input / output per request',`${formatted(log.averages.inputPerRequest)} / ${formatted(log.averages.outputPerRequest)}`);
          row(card,'Unreported usage fields',log.totals.unknown||0);
          if(log.legacyTotals)card.append(el('p','Includes totals from the previous meter; older request details and completion counts were not recorded.'));
          const details=el('details'),summary=el('summary','Request details'),pre=el('pre',JSON.stringify(log,null,2));details.append(summary,pre);card.append(details);content.append(card);
        }
      }catch(error){content.append(el('p',error.message));}
      if(!dialog.open)dialog.showModal();
    }
    for(const button of document.querySelectorAll('[data-token-log]'))button.addEventListener('click',openLogs);
    const panel=document.getElementById('token-panel'),toggle=document.getElementById('token-toggle');
    toggle?.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)document.getElementById('token-close')?.focus();});
    document.getElementById('token-close')?.addEventListener('click',()=>{panel.hidden=true;toggle?.setAttribute('aria-expanded','false');toggle?.focus();});
    document.getElementById('token-reset')?.addEventListener('click',async()=>{
      if(!confirm('Save the current usage as a log, then reset the meter?'))return;
      try{lastError='';const log=await RYCTokens.reset();lastError='';render();const notice=el('p','Saved log '+log.id);document.getElementById('token-counts')?.append(notice);}
      catch(error){lastError=error.message;render();}
    });
    window.addEventListener('storage',event=>{if(event.key===key||event.key===null)render();});
    render();
  }
  document.addEventListener('DOMContentLoaded',mount);
})();
