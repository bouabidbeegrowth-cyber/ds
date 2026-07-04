import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const permCheck = requirePermission(auth.user, 'journal', 'read');
  if (permCheck) return permCheck;

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get('limit') || '100');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;

  const entries = await db.journalEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(entries);
}
