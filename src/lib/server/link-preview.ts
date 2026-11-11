import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { AppError } from './config';

const blocked = new BlockList();
for (const [network, prefix] of [
 ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
 ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
 ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(network, prefix, 'ipv4');

function publicUrl(value: string) {
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || isIP(url.hostname)) {
  throw new AppError(400, '공개 HTTPS 웹 주소만 미리 볼 수 있습니다.');
 }
 return url;
}

async function download(value: string, limit: number, accept: RegExp, signal: AbortSignal, redirects = 0): Promise<{ url: URL; body: Buffer; mime: string }> {
 signal.throwIfAborted();
 const url = publicUrl(value);
 let cancel: () => void = () => {};
 const cancelled = new Promise<never>((_, reject) => {
  cancel = () => reject(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
 });
 let addresses: string[];
 try {
  const answers = await Promise.race([lookup(url.hostname, { family: 4, all: true }), cancelled]);
  addresses = answers.map(answer => answer.address);
 } finally { signal.removeEventListener('abort', cancel); }
 if (!addresses.length || addresses.some(address => blocked.check(address, 'ipv4'))) throw new AppError(400, '공개 웹 주소만 미리 볼 수 있습니다.');
 signal.throwIfAborted();

 return new Promise((resolve, reject) => {
  // Connect to the checked IP, while validating TLS against the original hostname.
  const request = get({
   hostname: addresses[0], servername: url.hostname, path: url.pathname + url.search,
   headers: { Host: url.host, 'Accept-Encoding': 'identity' }, signal, agent: false,
  }, response => {
   const status = response.statusCode ?? 0;
   if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirects < 3) {
    response.destroy();
    try { resolve(download(new URL(response.headers.location, url).href, limit, accept, signal, redirects + 1)); }
    catch (error) { reject(error); }
    return;
   }
   const mime = (response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
   if (status !== 200 || !accept.test(mime)) {
    response.destroy();
    reject(new AppError(422, '이 페이지에서 미리보기를 읽을 수 없습니다.'));
    return;
   }
   let size = 0;
   const chunks: Buffer[] = [];
   response.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size <= limit) chunks.push(chunk);
    else if (mime === 'text/html') {
     resolve({ url, mime, body: Buffer.concat(chunks) });
     response.destroy();
    } else {
     reject(new AppError(413, '미리보기 이미지가 너무 큽니다.'));
     response.destroy();
    }
   });
   response.on('end', () => resolve({ url, mime, body: Buffer.concat(chunks) }));
   response.on('error', reject);
   response.on('aborted', () => reject(new Error('미리보기 응답이 끊겼습니다.')));
  });
  request.on('error', reject);
 });
}

function plain(value: string) {
 const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
 return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, key: string) => {
  if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? match;
  const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
 }).replace(/\s+/g, ' ').trim();
}

export async function linkPreview(value: string) {
 const signal = AbortSignal.timeout(6500);
 const page = await download(value, 160_000, /^text\/html$/, signal);
 const head = page.body.toString('utf8').split(/<\/head\s*>/i)[0];
 const metadata = new Map<string, string>();
 for (const tag of head.matchAll(/<meta\s+(?:"[^"]*"|'[^']*'|[^'"<>])*>/gi)) {
  const attrs = new Map(Array.from(tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g),
   attr => [attr[1].toLowerCase(), attr[2] ?? attr[3] ?? attr[4]]));
  const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
  const content = attrs.get('content');
  if (key && content && !metadata.has(key)) metadata.set(key, plain(content));
 }
 const title = (metadata.get('og:title') || plain(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')).slice(0, 240);
 const description = (metadata.get('og:description') || metadata.get('description') || '').slice(0, 500);
 let image: string | undefined;
 const imageUrl = metadata.get('og:image');
 if (imageUrl) {
  try {
   const result = await download(new URL(imageUrl, page.url).href, 180_000, /^image\/(jpeg|png|webp|gif)$/, signal);
   image = 'data:' + result.mime + ';base64,' + result.body.toString('base64');
  } catch { /* The title and description can still be shown. */ }
 }
 return { title: title || page.url.hostname, description, image };
}
