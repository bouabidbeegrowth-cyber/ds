import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { isAlgerianPhoneNumber } from '@/lib/phone';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'clients', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'clients', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { firstName, lastName, phone, email, address, remarks } = body;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Prénom et nom sont requis' }, { status: 400 });
  }

  if (phone && !isAlgerianPhoneNumber(phone)) {
    return NextResponse.json({ error: 'Numéro algérien invalide' }, { status: 400 });
  }

  const client = await db.client.create({
    data: { firstName, lastName, phone: phone || null, email: email || null, address: address || null, remarks: remarks || null },
  });

  await logAudit({
    actor: auth.user,
    action: 'CREATE',
    entity: 'client',
    entityId: client.id,
    details: { firstName, lastName },
  });

  return NextResponse.json(client, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'clients', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  if (data.phone !== undefined && data.phone && !isAlgerianPhoneNumber(data.phone)) {
    return NextResponse.json({ error: 'Numéro algérien invalide' }, { status: 400 });
  }

  const client = await db.client.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.remarks !== undefined && { remarks: data.remarks || null }),
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'client',
    entityId: client.id,
    details: { firstName: client.firstName, lastName: client.lastName },
  });

  return NextResponse.json(client);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'clients', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  await db.client.delete({ where: { id } });

  await logAudit({
    actor: auth.user,
    action: 'DELETE',
    entity: 'client',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}