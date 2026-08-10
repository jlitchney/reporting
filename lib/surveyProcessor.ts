import type { MockCandidate, MockSurvey, MockSurveyResponse, MockQuestion } from './mockData';
import { filterCandidatesByMultiTag } from './mockData';
import { format, startOfMonth, isWithinInterval, addMonths } from 'date-fns';

function csvCell(val: unknown): string {
  const s = Array.isArray(val) ? val.join('; ') : String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function exportSurveyToCSV(
  responses: MockSurveyResponse[],
  survey: MockSurvey,
  allCandidates: MockCandidate[]
): string {
  const candidateMap = new Map(allCandidates.map((c) => [c.id, c]));

  const tagVal = (c: MockCandidate, group: string) =>
    c.tags.find((t) => t.startsWith(`${group} > `))?.slice(group.length + 3) ?? '';

  const headers = [
    'Response ID',
    'Candidate Name',
    'Position',
    'Source',
    'Stage',
    'Completed At',
    ...survey.questions.map((q) => q.text),
  ];

  const rows = responses.map((r) => {
    const c = candidateMap.get(r.candidateId);
    return [
      r.id,
      c?.name ?? '',
      c ? tagVal(c, 'Position') : '',
      c ? tagVal(c, 'Source') : '',
      c ? tagVal(c, 'Stage') : '',
      format(r.completedAt, 'yyyy-MM-dd'),
      ...survey.questions.map((q) => r.answers[q.id] ?? ''),
    ].map(csvCell).join(',');
  });

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

export interface SurveyFilters {
  sentStartDate: Date | null;
  sentEndDate: Date | null;
  responseStartDate: Date | null;
  responseEndDate: Date | null;
  tagFilters: Record<string, string[]>; // group -> selected tags; OR within group, AND across
  surveyId: string;
}

export interface SurveyMetrics {
  totalResponses: number;
  eligibleCandidates: number;
  completionRate: number;
}

export interface ResponseTimePoint {
  period: string;
  count: number;
}

export interface QuestionResult {
  questionId: string;
  text: string;
  type: string;
  // for single/multiple choice:
  distribution?: { label: string; count: number }[];
  // for number:
  avg?: number;
  min?: number;
  max?: number;
  histogram?: { label: string; count: number }[];
  // for text:
  samples?: string[];
  // for date:
  earliest?: string;
  latest?: string;
}

export function filterResponses(
  allCandidates: MockCandidate[],
  allResponses: MockSurveyResponse[],
  filters: SurveyFilters
): MockSurveyResponse[] {
  const filteredCandidates = filterCandidatesByMultiTag(allCandidates, filters.tagFilters);
  const candidateIdSet = new Set(filteredCandidates.map((c) => c.id));

  return allResponses.filter((resp) => {
    if (resp.surveyId !== filters.surveyId) return false;
    if (!candidateIdSet.has(resp.candidateId)) return false;

    // Sent date filter
    if (filters.sentStartDate && filters.sentEndDate) {
      if (!isWithinInterval(resp.sentAt, { start: filters.sentStartDate, end: filters.sentEndDate })) return false;
    } else if (filters.sentStartDate) {
      if (resp.sentAt < filters.sentStartDate) return false;
    } else if (filters.sentEndDate) {
      if (resp.sentAt > filters.sentEndDate) return false;
    }

    // Response received date filter
    if (filters.responseStartDate && filters.responseEndDate) {
      if (!isWithinInterval(resp.completedAt, { start: filters.responseStartDate, end: filters.responseEndDate })) return false;
    } else if (filters.responseStartDate) {
      if (resp.completedAt < filters.responseStartDate) return false;
    } else if (filters.responseEndDate) {
      if (resp.completedAt > filters.responseEndDate) return false;
    }

    return true;
  });
}

export function computeSurveyMetrics(
  responses: MockSurveyResponse[],
  allCandidates: MockCandidate[],
  filters: SurveyFilters,
  surveys: MockSurvey[]
): SurveyMetrics {
  const filteredCandidates = filterCandidatesByMultiTag(allCandidates, filters.tagFilters);

  // Eligible = candidates who have any response for this survey (before date filter),
  // intersected with tag-filtered candidates
  const allSurveyResponses = (surveys.find((s) => s.id === filters.surveyId) ? responses : []);
  // Use passed responses (already filtered by survey + tag)
  // But eligibleCandidates should be tag-filtered candidates count
  const eligibleCandidates = filteredCandidates.length;
  const totalResponses = responses.length;
  const completionRate = eligibleCandidates > 0 ? (totalResponses / eligibleCandidates) * 100 : 0;

  return { totalResponses, eligibleCandidates, completionRate };
}

export function buildResponseTimeSeries(responses: MockSurveyResponse[]): ResponseTimePoint[] {
  if (responses.length === 0) return [];

  const dates = responses.map((r) => r.completedAt);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const periodStart = startOfMonth(minDate);
  const periodEnd = startOfMonth(maxDate);

  const map = new Map<string, number>();
  for (const resp of responses) {
    const label = format(startOfMonth(resp.completedAt), 'MMM yyyy');
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  const result: ResponseTimePoint[] = [];
  let cur = periodStart;
  while (cur <= periodEnd) {
    const label = format(cur, 'MMM yyyy');
    result.push({ period: label, count: map.get(label) ?? 0 });
    cur = addMonths(cur, 1);
  }

  return result;
}

export function computeQuestionResults(
  responses: MockSurveyResponse[],
  survey: MockSurvey
): QuestionResult[] {
  return survey.questions.map((q: MockQuestion): QuestionResult => {
    const base = { questionId: q.id, text: q.text, type: q.type };

    if (q.type === 'single_choice') {
      const counts = new Map<string, number>();
      if (q.options) for (const opt of q.options) counts.set(opt, 0);
      for (const resp of responses) {
        const val = resp.answers[q.id];
        if (typeof val === 'string') counts.set(val, (counts.get(val) ?? 0) + 1);
      }
      return {
        ...base,
        distribution: Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
      };
    }

    if (q.type === 'multiple_choice') {
      const counts = new Map<string, number>();
      if (q.options) for (const opt of q.options) counts.set(opt, 0);
      for (const resp of responses) {
        const val = resp.answers[q.id];
        if (Array.isArray(val)) {
          for (const v of val) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }
      return {
        ...base,
        distribution: Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
      };
    }

    if (q.type === 'number') {
      const nums = responses
        .map((r) => r.answers[q.id])
        .filter((v): v is number => typeof v === 'number');

      if (nums.length === 0) {
        return { ...base, avg: 0, min: 0, max: 0, histogram: [] };
      }

      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);

      // Build 5 equal-width buckets
      const range = max - min || 1;
      const bucketSize = range / 5;
      const buckets = Array.from({ length: 5 }, (_, i) => {
        const lo = min + i * bucketSize;
        const hi = min + (i + 1) * bucketSize;
        const label = i < 4
          ? `${Math.round(lo)}–${Math.round(hi - 1)}`
          : `${Math.round(lo)}–${Math.round(hi)}`;
        return { label, lo, hi, count: 0 };
      });

      for (const n of nums) {
        let bi = Math.floor((n - min) / bucketSize);
        if (bi >= 5) bi = 4;
        buckets[bi].count++;
      }

      return {
        ...base,
        avg: Math.round(avg * 10) / 10,
        min,
        max,
        histogram: buckets.map(({ label, count }) => ({ label, count })),
      };
    }

    if (q.type === 'short_text' || q.type === 'long_text') {
      const maxSamples = q.type === 'long_text' ? 4 : 6;
      const samples = responses
        .map((r) => r.answers[q.id])
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .slice(0, maxSamples);
      return { ...base, samples };
    }

    if (q.type === 'date') {
      const datestrs = responses
        .map((r) => r.answers[q.id])
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .sort();
      return {
        ...base,
        earliest: datestrs[0] ?? '—',
        latest: datestrs[datestrs.length - 1] ?? '—',
      };
    }

    return base;
  });
}

export interface PassFailTimePoint {
  period: string;
  passed: number;
  failed: number;
}

export function buildPassFailTimeSeries(
  responses: MockSurveyResponse[],
  survey: MockSurvey
): PassFailTimePoint[] {
  if (survey.evaluationMode !== 'pass_fail' || responses.length === 0) return [];

  const gradable = survey.questions.filter((q) => q.correctOption !== undefined);
  if (gradable.length === 0) return [];

  const isPass = (resp: MockSurveyResponse) =>
    gradable.every((q) => resp.answers[q.id] === q.correctOption);

  const map = new Map<string, { passed: number; failed: number }>();
  for (const resp of responses) {
    const label = format(startOfMonth(resp.completedAt), 'MMM yyyy');
    if (!map.has(label)) map.set(label, { passed: 0, failed: 0 });
    const entry = map.get(label)!;
    if (isPass(resp)) entry.passed++;
    else entry.failed++;
  }

  const dates = responses.map((r) => r.completedAt);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const periodStart = startOfMonth(minDate);
  const periodEnd = startOfMonth(maxDate);

  const result: PassFailTimePoint[] = [];
  let cur = periodStart;
  while (cur <= periodEnd) {
    const label = format(cur, 'MMM yyyy');
    const entry = map.get(label) ?? { passed: 0, failed: 0 };
    result.push({ period: label, ...entry });
    cur = addMonths(cur, 1);
  }
  return result;
}

export interface QuestionFailRate {
  questionId: string;
  text: string;
  failCount: number;
  failRate: number; // 0–100
}

export interface PassFailStats {
  passed: number;
  failed: number;
  passRate: number;
  failRate: number;
  questionFailRates: QuestionFailRate[]; // sorted descending by failRate
}

export function computePassFailStats(
  responses: MockSurveyResponse[],
  survey: MockSurvey
): PassFailStats | null {
  if (survey.evaluationMode !== 'pass_fail') return null;

  const gradable = survey.questions.filter((q) => q.correctOption !== undefined);
  if (gradable.length === 0) return null;

  const failCounts = new Map<string, number>(gradable.map((q) => [q.id, 0]));
  let passed = 0;
  let failed = 0;

  for (const resp of responses) {
    let allCorrect = true;
    for (const q of gradable) {
      if (resp.answers[q.id] !== q.correctOption) {
        allCorrect = false;
        failCounts.set(q.id, (failCounts.get(q.id) ?? 0) + 1);
      }
    }
    if (allCorrect) passed++;
    else failed++;
  }

  const total = responses.length;
  return {
    passed,
    failed,
    passRate: total > 0 ? (passed / total) * 100 : 0,
    failRate: total > 0 ? (failed / total) * 100 : 0,
    questionFailRates: gradable
      .map((q) => ({
        questionId: q.id,
        text: q.text,
        failCount: failCounts.get(q.id) ?? 0,
        failRate: total > 0 ? ((failCounts.get(q.id) ?? 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.failRate - a.failRate),
  };
}
