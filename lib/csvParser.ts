import Papa from 'papaparse';
import type { ParsedData, ParsedLead, TagColumn, TagGroup } from './types';

function parseDate(val: string): Date | null {
  if (!val?.trim()) return null;
  const trimmed = val.trim();

  // ISO 8601 (e.g. 2025-06-12T01:26:50.6694092Z)
  // Normalize UTC/offset timestamps to their UTC components so date-fns week/month
  // bucketing isn't shifted by the browser's local timezone.
  if (trimmed.includes('-') && trimmed.includes('T')) {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
      );
    }
    return d;
  }

  // Date-only ISO (e.g. 2025-06-12)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  // M/D/YY H:MM (e.g. 10/6/25 2:22)
  const withTime = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (withTime) {
    const [, month, day, year2, hour, minute] = withTime;
    return new Date(2000 + parseInt(year2), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }

  // M/D/YY or M/D/YYYY
  const dateOnly = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dateOnly) {
    const [, month, day, year] = dateOnly;
    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  return null;
}

// Direct-download files group all UTM columns under "Utm Sources" with the type
// (Campaign/Medium/Source) embedded in the tag name:
//   "Utm Sources>Campaign Entry Level Applied UTC"
// Normalise to the three-group format the app uses:
//   "UTM_Campaign>Entry Level Applied UTC"
function normalizeUtmHeaders(csvText: string): string {
  const nl = csvText.indexOf('\n');
  if (nl === -1) return csvText;
  const header = csvText.slice(0, nl).replace(
    /Utm Sources>(Campaign|Medium|Source) (.+?) (Applied|Removed)(?: UTC)?/g,
    'UTM_$1>$2 $3 UTC',
  );
  return header + csvText.slice(nl);
}

export function parseCSV(csvText: string, clientName: string): ParsedData {
  const result = Papa.parse<Record<string, string>>(normalizeUtmHeaders(csvText), {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  // Match both formats:
  //   "TagGroup > Tag Applied"        (LA Metro style)
  //   "TagGroup > Tag Applied UTC"
  //   "TagGroup>Tag Applied UTC"       (Newark PD style)
  // Non-greedy on both group and tag so the "Applied [UTC]" suffix anchors correctly.
  const APPLIED_RE = /^(.+?)\s*>\s*(.+?)\s+Applied(?:\s+UTC)?$/;

  const tagMap = new Map<string, TagColumn>();
  for (const header of headers) {
    const m = header.match(APPLIED_RE);
    if (!m) continue;
    const tagGroup = m[1].trim();
    const tag = m[2].trim();
    const label = `${tagGroup} > ${tag}`;
    // Reconstruct removed col by replacing trailing "Applied [UTC]" with "Removed [UTC]"
    const removedCol = header.replace(/Applied( UTC)?$/, 'Removed$1');
    tagMap.set(label, { tagGroup, tag, label, appliedCol: header, removedCol });
  }

  const tagColumns = Array.from(tagMap.values());

  // Group by TagGroup, preserving insertion order
  const groupMap = new Map<string, TagGroup>();
  for (const col of tagColumns) {
    if (!groupMap.has(col.tagGroup)) {
      groupMap.set(col.tagGroup, { name: col.tagGroup, tags: [] });
    }
    groupMap.get(col.tagGroup)!.tags.push(col);
  }
  const tagGroups = Array.from(groupMap.values());

  const leads: ParsedLead[] = result.data.map((row) => {
    const tags = new Map<string, { applied: Date | null; removed: Date | null }>();
    for (const [label, col] of tagMap.entries()) {
      tags.set(label, {
        applied: parseDate(row[col.appliedCol] ?? ''),
        removed: parseDate(row[col.removedCol] ?? ''),
      });
    }
    return {
      leadId: row['Lead Id'] ?? '',
      fullName: row['Full Name'] || `${row['First Name'] ?? ''} ${row['Last Name'] ?? ''}`.trim(),
      assigned: row['Assigned To'] ?? row['Assigned'] ?? '',
      createdDate: parseDate(row['Created Date'] ?? ''),
      activityDate: parseDate(row['Activity Date'] ?? ''),
      tags,
    };
  });

  const allDates: Date[] = [];
  for (const lead of leads) {
    if (lead.createdDate) allDates.push(lead.createdDate);
    for (const { applied } of lead.tags.values()) {
      if (applied) allDates.push(applied);
    }
  }
  allDates.sort((a, b) => a.getTime() - b.getTime());

  return {
    clientName,
    tagColumns,
    tagGroups,
    leads,
    dateRange: {
      min: allDates[0] ?? new Date(),
      max: allDates[allDates.length - 1] ?? new Date(),
    },
  };
}

export function clientNameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
