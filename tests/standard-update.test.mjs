import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const sources=Object.fromEntries(await Promise.all(['standard-support.js','data.js','game-state.js','scout_prompt.js','worker.js','game.js','game-scene.js'].map(async n=>[n,await read(n)])));
function runtime(){const ctx=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,AbortController,setTimeout,clearTimeout});for(const n of ['standard-support.js','data.js','game-state.js','scout_prompt.js'])vm.runInContext(sources[n],ctx,{filename:n});return ctx;}
const plain=x=>JSON.parse(JSON.stringify(x));
const exhibit=(id='E01',details='Dispatch log shows a 21:05 call.')=>({id,name:'Dispatch log',type:'Documentary',status:'Marked',details});
function state(ctx){return {...plain(ctx.RYCState.emptyState()),hasActiveCase:true,intakeComplete:true,profile:{title:'State v. Alex',client:'Alex',judge:'Judge Arthur Pendelton',da:'ADA Samantha Ward',clientOccupation:'civilian'},ap:10,docket:[exhibit()],facts:['The incident occurred at 21:00.'],exhibitNotes:{},characters:[],offers:[],disclosures:[],investigations:[],clerkMemory:{}};}
function reply(update,spoken='I have reviewed the record.',role='judge',name='Judge Arthur Pendelton'){return `<DIALOGUE><SPEAKER name="${name}" role="${role}">${spoken}</SPEAKER></DIALOGUE>${update?'<!--STATE_CHECKPOINT: '+JSON.stringify(update)+'-->':''}`;}
function discovery(id='op-1'){return {ap:9,docket:[exhibit('E02','Certified video log shows a gap at 21:00.')],facts:['The certified log contains a gap.'],investigation:{id,status:'completed',cost:1,summary:'The certified video log is in E02.',insight:'The gap merits a custodian interview; it does not prove tampering.'}};}
const diazReply=u=>reply(u,u.investigation.summary+' '+u.investigation.insight,'investigator','Investigator Diaz');
function workerRuntime(fetch){const ctx=runtime();ctx.fetch=fetch;const code=sources['worker.js'].replace(/^import .*;\s*$/gm,'').replace('export default {','globalThis.worker = {').replace('export class ExtremeCase','globalThis.ExtremeCase = class ExtremeCase');vm.runInContext(code,ctx,{filename:'worker.js'});return ctx;}
async function dispatch(ctx,body){const response=await ctx.worker.fetch(new Request('https://worker.example/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Review this action',history:[],language:'en',...body})}),{GEMINI_API_KEY:'test-key-not-real'});return {status:response.status,data:await response.json()};}
function provider(text,status=200){return new Response(JSON.stringify(status===200?{candidates:[{finishReason:'STOP',content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5,cachedContentTokenCount:40,totalTokenCount:125}}:{error:{message:'fixture failure'}}),{status});}

test('violent cases sample unique named victims and gendered witnesses from the roster',()=>{
 const ctx=runtime();let violent=0;
 for(let i=0;i<350;i++){const seed=vm.runInContext(`sampleCaseDocket(${i%5+1})`,ctx);const people=[seed.roster.client,seed.roster.judge,seed.roster.da,...seed.roster.witnesses];if(seed.roster.victim){violent++;people.push(seed.roster.victim);assert.match(seed.charge.charge,/murder|manslaughter|assault|battery|homicide|robbery|kidnap|sexual|rape|death|false imprisonment|arson|carjacking|domestic violence/i);}assert.equal(new Set(people.map(p=>p.name)).size,people.length);people.forEach(p=>assert.ok(['F','M'].includes(p.gender)));}
 assert.ok(violent>0);
});
test('Scout rejects missing victim names and retains the existing four-field output structure',()=>{
 const ctx=runtime();const seed={roster:{client:{name:'Alex',occupation:'civilian'},victim:{name:'Sam Johnson'}}};const valid={caseTitle:'State v. Alex',crimeSummary:'Alex allegedly assaulted Sam Johnson.',starterExhibits:[exhibit(),exhibit('E02')],unencryptedTruth:'Sam Johnson saw the encounter.'};ctx.fixture=valid;ctx.seed=seed;
 assert.equal(vm.runInContext('parseScoutResponse(JSON.stringify(fixture),seed).crimeSummary',ctx),valid.crimeSummary);
 valid.crimeSummary='An unnamed person was injured.';assert.throws(()=>vm.runInContext('parseScoutResponse(JSON.stringify(fixture),seed)',ctx),/victim/);
});
test('court and Diaz incrementally merge evidence and facts, retaining prior suppression',()=>{
 const ctx=runtime(),s=state(ctx);s.docket[0].status='SUPPRESSED';s.docket.push({...exhibit('M01'),isManual:true,facts:'My note'});
 let result=ctx.RYCState.next(s,reply({ap:10,docket:[exhibit('E02')],facts:['Additional public fact']}),'court').state;
 assert.equal(result.docket.length,3);assert.equal(result.facts.length,2);
 result=ctx.RYCState.next(result,diazReply(discovery()),'diaz',{contractVersion:2}).state;
 assert.equal(result.docket.find(e=>e.id==='E01').status,'SUPPRESSED');assert.equal(result.docket.length,3);assert.equal(result.ap,9);assert.equal(result.investigations.length,1);assert.equal(s.ap,10);assert.equal(s.docket.length,2);
 assert.throws(()=>ctx.RYCState.next(s,reply({docket:[exhibit('M01','Engine overwrite')]}),'court'),/manual/);
});
test('Diaz cannot charge for an unsaved finding or omit the spoken result / separate insight',()=>{
 const ctx=runtime(),s=state(ctx),u=discovery();
 assert.throws(()=>ctx.RYCState.next(s,reply(u,'Done.','investigator','Diaz'),'diaz',{contractVersion:2}),/speak/);
 const missing=plain(u);missing.docket=[];missing.facts=[];assert.throws(()=>ctx.RYCState.next(s,diazReply(missing),'diaz',{contractVersion:2}),/save/);
 const wrong=plain(u);wrong.ap=8;assert.throws(()=>ctx.RYCState.next(s,diazReply(wrong),'diaz',{contractVersion:2}),/AP/);
 const advice={ap:10,docket:[],facts:[],investigation:{id:'advice',status:'advice',cost:0,summary:'I can review the log.',insight:'Ask which custodian kept it.'}};
 assert.equal(ctx.RYCState.next(s,diazReply(advice),'diaz',{contractVersion:2}).state.ap,10);
 const saved=ctx.RYCState.next(s,diazReply(u),'diaz',{contractVersion:2}).state;saved.ap=10;assert.throws(()=>ctx.RYCState.next(saved,diazReply(u),'diaz',{contractVersion:2}),/already committed/);
});
test('public snapshot and clerk retrieval exclude the sealed intake and other private channel',()=>{
 const ctx=runtime(),s=state(ctx);s.activeCaseSeed={seed:{roster:{}},scout:{unencryptedTruth:'SECRET',crimeSummary:'Public allegation'}};
 assert.ok(!JSON.stringify(ctx.RYCStandard.publicCase(s)).includes('SECRET'));
 const entry=(text,role='user')=>({role,parts:[{text}]});const histories={court:[entry('/start\nHidden flaw: SECRET'),entry(reply(null,'Public statement'))],diaz:Array.from({length:22},(_,i)=>entry(i===2?'Blue delivery van seen at 9.':i===3?'Correction: van was green.':'Discussion '+i,i%2?'model':'user')),partner:[entry('PRIVATE PARTNER')]};
 const packet=plain(ctx.RYCStandard.memoryPacket(s,histories,'diaz','What did we learn about the delivery van?'));
 assert.equal(packet.history.length,8);assert.ok(packet.originals.some(e=>e.text.includes('green')));assert.ok(packet.originals.some(e=>e.text.includes('Blue delivery')));assert.ok(!JSON.stringify(packet).includes('SECRET'));assert.ok(!JSON.stringify(packet).includes('PRIVATE PARTNER'));assert.equal(packet.history.at(-1).parts[0].text,'Discussion 21');
});
test('gender labels use metadata, leave unknown legacy names unchanged and exempt Diaz / Partner',()=>{
 const ctx=runtime(),s=state(ctx);s.characters=[{name:'Alex',gender:'F'}];assert.equal(ctx.RYCStandard.nameLabel(s,'Alex'),'Alex [F]');assert.equal(ctx.RYCStandard.nameLabel(s,'Unregistered Alex'),'Unregistered Alex');assert.equal(ctx.RYCStandard.nameLabel(s,'Investigator Diaz'),'Investigator Diaz');
 const updated=ctx.RYCState.next(s,reply({characters:[{name:'Sam',gender:'M'}]}),'court').state;assert.equal(ctx.RYCStandard.nameLabel(updated,'Sam'),'Sam [M]');assert.throws(()=>ctx.RYCState.next(s,reply({characters:[{name:'Alex',gender:'M'}]}),'court'),/gender cannot change/);
});
function offer(){return {id:'O1',type:'lesser_charge',title:'Reduced charge proposal',terms:'Plea to the stated lesser charge, subject to judicial approval.',basis:'Known public record only.',reducedCharge:'Simple assault',sourceExhibitIds:['E01'],expiresTurn:10};}
test('offers require player choice, preserve terms, expire, and distinguish a negotiated outcome',()=>{
 const ctx=runtime(),s=state(ctx);const proposed=ctx.RYCState.next(s,reply({offers:[offer()]},'These are the proposed terms.','prosecutor','ADA Samantha Ward'),'court',{requestText:'/offer request'}).state;
 assert.equal(proposed.offers[0].status,'proposed');assert.ok(!proposed.trialEnded);
 assert.throws(()=>ctx.RYCState.next(proposed,reply({offerDecision:{offerId:'O1',decision:'accepted'},trialEnded:true}),'court',{requestText:'Tell me more'}),/explicit/);
 const rejected=ctx.RYCState.next(proposed,reply({offerDecision:{offerId:'O1',decision:'rejected'}}),'court',{requestText:'/offer reject O1'}).state;assert.equal(rejected.offers[0].status,'rejected');assert.ok(!rejected.trialEnded);
 const accepted=ctx.RYCState.next(proposed,reply({offerDecision:{offerId:'O1',decision:'accepted'},trialEnded:true}),'court',{requestText:'/offer accept O1'}).state;assert.equal(accepted.caseOutcome.type,'negotiated_resolution');assert.equal(accepted.offers[0].terms,offer().terms);
 const expired=plain(proposed);expired.turn=10;assert.throws(()=>ctx.RYCState.next(expired,reply({offerDecision:{offerId:'O1',decision:'accepted'},trialEnded:true}),'court',{requestText:'/offer accept O1'}),/active offer/);
 assert.throws(()=>ctx.RYCState.next(s,reply({offers:[{...offer(),sourceExhibitIds:['FAKE']}]}),'court',{requestText:'/offer request'}),/references/);
 assert.throws(()=>ctx.RYCState.next(s,reply({trialEnded:true}),'court',{requestText:'/offer request'}),/cannot end/);
});
test('disclosure commits its record and new exhibit together; unknown references fail atomically',()=>{
 const ctx=runtime(),s=state(ctx);const u={docket:[exhibit('E03')],disclosures:[{id:'D1',text:'Disclosed certified record.',exhibitIds:['E03']}]};const next=ctx.RYCState.next(s,reply(u),'court').state;assert.equal(next.docket.length,2);assert.equal(next.disclosures[0].exhibitIds[0],'E03');
 u.disclosures[0].exhibitIds=['FAKE'];assert.throws(()=>ctx.RYCState.next(s,reply(u),'court'),/known exhibit/);assert.equal(s.docket.length,1);
});
test('normalization round-trips new records and preserves legacy occupation, AP and notes',()=>{
 const ctx=runtime(),s=state(ctx);s.notes='Defense notes';s.investigations=[discovery().investigation];s.offers=[{...offer(),status:'proposed'}];s.clerkMemory={diaz:{indexedThrough:9}};const next=ctx.RYCState.normalize(s,ctx.RYCState.emptyState());assert.equal(next.ap,10);assert.equal(next.notes,s.notes);assert.equal(next.profile.clientOccupation,'civilian');assert.equal(next.investigations.length,1);assert.equal(next.offers.length,1);assert.equal(next.clerkMemory.diaz.indexedThrough,9);
});
test('token meter adds cascade attempts, thinking, cache and exact full-input repeats separately',()=>{
 const ctx=runtime();const usage={inputHash:'abc',attempts:[{model:'a',input:100,output:20,thinking:5,cached:40},{model:'b',input:120,output:30,thinking:0,cached:0}]};let m=ctx.RYCStandard.usageTotals(null,usage,'court');assert.equal(m.totals.input,220);assert.equal(m.totals.output,55);assert.equal(m.totals.repeated,0);m=ctx.RYCStandard.usageTotals(m,usage,'court');assert.equal(m.last.repeated,220);assert.equal(m.totals.cached,80);m=ctx.RYCStandard.usageTotals(m,null,'scout');assert.ok(m.totals.unknown>0);assert.equal(m.totals.input,440);
});
test('Smart uses all four original models; Light and Scout use the two Lite models',async()=>{
 for(const [mode,persona,expected]of [['smart','court',['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash']],['light','court',['gemini-3.5-flash-lite','gemini-3.1-flash-lite']],['smart','scout',['gemini-3.5-flash-lite','gemini-3.1-flash-lite']]]){
 const calls=[];const scout=JSON.stringify({caseTitle:'Test case',crimeSummary:'Public allegation',unencryptedTruth:'Hidden chronology',starterExhibits:[exhibit(),exhibit('E02')]});const ctx=workerRuntime(async(url,options)=>{calls.push(url.match(/models\/(.*):/)[1]);const body=JSON.parse(options.body);assert.ok(body.systemInstruction.parts[0].text);assert.ok(!('thinkingConfig'in body.generationConfig));return calls.length<expected.length?provider('',429):provider(persona==='scout'?scout:reply({ap:10}));});const r=await dispatch(ctx,{engineMode:mode,targetPersona:persona});assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual(calls,expected);assert.equal(r.data.usage.attempts.length,expected.length);assert.match(r.data.usage.inputHash,/^[a-f0-9]{64}$/);
 }
});
test('Worker validates Diaz operation, recovers malformed responses and keeps paid attempt usage',async()=>{
 let calls=0;const u=discovery();const ctx=workerRuntime(async()=>{calls++;return provider(calls===1?reply(u,'Done.','investigator','Diaz'):diazReply(u));});const r=await dispatch(ctx,{engineMode:'smart',targetPersona:'diaz',contractVersion:2,operationId:'op-1',caseState:state(ctx)});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(calls,2);assert.equal(r.data.usage.attempts.length,2);
 const bad=workerRuntime(async()=>provider(diazReply(u)));const failed=await dispatch(bad,{targetPersona:'diaz',contractVersion:2,operationId:'different',caseState:state(bad)});assert.equal(failed.data.error,'STATE_CONTRACT_ERROR');assert.equal(failed.data.usage.attempts.length,4);
});
test('Worker enforces offer actor identities and difficulty-specific partner instructions',async()=>{
 const wrong=workerRuntime(async()=>provider(reply({offers:[offer()]},'Proposal','prosecutor','Another prosecutor')));const result=await dispatch(wrong,{targetPersona:'court',userText:'/offer request',contractVersion:2,caseState:state(wrong)});assert.equal(result.data.error,'STATE_CONTRACT_ERROR');
 for(const difficulty of ['Sandbox','Easy','Normal','Hard']){let system;const ctx=workerRuntime(async(_,options)=>{system=JSON.parse(options.body).systemInstruction.parts[0].text;return provider(reply(null,'Let us discuss the known facts.','partner','Senior partner'));});await dispatch(ctx,{targetPersona:'partner',caseState:{difficulty}});assert.ok(system.includes(ctx.RYCStandard.partnerGuidance(difficulty)));}
});
test('old Extreme Durable Object export remains deploy-compatible and inactive',async()=>{
 const ctx=workerRuntime(async()=>{throw Error('Must not call models');});assert.equal((await new ctx.ExtremeCase().fetch()).status,410);await new ctx.ExtremeCase().alarm();
});
test('manual evidence can be created, edited with notes retained, and deleted without affecting generated exhibits',async()=>{
 const ctx=runtime(),nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},classList:{add(){},remove(){}},focus(){},blur(){},contains(){return false},querySelectorAll(){return []},matches(){return false}});return nodes.get(id);}
 ctx.window=ctx;ctx.addEventListener=()=>{};ctx.document={activeElement:node('focus'),addEventListener(){},getElementById:node,querySelector:()=>node('heading'),querySelectorAll:()=>[]};ctx.RYCScene={refresh(){}};ctx.confirm=()=>true;ctx.alert=text=>{throw Error(text);};ctx.fixture=state(ctx);ctx.requestAnimationFrame=fn=>fn();
 vm.runInContext(sources['game.js'].split('\ninitApp();')[0],ctx,{filename:'game.js'});
 vm.runInContext('appState=fixture;commitCase=async fn=>{appState=fn(JSON.parse(JSON.stringify(appState)));};',ctx);
 node('modal-tag').value='M1';node('modal-title').value='My record';node('modal-type').value='Digital';node('modal-details').value='Player supplied details';assert.equal(await vm.runInContext('saveNewExhibit()',ctx),true);
 vm.runInContext("appState.exhibitNotes.M1='Keep this annotation';openAddExhibitModal(1)",ctx);node('modal-tag').value='M2';node('modal-title').value='Revised record';node('modal-details').value='Edited details';await vm.runInContext('saveNewExhibit()',ctx);
 assert.equal(vm.runInContext('appState.docket[1].facts',ctx),'Edited details');assert.equal(vm.runInContext('appState.exhibitNotes.M2',ctx),'Keep this annotation');assert.equal(vm.runInContext('appState.docket[1].status',ctx),'Marked');
 await vm.runInContext('deleteExhibit(0)',ctx);assert.equal(vm.runInContext('appState.docket.length',ctx),2);await vm.runInContext('deleteExhibit(1)',ctx);assert.equal(vm.runInContext('appState.docket.length',ctx),1);assert.equal(vm.runInContext('appState.exhibitNotes.M2',ctx),undefined);
});

