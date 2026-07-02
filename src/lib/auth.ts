import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
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
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    if (!user || !user.active) {
      return { error: NextResponse.json({ error: 'Utilisateur invalide' }, { status: 401 }) };
    }

    return { user: user as AuthUser };
  } catch {
    return { error: NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) };
  }
}

export function requireAdmin(user: AuthUser): boolean {
  return user.role === 'ADMIN';
}