import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hash;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json();
  const { username, password, name, role } = body;

  if (!username || !password || !name) {
    return NextResponse.json({ error: 'Nom d\'utilisateur, mot de passe et nom sont requis' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'EMPLOYEE'];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
  }

  // Check if username already exists
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: 'Nom d\'utilisateur déjà utilisé' }, { status: 409 });
  }

  const hashedPassword = await hashPassword(password);

  const user = await db.user.create({
    data: {
      username,
      password: hashedPassword,
      name,
      role: role || 'EMPLOYEE',
    },
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(user, { status: 201 });
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

  if (data.role !== undefined) {
    const validRoles = ['ADMIN', 'EMPLOYEE'];
    if (!validRoles.includes(data.role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.active !== undefined) updateData.active = Boolean(data.active);
  if (data.password) {
    updateData.password = await hashPassword(data.password);
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(user);
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

  // Soft delete: deactivate user
  const user = await db.user.update({
    where: { id },
    data: { active: false },
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(user);
}