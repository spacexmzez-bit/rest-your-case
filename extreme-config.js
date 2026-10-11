/* File name: extreme-config.js — Foundation limits and explicit model configuration. */
export const RETENTION=90*86400000;
export const ACTORS=['DEFENSE','CLIENT','JUDGE','PROSECUTOR','PARTNER','DIAZ',...Array.from({length:6},(_,i)=>'W0'+(i+1))];
export const LIMITS={actor:{input:10000,output:1200},clerk:{input:6000,output:1000},generation:{input:12000,output:10000},brief:{input:8000,output:6000},review:{input:12000,output:2000},verdict:{input:12000,output:3000}};
export const modelFor=(purpose,env={})=>purpose==='clerk'?(env.CLERK_MODEL||'gemini-3.5-flash-lite'):(env.SMART_MODEL||'gemini-3.8-flash');
