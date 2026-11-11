'use client';

import { useState } from 'react';
import { orderedEntries, useArchive } from '@/lib/local-store';
import { EntryCard } from './cards';

export function DuplicateRecords() {
 const { entries, ready, error } = useArchive();
 const [checked, setChecked] = useState(false);
 const groups = new Map<string, typeof entries>();
 if (checked) {
  for (const entry of orderedEntries(entries)) {
   if (entry.isSample) continue;
   const body = entry.content.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
   if (body.length < 10) continue;
   const group = groups.get(body);
   if (group) group.push(entry);
   else groups.set(body, [entry]);
  }
 }
 const candidates = [...groups.values()].filter(group => group.length > 1);
 return (
  <details className="resume-panel">
   <summary>중복 기록 후보</summary>
   <p>띄어쓰기와 문장부호를 제외한 본문이 같은 내 기록을 찾습니다.</p>
   <button type="button" className="button" disabled={!ready || !!error || checked} onClick={() => setChecked(true)}>후보 확인</button>
   {checked && <p role="status">후보 {candidates.length}묶음</p>}
   {candidates.map((group, index) => (
    <section key={group[0].id}>
     <h2>같은 본문 · {index + 1}</h2>
     <div className="grid three">{group.map(entry => <EntryCard key={entry.id} entry={entry}/>)}</div>
    </section>
   ))}
  </details>
 );
}
