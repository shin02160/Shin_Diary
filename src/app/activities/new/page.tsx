import { ActivityEditor } from '@/components/activity-editor';
import { PageHeading } from '@/components/cards';
export default function NewActivity() { return <><PageHeading eyebrow="NEW ACTIVITY" title="새로운 관심사를 담아볼까요?">이름 하나로 시작하고, 나머지는 천천히 채워요.</PageHeading><ActivityEditor/></>; }
