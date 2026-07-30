'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChartConfig, ClientTab, ParsedData, TextBlockPosition, ReportTextBlock } from '@/lib/types';
import type { ReportConfig, ReportPage, ReportHistoryEntry } from '@/lib/types';
import type { StoredClient, SpendEntry } from '@/lib/useClients';
import { generatePdf } from '@/lib/generatePdf';
import { CHART_ACCENT_COLORS } from '@/components/ChartPanel';
import ChartPanel from '@/components/ChartPanel';
import TotalWidget from '@/components/TotalWidget';
import LineChartWidget from '@/components/LineChartWidget';
import PieChartWidget from '@/components/PieChartWidget';
import ColumnChartWidget from '@/components/ColumnChartWidget';
import StackedBarWidget from '@/components/StackedBarWidget';
import TableWidget from '@/components/TableWidget';
import FunnelWidget from '@/components/FunnelWidget';
import CostTableWidget from '@/components/CostTableWidget';
import CostBarWidget from '@/components/CostBarWidget';
import ComparisonBarWidget from '@/components/ComparisonBarWidget';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  client: StoredClient;
  activeTab: ClientTab;
  parsedData: ParsedData;
  spendData: SpendEntry[];
  onClose: () => void;
  onSave: (config: ReportConfig) => void;
  onAddHistory: (entry: ReportHistoryEntry) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => {};

