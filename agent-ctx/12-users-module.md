# Task 12 — Users Management Module (Frontend)

## Summary
Created the complete `UsersModule` client component at `/home/z/my-project/src/components/modules/users/users-module.tsx`.

## What was built

### Component: `UsersModule`
- **`'use client'` component** exporting `UsersModule` as a named export
- Imports `useAuthStore` from `@/store/auth-store` to get the current user and prevent self-deactivation

### Features implemented
1. **Admin alert banner** at top: "Gestion des comptes utilisateurs — Accès réservé aux administrateurs" using `Alert` + `Shield` icon
2. **Header** with `UserCog` icon, "Gestion des utilisateurs" title, and "Nouvel utilisateur" button (`Plus` icon)
3. **Users table (desktop)** inside `Card`:
   - Columns: Nom, Identifiant, Rôle (`Badge`: ADMIN→default/primary, EMPLOYEE→secondary with `Shield` icon), Statut (`Switch` + `UserCheck`/`UserX` icons), Actions (Edit `Pencil`, Toggle `UserX`/`UserCheck`)
   - Shows "(vous)" next to current user's name
   - Disabled switch + toggle button for self-deactivation
   - Inactive rows have `opacity-60`
   - Wrapped in `ScrollArea` with `max-h-[500px]`
4. **Mobile cards** (`md:hidden`): Each user displayed as a `Card` with name, username, role badge, status switch, and action buttons
5. **Create Dialog**: Form with Nom complet, Identifiant, Mot de passe (password), Rôle (`Select` with ADMIN/EMPLOYEE). Loading spinner on submit.
6. **Edit Dialog**: Shows username (disabled/non-modifiable), editable name + role, optional password field. Loading spinner.
7. **Toggle Confirmation Dialog** (`AlertDialog`): Contextual messaging for activate/deactivate. Destructive style button for deactivation.

### API integration
- `GET /api/users` — fetch all users (on mount, and after mutations)
- `POST /api/users` — create user with `{ username, password, name, role }`
- `PUT /api/users` — update user with `{ id, name?, role?, password?, active? }`
- Token fetched from `localStorage.getItem('ds_token')` and sent as `Authorization: Bearer` header

### Loading states
- Desktop table skeleton (`TableSkeleton`) and mobile card skeleton (`MobileSkeleton`) shown while fetching
- Spinners in dialog submit buttons during create/edit/toggle operations

### Lint
- File passes ESLint with zero errors or warnings (the only lint error in the project is pre-existing in `page.tsx`)

### Components used
Card, Button, Input, Dialog, AlertDialog, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Alert, AlertDescription, Skeleton, ScrollArea

### Icons used
UserCog, Plus, Pencil, Shield, UserCheck, UserX