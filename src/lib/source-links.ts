export const sourceLinksProperty = 'Source Links';
export const sourceLinksMaxLength = 10000;

export function sourceLinkHost(value: string): string | undefined {
  if (value.length > 2000 || !/^https?:\/\//i.test(value) || /\s/.test(value)) return;
  try {
    const url = new URL(value);
    if (!url.username && !url.password && url.hostname) return url.host;
  } catch { /* Invalid addresses cannot be linked. */ }
}

export function validSourceLinks(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 10
    && value.every(url => typeof url === 'string' && !!sourceLinkHost(url))
    && value.join('\n').length <= sourceLinksMaxLength
    && new Set(value).size === value.length;
}

export function parseSourceLinks(input: string) {
  const links = [...new Set(input.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (!validSourceLinks(links)) {
    throw new Error('관련 링크는 http 또는 https 주소를 한 줄에 하나씩, 최대 10개 입력해 주세요.');
  }
  return links;
}
