export interface ReviewSource {
 date: string;
 category: string;
 title: string;
 excerpt: string;
}

export function validReviewSources(value: unknown): value is ReviewSource[] {
 return Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every(item => {
  if (!item || typeof item !== 'object' || Object.keys(item).length !== 4) return false;
  const { date, category, title, excerpt } = item as Record<string, unknown>;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
   Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date &&
   typeof category === 'string' && ['Daily', 'Travel', 'Concert', 'Projects'].includes(category) &&
   typeof title === 'string' && title.length <= 120 && typeof excerpt === 'string' && excerpt.length <= 330 &&
   Boolean(title.trim() || excerpt.trim());
 });
}
