import { ProductionLine, Shift, DailyDiscount } from './types';

export const shifts: Shift[] = [
  { id: 1, name: '1º Turno', hours: 9.5 },
  { id: 2, name: '2º Turno', hours: 9.0 },
  { id: 3, name: '3º Turno', hours: 5.5 },
];

function mps(shiftIds: number[], machines: number): Record<number, number> {
  const result: Record<number, number> = {};
  shiftIds.forEach(id => { result[id] = machines; });
  return result;
}

export const defaultLines: ProductionLine[] = [
  { id: 'granel-100', name: 'Granel 100', technology: 'Granel', machines: 1, defaultMachines: 1, machinesPerShift: { ...mps([1, 2], 1), 3: 0 }, ratePerMinute: 43, oee: 0.83, sachetsPerBox: 1, boxesPerCase: 60, ucFactor: 79.253, asepsiaHours: 9.5, shifts: [1, 2, 3] },
  { id: 'granel-250', name: 'Granel 250', technology: 'Granel', machines: 3, defaultMachines: 3, machinesPerShift: { ...mps([1, 2], 3), 3: 0 }, ratePerMinute: 45, oee: 0.83, sachetsPerBox: 1, boxesPerCase: 30, ucFactor: 97.746, asepsiaHours: 9.5, shifts: [1, 2, 3] },
  { id: 'tb-12', name: 'TB 1/2', technology: 'TeaBag', machines: 10, defaultMachines: 10, machinesPerShift: { ...mps([1, 2], 10), 3: 0 }, ratePerMinute: 125, oee: 0.915, sachetsPerBox: 25, boxesPerCase: 30, ucFactor: 31.701, asepsiaHours: 5.66, shifts: [1, 2, 3] },
  { id: 'tb-34', name: 'TB 3/4', technology: 'TeaBag', machines: 10, defaultMachines: 10, machinesPerShift: { ...mps([1, 2], 10), 3: 0 }, ratePerMinute: 125, oee: 0.915, sachetsPerBox: 25, boxesPerCase: 30, ucFactor: 31.701, asepsiaHours: 5.66, shifts: [1, 2, 3] },
  { id: 'tb-56', name: 'TB 5/6', technology: 'TeaBag', machines: 10, defaultMachines: 10, machinesPerShift: { ...mps([1, 2], 10), 3: 0 }, ratePerMinute: 120, oee: 0.915, sachetsPerBox: 25, boxesPerCase: 30, ucFactor: 31.701, asepsiaHours: 5.66, shifts: [1, 2, 3] },
  { id: 'tv', name: 'TV', technology: 'Termo', machines: 6, defaultMachines: 6, machinesPerShift: mps([1, 2, 3], 6), ratePerMinute: 105, oee: 0.935, sachetsPerBox: 15, boxesPerCase: 36, ucFactor: 22.825, asepsiaHours: 9.5, shifts: [1, 2, 3] },
  { id: 'acma', name: 'ACMA', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 250, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 6.34, asepsiaHours: 9.5, shifts: [1, 2, 3] },
  { id: 'ec-1', name: 'EC 1', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'ec-2', name: 'EC 2', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'ec-3', name: 'EC 3', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'ec-4', name: 'EC 4', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'ec-5', name: 'EC 5', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'ec-6', name: 'EC 6', technology: 'Termo', machines: 1, defaultMachines: 1, machinesPerShift: mps([1, 2, 3], 1), ratePerMinute: 205, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 12, ucFactor: 5.073, asepsiaHours: 6.66, shifts: [1, 2, 3] },
  { id: 'optima', name: 'OPTIMA', technology: 'Ervas', machines: 10, defaultMachines: 10, machinesPerShift: mps([1, 2, 3], 10), ratePerMinute: 220, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 30, ucFactor: 12.681, asepsiaHours: 9.5, shifts: [1, 2, 3] },
  { id: 'ervas-antigo', name: 'ER antigo', technology: 'Ervas', machines: 5, defaultMachines: 5, machinesPerShift: mps([1, 2, 3], 5), ratePerMinute: 120, oee: 0.80, sachetsPerBox: 10, boxesPerCase: 30, ucFactor: 12.681, asepsiaHours: 9.5, shifts: [1, 2, 3], optional: true },
];

// Default discounts
export const generateDefaultDiscounts = (): DailyDiscount[] => {
  const discounts: DailyDiscount[] = [];

  const add = (lineId: string, day: number, s1: number, s2: number, s3?: number) => {
    discounts.push({ lineId, dayOfWeek: day, shiftId: 1, hours: s1 });
    discounts.push({ lineId, dayOfWeek: day, shiftId: 2, hours: s2 });
    if (s3 !== undefined) {
      discounts.push({ lineId, dayOfWeek: day, shiftId: 3, hours: s3 });
    }
  };

  ['granel-100', 'granel-250'].forEach(id => {
    add(id, 1, 3.67, 1.75);
    add(id, 2, 1.5, 1.25);
    add(id, 3, 2.5, 1.916667);
    add(id, 4, 2.166667, 1.25);
    add(id, 5, 1.5, 1.916667);
  });

  ['tb-12', 'tb-34', 'tb-56'].forEach(id => {
    add(id, 1, 2.92, 1.75);
    add(id, 2, 1.5, 1.25);
    add(id, 3, 1.5, 1.916667);
    add(id, 4, 2.166667, 1.25);
    add(id, 5, 1.5, 1.916667);
  });

  add('tv', 1, 2.67, 1.75);
  add('tv', 2, 1.5, 1.25);
  add('tv', 3, 1.5, 1.916667);
  add('tv', 4, 2.166667, 1.25);
  add('tv', 5, 1.5, 1.916667);

  add('acma', 1, 5.75, 1.08, 0.33);
  add('acma', 2, 1.83, 0.58, 0.33);
  add('acma', 3, 2.5, 0.75, 0.33);
  add('acma', 4, 1.83, 0.75, 0.33);
  add('acma', 5, 1.83, 0.58, 0.996667);

  ['ec-1', 'ec-2', 'ec-3', 'ec-4', 'ec-5', 'ec-6'].forEach(id => {
    add(id, 1, 5.42, 0.75, 0);
    add(id, 2, 1.5, 0.25, 0);
    add(id, 3, 2.17, 0.42, 0);
    add(id, 4, 1.5, 0.42, 0);
    add(id, 5, 1.5, 0.25, 0.666667);
  });

  add('optima', 1, 5.42, 0.75, 0);
  add('optima', 2, 1.50, 0.25, 0);
  add('optima', 3, 2.17, 0.42, 0);
  add('optima', 4, 1.50, 0.42, 0);
  add('optima', 5, 1.50, 0.25, 0.67);

  add('ervas-antigo', 1, 5.42, 0.75, 0);
  add('ervas-antigo', 2, 1.50, 0.25, 0);
  add('ervas-antigo', 3, 2.17, 0.42, 0);
  add('ervas-antigo', 4, 1.50, 0.42, 0);
  add('ervas-antigo', 5, 1.50, 0.25, 0.67);

  return discounts;
};
