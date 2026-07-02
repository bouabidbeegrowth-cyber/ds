import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  const where: Record<string, unknown> = {};

  if (month) {
    const startDate = new Date(month + '-01T00:00:00.000Z');
    const [year, m] = month.split('-').map(Number);
    const endDate = new Date(year, m, 0, 23, 59, 59, 999);
    where.date = { gte: startDate, lte: endDate };
  }

  const purchases = await db.purchase.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json();
  const { label, supplier, amount, date, description } = body;

  if (!label || amount == null || !date) {
    return NextResponse.json({ error: 'Label, montant et date sont requis' }, { status: 400 });
  }

  const purchase = await db.purchase.create({
    data: {
      label,
      supplier: supplier || null,
      amount: Number(amount),
      date: new Date(date),
      description: description || null,
    },
  });

  return NextResponse.json(purchase, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const purchase = await db.purchase.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.supplier !== undefined && { supplier: data.supplier || null }),
      ...(data.amount !== undefined && { amount: Number(data.amount) }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
  });

  return NextResponse.json(purchase);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  await db.purchase.delete({ where: { id } });

  return NextResponse.json({ success: true });
}