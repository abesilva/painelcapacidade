export type Technology = 'Granel' | 'TeaBag' | 'Termo' | 'Ervas';

export interface ProductionLine {
  id: string;
  name: string;
  technology: Technology;
  machines: number;
  defaultMachines: number;
  machinesPerShift: Record<number, number>; // shiftId -> number of machines
  ratePerMinute: number;
  oee: number;
  sachetsPerBox: number;
  boxesPerCase: number;
  ucFactor: number;
  asepsiaHours: number;
  shifts: number[];
  optional?: boolean;
}

export interface Shift {
  id: number;
  name: string;
  hours: number;
}

export interface DailyDiscount {
  lineId: string;
  dayOfWeek: number;
  shiftId: number;
  hours: number;
}

export interface DayPlan {
  date: string;
  activeLines: string[];
  asepsiaLines: string[];
  machinesOverride?: Record<string, Record<number, number>>; // lineId -> shiftId -> machines
}

export interface MonthPlan {
  year: number;
  month: number;
  days: Record<string, DayPlan>;
}

export interface LineCapacity {
  lineId: string;
  lineName: string;
  technology: Technology;
  ucPerHour: number;
  shifts: {
    shiftId: number;
    shiftName: string;
    availableHours: number;
    discount: number;
    netHours: number;
    ucCapacity: number;
  }[];
  dailyTotal: number;
  monthlyTotal: number;
  daysActive: number;
}
