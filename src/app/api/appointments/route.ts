import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requirePermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Appointments can only be scheduled today or in the future (calendar day, not time-of-day).
function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day < today;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'appointments', 'read');
  if (permCheck) return permCheck;

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

  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (employeeId) where.employeeId = employeeId;

  const appointments = await db.appointment.findMany({
    where,
    include: {
      client: true,
      services: { include: { service: true }, orderBy: { createdAt: 'asc' } },
      employee: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'appointments', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { clientId, serviceIds, employeeId, date, notes } = body;

  if (!clientId || !serviceIds?.length || !employeeId || !date) {
    return NextResponse.json({ error: 'Client, au moins un service, employé et date sont requis' }, { status: 400 });
  }

  if (isPastDate(new Date(date))) {
    return NextResponse.json({ error: 'La date du rendez-vous ne peut pas être dans le passé' }, { status: 400 });
  }

  const appointment = await db.appointment.create({
    data: {
      clientId,
      employeeId,
      date: new Date(date),
      notes: notes || null,
      services: {
        create: serviceIds.map((sid: string) => ({ serviceId: sid })),
      },
    },
    include: {
      client: true,
      services: { include: { service: true }, orderBy: { createdAt: 'asc' } },
      employee: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } },
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'CREATE',
    entity: 'appointment',
    entityId: appointment.id,
    details: { clientId, employeeId, date, services: serviceIds.length },
  });

  return NextResponse.json(appointment, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'appointments', 'write');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  if (data.date !== undefined && isPastDate(new Date(data.date))) {
    return NextResponse.json({ error: 'La date du rendez-vous ne peut pas être dans le passé' }, { status: 400 });
  }

  const existingInvoice = await db.invoice.findUnique({ where: { appointmentId: id } });

  // Once an appointment has an invoice, it's considered finalized: block any
  // change that would desync the invoice (status leaving TERMINE, or edits
  // to the services/client/employee/date the invoice amount was based on).
  const touchesFinalizedFields =
    (data.status !== undefined && data.status !== 'TERMINE') ||
    data.serviceIds !== undefined ||
    data.clientId !== undefined ||
    data.employeeId !== undefined ||
    data.date !== undefined;

  if (touchesFinalizedFields && existingInvoice) {
    return NextResponse.json(
      { error: 'Ce rendez-vous a une facture associée et ne peut plus être modifié.' },
      { status: 400 }
    );
  }

  // If status is changing to TERMINE, auto-generate invoice
  if (data.status === 'TERMINE') {
    if (!existingInvoice) {
      const appointment = await db.appointment.findUnique({
        where: { id },
        include: { services: { include: { service: true } } },
      });

      if (appointment) {
        const totalAmount = appointment.services.reduce(
          (sum, as) => sum + as.service.price,
          0
        );
        const lastInvoice = await db.invoice.findFirst({
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        });
        await db.invoice.create({
          data: {
            invoiceNumber: (lastInvoice?.invoiceNumber ?? 0) + 1,
            appointmentId: id,
            clientId: appointment.clientId,
            amount: totalAmount,
            status: 'NON_PAYEE',
            paidAmount: 0,
          },
        });

        await logAudit({
          actor: auth.user,
          action: 'CREATE',
          entity: 'invoice',
          entityId: id,
          details: { appointmentId: id, amount: totalAmount, source: 'AUTO_FROM_APPOINTMENT' },
        });
      }
    }
  }

  if (data.serviceIds !== undefined && !data.serviceIds.length) {
    return NextResponse.json({ error: 'Au moins un service est requis' }, { status: 400 });
  }

  const appointment = await db.appointment.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.employeeId !== undefined && { employeeId: data.employeeId }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.serviceIds !== undefined && {
        services: {
          deleteMany: {},
          create: (data.serviceIds as string[]).map((sid) => ({ serviceId: sid })),
        },
      }),
    },
    include: {
      client: true,
      services: { include: { service: true }, orderBy: { createdAt: 'asc' } },
      employee: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } },
    },
  });

  await logAudit({
    actor: auth.user,
    action: 'UPDATE',
    entity: 'appointment',
    entityId: appointment.id,
    details: { status: appointment.status, date: appointment.date.toISOString() },
  });

  return NextResponse.json(appointment);
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ('error' in auth) return auth.error;
  const permCheck = requirePermission(auth.user, 'appointments', 'delete');
  if (permCheck) return permCheck;

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID est requis' }, { status: 400 });
  }

  const appointment = await db.appointment.findUnique({ where: { id } });

  if (!appointment) {
    return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 });
  }

  if (appointment.status !== 'PROGRAMME') {
    return NextResponse.json({ error: 'Seuls les rendez-vous programmés peuvent être supprimés' }, { status: 400 });
  }

  await db.appointment.delete({ where: { id } });

  await logAudit({
    actor: auth.user,
    action: 'DELETE',
    entity: 'appointment',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}