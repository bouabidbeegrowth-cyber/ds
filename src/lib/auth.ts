import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parsePermissions, type Permissions, type ModuleKey } from '@/lib/permissions';
import { ensureRolesSeeded } from '@/lib/seed-roles';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  roleId: string | null;
  roleName: string;
  permissions: Permissions;
  isSystemAdmin: boolean;
}

export async function verifyAuth(req: NextRequest): Promise<{ user: AuthUser; error?: never } | { error: NextResponse }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }

  const parts = token.split('_');
  if (parts.length < 3 || parts[0] !== 'ds') {
    return { error: NextResponse.json({ error: 'Token invalide' }, { status: 401 }) };
  }

  const userId = parts[1];
  try {
    // Ensure roles are seeded
    await ensureRolesSeeded();

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        roleRelation: {
          select: { id: true, name: true, permissions: true, isSystem: true },
        },
      },
    });

    if (!user || !user.active) {
      return { error: NextResponse.json({ error: 'Utilisateur invalide' }, { status: 401 }) };
    }

    // Fallback: if user has no role assigned, assign default employee role
    let roleId = user.roleId;
    let roleName = user.roleRelation?.name || 'Employé';
    let permissions = user.roleRelation?.permissions
      ? parsePermissions(user.roleRelation.permissions)
      : parsePermissions('{}');
    let isSystemAdmin = user.roleRelation?.isSystem && user.roleRelation?.name === 'Administrateur';

    if (!roleId) {
      // Migrate on the fly
      const empRole = await db.role.findFirst({ where: { name: 'Employé' } });
      if (empRole) {
        await db.user.update({
          where: { id: userId },
          data: { roleId: empRole.id },
        });
        roleId = empRole.id;
        roleName = empRole.name;
        permissions = parsePermissions(empRole.permissions);
      }
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        roleId: roleId || null,
        roleName,
        permissions,
        isSystemAdmin,
      },
    };
  } catch {
    return { error: NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) };
  }
}

// Check if user has a specific permission level for a module
export function hasModulePermission(
  user: AuthUser,
  module: ModuleKey,
  action: 'read' | 'write' | 'delete'
): boolean {
  const level = user.permissions[module] || 'none';
  switch (action) {
    case 'read':
      return level !== 'none';
    case 'write':
      return level === 'write' || level === 'full';
    case 'delete':
      return level === 'full';
  }
}

// Helper for API routes to check permissions
export function requirePermission(user: AuthUser, module: ModuleKey, action: 'read' | 'write' | 'delete'): NextResponse | null {
  if (!hasModulePermission(user, module, action)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  return null;
}