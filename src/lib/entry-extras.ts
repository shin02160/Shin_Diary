import { sourceLinkHost } from './source-links.ts';

export const photoProperty = 'Diary Photo';
export const travelProperty = 'Travel References';
export const photoMaxLength = 60_000;
export const travelLabels = { booking: '예약', expense: '지출', receipt: '영수증' } as const;
export type TravelReferences = Partial<Record<keyof typeof travelLabels, string>>;

export function validPhoto(value: unknown): value is string {
 return typeof value === 'string' && value.length <= photoMaxLength &&
  /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value) &&
  (value.length - 'data:image/jpeg;base64,'.length) % 4 === 0;
}

export function validTravelReferences(value: unknown): value is TravelReferences {
 return !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.entries(value).every(([key, url]) => Object.hasOwn(travelLabels, key) &&
   typeof url === 'string' && !!sourceLinkHost(url));
}
