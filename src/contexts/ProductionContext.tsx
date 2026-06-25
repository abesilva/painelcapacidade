import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ProductionLine, DailyDiscount, DayPlan, MonthPlan } from '@/data/types';
import { defaultLines, generateDefaultDiscounts, shifts } from '@/data/productionData';
import { usePersistedParameters } from '@/hooks/usePersistedParameters';
import { usePersistedMonthPlan } from '@/hooks/usePersistedMonthPlan';
import { useAuth } from '@/contexts/AuthContext';

interface ProductionContextType {
  lines: ProductionLine[];
  updateLineMachines: (lineId: string, machines: number) => void;
  updateLineAsepsia: (lineId: string, hours: number) => void;
  updateLineMachinesPerShift: (lineId: string, shiftId: number, machines: number) => void;
  discounts: DailyDiscount[];
  updateDiscount: (lineId: string, dayOfWeek: number, shiftId: number, hours: number) => void;
  monthPlan: MonthPlan;
  selectedMonth: { year: number; month: number };
  setSelectedMonth: (year: number, month: number) => void;
  toggleLineForDay: (date: string, lineId: string) => void;
  toggleAsepsiaForDay: (date: string, lineId: string) => void;
  updateDayMachines: (date: string, lineId: string, shiftId: number, machines: number) => void;
  resetMonth: () => void;
  saveLinePlan: (lineId: string) => Promise<void>;
  saveAllLines: () => Promise<void>;
  savingPlan: boolean;
}

const ProductionContext = createContext<ProductionContextType | null>(null);

function initializeMonthPlan(year: number, month: number, lines: ProductionLine[]): MonthPlan {
  const allDays: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    allDays.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  
  const days: Record<string, DayPlan> = {};
  
  allDays.forEach(d => {
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const activeLines = isWeekend ? [] : lines.filter(l => !l.optional).map(l => l.id);
    
    const machinesOverride: Record<string, Record<number, number>> = {};
    activeLines.forEach(lineId => {
      const line = lines.find(l => l.id === lineId);
      if (line) {
        machinesOverride[lineId] = { ...line.machinesPerShift };
      }
    });
    
    days[dateStr] = { date: dateStr, activeLines, asepsiaLines: [], machinesOverride };
  });

  const firstWorkingDay = allDays.find(d => d.getDay() !== 0 && d.getDay() !== 6);
  if (firstWorkingDay) {
    const dateStr = firstWorkingDay.toISOString().split('T')[0];
    if (days[dateStr]) {
      days[dateStr].asepsiaLines = lines.filter(l => !l.optional).map(l => l.id);
    }
  }

  return { year, month, days };
}

