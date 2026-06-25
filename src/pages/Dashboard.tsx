import { useProduction } from '@/contexts/ProductionContext';
import { calcMonthlyCapacity, calcUcPerHour, calcDailyCapacity, formatUC } from '@/data/capacityEngine';
import { Factory, TrendingUp, Calendar, Zap, Filter, CheckCircle2, Target, Lock, Unlock, BarChart3, ChevronDown, Package } from 'lucide-react';
import tpmLogo from '@/assets/logo-capacidade.png';
import MonthSelector from '@/components/MonthSelector';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Technology } from '@/data/types';
import { useCooispiData } from '@/hooks/useCooispiData';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useVolumeBPData } from '@/hooks/useVolumeBPData';
import { useVersion } from '@/contexts/VersionContext';

const CLOSED_MONTHS_KEY = 'closed_months';

function getClosedMonths(): string[] {
  try {
    const raw = localStorage.getItem(CLOSED_MONTHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setClosedMonths(months: string[]) {
  localStorage.setItem(CLOSED_MONTHS_KEY, JSON.stringify(months));
}

const techColors: Record<string, string> = {
  'Granel': 'border-l-primary',
  'TeaBag': 'border-l-accent',
  'Termo': 'border-l-success',
  'Ervas': 'border-l-warning',
};

/** Map COOISPI line names to production line names */
function mapCooispiLineName(cooispiName: string): string {
  const map: Record<string, string> = {
    'OPTIMA 1': 'OPTIMA', 'OPTIMA 2': 'OPTIMA', 'OPTIMA 3': 'OPTIMA',
    'Ervas antigo': 'ER antigo',
  };
  return map[cooispiName] || cooispiName;
}

export default function Dashboard() {
  const { lines, monthPlan, discounts, selectedMonth, setSelectedMonth } = useProduction();
  const cooispi = useCooispiData(selectedMonth.year, selectedMonth.month);
  const { data: volumeBPData, getMonthlyByTech } = useVolumeBPData();
  const { version: comparisonVersion, label: comparisonLabel } = useVersion();

  const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentMonthAbbr = MONTH_ABBR[selectedMonth.month];
  // Month closed state
  const monthKey = `${selectedMonth.year}-${selectedMonth.month}`;
  const [closedMonthsList, setClosedMonthsList] = useState<string[]>(getClosedMonths);
  const isMonthClosed = closedMonthsList.includes(monthKey);

  const toggleMonthClosed = useCallback(() => {
    setClosedMonthsList(prev => {
      const next = prev.includes(monthKey) ? prev.filter(k => k !== monthKey) : [...prev, monthKey];
      setClosedMonths(next);
      return next;
    });
  }, [monthKey]);

  // Filters
  const allTechnologies = useMemo(() => [...new Set(lines.map(l => l.technology))], [lines]);
  const [selectedTechs, setSelectedTechs] = useState<Technology[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<number[]>([]);

  const filteredLines = useMemo(() => {
    let result = lines;
    if (selectedTechs.length > 0) result = result.filter(l => selectedTechs.includes(l.technology));
    if (selectedLineIds.length > 0) result = result.filter(l => selectedLineIds.includes(l.id));
    return result;
  }, [lines, selectedTechs, selectedLineIds]);
  
  const filteredLineIds = useMemo(() => new Set(filteredLines.map(l => l.id)), [filteredLines]);

  // Line capacities
  const lineCapacities = useMemo(() => filteredLines.map(line => {
    const result = calcMonthlyCapacity(line, monthPlan.days, discounts);
    return { line, ...result };
  }), [filteredLines, monthPlan, discounts]);

  // Projection: capacity from day AFTER last COOISPI date to end of month (only if month not closed)
  const lineProjections = useMemo(() => {
    if (!cooispi.lastDate || isMonthClosed) return isMonthClosed ? {} : null;

    const lastDate = new Date(cooispi.lastDate + 'T12:00:00');
    const projectionStartDate = new Date(lastDate);
    projectionStartDate.setDate(projectionStartDate.getDate() + 1);
    const startStr = projectionStartDate.toISOString().split('T')[0];

    const projByLine: Record<string, number> = {};

    filteredLines.forEach(line => {
      let lineProj = 0;
      Object.entries(monthPlan.days)
        .filter(([dateStr]) => dateStr >= startStr)
        .forEach(([dateStr, plan]) => {
          if (!plan.activeLines.includes(line.id)) return;
          const date = new Date(dateStr + 'T12:00:00');
          const dow = date.getDay();
          const isAsepsia = plan.asepsiaLines.includes(line.id);
          const result = calcDailyCapacity(line, dow, discounts, isAsepsia, plan);
          lineProj += result.total;
        });
      projByLine[line.id] = lineProj;
    });

    return projByLine;
  }, [cooispi.lastDate, isMonthClosed, filteredLines, monthPlan, discounts]);

  // Realized by line (mapped) — filtered by selected lines
  const realizedByLineId = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(cooispi.byLine).forEach(([cooispiName, uc]) => {
      const mappedName = mapCooispiLineName(cooispiName);
      const line = lines.find(l => l.name === mappedName);
      if (line && filteredLineIds.has(line.id)) {
        result[line.id] = (result[line.id] || 0) + uc;
      }
    });
    return result;
  }, [cooispi.byLine, lines, filteredLineIds]);

  const totalUC = lineCapacities.reduce((sum, lc) => sum + lc.monthTotal, 0);
  const totalRealized = Object.values(realizedByLineId).reduce((a, b) => a + b, 0);
  const totalProjection = lineProjections
    ? Object.values(lineProjections).reduce((a, b) => a + b, 0)
    : isMonthClosed ? 0 : null;
  const totalForecast = totalProjection !== null ? totalRealized + totalProjection : (isMonthClosed ? totalRealized : null);
  const avgUcReal = cooispi.distinctDays > 0 ? totalRealized / cooispi.distinctDays : 0;

  // Volume BP for current month (uses selected comparison version)
  const bpMonthTechs = useMemo(() => getMonthlyByTech(comparisonVersion, currentMonthAbbr), [getMonthlyByTech, currentMonthAbbr, comparisonVersion]);
  const bpMonthTotal = useMemo(() => bpMonthTechs.reduce((s, t) => s + t.total, 0), [bpMonthTechs]);
  const hasBP = (volumeBPData.bp.length + volumeBPData.re05.length + volumeBPData.re09.length) > 0;
  const bpByTech = useMemo(() => {
    const map: Record<string, number> = {};
    bpMonthTechs.forEach(t => { map[t.tech] = t.total; });
    return map;
  }, [bpMonthTechs]);
  const realVsBpPct = hasBP && totalRealized > 0 ? Math.round(totalRealized / bpMonthTotal * 100) : null;
  const deficitVolume = hasBP ? totalUC - bpMonthTotal : null;

  const activeLinesCount = lineCapacities.filter(lc => lc.daysActive > 0).length;
  // Dias úteis = max de dias ativos entre todas as linhas de produção
  const totalDays = useMemo(() => {
    const dayCountByLine: Record<string, number> = {};
    Object.values(monthPlan.days).forEach(plan => {
      plan.activeLines.forEach(lineId => {
        dayCountByLine[lineId] = (dayCountByLine[lineId] || 0) + 1;
      });
    });
    return Math.max(0, ...Object.values(dayCountByLine));
  }, [monthPlan.days]);

  // Group by technology
  const techGroups: Record<string, { total: number; realized: number; projection: number; lines: (typeof lineCapacities[0] & { realized: number; projection: number })[] }> = {};
  lineCapacities.forEach(lc => {
    const tech = lc.line.technology;
    if (!techGroups[tech]) techGroups[tech] = { total: 0, realized: 0, projection: 0, lines: [] };
    const realized = realizedByLineId[lc.line.id] || 0;
    const projection = lineProjections?.[lc.line.id] || 0;
    techGroups[tech].total += lc.monthTotal;
    techGroups[tech].realized += realized;
    techGroups[tech].projection += projection;
    techGroups[tech].lines.push({ ...lc, realized, projection });
  });

  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const toggleTech = (tech: Technology) => {
    setSelectedTechs(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
    setSelectedLineIds([]);
  };

  const toggleLine = (id: string) => {
    setSelectedLineIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleShift = (id: number) => {
    setSelectedShifts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const clearFilters = () => {
    setSelectedTechs([]);
    setSelectedLineIds([]);
    setSelectedShifts([]);
  };

  const hasFilters = selectedTechs.length > 0 || selectedLineIds.length > 0 || selectedShifts.length > 0;

  const linesForFilter = useMemo(() => {
    if (selectedTechs.length > 0) return lines.filter(l => selectedTechs.includes(l.technology));
    return lines;
  }, [lines, selectedTechs]);

  const projStartLabel = useMemo(() => {
    if (!cooispi.lastDate) return null;
    const d = new Date(cooispi.lastDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }, [cooispi.lastDate]);

  const lastDateLabel = cooispi.lastDate
    ? new Date(cooispi.lastDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  const filterSummary = () => {
    const parts: string[] = [];
    if (selectedTechs.length > 0) parts.push(`${selectedTechs.length} tec.`);
    if (selectedLineIds.length > 0) parts.push(`${selectedLineIds.length} lin.`);
    if (selectedShifts.length > 0) parts.push(`${selectedShifts.length} tur.`);
    return parts.length > 0 ? parts.join(', ') : 'Nenhum';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <img src={tpmLogo} alt="Capacidade de Produção" className="h-8 w-auto object-contain" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground ml-11">Visão geral da capacidade produtiva — {monthName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMonthClosed}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              isMonthClosed
                ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                : "bg-muted/30 text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {isMonthClosed ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            {isMonthClosed ? 'Mês fechado' : 'Fechar mês'}
          </button>
          <MonthSelector year={selectedMonth.year} month={selectedMonth.month} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* Filters - Dropdown */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tecnologia */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:border-primary/50 transition-colors">
              Tecnologia
              {selectedTechs.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{selectedTechs.length}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 space-y-1.5" align="start">
            {allTechnologies.map(tech => (
              <label key={tech} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selectedTechs.includes(tech)} onCheckedChange={() => toggleTech(tech)} />
                {tech}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {/* Linha */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:border-primary/50 transition-colors">
              Linha
              {selectedLineIds.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{selectedLineIds.length}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 space-y-1.5 max-h-60 overflow-y-auto" align="start">
            {linesForFilter.map(l => (
              <label key={l.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selectedLineIds.includes(l.id)} onCheckedChange={() => toggleLine(l.id)} />
                {l.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {/* Turno */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:border-primary/50 transition-colors">
              Turno
              {selectedShifts.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{selectedShifts.length}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 space-y-1.5" align="start">
            {[{ id: 1, name: '1º Turno' }, { id: 2, name: '2º Turno' }, { id: 3, name: '3º Turno' }].map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selectedShifts.includes(s.id)} onCheckedChange={() => toggleShift(s.id)} />
                {s.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-primary hover:underline px-2">Limpar filtros</button>
        )}
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Factory} label="Capacidade" value={formatUC(totalUC)} unit="UC" accent />
        <KpiCard icon={CheckCircle2} label="Realizado" value={formatUC(totalRealized)} unit="UC" color="success" subtitle={lastDateLabel ? `até ${lastDateLabel}` : 'sem dados'} />
        <KpiCard icon={Target} label="Projeção" value={isMonthClosed ? '0' : (totalProjection !== null ? formatUC(totalProjection) : '—')} unit="UC" color="warning" subtitle={isMonthClosed ? 'Fechado' : (projStartLabel ? `de ${projStartLabel}` : '')} />
        <KpiCard icon={TrendingUp} label="Forecast" value={totalForecast !== null ? formatUC(totalForecast) : '—'} unit="UC" color="info" subtitle={isMonthClosed ? 'Real' : 'Real+Proj'} />
        <KpiCard icon={Zap} label="Atingimento" value={totalUC > 0 && totalForecast !== null ? `${Math.round(totalForecast / totalUC * 100)}%` : '—'} unit="vs cap." />
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={BarChart3} label="Média UC/Dia" value={cooispi.hasData ? formatUC(avgUcReal) : '—'} unit="UC" color="info" subtitle={cooispi.hasData ? `${cooispi.distinctDays} dias` : ''} />
        <KpiCard icon={Calendar} label="Dias Úteis" value={String(totalDays)} unit="dias" />
        {hasBP && (
          <>
            <KpiCard icon={Package} label={comparisonLabel} value={formatUC(bpMonthTotal)} unit="UC" subtitle={realVsBpPct !== null ? `Real: ${realVsBpPct}% do ${comparisonLabel}` : ''} />
            <KpiCard icon={Package} label={`Déficit Cap-${comparisonLabel}`} value={formatUC(deficitVolume!)} unit="UC" color={deficitVolume! >= 0 ? 'success' : undefined} subtitle={deficitVolume! >= 0 ? 'Folga' : 'Déficit'} />
            <KpiCard icon={Package} label={`Real - ${comparisonLabel}`} value={formatUC(totalRealized - bpMonthTotal)} unit="UC" color={totalRealized - bpMonthTotal >= 0 ? 'success' : undefined} subtitle={totalRealized >= bpMonthTotal ? `Superou ${comparisonLabel}` : `Abaixo do ${comparisonLabel}`} />
          </>
        )}
      </div>

      {/* By Technology */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Capacidade por Tecnologia</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['Granel', 'TeaBag', 'Termo', 'Ervas'] as const).filter(tech => techGroups[tech]).map(tech => {
            const group = techGroups[tech];
            const forecast = group.realized + group.projection;
            const ating = group.total > 0 ? Math.round(forecast / group.total * 100) : 0;
            return (
              <div key={tech} className={cn("bg-card rounded-lg border p-4", techColors[tech] || 'border-l-border', 'border-l-4')}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{tech}</h3>
                  {cooispi.hasData && (
                    <span className={cn("text-xs font-bold font-mono px-2 py-0.5 rounded", ating >= 100 ? 'bg-success/10 text-success' : ating >= 80 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive')}>
                      {ating}%
                    </span>
                  )}
                </div>

                {/* Summary grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Capacidade</p>
                    <p className="font-mono font-bold text-sm text-primary">{formatUC(group.total)}</p>
                  </div>
                  {hasBP && (
                    <div>
                      <p className="text-muted-foreground mb-0.5">{comparisonLabel}</p>
                      <p className="font-mono font-bold text-sm">{formatUC(bpByTech[tech] || 0)}</p>
                    </div>
                  )}
                  {cooispi.hasData && (
                    <>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Realizado</p>
                        <p className="font-mono font-bold text-sm text-success">{formatUC(group.realized)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Projeção</p>
                        <p className="font-mono font-bold text-sm text-warning">{formatUC(group.projection)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Forecast</p>
                        <p className="font-mono font-bold text-sm">{formatUC(forecast)}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Lines breakdown - table for alignment */}
                <div className="border-t border-border/50 pt-3">
                  <table className="w-full text-xs font-mono">
                    {cooispi.hasData && (
                      <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase tracking-wider font-sans">
                          <th className="text-left font-medium pb-1">Linha</th>
                          <th className="text-right font-medium pb-1 w-16">Real</th>
                          <th className="text-right font-medium pb-1 w-16">Proj</th>
                          <th className="text-right font-medium pb-1 w-16">Capac</th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {group.lines.map(lc => (
                        <tr key={lc.line.id}>
                          <td className="text-muted-foreground font-sans truncate max-w-[100px] py-0.5">{lc.line.name}</td>
                          {cooispi.hasData && (
                            <>
                              <td className="text-right text-success py-0.5">{formatUC(lc.realized)}</td>
                              <td className="text-right text-warning py-0.5">{formatUC(lc.projection)}</td>
                            </>
                          )}
                          <td className="text-right font-semibold py-0.5">{formatUC(lc.monthTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Line table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Detalhamento por Linha</h2>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">Linha</th>
                <th className="text-left p-3 font-medium">Tecnologia</th>
                <th className="text-right p-3 font-medium">UC/Hora</th>
                <th className="text-right p-3 font-medium">Capacidade</th>
                {cooispi.hasData && (
                  <>
                    <th className="text-right p-3 font-medium text-success">Realizado</th>
                    <th className="text-right p-3 font-medium text-warning">Projeção</th>
                    <th className="text-right p-3 font-medium">Forecast</th>
                    <th className="text-right p-3 font-medium">Ating. %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {lineCapacities.map(lc => {
                const realized = realizedByLineId[lc.line.id] || 0;
                const projection = lineProjections?.[lc.line.id] || 0;
                const forecast = realized + projection;
                const atingimento = lc.monthTotal > 0 ? Math.round(forecast / lc.monthTotal * 100) : 0;
                return (
                  <tr key={lc.line.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{lc.line.name}</td>
                    <td className="p-3 text-muted-foreground">{lc.line.technology}</td>
                    <td className="p-3 text-right font-mono">{formatUC(calcUcPerHour(lc.line) * lc.line.machines)}</td>
                    <td className="p-3 text-right font-mono">{formatUC(lc.monthTotal)}</td>
                    {cooispi.hasData && (
                      <>
                        <td className="p-3 text-right font-mono text-success">{formatUC(realized)}</td>
                        <td className="p-3 text-right font-mono text-warning">{formatUC(projection)}</td>
                        <td className="p-3 text-right font-mono font-semibold">{formatUC(forecast)}</td>
                        <td className={cn("p-3 text-right font-mono font-semibold", atingimento >= 100 ? 'text-success' : atingimento >= 80 ? 'text-warning' : 'text-destructive')}>
                          {atingimento}%
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="p-3" colSpan={3}>Total Fábrica</td>
                <td className="p-3 text-right font-mono text-primary text-lg">{formatUC(totalUC)}</td>
                {cooispi.hasData && (
                  <>
                    <td className="p-3 text-right font-mono text-success">{formatUC(totalRealized)}</td>
                    <td className="p-3 text-right font-mono text-warning">{formatUC(totalProjection || 0)}</td>
                    <td className="p-3 text-right font-mono text-lg">{formatUC(totalForecast || 0)}</td>
                    <td className={cn("p-3 text-right font-mono", totalUC > 0 && totalForecast !== null && totalForecast / totalUC >= 1 ? 'text-success' : 'text-warning')}>
                      {totalUC > 0 && totalForecast !== null ? `${Math.round(totalForecast / totalUC * 100)}%` : '—'}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, unit, accent, color, subtitle }: {
  icon: any; label: string; value: string; unit: string; accent?: boolean; color?: 'success' | 'warning' | 'info'; subtitle?: string;
}) {
  const colorClasses = {
    success: 'text-emerald-700',
    warning: 'text-orange-700',
    info: 'text-teal-700',
  };
  const gradientByColor: Record<string, string> = {
    success: 'bg-gradient-mint border-emerald-200/60',
    warning: 'bg-gradient-coral border-orange-200/60',
    info: 'bg-gradient-frost border-teal-200/60',
  };
  const bgClass = accent
    ? 'bg-gradient-teal border-teal-300/60 text-white'
    : color
      ? gradientByColor[color]
      : 'bg-gradient-cream border-border';
  const valueColor = accent ? 'text-white' : color ? colorClasses[color] : 'text-foreground';
  const iconColor = accent ? 'text-white/90' : color ? colorClasses[color] : 'text-muted-foreground';
  const labelColor = accent ? 'text-white/80' : 'text-muted-foreground';
  const unitColor = accent ? 'text-white/70' : 'text-muted-foreground';
  const subtitleColor = accent ? 'text-white/70' : 'text-muted-foreground';

  return (
    <div className={cn("rounded-xl border p-4 shadow-soft", bgClass)}>
      <div className={cn("flex items-center gap-1.5 mb-2", labelColor)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-[11px] font-medium uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className={cn("text-lg font-bold font-mono truncate", valueColor)}>{value}</span>
        <span className={cn("text-[10px] shrink-0", unitColor)}>{unit}</span>
      </div>
      {subtitle && <p className={cn("text-[11px] mt-1 truncate", subtitleColor)}>{subtitle}</p>}
    </div>
  );
}
