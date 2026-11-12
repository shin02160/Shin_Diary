export interface CollectionItem {
 id: string;
 title: string;
 url: string;
 start?: string;
 end?: string;
 timezone?: string;
 sourceStatus?: string;
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
export interface NotionCollections { trips: CollectionResult; performances: CollectionResult }

export type CollectionKind = keyof NotionCollections;
export type TravelSection = {
 label: string;
 records: { title: string; url: string; start?: string; end?: string; location?: string; status?: string }[];
 unavailable?: boolean;
 truncated?: boolean;
};
export interface CollectionDetail {
 item: CollectionItem;
 sections?: TravelSection[];
 cast?: string;
 setlist?: string;
 memo?: string;
}
