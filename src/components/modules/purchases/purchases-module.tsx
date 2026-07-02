'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShoppingCart, Plus, Pencil, Trash2, Package, Building2 } from 'lucide-react';

interface Purchase {
  id: string;
  label: string;
  supplier: string | null;
  amount: number;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseFormData {
  label: string;
  supplier: string;
  amount: string;
  date: string;
  description: string;
}

const emptyForm: PurchaseFormData = {
  label: '',
  supplier: '',
  amount: '',
  date: '',
  description: '',
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' DA';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function PurchasesModule() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState<PurchaseFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getToken = () => localStorage.getItem('ds_token') || '';

  const fetchPurchases = useCallback(async (month?: string) => {
    setLoading(true);
    try {
      const params = month ? `?month=${month}` : '';
      const res = await fetch(`/api/purchases${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases(selectedMonth || undefined);
  }, [selectedMonth, fetchPurchases]);

  const totalAmount = purchases.reduce((sum, p) => sum + p.amount, 0);

  const openCreateDialog = () => {
    setEditingPurchase(null);
    setFormData({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setDialogOpen(true);
  };

  const openEditDialog = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      label: purchase.label,
      supplier: purchase.supplier || '',
      amount: String(purchase.amount),
      date: new Date(purchase.date).toISOString().split('T')[0],
      description: purchase.description || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (purchase: Purchase) => {
    setDeletingPurchase(purchase);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.label.trim() || !formData.amount || !formData.date) return;

    setSubmitting(true);
    try {
      const payload = {
        label: formData.label.trim(),
        supplier: formData.supplier.trim() || undefined,
        amount: Number(formData.amount),
        date: new Date(formData.date).toISOString(),
        description: formData.description.trim() || undefined,
      };

      const url = editingPurchase
        ? '/api/purchases'
        : '/api/purchases';

      const method = editingPurchase ? 'PUT' : 'POST';

      const body = editingPurchase
        ? { id: editingPurchase.id, ...payload }
        : payload;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchPurchases(selectedMonth || undefined);
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPurchase) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id: deletingPurchase.id }),
      });

      if (res.ok) {
        setDeleteDialogOpen(false);
        setDeletingPurchase(null);
        fetchPurchases(selectedMonth || undefined);
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Gestion des achats</h2>
            <p className="text-sm text-muted-foreground">
              {purchases.length} achat{purchases.length !== 1 ? 's' : ''}{' '}
              {selectedMonth && (
                <>pour le mois sélectionné</>
              )}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreateDialog} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel achat
          </Button>
        )}
      </div>

      {/* Month Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label htmlFor="month-filter" className="text-sm font-medium text-foreground shrink-0">
              Filtrer par mois :
            </Label>
            <Input
              id="month-filter"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="sm:w-56"
            />
            {selectedMonth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMonth('')}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                Effacer le filtre
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading Skeletons */}
      {loading && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24 hidden sm:block" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24 hidden md:block" />
                  <Skeleton className="h-5 flex-1 hidden lg:block" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && purchases.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">Aucun achat trouvé</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {selectedMonth
                ? 'Aucun achat enregistré pour ce mois. Essayez un autre mois ou créez un nouvel achat.'
                : 'Commencez par ajouter votre premier achat.'}
            </p>
            {isAdmin && (
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Nouvel achat
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && purchases.length > 0 && (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Désignation</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Description</TableHead>
                    {isAdmin && <TableHead className="text-right pr-4">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="pl-4 font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[200px]">{purchase.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {purchase.supplier ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[150px]">{purchase.supplier}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatAmount(purchase.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(purchase.date)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {purchase.description ? (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {purchase.description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(purchase)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Modifier</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteDialog(purchase)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Supprimer</span>
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {/* Total row */}
            <div className="border-t px-4 py-3 flex items-center justify-end gap-3 bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground">Total :</span>
              <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                {formatAmount(totalAmount)}
              </Badge>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <div className="space-y-3 pr-3">
                {purchases.map((purchase) => (
                  <Card key={purchase.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground truncate">
                            {purchase.label}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(purchase)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Modifier</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteDialog(purchase)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Supprimer</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {purchase.supplier && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[160px]">{purchase.supplier}</span>
                          </div>
                        )}
                        <div className="text-muted-foreground">
                          {formatDate(purchase.date)}
                        </div>
                      </div>

                      {purchase.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {purchase.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground">Montant</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {formatAmount(purchase.amount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Mobile total */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total des achats</span>
                <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                  {formatAmount(totalAmount)}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) setDialogOpen(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? 'Modifier l\'achat' : 'Nouvel achat'}
            </DialogTitle>
            <DialogDescription>
              {editingPurchase
                ? 'Modifiez les informations de l\'achat ci-dessous.'
                : 'Remplissez les informations du nouvel achat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-label">Désignation *</Label>
              <Input
                id="purchase-label"
                value={formData.label}
                onChange={(e) => setFormData((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Huile d'argan, Crème hydratante..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-supplier">Fournisseur</Label>
              <Input
                id="purchase-supplier"
                value={formData.supplier}
                onChange={(e) => setFormData((f) => ({ ...f, supplier: e.target.value }))}
                placeholder="Nom du fournisseur (optionnel)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase-amount">Montant *</Label>
                <Input
                  id="purchase-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Date *</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-description">Description</Label>
              <Textarea
                id="purchase-description"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Détails ou remarques (optionnel)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.label.trim() || !formData.amount || !formData.date}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {editingPurchase ? 'Mise à jour...' : 'Création...'}
                </div>
              ) : (
                <>
                  {editingPurchase ? (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Mettre à jour
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer l'achat
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteDialogOpen(false);
          setDeletingPurchase(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet achat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;achat{' '}
              <span className="font-semibold text-foreground">&laquo;&nbsp;{deletingPurchase?.label}&nbsp;&raquo;</span>
              {' '}d&apos;un montant de{' '}
              <span className="font-semibold text-foreground">
                {deletingPurchase ? formatAmount(deletingPurchase.amount) : ''}
              </span>
              {' '}? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Suppression...
                </div>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}