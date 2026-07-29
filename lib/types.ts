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

export type WidgetType = 'total' | 'bar';

export type DatePreset = 'all_time' | 'this_year' | 'this_month' | 'last_30_days' | 'last_90_days';

export interface ChartQuery {
  metric: string | null;
  filters: string[];
  dateField: string;
  groupBy: GroupBy;
  startDate: Date | null;
  endDate: Date | null;
  datePreset?: DatePreset;
}

export interface ChartConfig {
  id: string;
  type?: WidgetType;
  title: string;
  query: ChartQuery;
}

export interface ClientTab {
  id: string;
  name: string;
  chartConfigs: ChartConfig[];
}
