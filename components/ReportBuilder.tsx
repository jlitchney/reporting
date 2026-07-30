'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartConfig, ClientTab, ParsedData } from '@/lib/types';
import type { ReportConfig, ReportPage } from '@/lib/types';
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

function defaultAccent(client: StoredClient): string {
  const firstTab = client.tabs[0];
  if (!firstTab) return '#1e3a6e';
  const firstChart = firstTab.chartConfigs[0];
  return firstChart?.color ?? '#1e3a6e';
}

function buildDefaultConfig(client: StoredClient, activeTab: ClientTab): ReportConfig {
  const nonTotalCharts = activeTab.chartConfigs.filter(
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
  return (
    <div
      style={{
        width: 1056,
        height: 816,
        backgroundColor: config.coverBgColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Logo top-right */}
      <img
        src="/logo-white.png"
        alt=""
        style={{ position: 'absolute', top: 40, right: 40, height: 32 }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {/* Main content */}
      <div>
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
}: {
  config: ReportConfig;
  activeTab: ClientTab;
  parsedData: ParsedData;
  accent: string;
  pageNum: number;
  totalPages: number;
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
// Chart page
// ---------------------------------------------------------------------------

function ChartPageRender({
  config,
  chartConfig,
  pageTitle,
  parsedData,
  accent,
  spendData,
  pageNum,
  totalPages,
}: {
  config: ReportConfig;
  chartConfig: ChartConfig;
  pageTitle: string;
  parsedData: ParsedData;
  accent: string;
  spendData: SpendEntry[];
  pageNum: number;
  totalPages: number;
}) {
  const enlarged: ChartConfig = { ...chartConfig, chartHeight: 560, colSpan: 4 };

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
      </div>
      <div
        style={{
          flex: 1,
          padding: '16px 24px',
          overflow: 'hidden',
        }}
      >
        {renderWidget(enlarged, parsedData, accent, spendData)}
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
// Takeaways page
// ---------------------------------------------------------------------------

function TakeawaysPageRender({
  config,
  accent,
  pageNum,
  totalPages,
}: {
  config: ReportConfig;
  accent: string;
  pageNum: number;
  totalPages: number;
}) {
  const bullets = config.takeawaysBullets
    ? config.takeawaysBullets.split('\n')
    : [];

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
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
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
                  <p
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
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
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </div>
      {/* Right column */}
      <div
        style={{
          flex: 1,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            fontSize: 15,
            color: '#334155',
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
            margin: 0,
          }}
        >
          {config.takeaways || 'Add your takeaways in the editor panel.'}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color palette for cover background picker
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
}: Props) {
  const [config, setConfig] = useState<ReportConfig>(() => {
    return client.reportConfig ?? buildDefaultConfig(client, activeTab);
  });

  const accent = config.coverBgColor;

  // The cover page is always first, takeaways always last
  // selectedPageId: 'cover' | 'takeaways' | page.id
  const [selectedPageId, setSelectedPageId] = useState<string>('cover');
  const [generating, setGenerating] = useState(false);
  const [showAddChart, setShowAddChart] = useState(false);

  const renderRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Build ordered pages list: cover, ...config.pages, takeaways
  const allPageIds = ['cover', ...config.pages.map((p) => p.id), 'takeaways'];
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
    config.pages.filter((p) => p.type === 'chart').map((p) => p.chartId)
  );
  const availableCharts = activeTab.chartConfigs.filter(
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
  // Download
  // -------------------------------------------------------------------------

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const pageEls = Array.from(
        renderRef.current!.querySelectorAll('[data-report-page]')
      ) as HTMLElement[];
      const filename = `${client.name.toLowerCase().replace(/\s+/g, '-')}-report.pdf`;
      await generatePdf(pageEls, filename);
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render a page component by id (for both preview and hidden render)
  // -------------------------------------------------------------------------

  function renderPageById(pageId: string, opts?: { hideFooter?: boolean }): React.ReactNode {
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
        />
      );
    }

    const page = config.pages.find((p) => p.id === pageId);
    if (!page) return null;

    if (page.type === 'summary') {
      return (
        <SummaryPageRender
          config={config}
          activeTab={activeTab}
          parsedData={parsedData}
          accent={accent}
          pageNum={pageNum}
          totalPages={effectiveTotalPages}
        />
      );
    }

    if (page.type === 'chart' && page.chartId) {
      const chartConfig = activeTab.chartConfigs.find((w) => w.id === page.chartId);
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
      const pageTitle =
        page.title || chartConfig.title;
      const chartAccent = accentForWidget(chartConfig, activeTab.chartConfigs);
      return (
        <ChartPageRender
          config={config}
          chartConfig={chartConfig}
          pageTitle={pageTitle}
          parsedData={parsedData}
          accent={chartAccent}
          spendData={spendData}
          pageNum={pageNum}
          totalPages={effectiveTotalPages}
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
            Cover Page
          </h2>

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
        </div>
      );
    }

    if (selectedPageId === 'takeaways') {
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Takeaways
          </h2>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Key Points (left column)
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

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Narrative (right column)
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

    if (page.type === 'chart' && page.chartId) {
      const chartConfig = activeTab.chartConfigs.find((w) => w.id === page.chartId);
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
        </div>
      );
    }

    return null;
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
        </div>

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

            {/* Chart pages */}
            {config.pages
              .filter((p) => p.type === 'chart')
              .map((page) => {
                const chart = activeTab.chartConfigs.find((w) => w.id === page.chartId);
                const chartIdx = config.pages.filter((p) => p.type === 'chart').indexOf(page);
                const allChartPages = config.pages.filter((p) => p.type === 'chart');
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
                      title={page.title || chart?.title}
                    >
                      {page.title || chart?.title || 'Chart'}
                    </span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePage(page.id, 'up');
                        }}
                        disabled={chartIdx === 0}
                        title="Move up"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 3px',
                          cursor: chartIdx === 0 ? 'not-allowed' : 'pointer',
                          color: chartIdx === 0 ? '#cbd5e1' : '#94a3b8',
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
                        disabled={chartIdx === allChartPages.length - 1}
                        title="Move down"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 3px',
                          cursor:
                            chartIdx === allChartPages.length - 1
                              ? 'not-allowed'
                              : 'pointer',
                          color:
                            chartIdx === allChartPages.length - 1
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

            {/* Add chart button */}
            {availableCharts.length > 0 && (
              <div style={{ position: 'relative', padding: '4px 16px 8px' }}>
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
                      left: 16,
                      right: 8,
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

        {/* Right panel — edit */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto',
          }}
        >
          {renderEditPanel()}
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
                  activeTab={activeTab}
                  parsedData={parsedData}
                  accent={accent}
                  pageNum={pageNum}
                  totalPages={totalPages}
                />
              </div>
            );
          }
          if (page.type === 'chart' && page.chartId) {
            const chartConfig = activeTab.chartConfigs.find((w) => w.id === page.chartId);
            if (!chartConfig) return null;
            const pageTitle = page.title || chartConfig.title;
            const chartAccent = accentForWidget(chartConfig, activeTab.chartConfigs);
            return (
              <div key={page.id} data-report-page="">
                <ChartPageRender
                  config={config}
                  chartConfig={chartConfig}
                  pageTitle={pageTitle}
                  parsedData={parsedData}
                  accent={chartAccent}
                  spendData={spendData}
                  pageNum={pageNum}
                  totalPages={totalPages}
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
