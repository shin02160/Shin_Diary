'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/notion-sync';
import type { Activity } from '@/lib/types';

export function LinkedActivity({ id }: { id: string }) {
 const [state, setState] = useState<{ activity?: Activity; failed?: boolean }>();
 useEffect(() => {
  let active = true;
  void api<{ activities: Activity[] }>('archive').then(result => {
   if (active) setState({ activity: result.activities.find(item => item.notion?.pageId.replaceAll('-', '').toLowerCase() === id) });
  }).catch(() => { if (active) setState({ failed: true }); });
  return () => { active = false; };
 }, [id]);
 const activity = state?.activity;
 return <section>
  <h1>{activity?.name ?? '연결된 활동'}</h1>
  {!state && <p role="status">활동을 불러오는 중…</p>}
  {state && !activity && <p role={state.failed ? 'alert' : undefined}>{state.failed ? '활동을 불러오지 못했어요.' : '이 활동은 앱에서 조회할 수 없어요.'}</p>}
  {activity?.summary && <p className="preserve-lines">{activity.summary}</p>}
  {activity?.lastProgress && <><h2>최근 진행</h2><p className="preserve-lines">{activity.lastProgress}</p></>}
  {activity?.nextStep && <><h2>다음 단계</h2><p className="preserve-lines">{activity.nextStep}</p></>}
  <a className="text-link" href={'https://www.notion.so/' + id} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>
 </section>;
}
