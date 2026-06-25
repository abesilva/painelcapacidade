import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useProduction } from '@/contexts/ProductionContext';
import { calcMonthlyCapacity, calcDailyCapacity, formatUC } from '@/data/capacityEngine';
import { useVolumeBPData, TECH_ORDER } from '@/hooks/useVolumeBPData';
import { useVersion } from '@/contexts/VersionContext';
import { useCooispiData } from '@/hooks/useCooispiData';
import { useAuth } from '@/contexts/AuthContext';
import MonthSelector from '@/components/MonthSelector';
import { Technology } from '@/data/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LabelList, PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Trash2, Plus, FileText, Mail, TrendingUp, TrendingDown, Target, BarChart3, Zap } from 'lucide-react';

import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import tpmLogo from '@/assets/logo-capacidade.png';

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TECH_COLORS: Record<string, string> = {
  Granel: 'hsl(28, 100%, 50%)',
  TeaBag: 'hsl(200, 80%, 50%)',
  Termo: 'hsl(280, 60%, 55%)',
  Ervas: 'hsl(142, 71%, 45%)',
};

function mapCooispiLineName(cooispiName: string): string {
  const map: Record<string, string> = {
    'OPTIMA 1': 'OPTIMA', 'OPTIMA 2': 'OPTIMA', 'OPTIMA 3': 'OPTIMA',
    'Ervas antigo': 'ER antigo',
  };
  return map[cooispiName] || cooispiName;
}

