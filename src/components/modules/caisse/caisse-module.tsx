'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { canWrite, canRead } from '@/lib/permissions';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wallet, Lock, Unlock, Plus, RefreshCw, Shield, Receipt, ShoppingCart, TrendingDown } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  name: string;
}

interface SessionSummary {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedById: string;
  closedById: string | null;
  openingAmount: number;
  closingAmount: number | null;
  status: 'OUVERTE' | 'FERMEE';
  notes: string | null;
  openedBy: SessionUser;
  closedBy: SessionUser | null;
  _count: { payments: number };
  totalIn: number;
  totalOut: number;
  total: number;
}

interface PaymentDetail {
  id: string;
  amount: number;
  createdAt: string;
  invoice: { id: string; invoiceNumber: number; client: { firstName: string; lastName: string } };
  actor: { id: string; name: string };
}

interface OutflowDetail {
  id: string;
  label: string;
  amount: number;
  createdAt: string;
}

interface SessionDetail extends SessionSummary {
  payments: PaymentDetail[];
  purchases: OutflowDetail[];
  expenses: OutflowDetail[];
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ds_token');
}

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' TND';

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getInvoiceNumber = (n: number): string => 'FAC-' + String(n).padStart(6, '0');

export function CaisseModule() {
  const currentUser = useAuthStore((s) => s.user);
  const canView = canRead(currentUser?.permissions?.caisse);
  const canManage = canWrite(currentUser?.permissions?.caisse);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [openSessionDetail, setOpenSessionDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Open dialog
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openNotes, setOpenNotes] = useState('');
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState('');

  // Close dialog
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/cash-sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement');
        return;
      }
      const data: SessionSummary[] = await res.json();
      setSessions(data);
      setError('');

      const open = data.find((s) => s.status === 'OUVERTE');
      if (open) {
        const detailRes = await fetch(`/api/cash-sessions?id=${open.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (detailRes.ok) {
          setOpenSessionDetail(await detailRes.json());
        }
      } else {
        setOpenSessionDetail(null);
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchSessions();
    else setLoading(false);
  }, [canView, fetchSessions]);

  const { page, setPage, pageItems: pagedSessions, totalPages, totalItems, pageSize } = usePagination(sessions, 10);

  const handleOpenSession = async () => {
    setOpenError('');
    const amount = Number(openingAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setOpenError('Montant d\'ouverture invalide');
      return;
    }
    setOpenLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/cash-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ openingAmount: amount, notes: openNotes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setOpenError(data.error || 'Erreur lors de l\'ouverture');
        return;
      }
      setOpenDialogOpen(false);
      setOpeningAmount('0');
      setOpenNotes('');
      fetchSessions();
    } catch {
      setOpenError('Erreur de connexion au serveur');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!openSessionDetail) return;
    setCloseError('');
    setCloseLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/cash-sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: openSessionDetail.id,
          closingAmount: closingAmount === '' ? undefined : Number(closingAmount),
          notes: closeNotes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCloseError(data.error || 'Erreur lors de la fermeture');
        return;
      }
      setCloseDialogOpen(false);
      setClosingAmount('');
      setCloseNotes('');
      fetchSessions();
    } catch {
      setCloseError('Erreur de connexion au serveur');
    } finally {
      setCloseLoading(false);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Vous n&apos;avez pas accès à la caisse.</p>
        </CardContent>
      </Card>
    );
  }

  const expectedTotal = openSessionDetail
    ? openSessionDetail.openingAmount + openSessionDetail.total
    : 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Caisse</h2>
            <p className="text-sm text-muted-foreground">
              Suivi des sessions de caisse et des paiements encaissés.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      ) : openSessionDetail ? (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Unlock className="h-4 w-4 text-emerald-600" />
              Caisse ouverte
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {formatDateTime(openSessionDetail.openedAt)}
              </Badge>
            </CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setClosingAmount('');
                  setCloseNotes('');
                  setCloseError('');
                  setCloseDialogOpen(true);
                }}
              >
                <Lock className="h-4 w-4 mr-2" />
                Fermer la caisse
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ouverte par</p>
                <p className="font-medium">{openSessionDetail.openedBy.name}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Fonds d&apos;ouverture</p>
                <p className="font-medium">{formatAmount(openSessionDetail.openingAmount)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Encaissements</p>
                <p className="font-medium text-emerald-600">+{formatAmount(openSessionDetail.totalIn)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Achats / Dépenses</p>
                <p className="font-medium text-red-600">-{formatAmount(openSessionDetail.totalOut)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">Total attendu en caisse</p>
                <p className="font-semibold text-primary">{formatAmount(expectedTotal)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Paiements encaissés ({openSessionDetail.payments.length})
              </p>
              {openSessionDetail.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  Aucun paiement encaissé pour l&apos;instant.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Heure</TableHead>
                        <TableHead>Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Encaissé par</TableHead>
                        <TableHead className="pr-4 text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openSessionDetail.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                            {formatDateTime(p.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {getInvoiceNumber(p.invoice.invoiceNumber)}
                          </TableCell>
                          <TableCell>
                            {p.invoice.client.firstName} {p.invoice.client.lastName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.actor.name}</TableCell>
                          <TableCell className="pr-4 text-right font-medium text-emerald-600">
                            {formatAmount(p.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" />
                Achats et dépenses réglés depuis la caisse ({openSessionDetail.purchases.length + openSessionDetail.expenses.length})
              </p>
              {openSessionDetail.purchases.length === 0 && openSessionDetail.expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  Aucun achat ou dépense réglé depuis cette caisse.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead className="pr-4 text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ...openSessionDetail.purchases.map((p) => ({ ...p, kind: 'Achat' as const })),
                        ...openSessionDetail.expenses.map((e) => ({ ...e, kind: 'Dépense' as const })),
                      ]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((o) => (
                          <TableRow key={`${o.kind}-${o.id}`}>
                            <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                              {formatDateTime(o.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <ShoppingCart className="h-3 w-3" />
                                {o.kind}
                              </Badge>
                            </TableCell>
                            <TableCell>{o.label}</TableCell>
                            <TableCell className="pr-4 text-right font-medium text-red-600">
                              -{formatAmount(o.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Aucune caisse n&apos;est ouverte actuellement.</p>
            {canManage && (
              <Button
                onClick={() => {
                  setOpeningAmount('0');
                  setOpenNotes('');
                  setOpenError('');
                  setOpenDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ouvrir une caisse
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Aucune session enregistrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Ouverture</TableHead>
                  <TableHead>Fermeture</TableHead>
                  <TableHead>Ouverte par</TableHead>
                  <TableHead className="text-right">Fonds initial</TableHead>
                  <TableHead className="text-right">Encaissements</TableHead>
                  <TableHead className="text-right">Achats/Dépenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Compté à la fermeture</TableHead>
                  <TableHead className="pr-4">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(s.openedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                    </TableCell>
                    <TableCell>{s.openedBy.name}</TableCell>
                    <TableCell className="text-right">{formatAmount(s.openingAmount)}</TableCell>
                    <TableCell className="text-right text-emerald-600">+{formatAmount(s.totalIn)}</TableCell>
                    <TableCell className="text-right text-red-600">-{formatAmount(s.totalOut)}</TableCell>
                    <TableCell className="text-right font-medium">{formatAmount(s.total)}</TableCell>
                    <TableCell className="text-right">
                      {s.closingAmount !== null ? formatAmount(s.closingAmount) : '—'}
                    </TableCell>
                    <TableCell className="pr-4">
                      {s.status === 'OUVERTE' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ouverte</Badge>
                      ) : (
                        <Badge variant="outline">Fermée</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Open session dialog */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ouvrir une caisse</DialogTitle>
            <DialogDescription>
              Indiquez le fonds de caisse de départ (espèces déjà présentes).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {openError && (
              <Alert variant="destructive">
                <AlertDescription>{openError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="opening-amount">Montant d&apos;ouverture</Label>
              <Input
                id="opening-amount"
                type="number"
                min={0}
                step={0.01}
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="open-notes">Notes (optionnel)</Label>
              <Textarea
                id="open-notes"
                rows={3}
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialogOpen(false)} disabled={openLoading}>
              Annuler
            </Button>
            <Button onClick={handleOpenSession} disabled={openLoading}>
              {openLoading ? 'Ouverture...' : 'Ouvrir la caisse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close session dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fermer la caisse</DialogTitle>
            <DialogDescription>
              {openSessionDetail && (
                <>Total attendu : {formatAmount(expectedTotal)} (fonds d&apos;ouverture + encaissements de cette session).</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {closeError && (
              <Alert variant="destructive">
                <AlertDescription>{closeError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="closing-amount">Montant compté (optionnel)</Label>
              <Input
                id="closing-amount"
                type="number"
                min={0}
                step={0.01}
                placeholder="Montant réellement compté en caisse"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-notes">Notes (optionnel)</Label>
              <Textarea
                id="close-notes"
                rows={3}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={closeLoading}>
              Annuler
            </Button>
            <Button onClick={handleCloseSession} disabled={closeLoading} variant="destructive">
              {closeLoading ? 'Fermeture...' : 'Fermer la caisse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
