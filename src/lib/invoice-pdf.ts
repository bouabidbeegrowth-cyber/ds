import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type InvoicePdfData = {
  id: string;
  invoiceNumber: number;
  amount: number;
  paidAmount: number;
  status: 'PAYEE' | 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE';
  createdAt: string;
  client: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  appointment: {
    services: { service: { name: string; price: number } }[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  PAYEE: 'Payée',
  NON_PAYEE: 'Non payée',
  PARTIELLEMENT_PAYEE: 'Partiellement payée',
};

const getInvoiceNumber = (invoiceNumber: number): string =>
  'FAC-' + String(invoiceNumber).padStart(6, '0');

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' TND';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

let logoDataUrlCache: string | null = null;

async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const res = await fetch('/ds-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    logoDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    // Logo is a nice-to-have; the invoice still generates fine without it.
    return null;
  }
}

export async function generateInvoicePDF(invoice: InvoicePdfData): Promise<void> {
  const doc = new jsPDF();
  const invoiceNumber = getInvoiceNumber(invoice.invoiceNumber);
  const remaining = invoice.amount - invoice.paidAmount;

  // Header
  const logoDataUrl = await loadLogoDataUrl();
  const textX = logoDataUrl ? 36 : 14;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 14, 10, 18, 18);
  }

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DS Esthétique', textX, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Centre de beauté', textX, 26);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 196, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceNumber, 196, 26, { align: 'right' });
  doc.text(formatDate(invoice.createdAt), 196, 31, { align: 'right' });

  doc.setDrawColor(200);
  doc.line(14, 36, 196, 36);

  // Client info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturé à', 14, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 52;
  doc.text(`${invoice.client.firstName} ${invoice.client.lastName}`, 14, y);
  if (invoice.client.phone) {
    y += 5;
    doc.text(invoice.client.phone, 14, y);
  }
  if (invoice.client.email) {
    y += 5;
    doc.text(invoice.client.email, 14, y);
  }
  if (invoice.client.address) {
    y += 5;
    doc.text(invoice.client.address, 14, y);
  }

  // Services table
  const rows = invoice.appointment.services.map((s) => [
    s.service.name,
    formatAmount(s.service.price),
  ]);

  autoTable(doc, {
    startY: Math.max(y + 10, 66),
    head: [['Service', 'Prix']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [194, 110, 173] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Totals — jspdf-autotable augments the doc instance with this at runtime,
  // but ships no type augmentation for it, hence the narrow cast.
  const docWithTable = doc as unknown as { lastAutoTable: { finalY: number } };
  const finalY = docWithTable.lastAutoTable.finalY + 10;

  const totalsX = 140;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant total', totalsX, finalY);
  doc.text(formatAmount(invoice.amount), 196, finalY, { align: 'right' });

  doc.text('Montant payé', totalsX, finalY + 6);
  doc.text(formatAmount(invoice.paidAmount), 196, finalY + 6, { align: 'right' });

  doc.setDrawColor(200);
  doc.line(totalsX, finalY + 10, 196, finalY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Reste à payer', totalsX, finalY + 16);
  doc.text(formatAmount(remaining), 196, finalY + 16, { align: 'right' });

  // Status
  doc.setFontSize(11);
  doc.text(`Statut : ${STATUS_LABELS[invoice.status] || invoice.status}`, 14, finalY + 16);

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(
    `DS Esthétique — Gestion du centre de beauté — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    14,
    285
  );

  doc.save(`${invoiceNumber}.pdf`);
}
