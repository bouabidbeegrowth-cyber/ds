'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  totalClients: number;
  todayAppointments: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  topServices: { serviceName: string; count: number }[];
  recentAppointments: {
    id: string;
    client: { firstName: string; lastName: string };
    services: { service: { name: string; price: number } }[];
    date: string;
    status: string;
  }[];
  monthlyRevenue: { month: string; revenue: number }[];
  monthlyExpenses: { month: string; expenses: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = ['#C26EAD', '#E8A0D8', '#F3D4EA', '#9B4D8A', '#D46BC0'];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PROGRAMME: {
    label: 'PROGRAMMÉ',
    className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  ANNULE: {
    label: 'ANNULÉ',
    className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
  },
  TERMINE: {
    label: 'TERMINÉ',
    className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('fr-DZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} DA`;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground border-border hover:bg-muted',
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Custom tooltip for the bar chart
function BarChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.dataKey === 'revenue' ? 'Revenus' : 'Dépenses'} : {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// Custom tooltip for the pie chart
function PieChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { fill: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <p className="text-sm font-medium text-foreground">{entry.name}</p>
      <p className="text-sm" style={{ color: entry.payload.fill }}>
        {entry.value} rendez-vous
      </p>
    </div>
  );
}

// Custom legend for pie chart
interface PieLegendProps {
  payload?: { value: string; color: string }[];
}

function PieLegend({ payload }: PieLegendProps) {
  if (!payload) return null;

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DashboardModule() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem('ds_token') : null;
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Erreur lors du chargement du tableau de bord');
        }

        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erreur inconnue'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // Merge monthly revenue & expenses into a single dataset for the bar chart
  const chartData = (() => {
    if (!data) return [];
    const monthMap = new Map<string, { month: string; revenue: number; expenses: number }>();

    for (const r of data.monthlyRevenue) {
      monthMap.set(r.month, { month: r.month, revenue: r.revenue, expenses: 0 });
    }
    for (const e of data.monthlyExpenses) {
      const existing = monthMap.get(e.month);
      if (existing) {
        existing.expenses = e.expenses;
      } else {
        monthMap.set(e.month, { month: e.month, revenue: 0, expenses: e.expenses });
      }
    }

    return Array.from(monthMap.values()).slice(-6);
  })();

  // ─── KPI Card definitions ─────────────────────────────────────────────────
  const kpiCards = data
    ? [
        {
          label: 'Total clients',
          value: data.totalClients.toString(),
          icon: Users,
          iconBg: 'bg-primary/10',
          iconColor: 'text-primary',
        },
        {
          label: "Rendez-vous du jour",
          value: data.todayAppointments.toString(),
          icon: Calendar,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
        },
        {
          label: 'Revenus totaux',
          value: formatCurrency(data.totalRevenue),
          icon: TrendingUp,
          iconBg: 'bg-green-50',
          iconColor: 'text-green-600',
        },
        {
          label: 'Total dépenses',
          value: formatCurrency(data.totalExpenses),
          icon: TrendingDown,
          iconBg: 'bg-orange-50',
          iconColor: 'text-orange-600',
        },
        {
          label: 'Bénéfice net',
          value: formatCurrency(data.netProfit),
          icon: DollarSign,
          iconBg:
            data.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
          iconColor: data.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
          valueColor: data.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
        },
      ]
    : [];

  // ─── Render ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}
                      >
                        <Icon className={`h-6 w-6 ${kpi.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-muted-foreground">
                          {kpi.label}
                        </p>
                        <p
                          className={`mt-0.5 text-lg font-semibold tracking-tight ${'valueColor' in kpi ? kpi.valueColor : 'text-foreground'}`}
                        >
                          {kpi.value}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Bar Chart — Revenue vs Expenses */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Revenus vs Dépenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<BarChartTooltip />} />
                    <Legend
                      formatter={(value: string) =>
                        value === 'revenue' ? 'Revenus' : 'Dépenses'
                      }
                      wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#C26EAD"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="expenses"
                      fill="#E8A0D8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart — Top 5 Services */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Top 5 Services</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data!.topServices}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="serviceName"
                    >
                      {data!.topServices.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieChartTooltip />} />
                    <Legend content={<PieLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Recent Appointments Table ─────────────────────────────────────── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Derniers rendez-vous</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="px-6">Client</TableHead>
                  <TableHead className="px-6">Service</TableHead>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead className="px-6">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.recentAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Aucun rendez-vous récent
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.recentAppointments.map((apt) => (
                    <TableRow key={apt.id} className="border-border">
                      <TableCell className="px-6 font-medium">
                        {apt.client.firstName} {apt.client.lastName}
                      </TableCell>
                      <TableCell className="px-6 text-muted-foreground">
                        {apt.services?.map((as: { service: { name: string } }) => as.service.name).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="px-6 text-muted-foreground">
                        {formatDate(apt.date)}
                      </TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}