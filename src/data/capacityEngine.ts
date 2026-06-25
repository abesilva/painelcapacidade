import { ProductionLine, Shift, DailyDiscount, DayPlan } from './types';
import { shifts } from './productionData';

/**
 * UC per hour for a single machine
 */
export function calcUcPerHour(line: ProductionLine): number {
  return (line.ratePerMinute * 60 * line.oee / line.sachetsPerBox / line.boxesPerCase) * line.ucFactor;
}

/**
 * Get machines for a specific shift, considering day-level overrides
 */
function getMachinesForShift(line: ProductionLine, shiftId: number, dayPlan?: DayPlan): number {
  return dayPlan?.machinesOverride?.[line.id]?.[shiftId] ?? 0;
}

/**
 * Calculate capacity for a line on a specific day
 */
export function calcDailyCapacity(
  line: ProductionLine,
  dayOfWeek: number,
  discounts: DailyDiscount[],
  isAsepsiaDay: boolean,
  dayPlan?: DayPlan
): { shiftDetails: { shiftId: number; name: string; grossHours: number; discount: number; netHours: number; uc: number; machines: number }[]; total: number } {
  const ucPerHourUnit = calcUcPerHour(line);
  const lineShifts = shifts.filter(s => line.shifts.includes(s.id));
  
  const shiftDetails = lineShifts.map(shift => {
    const machines = getMachinesForShift(line, shift.id, dayPlan);
    const grossHours = shift.hours;
    let discount = 0;

    if (isAsepsiaDay && shift.id === 1) {
      discount = line.asepsiaHours;
    } else {
      const d = discounts.find(
        dd => dd.lineId === line.id && dd.dayOfWeek === dayOfWeek && dd.shiftId === shift.id
      );
      discount = d ? d.hours : 0;
    }

    const netHours = Math.max(0, grossHours - discount);
    const uc = netHours * ucPerHourUnit * machines;

    return {
      shiftId: shift.id,
      name: shift.name,
      grossHours,
      discount,
      netHours,
      uc,
      machines,
    };
  });

  const total = shiftDetails.reduce((sum, s) => sum + s.uc, 0);
  return { shiftDetails, total };
}

/**
 * Calculate monthly capacity for a line
 */
export function calcMonthlyCapacity(
  line: ProductionLine,
  dayPlans: Record<string, DayPlan>,
  discounts: DailyDiscount[]
): { dailyDetails: { date: string; dayOfWeek: number; shifts: any[]; total: number; isAsepsia: boolean }[]; monthTotal: number; daysActive: number } {
  const dailyDetails: any[] = [];
  let monthTotal = 0;
  let daysActive = 0;

  Object.entries(dayPlans).sort(([a], [b]) => a.localeCompare(b)).forEach(([dateStr, plan]) => {
    if (!plan.activeLines.includes(line.id)) return;

    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay();

    const isAsepsia = plan.asepsiaLines.includes(line.id);
    const result = calcDailyCapacity(line, dayOfWeek, discounts, isAsepsia, plan);
    
    dailyDetails.push({
      date: dateStr,
      dayOfWeek,
      shifts: result.shiftDetails,
      total: result.total,
      isAsepsia,
    });
    
    monthTotal += result.total;
    daysActive++;
  });

  return { dailyDetails, monthTotal, daysActive };
}

export function getWorkingDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function getAllDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function formatUC(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}
