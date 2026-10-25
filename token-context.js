/* Deterministic character briefs. Original saves and transcripts are never trimmed.
 * Retrieval has no hard token cutoff: ambiguous/global questions widen the brief.
 * Court is the referee route and retains its fixed private reference separately;
 * public material is NOT permission for an NPC to adopt another person's knowledge.
 */
(() => {
  'use strict';
  const terms = text => [...new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])]
    .filter(x=>!new Set(['the','and','that','this','with','what','from','you','can','did','was','why','how','about','please','could','would','have','for','are','not','but','all','على','هذا','هذه','ماذا','كيف','الذي','التي','الى','إلى','منذ']).has(x));
  const spoken=text=>String(text).replace(/<[^>]+>/g,' ');
  function entries(history,channel) {
    return (history||[]).map((entry,i)=>{
      const raw=(entry.parts||[]).map(p=>typeof p==='string'?p:p.text||'').join('\n');
      // Never send the original intake's hidden fields through conversational retrieval.
      if(/^\s*\/start\b/i.test(raw))return null;
      const block=raw.match(/<DIALOGUE\s*>[\s\S]*?<\/DIALOGUE\s*>/i)?.[0];
      const text=entry.role==='model' ? block || RYCStandard.dialogueText(raw)
        .replace(/^\s*`?\[(?:STATE|ROSTER|DOCKET):[^\n]*$/gmi,'').trim() : raw;
      return text?{id:RYCTokenCore.sourceId(channel,i,entry),channel,role:entry.role,text}:null;
    }).filter(Boolean);
  }
  function prepare(state,histories,channel,message) {
    const own=entries(histories[channel],channel);
    const publicCourt=channel==='court'?[]:entries(histories.court,'court');
    const pool=[...publicCourt,...own];
    const recent=own.slice(-12);
    const recentIds=new Set(recent.map(e=>e.id));
    // The preceding exchange resolves 'that', 'it', and follow-up topic references.
    const literalTerms=terms(message);
    const followup=/\b(?:that|it|he|she|they|those|this|him|her)\b|ذلك|هذا|قصد|تقصد/i.test(message);
    const directMatch=pool.some(e=>literalTerms.some(x=>spoken(e.text).toLowerCase().includes(x)));
    const priorReply=own.filter(e=>e.role==='model').at(-1);
    const query=directMatch?literalTerms:terms(message+' '+(followup?spoken(priorReply?.text||''):''));
    const people=[state.profile?.client,state.profile?.judge,state.profile?.da,
      ...(state.characters||[]).map(p=>p.name),...(state.activeCaseSeed?.seed?.roster?.witnesses||[]).map(p=>p.name)].filter(Boolean);
    const entities=[...(state.docket||[]).map(e=>e.id||e.tag),...people].filter(value=>
      (message+' '+(followup?spoken(priorReply?.text||''):'')).toLowerCase().includes(value.toLowerCase()));
    const isGlobal=/\/(?:undo|recap)\b|verdict|closing|whole case|entire case|all (?:evidence|statements|contradictions)|case strategy|الحكم|مرافع|القضية كاملة|كل الأدلة|كل التناقض/i.test(message);
    const relevant=pool.filter(e=>entities.some(x=>e.text.toLowerCase().includes(x.toLowerCase())) || query.some(x=>spoken(e.text).toLowerCase().includes(x)) || message.includes(e.id));
    // Preserve every correction/commitment/open issue, with its neighboring exchange.
    const pinned=new Set();
    for(let i=0;i<pool.length;i++)if(/correct|actually|instead|promis|agreed|mistake|disput|contradict|not true|unresolved|pending|will (?:check|find|ask)|تصحيح|وعد|خطأ|تناقض|لم نتأكد|سأبحث|سأتحقق/i.test(pool[i].text)) {
      for(const e of pool.slice(Math.max(0,i-1),i+2))if(e.channel===pool[i].channel)pinned.add(e.id);
    }
    const widen=isGlobal || (!directMatch && !(followup&&priorReply) && own.length>recent.length);
    const selected=new Set((widen?pool:relevant).map(e=>e.id));
    for(const e of publicCourt.slice(-4))selected.add(e.id);
    for(const id of pinned)selected.add(id);
    const originals=pool.filter(e=>selected.has(e.id)&&!recentIds.has(e.id));
    // Evidence revisions remain exact source-linked records; never revive deleted items.
    const revisions=[];
    for(const event of state.clerkMemory?.liveRecord?.events||[])for(const change of event.changes||[]) {
      if(!change.path.startsWith('docket:') || !change.before)continue;
      const combined=JSON.stringify(change);
      if(isGlobal || query.some(t=>combined.toLowerCase().includes(t)) || entities.some(id=>combined.includes(id)))
        revisions.push({sourceId:event.id,turn:event.turn,...change,authority:'historical record; current docket controls; manual edits are unverified'});
    }
    const seed=state.activeCaseSeed?.seed;
    const addressed=channel==='court' ? message.match(/^To\s+([^:\n]+):/i)?.[1]?.trim() : null;
    const actor=addressed?{name:addressed,knowledge:'Only this person’s established perspective, disclosures to them, and procedurally available material. Referee access is not character access.'}:null;
    const brief={schema:1,version:RYCTokenCore.version,recipient:channel,
      actor,
      boundary:channel==='court'
        ? 'Referee route. No Partner/Diaz private chat. Attribute every statement to its speaker. NPC knowledge remains role/perspective limited; the public defense record is not universal NPC knowledge.'
        : 'Defense consultation. Own conversation and shared court record only. Other private consultation chats and sealed intake are excluded. Claims are not proof.',
      retrieval:widen?'expanded-originals':'recent-and-linked-originals',
      originals,revisions,
      caseDefinition:seed?{charge:seed.charge,venue:seed.narrative_seeds?.venue}:null,
      availableSources:pool.length,includedSources:originals.length+recent.length};
    return {history:recent.map(e=>({role:e.role,parts:[{text:'[Original source '+e.id+']\n'+e.text}]})),brief};
  }
  globalThis.RYCTokenContext={prepare,entries};
})();
