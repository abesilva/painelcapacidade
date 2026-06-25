import { useProduction } from '@/contexts/ProductionContext';
import { calcMonthlyCapacity, calcUcPerHour, formatUC } from '@/data/capacityEngine';
import { shifts } from '@/data/productionData';
import MonthSelector from '@/components/MonthSelector';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function CapacidadePage() {
  const { lines, monthPlan, discounts, selectedMonth, setSelectedMonth } = useProduction();
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id || '');

  const line = lines.find(l => l.id === selectedLineId);
  if (!line) return null;

  const result = calcMonthlyCapacity(line, monthPlan.days, discounts);
  const ucPerHourTotal = calcUcPerHour(line) * line.machines;

  const dayNames: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Capacidade por Linha</h1>
          <p className="text-sm text-muted-foreground">Detalhamento de capacidade por turno e dia</p>
        </div>
        <MonthSelector year={selectedMonth.year} month={selectedMonth.month} onChange={setSelectedMonth} />
      </div>

      {/* Line selector */}
      <div className="flex flex-wrap gap-2">
        {lines.map(l => (
          <button
            key={l.id}
            onClick={() => setSelectedLineId(l.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
              selectedLineId === l.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-card-foreground border-border hover:border-primary/50"
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="UC/Hora (linha)" value={formatUC(ucPerHourTotal)} />
        <SummaryCard label="Dias Ativos" value={String(result.daysActive)} />
        <SummaryCard label="Total Mensal" value={formatUC(result.monthTotal)} accent />
        <SummaryCard label="Assepsia" value={`${line.asepsiaHours}h`} />
      </div>

      {/* Daily breakdown table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left p-3 font-medium">Data</th>
              <th className="text-left p-3 font-medium">Dia</th>
              <th className="text-center p-3 font-medium">Assepsia</th>
              {line.shifts.map(sId => {
                const s = shifts.find(sh => sh.id === sId);
                return <th key={sId} className="text-right p-3 font-medium">{s?.name || `T${sId}`} (UC)</th>;
              })}
              <th className="text-right p-3 font-medium">Total UC</th>
            </tr>
          </thead>
          <tbody>
            {result.dailyDetails.map(day => (
              <tr key={day.date} className={cn(
                "border-b border-border/50 hover:bg-muted/30 transition-colors",
                day.isAsepsia && "bg-accent/5"
              )}>
                <td className="p-3 font-mono text-xs">{new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                <td className="p-3 text-muted-foreground">{dayNames[day.dayOfWeek] || day.dayOfWeek}</td>
                <td className="p-3 text-center">{day.isAsepsia ? <span className="text-accent text-xs font-medium">Sim</span> : '—'}</td>
                {day.shifts.map((s: any) => (
                  <td key={s.shiftId} className="p-3 text-right font-mono">
                    <span className="text-foreground">{formatUC(s.uc)}</span>
                    {s.discount > 0 && <span className="text-destructive text-xs ml-1">(-{s.discount.toFixed(1)}h)</span>}
                  </td>
                ))}
                <td className="p-3 text-right font-mono font-semibold text-primary">{formatUC(day.total)}</td>
              </tr>
            ))}
            {result.dailyDetails.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum dia ativo para esta linha</td></tr>
            )}
            {result.dailyDetails.length > 0 && (
              <tr className="bg-muted/50 font-bold">
                <td className="p-3" colSpan={3}>Total</td>
                {line.shifts.map(sId => {
                  const shiftTotal = result.dailyDetails.reduce((sum: number, d: any) => {
                    const s = d.shifts.find((sh: any) => sh.shiftId === sId);
                    return sum + (s?.uc || 0);
                  }, 0);
                  return <td key={sId} className="p-3 text-right font-mono">{formatUC(shiftTotal)}</td>;
                })}
                <td className="p-3 text-right font-mono text-primary text-lg">{formatUC(result.monthTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("bg-card rounded-lg border p-4", accent && "border-primary/50")}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold font-mono", accent && "text-primary")}>{value}</p>
    </div>
  );
}
