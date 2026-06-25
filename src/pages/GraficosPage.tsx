import { useMemo, useState } from 'react';
import { useProduction } from '@/contexts/ProductionContext';
import { calcMonthlyCapacity, formatUC } from '@/data/capacityEngine';
import { useVolumeBPData, TECH_ORDER } from '@/hooks/useVolumeBPData';
import { useVersion } from '@/contexts/VersionContext';
import { useCooispiData } from '@/hooks/useCooispiData';
import MonthSelector from '@/components/MonthSelector';
import { Technology } from '@/data/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Map COOISPI line names to production line names */
function mapCooispiLineName(cooispiName: string): string {
  const map: Record<string, string> = {
    'OPTIMA 1': 'OPTIMA', 'OPTIMA 2': 'OPTIMA', 'OPTIMA 3': 'OPTIMA',
    'Ervas antigo': 'ER antigo',
  };
  return map[cooispiName] || cooispiName;
}

export default function GraficosPage() {
  const { lines, monthPlan, discounts, selectedMonth, setSelectedMonth } = useProduction();
  const { getMonthlyByTech, data: volumeBPData } = useVolumeBPData();
  const { version: comparisonVersion, label: comparisonLabel } = useVersion();
  const cooispi = useCooispiData(selectedMonth.year, selectedMonth.month);

  const [selectedTechs, setSelectedTechs] = useState<Technology[]>([]);
  const hasBP = (volumeBPData.bp.length + volumeBPData.re05.length + volumeBPData.re09.length) > 0;

  const currentMonthAbbr = MONTH_ABBR[selectedMonth.month];

  const toggleTech = (tech: Technology) => {
    setSelectedTechs(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
  };

  // Calculate capacity by technology
  const capacityByTech = useMemo(() => {
    const map: Record<string, number> = {};
    lines.forEach(line => {
      const result = calcMonthlyCapacity(line, monthPlan.days, discounts);
      map[line.technology] = (map[line.technology] || 0) + result.monthTotal;
    });
    return map;
  }, [lines, monthPlan, discounts]);

  // Realized by technology
  const realizedByTech = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(cooispi.byLine).forEach(([cooispiName, uc]) => {
      const mappedName = mapCooispiLineName(cooispiName);
      const line = lines.find(l => l.name === mappedName);
      if (line) {
        map[line.technology] = (map[line.technology] || 0) + uc;
      }
    });
    return map;
  }, [cooispi.byLine, lines]);

  // BP by technology
  const bpByTech = useMemo(() => {
    const techs = getMonthlyByTech(comparisonVersion, currentMonthAbbr);
    const map: Record<string, number> = {};
    techs.forEach(t => { map[t.tech] = t.total; });
    return map;
  }, [getMonthlyByTech, currentMonthAbbr, comparisonVersion]);

  // Chart data
  const chartData = useMemo(() => {
    const techs = selectedTechs.length > 0 ? TECH_ORDER.filter(t => selectedTechs.includes(t as Technology)) : [...TECH_ORDER];
    return techs.map(tech => ({
      name: tech,
      Capacidade: Math.round(capacityByTech[tech] || 0),
      BP: Math.round(bpByTech[tech] || 0),
      Realizado: Math.round(realizedByTech[tech] || 0),
    }));
  }, [capacityByTech, bpByTech, realizedByTech, selectedTechs]);

  // Total chart data
  const totalChartData = useMemo(() => {
    const techs = selectedTechs.length > 0 ? TECH_ORDER.filter(t => selectedTechs.includes(t as Technology)) : [...TECH_ORDER];
    return [{
      name: 'Total',
      Capacidade: techs.reduce((s, t) => s + Math.round(capacityByTech[t] || 0), 0),
      BP: techs.reduce((s, t) => s + Math.round(bpByTech[t] || 0), 0),
      Realizado: techs.reduce((s, t) => s + Math.round(realizedByTech[t] || 0), 0),
    }];
  }, [capacityByTech, bpByTech, realizedByTech, selectedTechs]);

  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gráficos</h1>
          <p className="text-sm text-muted-foreground">Capacidade vs BP vs Realizado — {monthName}</p>
        </div>
        <MonthSelector year={selectedMonth.year} month={selectedMonth.month} onChange={setSelectedMonth} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Filtrar tecnologia:</span>
        {TECH_ORDER.map(tech => (
          <label key={tech} className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox checked={selectedTechs.includes(tech as Technology)} onCheckedChange={() => toggleTech(tech as Technology)} />
            {tech}
          </label>
        ))}
        {selectedTechs.length > 0 && (
          <button onClick={() => setSelectedTechs([])} className="text-xs text-primary hover:underline">Limpar</button>
        )}
      </div>

      {/* Chart - By Technology */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Por Tecnologia</h2>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={v => formatUC(v)} className="text-xs" />
              <Tooltip
                formatter={(value: number) => formatUC(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="Capacidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Capacidade" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>
              {hasBP && <Bar dataKey="BP" name={comparisonLabel} fill="hsl(var(--warning))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="BP" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>}
              <Bar dataKey="Realizado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Realizado" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart - Total */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Total Consolidado</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totalChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={v => formatUC(v)} className="text-xs" />
              <Tooltip
                formatter={(value: number) => formatUC(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="Capacidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Capacidade" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>
              {hasBP && <Bar dataKey="BP" name={comparisonLabel} fill="hsl(var(--warning))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="BP" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>}
              <Bar dataKey="Realizado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Realizado" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left p-3 font-medium">Tecnologia</th>
              <th className="text-right p-3 font-medium">Capacidade (UC)</th>
              {hasBP && <th className="text-right p-3 font-medium">{comparisonLabel} (UC)</th>}
              <th className="text-right p-3 font-medium">Realizado (UC)</th>
              {hasBP && <th className="text-right p-3 font-medium">Ating. {comparisonLabel} (%)</th>}
              <th className="text-right p-3 font-medium">Ating. Cap (%)</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map(row => (
              <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3 text-right font-mono text-primary">{formatUC(row.Capacidade)}</td>
                {hasBP && <td className="p-3 text-right font-mono">{formatUC(row.BP)}</td>}
                <td className="p-3 text-right font-mono text-success">{formatUC(row.Realizado)}</td>
                {hasBP && <td className="p-3 text-right font-mono">{row.BP > 0 ? `${Math.round(row.Realizado / row.BP * 100)}%` : '—'}</td>}
                <td className="p-3 text-right font-mono">{row.Capacidade > 0 ? `${Math.round(row.Realizado / row.Capacidade * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
