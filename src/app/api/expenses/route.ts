import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'expenses', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const category = searchParams.get('category');

  const where: Record<string, unknown> = {};

  if (month) {
    const startDate = new Date(month + '-01T00:00:00.000Z');
    const [year, m] = month.split('-').map(Number);
    const endDate = new Date(year, m, 0, 23, 59, 59, 999);
    where.date = { gte: startDate, lte: endDate };
  }

  if (category) {
    where.category = category;
  }

  const expenses = await db.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'expenses', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { label, category, amount, description } = body;

  if (!label || !category || amount == null) {
    return NextResponse.json({ error: 'Label, catégorie et montant sont requis' }, { status: 400 });
  }

  const validCategories = ['LOYER', 'ELECTRICITE', 'SALAIRES', 'FOURNITURES', 'AUTRE'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 });
  }

  // The date is always "now" — it records when the expense was made, not a
  // user-editable field.
  const now = new Date();

  // If a cash session is currently open, this expense is assumed paid from the
  // till and is deducted from that session's total.
  const openSession = await db.cashSession.findFirst({ where: { status: 'OUVERTE' } });

  const expense = await db.expense.create({
    data: {
      label,
      category,
      amount: Number(amount),
      date: now,
      description: description || null,
      sessionId: openSession?.id ?? null,
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'CREATE',
    entity: 'expense',
    entityId: expense.id,
    details: { label, category, amount: Number(amount) },
  });

  return NextResponse.json(expense, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'expenses', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  if (data.category !== undefined) {
    const validCategories = ['LOYER', 'ELECTRICITE', 'SALAIRES', 'FOURNITURES', 'AUTRE'];
    if (!validCategories.includes(data.category)) {
      return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 });
    }
  }

  // The date is never editable — it stays fixed to when the expense was made.
  const expense = await db.expense.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.amount !== undefined && { amount: Number(data.amount) }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'expense',
    entityId: expense.id,
    details: { label: expense.label, category: expense.category, amount: expense.amount, date: expense.date.toISOString() },
  });

  return NextResponse.json(expense);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'expenses', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  await db.expense.delete({ where: { id } });

  await logAudit({
    actor: auth.user,
    action: 'DELETE',
    entity: 'expense',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}