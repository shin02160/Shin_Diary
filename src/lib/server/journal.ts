import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './config.ts';
export class Journal {
 db: DatabaseSync;
 constructor(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  this.db = new DatabaseSync(path, { timeout: 5000 });
  this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS locks (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS creates (key TEXT PRIMARY KEY, page_id TEXT); CREATE TABLE IF NOT EXISTS logins (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets INTEGER NOT NULL);`);
 }
 async locked<T>(key: string, action: () => Promise<T>): Promise<T> {
  const owner = randomUUID(); const now = Date.now();
  this.db.prepare('DELETE FROM locks WHERE key=? AND expires < ?').run(key, now);
  const lock = this.db.prepare('INSERT OR IGNORE INTO locks(key,owner,expires) VALUES(?,?,?)').run(key, owner, now + 15 * 60_000);
  if (lock.changes === 0) throw new AppError(409, '다른 저장 요청을 처리 중입니다. 잠시 후 다시 시도해 주세요.', 2);
  try { return await action(); } finally { this.db.prepare('DELETE FROM locks WHERE key=? AND owner=?').run(key, owner); }
 }
 creation(key: string): { page_id: string | null } | undefined { return this.db.prepare('SELECT page_id FROM creates WHERE key=?').get(key) as { page_id: string | null } | undefined; }
 reserve(key: string) { this.db.prepare('INSERT INTO creates(key,page_id) VALUES(?,NULL)').run(key); }
 known(key: string, pageId: string) { this.db.prepare('INSERT INTO creates(key,page_id) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET page_id=excluded.page_id').run(key,pageId); }
 rejected(key: string) { this.db.prepare('DELETE FROM creates WHERE key=? AND page_id IS NULL').run(key); }
 allowLogin(key: string) {
  const now = Date.now(); this.db.prepare('DELETE FROM logins WHERE resets < ?').run(now);
  const result = this.db.prepare(`INSERT INTO logins(key,attempts,resets) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts,resets`).get(key, now + 10 * 60_000) as { attempts: number; resets: number };
  if (result.attempts > 10) throw new AppError(429, '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.', Math.ceil((result.resets-now)/1000));
 }
 close() { this.db.close(); }
}
