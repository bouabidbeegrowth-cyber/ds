'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { canWrite, canDelete } from '@/lib/permissions';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/shared/pagination-bar';
import {
  Plus, Calendar, Clock, User, UserCog, FileText,
  Pencil, Trash2, Check, X, AlertCircle, Sparkles, Search, Lock,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

type AppointmentStatus = 'PROGRAMME' | 'ANNULE' | 'TERMINE';

interface AppointmentService {
  id: string;
  serviceId: string;
  service: Service;
}

interface Appointment {
  id: string;
  clientId: string;
  employeeId: string;
  date: string;
  status: AppointmentStatus;
  notes: string | null;
  client: Client;
  services: AppointmentService[];
  employee: Employee;
  invoice: { id: string; status: string; amount: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ds_token') || '';
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function toLocaleDateString(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function formatPrice(n: number): string {
  return n.toLocaleString('fr-DZ') + ' DA';
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMME: 'Programmé',
  ANNULE: 'Annulé',
  TERMINE: 'Terminé',
};

function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case 'PROGRAMME':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'ANNULE':
      return '';
    case 'TERMINE':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    default:
      return '';
  }
}

function statusBadgeVariant(status: AppointmentStatus): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'ANNULE':
      return 'destructive';
    case 'TERMINE':
      return 'outline';
    default:
      return 'secondary';
  }
}

function statusDotColor(statuses: AppointmentStatus[]): string {
  if (statuses.length === 0) return 'transparent';
  const unique = [...new Set(statuses)];
  if (unique.length === 1) {
    if (unique[0] === 'PROGRAMME') return '#3b82f6';
    if (unique[0] === 'ANNULE') return '#ef4444';
    if (unique[0] === 'TERMINE') return '#10b981';
  }
  if (statuses.includes('PROGRAMME')) return '#3b82f6';
  if (statuses.includes('TERMINE')) return '#10b981';
  return '#ef4444';
}

function getServiceNames(apt: Appointment): string {
  return apt.services.map((as) => as.service.name).join(', ');
}

function getTotalPrice(apt: Appointment): number {
  return apt.services.reduce((sum, as) => sum + as.service.price, 0);
}

