import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import { format, subDays, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/Card';

const ACTION_COLORS = {
  drawings: '#2563eb', // blue-600
  reactions: '#f87171', // red-400
  comments: '#facc15', // yellow-400
};

function getDefaultRange(days: number) {
  const end = new Date();
  const start = subDays(end, days - 1);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

interface ActionStatsChartProps {
  className?: string;
}

export function ActionStatsChart({ className = '' }: ActionStatsChartProps) {
  const {
    actionStats,
    actionStatsLoading,
    actionStatsError,
    fetchActionStats,
  } = useAdminDashboard();

  // Normalize data to ensure numbers
  const chartData = (actionStats || []).map((d) => ({
    ...d,
    drawings: Number(d.drawings),
    reactions: Number(d.reactions),
    comments: Number(d.comments),
  }));

  console.log(actionStats);
  console.log(chartData);

  // Date range state
  const [range, setRange] = useState(() => getDefaultRange(7));
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const [mode, setMode] = useState<'week' | 'month' | 'custom'>('week');

  useEffect(() => {
    fetchActionStats(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  // Quick actions
  const setWeek = () => {
    const r = getDefaultRange(7);
    setRange(r);
    setMode('week');
  };
  const setMonth = () => {
    const end = new Date();
    const start = subMonths(end, 1);
    setRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });
    setMode('month');
  };
  const setCustom = () => {
    setRange({ start: customStart, end: customEnd });
    setMode('custom');
  };

  return (
    <Card className={className}>
      <CardContent>
        <CardHeader title="Platform Activity" />
        <div className="flex flex-wrap gap-2 items-end">
          <button
            className={`px-3 py-1 rounded font-medium border ${mode === 'week' ? 'bg-primary text-white' : 'bg-background text-primary border-border'}`}
            onClick={setWeek}
          >
            1 Week
          </button>
          <button
            className={`px-3 py-1 rounded font-medium border ${mode === 'month' ? 'bg-primary text-white' : 'bg-background text-primary border-border'}`}
            onClick={setMonth}
          >
            1 Month
          </button>
          <div className="flex flex-col md:flex-row items-center gap-1">
            {mode === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-primary bg-background"
                  max={customEnd}
                />
                <span className="mx-1 text-secondary">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-primary bg-background"
                  min={customStart}
                />
              </>
            )}
            <button
              className={`px-3 py-1 rounded font-medium border ${mode === 'custom' ? 'bg-primary text-white' : 'bg-background text-primary border-border'}`}
              onClick={setCustom}
              disabled={!customStart || !customEnd || customStart > customEnd}
            >
              Custom
            </button>
          </div>
        </div>
        <div className="w-full h-72 md:h-96">
          {actionStatsLoading ? (
            <div className="flex items-center justify-center h-full text-secondary">
              Loading chart...
            </div>
          ) : actionStatsError ? (
            <div className="flex items-center justify-center h-full text-red-500">
              Error loading chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  hide
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis hide allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    value,
                    name.charAt(0).toUpperCase() + name.slice(1),
                  ]}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="drawings"
                  stackId="a"
                  fill={ACTION_COLORS.drawings}
                  name="Drawings"
                />
                <Bar
                  dataKey="reactions"
                  stackId="a"
                  fill={ACTION_COLORS.reactions}
                  name="Reactions"
                />
                <Bar
                  dataKey="comments"
                  stackId="a"
                  fill={ACTION_COLORS.comments}
                  name="Comments"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
