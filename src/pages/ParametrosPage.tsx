import { useProduction } from '@/contexts/ProductionContext';
import { calcUcPerHour, formatUC } from '@/data/capacityEngine';
import { shifts } from '@/data/productionData';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';

export default function ParametrosPage() {
  const { lines, updateLineAsepsia, discounts, updateDiscount } = useProduction();
  const { isEditor } = useAuth();

  const dayNames: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parâmetros</h1>
        <p className="text-sm text-muted-foreground">Configure máquinas por turno, descontos e fatores de cada linha</p>
        {!isEditor && (
          <p className="text-xs text-amber-500 flex items-center gap-1 mt-1"><Lock className="h-3 w-3" /> Modo visualização — sem permissão de edição</p>
        )}
      </div>

      {/* Lines config */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left p-3 font-medium">Linha</th>
              <th className="text-left p-3 font-medium">Tecnologia</th>
              
              <th className="text-right p-3 font-medium">Taxa/min</th>
              <th className="text-right p-3 font-medium">OEE</th>
              <th className="text-right p-3 font-medium">Sachê/Cx</th>
              <th className="text-right p-3 font-medium">Cx/Case</th>
              <th className="text-right p-3 font-medium">UC/Hora (unit)</th>
              <th className="text-right p-3 font-medium">Assepsia (h)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(line => {
              const ucUnit = calcUcPerHour(line);
              return (
                <tr key={line.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{line.name}</td>
                  <td className="p-3 text-muted-foreground">{line.technology}</td>
                  
                  <td className="p-3 text-right font-mono">{line.ratePerMinute}</td>
                  <td className="p-3 text-right font-mono">{(line.oee * 100).toFixed(0)}%</td>
                  <td className="p-3 text-right font-mono">{line.sachetsPerBox}</td>
                  <td className="p-3 text-right font-mono">{line.boxesPerCase}</td>
                  <td className="p-3 text-right font-mono font-semibold text-primary">{formatUC(ucUnit)}</td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      max={24}
                      value={line.asepsiaHours}
                      onChange={e => updateLineAsepsia(line.id, parseFloat(e.target.value) || 0)}
                      disabled={!isEditor}
                      className="w-16 bg-muted border border-border rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Discounts */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Descontos Diários (horas)</h2>
        <p className="text-xs text-muted-foreground mb-4">Edite os descontos de hora por linha, dia da semana e turno</p>
        <div className="space-y-4">
          {lines.map(line => (
            <div key={line.id} className="bg-card rounded-lg border p-4">
              <h3 className="font-medium text-sm mb-2">{line.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left p-1.5">Turno</th>
                      {[1, 2, 3, 4, 5].map(d => (
                        <th key={d} className="text-center p-1.5">{dayNames[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {line.shifts.map(shiftId => {
                      const shift = shifts.find(s => s.id === shiftId);
                      return (
                        <tr key={shiftId}>
                          <td className="p-1.5 text-muted-foreground">{shift?.name}</td>
                          {[1, 2, 3, 4, 5].map(dow => {
                            const d = discounts.find(dd => dd.lineId === line.id && dd.dayOfWeek === dow && dd.shiftId === shiftId);
                            return (
                              <td key={dow} className="p-1.5 text-center">
                                <input
                                  type="number"
                                  step={0.25}
                                  min={0}
                                  max={10}
                                  value={d?.hours || 0}
                                  onChange={e => updateDiscount(line.id, dow, shiftId, parseFloat(e.target.value) || 0)}
                                  disabled={!isEditor}
                                  className="w-14 bg-muted border border-border rounded px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
