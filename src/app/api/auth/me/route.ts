import { NextRequest, NextResponse } from 'next/server';

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
    const { db } = await import('@/lib/db');
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}