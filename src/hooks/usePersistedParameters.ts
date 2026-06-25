import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductionLine, DailyDiscount } from '@/data/types';

/**
 * Hook to load/save line parameters (asepsia) and discounts to the database.
 * On mount, loads from DB and applies to state.
 * On changes, debounces and saves to DB.
 */
export function usePersistedParameters(
  lines: ProductionLine[],
  discounts: DailyDiscount[],
  setLines: React.Dispatch<React.SetStateAction<ProductionLine[]>>,
  setDiscounts: React.Dispatch<React.SetStateAction<DailyDiscount[]>>,
  isEditor: boolean
) {
  const loadedRef = useRef(false);

  // Load from DB on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      // Load asepsia
      const { data: params } = await supabase
        .from('line_parameters')
        .select('line_id, asepsia_hours');
      
      if (params && params.length > 0) {
        setLines(prev => prev.map(line => {
          const p = params.find(r => r.line_id === line.id);
          return p ? { ...line, asepsiaHours: Number(p.asepsia_hours) } : line;
        }));
      }

      // Load discounts
      const { data: dbDiscounts } = await supabase
        .from('line_discounts')
        .select('line_id, day_of_week, shift_id, hours');
      
      if (dbDiscounts && dbDiscounts.length > 0) {
        setDiscounts(dbDiscounts.map(d => ({
          lineId: d.line_id,
          dayOfWeek: d.day_of_week,
          shiftId: d.shift_id,
          hours: Number(d.hours),
        })));
      }
    })();
  }, [setLines, setDiscounts]);

  // Save asepsia to DB (debounced)
  const saveAsepsiaTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveAsepsia = useCallback((lineId: string, hours: number) => {
    if (!isEditor) return;
    clearTimeout(saveAsepsiaTimer.current);
    saveAsepsiaTimer.current = setTimeout(async () => {
      await supabase
        .from('line_parameters')
        .upsert({ line_id: lineId, asepsia_hours: hours, updated_at: new Date().toISOString() }, { onConflict: 'line_id' });
    }, 500);
  }, [isEditor]);

  // Save discount to DB (debounced)
  const saveDiscountTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveDiscount = useCallback((lineId: string, dayOfWeek: number, shiftId: number, hours: number) => {
    if (!isEditor) return;
    clearTimeout(saveDiscountTimer.current);
    saveDiscountTimer.current = setTimeout(async () => {
      await supabase
        .from('line_discounts')
        .upsert(
          { line_id: lineId, day_of_week: dayOfWeek, shift_id: shiftId, hours, updated_at: new Date().toISOString() },
          { onConflict: 'line_id,day_of_week,shift_id' }
        );
    }, 500);
  }, [isEditor]);

  return { saveAsepsia, saveDiscount };
}
