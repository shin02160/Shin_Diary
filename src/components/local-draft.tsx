'use client';

import { useState } from 'react';

export function LocalDraft({ source, label }: {
 source: string;
 label: string;
}) {
 const [generated, setGenerated] = useState<{ source: string; text: string }>();
 if (!source.trim()) return null;
 const draft = generated?.source === source ? generated : undefined;
 return (
  <details className="event-details">
   <summary>{label}</summary>
   <button type="button" className="button" onClick={() => setGenerated({ source, text: source })}>초안 만들기</button>
   {draft && <>
    <label>검토할 초안<textarea rows={6} maxLength={8000} value={draft.text}
     onChange={event => setGenerated({ source, text: event.target.value })}/></label>
   </>}
  </details>
 );
}
