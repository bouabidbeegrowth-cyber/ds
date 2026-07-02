# Task 6 — Clients Management Module

## Status: ✅ Completed

## Summary
Created `/home/z/my-project/src/components/modules/clients/clients-module.tsx` — a comprehensive, production-ready 'use client' component exporting `ClientsModule`.

## Features Implemented

1. **Header**: Title "Gestion des clients" with client count subtitle and "Nouveau client" button (Plus icon)
2. **Search bar**: Debounced search (300ms) filtering by name or phone via `useEffect`
3. **Clients table** (desktop) with columns: Nom, Téléphone, Email, Remarques (truncated), Actions (Edit/Delete/History)
4. **Mobile card layout**: Card-based layout with client info shown on screens < `md` breakpoint
5. **Create/Edit Dialog**: Form with react-hook-form + zod v4 validation (Prénom, Nom, Téléphone, Email, Adresse, Remarques)
6. **Client History Dialog**: 2 tabs — "Rendez-vous" (appointments) and "Factures" (invoices) with status badges
7. **Delete confirmation**: AlertDialog with client name shown in description

## Status Badges
- Appointments: PROGRAMME→blue, ANNULE→destructive, TERMINE→green
- Invoices: PAYEE→green, NON_PAYEE→destructive, PARTIELLEMENT_PAYEE→yellow

## API Endpoints Used
- `GET /api/clients?q=searchTerm` — list/search clients
- `POST /api/clients` — create client
- `PUT /api/clients` — update client
- `DELETE /api/clients` — delete client
- `GET /api/clients/:id/appointments` — client appointments history
- `GET /api/clients/:id/invoices` — client invoices history

All use `Authorization: Bearer ${token}` from localStorage (`ds_token` key).

## Lint Status
No lint errors in clients-module.tsx. All existing lint errors are from pre-existing files.