'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Plus, Pencil, Trash2, Users, Lock, Eye, PenTool, ShieldCheck } from 'lucide-react';
import {
  type Permissions,
  type PermissionLevel,
  ALL_MODULES,
  MODULE_LABELS,
  PERMISSION_LEVELS,
  DEFAULT_PERMISSIONS,
} from '@/lib/permissions';

interface Role {
  id: string;
  name: string;
  permissions: Permissions;
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ds_token');
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  none: Lock,
  read: Eye,
  write: PenTool,
  full: ShieldCheck,
};

const MODULE_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600',
  read: 'bg-blue-100 text-blue-700',
  write: 'bg-amber-100 text-amber-700',
  full: 'bg-emerald-100 text-emerald-700',
};

export function RolesModule() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '' });
  const [createPerms, setCreatePerms] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editForm, setEditForm] = useState({ name: '' });
  const [editPerms, setEditPerms] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement');
        return;
      }
      const data = await res.json();
      setRoles(data);
      setError('');
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // --- Create ---
  const openCreate = () => {
    setCreateForm({ name: '' });
    setCreatePerms({ ...DEFAULT_PERMISSIONS });
    setCreateError('');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!createForm.name.trim()) {
      setCreateError('Le nom du rôle est requis');
      return;
    }
    setCreateLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: createForm.name, permissions: createPerms }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || 'Erreur lors de la création');
        return;
      }
      setCreateOpen(false);
      fetchRoles();
    } catch {
      setCreateError('Erreur de connexion au serveur');
    } finally {
      setCreateLoading(false);
    }
  };

  // --- Edit ---
  const openEdit = (role: Role) => {
    setEditRole(role);
    setEditForm({ name: role.name });
    setEditPerms({ ...role.permissions });
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    setEditError('');
    if (!editRole || !editForm.name.trim()) {
      setEditError('Le nom du rôle est requis');
      return;
    }
    setEditLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/roles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: editRole.id, name: editForm.name, permissions: editPerms }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }
      setEditOpen(false);
      fetchRoles();
    } catch {
      setEditError('Erreur de connexion au serveur');
    } finally {
      setEditLoading(false);
    }
  };

  // --- Delete ---
  const openDelete = (role: Role) => {
    setDeleteRole(role);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    setDeleteLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/roles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: deleteRole.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la suppression');
        return;
      }
      setDeleteOpen(false);
      fetchRoles();
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Permission change helper
  const updatePerm = (
    perms: Permissions,
    setPerms: (p: Permissions) => void,
    module: string,
    level: PermissionLevel
  ) => {
    setPerms({ ...perms, [module]: level });
  };

  // Render permissions grid
  const renderPermGrid = (
    perms: Permissions,
    setPerms: (p: Permissions) => void,
    disabled?: boolean
  ) => (
    <div className="space-y-3">
      {ALL_MODULES.map((mod) => (
        <div key={mod} className="flex items-center gap-3">
          <span className="text-sm font-medium w-28 shrink-0">{MODULE_LABELS[mod]}</span>
          <Select
            value={perms[mod]}
            onValueChange={(v) => updatePerm(perms, setPerms, mod, v as PermissionLevel)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  <span className="flex items-center gap-2">
                    {level.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );

  function TableSkeleton() {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-20 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  const getPermBadge = (level: PermissionLevel) => {
    const Icon = MODULE_ICONS[level] || Lock;
    const color = MODULE_COLORS[level] || MODULE_COLORS.none;
    const label = PERMISSION_LEVELS.find((p) => p.value === level)?.label || 'Aucun';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    );
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Gestion des rôles</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau rôle
        </Button>
      </div>

      {/* Info alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Définissez les rôles et les permissions d&apos;accès pour chaque module. Les utilisateurs auront les droits du rôle qui leur est assigné.
        </AlertDescription>
      </Alert>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : roles.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun rôle trouvé</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Nom du rôle</TableHead>
                    <TableHead>Utilisateurs</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.name}</span>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-xs">Système</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {role.userCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {ALL_MODULES.map((mod) => (
                            <span key={mod} className="text-xs text-muted-foreground">
                              {role.permissions[mod] !== 'none' && (
                                <span className="inline-flex items-center gap-0.5 mr-2">
                                  {MODULE_LABELS[mod]}
                                  {getPermBadge(role.permissions[mod])}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(role)}
                            aria-label={`Modifier ${role.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDelete(role)}
                              aria-label={`Supprimer ${role.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ) : roles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun rôle trouvé</p>
            </CardContent>
          </Card>
        ) : (
          roles.map((role) => (
            <Card key={role.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{role.name}</p>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-xs shrink-0">Système</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 inline mr-1" />
                      {role.userCount} utilisateur{role.userCount > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => openEdit(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => openDelete(role)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
                  {ALL_MODULES.map((mod) => (
                    role.permissions[mod] !== 'none' && (
                      <span key={mod} className="inline-flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{MODULE_LABELS[mod]}:</span>
                        {getPermBadge(role.permissions[mod])}
                      </span>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nouveau rôle</DialogTitle>
            <DialogDescription>
              Créez un rôle et définissez les permissions pour chaque module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-role-name">Nom du rôle</Label>
              <Input
                id="create-role-name"
                placeholder="Ex : Réceptionniste, Comptable..."
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <ScrollArea className="max-h-72">
                {renderPermGrid(createPerms, setCreatePerms)}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Création...
                </div>
              ) : (
                'Créer le rôle'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Modifiez le nom et les permissions du rôle « {editRole?.name} ».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-role-name">Nom du rôle</Label>
              <Input
                id="edit-role-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <ScrollArea className="max-h-72">
                {renderPermGrid(editPerms, setEditPerms)}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement...
                </div>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le rôle « {deleteRole?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Assurez-vous qu&apos;aucun utilisateur n&apos;est assigné à ce rôle avant de le supprimer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Suppression...
                </div>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}