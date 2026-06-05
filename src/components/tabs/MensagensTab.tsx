import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MessageCircle, Send, CheckCheck, Clock, Search, RefreshCw, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Mensagem {
  id: string;
  aluno_id: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  resposta: string | null;
  respondida_em: string | null;
  aluno_nome: string;
  aluno_matricula: string;
}

export default function MensagensTab() {
  const { coordenadorId } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'respondidas'>('pendentes');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!coordenadorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('observacoes_portal')
      .select('*, alunos(nome, matricula)')
      .eq('coordenador_id', coordenadorId)
      .order('created_at', { ascending: false });

    if (error) { toast.error('Erro ao carregar mensagens'); setLoading(false); return; }
    const rows: Mensagem[] = (data || []).map((r) => {
      const aluno = r.alunos as { nome?: string; matricula?: string } | null;
      return {
        id: r.id,
        aluno_id: r.aluno_id,
        mensagem: r.mensagem,
        lida: r.lida ?? false,
        created_at: r.created_at,
        resposta: (r as { resposta?: string | null }).resposta ?? null,
        respondida_em: (r as { respondida_em?: string | null }).respondida_em ?? null,
        aluno_nome: aluno?.nome || 'Aluno desconhecido',
        aluno_matricula: aluno?.matricula || '',
      };
    });
    setMensagens(rows);
    setLoading(false);
  }, [coordenadorId]);

  useEffect(() => { load(); }, [load]);

  const handleResponder = async (id: string) => {
    const texto = respostas[id]?.trim();
    if (!texto) { toast.error('Escreva uma resposta antes de enviar'); return; }
    setEnviando(id);
    try {
      await supabase
        .from('observacoes_portal')
        .update({ resposta: texto, respondida_em: new Date().toISOString(), lida: true })
        .eq('id', id);
      toast.success('Resposta enviada!');
      setRespostas(r => { const c = { ...r }; delete c[id]; return c; });
      setExpandido(null);
      load();
    } catch { toast.error('Erro ao enviar resposta'); }
    finally { setEnviando(null); }
  };

  const handleMarcarLida = async (id: string) => {
    await supabase.from('observacoes_portal').update({ lida: true }).eq('id', id);
    setMensagens(ms => ms.map(m => m.id === id ? { ...m, lida: true } : m));
  };

  const filtradas = mensagens.filter(m => {
    const matchBusca = !busca || m.aluno_nome.toLowerCase().includes(busca.toLowerCase()) || m.aluno_matricula.includes(busca);
    const matchFiltro = filtro === 'todas' ? true : filtro === 'pendentes' ? !m.resposta : !!m.resposta;
    return matchBusca && matchFiltro;
  });

  const pendentesCount = mensagens.filter(m => !m.resposta).length;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{mensagens.length}</p>
          <p className="text-xs text-muted-foreground font-semibold mt-1">TOTAL</p>
        </div>
        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendentesCount}</p>
          <p className="text-xs text-amber-500 font-semibold mt-1">SEM RESPOSTA</p>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{mensagens.filter(m => !!m.resposta).length}</p>
          <p className="text-xs text-green-500 font-semibold mt-1">RESPONDIDAS</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['pendentes', 'todas', 'respondidas'] as const).map(f => (
            <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'}
              onClick={() => setFiltro(f)} className="capitalize text-xs">
              {f === 'pendentes' ? `Pendentes${pendentesCount > 0 ? ` (${pendentesCount})` : ''}` : f === 'todas' ? 'Todas' : 'Respondidas'}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Messages list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-40" />
          <p className="text-sm">Carregando mensagens...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-muted/30">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20 text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">
            {filtro === 'pendentes' ? 'Nenhuma mensagem pendente' : 'Nenhuma mensagem encontrada'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filtro === 'pendentes' ? 'Todas as mensagens foram respondidas!' : 'Tente ajustar o filtro ou a busca'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtradas.map(m => {
            const isOpen = expandido === m.id;
            const hasResp = !!m.resposta;
            return (
              <div key={m.id} className={`rounded-xl border bg-card overflow-hidden transition-all ${!m.lida && !hasResp ? 'border-amber-300 bg-amber-50/50' : 'border-border'}`}>
                {/* Header row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setExpandido(isOpen ? null : m.id);
                    if (!m.lida) handleMarcarLida(m.id);
                  }}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{m.aluno_nome}</span>
                      {m.aluno_matricula && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{m.aluno_matricula}</span>
                      )}
                      {!m.lida && !hasResp && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">Nova</span>
                      )}
                      {hasResp && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold border border-green-200 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" />Respondida
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.mensagem}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">{fmtDate(m.created_at)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border">
                    {/* Student message */}
                    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />Mensagem do aluno — {fmtDate(m.created_at)}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">{m.mensagem}</p>
                    </div>

                    {/* Existing reply */}
                    {hasResp && (
                      <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" />Sua resposta — {m.respondida_em ? fmtDate(m.respondida_em) : ''}
                        </p>
                        <p className="text-sm text-green-900 leading-relaxed">{m.resposta}</p>
                        <button
                          onClick={() => setRespostas(r => ({ ...r, [m.id]: m.resposta || '' }))}
                          className="mt-2 text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
                        >
                          Editar resposta
                        </button>
                      </div>
                    )}

                    {/* Reply form */}
                    {(!hasResp || respostas[m.id] !== undefined) && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                          <Send className="w-3 h-3" />{hasResp ? 'Editar resposta' : 'Responder ao aluno'}
                        </p>
                        <textarea
                          value={respostas[m.id] ?? ''}
                          onChange={e => setRespostas(r => ({ ...r, [m.id]: e.target.value }))}
                          rows={3}
                          placeholder="Digite sua resposta para o aluno..."
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <button
                            onClick={() => { setRespostas(r => { const c = { ...r }; delete c[m.id]; return c; }); }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                          <Button
                            size="sm"
                            onClick={() => handleResponder(m.id)}
                            disabled={enviando === m.id || !respostas[m.id]?.trim()}
                          >
                            {enviando === m.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Send className="w-3.5 h-3.5 mr-1" />
                            )}
                            Enviar Resposta
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* If responded and no edit mode */}
                    {hasResp && respostas[m.id] === undefined && (
                      <div className="mt-2 text-center">
                        <Clock className="w-3 h-3 inline mr-1 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          O aluno já pode ver esta resposta no portal
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
