import { PageHeading } from '@/components/cards';
import { CaptureForm } from '@/components/capture-form';
export default async function Capture({ searchParams }: { searchParams: Promise<{ activity?: string | string[]; event?: string | string[] }> }) {
 const query = await searchParams;
 const eventToken = typeof query.event === 'string' && /^[a-f0-9]{64}$/.test(query.event) ? query.event : '';
 const activityId = typeof query.activity === 'string' ? query.activity : '';
 return <><PageHeading eyebrow="QUICK CAPTURE" title="오늘의 한 줄을 남겨요">제목 없이, 짧은 문장 하나로 시작해도 괜찮아요.</PageHeading><CaptureForm activityId={activityId} eventToken={eventToken}/></>;
}
