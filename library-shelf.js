window.RYCLibrary = (() => {
  const chapters = [
    ['essentials','Start here'],['objections','Courtroom objections'],
    ['charges','Charges & proof'],['rights','Police & evidence'],
    ['witnesses','Witness credibility'],['traps','Prosecution tactics'],
    ['investigation','Investigation & AP'],['evidence','Reading exhibits'],
    ['verdicts','Closing & courtroom guide']
  ];
  const reader=document.getElementById('library-reader');
  const shelf=document.getElementById('library-shelf');
  const topic=document.getElementById('library-topic');
  const search=document.getElementById('library-search');
  const list=document.getElementById('shelf-chapters');
  let opener;
  function show(){if(!reader.open){opener=document.activeElement;reader.showModal();}}
  function filters(value='all',query=''){topic.value=value;search.value=query;search.dispatchEvent(new Event('input'));topic.dispatchEvent(new Event('change'));}
  function navigate(hash){history.pushState({rycLibrary:true},'',hash);}
  function openChapter(id, updateHistory=true){show();filters(id);if(updateHistory)navigate('#topic-'+id);document.getElementById('library-main').scrollTop=0;reader.scrollTop=0;}
  function openTarget(target){show();filters('all');requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
  function openAll(query='',updateHistory=true){show();filters('all',query);if(updateHistory)navigate('#collection');reader.scrollTop=0;}
  function sync(){const hash=location.hash.slice(1);if(hash==='collection'||hash==='library-main'){openAll('',false);return;}const chapter=chapters.find(([id])=>hash==='topic-'+id);if(chapter){openChapter(chapter[0],false);return;}const el=document.getElementById(hash);if(el?.closest('#library-collection')){openTarget(el);return;}if(reader.open){reader.close();}}
  function close(){reader.close();history.replaceState(null,'',location.pathname+location.search);opener?.focus();}
  chapters.forEach(([id,title],index)=>{
    const b=document.createElement('button');b.type='button';b.className='chapter-button';b.style.setProperty('--row',Math.floor(index/2));b.style.setProperty('--col',index%2);b.setAttribute('aria-label',`Chapter ${index+1}: ${title}`);
    const label=document.createElement('span');label.textContent=title;b.append(label);b.addEventListener('click',()=>openChapter(id));list.append(b);
  });
  document.getElementById('reader-close').addEventListener('click',close);
  reader.addEventListener('cancel',e=>{e.preventDefault();close();});
  reader.addEventListener('close',()=>{if(reader.open)return;if(opener?.isConnected!==false)opener?.focus();});
  document.getElementById('library-browse-all').addEventListener('click',()=>openAll());
  document.getElementById('shelf-search-form').addEventListener('submit',e=>{e.preventDefault();openAll(document.getElementById('shelf-search').value);});
  document.querySelector('.library-skip')?.addEventListener('click',e=>{e.preventDefault();openAll();});
  document.getElementById('bookshelf-background').addEventListener('error',()=>shelf.classList.add('art-unavailable'));
  document.getElementById('bookshelf-background').addEventListener('load',()=>shelf.classList.remove('art-unavailable'));
  window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);
  if(reader.open)reader.close();document.body.classList.add('library-enhanced');shelf.hidden=false;sync();
  return {openTarget,openChapter,openAll};
})();