function KPICard({ label, value, subtitle, icon: Icon, trend, color }: {
  label: string; value: string; subtitle?: string; icon: any; trend?: 'up' | 'down' | 'neutral'; color: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-5 flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: color, transform: 'translate(30%, -30%)' }} />
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
        <Icon className="h-4 w-4" style={{ color }} />
        {label}
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      {subtitle && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-success" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function RelatorioGerencialPage() {
  const { lines, monthPlan, discounts, selectedMonth, setSelectedMonth } = useProduction();
  const { getMonthlyByTech, data: volumeBPData } = useVolumeBPData();
  const { version: comparisonVersion, label: comparisonLabel } = useVersion();
  const cooispi = useCooispiData(selectedMonth.year, selectedMonth.month);
  const { user } = useAuth();

  const reportAreaRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [emails, setEmails] = useState<{ id: string; email: string }[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [sending, setSending] = useState(false);

  const hasBP = (volumeBPData.bp.length + volumeBPData.re05.length + volumeBPData.re09.length) > 0;
  const currentMonthAbbr = MONTH_ABBR[selectedMonth.month];
  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('report_emails').select('id, email').order('created_at');
      if (data) setEmails(data);
    })();
  }, []);

  const capacityByTech = useMemo(() => {
    const map: Record<string, number> = {};
    lines.forEach(line => {
      const result = calcMonthlyCapacity(line, monthPlan.days, discounts);
      map[line.technology] = (map[line.technology] || 0) + result.monthTotal;
    });
    return map;
  }, [lines, monthPlan, discounts]);

  const realizedByTech = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(cooispi.byLine).forEach(([cooispiName, uc]) => {
      const mappedName = mapCooispiLineName(cooispiName);
      const line = lines.find(l => l.name === mappedName);
      if (line) map[line.technology] = (map[line.technology] || 0) + uc;
    });
    return map;
  }, [cooispi.byLine, lines]);

  const bpByTech = useMemo(() => {
    const techs = getMonthlyByTech(comparisonVersion, currentMonthAbbr);
    const map: Record<string, number> = {};
    techs.forEach(t => { map[t.tech] = t.total; });
    return map;
  }, [getMonthlyByTech, currentMonthAbbr, comparisonVersion]);

  const totalCap = useMemo(() => Object.values(capacityByTech).reduce((a, b) => a + b, 0), [capacityByTech]);
  const totalReal = useMemo(() => Object.values(realizedByTech).reduce((a, b) => a + b, 0), [realizedByTech]);
  const totalBP = useMemo(() => Object.values(bpByTech).reduce((a, b) => a + b, 0), [bpByTech]);

  // Month closed check (same key as Dashboard)
  const isMonthClosed = useMemo(() => {
    try {
      const raw = localStorage.getItem('closed_months');
      const list: string[] = raw ? JSON.parse(raw) : [];
      return list.includes(`${selectedMonth.year}-${selectedMonth.month}`);
    } catch { return false; }
  }, [selectedMonth]);

  // Projeção: capacidade do dia seguinte à última data COOISPI até o fim do mês
  const totalProjection = useMemo(() => {
    if (isMonthClosed) return 0;
    if (!cooispi.lastDate) return null;
    const lastDate = new Date(cooispi.lastDate + 'T12:00:00');
    const projStart = new Date(lastDate);
    projStart.setDate(projStart.getDate() + 1);
    const startStr = projStart.toISOString().split('T')[0];
    let total = 0;
    lines.forEach(line => {
      Object.entries(monthPlan.days)
        .filter(([dateStr]) => dateStr >= startStr)
        .forEach(([dateStr, plan]) => {
          if (!plan.activeLines.includes(line.id)) return;
          const date = new Date(dateStr + 'T12:00:00');
          const isAsepsia = plan.asepsiaLines.includes(line.id);
          const r = calcDailyCapacity(line, date.getDay(), discounts, isAsepsia, plan);
          total += r.total;
        });
    });
    return total;
  }, [isMonthClosed, cooispi.lastDate, lines, monthPlan, discounts]);

  const totalForecast = totalProjection !== null ? totalReal + totalProjection : (isMonthClosed ? totalReal : null);
  const projStartLabel = useMemo(() => {
    if (!cooispi.lastDate || isMonthClosed) return '';
    const d = new Date(cooispi.lastDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }, [cooispi.lastDate, isMonthClosed]);

  const atingCap = totalCap > 0 ? Math.round(totalReal / totalCap * 100) : 0;
  const atingBP = totalBP > 0 ? Math.round(totalReal / totalBP * 100) : 0;
  const atingForecast = totalCap > 0 && totalForecast !== null ? Math.round(totalForecast / totalCap * 100) : 0;

  const chartData = useMemo(() => {
    return TECH_ORDER.map(tech => ({
      name: tech,
      Capacidade: Math.round(capacityByTech[tech] || 0),
      BP: Math.round(bpByTech[tech] || 0),
      Realizado: Math.round(realizedByTech[tech] || 0),
    }));
  }, [capacityByTech, bpByTech, realizedByTech]);

  const pieData = useMemo(() => {
    return TECH_ORDER.map(tech => ({
      name: tech,
      value: Math.round(realizedByTech[tech] || 0),
      color: TECH_COLORS[tech] || 'hsl(var(--muted))',
    })).filter(d => d.value > 0);
  }, [realizedByTech]);

  const tableRows = useMemo(() => {
    return TECH_ORDER.map(tech => {
      const cap = Math.round(capacityByTech[tech] || 0);
      const bp = Math.round(bpByTech[tech] || 0);
      const real = Math.round(realizedByTech[tech] || 0);
      const aCap = cap > 0 ? Math.round(real / cap * 100) : 0;
      const aBP = bp > 0 ? Math.round(real / bp * 100) : 0;
      return { tech, cap, bp, real, aCap, aBP, color: TECH_COLORS[tech] || 'hsl(var(--muted))' };
    });
  }, [capacityByTech, bpByTech, realizedByTech]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const techSummary = TECH_ORDER.map(tech => {
        const cap = capacityByTech[tech] || 0;
        const real = realizedByTech[tech] || 0;
        const bp = bpByTech[tech] || 0;
        return `- ${tech}: Capacidade=${formatUC(cap)} UC, Realizado=${formatUC(real)} UC, ${comparisonLabel}=${formatUC(bp)} UC, Atingimento Cap=${cap > 0 ? Math.round(real / cap * 100) : 0}%${bp > 0 ? `, Atingimento ${comparisonLabel}=${Math.round(real / bp * 100)}%` : ''}`;
      }).join('\n');

      const prompt = `Gere um relatório gerencial OBJETIVO e CONCISO sobre produção industrial para ${monthName}. SEM cabeçalho de assunto, SEM destinatário, SEM saudações. Vá direto ao conteúdo.

Dados consolidados:
- Capacidade Total: ${formatUC(totalCap)} UC
- Realizado Total: ${formatUC(totalReal)} UC
${hasBP ? `- ${comparisonLabel} Total: ${formatUC(totalBP)} UC` : ''}
- Atingimento da Capacidade: ${atingCap}%
${hasBP ? `- Atingimento do ${comparisonLabel}: ${atingBP}%` : ''}

Detalhamento por tecnologia:
${techSummary}

FORMATO OBRIGATÓRIO:
1. Um parágrafo curto de resumo executivo (máximo 3 linhas)
2. Máximo 3 bullets de pontos de atenção
3. Máximo 3 bullets de recomendações

NÃO repita tabelas de dados (elas já são exibidas visualmente). Foque em insights e análise. Use formatação markdown.`;

      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { prompt },
      });
      if (error) throw error;
      setReport(data?.text || data?.content || 'Erro ao gerar relatório');
    } catch (e: any) {
      toast.error('Erro ao gerar relatório: ' + (e.message || 'erro desconhecido'));
    } finally {
      setGenerating(false);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim() || !user) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) { toast.error('Email inválido'); return; }
    const { data, error } = await supabase.from('report_emails').insert({ email: newEmail.trim(), created_by: user.id }).select('id, email').single();
    if (error) { toast.error(error.message.includes('duplicate') ? 'Email já cadastrado' : error.message); return; }
    setEmails(prev => [...prev, data]);
    setNewEmail('');
    toast.success('Email cadastrado');
  };

  const removeEmail = async (id: string) => {
    await supabase.from('report_emails').delete().eq('id', id);
    setEmails(prev => prev.filter(e => e.id !== id));
    toast.success('Email removido');
  };

  const sendReport = async () => {
    if (emails.length === 0) { toast.error('Cadastre pelo menos um email'); return; }
    if (!reportAreaRef.current) { toast.error('Área do relatório não encontrada'); return; }
    setSending(true);
    try {
      toast.info('Capturando tela do relatório...');
      const canvas = await html2canvas(reportAreaRef.current, {
        backgroundColor: '#f7f3ec',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imageBase64 = canvas.toDataURL('image/png').split(',')[1];

      toast.info('Enviando email...');
      const { data, error } = await supabase.functions.invoke('send-report', {
        body: { emails: emails.map(e => e.email), screenshot: imageBase64, month: monthName },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Relatório enviado com sucesso!');
      } else {
        toast.error(data?.error || 'Erro ao enviar relatório');
      }
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + (e.message || 'erro desconhecido'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div ref={reportAreaRef} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-4">
            <img src={tpmLogo} alt="Capacidade de Produção" className="h-10 w-auto object-contain" />
            Relatório Gerencial
          </h1>
          <p className="text-sm text-muted-foreground ml-14">Análise de desempenho industrial — {monthName}</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector year={selectedMonth.year} month={selectedMonth.month} onChange={setSelectedMonth} />
          <Button onClick={generateReport} disabled={generating} size="sm">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            {generating ? 'Gerando...' : 'Gerar Análise IA'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Capacidade"
          value={formatUC(totalCap)}
          subtitle="UC disponíveis"
          icon={BarChart3}
          color="hsl(28, 100%, 50%)"
        />
        <KPICard
          label="Realizado"
          value={formatUC(totalReal)}
          subtitle={`${atingCap}% da capacidade`}
          icon={Target}
          trend={atingCap >= 80 ? 'up' : 'down'}
          color="hsl(142, 71%, 45%)"
        />
        <KPICard
          label="Projeção"
          value={isMonthClosed ? '0' : (totalProjection !== null ? formatUC(totalProjection) : '—')}
          subtitle={isMonthClosed ? 'Fechado' : (projStartLabel ? `a partir de ${projStartLabel}` : 'Aguardando COOISPI')}
          icon={Target}
          color="hsl(45, 100%, 50%)"
        />
        <KPICard
          label="Forecast"
          value={totalForecast !== null ? formatUC(totalForecast) : '—'}
          subtitle={isMonthClosed ? 'Real' : `Real + Projeção · ${atingForecast}% cap.`}
          icon={TrendingUp}
          trend={atingForecast >= 100 ? 'up' : 'down'}
          color="hsl(200, 80%, 50%)"
        />
        {hasBP && (
          <KPICard
            label={comparisonLabel}
            value={formatUC(totalBP)}
            subtitle="Planejado"
            icon={BarChart3}
            color="hsl(45, 100%, 50%)"
          />
        )}
        <KPICard
          label={hasBP ? `Ating. ${comparisonLabel}` : "Ociosidade"}
          value={hasBP ? `${atingBP}%` : `${100 - atingCap}%`}
          subtitle={hasBP ? (atingBP >= 100 ? 'Meta atingida ✓' : 'Abaixo da meta') : 'Capacidade não utilizada'}
          icon={hasBP ? Target : TrendingDown}
          trend={hasBP ? (atingBP >= 100 ? 'up' : 'down') : 'down'}
          color={hasBP ? (atingBP >= 100 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)') : 'hsl(0, 72%, 51%)'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Comparativo por Tecnologia
          </h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tickFormatter={v => formatUC(v)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatUC(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Capacidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Capacidade" position="top" formatter={(v: number) => formatUC(v)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                </Bar>
                {hasBP && <Bar dataKey="BP" name={comparisonLabel} fill="hsl(var(--warning))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="BP" position="top" formatter={(v: number) => formatUC(v)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                </Bar>}
                <Bar dataKey="Realizado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Realizado" position="top" formatter={(v: number) => formatUC(v)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-base font-semibold mb-4">Mix de Produção</h2>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} strokeWidth={0}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatUC(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {pieData.map(d => {
              const pct = totalReal > 0 ? Math.round(d.value / totalReal * 100) : 0;
              return (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground flex-1">{d.name}</span>
                  <span className="font-mono font-medium">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <h2 className="text-base font-semibold">Detalhamento por Tecnologia</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tecnologia</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Capacidade</th>
                {hasBP && <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{comparisonLabel}</th>}
                <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Realizado</th>
                <th className="text-center px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ating. Cap</th>
                {hasBP && <th className="text-center px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ating. {comparisonLabel}</th>}
                <th className="px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-40">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={row.tech} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="font-medium">{row.tech}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-primary">{formatUC(row.cap)}</td>
                  {hasBP && <td className="px-6 py-3 text-right font-mono text-warning">{formatUC(row.bp)}</td>}
                  <td className="px-6 py-3 text-right font-mono text-success">{formatUC(row.real)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.aCap >= 85 ? 'bg-success/15 text-success' : row.aCap >= 70 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                    }`}>
                      {row.aCap}%
                    </span>
                  </td>
                  {hasBP && (
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.aBP >= 100 ? 'bg-success/15 text-success' : row.aBP >= 85 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {row.aBP}%
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-3">
                    <Progress value={Math.min(row.aCap, 100)} className="h-2" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-semibold">
                <td className="px-6 py-3">Total</td>
                <td className="px-6 py-3 text-right font-mono text-primary">{formatUC(totalCap)}</td>
                {hasBP && <td className="px-6 py-3 text-right font-mono text-warning">{formatUC(totalBP)}</td>}
                <td className="px-6 py-3 text-right font-mono text-success">{formatUC(totalReal)}</td>
                <td className="px-6 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    atingCap >= 85 ? 'bg-success/15 text-success' : atingCap >= 70 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                  }`}>{atingCap}%</span>
                </td>
                {hasBP && (
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      atingBP >= 100 ? 'bg-success/15 text-success' : atingBP >= 85 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                    }`}>{atingBP}%</span>
                  </td>
                )}
                <td className="px-6 py-3">
                  <Progress value={Math.min(atingCap, 100)} className="h-2" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI Analysis */}
      {report && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 bg-primary/5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Análise Inteligente
            </h2>
          </div>
          <div className="p-6 prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/90">
            <div dangerouslySetInnerHTML={{ __html: report.replace(/\n/g, '<br/>') }} />
          </div>
        </div>
      )}

      </div>{/* end reportAreaRef */}

      {/* Email Section */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Enviar Relatório por Email
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Digite o email do destinatário..."
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              className="max-w-md"
            />
            <Button variant="outline" size="sm" onClick={addEmail}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map(e => (
                <div key={e.id} className="flex items-center gap-2 bg-muted/40 rounded-full pl-3 pr-1 py-1 text-sm group">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{e.email}</span>
                  <button onClick={() => removeEmail(e.id)} className="p-1 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={sendReport} disabled={sending || emails.length === 0} className="w-full sm:w-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? 'Enviando...' : `Enviar para ${emails.length} destinatário(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