function getTotalDuration(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.duration, 0);
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <Skeleton className="h-[340px] rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-96" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AppointmentsModule() {
  const { user } = useAuthStore();
  // New/edited appointments can only be scheduled today or in the future.
  const todayStr = toDateString(new Date());
  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    clientId: '',
    serviceIds: [] as string[],
    employeeId: '',
    date: '',
    time: '',
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({
    clientId: '',
    serviceIds: [] as string[],
    employeeId: '',
    date: '',
    time: '',
    notes: '',
  });
  const [editing, setEditing] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Selected services helpers (for create form) ────────────────────────────

  const selectedServices = useMemo(
    () => services.filter((s) => createForm.serviceIds.includes(s.id)),
    [services, createForm.serviceIds],
  );

  const selectedTotalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices],
  );

  const selectedTotalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration, 0),
    [selectedServices],
  );

  const toggleServiceId = (serviceId: string) => {
    setCreateForm((f) => {
      const ids = f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter((id) => id !== serviceId)
        : [...f.serviceIds, serviceId];
      return { ...f, serviceIds: ids };
    });
  };

  // ── Selected services helpers (for edit form) ──────────────────────────────

  const editSelectedServices = useMemo(
    () => services.filter((s) => editForm.serviceIds.includes(s.id)),
    [services, editForm.serviceIds],
  );

  const editSelectedTotalPrice = useMemo(
    () => editSelectedServices.reduce((sum, s) => sum + s.price, 0),
    [editSelectedServices],
  );

  const editSelectedTotalDuration = useMemo(
    () => editSelectedServices.reduce((sum, s) => sum + s.duration, 0),
    [editSelectedServices],
  );

  const toggleEditServiceId = (serviceId: string) => {
    setEditForm((f) => {
      const ids = f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter((id) => id !== serviceId)
        : [...f.serviceIds, serviceId];
      return { ...f, serviceIds: ids };
    });
  };

  // ── Month appointments (for calendar dots) ─────────────────────────────────

  const [monthAppointments, setMonthAppointments] = useState<Appointment[]>([]);

  const fetchMonthAppointments = useCallback(async (month: Date) => {
    try {
      const year = month.getFullYear();
      const m = month.getMonth();
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59);
      const res = await fetch(
        `/api/appointments?date=${toDateString(start)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return;
      const data: Appointment[] = await res.json();
      setMonthAppointments(
        data.filter((a) => {
          const d = new Date(a.date);
          return d >= start && d <= end;
        })
      );
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchMonthAppointments(currentMonth);
  }, [currentMonth, fetchMonthAppointments]);

  // ── Calendar dot map ───────────────────────────────────────────────────────

  const dotMap = useMemo(() => {
    const map: Record<string, AppointmentStatus[]> = {};
    monthAppointments.forEach((a) => {
      const key = toDateString(new Date(a.date));
      if (!map[key]) map[key] = [];
      map[key].push(a.status);
    });
    return map;
  }, [monthAppointments]);

  const dotStyles = useMemo(() => {
    let css = '';
    Object.entries(dotMap).forEach(([dateStr, statuses]) => {
      const d = new Date(dateStr + 'T12:00:00');
      const localeStr = toLocaleDateString(d);
      const color = statusDotColor(statuses);
      css += `[data-day="${localeStr}"]::after { content:''; position:absolute; bottom:2px; left:50%; transform:translateX(-50%); width:5px; height:5px; border-radius:50%; background:${color}; }\n`;
    });
    return css;
  }, [dotMap]);

  // ── Search filter (client name, employee name, service, notes) ────────────

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((apt) => {
      const clientName = `${apt.client.firstName} ${apt.client.lastName}`.toLowerCase();
      const employeeName = apt.employee.name.toLowerCase();
      const serviceNames = apt.services.map((s) => s.service.name).join(' ').toLowerCase();
      const notes = (apt.notes || '').toLowerCase();
      return (
        clientName.includes(q) ||
        employeeName.includes(q) ||
        serviceNames.includes(q) ||
        notes.includes(q)
      );
    });
  }, [appointments, searchQuery]);

  const { page, setPage, pageItems: pagedAppointments, totalPages, totalItems, pageSize } = usePagination(filteredAppointments, 10);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', toDateString(selectedDate));
      if (activeTab !== 'ALL') params.set('status', activeTab);
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAppointments(data);
    } catch {
      toast.error('Erreur lors du chargement des rendez-vous');
    }
  }, [selectedDate, activeTab]);

  const fetchLookups = useCallback(async () => {
    try {
      const [clientsRes, servicesRes, usersRes] = await Promise.all([
        fetch('/api/clients', { headers: authHeaders() }),
        fetch('/api/services?active=true', { headers: authHeaders() }),
        fetch('/api/users', { headers: authHeaders() }),
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
      if (usersRes.ok) {
        const allUsers: Employee[] = await usersRes.json();
        setEmployees(allUsers.filter((u) => u.active));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAppointments(), fetchLookups()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading) fetchAppointments();
  }, [fetchAppointments, loading]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.clientId || createForm.serviceIds.length === 0 || !createForm.employeeId || !createForm.date || !createForm.time) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setCreating(true);
    try {
      const isoDate = new Date(`${createForm.date}T${createForm.time}:00`).toISOString();
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          clientId: createForm.clientId,
          serviceIds: createForm.serviceIds,
          employeeId: createForm.employeeId,
          date: isoDate,
          notes: createForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Erreur lors de la création");
        return;
      }
      toast.success('Rendez-vous créé avec succès');
      setCreateOpen(false);
      setCreateForm({ clientId: '', serviceIds: [], employeeId: '', date: '', time: '', notes: '' });
      fetchAppointments();
      fetchMonthAppointments(currentMonth);
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    try {
      const res = await fetch('/api/appointments', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la modification');
        return;
      }
      if (status === 'TERMINE') {
        toast.success('Rendez-vous terminé — facture générée automatiquement');
      } else {
        toast.success('Statut mis à jour');
      }
      fetchAppointments();
      fetchMonthAppointments(currentMonth);
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  const handleOpenEdit = (apt: Appointment) => {
    const d = new Date(apt.date);
    setEditTarget(apt);
    setEditForm({
      clientId: apt.clientId,
      serviceIds: apt.services.map((s) => s.serviceId),
      employeeId: apt.employeeId,
      date: toDateString(d),
      time: format(d, 'HH:mm'),
      notes: apt.notes || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.clientId || editForm.serviceIds.length === 0 || !editForm.employeeId || !editForm.date || !editForm.time) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setEditing(true);
    try {
      const isoDate = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
      const res = await fetch('/api/appointments', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          id: editTarget.id,
          clientId: editForm.clientId,
          serviceIds: editForm.serviceIds,
          employeeId: editForm.employeeId,
          date: isoDate,
          notes: editForm.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la modification');
        return;
      }
      toast.success('Rendez-vous modifié avec succès');
      setEditOpen(false);
      fetchAppointments();
      fetchMonthAppointments(currentMonth);
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setEditing(false);
    }
  };

  const handleOpenDelete = (apt: Appointment) => {
    setDeleteTarget(apt);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la suppression');
        return;
      }
      toast.success('Rendez-vous supprimé');
      setDeleteOpen(false);
      fetchAppointments();
      fetchMonthAppointments(currentMonth);
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setDeleting(false);
    }
  };

  const handleDayClick = (day: Date) => {
    if (selectedDate && toDateString(selectedDate) === toDateString(day)) {
      setSelectedDate(undefined);
    } else {
      setSelectedDate(day);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-1">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des rendez-vous</h1>
          {selectedDate && (
            <p className="text-sm text-muted-foreground mt-1">
              <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Sélectionné :{' '}
              {selectedDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              <button
                className="ml-2 text-primary underline text-xs hover:no-underline"
                onClick={() => setSelectedDate(undefined)}
              >
                Tout voir
              </button>
            </p>
          )}
        </div>
        {canWrite(user?.permissions?.appointments) && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau rendez-vous
        </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Calendar sidebar */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <style>{`
              [data-slot="calendar"] button[data-day] { position: relative; }
              ${dotStyles}
            `}</style>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(day) => {
                if (day) handleDayClick(day);
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={fr}
              fixedWeeks
              className="mx-auto"
            />
            <div className="mt-3 flex items-center gap-4 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Programmé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Terminé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Annulé
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right side: filters + list */}
        <div className="space-y-4">
          {/* Status tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="ALL">Tous</TabsTrigger>
              <TabsTrigger value="PROGRAMME">Programmé</TabsTrigger>
              <TabsTrigger value="ANNULE">Annulé</TabsTrigger>
              <TabsTrigger value="TERMINE">Terminé</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, employé, service ou note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Appointments list */}
          {filteredAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Aucun rendez-vous trouvé</p>
                <p className="text-xs">
                  {searchQuery
                    ? 'Aucun résultat pour votre recherche'
                    : selectedDate
                    ? 'Aucun rendez-vous pour cette date'
                    : 'Créez un nouveau rendez-vous pour commencer'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead>Employé</TableHead>
                          <TableHead>Date / Heure</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedAppointments.map((apt) => (
                          <TableRow key={apt.id}>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {apt.client.firstName} {apt.client.lastName}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {apt.services.map((as) => (
                                  <Badge key={as.id} variant="secondary" className="text-xs font-normal">
                                    {as.service.name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1.5">
                                <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {apt.employee.name}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {formatDateFr(apt.date)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <StatusSelect
                                appointment={apt}
                                onChange={handleStatusChange}
                              />
                            </TableCell>
                            <TableCell>
                              {apt.invoice ? (
                                apt.notes ? (
                                  <span className="text-xs text-muted-foreground line-clamp-1" title={apt.notes}>
                                    {apt.notes}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )
                              ) : apt.notes ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground"
                                  onClick={() => handleOpenEdit(apt)}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Voir
                                </Button>
                              ) : canWrite(user?.permissions?.appointments) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground"
                                  onClick={() => handleOpenEdit(apt)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Ajouter
                                </Button>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                              {canWrite(user?.permissions?.appointments) && !apt.invoice && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenEdit(apt)}
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              )}
                                {apt.status === 'PROGRAMME' && canDelete(user?.permissions?.appointments) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleOpenDelete(apt)}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {pagedAppointments.map((apt) => (
                  <Card key={apt.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {apt.client.firstName} {apt.client.lastName}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {apt.services.map((as) => (
                            <Badge key={as.id} variant="secondary" className="text-xs font-normal">
                              {as.service.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <StatusSelect appointment={apt} onChange={handleStatusChange} />
                    </div>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-3.5 w-3.5 shrink-0" />
                        <span>{apt.employee.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDateFr(apt.date)}</span>
                      </div>
                      {apt.notes && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{apt.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {canWrite(user?.permissions?.appointments) && !apt.invoice && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleOpenEdit(apt)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Modifier
                      </Button>
                      )}
                      {apt.status === 'PROGRAMME' && canDelete(user?.permissions?.appointments) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive ml-auto"
                          onClick={() => handleOpenDelete(apt)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
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
        </div>
      </div>

      {/* ── Create Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) setCreateForm({ clientId: '', serviceIds: [], employeeId: '', date: '', time: '', notes: '' });
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau rendez-vous</DialogTitle>
            <DialogDescription>
              Sélectionnez un ou plusieurs services pour le rendez-vous.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="create-client">Client *</Label>
              <Select
                value={createForm.clientId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, clientId: v }))}
              >
                <SelectTrigger id="create-client" className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Services (multi-select) */}
            <div className="space-y-2">
              <Label>Services *</Label>
              <div className="border rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                {services.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Aucun service actif. Créez d&apos;abord un service.
                  </p>
                ) : (
                  services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={createForm.serviceIds.includes(s.id)}
                        onCheckedChange={() => toggleServiceId(s.id)}
                      />
                      <span className="flex-1 text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatPrice(s.price)}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedServices.length > 0 && (
                <div className="flex items-center justify-between text-sm px-1 pt-1">
                  <span className="text-muted-foreground">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} sélectionné{selectedServices.length > 1 ? 's' : ''}
                  </span>
                  <span className="font-medium text-primary">
                    {formatPrice(selectedTotalPrice)} · {formatDuration(selectedTotalDuration)}
                  </span>
                </div>
              )}
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <Label htmlFor="create-employee">Employé *</Label>
              <Select
                value={createForm.employeeId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger id="create-employee" className="w-full">
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create-date">Date *</Label>
                <Input
                  id="create-date"
                  type="date"
                  min={todayStr}
                  value={createForm.date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time">Heure *</Label>
                <Input
                  id="create-time"
                  type="time"
                  value={createForm.time}
                  onChange={(e) => setCreateForm((f) => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="create-notes">Notes</Label>
              <Textarea
                id="create-notes"
                placeholder="Notes supplémentaires (optionnel)"
                rows={3}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le rendez-vous</DialogTitle>
            <DialogDescription>
              Modifiez le client, les services, l&apos;employé, la date ou les notes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="edit-client">Client *</Label>
              <Select
                value={editForm.clientId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, clientId: v }))}
              >
                <SelectTrigger id="edit-client" className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Services (multi-select) */}
            <div className="space-y-2">
              <Label>Services *</Label>
              <div className="border rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                {services.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Aucun service actif. Créez d&apos;abord un service.
                  </p>
                ) : (
                  services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={editForm.serviceIds.includes(s.id)}
                        onCheckedChange={() => toggleEditServiceId(s.id)}
                      />
                      <span className="flex-1 text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatPrice(s.price)}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {editSelectedServices.length > 0 && (
                <div className="flex items-center justify-between text-sm px-1 pt-1">
                  <span className="text-muted-foreground">
                    {editSelectedServices.length} service{editSelectedServices.length > 1 ? 's' : ''} sélectionné{editSelectedServices.length > 1 ? 's' : ''}
                  </span>
                  <span className="font-medium text-primary">
                    {formatPrice(editSelectedTotalPrice)} · {formatDuration(editSelectedTotalDuration)}
                  </span>
                </div>
              )}
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <Label htmlFor="edit-employee">Employé *</Label>
              <Select
                value={editForm.employeeId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger id="edit-employee" className="w-full">
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  min={todayStr}
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">Heure *</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Notes supplémentaires (optionnel)"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={editing}>
              {editing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete AlertDialog ───────────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              Supprimer le rendez-vous
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Êtes-vous sûr de vouloir supprimer le rendez-vous de{' '}
                  <strong>
                    {deleteTarget.client.firstName} {deleteTarget.client.lastName}
                  </strong>{' '}
                  ({getServiceNames(deleteTarget)})
                  {' '}du {formatDateFr(deleteTarget.date)} ? Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
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

// ── Status Select ─────────────────────────────────────────────────────────────

function StatusSelect({
  appointment,
  onChange,
}: {
  appointment: Appointment;
  onChange: (id: string, status: AppointmentStatus) => void;
}) {
  const currentStatus = appointment.status;
  const displayVariant = statusBadgeVariant(currentStatus);
  const displayClass = statusBadgeClass(currentStatus);

  if (appointment.invoice) {
    return (
      <Badge
        variant={displayVariant}
        className={displayClass}
        title="Facturé — le statut ne peut plus être modifié"
      >
        <Lock className="h-2.5 w-2.5 mr-1" />
        {STATUS_LABELS[currentStatus]}
      </Badge>
    );
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={(v) => onChange(appointment.id, v as AppointmentStatus)}
    >
      <SelectTrigger size="sm" className="w-[120px] h-7 text-xs">
        <Badge variant={displayVariant} className={displayClass}>
          {STATUS_LABELS[currentStatus]}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PROGRAMME">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Programmé
          </span>
        </SelectItem>
        <SelectItem value="ANNULE">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Annulé
          </span>
        </SelectItem>
        <SelectItem value="TERMINE">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Terminé
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}