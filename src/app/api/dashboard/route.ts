import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';

const MAX_CHART_MONTHS = 24;

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'dashboard', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const hasRange = !!(fromParam && toParam);
  const rangeStart = hasRange ? new Date(fromParam + 'T00:00:00.000Z') : null;
  const rangeEnd = hasRange ? new Date(toParam + 'T23:59:59.999Z') : null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // "Rendez-vous du jour" is always today's appointments — never affected by the range filter.
  const todayAppointmentsPromise = db.appointment.findMany({
    where: { date: { gte: todayStart, lte: todayEnd } },
    orderBy: { date: 'asc' },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      employee: { select: { id: true, name: true } },
      services: { include: { service: { select: { id: true, name: true, price: true } } } },
    },
  });

  // Everything below respects the range filter when provided, otherwise falls back to all-time data.
  const revenueWhere = hasRange
    ? { status: 'PAYEE', createdAt: { gte: rangeStart!, lte: rangeEnd! } }
    : { status: 'PAYEE' };
  const expensesWhere = hasRange ? { date: { gte: rangeStart!, lte: rangeEnd! } } : {};
  const purchasesWhere = hasRange ? { date: { gte: rangeStart!, lte: rangeEnd! } } : {};
  const recentAppointmentsWhere = hasRange ? { date: { gte: rangeStart!, lte: rangeEnd! } } : {};
  const topServicesWhere = hasRange
    ? { appointment: { date: { gte: rangeStart!, lte: rangeEnd! } } }
    : {};
  // "Total clients" tracks clients with a reservation in the range (or ever, when
  // unfiltered) — same reservation-based logic as the other cards, not the raw
  // count of every client record regardless of activity.
  const totalClientsWhere = {
    appointments: { some: hasRange ? { date: { gte: rangeStart!, lte: rangeEnd! } } : {} },
  };

  const [
    totalClients,
    totalAppointments,
    todayAppointments,
    paidInvoices,
    expensesAgg,
    purchasesAgg,
    recentAppointments,
    topServicesRaw,
  ] = await Promise.all([
    db.client.count({ where: totalClientsWhere }),
    db.appointment.count({ where: recentAppointmentsWhere }),
    todayAppointmentsPromise,
    db.invoice.aggregate({ where: revenueWhere, _sum: { paidAmount: true } }),
    db.expense.aggregate({ where: expensesWhere, _sum: { amount: true } }),
    db.purchase.aggregate({ where: purchasesWhere, _sum: { amount: true } }),
    db.appointment.findMany({
      where: recentAppointmentsWhere,
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        services: { include: { service: { select: { id: true, name: true, price: true } } } },
      },
    }),
    db.appointmentService.groupBy({
      by: ['serviceId'],
      where: topServicesWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  const totalRevenue = paidInvoices._sum.paidAmount || 0;
  const totalExpenses = expensesAgg._sum.amount || 0;
  const totalPurchases = purchasesAgg._sum.amount || 0;

  const serviceIds = topServicesRaw.map((s) => s.serviceId);
  const services = serviceIds.length > 0
    ? await db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const topServices = topServicesRaw.map((s) => ({
    serviceName: serviceMap.get(s.serviceId) || 'Inconnu',
    count: s._count.id,
  }));

  // Monthly revenue/expenses chart: bucketed within the selected range, or the
  // trailing 6 months when showing all-time data (an unbounded all-time chart
  // would be unwieldy). Capped so a huge custom range can't blow up the chart.
  // rangeStart/rangeEnd were parsed from plain "YYYY-MM-DD" as UTC timestamps,
  // so their calendar month must be read back with the UTC getters too —
  // otherwise a server running ahead of UTC rolls the boundary into the next month.
  const chartStart = hasRange
    ? new Date(rangeStart!.getUTCFullYear(), rangeStart!.getUTCMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const uncappedChartEnd = hasRange
    ? new Date(rangeEnd!.getUTCFullYear(), rangeEnd!.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const maxChartEnd = new Date(chartStart.getFullYear(), chartStart.getMonth() + MAX_CHART_MONTHS, 0, 23, 59, 59, 999);
  const chartEnd = uncappedChartEnd < maxChartEnd ? uncappedChartEnd : maxChartEnd;

  const [monthlyRevenueInvoices, monthlyExpensesData, monthlyPurchasesData] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'PAYEE', createdAt: { gte: chartStart, lte: chartEnd } },
      select: { createdAt: true, paidAmount: true },
    }),
    db.expense.findMany({
      where: { date: { gte: chartStart, lte: chartEnd } },
      select: { date: true, amount: true },
    }),
    db.purchase.findMany({
      where: { date: { gte: chartStart, lte: chartEnd } },
      select: { date: true, amount: true },
    }),
  ]);

  const monthlyRevenueMap = new Map<string, number>();
  for (const inv of monthlyRevenueInvoices) {
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + inv.paidAmount);
  }

  const monthlyExpensesMap = new Map<string, number>();
  for (const exp of monthlyExpensesData) {
    const key = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, '0')}`;
    monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) || 0) + exp.amount);
  }

  const monthlyPurchasesMap = new Map<string, number>();
  for (const pur of monthlyPurchasesData) {
    const key = `${pur.date.getFullYear()}-${String(pur.date.getMonth() + 1).padStart(2, '0')}`;
    monthlyPurchasesMap.set(key, (monthlyPurchasesMap.get(key) || 0) + pur.amount);
  }

  const monthlyRevenue: { month: string; revenue: number }[] = [];
  const monthlyExpenses: { month: string; expenses: number }[] = [];
  const monthlyPurchases: { month: string; purchases: number }[] = [];

  const cursor = new Date(chartStart);
  while (cursor <= chartEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue.push({ month: key, revenue: monthlyRevenueMap.get(key) || 0 });
    monthlyExpenses.push({ month: key, expenses: monthlyExpensesMap.get(key) || 0 });
    monthlyPurchases.push({ month: key, purchases: monthlyPurchasesMap.get(key) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return NextResponse.json({
    filtered: hasRange,
    totalClients,
    totalAppointments,
    todayAppointments,
    totalRevenue,
    totalExpenses,
    totalPurchases,
    netProfit: totalRevenue - totalExpenses - totalPurchases,
    topServices,
    recentAppointments,
    monthlyRevenue,
    monthlyExpenses,
    monthlyPurchases,
  });
}
