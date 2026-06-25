import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MonthPlan, ProductionLine } from '@/data/types';

export function usePersistedMonthPlan(
  monthPlan: MonthPlan,
  setMonthPlan: React.Dispatch<React.SetStateAction<MonthPlan>>,
  lines: ProductionLine[],
  isEditor: boolean
) {
  const loadingRef = useRef(false);
  const lastLoadedKey = useRef('');
  const [saving, setSaving] = useState(false);

  // Load from DB when month changes
  useEffect(() => {
    const key = `${monthPlan.year}-${monthPlan.month}`;
    if (lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    loadingRef.current = true;

    const startDate = new Date(monthPlan.year, monthPlan.month, 1).toISOString().split('T')[0];
    const endDate = new Date(monthPlan.year, monthPlan.month + 1, 0).toISOString().split('T')[0];

    (async () => {
      const { data } = await supabase
        .from('month_plan_days')
        .select('plan_date, line_id, is_active, is_asepsia, machines_per_shift')
        .gte('plan_date', startDate)
        .lte('plan_date', endDate);

      if (data && data.length > 0) {
        setMonthPlan(prev => {
          const newDays = { ...prev.days };

          // Group DB rows by date
          const byDate: Record<string, typeof data> = {};
          data.forEach(row => {
            const d = row.plan_date;
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(row);
          });

          Object.keys(newDays).forEach(dateStr => {
            const rows = byDate[dateStr];
            if (!rows) return;

            const activeLines: string[] = [];
            const asepsiaLines: string[] = [];
            const machinesOverride: Record<string, Record<number, number>> = {};

            rows.forEach(row => {
              if (row.is_active) activeLines.push(row.line_id);
              if (row.is_asepsia) asepsiaLines.push(row.line_id);
              if (row.machines_per_shift && typeof row.machines_per_shift === 'object') {
                const mps: Record<number, number> = {};
                Object.entries(row.machines_per_shift as Record<string, number>).forEach(([k, v]) => {
                  mps[Number(k)] = Number(v);
                });
                machinesOverride[row.line_id] = mps;
              }
            });

            newDays[dateStr] = {
              ...newDays[dateStr],
              activeLines,
              asepsiaLines,
              machinesOverride,
            };
          });

          return { ...prev, days: newDays };
        });
      }
      loadingRef.current = false;
    })();
  }, [monthPlan.year, monthPlan.month, setMonthPlan]);

  // Save a single day+line to DB (debounced by date)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveDayPlan = useCallback((date: string, plan: MonthPlan['days'][string]) => {
    if (!isEditor) return;

    const timerKey = date;
    clearTimeout(saveTimers.current[timerKey]);
    saveTimers.current[timerKey] = setTimeout(async () => {
      const allLineIds = lines.map(l => l.id);

      const rows = allLineIds.map(lineId => ({
        plan_date: date,
        line_id: lineId,
        is_active: plan.activeLines.includes(lineId),
        is_asepsia: plan.asepsiaLines.includes(lineId),
        machines_per_shift: plan.machinesOverride?.[lineId] || {},
        updated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabase
          .from('month_plan_days')
          .upsert(rows, { onConflict: 'plan_date,line_id' });
      }
    }, 500);
  }, [isEditor, lines]);

  // Save entire month for a specific line
  const saveLinePlan = useCallback(async (lineId: string) => {
    if (!isEditor) return;
    setSaving(true);
    try {
      const rows = Object.entries(monthPlan.days).map(([dateStr, plan]) => ({
        plan_date: dateStr,
        line_id: lineId,
        is_active: plan.activeLines.includes(lineId),
        is_asepsia: plan.asepsiaLines.includes(lineId),
        machines_per_shift: plan.machinesOverride?.[lineId] || {},
        updated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabase
          .from('month_plan_days')
          .upsert(rows, { onConflict: 'plan_date,line_id' });
      }
    } finally {
      setSaving(false);
    }
  }, [isEditor, monthPlan.days]);

  // Save entire month for ALL lines
  const saveAllLines = useCallback(async () => {
    if (!isEditor) return;
    setSaving(true);
    try {
      const allLineIds = lines.map(l => l.id);
      const rows: Array<{
        plan_date: string;
        line_id: string;
        is_active: boolean;
        is_asepsia: boolean;
        machines_per_shift: Record<string, Record<number, number>> | Record<number, number>;
        updated_at: string;
      }> = [];

      Object.entries(monthPlan.days).forEach(([dateStr, plan]) => {
        allLineIds.forEach(lineId => {
          rows.push({
            plan_date: dateStr,
            line_id: lineId,
            is_active: plan.activeLines.includes(lineId),
            is_asepsia: plan.asepsiaLines.includes(lineId),
            machines_per_shift: plan.machinesOverride?.[lineId] || {},
            updated_at: new Date().toISOString(),
          });
        });
      });

      // Batch in chunks of 500 to avoid payload limits
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await supabase
          .from('month_plan_days')
          .upsert(chunk, { onConflict: 'plan_date,line_id' });
      }
    } finally {
      setSaving(false);
    }
  }, [isEditor, lines, monthPlan.days]);

  return { saveDayPlan, saveLinePlan, saveAllLines, saving };
}
