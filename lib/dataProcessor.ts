import {
  startOfWeek,
  startOfMonth,
  addWeeks,
  addMonths,
  addQuarters,
  startOfQuarter,
  format,
  isWithinInterval,
  isBefore,
  isAfter,
  startOfYear,
  subDays,
} from 'date-fns';
import type { ParsedLead, ChartDataPoint, ChartQuery, GroupBy, DatePreset } from './types';

function getPeriodStart(date: Date, groupBy: GroupBy): Date {
  switch (groupBy) {
    case 'week':
      return startOfWeek(date, { weekStartsOn: 1 });
    case 'month':
      return startOfMonth(date);
    case 'quarter':
      return startOfQuarter(date);
  }
}

function formatPeriod(date: Date, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'week':
      return format(date, 'M/d/yy');
    case 'month':
      return format(date, "MMM ''yy");
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `Q${q} '${format(date, 'yy')}`;
    }
  }
}

function nextPeriod(date: Date, groupBy: GroupBy): Date {
  switch (groupBy) {
    case 'week':
      return addWeeks(date, 1);
    case 'month':
      return addMonths(date, 1);
    case 'quarter':
      return addQuarters(date, 1);
  }
}

function generateAllPeriods(from: Date, to: Date, groupBy: GroupBy): Date[] {
  const periods: Date[] = [];
  let cur = getPeriodStart(from, groupBy);
  const end = getPeriodStart(to, groupBy);
  while (!isAfter(cur, end)) {
    periods.push(cur);
    cur = nextPeriod(cur, groupBy);
  }
  return periods;
}

export function processChartData(leads: ParsedLead[], query: ChartQuery): ChartDataPoint[] {
  const { metric, filters, dateField, groupBy, startDate, endDate } = query;

  if (!metric) return [];

  const counts = new Map<number, number>();

  for (const lead of leads) {
    const metricTag = lead.tags.get(metric);
    if (!metricTag?.applied) continue;

    let groupDate: Date | null = null;
    if (dateField === 'created') {
      groupDate = lead.createdDate;
    } else {
      groupDate = lead.tags.get(dateField)?.applied ?? null;
    }
    if (!groupDate) continue;

    if (startDate && isBefore(groupDate, startDate)) continue;
    if (endDate && isAfter(groupDate, endDate)) continue;

    let passesFilters = true;
    for (const filter of filters) {
      if (filter === metric) continue;
      const filterTag = lead.tags.get(filter);
      if (!filterTag?.applied) {
        passesFilters = false;
        break;
      }
    }
    if (!passesFilters) continue;

    const periodStart = getPeriodStart(groupDate, groupBy);
    const key = periodStart.getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) return [];

  const allKeys = Array.from(counts.keys()).sort((a, b) => a - b);
  const rangeStart = startDate
    ? getPeriodStart(startDate, groupBy)
    : new Date(allKeys[0]);
  const rangeEnd = endDate
    ? getPeriodStart(endDate, groupBy)
    : new Date(allKeys[allKeys.length - 1]);

  const periods = generateAllPeriods(rangeStart, rangeEnd, groupBy);

  return periods.map((periodStart) => ({
    period: formatPeriod(periodStart, groupBy),
    count: counts.get(periodStart.getTime()) ?? 0,
    periodStart,
  }));
}

export function countLeadsWithTag(leads: ParsedLead[], tagLabel: string): number {
  return leads.filter((l) => l.tags.get(tagLabel)?.applied != null).length;
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all_time: 'All Time',
  this_year: 'This Year',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
};

function presetStart(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case 'all_time': return null;
    case 'this_year': return startOfYear(now);
    case 'this_month': return startOfMonth(now);
    case 'last_30_days': return subDays(now, 30);
    case 'last_90_days': return subDays(now, 90);
  }
}

export function countLeadsForTotal(
  leads: ParsedLead[],
  metric: string | null,
  preset: DatePreset = 'all_time'
): number {
  const start = presetStart(preset);
  return leads.filter((lead) => {
    const date = metric
      ? lead.tags.get(metric)?.applied ?? null
      : lead.createdDate;
    if (metric && !lead.tags.get(metric)?.applied) return false;
    if (start && (!date || isBefore(date, start))) return false;
    return true;
  }).length;
}

export function countLeadsWithFilters(leads: ParsedLead[], metric: string, filters: string[]): number {
  return leads.filter((lead) => {
    if (!lead.tags.get(metric)?.applied) return false;
    return filters.every((f) => f === metric || lead.tags.get(f)?.applied != null);
  }).length;
}
