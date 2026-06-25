import React, { useMemo, useState } from 'react';
import { useProduction } from '@/contexts/ProductionContext';
import { calcMonthlyCapacity, formatUC } from '@/data/capacityEngine';
import { useVolumeBPData, TECH_ORDER } from '@/hooks/useVolumeBPData';
import { useVersion } from '@/contexts/VersionContext';
import { useYearlyMonthPlans } from '@/hooks/useYearlyMonthPlans';
import { ProductionLine, DayPlan } from '@/data/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { cn } from '@/lib/utils';
import tpmLogo from '@/assets/logo-capacidade.png';
import { Loader2 } from 'lucide-react';

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COOISPI_STORAGE_KEY = 'cooispi_data';

function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function mapCooispiLineName(cooispiName: string): string {
  const map: Record<string, string> = {
    'OPTIMA 1': 'OPTIMA', 'OPTIMA 2': 'OPTIMA', 'OPTIMA 3': 'OPTIMA',
    'Ervas antigo': 'ER antigo',
  };
  return map[cooispiName] || cooispiName;
}

/** Build a default month plan for capacity calculation */
function buildDefaultMonthPlan(year: number, month: number, lines: ProductionLine[]): Record<string, DayPlan> {
  const days: Record<string, DayPlan> = {};
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const activeLines = isWeekend ? [] : lines.filter(l => !l.optional).map(l => l.id);
    const machinesOverride: Record<string, Record<number, number>> = {};
    activeLines.forEach(lineId => {
      const line = lines.find(l => l.id === lineId);
      if (line) machinesOverride[lineId] = { ...line.machinesPerShift };
    });
    const firstWorkingDay = date.getDay() !== 0 && date.getDay() !== 6 && !Object.keys(days).some(d => {
      const dd = new Date(d + 'T12:00:00');
      return dd.getDay() !== 0 && dd.getDay() !== 6;
    });
    days[dateStr] = {
      date: dateStr,
      activeLines,
      asepsiaLines: firstWorkingDay ? activeLines.slice() : [],
      machinesOverride,
    };
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const techColors: Record<string, string> = {
  'Granel': 'border-l-primary',
  'TeaBag': 'border-l-accent',
  'Termo': 'border-l-success',
  'Ervas': 'border-l-warning',
};

export default function CapacidadeGeralPage() {
  const { lines, discounts } = useProduction();
  const { data: volumeBPData, getMonthlyByTech } = useVolumeBPData();
  const { version: comparisonVersion, label: comparisonLabel } = useVersion();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { plansByMonth, loading: loadingPlans } = useYearlyMonthPlans(selectedYear, lines);

  const hasBP = (volumeBPData.bp.length + volumeBPData.re05.length + volumeBPData.re09.length) > 0;

  // Calculate capacity for all 12 months using SAVED plans
  const yearlyCapacity = useMemo(() => {
    const byTech: Record<string, number[]> = {};
    TECH_ORDER.forEach(t => { byTech[t] = new Array(12).fill(0); });

    for (let month = 0; month < 12; month++) {
      const dayPlans = plansByMonth[month];
      if (!dayPlans) continue;
      lines.forEach(line => {
        const result = calcMonthlyCapacity(line, dayPlans, discounts);
        if (byTech[line.technology]) {
          byTech[line.technology][month] += result.monthTotal;
        }
      });
    }
    return byTech;
  }, [plansByMonth, lines, discounts]);

  // BP (or selected version) for all 12 months
  const yearlyBP = useMemo(() => {
    const byTech: Record<string, number[]> = {};
    TECH_ORDER.forEach(t => { byTech[t] = new Array(12).fill(0); });
    if (!hasBP) return byTech;

    for (let month = 0; month < 12; month++) {
      const techs = getMonthlyByTech(comparisonVersion, MONTH_ABBR[month]);
      techs.forEach(t => {
        if (byTech[t.tech]) byTech[t.tech][month] = t.total;
      });
    }
    return byTech;
  }, [hasBP, getMonthlyByTech, comparisonVersion]);

  // Realized (COOISPI) for all 12 months
  const yearlyRealized = useMemo(() => {
    const byTech: Record<string, number[]> = {};
    TECH_ORDER.forEach(t => { byTech[t] = new Array(12).fill(0); });

    try {
      const raw = localStorage.getItem(COOISPI_STORAGE_KEY);
      if (!raw) return byTech;
      const allRows = JSON.parse(raw) as any[];

      allRows.forEach(r => {
        const d = parseDate(r.dataBase);
        if (!d || d.getFullYear() !== selectedYear) return;
        const mappedName = mapCooispiLineName(r.linhaProducao);
        const line = lines.find(l => l.name === mappedName);
        if (line && byTech[line.technology]) {
          byTech[line.technology][d.getMonth()] += (r.ucReal || 0);
        }
      });
    } catch {}
    return byTech;
  }, [selectedYear, lines]);

  // Totals by technology (year)
  const totals = useMemo(() => {
    return TECH_ORDER.map(tech => {
      const capacity = yearlyCapacity[tech]?.reduce((a, b) => a + b, 0) || 0;
      const bp = yearlyBP[tech]?.reduce((a, b) => a + b, 0) || 0;
      const realized = yearlyRealized[tech]?.reduce((a, b) => a + b, 0) || 0;
      return { tech, capacity, bp, realized, deficit: capacity - bp };
    });
  }, [yearlyCapacity, yearlyBP, yearlyRealized]);

  const grandTotal = useMemo(() => ({
    capacity: totals.reduce((s, t) => s + t.capacity, 0),
    bp: totals.reduce((s, t) => s + t.bp, 0),
    realized: totals.reduce((s, t) => s + t.realized, 0),
    deficit: totals.reduce((s, t) => s + t.deficit, 0),
  }), [totals]);

  // Chart data by month
  const monthlyChartData = useMemo(() => {
    return MONTH_ABBR.map((abbr, i) => {
      const cap = Math.round(TECH_ORDER.reduce((s, t) => s + (yearlyCapacity[t]?.[i] || 0), 0));
      const bp = Math.round(TECH_ORDER.reduce((s, t) => s + (yearlyBP[t]?.[i] || 0), 0));
      return {
        name: abbr,
        Capacidade: cap,
        BP: bp,
        Realizado: Math.round(TECH_ORDER.reduce((s, t) => s + (yearlyRealized[t]?.[i] || 0), 0)),
        Déficit: cap - bp,
      };
    });
  }, [yearlyCapacity, yearlyBP, yearlyRealized]);

  // Chart data by tech (yearly total)
  const techChartData = useMemo(() => {
    return totals.map(t => ({
      name: t.tech,
      Capacidade: Math.round(t.capacity),
      BP: Math.round(t.bp),
      Realizado: Math.round(t.realized),
      Déficit: Math.round(t.deficit),
    }));
  }, [totals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <img src={tpmLogo} alt="Capacidade de Produção" className="h-8 w-auto object-contain" />
            Capacidade Geral
            {loadingPlans && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground ml-11">Visão anual — Capacidade (planejamento salvo), {comparisonLabel} e Realizado por tecnologia</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:border-primary/50 transition-colors"
          >
            ◀
          </button>
          <span className="px-4 py-2 rounded-lg border bg-card text-sm font-bold tabular-nums min-w-[80px] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:border-primary/50 transition-colors"
          >
            ▶
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <p className="text-xs text-muted-foreground mb-1">Capacidade Total Anual</p>
          <p className="text-2xl font-bold font-mono text-primary">{formatUC(grandTotal.capacity)}</p>
          <p className="text-xs text-muted-foreground">UC</p>
        </div>
        {hasBP && (
          <div className="bg-card rounded-lg border p-5">
            <p className="text-xs text-muted-foreground mb-1">{comparisonLabel} Anual</p>
            <p className="text-2xl font-bold font-mono">{formatUC(grandTotal.bp)}</p>
            <p className="text-xs text-muted-foreground">UC</p>
          </div>
        )}
        <div className="bg-card rounded-lg border p-5">
          <p className="text-xs text-muted-foreground mb-1">Realizado Anual</p>
          <p className="text-2xl font-bold font-mono text-success">{formatUC(grandTotal.realized)}</p>
          <p className="text-xs text-muted-foreground">UC</p>
        </div>
        {hasBP && (
          <div className="bg-card rounded-lg border p-5">
            <p className="text-xs text-muted-foreground mb-1">Déficit Cap x {comparisonLabel}</p>
            <p className={cn("text-2xl font-bold font-mono", grandTotal.deficit >= 0 ? "text-success" : "text-destructive")}>{formatUC(grandTotal.deficit)}</p>
            <p className="text-xs text-muted-foreground">UC</p>
          </div>
        )}
      </div>

      {/* Technology Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {totals.map(t => {
          const atingCap = t.capacity > 0 ? Math.round(t.realized / t.capacity * 100) : 0;
          const atingBP = t.bp > 0 ? Math.round(t.realized / t.bp * 100) : 0;
          return (
            <div key={t.tech} className={cn("bg-card rounded-lg border p-5 border-l-4", techColors[t.tech])}>
              <h3 className="font-semibold text-lg mb-4">{t.tech}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Capacidade</p>
                  <p className="font-mono font-bold text-primary">{formatUC(t.capacity)}</p>
                </div>
                {hasBP && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{comparisonLabel}</p>
                    <p className="font-mono font-bold">{formatUC(t.bp)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                  <p className="font-mono font-bold text-success">{formatUC(t.realized)}</p>
                </div>
                {hasBP && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Déficit Cap x {comparisonLabel}</p>
                    <p className={cn("font-mono font-bold", t.deficit >= 0 ? "text-success" : "text-destructive")}>{formatUC(t.deficit)}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Ating. Cap: <span className="font-mono font-bold text-foreground">{atingCap}%</span></span>
                {hasBP && <span>Ating. {comparisonLabel}: <span className="font-mono font-bold text-foreground">{atingBP}%</span></span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart - Monthly Evolution */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Evolução Mensal — Total</h2>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={v => formatUC(v)} className="text-xs" />
              <Tooltip
                formatter={(value: number) => formatUC(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="Capacidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              {hasBP && <Bar dataKey="BP" name={comparisonLabel} fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />}
              <Bar dataKey="Realizado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              {hasBP && <Bar dataKey="Déficit" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart - By Technology */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Total Anual por Tecnologia</h2>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={techChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              {hasBP && <Bar dataKey="Déficit" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Déficit" position="top" formatter={(v: number) => formatUC(v)} className="text-[10px] fill-foreground" />
              </Bar>}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Detail Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <h2 className="text-lg font-semibold p-4 pb-2">Detalhamento Mensal por Tecnologia</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left p-3 font-medium">Mês</th>
              {TECH_ORDER.map(tech => (
              <th key={tech} className="text-right p-3 font-medium" colSpan={hasBP ? 4 : 2}>{tech}</th>
              ))}
              <th className="text-right p-3 font-medium" colSpan={hasBP ? 4 : 2}>Total</th>
            </tr>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="p-2"></th>
              {[...TECH_ORDER, 'Total'].map(tech => (
                <React.Fragment key={tech}>
                  <th className="text-right p-2 font-normal">Cap</th>
                  {hasBP && <th className="text-right p-2 font-normal">{comparisonLabel}</th>}
                  <th className="text-right p-2 font-normal">Real</th>
                  {hasBP && <th className="text-right p-2 font-normal">Déf</th>}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTH_ABBR.map((abbr, i) => {
              const monthTotalCap = TECH_ORDER.reduce((s, t) => s + (yearlyCapacity[t]?.[i] || 0), 0);
              const monthTotalBP = TECH_ORDER.reduce((s, t) => s + (yearlyBP[t]?.[i] || 0), 0);
              const monthTotalReal = TECH_ORDER.reduce((s, t) => s + (yearlyRealized[t]?.[i] || 0), 0);
              return (
                <tr key={abbr} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 font-medium">{abbr}</td>
                  {TECH_ORDER.map(tech => (
                    <React.Fragment key={tech}>
                      <td className="p-2 text-right font-mono text-xs text-primary">{formatUC(yearlyCapacity[tech]?.[i] || 0)}</td>
                      {hasBP && <td className="p-2 text-right font-mono text-xs">{formatUC(yearlyBP[tech]?.[i] || 0)}</td>}
                      <td className="p-2 text-right font-mono text-xs text-success">{formatUC(yearlyRealized[tech]?.[i] || 0)}</td>
                      {hasBP && <td className={cn("p-2 text-right font-mono text-xs", (yearlyCapacity[tech]?.[i] || 0) - (yearlyBP[tech]?.[i] || 0) >= 0 ? "text-success" : "text-destructive")}>{formatUC((yearlyCapacity[tech]?.[i] || 0) - (yearlyBP[tech]?.[i] || 0))}</td>}
                    </React.Fragment>
                  ))}
                  <td className="p-2 text-right font-mono text-xs font-bold text-primary">{formatUC(monthTotalCap)}</td>
                  {hasBP && <td className="p-2 text-right font-mono text-xs font-bold">{formatUC(monthTotalBP)}</td>}
                  <td className="p-2 text-right font-mono text-xs font-bold text-success">{formatUC(monthTotalReal)}</td>
                  {hasBP && <td className={cn("p-2 text-right font-mono text-xs font-bold", monthTotalCap - monthTotalBP >= 0 ? "text-success" : "text-destructive")}>{formatUC(monthTotalCap - monthTotalBP)}</td>}
                </tr>
              );
            })}
            {/* Year total row */}
            <tr className="border-t-2 border-border font-bold bg-muted/20">
              <td className="p-3">Total</td>
              {TECH_ORDER.map(tech => {
                const t = totals.find(x => x.tech === tech)!;
                return (
                    <React.Fragment key={tech}>
                    <td className="p-2 text-right font-mono text-xs text-primary">{formatUC(t.capacity)}</td>
                    {hasBP && <td className="p-2 text-right font-mono text-xs">{formatUC(t.bp)}</td>}
                    <td className="p-2 text-right font-mono text-xs text-success">{formatUC(t.realized)}</td>
                    {hasBP && <td className={cn("p-2 text-right font-mono text-xs", t.deficit >= 0 ? "text-success" : "text-destructive")}>{formatUC(t.deficit)}</td>}
                  </React.Fragment>
                );
              })}
              <td className="p-2 text-right font-mono text-xs text-primary">{formatUC(grandTotal.capacity)}</td>
              {hasBP && <td className="p-2 text-right font-mono text-xs">{formatUC(grandTotal.bp)}</td>}
              <td className="p-2 text-right font-mono text-xs text-success">{formatUC(grandTotal.realized)}</td>
              {hasBP && <td className={cn("p-2 text-right font-mono text-xs", grandTotal.deficit >= 0 ? "text-success" : "text-destructive")}>{formatUC(grandTotal.deficit)}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


