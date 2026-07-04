import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { parsePermissions, serializePermissions, type Permissions, ALL_MODULES, DEFAULT_PERMISSIONS } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  // Only users with full access to 'users' module can manage roles
  const permCheck = requirePermission(auth.user, 'users', 'read');
  if (permCheck) return permCheck;

  // Extract search query parameter
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';

  const roles = await db.role.findMany({
    include: {
      _count: {
        select: { users: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Filter by search query if provided
  const filtered = q
    ? roles.filter((role) => role.name.toLowerCase().includes(q))
    : roles;

  const formatted = filtered.map((role) => ({
    id: role.id,
    name: role.name,
    permissions: parsePermissions(role.permissions),
    isSystem: role.isSystem,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));

  return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const permCheck = requirePermission(auth.user, 'users', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { name, permissions } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Le nom du rôle est requis' }, { status: 400 });
  }

  // Validate permissions structure
  const perms: Permissions = { ...DEFAULT_PERMISSIONS };
  if (permissions && typeof permissions === 'object') {
    for (const mod of ALL_MODULES) {
      if (permissions[mod] && ['none', 'read', 'write', 'full'].includes(permissions[mod])) {
        perms[mod] = permissions[mod];
      }
    }
  }

  // Check if name already exists
  const existing = await db.role.findFirst({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'Un rôle avec ce nom existe déjà' }, { status: 409 });
  }

  const role = await db.role.create({
    data: {
      name: name.trim(),
      permissions: serializePermissions(perms),
      isSystem: false,
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'CREATE',
    entity: 'role',
    entityId: role.id,
    details: { name: role.name },
  });

  return NextResponse.json({
    id: role.id,
    name: role.name,
    permissions: perms,
    isSystem: role.isSystem,
    userCount: 0,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const permCheck = requirePermission(auth.user, 'users', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, name, permissions } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const existing = await db.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: 'Le nom du rôle est requis' }, { status: 400 });
    }
    // Check uniqueness
    const duplicate = await db.role.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Un rôle avec ce nom existe déjà' }, { status: 409 });
    }
    updateData.name = name.trim();
  }

  if (permissions !== undefined) {
    const perms: Permissions = { ...DEFAULT_PERMISSIONS };
    if (permissions && typeof permissions === 'object') {
      for (const mod of ALL_MODULES) {
        if (permissions[mod] && ['none', 'read', 'write', 'full'].includes(permissions[mod])) {
          perms[mod] = permissions[mod];
        }
      }
    }
    updateData.permissions = serializePermissions(perms);
  }

  const role = await db.role.update({
    where: { id },
    data: updateData,
    include: {
      _count: { select: { users: true } },
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'role',
    entityId: role.id,
    details: { name: role.name },
  });

  return NextResponse.json({
    id: role.id,
    name: role.name,
    permissions: parsePermissions(role.permissions),
    isSystem: role.isSystem,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const permCheck = requirePermission(auth.user, 'users', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const role = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) {
    return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json({ error: 'Ce rôle système ne peut pas être supprimé' }, { status: 403 });
  }

  if (role._count.users > 0) {
    return NextResponse.json(
      { error: 'Ce rôle est assigné à des utilisateurs et ne peut pas être supprimé. Réassignez les utilisateurs d\'abord.' },
      { status: 409 }
    );
  }

  await db.role.delete({ where: { id } });

  await logAudit({
    actor: auth.user,
    action: 'DELETE',
    entity: 'role',
    entityId: id,
    details: { name: role.name },
  });

  return NextResponse.json({ success: true });
}