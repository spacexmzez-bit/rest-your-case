/* File name: extreme-db.js — synchronous SQLite transactions and paged immutable sources. */
export const DDL=`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,operation_id TEXT NOT NULL,kind TEXT NOT NULL,actor_id TEXT,recipient_id TEXT,visibility TEXT NOT NULL,sworn INTEGER NOT NULL DEFAULT 0,reverted INTEGER NOT NULL DEFAULT 0,json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_actor ON events(actor_id,seq);
CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,status TEXT NOT NULL,base_revision INTEGER NOT NULL,response_json TEXT,input_json TEXT,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memories(actor_id TEXT NOT NULL,scope TEXT NOT NULL,version INTEGER NOT NULL,through_seq INTEGER NOT NULL,generation INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(actor_id,scope));
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,generation INTEGER NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_usage(id TEXT PRIMARY KEY,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,created_revision INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL);`;
export class CaseDB{
 constructor(storage){this.storage=storage;this.sql=storage.sql;this.sql.exec(DDL);}
 rows(q,...p){return Array.from(this.sql.exec(q,...p));}
 get(k){const r=this.rows('SELECT json FROM meta WHERE key=?',k)[0];return r?JSON.parse(r.json):null;}
 set(k,v){this.sql.exec('INSERT OR REPLACE INTO meta(key,json) VALUES(?,?)',k,JSON.stringify(v));}
 tx(fn){return this.storage.transactionSync(fn);}
 state(){const s=this.get('caseState');if(!s)return null;return {...s,blueprint:this.get('blueprint'),publicHistory:[],testimony:[]};}
 save(s){const {blueprint,publicHistory,testimony,testimonyIds,...state}=s;this.set('caseState',state);if(blueprint&&!this.get('blueprint'))this.set('blueprint',blueprint);}
 append(e){this.sql.exec('INSERT INTO events(seq,event_id,operation_id,kind,actor_id,recipient_id,visibility,sworn,reverted,json) VALUES(?,?,?,?,?,?,?,?,0,?)',e.seq,e.id,e.operationId,e.kind,e.actorId,e.recipientId,e.visibility,e.sworn?1:0,JSON.stringify(e));}
 page(after=0,limit=50){return this.rows('SELECT json FROM events WHERE seq>? AND reverted=0 ORDER BY seq LIMIT ?',after,limit).map(r=>JSON.parse(r.json));}
 event(id){const r=this.rows('SELECT json FROM events WHERE event_id=? AND reverted=0',id)[0];return r?JSON.parse(r.json):null;}
 recent(n=8){return this.rows('SELECT json FROM events WHERE reverted=0 ORDER BY seq DESC LIMIT ?',n).reverse().map(r=>JSON.parse(r.json));}
 operation(id){const r=this.rows('SELECT * FROM operations WHERE id=?',id)[0];return r?{...r,response:r.response_json?JSON.parse(r.response_json):null,input:r.input_json?JSON.parse(r.input_json):null}:null;}
 op(id,hash,status,revision,input,response=null){this.sql.exec('INSERT OR REPLACE INTO operations VALUES(?,?,?,?,?,?,?)',id,hash,status,revision,response?JSON.stringify(response):null,input?JSON.stringify(input):null,Date.now());}
 job(j){this.sql.exec('INSERT OR REPLACE INTO jobs VALUES(?,?,?,?,?)',j.id,j.kind,j.status,j.generation,JSON.stringify(j));}
 getJob(id){const r=this.rows('SELECT json FROM jobs WHERE id=?',id)[0];return r?JSON.parse(r.json):null;}
 clear(){for(const table of ['events','operations','memories','jobs','proposals','model_usage','meta'])this.sql.exec('DELETE FROM '+table);}
}
