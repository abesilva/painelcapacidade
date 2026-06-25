import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductionProvider } from "@/contexts/ProductionContext";
import { VersionProvider } from "@/contexts/VersionContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import PlanejamentoPage from "@/pages/PlanejamentoPage";
import CapacidadePage from "@/pages/CapacidadePage";
import ParametrosPage from "@/pages/ParametrosPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import CooispiPage from "@/pages/CooispiPage";
import MelhorSkuPage from "@/pages/MelhorSkuPage";
import VolumeBPPage from "@/pages/VolumeBPPage";
import GraficosPage from "@/pages/GraficosPage";
import RelatorioGerencialPage from "@/pages/RelatorioGerencialPage";
import CapacidadeGeralPage from "@/pages/CapacidadeGeralPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound.tsx";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ProductionProvider>
      <VersionProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/planejamento" element={<PlanejamentoPage />} />
          <Route path="/capacidade" element={<CapacidadePage />} />
          <Route path="/parametros" element={<ParametrosPage />} />
          <Route path="/graficos" element={<GraficosPage />} />
          <Route path="/relatorio" element={<RelatorioGerencialPage />} />
          <Route path="/capacidade-geral" element={<CapacidadeGeralPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/cooispi" element={<CooispiPage />} />
          <Route path="/melhor-sku" element={<MelhorSkuPage />} />
          <Route path="/volume-bp" element={<VolumeBPPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
      </VersionProvider>
    </ProductionProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
