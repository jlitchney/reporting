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

export type GroupBy = 'day' | 'week' | 'month' | 'quarter';

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

export type WidgetType = 'total' | 'bar' | 'pie' | 'line' | 'column' | 'stacked_bar' | 'table' | 'funnel' | 'cost' | 'cost_bar' | 'cost_total' | 'comparison_bar';

export interface ComparisonSeries {
  id: string;
  label: string;
  tagLabel: string; // '' = no extra filter (count all leads with the position tag)
  color?: string;
}

export interface CostMetricDef {
  tagLabel: string;
  name: string;
  dateField?: string; // 'created' | tag label — overrides global dateField for this metric
  color?: string;
}

export type DatePreset = 'all_time' | 'this_year' | 'this_month' | 'last_30_days' | 'last_90_days' | 'today' | 'custom';

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
  funnelStageLabels?: Record<string, string>;
  costSourceGroup?: string;
  costMetric?: string;                       // legacy — use costMetricDefs
  costView?: 'applications' | 'candidates' | 'both'; // legacy
  costGroupBy?: 'week' | 'source';
  costMetricDefs?: CostMetricDef[];
  costSelectedMetric?: string;               // bar chart: which metric name to display
  costSourceFilters?: string[];              // tag labels within source group to include; empty/absent = all
  comparisonSeries?: ComparisonSeries[];
}

export interface ChartConfig {
  id: string;
  type?: WidgetType;
  title: string;
  query: ChartQuery;
  color?: string;
  colSpan?: 1 | 2 | 3 | 4;
  chartHeight?: number;
  seriesColors?: Record<string, string>;
  showInReport?: boolean; // undefined/true = shown on share page; false = hidden
}

export interface ClientTab {
  id: string;
  name: string;
  chartConfigs: ChartConfig[];
}

export type TextBlockPosition = 'left-half' | 'right-half' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ReportTextBlock {
  content: string;         // HTML string
  position: TextBlockPosition;
}

export interface ReportPage {
  id: string;
  type: 'chart' | 'summary' | 'notes';
  chartId?: string;   // for type='chart', references ChartConfig.id in the active tab
  chartId2?: string;  // second chart for 2-chart layout
  layout?: '1-chart' | '2-charts';  // defaults to '1-chart'
  title?: string;     // optional title override
  notesContent?: string;  // HTML string for notes type
  textBlock?: ReportTextBlock;  // optional narration overlay
}

export interface ReportConfig {
  reportName: string;         // used as PDF filename and display label
  tabId?: string;             // which tab this report is built from
  coverTitle: string;
  coverSubtitle: string;
  coverDateRange: string;
  coverBgColor: string;
  coverImageUrl?: string;
  clientLogoUrl?: string;     // shown top-right on every non-cover page
  pages: ReportPage[];
  takeaways: string;
  takeawaysBullets: string;
  takeawaysImageUrl?: string; // image shown on left half of takeaways page
}

export interface ReportHistoryEntry {
  id: string;
  savedAt: string;   // ISO timestamp
  label: string;     // e.g. "7/13/2026 - 7/19/2026" (coverDateRange)
  config: ReportConfig;
}
