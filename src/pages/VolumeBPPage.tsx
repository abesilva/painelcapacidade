import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Package, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVolumeBPData, VERSION_LABELS, TECH_ORDER, VersionKey } from '@/hooks/useVolumeBPData';
import { useAuth } from '@/contexts/AuthContext';

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export default function VolumeBPPage() {
  const { data, handleUpload, getTechSummary } = useVolumeBPData();
  const { isEditor } = useAuth();
  const [activeVersion, setActiveVersion] = useState<VersionKey>('bp');

  const activeData = data[activeVersion];
  const techSummary = useMemo(() => getTechSummary(activeVersion), [getTechSummary, activeVersion]);
  const totalVolume = useMemo(() => techSummary.reduce((s, t) => s + t.total, 0), [techSummary]);

  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    activeData.forEach(r => {
      if (!map[r.mes]) map[r.mes] = {};
      map[r.mes][r.tecnologia] = (map[r.mes][r.tecnologia] || 0) + r.volume;
    });
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.filter(m => map[m]).map(m => ({ mes: m, ...map[m] }));
  }, [activeData]);

  const hasData = activeData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Volume BP</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(VERSION_LABELS) as VersionKey[]).map(key => (
          <div key={key} className="flex items-center gap-1">
            <Button
              variant={activeVersion === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveVersion(key)}
              disabled={data[key].length === 0 && key !== activeVersion}
              className="min-w-[110px]"
            >
              {VERSION_LABELS[key]}
              {data[key].length > 0 && <span className="ml-1 text-xs opacity-70">✓</span>}
            </Button>
            {isEditor && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleUpload(key, () => setActiveVersion(key))}
                title={`Upload ${VERSION_LABELS[key]}`}
              >
                {data[key].length > 0 ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        ))}
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Package className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              {isEditor ? 'Faça upload de uma planilha para visualizar o volume BP' : 'Nenhum dado de volume BP disponível'}
            </p>
            {isEditor && (
              <Button onClick={() => handleUpload('bp', () => setActiveVersion('bp'))}>
                <Upload className="h-4 w-4 mr-2" /> Upload Volume BP
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-lg font-bold text-foreground truncate">{formatNumber(totalVolume)}</p>
              </CardContent>
            </Card>
            {techSummary.map(t => (
              <Card key={t.tech}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{t.tech}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-bold text-foreground truncate">{formatNumber(t.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalVolume > 0 ? ((t.total / totalVolume) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{VERSION_LABELS[activeVersion]} por Mês</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Mês</th>
                    {TECH_ORDER.map(t => (
                      <th key={t} className="text-right py-2 px-3 font-medium text-muted-foreground">{t}</th>
                    ))}
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row, i) => {
                    const rowTotal = TECH_ORDER.reduce((s, t) => s + ((row as any)[t] || 0), 0);
                    return (
                      <tr key={row.mes} className={cn("border-b", i % 2 === 0 ? "bg-muted/30" : "")}>
                        <td className="py-2 px-3 font-medium">{row.mes}</td>
                        {TECH_ORDER.map(t => (
                          <td key={t} className="text-right py-2 px-3 tabular-nums">
                            {formatNumber((row as any)[t] || 0)}
                          </td>
                        ))}
                        <td className="text-right py-2 px-3 font-semibold tabular-nums">{formatNumber(rowTotal)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 font-bold">
                    <td className="py-2 px-3">Total</td>
                    {techSummary.map(t => (
                      <td key={t.tech} className="text-right py-2 px-3 tabular-nums">{formatNumber(t.total)}</td>
                    ))}
                    <td className="text-right py-2 px-3 tabular-nums">{formatNumber(totalVolume)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
