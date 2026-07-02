import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const user = await db.user.findUnique({ where: { username } });

    if (!user || user.password !== hash) {
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Compte désactivé. Contactez l\'administrateur.' }, { status: 403 });
    }

    const token = `ds_${user.id}_${Date.now()}`;

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}