'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { UserCog, Plus, Pencil, Shield, UserCheck, UserX } from 'lucide-react';

interface Role {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  username: string;
  name: string;
  roleId: string | null;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  roleRelation: { id: string; name: string } | null;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ds_token');
}

export function UsersModule() {
  const currentUser = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    password: '',
    roleId: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    roleId: '',
    password: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Toggle confirm dialog
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggleUser, setToggleUser] = useState<UserItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      }
    } catch {
      // Silent fail for roles
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement');
        return;
      }
      const data = await res.json();
      setUsers(data);
      setError('');
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  const getRoleName = (user: UserItem): string => {
    return user.roleRelation?.name || 'Non assigné';
  };

  // --- Create ---
  const handleCreate = async () => {
    setCreateError('');
    if (!createForm.name.trim() || !createForm.username.trim() || !createForm.password.trim()) {
      setCreateError('Tous les champs sont requis');
      return;
    }
    if (!createForm.roleId) {
      setCreateError('Veuillez sélectionner un rôle');
      return;
    }
    setCreateLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || 'Erreur lors de la création');
        return;
      }
      setCreateOpen(false);
      setCreateForm({ name: '', username: '', password: '', roleId: '' });
      fetchUsers();
    } catch {
      setCreateError('Erreur de connexion au serveur');
    } finally {
      setCreateLoading(false);
    }
  };

  // --- Edit ---
  const openEdit = (user: UserItem) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      roleId: user.roleId || user.roleRelation?.id || '',
      password: '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    setEditError('');
    if (!editUser || !editForm.name.trim()) {
      setEditError('Le nom est requis');
      return;
    }
    setEditLoading(true);
    try {
      const token = getToken();
      const body: Record<string, unknown> = {
        id: editUser.id,
        name: editForm.name,
        roleId: editForm.roleId,
      };
      if (editForm.password.trim()) {
        body.password = editForm.password;
      }
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }
      setEditOpen(false);
      fetchUsers();
    } catch {
      setEditError('Erreur de connexion au serveur');
    } finally {
      setEditLoading(false);
    }
  };

  // --- Toggle ---
  const openToggle = (user: UserItem) => {
    if (user.id === currentUser?.id && user.active) {
      return;
    }
    setToggleUser(user);
    setToggleOpen(true);
  };

  const handleToggle = async () => {
    if (!toggleUser) return;
    setToggleLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: toggleUser.id, active: !toggleUser.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du changement de statut');
        return;
      }
      setToggleOpen(false);
      fetchUsers();
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setToggleLoading(false);
    }
  };

  const isSelf = (userId: string) => userId === currentUser?.id;

  // --- Skeletons ---
  function TableSkeleton() {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-8 w-20 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  function MobileSkeleton() {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Admin info alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Gestion des comptes utilisateurs — Assignez des rôles pour contrôler les accès
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Gestion des utilisateurs</h2>
        </div>
        <Button onClick={() => { setCreateForm({ name: '', username: '', password: '', roleId: '' }); setCreateError(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel utilisateur
        </Button>
      </div>

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
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <UserCog className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Nom</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={!user.active ? 'opacity-60' : ''}>
                      <TableCell className="pl-4 font-medium">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {isSelf(user.id) && (
                            <span className="text-xs text-muted-foreground">(vous)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {getRoleName(user)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.active}
                            disabled={isSelf(user.id)}
                            onCheckedChange={() => openToggle(user)}
                            aria-label={`Statut de ${user.name}`}
                          />
                          <span className="text-sm text-muted-foreground">
                            {user.active ? (
                              <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Actif</span>
                            ) : (
                              <span className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-destructive" /> Inactif</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(user)}
                            aria-label={`Modifier ${user.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openToggle(user)}
                            disabled={isSelf(user.id)}
                            aria-label={user.active ? `Désactiver ${user.name}` : `Activer ${user.name}`}
                          >
                            {user.active ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            )}
                          </Button>
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
          <MobileSkeleton />
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <UserCog className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun utilisateur trouvé</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id} className={!user.active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{user.name}</p>
                      {isSelf(user.id) && (
                        <span className="text-xs text-muted-foreground shrink-0">(vous)</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <Badge variant="default" className="shrink-0">
                    {getRoleName(user)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.active}
                      disabled={isSelf(user.id)}
                      onCheckedChange={() => openToggle(user)}
                      aria-label={`Statut de ${user.name}`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {user.active ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Actif</span>
                      ) : (
                        <span className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-destructive" /> Inactif</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => openEdit(user)}
                      aria-label={`Modifier ${user.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => openToggle(user)}
                      disabled={isSelf(user.id)}
                      aria-label={user.active ? `Désactiver ${user.name}` : `Activer ${user.name}`}
                    >
                      {user.active ? (
                        <UserX className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Créer un nouveau compte utilisateur pour le système.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-name">Nom complet</Label>
              <Input
                id="create-name"
                placeholder="Ex : Marie Dupont"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-username">Identifiant</Label>
              <Input
                id="create-username"
                placeholder="Ex : marie.dupont"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Mot de passe</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Mot de passe sécurisé"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={createForm.roleId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              Modifier les informations de {editUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-username" className="text-muted-foreground">
                Identifiant (non modifiable)
              </Label>
              <Input id="edit-username" value={editUser?.username ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={editForm.roleId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                Nouveau mot de passe <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Laisser vide pour ne pas modifier"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
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

      {/* Toggle Confirmation Dialog */}
      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUser?.active
                ? 'Désactiver cet utilisateur ?'
                : 'Réactiver cet utilisateur ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.active ? (
                <>
                  Êtes-vous sûr de vouloir désactiver le compte de <strong>{toggleUser?.name}</strong> ?
                  L&apos;utilisateur ne pourra plus se connecter au système.
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir réactiver le compte de <strong>{toggleUser?.name}</strong> ?
                  L&apos;utilisateur pourra à nouveau se connecter.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              disabled={toggleLoading}
              className={
                toggleUser?.active
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : ''
              }
            >
              {toggleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Traitement...
                </div>
              ) : toggleUser?.active ? (
                'Désactiver'
              ) : (
                'Réactiver'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}