export function ProductionProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<ProductionLine[]>(() => [...defaultLines]);
  const [discounts, setDiscounts] = useState<DailyDiscount[]>(() => generateDefaultDiscounts());
  const { isEditor } = useAuth();
  
  const now = new Date();
  const [selectedMonth, setSelectedMonthState] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [monthPlan, setMonthPlan] = useState<MonthPlan>(() => 
    initializeMonthPlan(selectedMonth.year, selectedMonth.month, defaultLines)
  );

  // Persist parameters to DB
  const { saveAsepsia, saveDiscount } = usePersistedParameters(lines, discounts, setLines, setDiscounts, isEditor);
  
  // Persist month plan to DB
  const { saveDayPlan, saveLinePlan, saveAllLines, saving: savingPlan } = usePersistedMonthPlan(monthPlan, setMonthPlan, lines, isEditor);

  const updateLineMachines = useCallback((lineId: string, machines: number) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, machines: Math.max(0, machines) } : l));
  }, []);

  const updateLineAsepsia = useCallback((lineId: string, hours: number) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, asepsiaHours: Math.max(0, hours) } : l));
    saveAsepsia(lineId, hours);
  }, [saveAsepsia]);

  const updateLineMachinesPerShift = useCallback((lineId: string, shiftId: number, machines: number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const newMps = { ...l.machinesPerShift, [shiftId]: Math.max(0, machines) };
      const maxMachines = Math.max(...Object.values(newMps));
      return { ...l, machinesPerShift: newMps, machines: maxMachines };
    }));
  }, []);

  const updateDiscount = useCallback((lineId: string, dayOfWeek: number, shiftId: number, hours: number) => {
    setDiscounts(prev => {
      const idx = prev.findIndex(d => d.lineId === lineId && d.dayOfWeek === dayOfWeek && d.shiftId === shiftId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], hours: Math.max(0, hours) };
        return next;
      }
      return [...prev, { lineId, dayOfWeek, shiftId, hours: Math.max(0, hours) }];
    });
    saveDiscount(lineId, dayOfWeek, shiftId, hours);
  }, [saveDiscount]);

  const setSelectedMonth = useCallback((year: number, month: number) => {
    setSelectedMonthState({ year, month });
    setMonthPlan(initializeMonthPlan(year, month, lines));
  }, [lines]);

  const toggleLineForDay = useCallback((date: string, lineId: string) => {
    setMonthPlan(prev => {
      const day = prev.days[date];
      if (!day) return prev;
      const isActive = day.activeLines.includes(lineId);
      const active = isActive
        ? day.activeLines.filter(id => id !== lineId)
        : [...day.activeLines, lineId];
      
      let machinesOverride = { ...(day.machinesOverride || {}) };
      if (!isActive) {
        const line = lines.find(l => l.id === lineId);
        if (line) {
          machinesOverride[lineId] = { ...line.machinesPerShift };
        }
      } else {
        delete machinesOverride[lineId];
      }
      
      const updatedDay = { ...day, activeLines: active, asepsiaLines: day.asepsiaLines.filter(id => active.includes(id)), machinesOverride };
      saveDayPlan(date, updatedDay);
      return { ...prev, days: { ...prev.days, [date]: updatedDay } };
    });
  }, [lines, saveDayPlan]);

  const toggleAsepsiaForDay = useCallback((date: string, lineId: string) => {
    setMonthPlan(prev => {
      const newDays = { ...prev.days };
      Object.keys(newDays).forEach(d => {
        if (d !== date && newDays[d].asepsiaLines.includes(lineId)) {
          const updatedDay = { ...newDays[d], asepsiaLines: newDays[d].asepsiaLines.filter(id => id !== lineId) };
          newDays[d] = updatedDay;
          saveDayPlan(d, updatedDay);
        }
      });
      
      const day = newDays[date];
      if (!day || !day.activeLines.includes(lineId)) return prev;
      
      const hasAsepsia = day.asepsiaLines.includes(lineId);
      const updatedDay = {
        ...day,
        asepsiaLines: hasAsepsia
          ? day.asepsiaLines.filter(id => id !== lineId)
          : [...day.asepsiaLines, lineId],
      };
      newDays[date] = updatedDay;
      saveDayPlan(date, updatedDay);
      return { ...prev, days: newDays };
    });
  }, [saveDayPlan]);

  const updateDayMachines = useCallback((date: string, lineId: string, shiftId: number, machines: number) => {
    setMonthPlan(prev => {
      const day = prev.days[date];
      if (!day) return prev;
      const existing = day.machinesOverride || {};
      const lineOverrides = existing[lineId] || {};
      const newOverrides = {
        ...existing,
        [lineId]: { ...lineOverrides, [shiftId]: Math.max(0, machines) },
      };
      const updatedDay = { ...day, machinesOverride: newOverrides };
      saveDayPlan(date, updatedDay);
      return { ...prev, days: { ...prev.days, [date]: updatedDay } };
    });
  }, [saveDayPlan]);

  const resetMonth = useCallback(() => {
    setMonthPlan(initializeMonthPlan(selectedMonth.year, selectedMonth.month, lines));
  }, [selectedMonth, lines]);

  const value = useMemo(() => ({
    lines,
    updateLineMachines,
    updateLineAsepsia,
    updateLineMachinesPerShift,
    discounts,
    updateDiscount,
    monthPlan,
    selectedMonth,
    setSelectedMonth,
    toggleLineForDay,
    toggleAsepsiaForDay,
    updateDayMachines,
    resetMonth,
    saveLinePlan,
    saveAllLines,
    savingPlan,
  }), [lines, updateLineMachines, updateLineAsepsia, updateLineMachinesPerShift, discounts, updateDiscount, monthPlan, selectedMonth, setSelectedMonth, toggleLineForDay, toggleAsepsiaForDay, updateDayMachines, resetMonth, saveLinePlan, saveAllLines, savingPlan]);

  return (
    <ProductionContext.Provider value={value}>
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used within ProductionProvider');
  return ctx;
}
