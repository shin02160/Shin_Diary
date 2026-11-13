// Link decisions made in this browser. Nothing here is written to Notion.
export const approvedKey = (interestId: string) => 'mlu.interest-links.' + interestId;
export const dismissedKey = (interestId: string) => 'mlu.interest-links.dismissed.' + interestId;

export function storedLinks(key: string): string[] {
 try {
  const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
 } catch { return []; }
}