function getWeekRange(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function accentForWidget(widget: ChartConfig, allWidgets: ChartConfig[]): string {
  if (widget.color) return widget.color;
  const idx = allWidgets.findIndex((w) => w.id === widget.id);
  return CHART_ACCENT_COLORS[Math.max(0, idx) % CHART_ACCENT_COLORS.length];
}

function buildDefaultConfig(client: StoredClient, tab: ClientTab): ReportConfig {
  const nonTotalCharts = tab.chartConfigs.filter(
    (w) => (w.type ?? 'bar') !== 'total' && w.showInReport !== false
  );
  const pages: ReportPage[] = [
    { id: 'page-summary', type: 'summary' },
    ...nonTotalCharts.map((w) => ({
      id: `page-chart-${w.id}`,
      type: 'chart' as const,
      chartId: w.id,
    })),
  ];
  return {
    reportName: `${client.name} — ${tab.name} Report`,
    tabId: tab.id,
    coverTitle: 'Weekly Report',
    coverSubtitle: client.name,
    coverDateRange: getWeekRange(),
    coverBgColor: '#1e3a6e',
    pages,
    takeaways: '',
    takeawaysBullets: '',
  };
}

// ---------------------------------------------------------------------------
// renderWidget — same switch pattern as app/page.tsx
// ---------------------------------------------------------------------------

function renderWidget(
  config: ChartConfig,
  data: ParsedData,
  accent: string,
  spendData: SpendEntry[]
): React.ReactNode {
  const commonProps = {
    data,
    config,
    accent,
    onUpdate: noop as (id: string, updates: Partial<ChartConfig>) => void,
    onRemove: noop,
    canRemove: false as const,
    readOnly: true,
  };
  switch (config.type ?? 'bar') {
    case 'line':          return <LineChartWidget {...commonProps} />;
    case 'pie':           return <PieChartWidget {...commonProps} />;
    case 'column':        return <ColumnChartWidget {...commonProps} />;
    case 'stacked_bar':   return <StackedBarWidget {...commonProps} />;
    case 'table':         return <TableWidget {...commonProps} />;
    case 'funnel':        return <FunnelWidget {...commonProps} />;
    case 'cost_bar':      return <CostBarWidget {...commonProps} spendData={spendData} />;
    case 'cost':          return <CostTableWidget {...commonProps} spendData={spendData} />;
    case 'comparison_bar':return <ComparisonBarWidget {...commonProps} />;
    default:              return <ChartPanel {...commonProps} />;
  }
}

// ---------------------------------------------------------------------------
// Page footer
// ---------------------------------------------------------------------------

function PageFooter({
  clientName,
  pageNum,
  totalPages,
}: {
  clientName: string;
  pageNum: number;
  totalPages: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 40px',
        borderTop: '1px solid #f1f5f9',
      }}
    >
      <img
        src="/logo-black.png"
        alt=""
        style={{ height: 20 }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{clientName}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>
        {pageNum} / {totalPages}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

function CoverPageRender({ config }: { config: ReportConfig }) {
  const hasCoverImage = !!config.coverImageUrl;

  return (
    <div
      style={{
        width: 1056,
        height: 816,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...(hasCoverImage
          ? {
              backgroundImage: `url(${config.coverImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { backgroundColor: config.coverBgColor }),
      }}
    >
      {/* Dark overlay when cover image is set */}
      {hasCoverImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
      )}

      {/* Logo top-right */}
      <img
        src="/logo-white.png"
        alt=""
        style={{ position: 'absolute', top: 40, right: 40, height: 32, zIndex: 1 }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.025em',
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          {config.coverTitle.split(' ').map((word, i) => (
            <div key={i}>{word}</div>
          ))}
        </div>
        <div
          style={{
            fontSize: 20,
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 32,
          }}
        >
          {config.coverSubtitle}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
          {config.coverDateRange}
        </div>
      </div>
      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: 'rgba(255,255,255,0.2)',
          zIndex: 1,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary page
// ---------------------------------------------------------------------------

function SummaryPageRender({
  config,
  activeTab,
  parsedData,
  accent,
  pageNum,
  totalPages,
  clientLogoUrl,
}: {
  config: ReportConfig;
  activeTab: ClientTab;
  parsedData: ParsedData;
  accent: string;
  pageNum: number;
  totalPages: number;
  clientLogoUrl?: string;
}) {
  const totalWidgets = activeTab.chartConfigs.filter(
    (w) => (w.type ?? 'bar') === 'total'
  );

  return (
    <div
      style={{
        width: 1056,
        height: 816,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ height: 8, backgroundColor: accent }} />
      <div
        style={{
          padding: '24px 40px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#334155',
            margin: 0,
          }}
        >
          Campaign at a Glance
        </h1>
        {clientLogoUrl && (
          <img
            src={clientLogoUrl}
            alt=""
            style={{ height: 36, objectFit: 'contain', maxWidth: 160 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div style={{ flex: 1, padding: 40 }}>
        {totalWidgets.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 24,
            }}
          >
            {totalWidgets.map((w) => (
              <TotalWidget
                key={w.id}
                data={parsedData}
                config={w}
                accent={accentForWidget(w, activeTab.chartConfigs)}
                onUpdate={noop as (id: string, updates: Partial<ChartConfig>) => void}
                onRemove={noop}
                readOnly
              />
            ))}
          </div>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            No KPI widgets found in this tab.
          </p>
        )}
      </div>
      <PageFooter
        clientName={config.coverSubtitle}
        pageNum={pageNum}
        totalPages={totalPages}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart page (1-chart and 2-chart layouts)
// ---------------------------------------------------------------------------

function ChartPageRender({
  config,
  page,
  chartConfig,
  chartConfig2,
  pageTitle,
  parsedData,
  accent,
  spendData,
  pageNum,
  totalPages,
  clientLogoUrl,
}: {
  config: ReportConfig;
  page: ReportPage;
  chartConfig: ChartConfig;
  chartConfig2?: ChartConfig;
  pageTitle: string;
  parsedData: ParsedData;
  accent: string;
  spendData: SpendEntry[];
  pageNum: number;
  totalPages: number;
  clientLogoUrl?: string;
}) {
  const layout = page.layout ?? '1-chart';
  const isTwoChart = layout === '2-charts' && !!chartConfig2;

  if (isTwoChart) {
    const enlarged1: ChartConfig = { ...chartConfig, chartHeight: 480, colSpan: 4 };
    const enlarged2: ChartConfig = { ...chartConfig2, chartHeight: 480, colSpan: 4 };
    const accent2 = accentForWidget(chartConfig2, [chartConfig2]);

    return (
      <div
        style={{
          width: 1056,
          height: 816,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ height: 8, backgroundColor: accent }} />
        <div style={{ padding: '20px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#334155',
              margin: 0,
            }}
          >
            {pageTitle}
          </h1>
          {clientLogoUrl && (
            <img
              src={clientLogoUrl}
              alt=""
              style={{ height: 32, objectFit: 'contain', maxWidth: 140 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            padding: '12px 16px',
            overflow: 'hidden',
            display: 'flex',
            gap: 16,
          }}
        >
          <div style={{ flex: '0 0 496px', width: 496, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {chartConfig.title}
            </div>
            <div style={{ flex: 1 }}>
              {renderWidget(enlarged1, parsedData, accent, spendData)}
            </div>
          </div>
          <div style={{ flex: '0 0 496px', width: 496, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {chartConfig2.title}
            </div>
            <div style={{ flex: 1 }}>
              {renderWidget(enlarged2, parsedData, accent2, spendData)}
            </div>
          </div>
        </div>
        <PageFooter
          clientName={config.coverSubtitle}
          pageNum={pageNum}
          totalPages={totalPages}
        />
      </div>
    );
  }

  // 1-chart layout
  const textBlock = page.textBlock;
  const hasHalfText = textBlock && (textBlock.position === 'left-half' || textBlock.position === 'right-half');
  const chartHeight = hasHalfText ? 520 : 560;
  const enlarged: ChartConfig = { ...chartConfig, chartHeight, colSpan: 4 };

  const textPanelStyle: React.CSSProperties = {
    width: 480,
    flexShrink: 0,
    padding: '20px 24px',
    overflow: 'hidden',
    fontSize: 13,
    lineHeight: 1.65,
    color: '#1e293b',
  };

  const cornerPositions: Record<string, React.CSSProperties> = {
    'top-left':     { top: 12, left: 12 },
    'top-right':    { top: 12, right: 12 },
    'bottom-left':  { bottom: 12, left: 12 },
    'bottom-right': { bottom: 12, right: 12 },
  };

  return (
    <div
      style={{
        width: 1056,
        height: 816,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ height: 8, backgroundColor: accent }} />
      <div
        style={{
          padding: '20px 40px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#334155',
            margin: 0,
          }}
        >
          {pageTitle}
        </h1>
        {clientLogoUrl && (
          <img
            src={clientLogoUrl}
            alt=""
            style={{ height: 32, objectFit: 'contain', maxWidth: 140 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>

      {/* Content area */}
      {hasHalfText ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {textBlock.position === 'left-half' && (
            <div style={{ ...textPanelStyle, borderRight: '1px solid #f1f5f9' }}
              dangerouslySetInnerHTML={{ __html: textBlock.content }} />
          )}
          <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px' }}>
            {renderWidget(enlarged, parsedData, accent, spendData)}
          </div>
          {textBlock.position === 'right-half' && (
            <div style={{ ...textPanelStyle, borderLeft: '1px solid #f1f5f9' }}
              dangerouslySetInnerHTML={{ __html: textBlock.content }} />
          )}
        </div>
      ) : (
        <div style={{ flex: 1, padding: '16px 24px', overflow: 'hidden', position: 'relative' }}>
          {renderWidget(enlarged, parsedData, accent, spendData)}
          {textBlock && textBlock.content && cornerPositions[textBlock.position] && (
            <div
              style={{
                position: 'absolute',
                ...cornerPositions[textBlock.position],
                width: 260,
                maxHeight: 200,
                backgroundColor: 'rgba(255,255,255,0.96)',
                borderRadius: 6,
                padding: '12px 14px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                fontSize: 12,
                lineHeight: 1.55,
                color: '#1e293b',
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: textBlock.content }}
            />
          )}
        </div>
      )}

      <PageFooter
        clientName={config.coverSubtitle}
        pageNum={pageNum}
        totalPages={totalPages}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes page
// ---------------------------------------------------------------------------

function NotesPageRender({
  page,
  accent,
  pageNum,
  totalPages,
  clientName,
  clientLogoUrl,
}: {
  page: ReportPage;
  accent: string;
  pageNum: number;
  totalPages: number;
  clientName: string;
  clientLogoUrl?: string;
}) {
  return (
    <div
      style={{
        width: 1056,
        height: 816,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ height: 8, backgroundColor: accent, flexShrink: 0 }} />
      {clientLogoUrl && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 40px 0', flexShrink: 0 }}>
          <img
            src={clientLogoUrl}
            alt=""
            style={{ height: 32, objectFit: 'contain', maxWidth: 140 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div
        style={{ flex: 1, padding: clientLogoUrl ? '16px 48px 32px' : '32px 48px', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{
          __html: page.notesContent ?? '<p style="color:#94a3b8">Notes page — add content in the editor.</p>',
        }}
      />
      <PageFooter clientName={clientName} pageNum={pageNum} totalPages={totalPages} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Takeaways page
// ---------------------------------------------------------------------------

function TakeawaysPageRender({
  config,
  accent,
  pageNum,
  totalPages,
  clientLogoUrl,
}: {
  config: ReportConfig;
  accent: string;
  pageNum: number;
  totalPages: number;
  clientLogoUrl?: string;
}) {
  const bullets = config.takeawaysBullets ? config.takeawaysBullets.split('\n') : [];
  const hasImage = !!config.takeawaysImageUrl;

  // ---- Image layout (matches reference: photo left, text right) ----
  if (hasImage) {
    return (
      <div
        style={{
          width: 1056,
          height: 816,
          display: 'flex',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Left: photo */}
        <div
          style={{
            width: 400,
            flexShrink: 0,
            backgroundImage: `url(${config.takeawaysImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Right: content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px 32px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <h1
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: '#0f172a',
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Takeaways
            </h1>
            {clientLogoUrl && (
              <img
                src={clientLogoUrl}
                alt=""
                style={{ height: 48, objectFit: 'contain', maxWidth: 160, marginTop: 4 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div style={{ height: 3, backgroundColor: '#0f172a', marginBottom: 28 }} />

          {/* Narrative */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {config.takeaways ? (
              <p
                style={{
                  fontSize: 14,
                  color: '#334155',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-line',
                  margin: 0,
                }}
              >
                {config.takeaways}
              </p>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Add your takeaways in the editor panel.</p>
            )}
          </div>

          {/* Bottom: AST logo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <img
              src="/logo-black.png"
              alt=""
              style={{ height: 22 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---- Original colored-panel layout (no image) ----
  return (
    <div
      style={{
        width: 1056,
        height: 816,
        display: 'flex',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left column */}
      <div
        style={{
          width: 256,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: accent,
        }}
      >
        <div style={{ padding: '32px 32px 0 32px', flex: 1 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1.2,
              marginBottom: 32,
              marginTop: 16,
            }}
          >
            Take-
            <br />
            aways
          </h1>
          {bullets.map(
            (b, i) =>
              b.trim() && (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div
                    style={{
                      marginTop: 6,
                      height: 6,
                      width: 6,
                      flexShrink: 0,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.6)',
                    }}
                  />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, margin: 0 }}>
                    {b.trim()}
                  </p>
                </div>
              )
          )}
        </div>
        <div style={{ padding: 24 }}>
          <img
            src="/logo-white.png"
            alt=""
            style={{ height: 24 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </div>
      {/* Right column */}
      <div style={{ flex: 1, padding: 40, display: 'flex', flexDirection: 'column' }}>
        {clientLogoUrl && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <img
              src={clientLogoUrl}
              alt=""
              style={{ height: 32, objectFit: 'contain', maxWidth: 140 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
            {config.takeaways || 'Add your takeaways in the editor panel.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color palette for cover background picker / notes font color
// ---------------------------------------------------------------------------

const BG_COLORS = [
  '#1e3a6e',
  '#0f172a',
  '#1e40af',
  '#0369a1',
  '#065f46',
  '#7c3aed',
  '#be185d',
  '#c2410c',
  '#78350f',
  '#374151',
];

const FONT_COLORS = [
  '#1e293b',
  '#334155',
  '#0f172a',
  '#1e3a6e',
  '#1e40af',
  '#065f46',
  '#7c3aed',
  '#be185d',
  '#c2410c',
  '#78350f',
  '#374151',
  '#ffffff',
];

// ---------------------------------------------------------------------------
// Notes editor toolbar
// ---------------------------------------------------------------------------

function NotesToolbar({ onColorPick }: { onColorPick: (color: string) => void }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const exec = (cmd: string, value?: string) => {
    try {
      document.execCommand('styleWithCSS', false, 'true');
      if (value !== undefined) {
        document.execCommand(cmd, false, value);
      } else {
        document.execCommand(cmd, false);
      }
    } catch {
      // ignore browser quirks
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: 12,
    color: '#334155',
    fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
      <button style={{ ...btnStyle, fontWeight: 700 }} onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold">
        B
      </button>
      <button style={{ ...btnStyle, fontStyle: 'italic' }} onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic">
        I
      </button>

      <select
        style={{ ...btnStyle, padding: '4px 6px' }}
        defaultValue=""
        onChange={(e) => {
          exec('fontSize', e.target.value);
          e.target.value = '';
        }}
        title="Font size"
      >
        <option value="" disabled>Size</option>
        <option value="2">Small</option>
        <option value="3">Normal</option>
        <option value="4">Large</option>
        <option value="6">X-Large</option>
      </select>

      <div style={{ position: 'relative' }}>
        <button
          style={{ ...btnStyle }}
          onMouseDown={(e) => { e.preventDefault(); setShowColorPicker((v) => !v); }}
          title="Font color"
        >
          A<span style={{ display: 'inline-block', width: 8, height: 3, backgroundColor: '#1e3a6e', marginLeft: 2, verticalAlign: 'middle' }} />
        </button>
        {showColorPicker && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 20,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              width: 120,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {FONT_COLORS.map((color) => (
              <button
                key={color}
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec('foreColor', color);
                  onColorPick(color);
                  setShowColorPicker(false);
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  backgroundColor: color,
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <button style={btnStyle} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet list">
        &#8226;&#8226;
      </button>
      <button style={btnStyle} onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} title="Align left">
        &#8676;
      </button>
      <button style={btnStyle} onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} title="Align center">
        &#8677;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ReportBuilder component
// ---------------------------------------------------------------------------

export default function ReportBuilder({
  client,
  activeTab,
  parsedData,
  spendData,
  onClose,
  onSave,
  onAddHistory,
}: Props) {
  const [config, setConfig] = useState<ReportConfig>(() => {
    return client.reportConfig ?? buildDefaultConfig(client, activeTab);
  });

  // Tab selection — report is built from a specific tab
  const [selectedTabId, setSelectedTabId] = useState<string>(
    () => client.reportConfig?.tabId ?? activeTab.id
  );
  const selectedTab = client.tabs.find((t) => t.id === selectedTabId) ?? activeTab;

  const accent = config.coverBgColor;

  const [selectedPageId, setSelectedPageId] = useState<string>('cover');
  const [generating, setGenerating] = useState(false);
  const [showAddChart, setShowAddChart] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'edit' | 'history'>('edit');
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [takeawaysUploading, setTakeawaysUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const takeawaysFileRef = useRef<HTMLInputElement>(null);
  const textBlockEditorRef = useRef<HTMLDivElement>(null);

  const renderRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notesEditorRef = useRef<HTMLDivElement>(null);

  // Auto-save with 800ms debounce
  const updateConfig = useCallback(
    (patch: Partial<ReportConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onSave(next), 800);
        return next;
      });
    },
    [onSave]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  // Sync text block editor content when selected page or text block position changes.
  // We do NOT use dangerouslySetInnerHTML on the contentEditable editor because React
  // overwrites innerHTML on every re-render, erasing what the user is typing.
  // Instead we imperatively set innerHTML only when the page or position actually changes.
  const _tbPage = config.pages.find((p) => p.id === selectedPageId);
  const _tbPosition = _tbPage?.type === 'chart' ? (_tbPage.textBlock?.position ?? null) : null;
  useLayoutEffect(() => {
    if (!textBlockEditorRef.current) return;
    const page = config.pages.find((p) => p.id === selectedPageId);
    const content = page?.type === 'chart' && page.textBlock ? page.textBlock.content : '';
    textBlockEditorRef.current.innerHTML = content;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId, _tbPosition]);

  // Build ordered pages list: cover, ...config.pages, takeaways
  const totalPages = 1 + config.pages.length + 1; // cover + pages + takeaways

  // Page number calculation: cover=1, pages[i]=2+i, takeaways=last
  function getPageNum(pageId: string): number {
    if (pageId === 'cover') return 1;
    const idx = config.pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) return 2 + idx;
    return totalPages; // takeaways
  }

  // Charts available to add (not already in the page list, non-total)
  const chartsInPages = new Set(
    config.pages.filter((p) => p.type === 'chart').flatMap((p) => [p.chartId, p.chartId2].filter(Boolean))
  );
  const availableCharts = selectedTab.chartConfigs.filter(
    (w) => (w.type ?? 'bar') !== 'total' && !chartsInPages.has(w.id)
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const addChartPage = (chart: ChartConfig) => {
    const newPage: ReportPage = {
      id: `page-chart-${chart.id}-${Date.now()}`,
      type: 'chart',
      chartId: chart.id,
    };
    updateConfig({ pages: [...config.pages, newPage] });
    setSelectedPageId(newPage.id);
    setShowAddChart(false);
  };

  const addNotesPage = () => {
    const newPage: ReportPage = {
      id: `page-notes-${Date.now()}`,
      type: 'notes',
      notesContent: '',
    };
    updateConfig({ pages: [...config.pages, newPage] });
    setSelectedPageId(newPage.id);
  };

  const removePage = (pageId: string) => {
    const newPages = config.pages.filter((p) => p.id !== pageId);
    updateConfig({ pages: newPages });
    if (selectedPageId === pageId) {
      setSelectedPageId(newPages.length > 0 ? newPages[newPages.length - 1].id : 'cover');
    }
  };

  const movePage = (pageId: string, direction: 'up' | 'down') => {
    const pages = [...config.pages];
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= pages.length) return;
    [pages[idx], pages[newIdx]] = [pages[newIdx], pages[idx]];
    updateConfig({ pages });
  };

  const updatePageTitle = (pageId: string, title: string) => {
    updateConfig({
      pages: config.pages.map((p) =>
        p.id === pageId ? { ...p, title: title || undefined } : p
      ),
    });
  };

  const updateTextBlock = (pageId: string, patch: Partial<ReportTextBlock> | null) => {
    updateConfig({
      pages: config.pages.map((p) => {
        if (p.id !== pageId) return p;
        if (patch === null) return { ...p, textBlock: undefined };
        return { ...p, textBlock: { ...p.textBlock, content: p.textBlock?.content ?? '', position: p.textBlock?.position ?? 'right-half', ...patch } };
      }),
    });
  };

  const toggleSummaryPage = () => {
    const hasSummary = config.pages.some((p) => p.type === 'summary');
    if (hasSummary) {
      updateConfig({ pages: config.pages.filter((p) => p.type !== 'summary') });
      if (selectedPageId === config.pages.find((p) => p.type === 'summary')?.id) {
        setSelectedPageId('cover');
      }
    } else {
      const summaryPage: ReportPage = { id: 'page-summary', type: 'summary' };
      updateConfig({ pages: [summaryPage, ...config.pages.filter((p) => p.type !== 'summary')] });
    }
  };

  // -------------------------------------------------------------------------
  // Cover photo upload
  // -------------------------------------------------------------------------

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Upload failed');
      }
      const { url } = await res.json();
      updateConfig({ coverImageUrl: url });
    } catch (err) {
      alert(`Cover photo upload failed: ${(err as Error).message}`);
    } finally {
      setCoverUploading(false);
      if (coverFileRef.current) coverFileRef.current.value = '';
    }
  };

  // -------------------------------------------------------------------------
  // Client logo upload
  // -------------------------------------------------------------------------

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Upload failed');
      }
      const { url } = await res.json();
      updateConfig({ clientLogoUrl: url });
    } catch (err) {
      alert(`Logo upload failed: ${(err as Error).message}`);
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  // -------------------------------------------------------------------------
  // Takeaways image upload
  // -------------------------------------------------------------------------

  const handleTakeawaysImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTakeawaysUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Upload failed');
      }
      const { url } = await res.json();
      updateConfig({ takeawaysImageUrl: url });
    } catch (err) {
      alert(`Image upload failed: ${(err as Error).message}`);
    } finally {
      setTakeawaysUploading(false);
      if (takeawaysFileRef.current) takeawaysFileRef.current.value = '';
    }
  };

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const pageEls = Array.from(
        renderRef.current!.querySelectorAll('[data-report-page]')
      ) as HTMLElement[];
      const rawName = config.reportName || `${client.name} Report`;
      const filename = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';
      await generatePdf(pageEls, filename);
      onAddHistory({
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
        label: config.coverDateRange,
        config,
      });
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render a page component by id (for both preview and hidden render)
  // -------------------------------------------------------------------------

  function renderPageById(pageId: string): React.ReactNode {
    const pageNum = getPageNum(pageId);
    const effectiveTotalPages = totalPages;

    if (pageId === 'cover') {
      return <CoverPageRender config={config} />;
    }

    if (pageId === 'takeaways') {
      return (
        <TakeawaysPageRender
          config={config}
          accent={accent}
          pageNum={effectiveTotalPages}
          totalPages={effectiveTotalPages}
          clientLogoUrl={config.clientLogoUrl}
        />
      );
    }

    const page = config.pages.find((p) => p.id === pageId);
    if (!page) return null;

    if (page.type === 'summary') {
      return (
        <SummaryPageRender
          config={config}
          activeTab={selectedTab}
          parsedData={parsedData}
          accent={accent}
          pageNum={pageNum}
          totalPages={effectiveTotalPages}
          clientLogoUrl={config.clientLogoUrl}
        />
      );
    }

    if (page.type === 'notes') {
      return (
        <NotesPageRender
          page={page}
          accent={accent}
          pageNum={pageNum}
          totalPages={effectiveTotalPages}
          clientName={config.coverSubtitle}
          clientLogoUrl={config.clientLogoUrl}
        />
      );
    }

    if (page.type === 'chart' && page.chartId) {
      const chartConfig = selectedTab.chartConfigs.find((w) => w.id === page.chartId);
      if (!chartConfig) {
        return (
          <div
            style={{
              width: 1056,
              height: 816,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              color: '#94a3b8',
              fontFamily: 'system-ui',
            }}
          >
            Chart not found
          </div>
        );
      }
      const chartConfig2 = page.chartId2
        ? selectedTab.chartConfigs.find((w) => w.id === page.chartId2)
        : undefined;
      const pageTitle = page.title || chartConfig.title;
      const chartAccent = accentForWidget(chartConfig, selectedTab.chartConfigs);
      return (
        <ChartPageRender
          config={config}
          page={page}
          chartConfig={chartConfig}
          chartConfig2={chartConfig2}
          pageTitle={pageTitle}
          parsedData={parsedData}
          accent={chartAccent}
          spendData={spendData}
          pageNum={pageNum}
          totalPages={effectiveTotalPages}
          clientLogoUrl={config.clientLogoUrl}
        />
      );
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Edit panel content
  // -------------------------------------------------------------------------

  function renderEditPanel() {
    if (selectedPageId === 'cover') {
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Report Settings
          </h2>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report Name / File Name</span>
            <input
              type="text"
              value={config.reportName ?? ''}
              onChange={(e) => updateConfig({ reportName: e.target.value })}
              placeholder={`${client.name} Report`}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Used as the PDF file name when downloading</span>
          </label>

          <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cover Page
          </h3>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</span>
            <input
              type="text"
              value={config.coverTitle}
              onChange={(e) => updateConfig({ coverTitle: e.target.value })}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtitle</span>
            <input
              type="text"
              value={config.coverSubtitle}
              onChange={(e) => updateConfig({ coverSubtitle: e.target.value })}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</span>
            <input
              type="text"
              value={config.coverDateRange}
              onChange={(e) => updateConfig({ coverDateRange: e.target.value })}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </label>

          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Background Color
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateConfig({ coverBgColor: color })}
                  title={color}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: config.coverBgColor === color ? '3px solid #ffffff' : '2px solid transparent',
                    boxShadow: config.coverBgColor === color ? `0 0 0 2px ${color}` : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Custom:</span>
              <input
                type="color"
                value={config.coverBgColor}
                onChange={(e) => updateConfig({ coverBgColor: e.target.value })}
                style={{ width: 32, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }}
              />
            </div>
          </div>

          {/* Cover photo upload */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Cover Photo
            </span>
            {config.coverImageUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <img
                  src={config.coverImageUrl}
                  alt="Cover"
                  style={{ height: 60, borderRadius: 4, border: '1px solid #e2e8f0', objectFit: 'cover' }}
                />
                <button
                  onClick={() => updateConfig({ coverImageUrl: undefined })}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#ef4444',
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverFileChange}
            />
            <button
              onClick={() => coverFileRef.current?.click()}
              disabled={coverUploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                border: '1px dashed #cbd5e1',
                borderRadius: 6,
                backgroundColor: 'transparent',
                cursor: coverUploading ? 'not-allowed' : 'pointer',
                color: '#64748b',
                fontSize: 12,
              }}
            >
              {coverUploading ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid #e2e8f0', borderTopColor: '#1e3a6e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Uploading…
                </>
              ) : (
                <>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Cover Photo
                </>
              )}
            </button>
          </div>

          <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

          {/* Client logo upload */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              Client Logo
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
              Shown top-right on every non-cover page
            </span>
            {config.clientLogoUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <img
                  src={config.clientLogoUrl}
                  alt="Client logo"
                  style={{ height: 36, borderRadius: 4, border: '1px solid #e2e8f0', objectFit: 'contain', backgroundColor: '#f8fafc', padding: 4 }}
                />
                <button
                  onClick={() => updateConfig({ clientLogoUrl: undefined })}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#ef4444',
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleLogoFileChange}
            />
            <button
              onClick={() => logoFileRef.current?.click()}
              disabled={logoUploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                border: '1px dashed #cbd5e1',
                borderRadius: 6,
                backgroundColor: 'transparent',
                cursor: logoUploading ? 'not-allowed' : 'pointer',
                color: '#64748b',
                fontSize: 12,
              }}
            >
              {logoUploading ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid #e2e8f0', borderTopColor: '#1e3a6e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Uploading…
                </>
              ) : (
                <>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Client Logo
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    if (selectedPageId === 'takeaways') {
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Takeaways
          </h2>

          {!config.takeawaysImageUrl && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Key Points (left column — no image)
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>One bullet per line</span>
            <textarea
              value={config.takeawaysBullets}
              onChange={(e) => updateConfig({ takeawaysBullets: e.target.value })}
              rows={5}
              placeholder="Enter each bullet on a new line"
              style={{
                padding: '8px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Narrative
            </span>
            <textarea
              value={config.takeaways}
              onChange={(e) => updateConfig({ takeaways: e.target.value })}
              rows={10}
              placeholder="Enter your narrative here..."
              style={{
                padding: '8px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </label>

          <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

          {/* Takeaways image */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              Background Image
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
              When set, shows as a full-height photo on the left side
            </span>
            {config.takeawaysImageUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <img
                  src={config.takeawaysImageUrl}
                  alt="Takeaways"
                  style={{ height: 56, width: 40, borderRadius: 4, border: '1px solid #e2e8f0', objectFit: 'cover' }}
                />
                <button
                  onClick={() => updateConfig({ takeawaysImageUrl: undefined })}
                  style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, backgroundColor: '#ffffff', cursor: 'pointer', fontSize: 11, color: '#ef4444' }}
                >
                  Remove
                </button>
              </div>
            )}
            <input ref={takeawaysFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleTakeawaysImageChange} />
            <button
              onClick={() => takeawaysFileRef.current?.click()}
              disabled={takeawaysUploading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', border: '1px dashed #cbd5e1', borderRadius: 6,
                backgroundColor: 'transparent', cursor: takeawaysUploading ? 'not-allowed' : 'pointer',
                color: '#64748b', fontSize: 12,
              }}
            >
              {takeawaysUploading ? (
                <><div style={{ width: 12, height: 12, border: '2px solid #e2e8f0', borderTopColor: '#1e3a6e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Uploading…</>
              ) : (
                <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload Photo</>
              )}
            </button>
          </div>
        </div>
      );
    }

    const page = config.pages.find((p) => p.id === selectedPageId);
    if (!page) return null;

    if (page.type === 'summary') {
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Summary Page
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Auto-populated from your KPI widgets (total type) in the current tab.
          </p>
        </div>
      );
    }

    if (page.type === 'notes') {
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notes Page
          </h2>
          <NotesToolbar onColorPick={() => {}} />
          <div
            ref={notesEditorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: page.notesContent ?? '' }}
            onBlur={() => {
              const html = notesEditorRef.current?.innerHTML ?? '';
              updateConfig({
                pages: config.pages.map((p) =>
                  p.id === page.id ? { ...p, notesContent: html } : p
                ),
              });
            }}
            style={{
              minHeight: 400,
              padding: 16,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              outline: 'none',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#1e293b',
            }}
          />
        </div>
      );
    }

    if (page.type === 'chart' && page.chartId) {
      const chartConfig = selectedTab.chartConfigs.find((w) => w.id === page.chartId);
      const currentLayout = page.layout ?? '1-chart';
      const allNonTotalCharts = selectedTab.chartConfigs.filter(
        (w) => (w.type ?? 'bar') !== 'total'
      );
      // Any chart is valid as the second — exclude only the first chart on this page
      const availableForSecond = allNonTotalCharts.filter(
        (w) => w.id !== page.chartId
      );

      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chart Page
          </h2>

          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              Chart
            </span>
            <span style={{ fontSize: 13, color: '#1e293b' }}>
              {chartConfig?.title ?? '(unknown chart)'}
            </span>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Title Override
            </span>
            <input
              type="text"
              value={page.title ?? ''}
              onChange={(e) => updatePageTitle(page.id, e.target.value)}
              placeholder={chartConfig?.title ?? ''}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </label>

          {/* Layout toggle */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Layout
            </span>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
              {(['1-chart', '2-charts'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    if (opt === '1-chart') {
                      updateConfig({
                        pages: config.pages.map((p) =>
                          p.id === page.id ? { ...p, layout: '1-chart', chartId2: undefined } : p
                        ),
                      });
                    } else {
                      updateConfig({
                        pages: config.pages.map((p) =>
                          p.id === page.id ? { ...p, layout: '2-charts' } : p
                        ),
                      });
                    }
                  }}
                  style={{
                    padding: '5px 12px',
                    border: 'none',
                    backgroundColor: currentLayout === opt ? '#1e3a6e' : '#ffffff',
                    color: currentLayout === opt ? '#ffffff' : '#64748b',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt === '1-chart' ? '1 Chart' : '2 Charts'}
                </button>
              ))}
            </div>
          </div>

          {/* Second chart selector */}
          {currentLayout === '2-charts' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Second Chart
              </span>
              <select
                value={page.chartId2 ?? ''}
                onChange={(e) => {
                  updateConfig({
                    pages: config.pages.map((p) =>
                      p.id === page.id ? { ...p, chartId2: e.target.value || undefined } : p
                    ),
                  });
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#1e293b',
                  outline: 'none',
                }}
              >
                <option value="">— Select chart —</option>
                {availableForSecond.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            </label>
          )}

          {/* Narration / text block */}
          <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Narration Block
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Position</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
              {([
                [null,          'None'],
                ['left-half',   '← Left ½'],
                ['right-half',  'Right ½ →'],
                ['top-left',    '◤ Top-L'],
                ['top-right',   'Top-R ◥'],
                ['bottom-left', '◣ Bot-L'],
                ['bottom-right','Bot-R ◢'],
              ] as [TextBlockPosition | null, string][]).map(([pos, label]) => {
                const isActive = pos === null ? !page.textBlock : page.textBlock?.position === pos;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (pos === null) {
                        updateTextBlock(page.id, null);
                      } else {
                        updateTextBlock(page.id, { position: pos, content: page.textBlock?.content ?? '' });
                      }
                    }}
                    style={{
                      padding: '4px 6px',
                      border: `1px solid ${isActive ? '#1e3a6e' : '#e2e8f0'}`,
                      borderRadius: 4,
                      backgroundColor: isActive ? '#1e3a6e' : '#ffffff',
                      color: isActive ? '#ffffff' : '#64748b',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {page.textBlock && (
              <>
                <NotesToolbar onColorPick={() => {}} />
                <div
                  ref={textBlockEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={() => {
                    const html = textBlockEditorRef.current?.innerHTML ?? '';
                    updateTextBlock(page.id, { content: html });
                  }}
                  style={{
                    minHeight: 120,
                    padding: 12,
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    outline: 'none',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#1e293b',
                  }}
                />
              </>
            )}
          </div>
        </div>
      );
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // History panel
  // -------------------------------------------------------------------------

  function renderHistoryPanel() {
    const history = client.reportHistory ?? [];
    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Report History
        </h2>
        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            No history yet. Download a PDF to save a snapshot.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  {entry.label || '(no date range)'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Saved on {new Date(entry.savedAt).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      if (window.confirm('Load this saved report? Current changes will be replaced.')) {
                        setConfig(entry.config);
                        onSave(entry.config);
                        setRightPanelMode('edit');
                        setSelectedPageId('cover');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#334155',
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={async () => {
                      setGenerating(true);
                      try {
                        // Temporarily set config to history entry for render, then restore
                        // We use a hidden approach: create a temporary clone render
                        const pageEls = Array.from(
                          renderRef.current!.querySelectorAll('[data-report-page]')
                        ) as HTMLElement[];
                        // We need to render with the history config. For now load, generate, restore.
                        const current = config;
                        setConfig(entry.config);
                        // Wait a tick for React to re-render
                        await new Promise((r) => setTimeout(r, 300));
                        const freshEls = Array.from(
                          renderRef.current!.querySelectorAll('[data-report-page]')
                        ) as HTMLElement[];
                        const filename = `${client.name.toLowerCase().replace(/\s+/g, '-')}-report-${entry.id}.pdf`;
                        await generatePdf(freshEls, filename);
                        setConfig(current);
                      } finally {
                        setGenerating(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#1e3a6e',
                    }}
                  >
                    ↓ Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Preview scaling
  // -------------------------------------------------------------------------

  const fitScale = 0.55; // fixed scale; ~581px wide in 640px container

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1f5f9',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          padding: '0 16px',
          backgroundColor: '#1e3a6e',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>|</span>
          <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
            Report Builder — {client.name}
          </span>
          {client.tabs.length > 1 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tab:</span>
                <select
                  value={selectedTabId}
                  onChange={(e) => {
                    const newTabId = e.target.value;
                    setSelectedTabId(newTabId);
                    updateConfig({ tabId: newTabId });
                  }}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontSize: 13,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {client.tabs.map((t) => (
                    <option key={t.id} value={t.id} style={{ backgroundColor: '#1e3a6e', color: '#ffffff' }}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* History toggle button */}
          <button
            onClick={() => setRightPanelMode((m) => m === 'history' ? 'edit' : 'history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: rightPanelMode === 'history' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Report history"
          >
            {/* Clock icon */}
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
            </svg>
            History
          </button>

          <button
            onClick={handleDownload}
            disabled={generating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: generating ? '#374151' : '#ffffff',
              color: generating ? '#9ca3af' : '#1e3a6e',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? (
              <>
                <svg
                  style={{ animation: 'spin 1s linear infinite' }}
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel — page list */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              fontSize: 11,
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Pages
          </div>

          <div style={{ flex: 1, overflow: 'y-auto', overflowY: 'auto' }}>
            {/* Cover page */}
            <PageListItem
              label="Cover"
              isSelected={selectedPageId === 'cover'}
              onClick={() => setSelectedPageId('cover')}
              isFixed
            />

            {/* Summary toggle */}
            {(() => {
              const summaryPage = config.pages.find((p) => p.type === 'summary');
              const hasSummary = !!summaryPage;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    cursor: hasSummary ? 'pointer' : 'default',
                    backgroundColor:
                      hasSummary && selectedPageId === summaryPage?.id
                        ? '#eff6ff'
                        : 'transparent',
                    borderLeft:
                      hasSummary && selectedPageId === summaryPage?.id
                        ? '3px solid #3b82f6'
                        : '3px solid transparent',
                  }}
                  onClick={() => hasSummary && summaryPage && setSelectedPageId(summaryPage.id)}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: hasSummary ? '#334155' : '#94a3b8',
                    }}
                  >
                    Summary
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSummaryPage();
                    }}
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: hasSummary ? '#3b82f6' : '#e2e8f0',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      flexShrink: 0,
                      padding: 0,
                    }}
                    title={hasSummary ? 'Remove summary page' : 'Add summary page'}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: hasSummary ? 16 : 2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transition: 'left 0.15s',
                      }}
                    />
                  </button>
                </div>
              );
            })()}

            {/* Chart and notes pages */}
            {config.pages
              .filter((p) => p.type === 'chart' || p.type === 'notes')
              .map((page) => {
                const allMovablePages = config.pages.filter((p) => p.type === 'chart' || p.type === 'notes');
                const pageIdx = allMovablePages.indexOf(page);

                const label = page.type === 'notes'
                  ? (page.title || 'Notes')
                  : (() => {
                      const chart = selectedTab.chartConfigs.find((w) => w.id === page.chartId);
                      return page.title || chart?.title || 'Chart';
                    })();

                return (
                  <div
                    key={page.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 8px 6px 16px',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedPageId === page.id ? '#eff6ff' : 'transparent',
                      borderLeft:
                        selectedPageId === page.id
                          ? '3px solid #3b82f6'
                          : '3px solid transparent',
                    }}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: '#334155',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={label}
                    >
                      {page.type === 'notes' && (
                        <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 4 }}>N</span>
                      )}
                      {label}
                    </span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePage(page.id, 'up');
                        }}
                        disabled={pageIdx === 0}
                        title="Move up"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 3px',
                          cursor: pageIdx === 0 ? 'not-allowed' : 'pointer',
                          color: pageIdx === 0 ? '#cbd5e1' : '#94a3b8',
                          borderRadius: 3,
                        }}
                      >
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePage(page.id, 'down');
                        }}
                        disabled={pageIdx === allMovablePages.length - 1}
                        title="Move down"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 3px',
                          cursor:
                            pageIdx === allMovablePages.length - 1
                              ? 'not-allowed'
                              : 'pointer',
                          color:
                            pageIdx === allMovablePages.length - 1
                              ? '#cbd5e1'
                              : '#94a3b8',
                          borderRadius: 3,
                        }}
                      >
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePage(page.id);
                        }}
                        title="Remove page"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 3px',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          borderRadius: 3,
                        }}
                      >
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* Add chart / Add notes buttons */}
            <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {availableCharts.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowAddChart((v) => !v)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      border: '1px dashed #cbd5e1',
                      borderRadius: 6,
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: 12,
                    }}
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Chart
                  </button>

                  {showAddChart && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}
                    >
                      {availableCharts.map((chart) => (
                        <button
                          key={chart.id}
                          onClick={() => addChartPage(chart)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: '#334155',
                          }}
                        >
                          {chart.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={addNotesPage}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 6,
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: 12,
                }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Notes
              </button>
            </div>

            {/* Takeaways */}
            <PageListItem
              label="Takeaways"
              isSelected={selectedPageId === 'takeaways'}
              onClick={() => setSelectedPageId('takeaways')}
              isFixed
            />
          </div>
        </div>

        {/* Center — preview */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            overflow: 'auto',
            padding: 24,
          }}
        >
          <div
            style={{
              width: Math.round(1056 * fitScale),
              height: Math.round(816 * fitScale),
              overflow: 'hidden',
              borderRadius: 4,
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                transformOrigin: 'top left',
                transform: `scale(${fitScale})`,
                width: 1056,
                height: 816,
              }}
            >
              {renderPageById(selectedPageId)}
            </div>
          </div>
        </div>

        {/* Right panel — edit or history */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto',
          }}
        >
          {rightPanelMode === 'history' ? renderHistoryPanel() : renderEditPanel()}
        </div>
      </div>

      {/* Hidden render div — all pages at once for PDF capture */}
      <div
        ref={renderRef}
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {/* Cover */}
        <div data-report-page="">
          <CoverPageRender config={config} />
        </div>

        {/* Config pages */}
        {config.pages.map((page, idx) => {
          const pageNum = 2 + idx;
          if (page.type === 'summary') {
            return (
              <div key={page.id} data-report-page="">
                <SummaryPageRender
                  config={config}
                  activeTab={selectedTab}
                  parsedData={parsedData}
                  accent={accent}
                  pageNum={pageNum}
                  totalPages={totalPages}
                  clientLogoUrl={config.clientLogoUrl}
                />
              </div>
            );
          }
          if (page.type === 'notes') {
            return (
              <div key={page.id} data-report-page="">
                <NotesPageRender
                  page={page}
                  accent={accent}
                  pageNum={pageNum}
                  totalPages={totalPages}
                  clientName={config.coverSubtitle}
                  clientLogoUrl={config.clientLogoUrl}
                />
              </div>
            );
          }
          if (page.type === 'chart' && page.chartId) {
            const chartConfig = selectedTab.chartConfigs.find((w) => w.id === page.chartId);
            if (!chartConfig) return null;
            const chartConfig2 = page.chartId2
              ? selectedTab.chartConfigs.find((w) => w.id === page.chartId2)
              : undefined;
            const pageTitle = page.title || chartConfig.title;
            const chartAccent = accentForWidget(chartConfig, selectedTab.chartConfigs);
            return (
              <div key={page.id} data-report-page="">
                <ChartPageRender
                  config={config}
                  page={page}
                  chartConfig={chartConfig}
                  chartConfig2={chartConfig2}
                  pageTitle={pageTitle}
                  parsedData={parsedData}
                  accent={chartAccent}
                  spendData={spendData}
                  pageNum={pageNum}
                  totalPages={totalPages}
                  clientLogoUrl={config.clientLogoUrl}
                />
              </div>
            );
          }
          return null;
        })}

        {/* Takeaways */}
        <div data-report-page="">
          <TakeawaysPageRender
            config={config}
            accent={accent}
            pageNum={totalPages}
            totalPages={totalPages}
            clientLogoUrl={config.clientLogoUrl}
          />
        </div>
      </div>

      {/* Generating overlay */}
      {generating && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: '32px 48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid #e2e8f0',
                borderTopColor: '#1e3a6e',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ margin: 0, fontSize: 14, color: '#334155', fontWeight: 500 }}>
              Generating PDF…
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageListItem helper
// ---------------------------------------------------------------------------

function PageListItem({
  label,
  isSelected,
  onClick,
  isFixed,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  isFixed?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
      }}
    >
      <span style={{ fontSize: 13, color: '#334155' }}>{label}</span>
      {isFixed && (
        <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Fixed
        </span>
      )}
    </div>
  );
}
