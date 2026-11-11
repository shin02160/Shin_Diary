import type { Archive } from './archive-schema.ts';

function mergeRecords<T extends { id: string; isSample?: boolean }>(current: T[], incoming: T[]) {
  const records = new Map(current.map(item => [item.id, item]));
  let added = 0;
  let restoredOverSample = 0;
  let kept = 0;
  for (const item of incoming) {
    const existing = records.get(item.id);
    if (!existing) {
      records.set(item.id, item);
      added++;
    } else if (existing.isSample && !item.isSample) {
      records.set(item.id, item);
      restoredOverSample++;
    } else {
      kept++;
    }
  }
  return { records: [...records.values()], added, restoredOverSample, kept };
}

export function planArchiveRestore(current: Archive, backup: Archive) {
  const activities = mergeRecords(current.activities, backup.activities);
  const entries = mergeRecords(current.entries, backup.entries);
  return {
    archive: { ...current, activities: activities.records, entries: entries.records },
    activities,
    entries,
    changes: activities.added + activities.restoredOverSample + entries.added + entries.restoredOverSample,
  };
}
