'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { canWrite, canDelete } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Home,
  Zap,
  Users,
  Package,
  MoreHorizontal,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryKey = 'LOYER' | 'ELECTRICITE' | 'SALAIRES' | 'FOURNITURES' | 'AUTRE';

interface Expense {
  id: string;
  label: string;
  category: CategoryKey;
  amount: number;
  date: string;
  description?: string;
  createdAt: string;
}

interface ExpenseFormData {
  label: string;
  category: CategoryKey | '';
  amount: string;
  date: string;
  description: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<CategoryKey, { label: string; icon: React.ElementType; color: string }> = {
  LOYER: { label: 'Loyer', icon: Home, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  ELECTRICITE: { label: 'Électricité', icon: Zap, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  SALAIRES: { label: 'Salaires', icon: Users, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  FOURNITURES: { label: 'Fournitures', icon: Package, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  AUTRE: { label: 'Autre', icon: MoreHorizontal, color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_MAP) as CategoryKey[];

const EMPTY_FORM: ExpenseFormData = {
  label: '',
  category: '',
  amount: '',
  date: '',
  description: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-DZ') + ' DA';
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthStr: string): string {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExpensesModule() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ─── Fetch expenses ──────────────────────────────────────────────────

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ds_token');
      const params = new URLSearchParams();
      if (selectedMonth) params.set('month', selectedMonth);
      if (selectedCategory && selectedCategory !== 'ALL') params.set('category', selectedCategory);

      const res = await fetch(`/api/expenses?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : data.expenses ?? []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedCategory]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ─── Summary calculations ────────────────────────────────────────────

  const summary = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<CategoryKey, number> = {
      LOYER: 0,
      ELECTRICITE: 0,
      SALAIRES: 0,
      FOURNITURES: 0,
      AUTRE: 0,
    };
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    return { total, byCategory };
  }, [expenses]);

  // ─── Form helpers ────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setFormOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingId(expense.id);
    setFormData({
      label: expense.label,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date.split('T')[0],
      description: expense.description ?? '',
    });
    setFormOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  const handleFormChange = (field: keyof ExpenseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Submit handlers ─────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!formData.label.trim() || !formData.category || !formData.amount || !formData.date) return;

    setFormSubmitting(true);
    try {
      const token = localStorage.getItem('ds_token');
      const body: Record<string, unknown> = {
        label: formData.label.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date + 'T00:00:00').toISOString(),
      };
      if (formData.description.trim()) {
        body.description = formData.description.trim();
      }

      const isEditing = !!editingId;
      const url = '/api/expenses';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(isEditing ? { id: editingId, ...body } : body),
      });

      if (!res.ok) throw new Error(isEditing ? 'Erreur de modification' : "Erreur de création");

      setFormOpen(false);
      fetchExpenses();
    } catch {
      // Error handled silently (toast could be added)
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleteSubmitting(true);
    try {
      const token = localStorage.getItem('ds_token');
      const res = await fetch('/api/expenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: deletingId }),
      });

      if (!res.ok) throw new Error('Erreur de suppression');

      setDeleteOpen(false);
      setDeletingId(null);
      fetchExpenses();
    } catch {
      // Error handled silently
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const deletingExpense = expenses.find((e) => e.id === deletingId);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestion des dépenses</h1>
            <p className="text-sm text-muted-foreground">
              {selectedMonth ? getMonthLabel(selectedMonth) : 'Tous les mois'}
            </p>
          </div>
        </div>
        {canWrite(user?.permissions?.expenses) && (
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        )}
      </div>

      {/* Filter row */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="month-filter" className="text-xs text-muted-foreground mb-1.5 block">
                Mois
              </Label>
              <Input
                id="month-filter"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="category-filter" className="text-xs text-muted-foreground mb-1.5 block">
                Catégorie
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category-filter" className="w-full">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les catégories</SelectItem>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORY_MAP[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total card */}
        <Card className="col-span-2 sm:col-span-1 lg:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total dépenses du mois</p>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{formatAmount(summary.total)}</p>
            )}
          </CardContent>
        </Card>
        {/* Category breakdown cards */}
        {CATEGORY_KEYS.map((key) => {
          const cat = CATEGORY_MAP[key];
          const Icon = cat.icon;
          const amount = summary.byCategory[key];
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground truncate">{cat.label}</p>
                </div>
                {loading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p className="text-lg font-bold text-foreground">{formatAmount(amount)}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expenses table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Receipt className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Aucune dépense</p>
              <p className="text-xs text-muted-foreground">
                {canWrite(user?.permissions?.expenses)
                  ? 'Cliquez sur « Nouvelle dépense » pour ajouter une dépense.'
                  : "Aucune dépense enregistrée pour cette période."}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Désignation</TableHead>
                    <TableHead className="min-w-[120px]">Catégorie</TableHead>
                    <TableHead className="text-right min-w-[120px]">Montant</TableHead>
                    <TableHead className="min-w-[110px]">Date</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[160px]">Description</TableHead>
                    {(canWrite(user?.permissions?.expenses) || canDelete(user?.permissions?.expenses)) && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const cat = CATEGORY_MAP[expense.category];
                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium text-foreground">
                          {expense.label}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cat?.color ?? ''}>
                            {cat?.label ?? expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatAmount(expense.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                          {expense.description || '—'}
                        </TableCell>
                        {canWrite(user?.permissions?.expenses) && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(expense)}
                                aria-label={`Modifier ${expense.label}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canDelete(user?.permissions?.expenses) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(expense.id)}
                                aria-label={`Supprimer ${expense.label}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {/* Total row */}
                  <TableRow className="border-t-2 border-foreground/10 bg-muted/30">
                    <TableCell
                      colSpan={(canWrite(user?.permissions?.expenses) || canDelete(user?.permissions?.expenses)) ? 2 : 1}
                      className="font-bold text-foreground"
                    >
                      Total
                    </TableCell>
                    {(canWrite(user?.permissions?.expenses) || canDelete(user?.permissions?.expenses)) && <TableCell />}
                    <TableCell className="text-right font-bold text-foreground tabular-nums text-base">
                      {formatAmount(summary.total)}
                    </TableCell>
                    <TableCell colSpan={(canWrite(user?.permissions?.expenses) || canDelete(user?.permissions?.expenses)) ? 3 : 2} />
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ─── Create / Edit Dialog ────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations de la dépense ci-dessous.'
                : 'Remplissez les informations pour enregistrer une nouvelle dépense.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Désignation */}
            <div className="space-y-2">
              <Label htmlFor="exp-label">Désignation</Label>
              <Input
                id="exp-label"
                placeholder="Ex: Loyer du mois"
                value={formData.label}
                onChange={(e) => handleFormChange('label', e.target.value)}
              />
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label htmlFor="exp-category">Catégorie</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => handleFormChange('category', val)}
              >
                <SelectTrigger id="exp-category" className="w-full">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORY_MAP[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Montant + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Montant</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="exp-description">Description</Label>
              <Textarea
                id="exp-description"
                placeholder="Description optionnelle…"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={formSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                formSubmitting ||
                !formData.label.trim() ||
                !formData.category ||
                !formData.amount ||
                !formData.date
              }
            >
              {formSubmitting ? 'Enregistrement…' : editingId ? 'Modifier' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete AlertDialog (admin only) ─────────────────────────── */}
      {canDelete(user?.permissions?.expenses) && (
        <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeleteOpen(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingExpense
                  ? `Voulez-vous vraiment supprimer la dépense « ${deletingExpense.label} » d'un montant de ${formatAmount(deletingExpense.amount)} ? Cette action est irréversible.`
                  : 'Voulez-vous vraiment supprimer cette dépense ? Cette action est irréversible.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSubmitting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteSubmitting ? 'Suppression…' : 'Supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}