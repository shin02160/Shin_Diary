import type { WikiBlock } from './wiki.ts';

const categories = [
 { key: 'travel', label: '여행', aliases: ['여행', 'travel'] },
 { key: 'concert', label: '공연', aliases: ['공연', 'concert'] },
 { key: 'daily', label: '일상 & 다이어리', aliases: ['일상 & 다이어리', '일상', '다이어리', 'daily', 'diary'] },
 { key: 'project', label: '프로젝트', aliases: ['프로젝트', 'project', 'projects'] },
 { key: 'collection', label: '관심사 & 컬렉션', aliases: ['관심사 & 컬렉션', '관심사', '컬렉션', 'collection'] },
] as const;

type CategoryKey = (typeof categories)[number]['key'] | 'uncategorized';
export interface WikiDocument { id: string; title: string; category: CategoryKey }

function namedCategory(text: string, heading: boolean) {
 const title = text.trim().toLowerCase();
 return categories.find(category => category.aliases.some(alias =>
  title === alias || (!heading && (
   title.startsWith('[' + alias + ']') || title.startsWith(alias + ':') ||
   title.startsWith(alias + ' · ') || title.startsWith(alias + ' - ')
  ))
 ))?.key;
}

export function wikiDirectory(blocks: WikiBlock[]) {
 const documents = new Map<string, WikiDocument>();
 function collect(items: WikiBlock[], inherited?: CategoryKey) {
  const headings: { level: number; category?: CategoryKey }[] = [];
  for (const block of items) {
   const title = block.text.map(item => item.text).join('').trim();
   const heading = /^heading_([123])$/.exec(block.kind);
   if (heading) {
    const level = Number(heading[1]);
    while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
    headings.push({ level, category: namedCategory(title, true) });
   }
   const category = [...headings].reverse().find(item => item.category)?.category ?? inherited;
   if (block.kind === 'child_page' && block.page && !documents.has(block.page)) {
    documents.set(block.page, { id: block.page, title: title || '하위 페이지',
     category: namedCategory(title, false) ?? category ?? 'uncategorized' });
   }
   if (block.children.length) collect(block.children, category);
  }
 }
 collect(blocks);
 const all = Array.from(documents.values());
 const groups = [...categories, { key: 'uncategorized' as const, label: '미분류' }]
  .map(({ key, label }) => ({ key, label, count: all.filter(document => document.category === key).length }))
  .filter(group => group.count > 0);
 return { all, groups };
}
