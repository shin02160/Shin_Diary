export interface Interest {
 id: string;
 name: string;
 category?: string;
 status?: string;
 startedAt?: string;
 endedAt?: string;
 memo?: string;
 lastReviewedAt?: string;
 preferenceLevel?: string;
 why?: string;
 cover?: string;
 tags: string[];
 relatedPageIds: string[];
 moreRelations: boolean;
}

export interface InterestResult {
 configured: boolean;
 interests: Interest[];
 truncated?: boolean;
}
