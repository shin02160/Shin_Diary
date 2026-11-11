import type { CalendarEvent } from '../types';
export interface ImportedEvent extends Omit<CalendarEvent,'isSample'> {
 isSample: false;
 sourceName: string;
 wallStart: string;
 wallEnd: string;
 description: string;
 originalTimezone?: string;
 status: 'confirmed'|'tentative'|'cancelled'|'unknown';
 importedAt: string;
}
export interface SavedEvent { event: ImportedEvent; revision: string }
export interface PreviewOptions { sourceCalendarId: string; sourceName: string; from: string; to: string; maxOccurrences?: number; maxIterations?: number }
export interface PreviewResult {
 events: ImportedEvent[];
 sourceCalendarId: string;
 sourceName: string;
 from: string;
 to: string;
 componentCount: number;
 duplicateComponents: number;
 skipped: number;
 partial: boolean;
 warnings: {code:string;message:string;count:number}[];
}
export type WorkerReply = {ok:true;result:PreviewResult}|{ok:false;error:string};
