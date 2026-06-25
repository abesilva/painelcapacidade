import { useState, useEffect, useMemo } from 'react';
import { shifts } from '@/data/productionData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { LINHAS_PRODUCAO, getLineOverrides, setLineOverride, removeLineOverride } from '@/data/lineOverrides';
import UserManagement from '@/components/UserManagement';

const STORAGE_KEY = 'cooispi_data';

interface CooispiRow {
  textoBreve: string;
  linhaProducao: string;
  material: string;
  textoBreveDescricao: string;
}

export default function ConfiguracoesPage() {
  const [overrides, setOverrides] = useState<Record<string, string>>(getLineOverrides);
  const [inconsistencias, setInconsistencias] = useState<{ textoBreve: string; material: string; descricao: string }[]>([]);

  // Load "Não identificado" items from stored COOISPI data
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const rows: CooispiRow[] = JSON.parse(raw);
      const seen = new Set<string>();
      const items: { textoBreve: string; material: string; descricao: string }[] = [];
      for (const r of rows) {
        if (r.linhaProducao === 'Não identificado' && !seen.has(r.textoBreve)) {
          seen.add(r.textoBreve);
          items.push({ textoBreve: r.textoBreve, material: r.material, descricao: r.textoBreveDescricao });
        }
      }
      setInconsistencias(items);
    } catch { /* ignore */ }
  }, []);

  const handleAssign = (textoBreve: string, linha: string) => {
    setLineOverride(textoBreve, linha);
    setOverrides(getLineOverrides());
    toast.success(`"${textoBreve.substring(0, 30)}..." classificado como ${linha}`);
  };

  const handleRemove = (textoBreve: string) => {
    removeLineOverride(textoBreve);
    setOverrides(getLineOverrides());
  };

  const allOverrides = useMemo(() => Object.entries(overrides), [overrides]);

  // Items that are still unclassified (no override yet)
  const pendingInconsistencias = useMemo(
    () => inconsistencias.filter(i => !overrides[i.textoBreve]),
    [inconsistencias, overrides]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      {/* User Management */}
      <UserManagement />

      {/* Inconsistências */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Inconsistências de Linha — COOISPI
            {pendingInconsistencias.length > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-2">{pendingInconsistencias.length} pendentes</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInconsistencias.length === 0 && allOverrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma inconsistência encontrada. Faça upload de um arquivo COOISPI para verificar.</p>
          ) : (
            <div className="space-y-4">
              {/* Pending items */}
              {pendingInconsistencias.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Itens com linha "Não identificado" — selecione a linha correta:</p>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Texto Breve</TableHead>
                          <TableHead className="text-xs">Material</TableHead>
                          <TableHead className="text-xs">Classificar como</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingInconsistencias.map(item => (
                          <TableRow key={item.textoBreve}>
                            <TableCell className="text-xs max-w-[250px] truncate">{item.textoBreve}</TableCell>
                            <TableCell className="text-xs font-mono">{item.material}</TableCell>
                            <TableCell>
                              <Select onValueChange={v => handleAssign(item.textoBreve, v)}>
                                <SelectTrigger className="w-40 h-7 text-xs">
                                  <SelectValue placeholder="Selecionar linha" />
                                </SelectTrigger>
                                <SelectContent>
                                  {LINHAS_PRODUCAO.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Already classified overrides */}
              {allOverrides.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Classificações manuais salvas:</p>
                  <div className="max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Texto Breve</TableHead>
                          <TableHead className="text-xs">Linha Atribuída</TableHead>
                          <TableHead className="text-xs w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allOverrides.map(([tb, linha]) => (
                          <TableRow key={tb}>
                            <TableCell className="text-xs max-w-[300px] truncate">{tb}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px]">{linha}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleRemove(tb)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Após classificar, recarregue o arquivo COOISPI para aplicar as correções.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Shifts info */}
        <div className="bg-card rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Turnos de Operação</h2>
          <div className="space-y-2">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                <span>{s.name}</span>
                <span className="font-mono text-primary">{s.hours}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* Formula */}
        <div className="bg-card rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Fórmula Base</h2>
          <div className="bg-muted/50 rounded-md p-3 font-mono text-xs leading-relaxed">
            <p>UC/hora = (Taxa × 60 × OEE / QTD_sachê / QTD_caixinha) × UC_fator</p>
            <p className="mt-2 text-muted-foreground">Cap. Linha = UC/hora × Máquinas × Horas_líquidas</p>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-card rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Regras de Operação</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Granel</span><span>1º e 2º turno</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TeaBag</span><span>1º e 2º turno</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Termo</span><span>3 turnos</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ervas</span><span>3 turnos</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ervas Antigo</span><span>3 turnos (opcional)</span></div>
          </div>
        </div>

        {/* Asepsia info */}
        <div className="bg-card rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Regra de Assepsia</h2>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• 1 vez por mês por linha</p>
            <p>• 1º turno: aplica apenas desconto de assepsia</p>
            <p>• 2º e 3º turno: descontos normais do dia</p>
            <p>• Dia configurável via Planejamento</p>
          </div>
        </div>

        {/* About */}
        <div className="bg-card rounded-lg border p-4 md:col-span-2">
          <h2 className="font-semibold mb-3">Sobre</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Capacidade de Produção</strong> — Leão Alimentos e Bebidas</p>
            <p>Aplicação para cálculo e simulação de capacidade produtiva da fábrica de chás.</p>
            <p className="text-xs mt-3">Versão 1.0 • Dados simulados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
