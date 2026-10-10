/* File name: ryc-dialogue.js — dialogue extraction; generated text is never HTML. */
const RYCDialogue = (() => {
  const roles=new Set(['client','judge','prosecutor','da','witness','investigator','partner','court','defense','clerk','narrator']);
  const instruction='Return spoken content as <DIALOGUE><SPEAKER name="Full name" role="client|judge|prosecutor|witness|investigator|partner|court|defense|clerk|narrator">Spoken text</SPEAKER></DIALOGUE>. Use the actual speaker name, without a role suffix in name. Put HUD, roster, evidence lists, notes and STATE_CHECKPOINT outside DIALOGUE. Do not put metadata or sealed truth inside spoken text. Escape &, <, > and quotes as XML entities where needed. Preserve the existing single-actor rule; the parser can also read multiple speakers when the game rules permit them. Every court/assistant reply needs nonempty dialogue; Scout generation stays JSON only. On an actual final verdict set trialEnded:true in STATE_CHECKPOINT; closing arguments alone do not end the trial.';
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{
    const known={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(known[m.toLowerCase()])return known[m.toLowerCase()];
    const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):'�';
  });
  function clean(raw,cutAppendix=true) {
    const text=String(raw??'').replace(/<!--[\s\S]*?-->/g,'')
      .replace(/={3,}\s*SEALED CASE GROUND TRUTH\s*={3,}[\s\S]*?(?:={3,}|$)/gi,'')
      .replace(/<SEALED_TRUTH\b[^>]*>[\s\S]*?<\/SEALED_TRUTH>/gi,'')
      .replace(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,'')
      .replace(/^\s*`?\[(?:STATE|ROSTER|DOCKET):[^\n]*$/gmi,'');
    return (cutAppendix?text.replace(/^\s*(?:#{1,6}\s*)?(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|SEALED (?:TRUTH|RECORD)|GROUND TRUTH|APPENDIX|METADATA)\b[^\n]*[\s\S]*$/im,''):text).trim();
  }
  function fail(message) {const e=new Error(message);e.name='ResponseValidationError';e.code='DIALOGUE_FORMAT_ERROR';throw e;}
  function parse(raw,{strict=false,fallback='Court record'}={}) {
    raw=String(raw??'');
    const blocks=[...raw.matchAll(/<DIALOGUE\s*>([\s\S]*?)<\/DIALOGUE\s*>/gi)];
    const hinted=/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw);
    if(blocks.length!==1){if(strict||hinted)fail('Reply must contain one complete DIALOGUE block. No case update was applied.');return legacy(raw,fallback);}
    if(/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(raw.replace(blocks[0][0],'').replace(/<!--[\s\S]*?-->/g,'')))fail('Reply contains stray dialogue tags outside its complete block.');
    const body=blocks[0][1], speakers=[...body.matchAll(/<SPEAKER\s+([^>]+)>([\s\S]*?)<\/SPEAKER\s*>/gi)];
    if(!speakers.length||body.replace(/<SPEAKER\s+[^>]+>[\s\S]*?<\/SPEAKER\s*>/gi,'').trim())fail('Dialogue contains missing or malformed speaker tags.');
    return speakers.map(s=>{
      const attrs=[...s[1].matchAll(/(name|role)\s*=\s*("([^"]*)"|'([^']*)')/gi)];
      if(attrs.length!==2||new Set(attrs.map(a=>a[1].toLowerCase())).size!==2||s[1].replace(/(name|role)\s*=\s*("[^"]*"|'[^']*')/gi,'').trim())fail('Each speaker needs only a name and role.');
      const values=Object.fromEntries(attrs.map(a=>[a[1].toLowerCase(),decode(a[3]??a[4])]));
      const name=values.name.replace(/\s*\[[^\]]{1,50}\]\s*$/,'').trim(),role=values.role.toLowerCase().trim();
      if(!name||name.length>120||/[\r\n]/.test(name)||!roles.has(role))fail('Speaker name or role is invalid.');
      if(/<\/?(?:DIALOGUE|SPEAKER)\b/i.test(s[2]))fail('Nested dialogue tags are invalid.');
      const text=clean(decode(s[2]));
      if(!text)fail('Speaker dialogue is empty.');
      return {name,role:role==='da'?'prosecutor':role,text};
    });
  }
  function legacy(raw,fallback) {
    const text=clean(raw,false);if(!text)return [];
    const messages=[];let speaker={name:fallback,role:'court'},lines=[],metadata=false;
    const flush=()=>{const body=lines.join('\n').trim();if(body)messages.push({...speaker,text:body});lines=[];};
    for(const line of text.split('\n')) {
      const unmarked=line.replace(/\*\*/g,'').replace(/^#{1,3}\s+/,'').trim();
      if(/^(?:HUD|STATE CHECKPOINT|(?:INITIAL |PRELIMINARY )?CASE BRIEF|CASE SUMMARY|ROSTER|DOCKET|APPENDIX|METADATA|CASE TITLE|TITLE|CHARGE|SEALED (?:TRUTH|RECORD)|GROUND TRUTH)\b/i.test(unmarked)){metadata=true;continue;}
      const match=unmarked.match(/^\[?(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)\s+([^\]:]+)\]?\s*:?\s*(.*)$/i)
        || unmarked.match(/^([^:]{1,120}?)\s*\[(Client|Witness|Judge|Prosecutor|Investigator|Partner)\]\s*:\s*(.*)$/i);
      const plain=unmarked.match(/^([^:]{1,100}?)\s*:\s*(.+)$/);
      if(match){flush();metadata=false;const roleFirst=/^(Judge|Client|Witness|Prosecutor|ADA|Investigator|Senior Partner)$/i.test(match[1]);let role=(roleFirst?match[1]:match[2]).toLowerCase();role=role==='ada'?'prosecutor':role==='senior partner'?'partner':role;speaker={name:(roleFirst?match[2]:match[1]).trim().replace(/^\((.+)\)$/,'$1'),role};if(match[3])lines.push(match[3]);}
      else if(plain&&!metadata&&!/^(?:phase|turn|ap|strikes|exhibit|case|charge|difficulty|complexity|engine|mode|notes?)\b/i.test(plain[1])){flush();speaker={name:plain[1].replace(/\s*\(witness\)$/i,'').trim(),role:/\(witness\)/i.test(plain[1])?'witness':'court'};lines.push(plain[2]);}
      else if(!metadata&&!/^\s*(?:\|.*\||`{3}|[-=]{3,}|\s*(?:phase|turn|ap|strikes|undos|resources|status|facts|exhibits|engine|complexity|difficulty|mode)\s*:)/i.test(line))lines.push(line);
    }
    flush();return messages;
  }
  const ended=state=>state?.trialEnded===true||/^(?:trial ended|completed|case closed|concluded)$/i.test(state?.phase||'');
  return {parse,clean,instruction,ended};
})();
if(typeof window!=='undefined')window.RYCDialogue=RYCDialogue;
