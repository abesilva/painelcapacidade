import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';

export type VersionKey = 'bp' | 're05' | 're09';

export interface VolumeBPRow {
  mes: string;
  codSku: string;
  descricao: string;
  tecnologia: string;
  volume: number;
}

export const VERSION_LABELS: Record<VersionKey, string> = {
  bp: 'Volume BP',
  re05: 'Revisão RE05',
  re09: 'Revisão RE09',
};

export const TECH_ORDER = ['Granel', 'TeaBag', 'Termo', 'Ervas'] as const;

const STORAGE_KEY = 'volume_bp_data';

function loadFromStorage(): Record<VersionKey, VolumeBPRow[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { bp: [], re05: [], re09: [] };
}

function saveToStorage(data: Record<VersionKey, VolumeBPRow[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function parseWorkbook(wb: XLSX.WorkBook): VolumeBPRow[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return json.map(row => {
    const keys = Object.keys(row);
    return {
      mes: String(row[keys[0]] ?? ''),
      codSku: String(row[keys[1]] ?? ''),
      descricao: String(row[keys[2]] ?? ''),
      tecnologia: String(row[keys[3]] ?? ''),
      volume: Number(row[keys[4]] ?? 0),
    };
  });
}

export function useVolumeBPData() {
  const [data, setData] = useState<Record<VersionKey, VolumeBPRow[]>>(loadFromStorage);

  const updateData = useCallback((version: VersionKey, rows: VolumeBPRow[]) => {
    setData(prev => {
      const next = { ...prev, [version]: rows };
      saveToStorage(next);
      return next;
    });
  }, []);

  const handleUpload = useCallback((version: VersionKey, onDone?: () => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rows = parseWorkbook(wb);
      updateData(version, rows);
      onDone?.();
    };
    input.click();
  }, [updateData]);

  const getTechSummary = useCallback((version: VersionKey) => {
    const rows = data[version];
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.tecnologia] = (map[r.tecnologia] || 0) + r.volume; });
    return TECH_ORDER.map(t => ({ tech: t, total: map[t] || 0 }));
  }, [data]);

  const getMonthlyByTech = useCallback((version: VersionKey, month: string) => {
    const rows = data[version].filter(r => r.mes === month);
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.tecnologia] = (map[r.tecnologia] || 0) + r.volume; });
    return TECH_ORDER.map(t => ({ tech: t, total: map[t] || 0 }));
  }, [data]);

  return { data, handleUpload, getTechSummary, getMonthlyByTech };
}
