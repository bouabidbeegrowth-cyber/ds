'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, TrendingUp, TrendingDown, DollarSign, Activity, Clock, Filter, ShoppingCart } from 'lucide-react';
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

interface TodayAppointment {
  id: string;
  client: { firstName: string; lastName: string };
  employee: { name: string };
  services: { service: { name: string; price: number } }[];
  date: string;
  status: string;
}

interface DashboardData {
  filtered: boolean;
  totalClients: number;
  totalAppointments: number;
  todayAppointments: TodayAppointment[];
  totalRevenue: number;
  totalExpenses: number;
  totalPurchases: number;
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
  monthlyPurchases: { month: string; purchases: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = ['#C26EAD', '#E8A0D8', '#F3D4EA', '#9B4D8A', '#D46BC0'];

const FILTER_PRESETS = [
  { key: 'all', label: 'Tout' },
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: 'Cette année' },
];

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
  return `${currencyFormatter.format(value)} TND`;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr));
}

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(dateStr: string): string {
  return timeFormatter.format(new Date(dateStr));
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
          {entry.dataKey === 'revenue' ? 'Revenus' : entry.dataKey === 'expenses' ? 'Dépenses' : 'Achats'} : {formatCurrency(entry.value)}
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

  // Date range filter applied to everything except "Rendez-vous du jour",
  // which always shows today regardless of this filter.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<string>('all');

  const fetchDashboard = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('ds_token') : null;
      const params = new URLSearchParams();
      if (from && to) {
        params.set('from', from);
        params.set('to', to);
      }
      const res = await fetch(`/api/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Erreur lors du chargement du tableau de bord');
      }

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur inconnue'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => {
    if (dateFrom && dateTo) {
      setActivePreset('custom');
      fetchDashboard(dateFrom, dateTo);
    }
  };

  const resetFilter = () => {
    setDateFrom('');
    setDateTo('');
    setActivePreset('all');
    fetchDashboard('', '');
  };

  const applyPreset = (key: string) => {
    const now = new Date();
    let from: Date;
    let to: Date;

    switch (key) {
      case 'today':
        from = now;
        to = now;
        break;
      case '7d':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        to = now;
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        resetFilter();
        return;
    }

    const fromStr = toDateInputValue(from);
    const toStr = toDateInputValue(to);
    setDateFrom(fromStr);
    setDateTo(toStr);
    setActivePreset(key);
    fetchDashboard(fromStr, toStr);
  };

  // Merge monthly revenue & expenses into a single dataset for the bar chart
  const chartData = (() => {
    if (!data) return [];
    const monthMap = new Map<string, { month: string; revenue: number; expenses: number; purchases: number }>();

    const getOrCreate = (month: string) => {
      let entry = monthMap.get(month);
      if (!entry) {
        entry = { month, revenue: 0, expenses: 0, purchases: 0 };
        monthMap.set(month, entry);
      }
      return entry;
    };

    for (const r of data.monthlyRevenue) {
      getOrCreate(r.month).revenue = r.revenue;
    }
    for (const e of data.monthlyExpenses) {
      getOrCreate(e.month).expenses = e.expenses;
    }
    for (const p of data.monthlyPurchases) {
      getOrCreate(p.month).purchases = p.purchases;
    }

    return Array.from(monthMap.values());
  })();

  // ─── KPI Card definitions ─────────────────────────────────────────────────
  const kpiCards = data
    ? [
        {
          label: data.filtered ? 'Clients (période)' : 'Total clients',
          value: data.totalClients.toString(),
          icon: Users,
          iconBg: 'bg-primary/10',
          iconColor: 'text-primary',
        },
        {
          label: data.filtered ? 'Rendez-vous (période)' : 'Total rendez-vous',
          value: data.totalAppointments.toString(),
          icon: Calendar,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
        },
        {
          label: data.filtered ? 'Revenus (période)' : 'Revenus totaux',
          value: formatCurrency(data.totalRevenue),
          icon: TrendingUp,
          iconBg: 'bg-green-50',
          iconColor: 'text-green-600',
        },
        {
          label: data.filtered ? 'Dépenses (période)' : 'Total dépenses',
          value: formatCurrency(data.totalExpenses),
          icon: TrendingDown,
          iconBg: 'bg-orange-50',
          iconColor: 'text-orange-600',
        },
        {
          label: data.filtered ? 'Achats (période)' : 'Total achats',
          value: formatCurrency(data.totalPurchases),
          icon: ShoppingCart,
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
        },
        {
          label: data.filtered ? 'Bénéfice net (période)' : 'Bénéfice net',
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
      {/* ── Rendez-vous du jour (always today, unaffected by the filter) ────── */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Rendez-vous du jour
          </CardTitle>
          {!loading && data && (
            <Badge variant="secondary">{data.todayAppointments.length}</Badge>
          )}
        </CardHeader>
        <CardContent className={!loading && data && data.todayAppointments.length > 0 ? 'px-0 pb-0' : undefined}>
          {loading ? (
            <div className="px-6 pb-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.todayAppointments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Aucun rendez-vous aujourd&apos;hui
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="px-6">Heure</TableHead>
                  <TableHead className="px-6">Client</TableHead>
                  <TableHead className="px-6">Service</TableHead>
                  <TableHead className="px-6">Employé</TableHead>
                  <TableHead className="px-6">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.todayAppointments.map((apt) => (
                  <TableRow key={apt.id} className="border-border">
                    <TableCell className="px-6 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatTime(apt.date)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6">
                      {apt.client.firstName} {apt.client.lastName}
                    </TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {apt.services?.map((s) => s.service.name).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {apt.employee.name}
                    </TableCell>
                    <TableCell className="px-6">
                      <StatusBadge status={apt.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Date range filter (applies to everything below) ─────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
            {FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant={activePreset === preset.key ? 'default' : 'ghost'}
                className="h-8"
                onClick={() => applyPreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Du"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset('custom');
              }}
              className="h-8 w-[150px]"
            />
            <span className="text-sm text-muted-foreground">→</span>
            <Input
              aria-label="Au"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset('custom');
              }}
              className="h-8 w-[150px]"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={applyFilter}
              disabled={!dateFrom || !dateTo}
            >
              Appliquer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)
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
                  Revenus vs Dépenses vs Achats {data?.filtered ? '(période)' : '(6 derniers mois)'}
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
                        value === 'revenue' ? 'Revenus' : value === 'expenses' ? 'Dépenses' : 'Achats'
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
                    <Bar
                      dataKey="purchases"
                      fill="#9B4D8A"
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
                <CardTitle className="text-base">
                  Top 5 Services {data?.filtered ? '(période)' : '(toutes les données)'}
                </CardTitle>
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
            <CardTitle className="text-base">
              {data?.filtered ? 'Rendez-vous (période)' : 'Derniers rendez-vous'}
            </CardTitle>
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