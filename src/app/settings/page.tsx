import { RecordReminderSettings } from '@/components/record-reminder';
import { CalendarSettings } from '@/components/calendar-settings';
import { NotionSettings } from '@/components/notion-settings';
import { LocalSettings } from '@/components/local-settings';
import { PageHeading } from '@/components/cards';
export default function Settings() { return <><PageHeading eyebrow="SETTINGS" title="나의 공간을 위한 설정">현재 연결 상태와 준비 중인 기능을 확인하세요.</PageHeading><div className="settings-grid"><LocalSettings/><RecordReminderSettings/><NotionSettings/><CalendarSettings/></div></>; }
