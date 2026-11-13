export interface WikiText {
 text: string; url?: string; page?: string;
 bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean; underline?: boolean;
}
export interface WikiBlock {
 id: string; kind: string; text: WikiText[]; children: WikiBlock[];
 page?: string; checked?: boolean; image?: string; caption?: WikiText[];
 cells?: WikiText[][]; columnHeader?: boolean; rowHeader?: boolean;
}
export interface WikiPage { id: string; title: string; url?: string; parent?: string; blocks: WikiBlock[]; truncated: boolean }
export interface WikiEntryBody { blocks: WikiBlock[]; truncated: boolean; partial?: boolean; omitted?: Record<string, number>; updatedAt?: string; activityIds?: string[]; activityLinksUnavailable?: boolean }
