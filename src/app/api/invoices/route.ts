import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

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
          service: true,
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

  const body = await req.json();
  const { id, status, paidAmount } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) {
    updateData.status = status;
  }
  if (paidAmount !== undefined) {
    updateData.paidAmount = Number(paidAmount);
  }

  const invoice = await db.invoice.update({
    where: { id },
    data: updateData,
    include: {
      client: true,
      appointment: {
        include: {
          service: true,
        },
      },
    },
  });

  return NextResponse.json(invoice);
}