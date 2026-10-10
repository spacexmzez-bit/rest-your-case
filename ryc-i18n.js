/* File name: ryc-i18n.js — Arabic/English UI; US case rules and saved IDs stay unchanged. */
const RYCI18n = (() => {
  const key='ryc_language';
  let language='ar';
  try {const value=localStorage.getItem(key);if(value==='en'||value==='ar')language=value;} catch (_) {}
  const get=()=>language;
  const locale=()=>language==='ar'?'ar-SA-u-ca-gregory':'en-US';
  document.documentElement.lang=language;
  document.documentElement.dir=language==='ar'?'rtl':'ltr';
  const norm=value=>String(value??'').replace(/\s+/g,' ').trim();
  const dictionary=window.RYC_AR || {};
  function t(value) {
    const source=String(value??'');
    if(language!=='ar')return source;
    const normalized=norm(source);
    if(Object.prototype.hasOwnProperty.call(dictionary,normalized))return source.replace(/\S[\s\S]*\S|\S/,dictionary[normalized]);
    const rules=[
      [/^(Easy|Normal|Hard) \((\d+) AP\)$/,(_,d,n)=>`${t(d)} (${n} نقطة)`],
      [/^(?:Lvl|Level) (\d+)$/,(_,n)=>`المستوى ${n}`],
      [/^Case (\d+) of (\d+)$/,(_,n,total)=>`القضية ${n} من ${total}`],
      [/^File (\d+) of (\d+)$/,(_,n,total)=>`الملف ${n} من ${total}`],
      [/^Notes for (.+)$/,(_,id)=>`ملاحظات ${id}`],
      [/^· (\d+) AP$/,(_,n)=>` · ${n} نقطة`],
      [/^(\d+) entries across (\d+) topics$/,(_,n,total)=>`${n} مدخل في ${total} مواضيع`],
      [/^(\d+) of (\d+) entries shown$/,(_,n,total)=>`عرض ${n} من ${total} مدخل`],
      [/^(\d+) of (\d+) files shown$/,(_,n,total)=>`عرض ${n} من ${total} ملف`],
      [/^(\d+) saved cases? · Select a folder to review$/,(_,n)=>`${n} قضية محفوظة · اختر ملفاً لمراجعته`],
      [/^(Waiting for a reply…|Taking longer than usual…) (\d+)s \/ (\d+)s$/,(_,s,n,total)=>`${s.startsWith('Waiting')?'انتظار الرد…':'استغرق الرد وقتاً أطول…'} ${n} ث / ${total} ث`],
      [/^(.+) AP · (\d+)\/(\d+) judicial strikes · Turn (\d+)$/,(_,n,s,max,turn)=>`${t(n)} نقطة · المخالفات ${s}/${max} · الجولة ${turn}`],
      [/^(\d+) AP(?: - (.*))?$/,(_,n,rest)=>`${n} نقطة${rest?' — '+t(rest):''}`],
      [/^Chapter (\d+): (.+)$/,(_,n,title)=>`القسم ${n}: ${t(title)}`],
      [/^(.+) \(witness\)$/i,(_,name)=>`${name} (شاهد)`],
      [/^Phase (\d+(?:\.\d+)?):\s*(.*)$/i,(_,n,title)=>`المرحلة ${n}: ${t(title)}`],
      [/^Turn (\d+)$/,(_,n)=>`الجولة ${n}`],
      [/^Defendant is formally charged with (.+)\.$/,(_,charge)=>`وُجّهت للمتهم تهمة ${t(charge)}.`],
      [/^(?:Could not save settings|Could not access saved cases|Could not complete the action|The case could not be purged):\s*([\s\S]*)$/,(_,detail)=>`تعذر إكمال الإجراء: ${t(detail)}`],
      [/^(?:Cannot read the case collection|Could not purge the case):\s*([\s\S]*)$/,(_,detail)=>`تعذر فتح الملفات أو إكمال الإجراء: ${t(detail)}`],
      [/^(?:Server returned HTTP |Worker HTTP )(\d+)\.?$/,(_,code)=>`خطأ في الخادم [HTTP ${code}]`],
      [/^The saved intake is missing (.+)\.$/,(_,field)=>`ملف القضية المحفوظ يفتقد بيانات مطلوبة [${field}].`],
      [/^Invalid (case|checkpoint|exhibit) ([\s\S]+)$/,(_,kind,field)=>`بيانات القضية أو التحديث غير صالحة [${field}].`],
      [/^\[([A-Z_0-9]+)\]\s*([\s\S]*)$/,(_,code,detail)=>`[${code}] ${t(detail)}`],
      [/^No complete response within (\d+) seconds\. Retry when ready\.$/,(_,n)=>`لم يكتمل الرد خلال ${n} ثانية. أعد المحاولة عندما تكون مستعداً.`],
      [/^Could not reach the server\.\s*(.*)$/,(_,detail)=>`تعذر الاتصال بالخادم. ${detail}`],
      [/^(Filed cases|Pending intake) could not be read from this browser\.$/,(_,group)=>`تعذرت قراءة ${t(group)} من هذا المتصفح.`],
      [/^Review (.+), client (.+), (.+)$/,(_,title,client,charge)=>`مراجعة ${title}، الموكل ${client}، ${t(charge)}`],
      [/^Retry(?: action)?$/,()=> 'إعادة المحاولة'],
      [/^Inspect (.+)$/,(_,id)=>`فحص ${id}`],
      [/^(.+) · (Physical|Digital|Documentary|Forensic)$/,(_,id,type)=>`${id} · ${t(type)}`]
    ];
    for(const [pattern,render] of rules)if(pattern.test(normalized))return normalized.replace(pattern,render);
    // Translate known sentence fragments in composite notices; raw debug detail stays readable.
    let result=source;
    for(const [en,ar] of Object.entries(dictionary))if(en.length>18 && result.includes(en))result=result.split(en).join(ar);
    return result;
  }
  const instruction=()=>language==='ar'
    ? 'LANGUAGE: Arabic (AR). Write all player-visible case titles, summaries, exhibit descriptions and spoken dialogue in clear Modern Standard Arabic. Explain legal concepts simply; give the Arabic legal term followed by its English term in square brackets on first mention. US law ONLY: do not substitute Saudi, Islamic or other legal systems. Preserve exact supplied names, IDs, statutes and established facts. JSON/XML keys, role codes, English slash commands, phase and evidence-status values, and numeric checkpoints stay in their existing machine-readable format. Changing language does not restart the case or change rules.'
    : 'LANGUAGE: English (EN). Use US law only. Preserve established names, IDs, statutes, facts and machine-readable state values. Changing language does not restart the case.';
  function prepareLibrary() {
    if(language!=='ar'||!window.RYC_LIBRARY_AR)return;
    for(const [id,item] of Object.entries(window.RYC_LIBRARY_AR)) {
      const entry=document.getElementById(id);if(!entry||entry.dataset.arReady)return;
      const heading=entry.querySelector('h3'),reference=entry.querySelector('.library-reference');
      if(!heading)continue;
      const oldTitle=heading.textContent, headingId=heading.id;
      const ref=reference?.cloneNode(true);
      const title=document.createElement('h3');title.id=headingId;
      title.append(document.createTextNode(item.title+' '));
      const en=document.createElement('bdi');en.lang='en';en.dir='ltr';en.textContent='['+oldTitle+']';en.className='legal-term-en';title.append(en);
      const paragraph=document.createElement('p');paragraph.textContent=item.description;
      const application=document.createElement('p');application.className='library-application';
      const label=document.createElement('strong');label.textContent='كيف تستخدمه؟';application.append(label,document.createTextNode(item.application));
      const example=document.createElement('div');example.className='library-example';
      const exampleLabel=document.createElement('h4');exampleLabel.textContent='مثال عملي';
      const exampleText=document.createElement('p');exampleText.textContent=item.example;example.append(exampleLabel,exampleText);
      entry.replaceChildren(...(ref?[ref]:[]),title,paragraph,application,example);entry.dataset.arReady='true';
    }
  }
  function localize(root=document.body) {
    if(language!=='ar'||!root)return;
    const excluded='script,style,code,pre,textarea,[data-no-i18n],.message-text,.document-record,.library-entry[data-ar-ready]';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes) {
      const el=node.parentElement;if(!el||el.closest(excluded)||!node.nodeValue.trim())continue;
      if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.textContent);
      const translated=t(node.nodeValue);if(translated!==node.nodeValue)node.nodeValue=translated;
    }
    for(const el of root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
      if(el.closest('[data-no-i18n]'))continue;
      for(const attribute of ['placeholder','title','aria-label','alt']) {
        const value=el.getAttribute(attribute);if(value){const next=t(value);if(next!==value)el.setAttribute(attribute,next);}
      }
    }
    document.title=t(document.title);
  }
  function set(value) {
    if(!['ar','en'].includes(value)||value===language)return;
    if((typeof engineLocked!=='undefined'&&engineLocked)||(typeof activeSearchAbortController!=='undefined'&&activeSearchAbortController)) {
      window.alert(t('Wait for the current action to finish before changing language.'));
      const select=document.getElementById('ryc-language');if(select)select.value=language;return;
    }
    try {
      const drafts={};for(const id of ['court-user-input','assistant-input','witness-name']){const el=document.getElementById(id);if(el?.value)drafts[id]=el.value;}
      sessionStorage.setItem('ryc_language_drafts',JSON.stringify(drafts));
      localStorage.setItem(key,value);
    } catch (_) {window.alert(t('Could not save language preference. Your current page remains open.'));return;}
    location.reload();
  }
  function mount() {
    prepareLibrary();
    const nav=document.querySelector('header .top-links, header nav, .archive-header nav, header .header-actions');
    const holder=document.createElement('label');holder.className='language-control';holder.setAttribute('data-no-i18n','');
    const select=document.createElement('select');select.id='ryc-language';select.setAttribute('aria-label',language==='ar'?'لغة العرض':'Display language');
    select.add(new Option('العربية','ar'));select.add(new Option('English','en'));select.value=language;select.addEventListener('change',()=>set(select.value));holder.append(select);
    if(nav)nav.prepend(holder);else {holder.classList.add('language-floating');document.body.append(holder);}
    try {const drafts=JSON.parse(sessionStorage.getItem('ryc_language_drafts')||'{}');for(const [id,value]of Object.entries(drafts)){const el=document.getElementById(id);if(el&&typeof value==='string')el.value=value;}sessionStorage.removeItem('ryc_language_drafts');}catch(_){}
    localize();
    let scheduled=false;
    const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observer.disconnect();localize();observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});});});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});
    const alert=window.alert.bind(window),confirm=window.confirm.bind(window);
    window.alert=message=>alert(t(message));window.confirm=message=>confirm(t(message));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  return {get,set,locale,t,instruction,localize,prepareLibrary};
})();
window.RYCI18n=RYCI18n;
