# Campaign Lead Reporting Dashboard

A configurable reporting dashboard for campaign lead data. Clients upload a CSV export from the lead management platform and the app renders interactive charts, filters, and comparison views across any tag groups and date ranges.

Deployed at [reporting.allstartalent.us](https://reporting.allstartalent.us).

---

## Architecture Overview

```
CSV upload
    │
    ▼
lib/csvParser.ts          ← data ingestion layer (swap this for DB integration)
    │  produces
    ▼
ParsedData (lib/types.ts) ← canonical in-memory representation
    │  consumed by
    ▼
Widget components         ← all chart/table rendering logic
    │
    ▼
WidgetShell + config      ← per-widget settings, saved to Redis
```

The key design principle is that **everything above `ParsedData` is DB-agnostic**. The CSV parser is the only layer that needs to change when connecting to the database directly.

---

## Data Layer

### CSV Format

The app accepts the standard department candidate CSV export:

```
Lead Id, First Name, Last Name, Full Name, Assigned To, Created Date, Activity Date, Email Address, Phone Number, [Group>Tag Applied UTC, Group>Tag Removed UTC, ...]
```

The header row is pre-processed by `normalizeUtmHeaders()` to handle alternate UTM column naming from direct-download exports before PapaParse sees it.

### Database Schema (source of truth)

The CSV is generated from these SQL Server tables:

```
DepartmentLeads   ← one row per candidate per department
    ├── LeadId            → Leads.Id
    ├── AssignedUserId    → Users
    ├── AssignedUserGroupId → UserGroups
    └── Created

DepartmentLeadTags ← one row per tag assignment (normalized)
    ├── DepartmentLeadId  → DepartmentLeads.Id
    ├── TagId             → Tags.Id
    ├── AppliedDate
    └── RemovedDate NULL

Tags               ← tag groups and assignable tags
    ├── ParentTagId NULL  (NULL = group; NOT NULL = assignable tag)
    ├── Name
    └── DepartmentId
```

A parent tag represents the tag group; a child tag is the assignable value:
```
Parent.Name > Child.Name
Status      > Active
```

### ParsedData Structure

`ParsedData` is what the entire app works off. It maps directly from the DB:

| `ParsedData` field | DB source |
|---|---|
| `leads[].leadId` | `Leads.Id` |
| `leads[].fullName` | `FirstName + ' ' + LastName` |
| `leads[].assigned` | `Users.FirstName/LastName` or `UserGroups.Name` |
| `leads[].createdDate` | `DepartmentLeads.Created` |
| `leads[].activityDate` | Latest `DepartmentLeadTags.AppliedDate` or `DepartmentLeads.Created` |
| `leads[].tags` | `DepartmentLeadTags` joined to `Tags` — keyed by `"Group > Tag"` label |
| `tagGroups[]` | `Tags WHERE ParentTagId IS NULL` with child tags nested |
| `tagColumns[]` | Flat list of all assignable tags with group metadata |
| `dateRange` | Min/max of all dates across leads |

Each entry in `leads[].tags` is a `Map<string, { applied: Date | null; removed: Date | null }>` where the key is `"TagGroup > Tag"`.

---

## Storage

| What | Where |
|---|---|
| CSV files | Vercel Blob (`@vercel/blob`) |
| Client metadata, chart configs, spend data | Upstash Redis (`@upstash/redis`) via `lib/redis.ts` |

Client records in Redis (`lib/redis.ts → ClientRecord`):
- `id`, `name`, `blobUrl`
- `tabs[]` — array of `ClientTab`, each with `chartConfigs[]`
- `spendData[]` — ad spend entries for cost-per-candidate calculations
- `lastUpdated`

---

## Widget System

Each chart type is a self-contained component in `components/`. Every widget receives:

```ts
{
  data: ParsedData      // full dataset
  config: ChartConfig   // saved settings (query, title, color, colSpan, etc.)
  accent: string        // theme color
  onUpdate: (id, patch) => void
  onRemove: (id) => void
  readOnly?: boolean    // true on the public share page
}
```

`ChartConfig.query` (`ChartQuery` in `lib/types.ts`) holds all filter/grouping state: metric tag, date range, group-by period, criteria filters, funnel stages, cost metric definitions, comparison series, etc.

Chart logic (aggregation, filtering, date bucketing) lives in `lib/dataProcessor.ts`.

### Widget Types

| `type` | Component | Description |
|---|---|---|
| `bar` (default) | `ChartPanel` | Bar or line chart, time series |
| `line` | `LineChartWidget` | Smooth line chart, time series |
| `column` | `ColumnChartWidget` | Horizontal bar chart |
| `stacked_bar` | `StackedBarWidget` | Stacked bars by tag group |
| `pie` | `PieChartWidget` | Pie/donut breakdown |
| `table` | `TableWidget` | Tabular data |
| `total` | `TotalWidget` | Single metric KPI card |
| `funnel` | `FunnelWidget` | Funnel / conversion stages |
| `cost` | `CostTableWidget` | Cost-per-candidate table |
| `cost_bar` | `CostBarWidget` | Cost-per-candidate bar chart |
| `comparison_bar` | `ComparisonBarWidget` | Side-by-side bars by tag facet |

---

## Public Share Page

`/share/[clientId]` renders a read-only view of a client's dashboard. Each widget has a `showInReport` flag (`ChartConfig.showInReport`) — when `false`, the widget is hidden on the share page but visible to admins. Defaults to `true` (shown).

---

## Migration to C# / Azure

When integrating directly with the database, the only file that needs replacing is **`lib/csvParser.ts`**. Everything else — all widgets, filters, chart logic, config storage — operates on `ParsedData` and does not know where the data came from.

The replacement would:
1. Query `DepartmentLeads` + `DepartmentLeadTags` + `Tags` for the selected department
2. Build a `ParsedData` object matching the interface in `lib/types.ts`
3. Return it to the client (or render server-side)

The rest of the app can be ported widget-by-widget using `lib/dataProcessor.ts` as the reference for all aggregation logic.

---

## Local Development

```bash
npm install
cp .env.example .env.local   # add BLOB_READ_WRITE_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
