import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';

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
  const { label, category, amount, date, description } = body;

  if (!label || !category || amount == null || !date) {
    return NextResponse.json({ error: 'Label, catégorie, montant et date sont requis' }, { status: 400 });
  }

  const validCategories = ['LOYER', 'ELECTRICITE', 'SALAIRES', 'FOURNITURES', 'AUTRE'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 });
  }

  const expense = await db.expense.create({
    data: {
      label,
      category,
      amount: Number(amount),
      date: new Date(date),
      description: description || null,
    },
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

  const expense = await db.expense.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.amount !== undefined && { amount: Number(data.amount) }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
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

  return NextResponse.json({ success: true });
}