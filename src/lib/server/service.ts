import { createHash } from 'node:crypto';
import { getConfig } from './config.ts';
import { Journal } from './journal.ts';
import { NotionClient } from './notion-client.ts';
import { NotionRepository } from './notion-repository.ts';
const services = globalThis as typeof globalThis & { diaryNotion?: { key:string; journal:Journal; repository:NotionRepository; client:NotionClient } };
export function service() {
 const config = getConfig(); const key = createHash('sha256').update(JSON.stringify(config)).digest('hex');
 if (!services.diaryNotion?.client || services.diaryNotion.key !== key) { services.diaryNotion?.journal.close(); const journal = new Journal(config.statePath); const client = new NotionClient(config.token); services.diaryNotion = {key,journal,client,repository:new NotionRepository(config,client,journal)}; }
 return {config,...services.diaryNotion};
}
