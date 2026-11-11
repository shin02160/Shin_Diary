export interface CollectionItem {
 id: string;
 title: string;
 url: string;
 start?: string;
 end?: string;
 location?: string;
 detail?: string;
 memo?: string;
 cover?: string;
 updatedAt?: string;
}
export type CollectionResult =
 | { state: 'unconfigured' }
 | { state: 'failed'; message: string }
 | { state: 'ready'; items: CollectionItem[]; truncated: boolean };
export interface NotionCollections { trips: CollectionResult; itinerary: CollectionResult; performances: CollectionResult }
