import { useProduction } from '@/contexts/ProductionContext';
import { getAllDaysInMonth } from '@/data/capacityEngine';
import { shifts } from '@/data/productionData';
import MonthSelector from '@/components/MonthSelector';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Droplets, Lock, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function PlanejamentoPage() {
  const { lines, monthPlan, selectedMonth, setSelectedMonth, toggleLineForDay, toggleAsepsiaForDay, updateDayMachines, saveLinePlan, saveAllLines, savingPlan } = useProduction();
  const { isEditor } = useAuth();
  const [selectedLine, setSelectedLine] = useState(lines[0]?.id || '');

  const allDays = getAllDaysInMonth(selectedMonth.year, selectedMonth.month);
  const currentLine = lines.find(l => l.id === selectedLine);

  const dayOfWeekNames: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

  const handleSaveLine = async () => {
    await saveLinePlan(selectedLine);
    toast.success(`Planejamento da linha ${currentLine?.name} salvo com sucesso!`);
  };

  const handleSaveAll = async () => {
    await saveAllLines();
    toast.success('Planejamento de todas as linhas salvo com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planejamento Mensal</h1>
          <p className="text-sm text-muted-foreground">Configure linhas ativas, assepsia e máquinas por turno em cada dia</p>
          {!isEditor && (
            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1"><Lock className="h-3 w-3" /> Modo visualização — sem permissão de edição</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditor && (
            <button
              onClick={handleSaveAll}
              disabled={savingPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar Todas
            </button>
          )}
          <MonthSelector year={selectedMonth.year} month={selectedMonth.month} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* Line selector */}
      <div className="flex flex-wrap gap-2">
        {lines.map(line => (
          <button
            key={line.id}
            onClick={() => setSelectedLine(line.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
              selectedLine === line.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-card-foreground border-border hover:border-primary/50"
            )}
          >
            {line.name}
          </button>
        ))}
      </div>

      {currentLine && (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{currentLine.name}</h2>
              <p className="text-xs text-muted-foreground">
                {currentLine.technology} • Turnos: {currentLine.shifts.map(s => `T${s}`).join(', ')}
              </p>
            </div>
            {isEditor && (
              <button
                onClick={handleSaveLine}
                disabled={savingPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar {currentLine.name}
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2.5 font-medium w-24">Dia</th>
                <th className="text-center p-2.5 font-medium w-16">Ativo</th>
                <th className="text-center p-2.5 font-medium w-16">Assepsia</th>
                {currentLine.shifts.map(shiftId => {
                  const shift = shifts.find(s => s.id === shiftId);
                  return (
                    <th key={shiftId} className="text-center p-2.5 font-medium w-20">
                      Máq {shift?.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allDays.map(date => {
                const dateStr = date.toISOString().split('T')[0];
                const dow = date.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const plan = monthPlan.days[dateStr];
                const isActive = plan?.activeLines.includes(selectedLine) || false;
                const isAsepsia = plan?.asepsiaLines.includes(selectedLine) || false;

                return (
                  <tr
                    key={dateStr}
                    className={cn(
                      "border-b border-border/30 transition-colors",
                      isWeekend && "bg-muted/20",
                      isActive && !isAsepsia && "bg-primary/5",
                      isActive && isAsepsia && "bg-accent/5",
                    )}
                  >
                    <td className={cn("p-2.5 font-mono text-sm", isWeekend && "font-bold")}>
                      {date.getDate()} {dayOfWeekNames[dow]}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => isEditor && toggleLineForDay(dateStr, selectedLine)}
                        disabled={!isEditor}
                        className={cn(
                          "w-7 h-7 rounded-md border flex items-center justify-center transition-colors",
                          !isEditor && "opacity-60 cursor-not-allowed",
                          isActive
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {isActive && <Check className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => isActive && isEditor && toggleAsepsiaForDay(dateStr, selectedLine)}
                        disabled={!isActive || !isEditor}
                        className={cn(
                          "w-7 h-7 rounded-md border flex items-center justify-center transition-colors",
                          (!isActive || !isEditor) && "opacity-30 cursor-not-allowed",
                          isActive && isAsepsia && "bg-accent border-accent text-accent-foreground",
                          isActive && !isAsepsia && "border-border hover:border-accent/50"
                        )}
                      >
                        <Droplets className="h-4 w-4" />
                      </button>
                    </td>
                    {currentLine.shifts.map(shiftId => {
                      const value = plan?.machinesOverride?.[selectedLine]?.[shiftId] ?? 0;

                      return (
                        <td key={shiftId} className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            disabled={!isActive || !isEditor}
                            value={isActive ? value : 0}
                            onChange={e => isEditor && updateDayMachines(dateStr, selectedLine, shiftId, parseInt(e.target.value) || 0)}
                            className="w-14 bg-muted border border-border rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
