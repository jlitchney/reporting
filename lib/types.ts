export interface TagColumn {
  tagGroup: string;
  tag: string;
  label: string;
  appliedCol: string;
  removedCol: string;
}

export interface ParsedLead {
  leadId: string;
  fullName: string;
  assigned: string;
  createdDate: Date | null;
  activityDate: Date | null;
  tags: Map<string, { applied: Date | null; removed: Date | null }>;
}

export interface TagGroup {
  name: string;
  tags: TagColumn[];
}

export interface ParsedData {
  clientName: string;
  tagColumns: TagColumn[];
  tagGroups: TagGroup[];
  leads: ParsedLead[];
  dateRange: { min: Date; max: Date };
}

export interface ChartDataPoint {
  period: string;
  count: number;
  periodStart: Date;
}

export type GroupBy = 'week' | 'month' | 'quarter';

export interface ChartQuery {
  metric: string | null;
  filters: string[];
  dateField: string;
  groupBy: GroupBy;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ChartConfig {
  id: string;
  title: string;
  query: ChartQuery;
}
