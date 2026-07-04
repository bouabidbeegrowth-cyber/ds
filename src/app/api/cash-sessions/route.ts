import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const sessionListInclude = {
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  _count: { select: { payments: true } },
  payments: { select: { amount: true } },
  purchases: { select: { amount: true } },
  expenses: { select: { amount: true } },
} as const;

function computeTotal(session: {
  payments: { amount: number }[];
  purchases: { amount: number }[];
  expenses: { amount: number }[];
}) {
  const totalIn = session.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOut =
    session.purchases.reduce((sum, p) => sum + p.amount, 0) +
    session.expenses.reduce((sum, e) => sum + e.amount, 0);
  return { totalIn, totalOut, total: totalIn - totalOut };
}

function withTotal<T extends { payments: { amount: number }[]; purchases: { amount: number }[]; expenses: { amount: number }[] }>(
  session: T
) {
  const { payments, purchases, expenses, ...rest } = session;
  return { ...rest, ...computeTotal({ payments, purchases, expenses }) };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'caisse', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const session = await db.cashSession.findUnique({
      where: { id },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: { select: { id: true, invoiceNumber: true, client: { select: { firstName: true, lastName: true } } } },
            actor: { select: { id: true, name: true } },
          },
        },
        purchases: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }
    return NextResponse.json({ ...session, ...computeTotal(session) });
  }

  const sessions = await db.cashSession.findMany({
    orderBy: { openedAt: 'desc' },
    include: sessionListInclude,
  });

  return NextResponse.json(sessions.map(withTotal));
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'caisse', 'write');
  if (permCheck) return permCheck;

  const openSession = await db.cashSession.findFirst({ where: { status: 'OUVERTE' } });
  if (openSession) {
    return NextResponse.json({ error: 'Une caisse est déjà ouverte. Fermez-la avant d\'en ouvrir une nouvelle.' }, { status: 409 });
  }

  const body = await req.json();
  const openingAmount = Number(body.openingAmount) || 0;
  if (openingAmount < 0) {
    return NextResponse.json({ error: 'Le montant d\'ouverture ne peut pas être négatif' }, { status: 400 });
  }

  const session = await db.cashSession.create({
    data: {
      openedById: auth.user.id,
      openingAmount,
      notes: body.notes || null,
    },
    include: sessionListInclude,
  });

  await logAudit({
    actor: auth.user,
    action: 'OPEN_SESSION',
    entity: 'cash_session',
    entityId: session.id,
    details: { openingAmount },
  });

  return NextResponse.json(withTotal(session), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'caisse', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, closingAmount, notes } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const existing = await db.cashSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
  }
  if (existing.status !== 'OUVERTE') {
    return NextResponse.json({ error: 'Cette caisse est déjà fermée' }, { status: 400 });
  }

  const session = await db.cashSession.update({
    where: { id },
    data: {
      status: 'FERMEE',
      closedAt: new Date(),
      closedById: auth.user.id,
      closingAmount: closingAmount !== undefined ? Number(closingAmount) : null,
      notes: notes !== undefined ? notes || null : existing.notes,
    },
    include: sessionListInclude,
  });

  const { totalIn, totalOut, total } = computeTotal(session);

  await logAudit({
    actor: auth.user,
    action: 'CLOSE_SESSION',
    entity: 'cash_session',
    entityId: session.id,
    details: { totalIn, totalOut, netTotal: total, closingAmount: session.closingAmount },
  });

  return NextResponse.json(withTotal(session));
}
