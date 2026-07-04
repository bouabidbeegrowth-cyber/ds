'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  History,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { canWrite, canDelete } from '@/lib/permissions';
import { isAlgerianPhoneNumber } from '@/lib/phone';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  remarks: string | null;
  createdAt: string;
}

interface Appointment {
  id: string;
  date: string;
  serviceName: string;
  employeeName: string;
  status: 'PROGRAMME' | 'ANNULE' | 'TERMINE';
}

interface Invoice {
  id: string;
  date: string;
  totalAmount: number;
  status: 'PAYEE' | 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE';
  paidAmount: number;
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const clientFormSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || isAlgerianPhoneNumber(val),
      'Numéro algérien invalide'
    ),
  email: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Email invalide'
    ),
  address: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ds_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
}

// ─── Status Badges ───────────────────────────────────────────────────────────

function AppointmentStatusBadge({ status }: { status: Appointment['status'] }) {
  const config: Record<
    Appointment['status'],
    { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; className?: string }
  > = {
    PROGRAMME: { label: 'Programmé', variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    ANNULE: { label: 'Annulé', variant: 'destructive' },
    TERMINE: { label: 'Terminé', variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200' },
  };
  const { label, variant, className } = config[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const config: Record<
    Invoice['status'],
    { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; className?: string }
  > = {
    PAYEE: { label: 'Payée', variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200' },
    NON_PAYEE: { label: 'Non payée', variant: 'destructive' },
    PARTIELLEMENT_PAYEE: {
      label: 'Partiellement payée',
      variant: 'outline',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
  };
  const { label, variant, className } = config[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {['w-48', 'w-36', 'w-40', 'w-64', 'w-32'].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-4 w-full max-w-xs" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Client Form Dialog ──────────────────────────────────────────────────────

function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSaved: () => void;
}) {
  const isEditing = !!client;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: client?.firstName ?? '',
      lastName: client?.lastName ?? '',
      phone: client?.phone ?? '',
      email: client?.email ?? '',
      address: client?.address ?? '',
      remarks: client?.remarks ?? '',
    },
  });

  // Reset form when dialog opens with a different client
  useEffect(() => {
    if (open) {
      form.reset({
        firstName: client?.firstName ?? '',
        lastName: client?.lastName ?? '',
        phone: client?.phone ?? '',
        email: client?.email ?? '',
        address: client?.address ?? '',
        remarks: client?.remarks ?? '',
      });
    }
  }, [open, client, form]);

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: ClientFormValues) => {
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        firstName: values.firstName,
        lastName: values.lastName,
      };
      if (values.phone) payload.phone = values.phone;
      if (values.email) payload.email = values.email;
      if (values.address) payload.address = values.address;
      if (values.remarks) payload.remarks = values.remarks;

      if (isEditing && client) {
        await fetch('/api/clients', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ id: client.id, ...payload }),
        });
      } else {
        await fetch('/api/clients', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      // Error handled silently, could add toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier le client' : 'Nouveau client'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="0X XX XX XX XX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemple.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Adresse" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarques</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes ou remarques..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {isEditing ? 'Enregistrement...' : 'Création...'}
                  </span>
                ) : isEditing ? (
                  'Enregistrer'
                ) : (
                  'Créer le client'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client History Dialog ───────────────────────────────────────────────────

function ClientHistoryDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    if (open && client) {
      fetch(`/api/clients/${client.id}/appointments`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data) => setAppointments(Array.isArray(data) ? data : []))
        .catch(() => setAppointments([]))
        .finally(() => setLoadingAppointments(false));

      fetch(`/api/clients/${client.id}/invoices`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data) => setInvoices(Array.isArray(data) ? data : []))
        .catch(() => setInvoices([]))
        .finally(() => setLoadingInvoices(false));
    }
  }, [open, client]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Historique — {client.firstName} {client.lastName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="appointments" className="flex-1">
              Rendez-vous
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1">
              Factures
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <ScrollArea className="max-h-96 overflow-y-auto">
              {loadingAppointments ? (
                <HistorySkeleton />
              ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun rendez-vous trouvé
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Employé</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appt) => (
                      <TableRow key={appt.id}>
                        <TableCell className="font-medium">
                          {formatDate(appt.date)}
                        </TableCell>
                        <TableCell>{appt.serviceName}</TableCell>
                        <TableCell>{appt.employeeName}</TableCell>
                        <TableCell>
                          <AppointmentStatusBadge status={appt.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="invoices">
            <ScrollArea className="max-h-96 overflow-y-auto">
              {loadingInvoices ? (
                <HistorySkeleton />
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucune facture trouvée
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {formatDate(inv.date)}
                        </TableCell>
                        <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                        <TableCell>{formatCurrency(inv.paidAmount)}</TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={inv.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Desktop Table View ──────────────────────────────────────────────────────

function ClientTable({
  clients,
  onEdit,
  onDelete,
  onHistory,
}: {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onHistory: (client: Client) => void;
}) {
  const { user } = useAuthStore();
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun client trouvé</p>
            <p className="text-xs mt-1">
              Commencez par ajouter un nouveau client
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Remarques</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="pl-4">
                    <span className="font-medium">
                      {client.firstName} {client.lastName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {client.phone && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {client.phone}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.email && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {client.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {client.remarks ? (
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                        {client.remarks}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onHistory(client)}
                        title="Historique"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {canWrite(user?.permissions?.clients) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(client)}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      )}
                      {canDelete(user?.permissions?.clients) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(client)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mobile Card View ────────────────────────────────────────────────────────

function ClientCardList({
  clients,
  onEdit,
  onDelete,
  onHistory,
}: {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onHistory: (client: Client) => void;
}) {
  const { user } = useAuthStore();
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun client trouvé</p>
            <p className="text-xs mt-1">
              Commencez par ajouter un nouveau client
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => (
        <Card key={client.id} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-semibold text-sm">
                  {client.firstName} {client.lastName}
                </p>
                {client.remarks && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {client.remarks}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onHistory(client)}
                  title="Historique"
                >
                  <History className="h-4 w-4" />
                </Button>
                {canWrite(user?.permissions?.clients) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(client)}
                  title="Modifier"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                )}
                {canDelete(user?.permissions?.clients) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(client)}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                )}
              </div>
            </div>

            {/* Contact details */}
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {client.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </span>
              )}
              {client.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.address}</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Clients Module ─────────────────────────────────────────────────────

export function ClientsModule() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Dialogs
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch clients ──
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : '';
      const res = await fetch(`/api/clients${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const { page, setPage, pageItems: pagedClients, totalPages, totalItems, pageSize } = usePagination(clients, 10);

  // ── Handlers ──
  const handleCreateNew = () => {
    setEditingClient(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormDialogOpen(true);
  };

  const handleSaved = () => {
    fetchClients();
  };

  const handleHistory = (client: Client) => {
    setHistoryClient(client);
    setHistoryDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      await fetch('/api/clients', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: deletingClient.id }),
      });
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
    } catch {
      // Error handled silently
    } finally {
      setDeleting(false);
      setDeletingClient(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestion des clients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        {canWrite(user?.permissions?.clients) && (
        <Button onClick={handleCreateNew} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau client
        </Button>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou téléphone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-4">
                <TableSkeleton />
              </CardContent>
            </Card>
          </div>
          {/* Mobile skeleton */}
          <div className="md:hidden">
            <CardSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* Desktop table (hidden on mobile) */}
          <div className="hidden md:block">
            <ClientTable
              clients={pagedClients}
              onEdit={handleEdit}
              onDelete={setDeletingClient}
              onHistory={handleHistory}
            />
          </div>
          {/* Mobile cards (hidden on desktop) */}
          <div className="md:hidden">
            <ClientCardList
              clients={pagedClients}
              onEdit={handleEdit}
              onDelete={setDeletingClient}
              onHistory={handleHistory}
            />
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

      {/* ── Create / Edit Dialog ── */}
      <ClientFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        client={editingClient}
        onSaved={handleSaved}
      />

      {/* ── History Dialog ── */}
      <ClientHistoryDialog
        key={historyClient?.id}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        client={historyClient}
      />

      {/* ── Delete Confirmation ── */}
      <AlertDialog
        open={!!deletingClient}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client{' '}
              <span className="font-semibold text-foreground">
                {deletingClient?.firstName} {deletingClient?.lastName}
              </span>{' '}
              sera définitivement supprimé, ainsi que toutes les données
              associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Suppression...
                </span>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}