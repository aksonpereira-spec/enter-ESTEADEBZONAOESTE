import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, Wifi, WifiOff, Clock, Users, TrendingUp, RefreshCw, Monitor, Smartphone } from 'lucide-react';

interface Acesso {
  id: string;
  aluno_id: string;
  nome: string;
  matricula: string;
  turma_nome: string;
  login_em: string;
  ultimo_heartbeat: string;
  logout_em: string | null;
  online: boolean;
  dispositivo: string;
}

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

function isOnlineNow(a: Acesso): boolean {
  if (!a.online) return false;
  const last = new Date(a.ultimo_heartbeat).getTime();
  return Date.now() - last < ONLINE_THRESHOLD_MS;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function isMobileDevice(ua: string) {
  return /mobile|android|iphone|ipad/i.test(ua);
}

export default function MonitoramentoTab() {
  const { coordenadorId } = useAuth();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter] = useState<'todos' | 'online' | 'hoje' | 'semana'>('online');
  const [now, setNow] = useState(Date.now());

  // Tick every 30s to update "X min atrás" labels
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    if (!coordenadorId) return;
    setLoading(true);
    const since = filter === 'semana'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : filter === 'hoje'
        ? new Date(Date.now() - 86400000).toISOString()
        : new Date(Date.now() - 3 * 86400000).toISOString();

    const { data } = await supabase
      .from('portal_acessos')
      .select('*')
      .eq('coordenador_id', coordenadorId)
      .gte('login_em', since)
      .order('login_em', { ascending: false })
      .limit(200);

    setAcessos((data || []) as Acesso[]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [filter, coordenadorId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('portal_acessos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_acessos' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const onlineNow = acessos.filter(isOnlineNow);
  const filteredAcessos = filter === 'online' ? onlineNow : acessos;
  const hojeCount = acessos.filter(a => Date.now() - new Date(a.login_em).getTime() < 86400000).length;
  const semanaCount = acessos.filter(a => Date.now() - new Date(a.login_em).getTime() < 7 * 86400000).length;

  const FILTERS = [
    { id: 'online' as const, label: 'Online Agora', count: onlineNow.length },
    { id: 'hoje' as const, label: 'Hoje', count: hojeCount },
    { id: 'semana' as const, label: '7 dias', count: semanaCount },
    { id: 'todos' as const, label: 'Todos', count: acessos.length },
  ];

  return (
    <div>
      {/* ── Header stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<Wifi className="w-4 h-4" />} value={onlineNow.length} label="Online Agora" color="#16a34a" pulse />
        <StatCard icon={<Activity className="w-4 h-4" />} value={hojeCount} label="Logins Hoje" color="#2563eb" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} value={semanaCount} label="Esta Semana" color="#7c3aed" />
        <StatCard icon={<Users className="w-4 h-4" />} value={acessos.length} label="Registros" color="#0891b2" />
      </div>

      {/* ── Filter bar + refresh ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                background: filter === f.id ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: filter === f.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))' }}>
              {f.label}
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            Atualizado: {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button onClick={load} disabled={loading}
            style={{ background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── Online "agora" badges ── */}
      {filter === 'online' && onlineNow.length > 0 && (
        <div className="app-card" style={{ marginBottom: 14, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', marginBottom: 10 }}>
            Conectados Agora — {onlineNow.length} aluno{onlineNow.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {onlineNow.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 24, padding: '6px 12px 6px 8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#14532d', lineHeight: 1.2 }}>{a.nome.split(' ')[0]} {a.nome.split(' ')[1] || ''}</p>
                  <p style={{ fontSize: 10, color: '#166534' }}>{a.matricula}{a.turma_nome ? ` · ${a.turma_nome}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filter === 'online' && onlineNow.length === 0 && !loading && (
        <div className="app-card" style={{ padding: 32, textAlign: 'center', marginBottom: 14 }}>
          <WifiOff size={32} style={{ color: 'hsl(var(--muted-foreground))', margin: '0 auto 8px' }} />
          <p style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Nenhum aluno online</p>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Aguardando conexões em tempo real...</p>
        </div>
      )}

      {/* ── Table ── */}
      {filteredAcessos.length > 0 && (
        <div className="app-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'hsl(var(--muted))' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Aluno</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Login</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Último acesso</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Dispositivo</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAcessos.map((a, i) => {
                const online = isOnlineNow(a);
                return (
                  <tr key={a.id} style={{ borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none', background: online ? 'rgba(22,163,74,0.04)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <p style={{ fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.3 }}>{a.nome}</p>
                      <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{a.matricula}{a.turma_nome ? ` · ${a.turma_nome}` : ''}</p>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'hsl(var(--foreground))', whiteSpace: 'nowrap' }}>
                      <p style={{ fontSize: 12 }}>{formatDateTime(a.login_em)}</p>
                      <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{formatTimeAgo(a.login_em)}</p>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <p style={{ fontSize: 12, color: 'hsl(var(--foreground))' }}>{formatDateTime(a.ultimo_heartbeat)}</p>
                      <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{formatTimeAgo(a.ultimo_heartbeat)}</p>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {isMobileDevice(a.dispositivo)
                        ? <Smartphone size={15} style={{ color: 'hsl(var(--muted-foreground))' }} title="Mobile" />
                        : <Monitor size={15} style={{ color: 'hsl(var(--muted-foreground))' }} title="Desktop" />}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {online ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          Online
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                          <Clock size={10} />
                          {a.logout_em ? 'Saiu' : 'Inativo'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--muted-foreground))' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <p>Carregando acessos...</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatCard({ icon, value, label, color, pulse }: { icon: React.ReactNode; value: number; label: string; color: string; pulse?: boolean }) {
  return (
    <div className="app-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
        {pulse && value > 0 && (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block' }} />
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'hsl(var(--foreground))', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{label}</p>
    </div>
  );
}
