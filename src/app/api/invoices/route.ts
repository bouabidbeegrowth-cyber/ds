import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'invoices', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};

  if (clientId) {
    where.clientId = clientId;
  }

  if (status) {
    where.status = status;
  }

  const invoices = await db.invoice.findMany({
    where,
    include: {
      client: true,
      appointment: {
        include: {
          services: { include: { service: { select: { id: true, name: true, price: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(invoices);
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'invoices', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, paidAmount } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const existing = await db.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  let paymentDelta = 0;

  // Payment status is always derived from paidAmount vs. amount — never set manually.
  if (paidAmount !== undefined) {
    const newPaidAmount = Number(paidAmount);
    if (Number.isNaN(newPaidAmount) || newPaidAmount < 0) {
      return NextResponse.json({ error: 'Montant payé invalide' }, { status: 400 });
    }
    if (newPaidAmount > existing.amount) {
      return NextResponse.json({ error: 'Le montant payé ne peut pas dépasser le montant total' }, { status: 400 });
    }
    paymentDelta = newPaidAmount - existing.paidAmount;
    updateData.paidAmount = newPaidAmount;
    updateData.status =
      newPaidAmount <= 0 ? 'NON_PAYEE'
      : newPaidAmount >= existing.amount ? 'PAYEE'
      : 'PARTIELLEMENT_PAYEE';
  }

  // Any newly received money must be recorded against the currently open cash
  // session — only that session's portion counts towards its total, so an
  // invoice paid across two sessions correctly splits between them.
  let openSessionId: string | null = null;
  if (paymentDelta > 0) {
    const openSession = await db.cashSession.findFirst({ where: { status: 'OUVERTE' } });
    if (!openSession) {
      return NextResponse.json(
        { error: 'Aucune caisse ouverte. Ouvrez une caisse avant d\'enregistrer un paiement.' },
        { status: 400 }
      );
    }
    openSessionId = openSession.id;
  }

  const invoice = await db.invoice.update({
    where: { id },
    data: updateData,
    include: {
      client: true,
      appointment: {
        include: {
          services: { include: { service: { select: { id: true, name: true, price: true } } } },
        },
      },
    },
  });

  if (paymentDelta > 0 && openSessionId) {
    await db.payment.create({
      data: {
        invoiceId: invoice.id,
        sessionId: openSessionId,
        amount: paymentDelta,
        actorId: auth.user.id,
      },
    });
  }

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'invoice',
    entityId: invoice.id,
    details: { status: invoice.status, paidAmount: invoice.paidAmount, sessionPayment: paymentDelta > 0 ? paymentDelta : undefined },
  });

  return NextResponse.json(invoice);
}