'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { canRead } from '@/lib/permissions';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw, Shield, Clock3, Plus, Pencil, Trash2, LogIn } from 'lucide-react';

type JournalEntry = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  LOGIN: 'Connexion',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  LOGIN: LogIn,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-blue-100 text-blue-700',
};

function ActionBadge({ action }: { action: string }) {
  const Icon = ACTION_ICONS[action] || Activity;
  const color = ACTION_COLORS[action] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="h-3 w-3" />
      {ACTION_LABELS[action] || action}
    </span>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ENTITY_LABELS: Record<string, string> = {
  client: 'client',
  user: 'utilisateur',
  appointment: 'rendez-vous',
  invoice: 'facture',
  service: 'service',
  purchase: 'achat',
  expense: 'dépense',
  role: 'rôle',
  auth: 'compte',
};

function parseDetails(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Turns a raw journal entry into a plain-French sentence, e.g.
// "a modifié le client Jean Dupont" instead of the underlying JSON.
function describeEntry(entry: JournalEntry): string {
  const d = parseDetails(entry.details);
  const entityLabel = ENTITY_LABELS[entry.entity] || entry.entity;

  const verb = entry.action === 'CREATE' ? 'a créé'
    : entry.action === 'UPDATE' ? 'a modifié'
    : entry.action === 'DELETE' ? 'a supprimé'
    : entry.action === 'LOGIN' ? 's’est connecté(e) au'
    : `a effectué une action (${entry.action}) sur le`;

  switch (entry.entity) {
    case 'client': {
      const name = [d.firstName, d.lastName].filter(Boolean).join(' ');
      return name ? `${verb} le client ${name}` : `${verb} un client`;
    }
    case 'user': {
      const name = (d.name as string) || (d.username as string);
      return name ? `${verb} l’utilisateur ${name}` : `${verb} un utilisateur`;
    }
    case 'appointment': {
      const status = d.status ? ` (statut : ${d.status})` : '';
      return `${verb} un rendez-vous${status}`;
    }
    case 'invoice': {
      const amount = typeof d.amount === 'number' ? ` de ${d.amount} DT` : '';
      const status = d.status ? ` (statut : ${d.status})` : '';
      return `${verb} une facture${amount}${status}`;
    }
    case 'service': {
      const name = d.name as string;
      return name ? `${verb} le service ${name}` : `${verb} un service`;
    }
    case 'purchase': {
      const label = d.label as string;
      return label ? `${verb} l’achat « ${label} »` : `${verb} un achat`;
    }
    case 'expense': {
      const label = d.label as string;
      return label ? `${verb} la dépense « ${label} »` : `${verb} une dépense`;
    }
    case 'role': {
      const name = d.name as string;
      return name ? `${verb} le rôle ${name}` : `${verb} un rôle`;
    }
    case 'auth':
      return 's’est connecté(e)';
    default:
      return `${verb} ${entityLabel}`;
  }
}

export function JournalModule() {
  const { user } = useAuthStore();
  const canView = canRead(user?.permissions?.journal);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState('100');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ds_token');
      const res = await fetch(`/api/journal?limit=${encodeURIComponent(limit || '100')}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (canView) {
      fetchEntries();
    }
  }, [fetchEntries, canView]);

  const { page, setPage, pageItems: pagedEntries, totalPages, totalItems, pageSize } = usePagination(entries, 15);

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Vous n&apos;avez pas accès au journal.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Journal</h2>
            <p className="text-sm text-muted-foreground">Toutes les actions de l’application avec date et auteur.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-24"
          />
          <Button variant="outline" onClick={fetchEntries}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Clock3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucune action enregistrée</p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="pr-4">Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{entry.actorName}</TableCell>
                      <TableCell>
                        <ActionBadge action={entry.action} />
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {capitalize(describeEntry(entry))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Clock3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucune action enregistrée</p>
            </CardContent>
          </Card>
        ) : (
          pagedEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{entry.actorName}</span>
                  <ActionBadge action={entry.action} />
                </div>
                <p className="text-sm text-muted-foreground">{capitalize(describeEntry(entry))}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </section>
  );
}
