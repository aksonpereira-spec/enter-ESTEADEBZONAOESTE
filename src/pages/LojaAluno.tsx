import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, ShoppingCart, LogOut, Eye, EyeOff, BookOpen, Shirt,
  Clock, CheckCircle2, Truck, Search, X, Plus, Minus, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Material {
  id: string; tipo: string; disciplina: string; nome: string;
  modulo: number; quantidade: number; valorUnitario: number; status: string;
}

interface Pedido {
  id: string; material_id: string; quantidade: number;
  valor_total: number; status: string; created_at: string;
  estoque_materiais?: { nome: string; tipo: string; disciplina: string; modulo: number };
}

// ─── Status badges ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string; icon: JSX.Element }> = {
  Pendente: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Aguardando Pagamento', icon: <Clock className="w-3 h-3" /> },
  Pago: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Pagamento Confirmado', icon: <CheckCircle2 className="w-3 h-3" /> },
  Entregue: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Entregue', icon: <Truck className="w-3 h-3" /> },
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// ─── Order Modal ──────────────────────────────────────────────────────────────
const OrderModal = ({ material, onClose, onConfirm }: {
  material: Material;
  onClose: () => void;
  onConfirm: (qty: number) => Promise<void>;
}) => {
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const total = qty * material.valorUnitario;
  const max = Math.min(material.quantidade, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">{material.nome}</h3>
            {material.disciplina && <p className="text-sm text-muted-foreground">{material.disciplina}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="text-sm text-muted-foreground">Valor unitário</span>
            <span className="font-bold text-primary">{fmt(material.valorUnitario)}</span>
          </div>

          <div>
            <label className="form-label">Quantidade</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <Input type="number" min="1" max={max} value={qty}
                onChange={e => setQty(Math.max(1, Math.min(max, parseInt(e.target.value) || 1)))}
                className="form-input h-9 text-center font-bold w-20" />
              <button onClick={() => setQty(q => Math.min(max, q + 1))}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground">(máx. {max})</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="font-semibold text-foreground">Total do Pedido</span>
            <span className="text-2xl font-bold text-emerald-600">{fmt(total)}</span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Após confirmar, envie o comprovante de pagamento ao coordenador via WhatsApp.<br />
            O pedido ficará como "Aguardando Pagamento" até a confirmação manual.
          </p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              await onConfirm(qty);
              setSaving(false);
            }} className="flex-1 btn-primary gap-2">
              <ShoppingCart className="w-4 h-4" />
              {saving ? 'Confirmando...' : 'Confirmar Pedido'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const LojaAluno = () => {
  const [screen, setScreen] = useState<'auth' | 'loja' | 'pedidos'>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [authForm, setAuthForm] = useState({ nome: '', username: '', senha: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // Store state
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingStore, setLoadingStore] = useState(false);
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterDisc, setFilterDisc] = useState('Todas');
  const [search, setSearch] = useState('');
  const [orderModal, setOrderModal] = useState<Material | null>(null);
  const [nucleoNome, setNucleoNome] = useState('');

  useEffect(() => {
    supabase.from('nucleo_config').select('nome_nucleo').limit(1).maybeSingle()
      .then(({ data }) => { if (data?.nome_nucleo) setNucleoNome(data.nome_nucleo); });
  }, []);

  const loadStore = useCallback(async (uid: string) => {
    setLoadingStore(true);
    const [matRes, pedRes] = await Promise.all([
      supabase.from('estoque_materiais').select('*').eq('status', 'Disponivel').gt('quantidade', 0).order('tipo').order('nome'),
      supabase.from('loja_pedidos').select('*, estoque_materiais(nome, tipo, disciplina, modulo)').eq('usuario_id', uid).order('created_at', { ascending: false }),
    ]);
    if (matRes.data) setMateriais(matRes.data.map(r => ({
      id: r.id, tipo: r.tipo, disciplina: r.disciplina ?? '', nome: r.nome,
      modulo: r.modulo ?? 1, quantidade: r.quantidade ?? 0,
      valorUnitario: Number(r.valor_unitario) || 0, status: r.status ?? '',
    })));
    if (pedRes.data) setPedidos(pedRes.data as unknown as Pedido[]);
    setLoadingStore(false);
  }, []);

  // ── Auth ──
  const handleLogin = async () => {
    const { nome, username, senha } = authForm;
    if (!nome.trim() || !username || !senha) { toast.error('Preencha todos os campos'); return; }
    setAuthLoading(true);
    const { data } = await supabase.from('loja_usuarios').select('id, nome').eq('username', username.trim().toLowerCase()).eq('senha', senha).maybeSingle();
    if (!data) { toast.error('Usuário ou senha inválidos'); setAuthLoading(false); return; }
    if (data.nome.trim().toLowerCase() !== nome.trim().toLowerCase()) { toast.error('Nome não confere com o cadastro'); setAuthLoading(false); return; }
    setUserId(data.id); setUserName(data.nome);
    setScreen('loja'); loadStore(data.id);
    setAuthLoading(false);
  };

  const handleRegister = async () => {
    const { nome, username, senha } = authForm;
    if (!nome.trim() || !username.trim() || !senha) { toast.error('Preencha todos os campos'); return; }
    if (senha.length < 4) { toast.error('Senha deve ter pelo menos 4 caracteres'); return; }
    setAuthLoading(true);
    const { data: existing } = await supabase.from('loja_usuarios').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
    if (existing) { toast.error('Nome de usuário já cadastrado'); setAuthLoading(false); return; }
    const { data, error } = await supabase.from('loja_usuarios').insert({ nome: nome.trim(), username: username.trim().toLowerCase(), senha }).select().maybeSingle();
    if (error || !data) { toast.error('Erro ao cadastrar: ' + (error?.message || '')); setAuthLoading(false); return; }
    setUserId(data.id); setUserName(data.nome);
    toast.success('Cadastro realizado! Bem-vindo(a) à loja!');
    setScreen('loja'); loadStore(data.id);
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setUserId(null); setUserName(''); setScreen('auth');
    setAuthForm({ nome: '', username: '', senha: '' });
  };

  // ── Order ──
  const placeOrder = async (material: Material, qty: number) => {
    if (!userId) return;
    const valorTotal = qty * material.valorUnitario;
    const { error } = await supabase.from('loja_pedidos').insert({
      usuario_id: userId, material_id: material.id,
      quantidade: qty, valor_total: valorTotal, status: 'Pendente',
    });
    if (error) { toast.error('Erro ao fazer pedido: ' + error.message); return; }
    // Decrement stock
    await supabase.from('estoque_materiais').update({
      quantidade: material.quantidade - qty,
      status: material.quantidade - qty <= 0 ? 'Indisponivel' : 'Disponivel',
    }).eq('id', material.id);
    toast.success('Pedido confirmado! Envie o comprovante ao coordenador.');
    setOrderModal(null);
    loadStore(userId);
  };

  // ── Filter ──
  const disciplinas = ['Todas', ...Array.from(new Set(materiais.filter(m => m.disciplina).map(m => m.disciplina))).sort()];
  const filtered = materiais.filter(m => {
    if (filterTipo !== 'Todos' && m.tipo !== filterTipo) return false;
    if (filterDisc !== 'Todas' && m.disciplina !== filterDisc) return false;
    if (search && !m.nome.toLowerCase().includes(search.toLowerCase()) && !m.disciplina.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Auth screen
  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-4">
        {orderModal && <OrderModal material={orderModal} onClose={() => setOrderModal(null)} onConfirm={async (q) => await placeOrder(orderModal, q)} />}
        <div className="w-full max-w-sm">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Loja ESTEADEB</h1>
            {nucleoNome && <p className="text-sm text-muted-foreground mt-1">Núcleo {nucleoNome}</p>}
            <p className="text-sm text-muted-foreground mt-1">Apostilas e materiais da escola</p>
          </div>

          {/* Tabs */}
          <div className="content-card p-1 mb-4 grid grid-cols-2 gap-1 rounded-xl">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => setAuthMode(m)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${authMode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="content-card p-6 space-y-4">
            <div>
              <label className="form-label">Nome completo</label>
              <Input className="form-input" placeholder="Seu nome" value={authForm.nome}
                onChange={e => setAuthForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Usuário</label>
              <Input className="form-input" placeholder="ex: joao.silva" value={authForm.username}
                onChange={e => setAuthForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Senha</label>
              <div className="relative">
                <Input type={showPwd ? 'text' : 'password'} className="form-input pr-10" placeholder="••••••"
                  value={authForm.senha}
                  onChange={e => setAuthForm(p => ({ ...p, senha: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { if (authMode === 'login') { handleLogin(); } else { handleRegister(); } } }} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full btn-primary h-11" disabled={authLoading}
              onClick={authMode === 'login' ? handleLogin : handleRegister}>
              {authLoading ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar Conta'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Store / Orders
  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      {orderModal && (
        <OrderModal material={orderModal} onClose={() => setOrderModal(null)}
          onConfirm={async (q) => await placeOrder(orderModal, q)} />
      )}

      {/* Header */}
      <header className="app-header sticky top-0 z-40 h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-white" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Loja ESTEADEB</p>
            {nucleoNome && <p className="text-white/60 text-xs leading-tight">Núcleo {nucleoNome}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm hidden sm:block">Olá, {userName.split(' ')[0]}!</span>
          <button onClick={() => setScreen('loja')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${screen === 'loja' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
            <span className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" />Loja</span>
          </button>
          <button onClick={() => { setScreen('pedidos'); if (userId) loadStore(userId); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${screen === 'pedidos' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />Meus Pedidos
              {pedidos.filter(p => p.status === 'Pendente').length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center">
                  {pedidos.filter(p => p.status === 'Pendente').length}
                </span>
              )}
            </span>
          </button>
          <button onClick={handleLogout} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 lg:px-8 py-6 max-w-5xl mx-auto w-full">

        {/* LOJA screen */}
        {screen === 'loja' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Materiais Disponíveis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} material(is) encontrado(s)</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="form-input pl-9 h-9" placeholder="Buscar material..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="form-input h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os tipos</SelectItem>
                  <SelectItem value="Apostila">Apostilas</SelectItem>
                  <SelectItem value="Camisa">Camisas</SelectItem>
                </SelectContent>
              </Select>
              {disciplinas.length > 1 && (
                <Select value={filterDisc} onValueChange={setFilterDisc}>
                  <SelectTrigger className="form-input h-9 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {disciplinas.map(d => <SelectItem key={d} value={d}>{d === 'Todas' ? 'Todas as disciplinas' : d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {loadingStore ? (
              <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum material disponível</p>
                <p className="text-sm mt-1">Novos materiais aparecerão aqui quando forem cadastrados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(m => (
                  <div key={m.id} className="content-card p-5 flex flex-col gap-3 hover:shadow-md transition-all hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                        {m.tipo === 'Apostila' ? <BookOpen className="w-5 h-5 text-primary" /> : <Shirt className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${m.tipo === 'Apostila' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {m.tipo}
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                          Disponível
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground text-sm leading-tight">{m.nome}</h3>
                      {m.disciplina && <p className="text-xs text-muted-foreground mt-0.5">{m.disciplina}</p>}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />Módulo {m.modulo}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-bold text-lg text-primary">{fmt(m.valorUnitario)}</span>
                      <span className="text-xs text-muted-foreground">{m.quantidade} em estoque</span>
                    </div>
                    <Button className="w-full btn-primary h-9 gap-2" onClick={() => setOrderModal(m)}>
                      <ShoppingCart className="w-3.5 h-3.5" />Pedir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEDIDOS screen */}
        {screen === 'pedidos' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Meus Pedidos</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{pedidos.length} pedido(s) no total</p>
            </div>

            {loadingStore ? (
              <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
            ) : pedidos.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum pedido ainda</p>
                <p className="text-sm mt-1">Acesse a Loja e faça seu primeiro pedido</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pedidos.map(p => {
                  const mat = p.estoque_materiais as { nome: string; tipo: string; disciplina: string; modulo: number } | undefined;
                  const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.Pendente;
                  return (
                    <div key={p.id} className="content-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                            {mat?.tipo === 'Camisa' ? <Shirt className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-primary" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{mat?.nome || '—'}</p>
                            {mat?.disciplina && <p className="text-xs text-muted-foreground">{mat.disciplina}</p>}
                            <p className="text-xs text-muted-foreground">
                              Módulo {mat?.modulo} · {p.quantidade} un. · <span className="font-semibold text-foreground">{fmt(p.valor_total)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${sc.color}`}>
                            {sc.icon}{p.status}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1.5">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      {p.status === 'Pendente' && (
                        <div className="mt-3 pt-3 border-t border-dashed border-border">
                          <p className="text-xs text-amber-600 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            Envie o comprovante de pagamento ao coordenador via WhatsApp para confirmar seu pedido.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LojaAluno;