test('updated pages load the shared contract before state or case scripts and keep unique IDs',async()=>{
 for(const page of ['game.html','index.html','shelf.html']){
  const html=await read(page);const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
  assert.ok(scripts.indexOf('standard-support.js')>=0);assert.ok(scripts.indexOf('standard-support.js')<scripts.indexOf('game-state.js'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,page+' has duplicate IDs');
  for(const file of scripts.filter(s=>!s.startsWith('http')))assert.ok((await read(file)).length>0);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:page+' inline script'});
 }
 const game=await read('game.html');const roomMenu=game.match(/<nav id="room-menu"[\s\S]*?<\/nav>/)[0];assert.ok(!/shelf\.html|openWipeModal/.test(roomMenu));
});

test('Offers and evidence documents render structured records and actionable controls',async()=>{
 const ctx=runtime(),nodes=new Map();
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.value='';this.textContent='';}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}addEventListener(name,fn){this.events[name]=fn;}setAttribute(){}contains(el){return el===this || this.children.some(c=>c.contains(el));}closest(){return null;}querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}matches(tag){return this.tagName===tag;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}focus(){ctx.document.activeElement=this;}blur(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const byId=id=>{if(!nodes.has(id))nodes.set(id,new Element('div'));return nodes.get(id);};
 ctx.window=ctx;ctx.addEventListener=()=>{};ctx.document={activeElement:new Element('button'),addEventListener(){},getElementById:byId,createElement:tag=>new Element(tag),querySelector:()=>byId('heading'),querySelectorAll:()=>[]};ctx.confirm=()=>true;ctx.alert=text=>{throw Error(text);};ctx.RYCScene={};ctx.fixture=state(ctx);
 vm.runInContext(sources['game.js'].split('\ninitApp();')[0],ctx);
 vm.runInContext('appState=fixture;commitCase=async fn=>{appState=fn(JSON.parse(JSON.stringify(appState)));};sendCourtAction=async prompt=>{globalThis.sentPrompt=prompt;return true;};',ctx);
 vm.runInContext(await read('ryc-dialogue.js'),ctx);vm.runInContext(sources['game-scene.js'].replace('renderCourtFeed,renderAssistantFeeds,openDocument,','renderCourtFeed,renderAssistantFeeds,refreshDocument,openDocument,'),ctx);
 byId('scene-document').append(byId('document-body'));
 vm.runInContext('appState.offers=[{...fixtureOffer,status:"proposed"}]',Object.assign(ctx,{fixtureOffer:offer()}));
 ctx.RYCScene.openDocument('offers');
 const walk=e=>[e,...e.children.flatMap(walk)];let elements=walk(byId('document-body'));
 assert.ok(elements.some(e=>e.textContent===offer().terms));assert.ok(elements.some(e=>e.textContent==='Request disclosure'));
 await elements.find(e=>e.textContent==='Ask judge to approve').events.click();assert.equal(ctx.sentPrompt,'/offer accept O1');
 vm.runInContext('appState.investigations=[{id:"negative-search",status:"completed",summary:"No responsive records found.",facts:["The custodian reported no records."],exhibitIds:[]}]',ctx);
 ctx.RYCScene.openDocument('evidence');elements=walk(byId('document-body'));assert.ok(elements.some(e=>e.textContent==='No responsive records found.'));
 const editing=elements.find(e=>e.tagName==='textarea');editing.value='Annotation still being typed';editing.setSelectionRange(4,9);editing.focus();
 vm.runInContext('appState.docket.push({id:"E04",name:"Newly delivered record",details:"A fresh finding",status:"Marked"})',ctx);
 ctx.RYCScene.refreshDocument();elements=walk(byId('document-body'));
 assert.ok(elements.some(e=>e.textContent.includes('E04')),'New evidence must appear while an annotation has focus');
 assert.equal(ctx.document.activeElement.value,'Annotation still being typed');assert.equal(ctx.document.activeElement.selectionStart,4);assert.equal(ctx.document.activeElement.selectionEnd,9);

 vm.runInContext('renderDocket()',ctx);assert.match(byId('docket-list').innerHTML,/No responsive records found/);
 // Restoring a notebook fact must still work after evidence rendering.
 vm.runInContext('renderUI=()=>{};appState.trashedFacts=["fact-id"]',ctx);await ctx.restoreFact('fact-id');assert.equal(vm.runInContext('appState.trashedFacts.length',ctx),0);
});

