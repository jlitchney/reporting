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
import type { ParsedLead, ChartDataPoint, ChartQuery, GroupBy, DatePreset, CriteriaFilter, FilterCondition, TagGroup } from './types';
import type { SpendEntry } from './redis';

function testCondition(lead: ParsedLead, cond: FilterCondition): boolean {
  if (!cond.tag) return true;
  const entry = lead.tags.get(cond.tag);
  const op = cond.operator as string; // cast so legacy values ('is_applied', 'is_not_applied') don't break
  if (op === 'currently_applied') return entry?.applied != null && entry?.removed == null;
  if (op === 'removed') return entry?.removed != null;
  if (op === 'never_applied' || op === 'is_not_applied') return entry?.applied == null;
  // 'ever_applied' | 'is_applied' (legacy) | fallback
  return entry?.applied != null;
}

// AND has higher precedence than OR: split by OR → each chunk is ANDed → any chunk passing = true
export function evaluateCriteria(lead: ParsedLead, criteria: CriteriaFilter): boolean {
  const { conditions, logic } = criteria;
  if (conditions.length === 0) return true;

  // Clamp logic to expected length to guard against any stored data with a mismatch
  const safeLogic = logic.slice(0, conditions.length - 1);

  const groups: FilterCondition[][] = [];
  let group: FilterCondition[] = [conditions[0]];
  for (let i = 0; i < safeLogic.length; i++) {
    if (safeLogic[i] === 'OR') { groups.push(group); group = [conditions[i + 1]]; }
    else { group.push(conditions[i + 1]); }
  }
  groups.push(group);

  return groups.some((g) => g.filter(Boolean).every((c) => testCondition(lead, c)));
}

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
  const { metric, filters, dateField, groupBy, startDate, endDate, datePreset, excludeRemoved } = query;

  if (!metric) return [];

  const isAllCandidates = metric === '__all__';
  const effectiveStart = datePreset && datePreset !== 'custom' ? presetStart(datePreset) : (startDate ?? null);
  const effectiveEnd = datePreset === 'custom' ? (endDate ?? null) : null;

  const counts = new Map<number, number>();

  for (const lead of leads) {
    if (!isAllCandidates) {
      const metricTag = lead.tags.get(metric);
      if (!metricTag?.applied) continue;
      if (excludeRemoved && metricTag.removed != null) continue;
    }

    let groupDate: Date | null = null;
    if (isAllCandidates || dateField === 'created') {
      groupDate = lead.createdDate;
    } else {
      groupDate = lead.tags.get(dateField)?.applied ?? null;
    }
    if (!groupDate) continue;

    if (effectiveStart && isBefore(groupDate, effectiveStart)) continue;
    if (effectiveEnd && isAfter(groupDate, effectiveEnd)) continue;

    let passesFilters = true;
    for (const filter of filters) {
      if (!isAllCandidates && filter === metric) continue;
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
  const rangeStart = effectiveStart
    ? getPeriodStart(effectiveStart, groupBy)
    : new Date(allKeys[0]);
  const rangeEnd = effectiveEnd
    ? getPeriodStart(effectiveEnd, groupBy)
    : new Date(allKeys[allKeys.length - 1]);

  const periods = generateAllPeriods(rangeStart, rangeEnd, groupBy);

  return periods.map((periodStart) => ({
    period: formatPeriod(periodStart, groupBy),
    count: counts.get(periodStart.getTime()) ?? 0,
    periodStart,
  }));
}

export function processTagGroupChart(
  leads: ParsedLead[],
  tagGroups: TagGroup[],
  tagGroupName: string,
  query: ChartQuery
): ChartDataPoint[] {
  const { metric, filters, criteria, startDate, endDate, datePreset } = query;
  const group = tagGroups.find((g) => g.name === tagGroupName);
  if (!group) return [];

  const effectiveStart = datePreset && datePreset !== 'custom' ? presetStart(datePreset) : (startDate ?? null);
  const effectiveEnd = datePreset === 'custom' ? (endDate ?? null) : null;

  return group.tags.map((tag) => {
    const count = leads.filter((lead) => {
      const tagEntry = lead.tags.get(tag.label);
      if (!tagEntry?.applied) return false;
      if (query.excludeRemoved && tagEntry.removed != null) return false;
      if (metric && !lead.tags.get(metric)?.applied) return false;

      if (effectiveStart || effectiveEnd) {
        const date = metric ? lead.tags.get(metric)?.applied ?? null : lead.createdDate;
        if (effectiveStart && (!date || isBefore(date, effectiveStart))) return false;
        if (effectiveEnd && date && isAfter(date, effectiveEnd)) return false;
      }

      if (criteria && criteria.conditions.length > 0) return evaluateCriteria(lead, criteria);
      for (const f of filters) {
        if (f === metric || f === tag.label) continue;
        if (!lead.tags.get(f)?.applied) return false;
      }
      return true;
    }).length;
    return { period: tag.tag, count };
  });
}

export type StackedBarDataPoint = { period: string; periodStart?: Date; [key: string]: any };

export function processStackedBarChart(
  leads: ParsedLead[],
  tagGroups: TagGroup[],
  stackGroupName: string,
  query: ChartQuery
): StackedBarDataPoint[] {
  const stackGroup = tagGroups.find((g) => g.name === stackGroupName);
  if (!stackGroup || stackGroup.tags.length === 0) return [];

  const { metric, filters, dateField, groupBy, datePreset, startDate, endDate, excludeRemoved } = query;
  const effectiveStart = datePreset && datePreset !== 'custom' ? presetStart(datePreset) : (startDate ?? null);
  const effectiveEnd = datePreset === 'custom' ? (endDate ?? null) : null;

  const periodData = new Map<number, Map<string, number>>();

  for (const lead of leads) {
    if (metric && !lead.tags.get(metric)?.applied) continue;

    let groupDate: Date | null;
    if (dateField === 'created') {
      groupDate = lead.createdDate;
    } else {
      groupDate = lead.tags.get(dateField)?.applied ?? null;
    }
    if (!groupDate) continue;
    if (effectiveStart && isBefore(groupDate, effectiveStart)) continue;
    if (effectiveEnd && isAfter(groupDate, effectiveEnd)) continue;

    let passesFilters = true;
    for (const f of filters) {
      if (f === metric) continue;
      if (!lead.tags.get(f)?.applied) { passesFilters = false; break; }
    }
    if (!passesFilters) continue;

    const periodStart = getPeriodStart(groupDate, groupBy);
    const key = periodStart.getTime();
    if (!periodData.has(key)) periodData.set(key, new Map());
    const periodMap = periodData.get(key)!;

    // Count each lead in at most one stack bucket (first matching tag wins)
    // so stacked totals match the simple metric count.
    for (const tag of stackGroup.tags) {
      const tagEntry = lead.tags.get(tag.label);
      if (!tagEntry?.applied) continue;
      if (excludeRemoved && tagEntry.removed != null) continue;
      periodMap.set(tag.label, (periodMap.get(tag.label) ?? 0) + 1);
      break;
    }
  }

  if (periodData.size === 0) return [];

  const allKeys = Array.from(periodData.keys()).sort((a, b) => a - b);
  const rangeStart = effectiveStart ? getPeriodStart(effectiveStart, groupBy) : new Date(allKeys[0]);
  const rangeEnd = effectiveEnd ? getPeriodStart(effectiveEnd, groupBy) : new Date(allKeys[allKeys.length - 1]);
  const periods = generateAllPeriods(rangeStart, rangeEnd, groupBy);

  return periods.map((pStart) => {
    const key = pStart.getTime();
    const periodMap = periodData.get(key) ?? new Map<string, number>();
    const entry: StackedBarDataPoint = { period: formatPeriod(pStart, groupBy), periodStart: pStart };
    for (const tag of stackGroup.tags) {
      entry[tag.label] = periodMap.get(tag.label) ?? 0;
    }
    return entry;
  });
}

export interface FunnelDataPoint {
  label: string;
  tagLabel: string;
  count: number;
}

export function processFunnelChart(
  leads: ParsedLead[],
  funnelStages: string[],
  tagGroups: TagGroup[],
  query: ChartQuery
): FunnelDataPoint[] {
  if (!funnelStages.length) return [];
  const { datePreset, startDate, endDate, excludeRemoved } = query;
  const effectiveStart = datePreset && datePreset !== 'custom' ? presetStart(datePreset) : (startDate ?? null);
  const effectiveEnd = datePreset === 'custom' ? (endDate ?? null) : null;

  const labelFor = (lbl: string) =>
    query.funnelStageLabels?.[lbl] ??
    tagGroups.flatMap((g) => g.tags).find((t) => t.label === lbl)?.tag ??
    lbl;

  return funnelStages.map((tagLabel) => {
    const count = leads.filter((lead) => {
      const tagEntry = lead.tags.get(tagLabel);
      if (!tagEntry?.applied) return false;
      if (excludeRemoved && tagEntry.removed != null) return false;
      if (effectiveStart || effectiveEnd) {
        const date = lead.createdDate;
        if (effectiveStart && (!date || isBefore(date, effectiveStart))) return false;
        if (effectiveEnd && date && isAfter(date, effectiveEnd)) return false;
      }
      return true;
    }).length;
    return { label: labelFor(tagLabel), tagLabel, count };
  });
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
  custom: 'Custom Range',
};

function presetStart(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case 'all_time': return null;
    case 'this_year': return startOfYear(now);
    case 'this_month': return startOfMonth(now);
    case 'last_30_days': return subDays(now, 30);
    case 'last_90_days': return subDays(now, 90);
    case 'custom': return null;
  }
}

