// Permission system types and utilities

export type PermissionLevel = 'none' | 'read' | 'write' | 'full';

export type ModuleKey =
  | 'clients'
  | 'services'
  | 'appointments'
  | 'invoices'
  | 'purchases'
  | 'expenses'
  | 'users'
  | 'dashboard';

export type Permissions = Record<ModuleKey, PermissionLevel>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  clients: 'Clients',
  services: 'Services',
  appointments: 'Rendez-vous',
  invoices: 'Factures',
  purchases: 'Achats',
  expenses: 'Dépenses',
  users: 'Utilisateurs',
  dashboard: 'Tableau de bord',
};

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string; description: string }[] = [
  { value: 'none', label: 'Aucun accès', description: 'Pas accès à ce module' },
  { value: 'read', label: 'Lecture seule', description: 'Peut uniquement consulter' },
  { value: 'write', label: 'Lecture-Écriture', description: 'Peut créer et modifier' },
  { value: 'full', label: 'Accès complet', description: 'Peut créer, modifier et supprimer' },
];

export const ALL_MODULES: ModuleKey[] = [
  'clients',
  'services',
  'appointments',
  'invoices',
  'purchases',
  'expenses',
  'users',
  'dashboard',
];

export const DEFAULT_PERMISSIONS: Permissions = {
  clients: 'none',
  services: 'none',
  appointments: 'none',
  invoices: 'none',
  purchases: 'none',
  expenses: 'none',
  users: 'none',
  dashboard: 'none',
};

export const ADMIN_PERMISSIONS: Permissions = {
  clients: 'full',
  services: 'full',
  appointments: 'full',
  invoices: 'full',
  purchases: 'full',
  expenses: 'full',
  users: 'full',
  dashboard: 'full',
};

export const EMPLOYEE_PERMISSIONS: Permissions = {
  clients: 'read',
  services: 'read',
  appointments: 'write',
  invoices: 'read',
  purchases: 'none',
  expenses: 'none',
  users: 'none',
  dashboard: 'read',
};

export function parsePermissions(json: string): Permissions {
  try {
    const parsed = JSON.parse(json);
    return { ...DEFAULT_PERMISSIONS, ...parsed };
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export function serializePermissions(permissions: Permissions): string {
  return JSON.stringify(permissions);
}

// Check if a permission level allows a specific action
export function canRead(level: PermissionLevel | undefined): boolean {
  return !!level && level !== 'none';
}

export function canWrite(level: PermissionLevel | undefined): boolean {
  return level === 'write' || level === 'full';
}

export function canDelete(level: PermissionLevel | undefined): boolean {
  return level === 'full';
}

// Shorthand to check module permission
export function hasPermission(
  permissions: Permissions,
  module: ModuleKey,
  action: 'read' | 'write' | 'delete'
): boolean {
  const level = permissions[module] || 'none';
  switch (action) {
    case 'read':
      return canRead(level);
    case 'write':
      return canWrite(level);
    case 'delete':
      return canDelete(level);
  }
}