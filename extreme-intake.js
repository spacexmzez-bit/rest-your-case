/* File name: extreme-intake.js — generation is independent of both active trials. */
window.RYCExtremeIntake=(()=>{
 const tr=(en,ar)=>RYCI18n.get()==='ar'?ar:en;
 async function generate(difficulty,onProgress){
  const language=RYCI18n.get(),signature=JSON.stringify([difficulty,'bank',language]),name='search:'+signature;let saved=await RYCExtremeStore.get('meta',name);
  if(!saved){saved={name,value:{caseId:crypto.randomUUID(),capability:crypto.randomUUID()+crypto.randomUUID().replaceAll('-',''),operationId:crypto.randomUUID()}};await RYCExtremeStore.put('meta',saved);}
  const current=structuredClone(saved.value),fields={op:'create',language,operationId:current.operationId,genre:'bank',difficulty,engineMode:'smart'};
  let data=await RYCExtreme.call(current,fields,{onProgress});if(data.creationStatus==='blueprintReady')data=await RYCExtreme.call(current,fields,{onProgress});
  if(!data.snapshot)throw new Error('Case generation is incomplete. Retry the same search.');
  const rec={caseId:current.caseId,capability:current.capability,snapshot:data.snapshot,localRevision:1,lastSyncedSeq:0,lifecycle:'brief',createdAt:Date.now()};
  await RYCExtremeStore.tx(['cases','events','meta'],'readwrite',async(s,r)=>{const old=await r(s.cases.get(rec.caseId));if(!old)s.cases.put(rec);for(const e of data.events||[])s.events.put({...e,caseId:rec.caseId});const latest=await r(s.meta.get(name));if(latest?.value.caseId===current.caseId)s.meta.delete(name);});return rec;
 }
 function mount(container,after){
  const title=document.createElement('h2');title.textContent=tr('Generate an Extreme brief','أنشئ ملخص قضية قصوى');const note=document.createElement('p');note.textContent=tr('Foundation: two bank-robbery scenarios, Smart only, free. Generate briefs while either trial continues.','النسخة التأسيسية: مساران لقضايا السطو على البنوك، باستخدام Smart فقط، مجاناً. يمكنك إنشاء ملخصات أثناء اللعب.');
  const select=document.createElement('select');select.setAttribute('aria-label',tr('Difficulty','الصعوبة'));for(const [value,en,ar] of [['Sandbox','Sandbox · Unlimited AP','تجريبي · نقاط غير محدودة'],['Easy','Easy · 250% AP','سهل · 250% من النقاط'],['Normal','Medium · 175% AP','متوسط · 175% من النقاط'],['Hard','Hard · 100% AP','صعب · 100% من النقاط']])select.add(new Option(tr(en,ar),value));select.value='Normal';const button=document.createElement('button');button.textContent=tr('Generate brief','أنشئ ملخصاً');const status=document.createElement('p');status.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;select.disabled=true;try{status.textContent=tr('Generating. You may keep your current cases.','جارٍ الإنشاء. تبقى قضاياك الحالية محفوظة.');const rec=await generate(select.value,p=>{status.textContent=tr('Generating · ','جارٍ الإنشاء · ')+p.elapsed+tr(' seconds',' ثانية');});status.textContent=tr('Brief saved. Review it below.','حُفظ الملخص. راجعه أدناه.');await after?.(rec);}catch(e){status.textContent=tr('Search not completed. Retry keeps the same frozen case. ','لم يكتمل البحث. إعادة المحاولة تحافظ على القضية نفسها. ')+RYCRequest.format(e);}finally{button.disabled=false;select.disabled=false;}};
  container.append(title,note,select,button,status);
 }
 return {generate,mount};
})();
