# Task 9: Invoices Management Module — Frontend

## Status: Completed

## Summary
Created the `InvoicesModule` client component at `src/components/modules/invoices/invoices-module.tsx`.

## File Created
- `src/components/modules/invoices/invoices-module.tsx`

## Features Implemented
1. **Header**: "Gestion des factures" with FileText icon and subtitle
2. **Summary cards**: 4 stat cards (Total, Payées, Non payées, Partielles) with color-coded icons
3. **Filter tabs**: Toutes, Payées, Non payées, Partielles via Tabs/TabsList/TabsTrigger — triggers refetch with `?status=` param
4. **Client search**: Input with Search icon to filter by client name (client-side)
5. **Invoices table** with columns: N° (FAC-XXXXXXXX), Client, Service, Montant, Payé, Reste, Statut (colored Badge), Date, Actions (Eye icon button)
6. **Payment dialog**: Click Eye → Dialog shows invoice details, status Select (PAYEE/NON_PAYEE/PARTIELLEMENT_PAYEE), paid amount number Input, real-time remaining amount display, Save/Cancel buttons
7. **Loading skeletons** while fetching
8. **Empty state** with icon and contextual message
9. **Error state** with retry button

## Technical Details
- Uses `localStorage.getItem('ds_token')` for auth
- GET `/api/invoices?status=XXX` with Authorization header
- PUT `/api/invoices` with `{ id, status?, paidAmount? }`
- Invoice number: `"FAC-" + id.substring(0,8).toUpperCase()`
- Amounts formatted with `Intl.NumberFormat('fr-FZ')` + " DA"
- Status badges: PAYEE → emerald/green, NON_PAYEE → destructive/red, PARTIELLEMENT_PAYEE → amber/yellow
- Responsive: mobile-first grid, scrollable table, responsive header layout
- All required shadcn/ui components used: Card, Button, Input, Select, Dialog, Badge, Table, Tabs, Skeleton, ScrollArea, Label
- All required icons used: FileText, Search, CreditCard, DollarSign, Check, X, AlertCircle, Eye

## Lint
- Passes ESLint with zero errors/warnings