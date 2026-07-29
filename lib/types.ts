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
  periodStart?: Date;
}

export type GroupBy = 'week' | 'month' | 'quarter';

export type FilterOperator = 'currently_applied' | 'ever_applied' | 'removed' | 'never_applied';
export type FilterLogicOp = 'AND' | 'OR';

export interface FilterCondition {
  id: string;
  tag: string;
  operator: FilterOperator;
}

export interface CriteriaFilter {
  conditions: FilterCondition[];
  logic: FilterLogicOp[]; // length = conditions.length - 1; logic[i] connects condition[i] and condition[i+1]
}

export type WidgetType = 'total' | 'bar' | 'pie' | 'line' | 'column' | 'stacked_bar' | 'table' | 'funnel';

export type DatePreset = 'all_time' | 'this_year' | 'this_month' | 'last_30_days' | 'last_90_days' | 'custom';

export interface ChartQuery {
  metric: string | null;
  filters: string[];
  criteria?: CriteriaFilter;
  dateField: string;
  groupBy: GroupBy;
  tagGroupAxis?: string; // if set, X axis shows tags within this group instead of time periods
  excludeRemoved?: boolean; // if true, only count leads where the metric tag has no Removed UTC
  startDate: Date | null;
  endDate: Date | null;
  datePreset?: DatePreset;
  funnelStages?: string[];
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