export function countLeadsForTotal(
  leads: ParsedLead[],
  metric: string | null,
  preset: DatePreset = 'all_time',
  customStart?: Date | null,
  customEnd?: Date | null,
  filters: string[] = [],
  criteria?: CriteriaFilter
): number {
  const start = preset === 'custom' ? (customStart ?? null) : presetStart(preset);
  const end = preset === 'custom' ? (customEnd ?? null) : null;
  return leads.filter((lead) => {
    const date = metric ? lead.tags.get(metric)?.applied ?? null : lead.createdDate;
    if (metric && !lead.tags.get(metric)?.applied) return false;
    if (start && (!date || isBefore(date, start))) return false;
    if (end && date && isAfter(date, end)) return false;
    if (criteria && criteria.conditions.length > 0) return evaluateCriteria(lead, criteria);
    for (const f of filters) {
      if (f === metric) continue;
      if (!lead.tags.get(f)?.applied) return false;
    }
    return true;
  }).length;
}

export function countLeadsWithFilters(leads: ParsedLead[], metric: string, filters: string[]): number {
  return leads.filter((lead) => {
    if (!lead.tags.get(metric)?.applied) return false;
    return filters.every((f) => f === metric || lead.tags.get(f)?.applied != null);
  }).length;
}

export interface CostSourceRow {
  tagLabel: string;
  name: string;
  applications: number;
  candidates: number;
  spend: number;
  costPerApp: number | null;
  costPerCandidate: number | null;
}