test('standalone dashboard Worker matches modular sources and handles a Standard request',async()=>{
 const bundle=await read('worker-cloudflare.txt');
 for(const name of ['standard-support.js','data.js','game-state.js','worker.js'])assert.ok(bundle.includes(name==='worker.js'?sources[name].replace(/^import .*;\s*$/gm,''):sources[name]),name+' differs from dashboard bundle');
 const ctx=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,AbortController,setTimeout,clearTimeout,fetch:async()=>provider(reply({ap:10}))});
 vm.runInContext(bundle.replace('export default {','globalThis.worker = {').replace('export class ExtremeCase','globalThis.ExtremeCase = class ExtremeCase'),ctx);
 const result=await dispatch(ctx,{contractVersion:2,targetPersona:'court',caseState:state(ctx)});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal((await new ctx.ExtremeCase().fetch()).status,410);
});

// Regression cases discovered during the follow-up code review.
test('review: updating an existing exhibit through facts/title replaces its stale aliases',()=>{
 const ctx=runtime(),s=state(ctx);s.docket[0].facts=s.docket[0].details;
 const next=ctx.RYCState.next(s,reply({docket:[{id:'E01',title:'Corrected dispatch log',facts:'The corrected call time is 21:15.'}]}),'court').state;
 assert.equal(next.docket[0].details,'The corrected call time is 21:15.');assert.equal(next.docket[0].facts,next.docket[0].details);assert.equal(next.docket[0].name,'Corrected dispatch log');
});
test('review: existing sparse legacy exhibits still accept status updates',()=>{
 const ctx=runtime(),s=state(ctx);s.docket=[{id:'E01',name:'Legacy exhibit',status:'Marked'}];
 const next=ctx.RYCState.next(s,reply({docket:[{id:'E01',status:'Admitted'}]}),'court').state;assert.equal(next.docket[0].status,'Admitted');
});
test('review: Worker and browser agree about valid undo refunds',async()=>{
 const ctx=workerRuntime(async()=>provider(reply({ap:10})));const s=state(ctx);s.ap=8;
 assert.equal(ctx.RYCState.next(s,reply({ap:10}),'court',{undo:true,requestText:'/undo'}).state.ap,10);
 const result=await dispatch(ctx,{message:'/undo',userText:'/undo',contractVersion:2,targetPersona:'court',caseState:s});assert.equal(result.status,200,JSON.stringify(result.data));
 s.difficulty='Hard';const denied=await dispatch(ctx,{message:'/undo',userText:'/undo',contractVersion:2,targetPersona:'court',caseState:s});assert.notEqual(denied.status,200);
});
test('review: an offer available at submission remains acceptable on the last valid turn',()=>{
 const ctx=runtime(),s=state(ctx);s.turn=9;s.offers=[{...offer(),status:'proposed'}];
 const next=ctx.RYCState.next(s,reply({trialEnded:true,offerDecision:{offerId:'O1',decision:'accepted'}}),'court',{requestText:'/offer accept O1'}).state;assert.equal(next.offers[0].status,'accepted');
 const unrelated=ctx.RYCState.next(s,reply(null),'court').state;assert.equal(unrelated.offers[0].status,'expired');
});
test('review: proposing an offer cannot close the case through a phase-only checkpoint',()=>{
 const ctx=runtime(),s=state(ctx);assert.throws(()=>ctx.RYCState.next(s,reply({phase:'Case closed',offers:[offer()]}),'court',{requestText:'/offer request'}),/cannot end/);
});
test('review: legacy sealed appendices never enter Partner clerk context',()=>{
 const ctx=runtime(),s=state(ctx);const legacy='Judge: Public procedural ruling.\n===== SEALED CASE GROUND TRUTH =====\nSECRET CULPRIT\n=====\n';
 const packet=ctx.RYCStandard.memoryPacket(s,{court:[{role:'model',parts:[{text:legacy}]}],partner:[]},'partner','What did the judge say?');
 assert.ok(!JSON.stringify(packet).includes('SECRET CULPRIT'));assert.ok(JSON.stringify(packet).includes('Public procedural ruling'));
});
test('review: public court snapshots omit Diaz private strategic insight',()=>{
 const ctx=runtime(),s=state(ctx);s.investigations=[{...discovery().investigation,insight:'PRIVATE DEFENSE STRATEGY'}];
 const snapshot=ctx.RYCStandard.publicCase(s);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE DEFENSE STRATEGY'));assert.equal(snapshot.investigations[0].id,'op-1');
});
