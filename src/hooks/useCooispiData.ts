import { useMemo } from 'react';

interface CooispiRow {
  ordem: string;
  material: string;
  textoBreve: string;
  textoBreveDescricao: string;
  dataBase: string; // DD/MM/AAAA
  qtdOrdem: number;
  qtdFornecida: number;
  lote: string;
  linhaProducao: string;
  ucProgramada: number;
  ucReal: number;
  eficiencia: number;
}

const STORAGE_KEY = 'cooispi_data';

function loadCooispiRows(): CooispiRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

/** Parse DD/MM/AAAA to Date */
function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

export interface CooispiSummary {
  /** UC Real total by line name */
  byLine: Record<string, number>;
  /** Total UC Real */
  totalUcReal: number;
  /** Last date with data (ISO yyyy-mm-dd) */
  lastDate: string | null;
  /** Whether there is any data */
  hasData: boolean;
  /** Count of distinct dates with data */
  distinctDays: number;
}

export function useCooispiData(year: number, month: number): CooispiSummary {
  return useMemo(() => {
    const allRows = loadCooispiRows();

    // Filter rows matching the selected month
    const monthRows = allRows.filter(r => {
      const d = parseDate(r.dataBase);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const byLine: Record<string, number> = {};
    let totalUcReal = 0;
    let lastDate: Date | null = null;
    const dateSet = new Set<string>();

    monthRows.forEach(r => {
      byLine[r.linhaProducao] = (byLine[r.linhaProducao] || 0) + r.ucReal;
      totalUcReal += r.ucReal;
      dateSet.add(r.dataBase);

      const d = parseDate(r.dataBase);
      if (d && (!lastDate || d > lastDate)) lastDate = d;
    });

    return {
      byLine,
      totalUcReal,
      lastDate: lastDate ? lastDate.toISOString().split('T')[0] : null,
      hasData: monthRows.length > 0,
      distinctDays: dateSet.size,
    };
  }, [year, month]);
}
