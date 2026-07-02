import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'services', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('active') === 'true';

  const services = await db.service.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'services', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { name, price, duration, description } = body;

  if (!name || price == null || !duration) {
    return NextResponse.json({ error: 'Nom, prix et durée sont requis' }, { status: 400 });
  }

  const service = await db.service.create({
    data: { name, price: Number(price), duration: Number(duration), description: description || null },
  });

  return NextResponse.json(service, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'services', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const service = await db.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.price !== undefined && { price: Number(data.price) }),
      ...(data.duration !== undefined && { duration: Number(data.duration) }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.active !== undefined && { active: Boolean(data.active) }),
    },
  });

  return NextResponse.json(service);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'services', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  await db.service.delete({ where: { id } });

  return NextResponse.json({ success: true });
}