'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { canWrite, canDelete } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Pencil, Trash2, Sparkles, Clock, Search } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { appointments: number };
}

interface ServiceFormData {
  name: string;
  price: string;
  duration: string;
  description: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatPrice(price: number): string {
  return `${Number(price).toLocaleString('fr-FR')} TND`;
}

const emptyForm: ServiceFormData = {
  name: '',
  price: '',
  duration: '',
  description: '',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ServicesModule() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const canCreate = canWrite(user?.permissions?.services);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceFormData>(emptyForm);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch services ─────────────────────────────────────────────────────────

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ds_token');
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (statusFilter === 'active') params.set('active', 'true');
      if (statusFilter === 'inactive') params.set('active', 'false');
      const url = `/api/services${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setServices(data);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les services', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, debouncedQuery, statusFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const { page, setPage, pageItems: pagedServices, totalPages, totalItems, pageSize } = usePagination(services, 12);

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  function openCreateDialog() {
    setEditingService(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(service: Service) {
    setEditingService(service);
    setForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      description: service.description || '',
    });
    setDialogOpen(true);
  }

  // ── Submit (create / update) ──────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.duration) return;

    const priceValue = Number(form.price);
    const durationValue = Number(form.duration);
    if (!Number.isInteger(priceValue) || priceValue < 0 || !Number.isInteger(durationValue) || durationValue < 1) {
      toast({
        title: 'Erreur',
        description: 'Le prix doit être un nombre entier positif et la durée doit être un entier valide.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('ds_token');
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        price: priceValue,
        duration: durationValue,
        description: form.description.trim() || undefined,
      };

      let res: Response;
      if (editingService) {
        body.id = editingService.id;
        res = await fetch('/api/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l\'enregistrement');
      }

      toast({
        title: editingService ? 'Service modifié' : 'Service créé',
        description: `${form.name} a été ${editingService ? 'modifié' : 'ajouté'} avec succès.`,
      });
      setDialogOpen(false);
      fetchServices();
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredCountLabel = statusFilter === 'all'
    ? 'Tous'
    : statusFilter === 'active'
      ? 'Actifs'
      : 'Inactifs';

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggle(service: Service, checked: boolean) {
    try {
      const token = localStorage.getItem('ds_token');
      const res = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: service.id, active: checked }),
      });
      if (!res.ok) throw new Error();
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: checked } : s)),
      );
      toast({
        title: checked ? 'Service activé' : 'Service désactivé',
        description: `${service.name} est maintenant ${checked ? 'actif' : 'inactif'}.`,
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier le statut', variant: 'destructive' });
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function openDeleteDialog(service: Service) {
    setDeletingService(service);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingService) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('ds_token');
      const res = await fetch('/api/services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: deletingService.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      toast({ title: 'Service supprimé', description: `${deletingService.name} a été supprimé.` });
      setDeleteDialogOpen(false);
      setDeletingService(null);
      fetchServices();
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de supprimer ce service',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }

  // ── Render: Loading skeletons ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          {canCreate && <Skeleton className="h-10 w-40" />}
        </div>
        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="py-6">
              <CardHeader className="pb-0">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: Main content ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Gestion des services
          </h1>
          <p className="text-sm text-muted-foreground">
            {services.length} service{services.length > 1 ? 's' : ''} au total
          </p>
        </div>
        {canWrite(user?.permissions?.services) && (
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            Nouveau service
          </Button>
        )}
      </div>

      {/* ── Search & Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou description..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'active', label: 'Actifs' },
            { key: 'inactive', label: 'Inactifs' },
          ].map((item) => {
            const isActive = statusFilter === item.key;
            return (
              <Button
                key={item.key}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Affichage {filteredCountLabel.toLowerCase()} · {services.length} résultat{services.length !== 1 ? 's' : ''}
      </p>

      {/* ── Services grid ──────────────────────────────────────────────────── */}
      {services.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Sparkles className="mb-4 size-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-muted-foreground">Aucun service</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {canCreate
              ? 'Créez votre premier service pour commencer.'
              : 'Aucun service n\'a été configuré.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pagedServices.map((service) => (
            <Card
              key={service.id}
              className={`py-5 transition-all duration-200 hover:shadow-md ${
                !service.active ? 'opacity-55' : ''
              }`}
            >
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="truncate text-base">{service.name}</CardTitle>
                    {service.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {service.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge
                    variant={service.active ? 'default' : 'outline'}
                    className="shrink-0"
                  >
                    {service.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Price & Duration */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5" />
                    {formatDuration(service.duration)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  {canWrite(user?.permissions?.services) && (
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`toggle-${service.id}`}
                        className="cursor-pointer text-xs text-muted-foreground"
                      >
                        Actif
                      </Label>
                      <Switch
                        id={`toggle-${service.id}`}
                        checked={service.active}
                        onCheckedChange={(checked) => handleToggle(service, checked)}
                      />
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {canWrite(user?.permissions?.services) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        onClick={() => openEditDialog(service)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Modifier {service.name}</span>
                      </Button>
                    )}
                    {canDelete(user?.permissions?.services) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => openDeleteDialog(service)}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Supprimer {service.name}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {/* ── Create / Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              {editingService ? 'Modifier le service' : 'Nouveau service'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Modifiez les informations du service ci-dessous.'
                : 'Remplissez les informations pour créer un nouveau service.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nom */}
            <div className="space-y-2">
              <Label htmlFor="service-name">Nom *</Label>
              <Input
                id="service-name"
                placeholder="Ex: Soin visage hydratant"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            {/* Prix & Durée row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-price">Prix *</Label>
                <div className="relative">
                  <Input
                    id="service-price"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        setForm((f) => ({ ...f, price: value }));
                      }
                    }}
                    required
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    TND
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Durée *</Label>
                <div className="relative">
                  <Input
                    id="service-duration"
                    type="number"
                    min={1}
                    placeholder="30"
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                    required
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    min
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                placeholder="Description optionnelle du service..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-[120px]">
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {editingService ? 'Modification…' : 'Création…'}
                  </span>
                ) : editingService ? (
                  'Enregistrer'
                ) : (
                  'Créer le service'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le service</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{' '}
              <span className="font-semibold text-foreground">{deletingService?.name}</span> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30"
            >
              {deleting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Suppression…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="size-4" />
                  Supprimer
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}