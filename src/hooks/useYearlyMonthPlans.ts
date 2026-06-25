import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DayPlan, ProductionLine } from '@/data/types';

/**
 * Loads saved month plans for ALL 12 months of a year from the DB.
 * Returns Record<monthIndex, Record<dateStr, DayPlan>>.
 * Months without any saved row fall back to default (all non-optional lines active on weekdays).
 */
export function useYearlyMonthPlans(year: number, lines: ProductionLine[]) {
  const [plansByMonth, setPlansByMonth] = useState<Record<number, Record<string, DayPlan>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Supabase caps responses at 1000 rows by default. A full year
      // (~12 × 31 × 15 lines ≈ 5,580 rows) gets truncated, which silently
      // dropped most days and made capacity look ~half the real value.
      // Paginate explicitly until we've drained every row.
      const PAGE_SIZE = 1000;
      type Row = {
        plan_date: string;
        line_id: string;
        is_active: boolean;
        is_asepsia: boolean;
        machines_per_shift: any;
      };
      const allRows: Row[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('month_plan_days')
          .select('plan_date, line_id, is_active, is_asepsia, machines_per_shift')
          .gte('plan_date', startDate)
          .lte('plan_date', endDate)
          .order('plan_date', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allRows.push(...(data as Row[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (cancelled) return;

      // Group rows by date
      const rowsByDate: Record<string, Row[]> = {};
      allRows.forEach(row => {
        if (!rowsByDate[row.plan_date]) rowsByDate[row.plan_date] = [];
        rowsByDate[row.plan_date]!.push(row);
      });

      const result: Record<number, Record<string, DayPlan>> = {};

      for (let month = 0; month < 12; month++) {
        const days: Record<string, DayPlan> = {};

        const date = new Date(year, month, 1);
        while (date.getMonth() === month) {
          const dateStr = date.toISOString().split('T')[0];
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const rows = rowsByDate[dateStr];

          if (rows && rows.length > 0) {
            // Use saved data for this specific date
            const activeLines: string[] = [];
            const asepsiaLines: string[] = [];
            const machinesOverride: Record<string, Record<number, number>> = {};
            rows.forEach(r => {
              if (r.is_active) activeLines.push(r.line_id);
              if (r.is_asepsia) asepsiaLines.push(r.line_id);
              if (r.machines_per_shift && typeof r.machines_per_shift === 'object') {
                const mps: Record<number, number> = {};
                Object.entries(r.machines_per_shift as Record<string, number>).forEach(([k, v]) => {
                  mps[Number(k)] = Number(v);
                });
                machinesOverride[r.line_id] = mps;
              }
            });
            days[dateStr] = { date: dateStr, activeLines, asepsiaLines, machinesOverride };
          } else {
            // No saved row for this date → default plan (matches ProductionContext behavior)
            const activeLines = isWeekend ? [] : lines.filter(l => !l.optional).map(l => l.id);
            const machinesOverride: Record<string, Record<number, number>> = {};
            activeLines.forEach(lineId => {
              const line = lines.find(l => l.id === lineId);
              if (line) machinesOverride[lineId] = { ...line.machinesPerShift };
            });
            days[dateStr] = { date: dateStr, activeLines, asepsiaLines: [], machinesOverride };
          }

          date.setDate(date.getDate() + 1);
        }

        // First working day asepsia by default if not explicitly saved
        const firstWorking = Object.keys(days).sort().find(d => {
          const dd = new Date(d + 'T12:00:00');
          return dd.getDay() !== 0 && dd.getDay() !== 6;
        });
        if (firstWorking && !rowsByDate[firstWorking]) {
          days[firstWorking].asepsiaLines = days[firstWorking].activeLines.slice();
        }

        result[month] = days;
      }

      setPlansByMonth(result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [year, lines]);

  return { plansByMonth, loading };
}
