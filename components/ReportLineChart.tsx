'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { ChartDataPoint } from '@/lib/types';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-blue-300">{payload[0].value.toLocaleString()} candidates</p>
    </div>
  );
};

export default function ReportLineChart({ data, color = '#2563eb' }: { data: ChartDataPoint[]; color?: string }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No data for the selected criteria
      </div>
    );
  }

  const rotateLabels = data.length > 8;
  const showLabels = data.length <= 24;
  const tickInterval = rotateLabels ? 0 : (data.length > 20 ? Math.floor(data.length / 12) : 0);

  return (
    <ResponsiveContainer width="100%" height={rotateLabels ? 320 : 280}>
      <LineChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: '#94a3b8', textAnchor: rotateLabels ? 'end' : 'middle' }}
          axisLine={false}
          tickLine={false}
          angle={rotateLabels ? -45 : 0}
          interval={tickInterval}
          height={rotateLabels ? 72 : 30}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 0, r: 4 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        >
          {showLabels && (
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 10, fill: '#64748b' }}
              formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')}
            />
          )}
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}
