import Papa from 'papaparse';
import type { ParsedData, ParsedLead, TagColumn } from './types';

function parseDate(val: string): Date | null {
  if (!val?.trim()) return null;
  const trimmed = val.trim();
  const withTime = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (withTime) {
    const [, month, day, year2, hour, minute] = withTime;
    return new Date(2000 + parseInt(year2), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  const dateOnly = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dateOnly) {
    const [, month, day, year] = dateOnly;
    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }
  return null;
}

export function parseCSV(csvText: string, clientName: string): ParsedData {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];

  const tagMap = new Map<string, TagColumn>();
  for (const header of headers) {
    const m = header.match(/^(.+) > (.+) Applied$/);
    if (m) {
      const tagGroup = m[1].trim();
      const tag = m[2].trim();
      const label = `${tagGroup} > ${tag}`;
      tagMap.set(label, {
        tagGroup,
        tag,
        label,
        appliedCol: header,
        removedCol: `${tagGroup} > ${tag} Removed`,
      });
    }
  }

  const tagColumns = Array.from(tagMap.values());

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
      assigned: row['Assigned'] ?? '',
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
    leads,
    dateRange: {
      min: allDates[0] ?? new Date(),
      max: allDates[allDates.length - 1] ?? new Date(),
    },
  };
}

export function clientNameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}
