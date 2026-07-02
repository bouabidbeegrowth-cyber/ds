import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureRolesSeeded } from '@/lib/seed-roles';
import { parsePermissions } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 });
    }

    // Ensure roles are seeded
    await ensureRolesSeeded();

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const user = await db.user.findUnique({
      where: { username },
      include: {
        roleRelation: {
          select: { id: true, name: true, permissions: true, isSystem: true },
        },
      },
    });

    if (!user || user.password !== hash) {
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Compte désactivé. Contactez l\'administrateur.' }, { status: 403 });
    }

    // Migrate user if no role assigned
    if (!user.roleId) {
      const targetRoleName = user.role === 'ADMIN' ? 'Administrateur' : 'Employé';
      const targetRole = await db.role.findFirst({ where: { name: targetRoleName } });
      if (targetRole) {
        await db.user.update({
          where: { id: user.id },
          data: { roleId: targetRole.id },
        });
        user.roleId = targetRole.id;
        user.roleRelation = targetRole;
      }
    }

    const roleName = user.roleRelation?.name || 'Employé';
    const permissions = user.roleRelation?.permissions
      ? parsePermissions(user.roleRelation.permissions)
      : parsePermissions('{}');
    const isSystemAdmin = user.roleRelation?.isSystem === true && user.roleRelation?.name === 'Administrateur';

    const token = `ds_${user.id}_${Date.now()}`;

    return NextResponse.json({
      token,
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