import type { TravelReferences } from './entry-extras';
import type { CalendarEntryLink } from './calendar/entry-link';

export type Category = 'Travel' | 'Concert' | 'Projects' | 'Daily';
export type LifecycleStatus = 'interested' | 'active' | 'parked' | 'satisfied';
export type LocalDate = `${number}-${number}-${number}`;
export type ExperienceDate =
  | { kind: 'date'; date: LocalDate }
  | { kind: 'zoned'; instant: string; timezone: string }
  | { kind: 'floating'; local: string };
export interface Activity {
  id: string;
  name: string;
  category: Category;
  lifecycleStatus: LifecycleStatus;
  isArchived: boolean;
  summary: string;
  lastProgress?: string;
  nextStep?: string;
  parkedAt?: LocalDate;
  resumeNotes?: string;
  references?: string[];
  satisfactionNote?: string;
  updatedAt?: string;
  tags: string[];
  isSample?: boolean;
  notion?: { pageId: string; hash: string };
  syncPending?: boolean;
}
export interface Entry {
  id: string;
  content: string;
  title?: string;
  occurredAt: ExperienceDate;
  createdAt: string;
  updatedAt?: string;
  activityId?: Activity['id'];
  calendarEvent?: CalendarEntryLink;
  sourceLinks?: string[];
  photo?: string;
  travelReferences?: TravelReferences;
  category: Category;
  mood?: string;
  place?: string;
  tags: string[];
  isSample?: boolean;
  notion?: { pageId: string; hash: string };
  syncPending?: boolean;
}
export interface CalendarEvent {
  id: string;
  source: 'NAVER_ICS';
  sourceCalendarId: string;
  uid: string;
  originalInstanceId?: string;
  title: string;
  start: ExperienceDate;
  end?: ExperienceDate;
  endExclusive: boolean;
  location?: string;
  isSample: true;
}
