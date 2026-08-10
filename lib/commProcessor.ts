import { format, startOfWeek, startOfMonth, isWithinInterval, addWeeks, addMonths } from 'date-fns';
import type { MockCandidate, MockMessage } from './mockData';
import { filterCandidatesByTag } from './mockData';

export interface CommFilters {
  startDate: Date | null;
  endDate: Date | null;
  tagGroup: string | null;
  tag: string | null;
  campaign: string | null; // null = all, 'individual' = no campaign
  type: 'all' | 'email' | 'sms';
  direction: 'all' | 'outbound' | 'inbound';
  groupBy: 'week' | 'month';
}

export interface CommMetrics {
  total: number;
  outbound: number;
  inbound: number;
  openRate: number;
  replyRate: number;
  candidatesReached: number;
}

export interface TimeSeriesPoint {
  period: string;
  emailOut: number;
  smsOut: number;
  emailIn: number;
  smsIn: number;
  total: number;
}

export interface CampaignStat {
  name: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  bounced: number;
  openRate: string;
  replyRate: string;
  bounceRate: string;
}

export function filterMessages(
  allCandidates: MockCandidate[],
  allMessages: MockMessage[],
  filters: CommFilters
): MockMessage[] {
  const filteredCandidates = filterCandidatesByTag(allCandidates, filters.tagGroup, filters.tag);
  const candidateIdSet = new Set(filteredCandidates.map((c) => c.id));

  return allMessages.filter((msg) => {
    // Candidate filter
    if (!candidateIdSet.has(msg.candidateId)) return false;

    // Date filter
    if (filters.startDate && filters.endDate) {
      if (!isWithinInterval(msg.date, { start: filters.startDate, end: filters.endDate })) return false;
    } else if (filters.startDate) {
      if (msg.date < filters.startDate) return false;
    } else if (filters.endDate) {
      if (msg.date > filters.endDate) return false;
    }

    // Campaign filter
    if (filters.campaign !== null) {
      if (filters.campaign === 'individual') {
        if (msg.campaign !== null) return false;
      } else {
        if (msg.campaign !== filters.campaign) return false;
      }
    }

    // Type filter
    if (filters.type !== 'all' && msg.type !== filters.type) return false;

    // Direction filter
    if (filters.direction !== 'all' && msg.direction !== filters.direction) return false;

    return true;
  });
}

export function computeCommMetrics(messages: MockMessage[], candidateIds: Set<string>): CommMetrics {
  const total = messages.length;
  const outbound = messages.filter((m) => m.direction === 'outbound').length;
  const inbound = messages.filter((m) => m.direction === 'inbound').length;

  const outboundEmails = messages.filter((m) => m.direction === 'outbound' && m.type === 'email');
  const opened = outboundEmails.filter((m) => m.status === 'opened' || m.status === 'replied').length;
  const replied = outboundEmails.filter((m) => m.status === 'replied').length;

  const openRate = outboundEmails.length > 0 ? (opened / outboundEmails.length) * 100 : 0;
  const replyRate = outboundEmails.length > 0 ? (replied / outboundEmails.length) * 100 : 0;

  const reachedIds = new Set(messages.map((m) => m.candidateId));
  const candidatesReached = [...reachedIds].filter((id) => candidateIds.has(id)).length;

  return { total, outbound, inbound, openRate, replyRate, candidatesReached };
}

export function buildTimeSeries(messages: MockMessage[], groupBy: 'week' | 'month'): TimeSeriesPoint[] {
  if (messages.length === 0) return [];

  const dates = messages.map((m) => m.date);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const periodStart = groupBy === 'week' ? startOfWeek(minDate, { weekStartsOn: 0 }) : startOfMonth(minDate);
  const periodEnd = groupBy === 'week' ? startOfWeek(maxDate, { weekStartsOn: 0 }) : startOfMonth(maxDate);

  // Build map of period label -> counts
  const map = new Map<string, { emailOut: number; smsOut: number; emailIn: number; smsIn: number }>();

  for (const msg of messages) {
    const periodDate = groupBy === 'week'
      ? startOfWeek(msg.date, { weekStartsOn: 0 })
      : startOfMonth(msg.date);
    const label = groupBy === 'week'
      ? format(periodDate, 'MMM d')
      : format(periodDate, 'MMM yyyy');

    if (!map.has(label)) map.set(label, { emailOut: 0, smsOut: 0, emailIn: 0, smsIn: 0 });
    const entry = map.get(label)!;
    if (msg.direction === 'outbound' && msg.type === 'email') entry.emailOut++;
    else if (msg.direction === 'outbound' && msg.type === 'sms') entry.smsOut++;
    else if (msg.direction === 'inbound' && msg.type === 'email') entry.emailIn++;
    else if (msg.direction === 'inbound' && msg.type === 'sms') entry.smsIn++;
  }

  // Fill gaps between periodStart and periodEnd
  const result: TimeSeriesPoint[] = [];
  let cur = periodStart;
  while (cur <= periodEnd) {
    const label = groupBy === 'week'
      ? format(cur, 'MMM d')
      : format(cur, 'MMM yyyy');
    const entry = map.get(label) ?? { emailOut: 0, smsOut: 0, emailIn: 0, smsIn: 0 };
    result.push({
      period: label,
      ...entry,
      total: entry.emailOut + entry.smsOut + entry.emailIn + entry.smsIn,
    });
    cur = groupBy === 'week' ? addWeeks(cur, 1) : addMonths(cur, 1);
  }

  return result;
}

export function buildCampaignStats(messages: MockMessage[]): CampaignStat[] {
  // Group by campaign name; null campaign = 'Individual'
  const map = new Map<string, { sent: number; delivered: number; opened: number; replied: number; bounced: number }>();

  for (const msg of messages) {
    if (msg.direction !== 'outbound') continue;
    const key = msg.campaign ?? 'Individual Messages';
    if (!map.has(key)) map.set(key, { sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0 });
    const entry = map.get(key)!;
    entry.sent++;
    if (msg.status === 'bounced') entry.bounced++;
    else if (msg.status === 'delivered') entry.delivered++;
    else if (msg.status === 'opened') { entry.delivered++; entry.opened++; }
    else if (msg.status === 'replied') { entry.delivered++; entry.opened++; entry.replied++; }
  }

  const stats: CampaignStat[] = [];
  for (const [name, s] of map.entries()) {
    const deliveredEmails = s.delivered + s.opened + s.replied;
    stats.push({
      name,
      sent: s.sent,
      delivered: deliveredEmails,
      opened: s.opened + s.replied,
      replied: s.replied,
      bounced: s.bounced,
      openRate: deliveredEmails > 0 ? `${((s.opened + s.replied) / deliveredEmails * 100).toFixed(1)}%` : '—',
      replyRate: deliveredEmails > 0 ? `${(s.replied / deliveredEmails * 100).toFixed(1)}%` : '—',
      bounceRate: s.sent > 0 ? `${(s.bounced / s.sent * 100).toFixed(1)}%` : '—',
    });
  }

  // Sort: named campaigns first (by name), then Individual
  stats.sort((a, b) => {
    if (a.name === 'Individual Messages') return 1;
    if (b.name === 'Individual Messages') return -1;
    return a.name.localeCompare(b.name);
  });

  return stats;
}

export function getCampaigns(messages: MockMessage[]): string[] {
  const set = new Set<string>();
  for (const msg of messages) {
    if (msg.campaign) set.add(msg.campaign);
  }
  return Array.from(set).sort();
}
