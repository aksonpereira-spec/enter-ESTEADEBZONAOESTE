import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aluno, Turma, Mensalidade } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, CheckCircle2, Clock, TrendingUp,
  Filter, RefreshCw, History, ArrowLeft, BookOpen, AlertCircle, Banknote, Smartphone,
  MessageCircle, AlertTriangle, ChevronDown, ChevronUp, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────
const CLASSROOM_LINK = 'https://classroom.google.com/c/Nzk3MDE0NzA3Mjkx?hl=pt-BR&cjc=c3h37ebz';
const PIX_KEY_DISPLAY = '40.800.393/0001-32';
const COORDINATOR_PHONE_DISPLAY = '(84) 99848-1937';

function buildClassroomWhatsApp(rawPhone: string, nome: string): string {
  const phone = '55' + rawPhone.replace(/\D/g, '');
  const firstName = nome.split(' ')[0];
  const lines = [
    '🎉 Parabéns, *' + firstName + '*!',
    '',
    '✅ Seu pagamento foi confirmado na *ESTEADEB Núcleo Zona Oeste*.',
    'Seja bem-vindo(a) a mais um mês de crescimento na Palavra de Deus!',
    '',
    '📚 Acesse sua sala de aula pelo link abaixo:',
    CLASSROOM_LINK,
    '',
    '🙏 Que Deus abençoe seus estudos teológicos!',
  ];
  return 'https://wa.me/' + phone + '?text=' + lines.map(l => encodeURIComponent(l)).join('%0A');
}

function buildCobrancaWhatsApp(rawPhone: string, nome: string): string {
  const phone = '55' + rawPhone.replace(/\D/g, '');
  const firstName = nome.split(' ')[0];
  const lines = [
    '👋 Olá, *' + firstName + '*! Tudo bem?',
    '',
    '⚠️ Identificamos uma pendência na sua mensalidade da *ESTEADEB Núcleo Zona Oeste*.',
    '',
    '💳 Para regularizar, utilize o *PIX*:',
    'Chave CNPJ: *' + PIX_KEY_DISPLAY + '*',
    '',
    '📞 Dúvidas? Fale com o coordenador: *' + COORDINATOR_PHONE_DISPLAY + '*',
    '',
    '✅ Após pagar, envie o comprovante. Deus abençoe! 🙏',
  ];
  return 'https://wa.me/' + phone + '?text=' + lines.map(l => encodeURIComponent(l)).join('%0A');
}

// Opens WA link from top-level window to avoid iframe ERR_BLOCKED_BY_RESPONSE
function openWhatsApp(url: string) {
  try {
    (window.top || window).open(url, '_blank', 'noopener,noreferrer');
  } catch (_e) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTHS_LABELS = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-');
  return `${MONTHS_LABELS[parseInt(m) - 1]} ${y}`;
};

const getMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  const now = new Date();
  for (let i = -6; i < 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }
  for (let m = 1; m <= 12; m++) {
    const val = `2026-${String(m).padStart(2, '0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }
  opts.sort((a, b) => a.value.localeCompare(b.value));
  return opts;
};

// ─── Row ─────────────────────────────────────────────────────────────────────
interface RowProps {
  aluno: Aluno;
  mensalidade: Mensalidade | undefined;
  selectedMonth: string;
  onSaved: () => void;
  onOpenHistory: (aluno: Aluno) => void;
  onSituacaoPago: (aluno: Aluno) => void;
}

const MensalidadeRow = ({ aluno, mensalidade, selectedMonth, onSaved, onOpenHistory, onSituacaoPago }: RowProps) => {
  const [dinheiro, setDinheiro] = useState(mensalidade?.dinheiro ? String(mensalidade.dinheiro) : '');
  const [pix, setPix] = useState(mensalidade?.pixDeposito ? String(mensalidade.pixDeposito) : '');
  const [cartAss, setCartAss] = useState(mensalidade?.cartaoAssinatura ? String(mensalidade.cartaoAssinatura) : '');
  const [cartDeb, setCartDeb] = useState(mensalidade?.cartaoDebito ? String(mensalidade.cartaoDebito) : '');
  const [obs, setObs] = useState(mensalidade?.obs || '');
  const [apostilas, setApostilas] = useState<'Sim' | 'Não'>(mensalidade?.apostilas || 'Não');
  const [qtd, setQtd] = useState(mensalidade?.qtdApostilas ? String(mensalidade.qtdApostilas) : '');
  const [situacao, setSituacao] = useState<'Pago' | 'Pendente'>(mensalidade?.situacao || 'Pendente');
  const [expanded, setExpanded] = useState(false);
  const prevIdRef = useRef(mensalidade?.id);

  useEffect(() => {
    if (prevIdRef.current !== mensalidade?.id) {
      prevIdRef.current = mensalidade?.id;
      setDinheiro(mensalidade?.dinheiro ? String(mensalidade.dinheiro) : '');
      setPix(mensalidade?.pixDeposito ? String(mensalidade.pixDeposito) : '');
      setCartAss(mensalidade?.cartaoAssinatura ? String(mensalidade.cartaoAssinatura) : '');
      setCartDeb(mensalidade?.cartaoDebito ? String(mensalidade.cartaoDebito) : '');
      setObs(mensalidade?.obs || '');
      setApostilas(mensalidade?.apostilas || 'Não');
      setQtd(mensalidade?.qtdApostilas ? String(mensalidade.qtdApostilas) : '');
      setSituacao(mensalidade?.situacao || 'Pendente');
    }
  }, [mensalidade]);

  const calcTotal = (d = dinheiro, p = pix, ca = cartAss, cd = cartDeb) =>
    (parseFloat(d) || 0) + (parseFloat(p) || 0) + (parseFloat(ca) || 0) + (parseFloat(cd) || 0);

  const upsert = async (fields: Record<string, string | number>) => {
    const d = parseFloat(dinheiro) || 0;
    const p = parseFloat(pix) || 0;
    const ca = parseFloat(cartAss) || 0;
    const cd = parseFloat(cartDeb) || 0;
    const total = (fields.dinheiro !== undefined ? (fields.dinheiro as number) : d)
                + (fields.pix_deposito !== undefined ? (fields.pix_deposito as number) : p)
                + (fields.cartao_assinatura !== undefined ? (fields.cartao_assinatura as number) : ca)
                + (fields.cartao_debito !== undefined ? (fields.cartao_debito as number) : cd);
    const newSituacao = total > 0 ? 'Pago' : 'Pendente';
    setSituacao(newSituacao);

    const payload = {
      dinheiro: d, pix_deposito: p, cartao_assinatura: ca, cartao_debito: cd,
      valor: total, situacao: newSituacao,
      obs: fields.obs !== undefined ? fields.obs : obs,
      apostilas: fields.apostilas !== undefined ? fields.apostilas : apostilas,
      qtd_apostilas: fields.qtd_apostilas !== undefined ? fields.qtd_apostilas : (parseInt(qtd) || 0),
      ...fields,
    };

    if (mensalidade?.id) {
      const { error } = await supabase.from('mensalidades').update(payload).eq('id', mensalidade.id);
      if (error) toast.error('Erro ao salvar: ' + error.message);
    } else {
      const { error } = await supabase.from('mensalidades').insert({
        aluno_id: aluno.id, turma_id: aluno.turmaId, mes: selectedMonth, ...payload,
      });
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      onSaved();
    }
  };

  const handleNumBlur = (field: string, val: string) =>
    upsert({ [field]: parseFloat(val) || 0 });

  const handleApostilas = (val: 'Sim' | 'Não') => {
    setApostilas(val);
    upsert({ apostilas: val, qtd_apostilas: val === 'Não' ? 0 : (parseInt(qtd) || 0) });
  };

  const handleSituacaoOverride = (val: 'Pago' | 'Pendente') => {
    const wasNotPago = situacao !== 'Pago';
    setSituacao(val);
    if (mensalidade?.id) {
      supabase.from('mensalidades').update({ situacao: val }).eq('id', mensalidade.id);
    }
    if (val === 'Pago' && wasNotPago) {
      onSituacaoPago(aluno);
    }
  };

  const total = calcTotal();
  const isPago = situacao === 'Pago';
  const hasObs = obs.trim().length > 0;
  const hasApostilas = apostilas === 'Sim';

  return (
    <Fragment>
      <tr className="table-row">
        <td className="table-td">
          <button onClick={() => onOpenHistory(aluno)} className="flex items-center gap-2 group text-left w-full">
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all group-hover:ring-2 group-hover:ring-primary/30 ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
              {aluno.nome.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[140px]">{aluno.nome}</p>
              {aluno.matricula && <p className="text-xs text-muted-foreground">{aluno.matricula}</p>}
            </div>
            <History className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </td>
        <td className="table-td hidden sm:table-cell">
          <Input type="number" min="0" step="0.01" placeholder="0,00"
            className="h-8 text-right text-xs form-input w-24"
            value={dinheiro}
            onChange={e => setDinheiro(e.target.value)}
            onBlur={e => handleNumBlur('dinheiro', e.target.value)} />
        </td>
        <td className="table-td hidden sm:table-cell">
          <Input type="number" min="0" step="0.01" placeholder="0,00"
            className="h-8 text-right text-xs form-input w-24"
            value={pix}
            onChange={e => setPix(e.target.value)}
            onBlur={e => handleNumBlur('pix_deposito', e.target.value)} />
        </td>
        <td className="table-td hidden md:table-cell">
          <Input type="number" min="0" step="0.01" placeholder="0,00"
            className="h-8 text-right text-xs form-input w-24"
            value={cartAss}
            onChange={e => setCartAss(e.target.value)}
            onBlur={e => handleNumBlur('cartao_assinatura', e.target.value)} />
        </td>
        <td className="table-td hidden md:table-cell">
          <Input type="number" min="0" step="0.01" placeholder="0,00"
            className="h-8 text-right text-xs form-input w-24"
            value={cartDeb}
            onChange={e => setCartDeb(e.target.value)}
            onBlur={e => handleNumBlur('cartao_debito', e.target.value)} />
        </td>
        <td className="table-td text-right">
          <span className={`font-bold text-sm ${total > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {total > 0 ? `R$\u00a0${total.toFixed(2).replace('.', ',')}` : '\u2014'}
          </span>
        </td>
        <td className="table-td text-center">
          <Select value={situacao} onValueChange={handleSituacaoOverride}>
            <SelectTrigger className={`h-7 text-xs font-semibold border-0 rounded-full px-3 w-[100px] mx-auto ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="table-td w-10 text-center">
          <button
            onClick={() => setExpanded(e => !e)}
            title="Ver/editar pagamentos e observações"
            className={`p-2 rounded-full transition-all touch-manipulation ${expanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'} ${(hasObs || hasApostilas) ? 'ring-1 ring-amber-300' : ''}`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20 border-t border-dashed border-border/50">
          <td colSpan={8} className="px-4 py-3">
            {/* Campos de pagamento — visíveis apenas em mobile/tablet onde as colunas ficam ocultas */}
            <div className="grid grid-cols-2 gap-3 mb-4 sm:hidden">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Dinheiro</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={dinheiro}
                  onChange={e => setDinheiro(e.target.value)}
                  onBlur={e => handleNumBlur('dinheiro', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Pix / Dep.</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={pix}
                  onChange={e => setPix(e.target.value)}
                  onBlur={e => handleNumBlur('pix_deposito', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Cart. Assinatura</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={cartAss}
                  onChange={e => setCartAss(e.target.value)}
                  onBlur={e => handleNumBlur('cartao_assinatura', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Cart. Débito</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={cartDeb}
                  onChange={e => setCartDeb(e.target.value)}
                  onBlur={e => handleNumBlur('cartao_debito', e.target.value)} />
              </div>
            </div>
            {/* Campos de cartão — visíveis apenas em tablet (sm mas não md) */}
            <div className="hidden sm:grid md:hidden grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Cart. Assinatura</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={cartAss}
                  onChange={e => setCartAss(e.target.value)}
                  onBlur={e => handleNumBlur('cartao_assinatura', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Cart. Débito</label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  className="h-9 text-right text-sm form-input w-full"
                  value={cartDeb}
                  onChange={e => setCartDeb(e.target.value)}
                  onBlur={e => handleNumBlur('cartao_debito', e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap font-medium">Apostilas:</label>
                <Select value={apostilas} onValueChange={handleApostilas}>
                  <SelectTrigger className="h-8 text-xs form-input w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {apostilas === 'Sim' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground font-medium">Qtd:</label>
                  <Input type="number" min="0" step="1" placeholder="0"
                    className="h-8 text-center text-xs form-input w-16"
                    value={qtd}
                    onChange={e => setQtd(e.target.value)}
                    onBlur={e => upsert({ qtd_apostilas: parseInt(e.target.value) || 0, apostilas })} />
                </div>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground whitespace-nowrap font-medium">Observações:</label>
                <Input
                  placeholder="Adicione uma observação..."
                  className="h-8 text-xs form-input flex-1"
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  onBlur={e => upsert({ obs: e.target.value })} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
};


// ─── History ──────────────────────────────────────────────────────────────────
interface PaymentHistory {
  id: string; mes: string; situacao: string;
  dinheiro: number; pixDeposito: number; cartaoAssinatura: number; cartaoDebito: number;
  valor: number; obs: string; apostilas: string; qtdApostilas: number;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const MensalidadeTab = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const monthOptions = getMonthOptions();

  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [alunoHistory, setAlunoHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showInadimplentes, setShowInadimplentes] = useState(false);

  const loadBase = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id,nome,turno,disciplina,professor,dias_semana,nucleo,honorario,created_at)').eq('ativo', true).order('nome'),
      supabase.from('classes').select('*').order('nome'),
    ]);
    if (aRes.error) { setLoadError(aRes.error.message); return; }
    type AR = {
      id: string; nome: string; matricula: string | null; telefone: string | null;
      email: string | null; turma_id: string | null; ativo: boolean; created_at: string;
      inadimplente: boolean | null;
      classes: { id: string; nome: string; turno: string; disciplina: string | null; professor: string | null; dias_semana: string | null; nucleo: string | null; honorario: number | null; created_at: string } | null
    };
    if (aRes.data) setAlunos((aRes.data as AR[]).map(r => ({
      id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
      email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo, createdAt: r.created_at,
      tipoBolsa: '' as const,
      inadimplente: r.inadimplente ?? false,
      turma: r.classes ? {
        id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno as 'Manhã'|'Tarde'|'Noite',
        disciplina: r.classes.disciplina ?? '', professor: r.classes.professor ?? '',
        diasSemana: r.classes.dias_semana ?? '', nucleo: r.classes.nucleo ?? '',
        honorario: r.classes.honorario ?? 0, createdAt: r.classes.created_at,
      } : undefined,
    })));
    if (tRes.data) setTurmas(tRes.data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as 'Manhã'|'Tarde'|'Noite',
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '', honorario: Number(r.honorario) || 0, createdAt: r.created_at,
    })));
  }, []);

  const loadMensalidades = useCallback(async () => {
    setLoading(true); setLoadError('');
    const { data, error } = await supabase.from('mensalidades').select('*').eq('mes', selectedMonth);
    if (error) { setLoadError(error.message); setLoading(false); return; }
    if (data) setMensalidades(data.map(r => ({
      id: r.id, alunoId: r.aluno_id, turmaId: r.turma_id, mes: r.mes,
      situacao: (r.situacao || 'Pendente') as 'Pago' | 'Pendente',
      dinheiro: Number(r.dinheiro) || 0,
      pixDeposito: Number(r.pix_deposito) || 0,
      cartaoAssinatura: Number(r.cartao_assinatura) || 0,
      cartaoDebito: Number(r.cartao_debito) || 0,
      valor: Number(r.valor) || 0, obs: r.obs ?? '',
      apostilas: (r.apostilas || 'Não') as 'Sim' | 'Não',
      qtdApostilas: Number(r.qtd_apostilas) || 0,
    })));
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMensalidades(); }, [loadMensalidades]);

  const filteredAlunos = (selectedTurma === 'all' ? alunos : alunos.filter(a => a.turmaId === selectedTurma))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  const getMensalidade = (id: string) => mensalidades.find(m => m.alunoId === id);

  const pagos = filteredAlunos.filter(a => getMensalidade(a.id)?.situacao === 'Pago');
  const totalArrecadado = mensalidades.reduce((s, m) => s + m.valor, 0);
  const totalApostilas = mensalidades.reduce((s, m) => s + m.qtdApostilas, 0);
  const inadimplentes = alunos.filter(a => a.inadimplente);

  // Called when admin confirms Pago status in a row
  // Uses toast action button (direct click) to avoid browser popup blockers
  const handleSituacaoPago = (aluno: Aluno) => {
    const firstName = aluno.nome.split(' ')[0];
    if (!aluno.telefone) {
      toast.success(`Pagamento de ${firstName} confirmado!`, {
        description: 'Sem telefone cadastrado. Nao e possivel enviar WhatsApp.',
        duration: 6000,
      });
      return;
    }
    const url = buildClassroomWhatsApp(aluno.telefone, aluno.nome);
    toast.success(`Pagamento de ${firstName} confirmado!`, {
      description: 'Envie o link da sala de aula via WhatsApp.',
      action: {
        label: 'Abrir WhatsApp',
        onClick: () => openWhatsApp(url),
      },
      duration: 20000,
    });
  };

  const openHistory = async (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setLoadingHistory(true);
    const { data } = await supabase.from('mensalidades').select('*').eq('aluno_id', aluno.id).order('mes');
    if (data) setAlunoHistory(data.map(r => ({
      id: r.id, mes: r.mes, situacao: r.situacao,
      dinheiro: Number(r.dinheiro) || 0, pixDeposito: Number(r.pix_deposito) || 0,
      cartaoAssinatura: Number(r.cartao_assinatura) || 0, cartaoDebito: Number(r.cartao_debito) || 0,
      valor: Number(r.valor) || 0, obs: r.obs ?? '',
      apostilas: r.apostilas ?? 'Não', qtdApostilas: Number(r.qtd_apostilas) || 0,
    })));
    setLoadingHistory(false);
  };

  const generatePDF = async (tipo: 'geral' | 'pagos' | 'pendentes') => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const mesLab = mesLabel(selectedMonth);
    const lista = tipo === 'geral' ? filteredAlunos
      : tipo === 'pagos' ? pagos
      : filteredAlunos.filter(a => getMensalidade(a.id)?.situacao !== 'Pago');
    const turmaLab = selectedTurma === 'all' ? 'Todas as Turmas' : (turmas.find(t => t.id === selectedTurma)?.nome || '');

    doc.setFillColor(30,64,175); doc.rect(0,0,297,30,'F');
    try { doc.addImage('/logo-esteadeb.png','PNG',10,5,50,14,undefined,'FAST'); } catch (_e) { /* skip */ }
    doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('RELATORIO DE MENSALIDADES', 148,13,{align:'center'});
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`${mesLab} — ${turmaLab} — Gerado em ${new Date().toLocaleDateString('pt-BR')}`,148,20,{align:'center'});
    doc.text(`Pagos: ${pagos.length} | Pendentes: ${filteredAlunos.length - pagos.length} | Total: R$ ${totalArrecadado.toFixed(2).replace('.',',')} | Apostilas: ${totalApostilas}`,148,26,{align:'center'});

    let y = 36;
    doc.setFillColor(30,64,175); doc.rect(10,y,277,7,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('No',12,y+5); doc.text('Nome',20,y+5); doc.text('Dinheiro',90,y+5);
    doc.text('Pix/Dep.',115,y+5); doc.text('Cart.Ass',140,y+5); doc.text('Cart.Deb',163,y+5);
    doc.text('Total',188,y+5); doc.text('Apostilas',208,y+5); doc.text('Qtd',228,y+5);
    doc.text('Situacao',270,y+5,{align:'right'}); y+=7;

    doc.setTextColor(0,0,0);
    lista.forEach((a, i) => {
      if (y > 195) { doc.addPage(); y = 15; }
      doc.setFillColor(i%2===0 ? 255 : 249); doc.rect(10,y,277,6.5,'F');
      doc.setFontSize(7); doc.setFont('helvetica','normal');
      const m = getMensalidade(a.id);
      const fmt = (v: number) => v > 0 ? `R$${v.toFixed(2).replace('.',',')}` : '—';
      doc.text(String(i+1),12,y+4.5); doc.text(a.nome.substring(0,32),20,y+4.5);
      doc.text(fmt(m?.dinheiro||0),90,y+4.5); doc.text(fmt(m?.pixDeposito||0),115,y+4.5);
      doc.text(fmt(m?.cartaoAssinatura||0),140,y+4.5); doc.text(fmt(m?.cartaoDebito||0),163,y+4.5);
      doc.text(fmt(m?.valor||0),188,y+4.5);
      doc.text(m?.apostilas||'Não',208,y+4.5);
      doc.text(m?.qtdApostilas ? String(m.qtdApostilas) : '—',228,y+4.5);
      const sit = m?.situacao || 'Pendente';
      doc.setTextColor(sit==='Pago'?21:185, sit==='Pago'?128:28, sit==='Pago'?61:28);
      doc.setFont('helvetica','bold'); doc.text(sit,270,y+4.5,{align:'right'});
      doc.setTextColor(0,0,0); y+=6.5;
    });
    doc.save(`Mensalidade_${mesLab.replace(' ','_')}_${tipo}.pdf`);
    toast.success('PDF gerado!');
  };

  // ─── History view ─────────────────────────────────────────────────────────
  if (selectedAluno) {
    const totalPago = alunoHistory.reduce((s, h) => s + h.valor, 0);
    const qtdApostTot = alunoHistory.reduce((s, h) => s + h.qtdApostilas, 0);
    return (
      <div className="space-y-5">
        <Button variant="outline" onClick={() => setSelectedAluno(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />Voltar
        </Button>
        <div className="content-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{selectedAluno.nome.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedAluno.nome}</h2>
              {selectedAluno.matricula && <p className="text-sm text-muted-foreground">Matricula: {selectedAluno.matricula}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { l: 'Total Pago', v: `R$ ${totalPago.toFixed(2).replace('.',',')}`, c: 'text-emerald-600', bg: 'bg-emerald-50' },
              { l: 'Meses Pagos', v: alunoHistory.filter(h=>h.situacao==='Pago').length, c: 'text-primary', bg: 'bg-primary/5' },
              { l: 'Pendentes', v: alunoHistory.filter(h=>h.situacao==='Pendente').length, c: 'text-red-600', bg: 'bg-red-50' },
              { l: 'Apostilas Total', v: qtdApostTot, c: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.l} className={`content-card p-4 ${s.bg} border-0`}>
                <p className="text-xs text-muted-foreground">{s.l}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="loading-spinner" /></div>
          ) : alunoHistory.length === 0 ? (
            <div className="empty-state"><History className="w-10 h-10 mx-auto mb-2 opacity-30"/><p>Sem historico de pagamentos</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-th text-left">Mes</th>
                    <th className="table-th text-right hidden sm:table-cell">Dinheiro</th>
                    <th className="table-th text-right hidden sm:table-cell">Pix/Dep.</th>
                    <th className="table-th text-right hidden md:table-cell">Cart. Ass.</th>
                    <th className="table-th text-right hidden md:table-cell">Cart. Deb.</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th text-center">Situacao</th>
                    <th className="table-th text-center hidden lg:table-cell">Apostilas</th>
                    <th className="table-th text-left hidden xl:table-cell">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alunoHistory.map(h => {
                    const fmt = (v: number) => v > 0 ? `R$ ${v.toFixed(2).replace('.',',')}` : '—';
                    return (
                      <tr key={h.id} className="table-row">
                        <td className="table-td font-medium text-sm text-foreground">{mesLabel(h.mes)}</td>
                        <td className="table-td text-right text-sm hidden sm:table-cell">{fmt(h.dinheiro)}</td>
                        <td className="table-td text-right text-sm hidden sm:table-cell">{fmt(h.pixDeposito)}</td>
                        <td className="table-td text-right text-sm hidden md:table-cell">{fmt(h.cartaoAssinatura)}</td>
                        <td className="table-td text-right text-sm hidden md:table-cell">{fmt(h.cartaoDebito)}</td>
                        <td className="table-td text-right font-bold text-sm text-emerald-600">{fmt(h.valor)}</td>
                        <td className="table-td text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${h.situacao==='Pago'?'badge-pago':'badge-pendente'}`}>
                            {h.situacao==='Pago'?<CheckCircle2 className="w-3 h-3 mr-1"/>:<Clock className="w-3 h-3 mr-1"/>}{h.situacao}
                          </span>
                        </td>
                        <td className="table-td text-center hidden lg:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded ${h.apostilas==='Sim'?'bg-amber-100 text-amber-700':''}`}>{h.apostilas}</span>
                          {h.qtdApostilas > 0 && <span className="ml-1 text-xs text-amber-600 font-bold">x{h.qtdApostilas}</span>}
                        </td>
                        <td className="table-td text-xs text-muted-foreground hidden xl:table-cell">{h.obs||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={5} className="table-td font-bold text-sm text-foreground hidden md:table-cell">Total</td>
                    <td colSpan={3} className="table-td font-bold text-sm text-foreground md:hidden">Total</td>
                    <td className="table-td text-right font-bold text-emerald-600">R$ {totalPago.toFixed(2).replace('.',',')}</td>
                    <td colSpan={3} className="table-td" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main table ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="content-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTurma} onValueChange={setSelectedTurma}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadMensalidades} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" />Atualizar
          </Button>
          <div className="flex gap-2 ml-auto flex-wrap">
            {(['geral','pagos','pendentes'] as const).map(tipo => (
              <Button key={tipo} variant="outline" size="sm"
                onClick={() => generatePDF(tipo)}
                className={`gap-1.5 h-9 text-xs ${tipo==='pagos'?'text-emerald-700 border-emerald-200 hover:bg-emerald-50':tipo==='pendentes'?'text-red-700 border-red-200 hover:bg-red-50':''}`}>
                PDF {tipo.charAt(0).toUpperCase()+tipo.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{loadError}
          <Button variant="outline" size="sm" onClick={loadBase} className="ml-auto h-7">Tentar novamente</Button>
        </div>
      )}

      {/* Inadimplentes Panel */}
      {inadimplentes.length > 0 && (
        <div className="content-card overflow-hidden border-orange-200">
          <button
            onClick={() => setShowInadimplentes(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-orange-800">
                  Cobranca via WhatsApp — {inadimplentes.length} inadimplente{inadimplentes.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-orange-600">Clique para expandir e enviar mensagens de cobranca</p>
              </div>
            </div>
            {showInadimplentes ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
          </button>

          {showInadimplentes && (
            <div className="border-t border-orange-200 bg-orange-50/30 p-4 space-y-2">
              <p className="text-xs text-orange-700 mb-3">
                Selecione um aluno inadimplente e clique em <strong>Enviar WhatsApp</strong> para enviar uma mensagem de cobranca automatica com dados de pagamento via PIX.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inadimplentes.map(aluno => {
                  const phone = aluno.telefone;
                  return (
                    <div key={aluno.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-orange-200">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-orange-700">{aluno.nome.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{aluno.nome}</p>
                        {aluno.matricula && <p className="text-xs text-muted-foreground">{aluno.matricula}</p>}
                        {!phone && <p className="text-xs text-red-500 italic">Sem telefone cadastrado</p>}
                      </div>
                      {phone ? (
                        <Button size="sm"
                          onClick={() => openWhatsApp(buildCobrancaWhatsApp(phone, aluno.nome))}
                          className="gap-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white flex-shrink-0">
                          <MessageCircle className="w-3.5 h-3.5" />
                          Enviar
                        </Button>
                      ) : (
                        <Button size="sm" disabled className="gap-1 h-8 text-xs flex-shrink-0">
                          <MessageCircle className="w-3.5 h-3.5" />Sem Tel.
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classroom link info */}
      <div className="content-card p-3 flex items-start gap-3 bg-blue-50 border-blue-200">
        <GraduationCap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Envio de link ao confirmar pagamento</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Ao confirmar o pagamento (mudar para <strong>Pago</strong>), um aviso aparece com o botao <strong>"Abrir WhatsApp"</strong>.
            Clique nele para abrir o WhatsApp com mensagem de parabenizacao e link da sala de aula ja preenchidos.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Alunos', v: filteredAlunos.length, icon: CreditCard, c: 'text-primary', bg: 'bg-primary/5' },
          { l: 'Pagos', v: pagos.length, icon: CheckCircle2, c: 'text-emerald-600', bg: 'bg-emerald-50' },
          { l: 'Pendentes', v: filteredAlunos.length - pagos.length, icon: Clock, c: 'text-red-600', bg: 'bg-red-50' },
          { l: 'Arrecadado', v: `R$ ${totalArrecadado.toFixed(2).replace('.',',')}`, icon: TrendingUp, c: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.l} className={`content-card p-4 ${s.bg} border-0`}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">{s.l}</p><p className={`text-xl font-bold mt-0.5 ${s.c}`}>{s.v}</p></div>
              <s.icon className={`w-6 h-6 opacity-30 ${s.c}`} />
            </div>
          </div>
        ))}
      </div>

      {totalApostilas > 0 && (
        <div className="content-card p-3 flex items-center gap-3 bg-amber-50 border-amber-200">
          <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800"><span className="font-bold">{totalApostilas}</span> apostila{totalApostilas!==1?'s':''} em {mesLabel(selectedMonth)}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1"><Banknote className="w-3 h-3"/><strong>Dinheiro</strong></span>
        <span className="flex items-center gap-1"><Smartphone className="w-3 h-3"/><strong>Pix/Dep/Transf</strong></span>
        <span className="flex items-center gap-1"><CreditCard className="w-3 h-3"/><strong>Cart.Ass</strong> = Cartao/Assinatura</span>
        <span className="flex items-center gap-1"><CreditCard className="w-3 h-3"/><strong>Cart.Deb</strong> = Cartao Debito</span>
        <span className="ml-auto text-primary/70 italic">Clique no nome do aluno para ver historico completo</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : filteredAlunos.length === 0 ? (
        <div className="empty-state">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum aluno ativo encontrado</p>
          <p className="text-sm mt-1">Cadastre alunos na aba "Cadastro de Alunos"</p>
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground">{mesLabel(selectedMonth)}</p>
            <p className="text-xs text-muted-foreground">{filteredAlunos.length} alunos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th className="table-th text-left min-w-[160px]">Aluno</th>
                  <th className="table-th text-right hidden sm:table-cell">Dinheiro</th>
                  <th className="table-th text-right hidden sm:table-cell">Pix/Dep.</th>
                  <th className="table-th text-right hidden md:table-cell">Cart.Ass</th>
                  <th className="table-th text-right hidden md:table-cell">Cart.Deb</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th text-center">Situação</th>
                  <th className="table-th w-8" title="Observações / Apostilas"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAlunos.map(a => (
                  <MensalidadeRow
                    key={`${a.id}-${selectedMonth}`}
                    aluno={a}
                    mensalidade={getMensalidade(a.id)}
                    selectedMonth={selectedMonth}
                    onSaved={loadMensalidades}
                    onOpenHistory={openHistory}
                    onSituacaoPago={handleSituacaoPago}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>{pagos.length}/{filteredAlunos.length} pagos — R$ {totalArrecadado.toFixed(2).replace('.',',')} arrecadados</span>
            {totalApostilas > 0 && <span className="text-amber-600 font-medium flex items-center gap-1"><BookOpen className="w-3 h-3"/>{totalApostilas} apostila{totalApostilas!==1?'s':''}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MensalidadeTab;
