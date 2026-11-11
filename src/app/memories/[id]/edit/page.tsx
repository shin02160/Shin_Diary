import { PageHeading } from '@/components/cards';
import { CaptureForm } from '@/components/capture-form';

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeading eyebrow="MEMORIES" title="기록 편집">저장한 기록의 내용을 수정하세요.</PageHeading>
      <CaptureForm entryId={id}/>
    </>
  );
}
