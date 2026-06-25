import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, CalendarDays, Target } from 'lucide-react';

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

interface SkuLineStats {
  material: string;
  textoBreve: string;
  textoBreveDescricao: string;
  linha: string;
  totalOrdens: number;
  ucProgramada: number;
  ucReal: number;
  eficiencia: number;
  maxConsecutiveDays: number;
  avgEficiencia: number;
  score: number;
}

/** SKUs to exclude from analysis (by textoBreveDescricao partial match) */
const EXCLUDED_DESCRIPTIONS = [
  'CHA LEAO VERDE 1.6GX10UN CX10',
  'CHÁ MATTE LEÃO PÊSSEGO 1.6G X 25UN CX10',
  'CHÁ MATTE LEÃO LARANJA 1.6G X 25UN CX10',
  'CHÁ MATTE LEÃO LIMÃO 25UN CX10',
  'CHÁ MATTE LEÃO ORIGINAL 1.6G X 25UN CX10',
  'CHÁ MATTE LEÃO CANELA 25UN CX10',
  'MATTE LEÃO ORIG GRANEL 100G 12X5 CX60',
  'MATTE LEÃO ORIGINAL GRANEL 250G 6X5 CX30',
  'CHA LEAO CIDREIRA 1GX10UN CX10',
  'CHA LEAO CAMOMILA 1GX10UN CX10',
  'CHA LEAO HORTELA 1GX10UN CX10',
  'CHA LEAO ERVA-DOCE 10UN CX10',
  'CHA LEAO CIDREIRA 1GX15UN18X2CX36',
  'CHA LEAO CAMOMILA 1GX15UN18X2CX36',
  'CHA LEAO HORTELA 1GX15UN18X2 CX36',
  'CHA LEAO ERVA-DOCE 15UN18X2 CX36',
  'BIPACK PROMO CB CV+GENG+LIMÃO 6x2X10',
  'BIPACK PROMO CB ABACAXI+HORTELÃ 6X2X10',
  'BIPACK PROMO CB MORANGO + LARANJA 6X2X10',
  'BIPACK PROMO CB ICE TEA + LIMÃO 6X2X10',
  'CHÁ MATTE NATURAL GRANEL PRO 2,5KG',
];

function isExcludedSku(row: CooispiRow): boolean {
  const desc = row.textoBreveDescricao.toUpperCase().trim();
  return EXCLUDED_DESCRIPTIONS.some(ex => desc.includes(ex.toUpperCase()));
}

function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
}

function calcMaxConsecutiveDays(dates: string[]): number {
  const parsed = dates.map(parseDate).filter((d): d is Date => d !== null);
  if (parsed.length === 0) return 0;

  const uniqueDays = [...new Set(parsed.map(d => d.toISOString().slice(0, 10)))].sort();
  if (uniqueDays.length === 1) return 1;

  let max = 1, current = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 1;
    }
  }
  return max;
}

