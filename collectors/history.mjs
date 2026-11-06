import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function openHistory(path){
 mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT NOT NULL,status TEXT NOT NULL,details_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS observations(run_id TEXT NOT NULL,store TEXT NOT NULL,product_id TEXT NOT NULL,observed_at TEXT NOT NULL,price_cents INTEGER NOT NULL CHECK(price_cents>0),payload_json TEXT NOT NULL,PRIMARY KEY(run_id,store,product_id));
 CREATE INDEX IF NOT EXISTS observations_product_time ON observations(store,product_id,observed_at);`);
 return db;
}
export function saveRun(db,run,observations){
 db.exec('BEGIN IMMEDIATE');try{
  db.prepare('INSERT INTO runs VALUES(?,?,?,?,?)').run(run.id,run.startedAt,run.finishedAt,run.status,JSON.stringify(run));
  const insert=db.prepare('INSERT INTO observations VALUES(?,?,?,?,?,?)');
  for(const o of observations)insert.run(run.id,o.store,o.storeProductId,o.observedAt,o.priceCents,JSON.stringify(o));
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function latestObservations(db){
 return db.prepare(`SELECT payload_json FROM (SELECT payload_json,ROW_NUMBER() OVER(PARTITION BY store,product_id ORDER BY observed_at DESC,rowid DESC) AS rank FROM observations) WHERE rank=1`).all().map(r=>JSON.parse(r.payload_json));
}
