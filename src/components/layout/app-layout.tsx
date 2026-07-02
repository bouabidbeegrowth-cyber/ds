'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  LayoutDashboard, Users, Sparkles, Calendar, FileText,
  ShoppingCart, Receipt, UserCog, LogOut, Menu, X, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DashboardModule } from '@/components/modules/dashboard';
import { ClientsModule } from '@/components/modules/clients/clients-module';
import { ServicesModule } from '@/components/modules/services/services-module';
import { AppointmentsModule } from '@/components/modules/appointments/appointments-module';
import { InvoicesModule } from '@/components/modules/invoices/invoices-module';
import { PurchasesModule } from '@/components/modules/purchases/purchases-module';
import { ExpensesModule } from '@/components/modules/expenses/expenses-module';
import { UsersModule } from '@/components/modules/users/users-module';

type Page = 'dashboard' | 'clients' | 'services' | 'appointments' | 'invoices' | 'purchases' | 'expenses' | 'users';

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'services', label: 'Services', icon: Sparkles },
  { id: 'appointments', label: 'Rendez-vous', icon: Calendar },
  { id: 'invoices', label: 'Factures', icon: FileText },
  { id: 'purchases', label: 'Achats', icon: ShoppingCart },
  { id: 'expenses', label: 'Dépenses', icon: Receipt },
  { id: 'users', label: 'Utilisateurs', icon: UserCog, adminOnly: true },
];

export function AppLayout() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
  };

  const navigate = (page: Page) => {
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardModule />;
      case 'clients': return <ClientsModule />;
      case 'services': return <ServicesModule />;
      case 'appointments': return <AppointmentsModule />;
      case 'invoices': return <InvoicesModule />;
      case 'purchases': return <PurchasesModule />;
      case 'expenses': return <ExpensesModule />;
      case 'users': return isAdmin ? <UsersModule /> : null;
      default: return <DashboardModule />;
    }
  };

  const currentNav = NAV_ITEMS.find(n => n.id === currentPage);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-border shrink-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 flex items-center gap-3">
            <img src="/ds-logo.png" alt="DS" className="w-11 h-11 rounded-full" />
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg text-foreground leading-tight">DS Esthétique</h1>
              <p className="text-xs text-muted-foreground truncate">Centre de beauté</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <Separator />

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>

          <Separator />

          {/* User info + logout */}
          <div className="p-3">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrateur' : 'Employé'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {currentNav && (
              <>
                <currentNav.icon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{currentNav.label}</h2>
              </>
            )}
          </div>
          <div className="ml-auto">
            <img src="/ds-logo.png" alt="DS" className="w-8 h-8 rounded-full lg:hidden" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {renderPage()}
        </main>

        {/* Footer */}
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground bg-card">
          © {new Date().getFullYear()} DS Esthétique — Gestion du centre de beauté
        </footer>
      </div>
    </div>
  );
}