import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'purchases', 'read');
  if (permCheck) return permCheck;

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
  const permCheck = requirePermission(auth.user, 'purchases', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { label, supplier, amount, description } = body;

  if (!label || amount == null) {
    return NextResponse.json({ error: 'Label et montant sont requis' }, { status: 400 });
  }

  // The date is always "now" — it records when the purchase was made, not a
  // user-editable field.
  const now = new Date();

  // If a cash session is currently open, this purchase is assumed paid from the
  // till and is deducted from that session's total.
  const openSession = await db.cashSession.findFirst({ where: { status: 'OUVERTE' } });

  const purchase = await db.purchase.create({
    data: {
      label,
      supplier: supplier || null,
      amount: Number(amount),
      date: now,
      description: description || null,
      sessionId: openSession?.id ?? null,
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'CREATE',
    entity: 'purchase',
    entityId: purchase.id,
    details: { label, amount: Number(amount) },
  });

  return NextResponse.json(purchase, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'purchases', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  // The date is never editable — it stays fixed to when the purchase was made.
  const purchase = await db.purchase.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.supplier !== undefined && { supplier: data.supplier || null }),
      ...(data.amount !== undefined && { amount: Number(data.amount) }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'purchase',
    entityId: purchase.id,
    details: { label: purchase.label, amount: purchase.amount, date: purchase.date.toISOString() },
  });

  return NextResponse.json(purchase);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'purchases', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  await db.purchase.delete({ where: { id } });

  await logAudit({
    actor: auth.user,
    action: 'DELETE',
    entity: 'purchase',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}