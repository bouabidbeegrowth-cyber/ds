import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const status = searchParams.get('status');
  const clientId = searchParams.get('clientId');
  const employeeId = searchParams.get('employeeId');

  const where: Record<string, unknown> = {};

  if (date) {
    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');
    where.date = { gte: start, lte: end };
  }

  if (status) {
    where.status = status;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  if (employeeId) {
    where.employeeId = employeeId;
  }

  const appointments = await db.appointment.findMany({
    where,
    include: {
      client: true,
      service: true,
      employee: { select: { id: true, name: true, role: true } },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { clientId, serviceId, employeeId, date, notes } = body;

  if (!clientId || !serviceId || !employeeId || !date) {
    return NextResponse.json({ error: 'Client, service, employé et date sont requis' }, { status: 400 });
  }

  const appointment = await db.appointment.create({
    data: {
      clientId,
      serviceId,
      employeeId,
      date: new Date(date),
      notes: notes || null,
    },
    include: {
      client: true,
      service: true,
      employee: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(appointment, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  // If status is changing to TERMINE, check if invoice already exists
  if (data.status === 'TERMINE') {
    const existingInvoice = await db.invoice.findUnique({
      where: { appointmentId: id },
    });

    if (!existingInvoice) {
      // Get the appointment with service price
      const appointment = await db.appointment.findUnique({
        where: { id },
        include: { service: true },
      });

      if (appointment) {
        // Create invoice automatically
        await db.invoice.create({
          data: {
            appointmentId: id,
            clientId: appointment.clientId,
            amount: appointment.service.price,
            status: 'NON_PAYEE',
            paidAmount: 0,
          },
        });
      }
    }
  }

  const appointment = await db.appointment.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
      ...(data.employeeId !== undefined && { employeeId: data.employeeId }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
    },
    include: {
      client: true,
      service: true,
      employee: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(appointment);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const appointment = await db.appointment.findUnique({
    where: { id },
  });

  if (!appointment) {
    return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 });
  }

  if (appointment.status !== 'PROGRAMME') {
    return NextResponse.json({ error: 'Seuls les rendez-vous programmés peuvent être supprimés' }, { status: 400 });
  }

  await db.appointment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}