export interface CostMetricRow {
  weekOf: Date;
  weekLabel: string;
  sources: CostSourceRow[];
  organic: { applications: number; candidates: number };
  totals: {
    applications: number;
    candidates: number;
    spend: number;
    costPerApp: number | null;
    costPerCandidate: number | null;
  };
}

function resolvePreset(preset?: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case 'all_time': return null;
    case 'this_year': return startOfYear(now);
    case 'this_month': return startOfMonth(now);
    case 'last_30_days': return subDays(now, 30);
    case 'last_90_days': return subDays(now, 90);
    default: return null;
  }
}

export function computeCostMetrics(
  leads: ParsedLead[],
  spendData: SpendEntry[],
  tagGroups: TagGroup[],
  sourceGroupName: string,
  appTagLabel: string,
  query: Pick<ChartQuery, 'datePreset' | 'startDate' | 'endDate' | 'excludeRemoved'>
): CostMetricRow[] {
  const sourceGroup = tagGroups.find((g) => g.name === sourceGroupName);
  if (!sourceGroup) return [];

  const effectiveStart = query.datePreset && query.datePreset !== 'custom'
    ? resolvePreset(query.datePreset)
    : (query.startDate ?? null);
  const effectiveEnd = query.datePreset === 'custom' ? (query.endDate ?? null) : null;

  const filteredLeads = leads.filter((lead) => {
    const appEntry = appTagLabel ? lead.tags.get(appTagLabel) : null;
    const refDate = appEntry?.applied ?? lead.createdDate;
    if (!refDate) return false;
    if (effectiveStart && isBefore(refDate, effectiveStart)) return false;
    if (effectiveEnd && isAfter(refDate, effectiveEnd)) return false;
    return true;
  });

  if (filteredLeads.length === 0) return [];

  const appDates: Date[] = [];
  for (const lead of filteredLeads) {
    const appEntry = appTagLabel ? lead.tags.get(appTagLabel) : null;
    const d = appEntry?.applied ?? lead.createdDate;
    if (d) appDates.push(d);
  }

  if (appDates.length === 0) return [];

  const minDate = appDates.reduce((a, b) => (isBefore(a, b) ? a : b));
  const maxDate = appDates.reduce((a, b) => (isAfter(a, b) ? a : b));

  const weekStart = startOfWeek(minDate, { weekStartsOn: 1 });
  const weekEnd = startOfWeek(maxDate, { weekStartsOn: 1 });

  const weeks: Date[] = [];
  let cur = weekStart;
  while (!isAfter(cur, weekEnd)) {
    weeks.push(cur);
    cur = addWeeks(cur, 1);
  }

  const rows: CostMetricRow[] = [];

  for (const week of weeks) {
    const weekMs = week.getTime();
    const nextWeek = addWeeks(week, 1);

    const inWeek = (d: Date) => d.getTime() >= weekMs && d.getTime() < nextWeek.getTime();

    const weekApps = filteredLeads.filter((lead) => {
      if (!appTagLabel) return false;
      const appEntry = lead.tags.get(appTagLabel);
      if (!appEntry?.applied) return false;
      if (query.excludeRemoved && appEntry.removed != null) return false;
      return inWeek(appEntry.applied);
    });

    const weekCandidates = filteredLeads.filter((lead) => {
      const d = lead.createdDate;
      if (!d) return false;
      return inWeek(d);
    });

    if (weekApps.length === 0 && weekCandidates.length === 0) continue;

    const weekOfStr = format(week, 'yyyy-MM-dd');

    const sources: CostSourceRow[] = sourceGroup.tags.map((tag) => {
      const appCount = weekApps.filter((lead) => {
        for (const t of sourceGroup.tags) {
          const e = lead.tags.get(t.label);
          if (e?.applied) return t.label === tag.label;
        }
        return false;
      }).length;

      const candidateCount = weekCandidates.filter((lead) => {
        for (const t of sourceGroup.tags) {
          const e = lead.tags.get(t.label);
          if (e?.applied) return t.label === tag.label;
        }
        return false;
      }).length;

      const spend = spendData.find((e) => e.source === tag.label && e.weekOf === weekOfStr)?.amount ?? 0;
      const costPerApp = spend > 0 && appCount > 0 ? spend / appCount : null;
      const costPerCandidate = spend > 0 && candidateCount > 0 ? spend / candidateCount : null;

      return {
        tagLabel: tag.label,
        name: tag.tag,
        applications: appCount,
        candidates: candidateCount,
        spend,
        costPerApp,
        costPerCandidate,
      };
    });

    const organicApps = weekApps.filter((lead) => {
      return !sourceGroup.tags.some((t) => lead.tags.get(t.label)?.applied);
    }).length;

    const organicCandidates = weekCandidates.filter((lead) => {
      return !sourceGroup.tags.some((t) => lead.tags.get(t.label)?.applied);
    }).length;

    const totalApps = sources.reduce((s, r) => s + r.applications, 0) + organicApps;
    const totalCandidates = sources.reduce((s, r) => s + r.candidates, 0) + organicCandidates;
    const totalSpend = sources.reduce((s, r) => s + r.spend, 0);
    const totalCostPerApp = totalSpend > 0 && totalApps > 0 ? totalSpend / totalApps : null;
    const totalCostPerCandidate = totalSpend > 0 && totalCandidates > 0 ? totalSpend / totalCandidates : null;

    rows.push({
      weekOf: week,
      weekLabel: format(week, 'M/d/yy'),
      sources,
      organic: { applications: organicApps, candidates: organicCandidates },
      totals: {
        applications: totalApps,
        candidates: totalCandidates,
        spend: totalSpend,
        costPerApp: totalCostPerApp,
        costPerCandidate: totalCostPerCandidate,
      },
    });
  }

  return rows.sort((a, b) => a.weekOf.getTime() - b.weekOf.getTime());
}
