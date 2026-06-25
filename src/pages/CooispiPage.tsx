import { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Trash2, Download, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { getLineOverrides } from '@/data/lineOverrides';

// ── Technology detection from line name ──────────────────────
function detectTechnology(linhaProducao: string): string {
  if (['Granel 100', 'Granel 250'].includes(linhaProducao)) return 'Granel';
  if (['TB 1/2', 'TB 3/4', 'TB 5/6'].includes(linhaProducao)) return 'TeaBag';
  if (['TV', 'ACMA', 'EC 1', 'EC 2', 'EC 3', 'EC 4', 'EC 5', 'EC 6'].includes(linhaProducao)) return 'Termo';
  if (['OPTIMA 1', 'OPTIMA 2', 'OPTIMA 3', 'Ervas antigo', 'OPTIMA'].includes(linhaProducao)) return 'Ervas';
  return 'Outros';
}

// ── Base UC lookup table ──────────────────────
const BASE_UC: Record<string, number> = {
  "2110152029": 5.072, "2110152203": 5.072, "2110152204": 5.072, "2110152205": 5.072,
  "2110219016": 6.34, "2110219090": 6.34, "2110219181": 6.34, "2110219182": 6.34,
  "2110219183": 6.34, "2110219219": 6.34, "2110219264": 6.34,
  "2110220019": 8.453, "2110220187": 8.453,
  "2110232210": 25.361,
  "2110234003": 8.454, "2110234006": 8.454, "2110234044": 8.454,
  "2110235041": 8.454, "2110235042": 8.454,
  "2120040027": 4.227, "2120041027": 12.681,
  "2122040027": 4.227,
  "2126107027": 52.835, "2126127082": 21.13,
  "2127051027": 22.825,
  "2127054000": 10.567, "2127054011": 10.567, "2127054017": 10.567, "2127054027": 10.567, "2127054046": 10.567,
  "2127055000": 31.701, "2127055011": 31.701, "2127055017": 31.701, "2127055027": 31.701, "2127055046": 31.701, "2127055025": 31.701,
  "2127066027": 79.253, "2127069027": 79.253,
  "2127106027": 97.746, "2127116027": 97.746,
  "2127159027": 4.227,
  "2129040003": 4.227, "2129040006": 4.227, "2129040032": 4.227, "2129040033": 4.227, "2129040034": 4.227, "2129040036": 4.227,
  "2129041032": 12.681, "2129041033": 12.681, "2129041034": 12.681, "2129041035": 12.681, "2129041036": 12.681,
  "2129051032": 22.825, "2129051033": 22.825, "2129051034": 22.825, "2129051036": 22.825, "2129051038": 22.825,
  "2129052032": 22.825, "2129052033": 22.825, "2129052034": 22.825, "2129052036": 22.825,
  "2129055032": 31.701, "2129055033": 31.701, "2129055034": 31.701, "2129055036": 31.701,
  "2129152243": 6.34, "2129152244": 6.34, "2129152245": 6.34,
  "2129152254": 5.072, "2129152255": 5.072, "2129152256": 5.072,
  "2129152263": 5.072, "2129152264": 5.072, "2129152265": 5.072, "2129152266": 5.072,
  "2129235038": 8.454,
  "2132134027": 26.418,
  "2149152146": 4.227, "2149152147": 4.227, "2149152148": 4.227,
  "2149234146": 8.454, "2149234147": 8.454,
  "2210255230": 6.34, "2210255231": 6.34, "2210255253": 6.34, "2210255264": 6.34,
  "2129152269": 5.072, "2129152000": 5.072, "2129152011": 5.072,
  "2127276027": 32.582,
  "2110235113": 8.454,
};

function detectLinhaProducao(textoBreve: string): string | null {
  if (!textoBreve) return null;
  const t = textoBreve.toUpperCase();
  if (t.includes('AROMATIZA')) return null;
  if (t.includes('TEA BAG 1') || t.includes('TB 1')) return 'TB 1/2';
  if (t.includes('TEA BAG 3') || t.includes('TB 3')) return 'TB 3/4';
  if (t.includes('TEA BAG 5') || t.includes('TB 5')) return 'TB 5/6';
  if (t.includes('TV ')) return 'TV';
  if (t.includes('ACMA')) return 'ACMA';
  const ecMatch = t.match(/EC\s*24?\s*[-–]\s*.*?EC\s*24?\s*[-–]\s*(\d)/);
  if (ecMatch) return `EC ${ecMatch[1]}`;
  if (t.includes('OPTIMA 1')) return 'OPTIMA 1';
  if (t.includes('OPTIMA 2')) return 'OPTIMA 2';
  if (t.includes('OPTIMA 3')) return 'OPTIMA 3';
  // Qualquer coisa com "ERVAS" que não seja OPTIMA é classificada como ER antigo
  if (t.includes('ERVAS') && !t.includes('OPTIMA')) return 'Ervas antigo';
  if (t.includes('GRANEL') && t.includes('100')) return 'Granel 100';
  if (t.includes('GRANEL') && t.includes('250')) return 'Granel 250';
  if (t.includes('GRANEL') && t.includes('2,5KG')) return 'Granel 250';
  return 'Não identificado';
}

/** Convert Excel serial date or string to DD/MM/AAAA */
function parseExcelDate(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return s;
}

interface CooispiRow {
  ordem: string;
  material: string;
  textoBreve: string;
  textoBreveDescricao: string;
  dataBase: string;
  qtdOrdem: number;
  qtdFornecida: number;
  lote: string;
  linhaProducao: string;
  ucProgramada: number;
  ucReal: number;
  eficiencia: number;
}

const STORAGE_KEY = 'cooispi_data';
const STORAGE_META_KEY = 'cooispi_meta';

function loadFromStorage(): { rows: CooispiRow[]; fileName: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const meta = localStorage.getItem(STORAGE_META_KEY);
    if (raw && meta) {
      return { rows: JSON.parse(raw), fileName: JSON.parse(meta).fileName };
    }
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(rows: CooispiRow[], fileName: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify({ fileName, updatedAt: new Date().toISOString() }));
}

export default function CooispiPage() {
  const { isEditor } = useAuth();
  const stored = useMemo(() => loadFromStorage(), []);
  const [rows, setRows] = useState<CooispiRow[]>(stored?.rows ?? []);
  const [baseUcExtra, setBaseUcExtra] = useState<Record<string, number>>({});
  const [fileName, setFileName] = useState(stored?.fileName ?? '');
  const [baseUcFileName, setBaseUcFileName] = useState('base_uc.XLSX (embutida)');

  // Filters
  const [filterMes, setFilterMes] = useState<string[]>([]);
  const [filterData, setFilterData] = useState<string[]>([]);
  const [filterLinha, setFilterLinha] = useState<string[]>([]);
  const [filterTecnologia, setFilterTecnologia] = useState<string[]>([]);
  const [filterSku, setFilterSku] = useState('');

  const allBaseUc = useMemo(() => ({ ...BASE_UC, ...baseUcExtra }), [baseUcExtra]);

  // Persist rows
  useEffect(() => {
    if (rows.length > 0) saveToStorage(rows, fileName);
  }, [rows, fileName]);

  const parseNumber = (val: unknown): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const processRows = useCallback((json: Record<string, unknown>[], ucTable: Record<string, number>) => {
    const overrides = getLineOverrides();
    const parsed: CooispiRow[] = [];
    for (const row of json) {
      const textoBreve = String(row['Texto breve'] ?? '');
      const autoLinha = detectLinhaProducao(textoBreve);
      if (autoLinha === null) continue;
      const linha = overrides[textoBreve] ?? autoLinha;

      const materialStr = String(row['Nº do material'] ?? '').trim();
      const qtdOrdem = parseNumber(row['Quantidade da ordem (GMEIN)']);
      const qtdFornecida = parseNumber(row['Qtd.fornecida (GMEIN)']);
      const conversor = ucTable[materialStr] ?? 0;
      const ucProgramada = Math.round(qtdOrdem * conversor * 100) / 100;
      const ucReal = Math.round(qtdFornecida * conversor * 100) / 100;
      const eficiencia = ucProgramada > 0 ? Math.round((ucReal / ucProgramada) * 10000) / 100 : 0;

      parsed.push({
        ordem: String(row['Ordem'] ?? ''),
        material: materialStr,
        textoBreveDescricao: String(row['Texto breve material'] ?? ''),
        textoBreve,
        dataBase: parseExcelDate(row['Data-base iníc.']),
        qtdOrdem,
        qtdFornecida,
        lote: String(row['Lote'] ?? ''),
        linhaProducao: linha,
        ucProgramada,
        ucReal,
        eficiencia,
      });
    }
    return parsed;
  }, []);

  const handleCooispiUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const parsed = processRows(json, allBaseUc);
        setRows(parsed);
        toast.success(`${parsed.length} registros carregados (${file.name})`);
      } catch {
        toast.error('Erro ao processar arquivo');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [allBaseUc, processRows]);

  const handleRefresh = useCallback(() => {
    if (rows.length === 0) return;
    const refreshed = processRows(
      rows.map(r => ({
        'Ordem': r.ordem,
        'Nº do material': r.material,
        'Texto breve material': r.textoBreveDescricao,
        'Texto breve': r.textoBreve,
        'Data-base iníc.': r.dataBase,
        'Quantidade da ordem (GMEIN)': r.qtdOrdem,
        'Qtd.fornecida (GMEIN)': r.qtdFornecida,
        'Lote': r.lote,
      })),
      allBaseUc
    );
    setRows(refreshed);
    toast.success(`Base atualizada: ${refreshed.length} registros reprocessados`);
  }, [rows, allBaseUc, processRows]);

  const handleBaseUcUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBaseUcFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const extra: Record<string, number> = {};
        for (const row of json) {
          const mat = String(row['Material'] ?? '').trim();
          const conv = parseNumber(row['conversor de UC'] ?? row['conversor UC'] ?? 0);
          if (mat && conv) extra[mat] = conv;
        }
        setBaseUcExtra(extra);
        toast.success(`Base UC atualizada: ${Object.keys(extra).length} materiais`);
      } catch {
        toast.error('Erro ao processar Base UC');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, []);

  // Unique values for filters
  const uniqueLinhas = useMemo(() => [...new Set(rows.map(r => r.linhaProducao))].sort(), [rows]);
  const uniqueTecnologias = useMemo(() => [...new Set(rows.map(r => detectTechnology(r.linhaProducao)))].filter(t => t !== 'Outros').sort(), [rows]);
  const uniqueDatas = useMemo(() => [...new Set(rows.map(r => r.dataBase))].sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  }), [rows]);

  const uniqueMeses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const parts = r.dataBase.split('/');
      if (parts.length === 3) set.add(`${parts[1]}/${parts[2]}`);
    }
    return [...set].sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return new Date(ya, ma - 1).getTime() - new Date(yb, mb - 1).getTime();
    });
  }, [rows]);

  const mesLabel = (mesAno: string) => {
    const [m, y] = mesAno.split('/').map(Number);
    const d = new Date(y, m - 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (filterMes.length > 0) {
        const parts = r.dataBase.split('/');
        if (parts.length === 3 && !filterMes.includes(`${parts[1]}/${parts[2]}`)) return false;
      }
      if (filterData.length > 0 && !filterData.includes(r.dataBase)) return false;
      if (filterLinha.length > 0 && !filterLinha.includes(r.linhaProducao)) return false;
      if (filterTecnologia.length > 0 && !filterTecnologia.includes(detectTechnology(r.linhaProducao))) return false;
      if (filterSku && !r.material.includes(filterSku) && !r.textoBreveDescricao.toLowerCase().includes(filterSku.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterMes, filterData, filterLinha, filterTecnologia, filterSku]);

  // Summary by line
  const summaryByLinha = useMemo(() => {
    const map: Record<string, { ucProg: number; ucReal: number; count: number }> = {};
    const hasFilters = filterMes.length > 0 || filterData.length > 0 || filterLinha.length > 0 || filterTecnologia.length > 0 || filterSku;
    const source = hasFilters ? filteredRows : rows;
    for (const r of source) {
      if (!map[r.linhaProducao]) map[r.linhaProducao] = { ucProg: 0, ucReal: 0, count: 0 };
      map[r.linhaProducao].ucProg += r.ucProgramada;
      map[r.linhaProducao].ucReal += r.ucReal;
      map[r.linhaProducao].count++;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, filteredRows, filterMes, filterData, filterLinha, filterTecnologia, filterSku]);

  const totalSummary = useMemo(() => {
    let ucProg = 0, ucReal = 0;
    for (const [, d] of summaryByLinha) { ucProg += d.ucProg; ucReal += d.ucReal; }
    return { ucProg, ucReal, eff: ucProg > 0 ? (ucReal / ucProg) * 100 : 0 };
  }, [summaryByLinha]);

  const handleExport = useCallback(() => {
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredRows.map(r => ({
      'Ordem': r.ordem,
      'Nº do material': r.material,
      'Texto breve material': r.textoBreveDescricao,
      'Texto breve': r.textoBreve,
      'Data-base': r.dataBase,
      'Qtd. Ordem': r.qtdOrdem,
      'Qtd. Fornecida': r.qtdFornecida,
      'Lote': r.lote,
      'Linha de Produção': r.linhaProducao,
      'UC Programada': r.ucProgramada,
      'UC Real': r.ucReal,
      'Eficiência %': r.eficiencia,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'COOISPI');
    XLSX.writeFile(wb, 'cooispi_processado.xlsx');
  }, [rows, filteredRows]);

  const handleClear = useCallback(() => {
    setRows([]);
    setFileName('');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
    toast.success('Dados removidos');
  }, []);

  const formatNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const formatPct = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

  const hasActiveFilters = filterMes.length > 0 || filterData.length > 0 || filterLinha.length > 0 || filterTecnologia.length > 0 || filterSku;

  const clearFilters = () => {
    setFilterMes([]);
    setFilterData([]);
    setFilterLinha([]);
    setFilterTecnologia([]);
    setFilterSku('');
  };

  const toggleArrayFilter = <T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">COOISPI</h1>
          <p className="text-muted-foreground text-sm">
            Upload e análise de ordens de produção
            {fileName && <span className="ml-2 text-xs">· {fileName}</span>}
          </p>
        </div>
        {rows.length > 0 && isEditor && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar base
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-3 w-3 mr-1" /> Exportar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear}>
              <Trash2 className="h-3 w-3 mr-1" /> Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Upload Cards - only for editors */}
      {isEditor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {rows.length > 0 ? 'Carregar nova base COOISPI' : 'Carregar COOISPI'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground">.xlsx, .csv ou .txt</p>
                </div>
                {rows.length > 0 && <Badge variant="secondary">{rows.length} registros</Badge>}
                <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleCooispiUpload} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Base UC
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Atualizar Base UC</p>
                  <p className="text-xs text-muted-foreground">Atual: {baseUcFileName}</p>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBaseUcUpload} />
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {rows.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Mês - multi select */}
              <MultiSelectPopover
                label="Mês"
                selected={filterMes}
                options={uniqueMeses.map(m => ({ value: m, label: mesLabel(m) }))}
                onToggle={(v) => toggleArrayFilter(setFilterMes, v)}
              />

              {/* Data - multi select */}
              <MultiSelectPopover
                label="Data"
                selected={filterData}
                options={uniqueDatas.map(d => ({ value: d, label: d }))}
                onToggle={(v) => toggleArrayFilter(setFilterData, v)}
              />

              {/* Tecnologia - multi select */}
              <MultiSelectPopover
                label="Tecnologia"
                selected={filterTecnologia}
                options={uniqueTecnologias.map(t => ({ value: t, label: t }))}
                onToggle={(v) => toggleArrayFilter(setFilterTecnologia, v)}
              />

              {/* Linha - multi select */}
              <MultiSelectPopover
                label="Linha"
                selected={filterLinha}
                options={uniqueLinhas.map(l => ({ value: l, label: l }))}
                onToggle={(v) => toggleArrayFilter(setFilterLinha, v)}
              />

              <Input
                placeholder="Filtrar SKU ou descrição..."
                value={filterSku}
                onChange={e => setFilterSku(e.target.value)}
                className="w-52 h-8 text-xs"
              />

              {hasActiveFilters && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Table */}
      {summaryByLinha.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Comparativo UC Programada × Real por Linha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Linha de Produção</TableHead>
                  <TableHead className="text-xs text-right">Ordens</TableHead>
                  <TableHead className="text-xs text-right">UC Programada</TableHead>
                  <TableHead className="text-xs text-right">UC Real</TableHead>
                  <TableHead className="text-xs text-right">Eficiência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByLinha.map(([linha, data]) => {
                  const eff = data.ucProg > 0 ? (data.ucReal / data.ucProg) * 100 : 0;
                  return (
                    <TableRow key={linha}>
                      <TableCell className="text-xs font-medium">{linha}</TableCell>
                      <TableCell className="text-xs text-right">{data.count}</TableCell>
                      <TableCell className="text-xs text-right">{formatNum(data.ucProg)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNum(data.ucReal)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant={eff >= 90 ? 'default' : eff >= 70 ? 'secondary' : 'destructive'} className="text-[10px]">
                          {formatPct(eff)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="text-xs font-bold">TOTAL</TableCell>
                  <TableCell className="text-xs text-right font-bold">{summaryByLinha.reduce((s, [, d]) => s + d.count, 0)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatNum(totalSummary.ucProg)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatNum(totalSummary.ucReal)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">
                    <Badge variant={totalSummary.eff >= 90 ? 'default' : totalSummary.eff >= 70 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {formatPct(totalSummary.eff)}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Dados Processados
              {filteredRows.length !== rows.length && (
                <span className="ml-2 text-muted-foreground font-normal">({filteredRows.length} de {rows.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ordem</TableHead>
                    <TableHead className="text-xs">Material</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Texto breve</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs text-right">Qtd. Ordem</TableHead>
                    <TableHead className="text-xs text-right">Qtd. Fornecida</TableHead>
                    <TableHead className="text-xs">Linha</TableHead>
                    <TableHead className="text-xs text-right">UC Prog.</TableHead>
                    <TableHead className="text-xs text-right">UC Real</TableHead>
                    <TableHead className="text-xs text-right">Efic. %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r, i) => (
                    <TableRow key={`${r.ordem}-${i}`}>
                      <TableCell className="text-xs">{r.ordem}</TableCell>
                      <TableCell className="text-xs font-mono">{r.material}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.textoBreveDescricao}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{r.textoBreve}</TableCell>
                      <TableCell className="text-xs">{r.dataBase}</TableCell>
                      <TableCell className="text-xs text-right">{formatNum(r.qtdOrdem)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNum(r.qtdFornecida)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={r.linhaProducao === 'Não identificado' ? 'destructive' : 'outline'} className="text-[10px]">
                          {r.linhaProducao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{formatNum(r.ucProgramada)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNum(r.ucReal)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant={r.eficiencia >= 90 ? 'default' : r.eficiencia >= 70 ? 'secondary' : 'destructive'} className="text-[10px]">
                          {formatPct(r.eficiencia)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Reusable multi-select popover filter */
function MultiSelectPopover({ label, selected, options, onToggle }: {
  label: string;
  selected: string[];
  options: { value: string; label: string }[];
  onToggle: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-background text-xs font-medium hover:border-primary/50 transition-colors h-8">
          {label}
          {selected.length > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{selected.length}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-1.5 max-h-60 overflow-y-auto" align="start">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-xs py-0.5">
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={() => onToggle(opt.value)}
            />
            <span className="truncate">{opt.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
