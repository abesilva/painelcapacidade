import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Calendar, Factory, Settings, SlidersHorizontal, ChevronLeft, ChevronRight, FileSpreadsheet, Star, Package, LogOut, PieChart, ClipboardList, Globe } from 'lucide-react';
import hourglassIcon from '@/assets/hourglass-icon.png';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import tpmLogo from '@/assets/logo-capacidade.png';
import capacidadeLogo from '@/assets/logo-capacidade.png';
import VersionSelector from '@/components/VersionSelector';

const navItems = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/planejamento', label: 'Planejamento', icon: Calendar },
  { path: '/capacidade', label: 'Capacidade', icon: Factory },
  { path: '/parametros', label: 'Parâmetros', icon: SlidersHorizontal },
  { path: '/graficos', label: 'Gráficos', icon: PieChart },
  { path: '/relatorio', label: 'Relatório Gerencial', icon: ClipboardList },
  { path: '/cooispi', label: 'COOISPI', icon: FileSpreadsheet },
  { path: '/melhor-sku', label: 'Melhor SKU', icon: Star },
  { path: '/volume-bp', label: 'Volume BP', icon: Package },
  { path: '/capacidade-geral', label: 'Capacidade Geral', icon: Globe },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, role, signOut } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-start gap-2 px-3"
        )}>
          <img
            src={hourglassIcon}
            alt="Ampulheta"
            className="h-9 w-9 shrink-0 object-contain animate-[spin_4s_linear_infinite]"
          />
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[13px] font-bold text-sidebar-foreground truncate">Capacidade</span>
              <span className="text-[11px] text-muted-foreground truncate">de Produção</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info & logout */}
        <div className="border-t border-sidebar-border px-3 py-2">
          {!collapsed && (
            <div className="text-[10px] text-muted-foreground truncate mb-1">
              {user?.email}
              <span className="ml-1 text-primary">({role === 'editor' ? 'Edição' : 'Visualização'})</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-56"
      )}>
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border h-12 flex items-center justify-end px-6">
          <VersionSelector />
        </div>
        <div className="p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
