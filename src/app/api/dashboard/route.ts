import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Run all queries in parallel
  const [
    totalClients,
    todayAppointments,
    paidInvoices,
    currentMonthExpenses,
    topServices,
    recentAppointments,
    monthlyRevenueInvoices,
    monthlyExpensesData,
  ] = await Promise.all([
    // Total clients
    db.client.count(),

    // Today's appointments
    db.appointment.count({
      where: { date: { gte: todayStart, lte: todayEnd } },
    }),

    // Total revenue (paid invoices)
    db.invoice.aggregate({
      where: { status: 'PAYEE' },
      _sum: { paidAmount: true },
    }),

    // Current month expenses
    db.expense.aggregate({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { amount: true },
    }),

    // Top 5 services by appointment count
    db.appointment.groupBy({
      by: ['serviceId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),

    // Last 10 appointments with client and service info
    db.appointment.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    }),

    // Monthly revenue - last 6 months (all invoices, use paidAmount for PAYEE)
    db.invoice.findMany({
      where: {
        status: 'PAYEE',
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          lte: currentMonthEnd,
        },
      },
      select: { createdAt: true, paidAmount: true },
    }),

    // Monthly expenses - last 6 months
    db.expense.findMany({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          lte: currentMonthEnd,
        },
      },
      select: { date: true, amount: true },
    }),
  ]);

  const totalRevenue = paidInvoices._sum.paidAmount || 0;
  const totalExpenses = currentMonthExpenses._sum.amount || 0;

  // Resolve top services with names
  const serviceIds = topServices.map((s) => s.serviceId);
  const services = await db.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const topServicesResult = topServices.map((s) => ({
    serviceName: serviceMap.get(s.serviceId) || 'Inconnu',
    count: s._count.id,
  }));

  // Monthly revenue data
  const monthlyRevenueMap = new Map<string, number>();
  for (const inv of monthlyRevenueInvoices) {
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + inv.paidAmount);
  }

  // Monthly expenses data
  const monthlyExpensesMap = new Map<string, number>();
  for (const exp of monthlyExpensesData) {
    const key = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, '0')}`;
    monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) || 0) + exp.amount);
  }

  // Build last 6 months arrays
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  const monthlyExpenses: { month: string; expenses: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue.push({ month: key, revenue: monthlyRevenueMap.get(key) || 0 });
    monthlyExpenses.push({ month: key, expenses: monthlyExpensesMap.get(key) || 0 });
  }

  return NextResponse.json({
    totalClients,
    todayAppointments,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    topServices: topServicesResult,
    recentAppointments,
    monthlyRevenue,
    monthlyExpenses,
  });
}