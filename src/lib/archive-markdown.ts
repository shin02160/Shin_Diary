import type { Archive } from './archive-schema.ts';
import { travelLabels, type TravelReferences } from './entry-extras.ts';
import { dateKey, dateLabel } from './dates.ts';
import { categoryLabels, statusLabels } from './sample-data.ts';
import { sourceLinkHost } from './source-links.ts';

function escapeMarkdown(value: string) {
  return value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)
    .replace(/[\\`*_\[\]#!~|]/g, '\\$&');
}

function inline(value: string) {
  return escapeMarkdown(value.replace(/\s+/g, ' ').trim());
}

function body(value: string) {
  return value.split(/\r?\n/).map(line => '> ' + escapeMarkdown(line.trimStart())
    .replace(/^([+\-=])/, '\\$1')
    .replace(/^(\d+)([.)])(?=\s)/, '$1\\$2')).join('\n');
}

function field(label: string, value?: string) {
  return value ? ['- **' + label + '** · ' + inline(value)] : [];
}

function links(values?: string[]) {
  return (values ?? []).map(value => {
    if (!sourceLinkHost(value)) return '- ' + inline(value);
    const address = new URL(value).href.replace(/[<>]/g, char => encodeURIComponent(char)).replaceAll('&', '&amp;');
    return '- [' + inline(value) + '](<' + address + '>)';
  });
}

export function archiveMarkdown(archive: Archive): string {
  const entries = archive.entries.filter(entry => !entry.isSample)
    .map(entry => ({ entry, day: dateKey(entry.occurredAt) }))
    .sort((left, right) => right.day.localeCompare(left.day) || right.entry.createdAt.localeCompare(left.entry.createdAt));
  const activities = archive.activities.filter(activity => !activity.isSample);
  const activityNames = new Map(archive.activities.map(activity => [activity.id, activity.name]));
  const lines = ['# My Little Universe', '', '기록 ' + entries.length + '개 · 활동 ' + activities.length + '개', '', '## 기록', ''];
  if (!entries.length) lines.push('내보낼 기록이 없습니다.', '');
  for (const { entry } of entries) {
    const title = entry.title || entry.content.trim().slice(0, 40) || sourceLinkHost(entry.sourceLinks?.[0] ?? '') || '기록';
    lines.push('### ' + inline(title), '',
      ...field('경험한 날짜', dateLabel(entry.occurredAt)),
      ...field('카테고리', categoryLabels[entry.category]),
      ...field('연결 활동', entry.activityId ? activityNames.get(entry.activityId) : undefined),
      ...field('장소', entry.place),
      ...field('감정', entry.mood),
      ...field('태그', entry.tags.join(', ')), '');
    if (entry.content.trim()) lines.push(body(entry.content), '');
    if (entry.calendarEvent) {
      const event = entry.calendarEvent;
      lines.push('**연결된 일정**', '',
        ...field('일정 제목', event.title),
        ...field('일정 시간', event.period),
        ...field('캘린더', event.sourceName),
        ...field('일정 장소', event.location), '');
    }
    if (entry.photo) lines.push('첨부 사진은 Diary JSON 백업에 포함됩니다.', '');
    if (entry.travelReferences) {
      lines.push('**여행 자료**', '');
      for (const [kind, url] of Object.entries(entry.travelReferences)) {
        lines.push(...field(travelLabels[kind as keyof TravelReferences], url));
      }
      lines.push('');
    }
    if (entry.sourceLinks?.length) lines.push('**관련 링크**', '', ...links(entry.sourceLinks), '');
  }
  lines.push('## 활동', '');
  if (!activities.length) lines.push('내보낼 활동이 없습니다.', '');
  for (const activity of activities) {
    lines.push('### ' + inline(activity.name), '',
      ...field('카테고리', categoryLabels[activity.category]),
      ...field('상태', statusLabels[activity.lifecycleStatus] + (activity.isArchived ? ' · 아카이브' : '')),
      ...field('최근 중단', activity.parkedAt),
      ...field('태그', activity.tags.join(', ')), '');
    for (const [label, value] of [
      ['활동 소개', activity.summary], ['마지막 진행', activity.lastProgress],
      ['다음 행동', activity.nextStep], ['재개 메모', activity.resumeNotes], ['만족 메모', activity.satisfactionNote],
    ]) {
      if (value?.trim()) lines.push('**' + label + '**', '', body(value), '');
    }
    if (activity.references?.length) lines.push('**참고 링크**', '', ...links(activity.references), '');
  }
  return lines.join('\n').trimEnd() + '\n';
}
