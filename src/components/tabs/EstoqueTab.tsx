import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, Plus, Edit2, Trash2, Check, X, Link2, Copy, ChevronDown, ChevronUp,
  ShoppingCart, Users, TrendingUp, Box, CheckCircle2, Truck, Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Material {
  id: string; tipo: string; disciplina: string; nome: string;
  modulo: number; quantidade: number; valorUnitario: number;
  status: string; createdAt: string;
}

interface Pedido {
  id: string; usuario_id: string; material_id: string; quantidade: number;
  valor_total: number; status: string; created_at: string;
  loja_usuarios?: { nome: string; username: string };
  estoque_materiais?: { nome: string; tipo: string; disciplina: string };
}

interface LojaUser { id: string; nome: string; username: string; createdAt: string; }

// ─── Material form ─────────────────────────────────────────────────────────────
const emptyMat = { tipo: 'Apostila', disciplina: '', nome: '', modulo: 1, quantidade: 0, valorUnitario: '', status: 'Disponivel' };

const STATUS_COLOR: Record<string, string> = {
  Disponivel: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Indisponivel: 'bg-red-50 text-red-600 border-red-200',
};

const PEDIDO_STATUS_COLOR: Record<string, string> = {
  Pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  Pago: 'bg-blue-50 text-blue-700 border-blue-200',
  Entregue: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PEDIDO_STATUS_ICON: Record<string, JSX.Element> = {
  Pendente: <Clock className="w-3 h-3" />,
  Pago: <CheckCircle2 className="w-3 h-3" />,
  Entregue: <Truck className="w-3 h-3" />,
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function safeCopy(text: string, onSuccess: () => void) {
  try {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onSuccess();
    });
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onSuccess();
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
const EstoqueTab = () => {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [usuarios, setUsuarios] = useState<LojaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'materiais' | 'pedidos' | 'usuarios'>('materiais');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMat);

  // Entry modal (add stock)
  const [entradaId, setEntradaId] = useState<string | null>(null);
  const [entradaQtd, setEntradaQtd] = useState('');

  // Filters
  const [pedidoFilter, setPedidoFilter] = useState('Todos');

  const lojaUrl = `${window.location.origin}/loja`;

  const load = useCallback(async () => {
    setLoading(true);
    const [matRes, pedRes, usrRes] = await Promise.all([
      supabase.from('estoque_materiais').select('*').order('created_at', { ascending: false }),
      supabase.from('loja_pedidos').select('*, loja_usuarios(nome, username), estoque_materiais(nome, tipo, disciplina)').order('created_at', { ascending: false }),
      supabase.from('loja_usuarios').select('id, nome, username, created_at').order('created_at', { ascending: false }),
    ]);
    if (matRes.data) setMateriais(matRes.data.map(r => ({
      id: r.id, tipo: r.tipo, disciplina: r.disciplina ?? '', nome: r.nome,
      modulo: r.modulo ?? 1, quantidade: r.quantidade ?? 0,
      valorUnitario: Number(r.valor_unitario) || 0, status: r.status ?? 'Disponivel',
      createdAt: r.created_at,
    })));
    if (pedRes.data) setPedidos(pedRes.data as unknown as Pedido[]);
    if (usrRes.data) setUsuarios(usrRes.data.map(r => ({ id: r.id, nome: r.nome, username: r.username, createdAt: r.created_at })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ──
  const saveMaterial = async () => {
    if (!form.nome.trim()) { toast.error('Nome do material é obrigatório'); return; }
    const payload = {
      tipo: form.tipo, disciplina: form.tipo === 'Apostila' ? form.disciplina : '',
      nome: form.nome.trim(), modulo: form.modulo,
      quantidade: Number(form.quantidade) || 0,
      valor_unitario: parseFloat(String(form.valorUnitario)) || 0,
      status: form.status,
    };
    if (editingId) {
      const { error } = await supabase.from('estoque_materiais').update(payload).eq('id', editingId);
      if (!error) { toast.success('Material atualizado'); } else { toast.error('Erro: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('estoque_materiais').insert(payload);
      if (!error) { toast.success('Material cadastrado'); } else { toast.error('Erro: ' + error.message); return; }
    }
    setForm(emptyMat); setEditingId(null); setShowForm(false); load();
  };

  const deleteMaterial = async (id: string) => {
    const { error } = await supabase.from('estoque_materiais').delete().eq('id', id);
    if (!error) { toast.success('Material removido'); load(); } else toast.error('Erro ao remover');
  };

  const toggleStatus = async (m: Material) => {
    const newStatus = m.status === 'Disponivel' ? 'Indisponivel' : 'Disponivel';
    await supabase.from('estoque_materiais').update({ status: newStatus }).eq('id', m.id);
    load();
  };

  const addEntrada = async () => {
    if (!entradaId) return;
    const qtd = parseInt(entradaQtd) || 0;
    if (qtd <= 0) { toast.error('Informe uma quantidade válida'); return; }
    const mat = materiais.find(m => m.id === entradaId);
    if (!mat) return;
    const newQtd = mat.quantidade + qtd;
    await supabase.from('estoque_materiais').update({ quantidade: newQtd, status: 'Disponivel' }).eq('id', entradaId);
    toast.success(`+${qtd} unidades adicionadas. Total: ${newQtd}`);
    setEntradaId(null); setEntradaQtd(''); load();
  };

  // ── Pedidos ──
  const confirmPagamento = async (id: string) => {
    await supabase.from('loja_pedidos').update({ status: 'Pago' }).eq('id', id);
    toast.success('Pagamento confirmado'); load();
  };

  const marcarEntregue = async (id: string) => {
    await supabase.from('loja_pedidos').update({ status: 'Entregue' }).eq('id', id);
    toast.success('Pedido marcado como entregue'); load();
  };

  // ── Usuários ──
  const deleteUser = async (id: string) => {
    const { error } = await supabase.from('loja_usuarios').delete().eq('id', id);
    if (!error) { toast.success('Usuário removido'); load(); } else toast.error('Erro ao remover');
  };

  const filteredPedidos = pedidoFilter === 'Todos' ? pedidos : pedidos.filter(p => p.status === pedidoFilter);
  const totalDisponiveis = materiais.filter(m => m.status === 'Disponivel').length;
  const totalPendentes = pedidos.filter(p => p.status === 'Pendente').length;

  return (
    <div className="space-y-5">
      {/* Link da Loja */}
      <div className="content-card p-4 bg-primary/5 border-l-4 border-l-primary">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Link da Loja do Aluno</p>
              <p className="text-sm font-mono text-primary truncate">{lojaUrl}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 flex-shrink-0"
            onClick={() => safeCopy(lojaUrl, () => toast.success('Link copiado!'))}>
            <Copy className="w-3.5 h-3.5" />Copiar Link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="content-card p-4 bg-primary/5 border-0">
          <p className="text-xs text-muted-foreground">Materiais</p>
          <p className="text-2xl font-bold text-primary">{materiais.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalDisponiveis} disponíveis</p>
        </div>
        <div className="content-card p-4 bg-amber-50 border-0">
          <p className="text-xs text-muted-foreground">Pedidos Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{totalPendentes}</p>
          <p className="text-xs text-muted-foreground mt-0.5">aguardando pagamento</p>
        </div>
        <div className="content-card p-4 bg-emerald-50 border-0">
          <p className="text-xs text-muted-foreground">Total Pedidos</p>
          <p className="text-2xl font-bold text-emerald-600">{pedidos.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{pedidos.filter(p => p.status === 'Entregue').length} entregues</p>
        </div>
        <div className="content-card p-4 bg-blue-50 border-0">
          <p className="text-xs text-muted-foreground">Alunos Loja</p>
          <p className="text-2xl font-bold text-blue-600">{usuarios.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">cadastrados</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'materiais', label: 'Materiais', icon: Box },
          { id: 'pedidos', label: `Pedidos ${totalPendentes > 0 ? `(${totalPendentes})` : ''}`, icon: ShoppingCart },
          { id: 'usuarios', label: 'Alunos', icon: Users },
        ] as const).map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id as typeof activeSection)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeSection === s.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <s.icon className="w-3.5 h-3.5" />{s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pb-1">
          <Button variant="ghost" size="sm" onClick={load} className="h-7 gap-1 text-xs">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : (
        <>
          {/* ── MATERIAIS ── */}
          {activeSection === 'materiais' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{materiais.length} material(is) cadastrado(s)</p>
                <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyMat); }} className="btn-primary gap-2 h-9">
                  {showForm ? <><X className="w-4 h-4" />Cancelar</> : <><Plus className="w-4 h-4" />Novo Material</>}
                </Button>
              </div>

              {/* Form */}
              {showForm && (
                <div className="content-card p-5 border-l-4 border-l-primary">
                  <h3 className="font-semibold mb-4">{editingId ? 'Editar Material' : 'Novo Material'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Tipo *</label>
                      <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Apostila">Apostila</SelectItem>
                          <SelectItem value="Camisa">Camisa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="form-label">Nome *</label>
                      <Input className="form-input" placeholder="Ex: Apostila Hermenêutica" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
                    </div>
                    {form.tipo === 'Apostila' && (
                      <div>
                        <label className="form-label">Disciplina</label>
                        <Input className="form-input" placeholder="Nome da disciplina" value={form.disciplina} onChange={e => setForm(p => ({ ...p, disciplina: e.target.value }))} />
                      </div>
                    )}
                    <div>
                      <label className="form-label">Módulo (1–44)</label>
                      <Input type="number" min="1" max="44" className="form-input" value={form.modulo} onChange={e => setForm(p => ({ ...p, modulo: parseInt(e.target.value) || 1 }))} />
                    </div>
                    <div>
                      <label className="form-label">Qtd em Estoque</label>
                      <Input type="number" min="0" className="form-input" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="form-label">Valor Unitário (R$)</label>
                      <Input type="number" min="0" step="0.50" className="form-input" placeholder="0,00" value={form.valorUnitario} onChange={e => setForm(p => ({ ...p, valorUnitario: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Status</label>
                      <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Disponivel">Disponível</SelectItem>
                          <SelectItem value="Indisponivel">Indisponível</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button onClick={saveMaterial} className="btn-primary gap-2"><Check className="w-4 h-4" />Salvar</Button>
                    <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyMat); }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Entrada modal */}
              {entradaId && (
                <div className="content-card p-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
                  <p className="text-sm font-semibold mb-3 text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Entrada de Estoque — {materiais.find(m => m.id === entradaId)?.nome}
                  </p>
                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="form-label text-xs">Quantidade a adicionar</label>
                      <Input type="number" min="1" className="form-input h-9 w-36" placeholder="0" value={entradaQtd}
                        onChange={e => setEntradaQtd(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addEntrada(); if (e.key === 'Escape') { setEntradaId(null); setEntradaQtd(''); } }} />
                    </div>
                    <Button onClick={addEntrada} className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Check className="w-4 h-4" />Confirmar</Button>
                    <Button variant="outline" onClick={() => { setEntradaId(null); setEntradaQtd(''); }} className="h-9"><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}

              {/* Table */}
              {materiais.length === 0 ? (
                <div className="empty-state">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum material cadastrado</p>
                  <p className="text-sm mt-1">Clique em "Novo Material" para começar</p>
                </div>
              ) : (
                <div className="content-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="table-head">
                          <th className="table-th text-left">Material</th>
                          <th className="table-th text-center hidden sm:table-cell">Tipo</th>
                          <th className="table-th text-center hidden md:table-cell">Módulo</th>
                          <th className="table-th text-center">Qtd</th>
                          <th className="table-th text-right hidden sm:table-cell">Valor</th>
                          <th className="table-th text-center">Status</th>
                          <th className="table-th text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {materiais.map(m => (
                          <tr key={m.id} className="table-row">
                            <td className="table-td">
                              <p className="font-medium text-sm text-foreground">{m.nome}</p>
                              {m.disciplina && <p className="text-xs text-muted-foreground">{m.disciplina}</p>}
                            </td>
                            <td className="table-td text-center hidden sm:table-cell">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.tipo === 'Apostila' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                {m.tipo}
                              </span>
                            </td>
                            <td className="table-td text-center hidden md:table-cell">
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Mod. {m.modulo}</span>
                            </td>
                            <td className="table-td text-center">
                              <span className={`font-bold text-sm ${m.quantidade === 0 ? 'text-red-500' : 'text-foreground'}`}>{m.quantidade}</span>
                            </td>
                            <td className="table-td text-right hidden sm:table-cell">
                              <span className="font-semibold text-sm text-foreground">{fmt(m.valorUnitario)}</span>
                            </td>
                            <td className="table-td text-center">
                              <button onClick={() => toggleStatus(m)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all hover:opacity-80 ${STATUS_COLOR[m.status] || 'bg-muted text-muted-foreground'}`}>
                                {m.status === 'Disponivel' ? 'Disponível' : 'Indisponível'}
                              </button>
                            </td>
                            <td className="table-td">
                              <div className="flex items-center gap-1 justify-center">
                                <button title="Entrada de estoque"
                                  onClick={() => { setEntradaId(m.id); setEntradaQtd(''); setShowForm(false); }}
                                  className="p-1.5 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                </button>
                                <button title="Editar"
                                  onClick={() => {
                                    setForm({ tipo: m.tipo, disciplina: m.disciplina, nome: m.nome, modulo: m.modulo, quantidade: m.quantidade, valorUnitario: String(m.valorUnitario), status: m.status });
                                    setEditingId(m.id); setShowForm(true); setEntradaId(null);
                                  }}
                                  className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button title="Excluir"
                                  onClick={() => deleteMaterial(m.id)}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PEDIDOS ── */}
          {activeSection === 'pedidos' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">{pedidos.length} pedido(s)</p>
                <div className="flex gap-1 flex-wrap">
                  {['Todos', 'Pendente', 'Pago', 'Entregue'].map(f => (
                    <button key={f} onClick={() => setPedidoFilter(f)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${pedidoFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPedidos.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pedido {pedidoFilter !== 'Todos' ? pedidoFilter.toLowerCase() : ''}</p>
                </div>
              ) : (
                <div className="content-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="table-head">
                          <th className="table-th text-left">Aluno</th>
                          <th className="table-th text-left">Material</th>
                          <th className="table-th text-center">Qtd</th>
                          <th className="table-th text-right hidden sm:table-cell">Total</th>
                          <th className="table-th text-center">Status</th>
                          <th className="table-th text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredPedidos.map(p => {
                          const user = p.loja_usuarios as { nome: string; username: string } | undefined;
                          const mat = p.estoque_materiais as { nome: string; tipo: string; disciplina: string } | undefined;
                          return (
                            <tr key={p.id} className="table-row">
                              <td className="table-td">
                                <p className="font-medium text-sm text-foreground">{user?.nome || '—'}</p>
                                <p className="text-xs text-muted-foreground">@{user?.username || '—'}</p>
                              </td>
                              <td className="table-td">
                                <p className="font-medium text-sm text-foreground">{mat?.nome || '—'}</p>
                                {mat?.disciplina && <p className="text-xs text-muted-foreground">{mat.disciplina}</p>}
                              </td>
                              <td className="table-td text-center font-semibold">{p.quantidade}</td>
                              <td className="table-td text-right hidden sm:table-cell font-semibold">{fmt(p.valor_total)}</td>
                              <td className="table-td text-center">
                                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${PEDIDO_STATUS_COLOR[p.status] || 'bg-muted text-muted-foreground'}`}>
                                  {PEDIDO_STATUS_ICON[p.status]}{p.status}
                                </span>
                              </td>
                              <td className="table-td">
                                <div className="flex gap-1 justify-center">
                                  {p.status === 'Pendente' && (
                                    <Button size="sm" onClick={() => confirmPagamento(p.id)}
                                      className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                                      <CheckCircle2 className="w-3 h-3" />Pago
                                    </Button>
                                  )}
                                  {p.status === 'Pago' && (
                                    <Button size="sm" onClick={() => marcarEntregue(p.id)}
                                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                      <Truck className="w-3 h-3" />Entregue
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USUÁRIOS ── */}
          {activeSection === 'usuarios' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{usuarios.length} aluno(s) cadastrado(s) na loja</p>
              {usuarios.length === 0 ? (
                <div className="empty-state">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum aluno cadastrado na loja ainda</p>
                  <p className="text-sm mt-1">Compartilhe o link da loja para que os alunos se cadastrem</p>
                </div>
              ) : (
                <div className="content-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="table-head">
                          <th className="table-th text-left">Nome</th>
                          <th className="table-th text-left">Usuário</th>
                          <th className="table-th text-center hidden sm:table-cell">Pedidos</th>
                          <th className="table-th text-center hidden md:table-cell">Cadastrado em</th>
                          <th className="table-th text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {usuarios.map(u => (
                          <tr key={u.id} className="table-row">
                            <td className="table-td font-medium">{u.nome}</td>
                            <td className="table-td text-muted-foreground font-mono text-sm">@{u.username}</td>
                            <td className="table-td text-center hidden sm:table-cell">
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                                {pedidos.filter(p => p.usuario_id === u.id).length}
                              </span>
                            </td>
                            <td className="table-td text-center text-xs text-muted-foreground hidden md:table-cell">
                              {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="table-td text-center">
                              <button onClick={() => deleteUser(u.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EstoqueTab;