function loadCooispiData(): CooispiRow[] {
  try {
    const raw = localStorage.getItem('cooispi_data');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function MelhorSkuPage() {
  const allRows = useMemo(() => loadCooispiData(), []);

  const analysis = useMemo(() => {
    if (allRows.length === 0) return [];

    // Group by linha + material, excluding specific SKUs
    const groups: Record<string, { rows: CooispiRow[] }> = {};
    for (const row of allRows) {
      if (row.linhaProducao === 'Não identificado') continue;
      if (isExcludedSku(row)) continue;
      const key = `${row.linhaProducao}|||${row.material}`;
      if (!groups[key]) groups[key] = { rows: [] };
      groups[key].rows.push(row);
    }

    const stats: SkuLineStats[] = [];
    for (const [key, { rows }] of Object.entries(groups)) {
      const [linha, material] = key.split('|||');
      const totalUcProg = rows.reduce((s, r) => s + r.ucProgramada, 0);
      const totalUcReal = rows.reduce((s, r) => s + r.ucReal, 0);
      const eficiencia = totalUcProg > 0 ? totalUcReal / totalUcProg : 0;
      const dates = rows.map(r => r.dataBase);
      const maxConsec = calcMaxConsecutiveDays(dates);

      const eficiencias = rows
        .filter(r => r.ucProgramada > 0)
        .map(r => r.ucReal / r.ucProgramada);
      const avgEf = eficiencias.length > 0
        ? eficiencias.reduce((a, b) => a + b, 0) / eficiencias.length
        : 0;

      const score = eficiencia * 50 + (maxConsec / 30) * 30 + Math.min(rows.length / 50, 1) * 20;

      stats.push({
        material,
        textoBreve: rows[0].textoBreve,
        textoBreveDescricao: rows[0].textoBreveDescricao,
        linha,
        totalOrdens: rows.length,
        ucProgramada: totalUcProg,
        ucReal: totalUcReal,
        eficiencia,
        maxConsecutiveDays: maxConsec,
        avgEficiencia: avgEf,
        score,
      });
    }

    const bestByLine: Record<string, SkuLineStats[]> = {};
    for (const s of stats) {
      if (!bestByLine[s.linha]) bestByLine[s.linha] = [];
      bestByLine[s.linha].push(s);
    }

    const results: { linha: string; best: SkuLineStats; alternatives: SkuLineStats[] }[] = [];
    for (const [linha, skus] of Object.entries(bestByLine)) {
      const sorted = skus.sort((a, b) => b.score - a.score);
      results.push({
        linha,
        best: sorted[0],
        alternatives: sorted.slice(1, 4),
      });
    }

    return results.sort((a, b) => a.linha.localeCompare(b.linha));
  }, [allRows]);

  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatUc = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  if (allRows.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Melhor SKU por Linha</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum dado COOISPI carregado. Faça o upload na página COOISPI primeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Melhor SKU por Linha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recomendação baseada em eficiência, dias consecutivos de produção e volume de ordens
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Linhas Analisadas</p>
              <p className="text-2xl font-bold text-foreground">{analysis.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SKUs Distintos</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(allRows.filter(r => r.linhaProducao !== 'Não identificado' && !isExcludedSku(r)).map(r => r.material)).size}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eficiência Média Geral</p>
              <p className="text-2xl font-bold text-foreground">
                {formatPct(
                  analysis.length > 0
                    ? analysis.reduce((s, a) => s + a.best.eficiencia, 0) / analysis.length
                    : 0
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-line recommendation */}
      {analysis.map(({ linha, best, alternatives }) => (
        <Card key={linha}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {linha}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Best SKU highlight */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">SKU Recomendado</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{best.material}</p>
                  <p className="text-sm text-muted-foreground">{best.textoBreve}</p>
                  <p className="text-xs text-muted-foreground">{best.textoBreveDescricao}</p>
                </div>
                <Badge variant="default" className="text-sm px-3 py-1">
                  Score: {best.score.toFixed(1)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Eficiência</p>
                    <p className={`text-sm font-semibold ${best.eficiencia >= 0.9 ? 'text-green-600' : best.eficiencia >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatPct(best.eficiencia)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Máx. Dias Consecutivos</p>
                    <p className="text-sm font-semibold text-foreground">{best.maxConsecutiveDays} dias</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Ordens</p>
                  <p className="text-sm font-semibold text-foreground">{best.totalOrdens}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">UC Real Total</p>
                  <p className="text-sm font-semibold text-foreground">{formatUc(best.ucReal)}</p>
                </div>
              </div>

              {/* Justification */}
              <div className="mt-3 p-3 rounded bg-background border text-sm text-muted-foreground">
                <strong className="text-foreground">Justificativa:</strong>{' '}
                Este SKU apresenta eficiência de <strong>{formatPct(best.eficiencia)}</strong> na linha {linha},
                com o maior período de produção contínua de <strong>{best.maxConsecutiveDays} dia(s) consecutivo(s)</strong>,
                totalizando <strong>{best.totalOrdens} ordens</strong> processadas
                e <strong>{formatUc(best.ucReal)} UC</strong> produzidas.
                {best.eficiencia >= 0.9
                  ? ' A alta eficiência demonstra excelente aderência entre programação e execução.'
                  : best.eficiencia >= 0.7
                    ? ' A eficiência moderada sugere oportunidade de melhoria no setup ou processo.'
                    : ' A baixa eficiência indica necessidade de revisão do processo produtivo.'}
              </div>
            </div>

            {/* Alternatives table */}
            {alternatives.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Alternativas</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ranking</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Texto Breve</TableHead>
                      <TableHead>Descrição Material</TableHead>
                      <TableHead className="text-right">Eficiência</TableHead>
                      <TableHead className="text-right">Dias Consec.</TableHead>
                      <TableHead className="text-right">Ordens</TableHead>
                      <TableHead className="text-right">UC Real</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alternatives.map((alt, i) => (
                      <TableRow key={alt.material}>
                        <TableCell>
                          <Badge variant="outline">#{i + 2}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{alt.material}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{alt.textoBreve}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{alt.textoBreveDescricao}</TableCell>
                        <TableCell className="text-right">
                          <span className={alt.eficiencia >= 0.9 ? 'text-green-600' : alt.eficiencia >= 0.7 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPct(alt.eficiencia)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{alt.maxConsecutiveDays}</TableCell>
                        <TableCell className="text-right">{alt.totalOrdens}</TableCell>
                        <TableCell className="text-right">{formatUc(alt.ucReal)}</TableCell>
                        <TableCell className="text-right font-medium">{alt.score.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
