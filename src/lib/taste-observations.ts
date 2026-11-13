import { dateKey } from './dates.ts';
import type { Entry } from './types.ts';
import type { WikiBlock } from './wiki.ts';
import { gptReviewId, reviewMonth } from './wiki-review.ts';

export interface TasteObservation {
 id: string;
 entryId: string;
 pageId: string;
 title: string;
 day: string;
 // A monthly look-back belongs to its month, not to the day it is filed under.
 precision: 'day' | 'month';
 category: Entry['category'];
 quote: string;
 cue: string;
}
export type ReviewStatus = 'confirmed' | 'rejected';
export interface TasteReview { status?: ReviewStatus; traits: string[]; quote: string; title: string; day: string }

// Words the writer uses when saying, in their own voice, that something appealed to them.
const cues = /인상적|인상 ?깊|기억에 남|마음에 들|반했|반한|반해|설렜|설레|뭉클|벅찼|벅차|감동|여운|행복|즐거웠|즐거운|즐겁|재밌|재미있|신났|신나|좋았|좋아|좋다|좋은|예뻤|예쁘|예뻐|아름다|멋있|멋졌|멋진|맛있|귀여|사랑스|편안|최고/;
// The same words turned around are not an attraction.
const negated = /좋지 ?않|안 ?좋|별로|재미없|맛없|예쁘지 ?않|즐겁지 ?않|멋있지 ?않|인상적이지 ?않/;

// Sentences in which the writer states an attraction outright. Nothing is inferred: a sentence without such a word is left out.
export function attractionSentences(text: string) {
 const seen = new Set<string>();
 return text.split(/\n+|(?<=[.!?…])\s+/).flatMap(part => {
  const quote = part.replace(/\s+/g, ' ').trim();
  const cue = cues.exec(quote)?.[0];
  if (!cue || negated.test(quote) || quote.length < 8 || quote.length > 240 || seen.has(quote)) return [];
  seen.add(quote);
  return [{ quote, cue }];
 });
}

// Prose of a Notion body in reading order. Code and tables are data rather than the writer's voice.
export function blockText(blocks: WikiBlock[]): string {
 return blocks.flatMap(block => block.kind === 'code' || block.kind === 'table' ? [] :
  [block.text.map(item => item.text).join(''), blockText(block.children)]).filter(Boolean).join('\n');
}

function hash(value: string) {
 let result = 5381;
 for (let index = 0; index < value.length; index++) result = (result * 33 + value.charCodeAt(index)) >>> 0;
 return result.toString(36);
}

// The id depends only on the source page and the quoted words, so a decision about a sentence survives re-reading.
export function entryObservations(entry: Entry, body?: string): TasteObservation[] {
 const pageId = entry.notion?.pageId.replaceAll('-', '').toLowerCase();
 const day = dateKey(entry.occurredAt);
 if (!pageId || entry.isSample || entry.id === gptReviewId(day.slice(0, 7))) return [];
 const month = reviewMonth(entry) ?? (/^\s*(?:19|20)\d{2}년\s*\d{1,2}월(?!\s*\d{1,2}일)/.test(entry.title ?? '') ? day.slice(0, 7) : undefined);
 // The body, once read, replaces the summary so the same thought is not listed twice.
 const fromBody = body === undefined ? [] : attractionSentences(body);
 return (fromBody.length ? fromBody : attractionSentences(entry.content)).map(({ quote, cue }) => ({
  id: hash(pageId + '\n' + quote), entryId: entry.id, pageId, title: entry.title?.trim() || entry.content.trim().slice(0, 40) || '제목 없는 기록',
  day: month ? month + '-01' : day, precision: month ? 'month' : 'day', category: entry.category, quote, cue,
 }));
}

// Traits the user attached, with the sentences that carry them. A trait seen in several kinds of record recurs across areas.
export function traitGroups(observations: TasteObservation[], reviews: Record<string, TasteReview>) {
 const groups = new Map<string, TasteObservation[]>();
 for (const observation of observations) {
  const review = reviews[observation.id];
  if (review?.status === 'rejected') continue;
  for (const trait of review?.traits ?? []) groups.set(trait, [...(groups.get(trait) ?? []), observation]);
 }
 return [...groups].map(([trait, rows]) => ({ trait, rows, categories: [...new Set(rows.map(row => row.category))] }))
  .sort((a, b) => b.categories.length - a.categories.length || b.rows.length - a.rows.length || a.trait.localeCompare(b.trait, 'ko'));
}

// Decisions whose sentence is no longer in the source need another look instead of silently disappearing.
export function staleReviews(observations: TasteObservation[], reviews: Record<string, TasteReview>) {
 const current = new Set(observations.map(observation => observation.id));
 return Object.entries(reviews).filter(([id, review]) => !current.has(id) && (review.status || review.traits.length)).map(([id, review]) => ({ id, ...review }));
}
