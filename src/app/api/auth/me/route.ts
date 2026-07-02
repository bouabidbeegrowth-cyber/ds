import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureRolesSeeded } from '@/lib/seed-roles';
import { parsePermissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Token is ds_{userId}_{timestamp}
  const parts = token.split('_');
  if (parts.length < 3 || parts[0] !== 'ds') {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  const userId = parts[1];
  try {
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
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 401 });
    }

    const roleName = user.roleRelation?.name || 'Employé';
    const permissions = user.roleRelation?.permissions
      ? parsePermissions(user.roleRelation.permissions)
      : parsePermissions('{}');
    const isSystemAdmin = user.roleRelation?.isSystem === true && user.roleRelation?.name === 'Administrateur';

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        roleId: user.roleId,
        roleName,
        permissions,
        isSystemAdmin,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}