import { sourceLinkHost } from './source-links';

export function memoFields(content: string) {
 const links = new Set<string>();
 const withoutLinks = content.replace(/https?:\/\/[^\s<>"“”]+/giu, match => {
  let url = match.replace(/[.,!?;:，。！？、]+$/u, '');
  while (url.endsWith(')') && (url.match(/\)/g)?.length ?? 0) > (url.match(/\(/g)?.length ?? 0)) {
   url = url.slice(0, -1).replace(/[.,!?;:，。！？、]+$/u, '');
  }
  if (sourceLinkHost(url)) links.add(url);
  return ' ';
 });
 const tags = new Set(Array.from(
  withoutLinks.matchAll(/(?:^|[^\p{L}\p{M}\p{N}_#])#([\p{L}\p{M}\p{N}_-]+)/gu),
  match => match[1],
 ));
 return { links: [...links], tags: [...tags] };
}
