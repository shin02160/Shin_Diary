export interface WikiText { text: string; url?: string }
export interface WikiBlock { id: string; kind: string; text: WikiText[]; children: WikiBlock[]; page?: string }
export interface WikiPage { id: string; title: string; url?: string; parent?: string; blocks: WikiBlock[]; truncated: boolean }
