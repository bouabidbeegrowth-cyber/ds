'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/store/auth-store';
import { canWrite } from '@/lib/permissions';
import {
  FileText,
  Search,
  CreditCard,
  DollarSign,
  Check,
  X,
  AlertCircle,
  Eye,
  Download,
} from 'lucide-react';
import { generateInvoicePDF } from '@/lib/invoice-pdf';

// ── Types ──────────────────────────────────────────────────────────────────

interface ServiceData {
  name: string;
  price: number;
}

interface AppointmentData {
  services: { service: ServiceData }[];
}

interface ClientData {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: number;
  clientId: string;
  appointmentId: string;
  amount: number;
  status: 'PAYEE' | 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE';
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
  appointment: AppointmentData;
  client: ClientData;
}

type StatusFilter = 'ALL' | 'PAYEE' | 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' TND';

const getInvoiceNumber = (invoiceNumber: number): string =>
  'FAC-' + String(invoiceNumber).padStart(6, '0');

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_LABELS: Record<string, string> = {
  PAYEE: 'Payée',
  NON_PAYEE: 'Non payée',
  PARTIELLEMENT_PAYEE: 'Partiellement payée',
};

// ── Component ──────────────────────────────────────────────────────────────

export function InvoicesModule() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Fetch invoices ─────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('ds_token');
      if (!token) {
        setError('Non authentifié');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }

      const res = await fetch(`/api/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur de chargement');
      }

      const data: Invoice[] = await res.json();
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ── Filtered invoices (client search) ─────────────────────────────────

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter((inv) => {
      const fullName = `${inv.client.firstName} ${inv.client.lastName}`.toLowerCase();
      return fullName.includes(q);
    });
  }, [invoices, searchQuery]);

  const { page, setPage, pageItems: pagedInvoices, totalPages, totalItems, pageSize } = usePagination(filteredInvoices, 10);

  // ── Open payment dialog ───────────────────────────────────────────────

  const handleOpenDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditPaidAmount(String(invoice.paidAmount));
    setSaveError('');
    setDialogOpen(true);
  };

  // ── Save payment ──────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedInvoice) return;
    setSaving(true);
    setSaveError('');

    try {
      const token = localStorage.getItem('ds_token');
      if (!token) {
        setSaveError('Non authentifié');
        setSaving(false);
        return;
      }

      const body: { id: string; paidAmount?: number } = {
        id: selectedInvoice.id,
      };

      if (Number(editPaidAmount) !== selectedInvoice.paidAmount) {
        body.paidAmount = Number(editPaidAmount);
      }

      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur de mise à jour');
      }

      setDialogOpen(false);
      fetchInvoices();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  // ── Remaining amount calculation ──────────────────────────────────────

  const remainingAmount = useMemo(() => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.amount - Number(editPaidAmount || 0);
  }, [selectedInvoice, editPaidAmount]);

  // Payment status is always derived from the paid amount — never chosen manually.
  const previewStatus = useMemo(() => {
    if (!selectedInvoice) return 'NON_PAYEE';
    const paid = Number(editPaidAmount || 0);
    if (paid <= 0) return 'NON_PAYEE';
    if (paid >= selectedInvoice.amount) return 'PAYEE';
    return 'PARTIELLEMENT_PAYEE';
  }, [selectedInvoice, editPaidAmount]);

  // ── Status badge renderer ─────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'PAYEE':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <Check className="h-3 w-3 mr-1" />
            {STATUS_LABELS[status]}
          </Badge>
        );
      case 'PARTIELLEMENT_PAYEE':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS[status]}
          </Badge>
        );
      case 'NON_PAYEE':
      default:
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            {STATUS_LABELS[status]}
          </Badge>
        );
    }
  };

  // ── Loading skeletons ─────────────────────────────────────────────────

  const TableSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );

  // ── Summary stats ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter((i) => i.status === 'PAYEE').length;
    const unpaid = invoices.filter((i) => i.status === 'NON_PAYEE').length;
    const partial = invoices.filter(
      (i) => i.status === 'PARTIELLEMENT_PAYEE'
    ).length;
    return { total, paid, unpaid, partial };
  }, [invoices]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Gestion des factures
            </h1>
            <p className="text-sm text-muted-foreground">
              Suivi des paiements et factures
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Payées</p>
              <p className="text-lg font-bold text-emerald-600">{stats.paid}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
              <X className="h-4 w-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Non payées</p>
              <p className="text-lg font-bold text-red-600">{stats.unpaid}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Partielles</p>
              <p className="text-lg font-bold text-amber-600">{stats.partial}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main table card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Liste des factures</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as StatusFilter)}
            className="mt-2"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="ALL" className="text-xs sm:text-sm">
                Toutes
              </TabsTrigger>
              <TabsTrigger value="PAYEE" className="text-xs sm:text-sm">
                Payées
              </TabsTrigger>
              <TabsTrigger value="NON_PAYEE" className="text-xs sm:text-sm">
                Non payées
              </TabsTrigger>
              <TabsTrigger value="PARTIELLEMENT_PAYEE" className="text-xs sm:text-sm">
                Partielles
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {error ? (
            <div className="mx-6 mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={fetchInvoices}
              >
                Réessayer
              </Button>
            </div>
          ) : loading ? (
            <div className="px-6 pb-6">
              <TableSkeleton />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="px-6 pb-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Aucune facture trouvée
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery
                  ? 'Essayez un autre terme de recherche.'
                  : 'Les factures apparaîtront ici une fois créées.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <ScrollArea className="hidden max-h-[500px] overflow-y-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">N°</TableHead>
                      <TableHead className="px-4">Client</TableHead>
                      <TableHead className="px-4">Service</TableHead>
                      <TableHead className="px-4 text-right">Montant</TableHead>
                      <TableHead className="px-4 text-right">Payé</TableHead>
                      <TableHead className="px-4 text-right">Reste</TableHead>
                      <TableHead className="px-4">Statut</TableHead>
                      <TableHead className="px-4">Date</TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedInvoices.map((invoice) => {
                      const reste =
                        invoice.amount - invoice.paidAmount;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="px-4 font-mono text-xs font-medium text-muted-foreground">
                            {getInvoiceNumber(invoice.invoiceNumber)}
                          </TableCell>
                          <TableCell className="px-4 font-medium">
                            {invoice.client.firstName}{' '}
                            {invoice.client.lastName}
                          </TableCell>
                          <TableCell className="px-4 text-muted-foreground">
                            {invoice.appointment.services.map((as: { service: { name: string } }) => as.service.name).join(', ')}
                          </TableCell>
                          <TableCell className="px-4 text-right font-medium">
                            {formatAmount(invoice.amount)}
                          </TableCell>
                          <TableCell className="px-4 text-right text-emerald-600">
                            {formatAmount(invoice.paidAmount)}
                          </TableCell>
                          <TableCell
                            className={`px-4 text-right font-medium ${
                              reste > 0
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatAmount(reste)}
                          </TableCell>
                          <TableCell className="px-4">
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell className="px-4 text-muted-foreground text-xs">
                            {formatDate(invoice.createdAt)}
                          </TableCell>
                          <TableCell className="px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => generateInvoicePDF(invoice)}
                                title="Télécharger le PDF"
                              >
                                <Download className="h-4 w-4" />
                                <span className="sr-only">Télécharger le PDF</span>
                              </Button>
                              {canWrite(user?.permissions?.invoices) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenDialog(invoice)}
                                title="Voir / modifier"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">
                                  Voir / modifier
                                </span>
                              </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Mobile cards */}
              <div className="space-y-3 px-4 pb-4 md:hidden">
                {pagedInvoices.map((invoice) => {
                  const reste = invoice.amount - invoice.paidAmount;
                  return (
                    <Card key={invoice.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-medium text-muted-foreground">
                            {getInvoiceNumber(invoice.invoiceNumber)}
                          </p>
                          <p className="truncate font-medium">
                            {invoice.client.firstName} {invoice.client.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {invoice.appointment.services.map((as: { service: { name: string } }) => as.service.name).join(', ')}
                          </p>
                        </div>
                        <StatusBadge status={invoice.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-center text-xs">
                        <div>
                          <p className="text-muted-foreground">Montant</p>
                          <p className="font-medium">{formatAmount(invoice.amount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payé</p>
                          <p className="font-medium text-emerald-600">{formatAmount(invoice.paidAmount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reste</p>
                          <p className={`font-medium ${reste > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {formatAmount(reste)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => generateInvoicePDF(invoice)}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </Button>
                          {canWrite(user?.permissions?.invoices) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleOpenDialog(invoice)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Voir
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <PaginationBar
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Payment dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Détails de la facture
            </DialogTitle>
            <DialogDescription>
              Consultez et mettez à jour le paiement
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-5">
              {/* Invoice info */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      N° Facture
                    </p>
                    <p className="font-mono font-medium">
                      {getInvoiceNumber(selectedInvoice.invoiceNumber)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">
                      {selectedInvoice.client.firstName}{' '}
                      {selectedInvoice.client.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Service(s)</p>
                    <p className="font-medium">
                      {selectedInvoice.appointment.services.map((as: { service: { name: string } }) => as.service.name).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {formatDate(selectedInvoice.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md bg-background p-3 border">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Montant total
                    </span>
                  </div>
                  <span className="text-lg font-bold">
                    {formatAmount(selectedInvoice.amount)}
                  </span>
                </div>
              </div>

              {/* Status (derived automatically from paid amount, not editable) */}
              <div className="space-y-2">
                <Label>Statut de paiement</Label>
                <div className="flex items-center gap-2">
                  <StatusBadge status={previewStatus} />
                  <span className="text-xs text-muted-foreground">
                    Calculé automatiquement selon le montant payé
                  </span>
                </div>
              </div>

              {/* Paid amount */}
              <div className="space-y-2">
                <Label htmlFor="paid-amount">Montant payé</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="paid-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Remaining amount */}
              <div
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  remainingAmount > 0
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                }`}
              >
                <span className="text-sm font-medium">Reste à payer</span>
                <span
                  className={`text-lg font-bold ${
                    remainingAmount > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatAmount(remainingAmount)}
                </span>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {saveError}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedInvoice && (
              <Button
                variant="outline"
                onClick={() => generateInvoicePDF(selectedInvoice)}
                className="sm:mr-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Enregistrer
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}