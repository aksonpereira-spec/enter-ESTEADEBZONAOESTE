import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NucleoConfig } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Building2, User, Users, Settings, Download, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigTabProps {
  onConfigChange: (config: NucleoConfig) => void;
}

const ConfigTab = ({ onConfigChange }: ConfigTabProps) => {
  const [config, setConfig] = useState<NucleoConfig>({
    id: '', nomeNucleo: '', coordenadorNome: '', coordenadorEsposaNome: '', ano: new Date().getFullYear(),
  });
  const [form, setForm] = useState({
    nomeNucleo: '', coordenadorNome: '', coordenadorEsposaNome: '', ano: String(new Date().getFullYear()),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('nucleo_config').select('*').limit(1).maybeSingle();
      if (data) {
        const cfg: NucleoConfig = {
          id: data.id, nomeNucleo: data.nome_nucleo ?? '',
          coordenadorNome: data.coordenador_nome ?? '',
          coordenadorEsposaNome: data.coordenador_esposa_nome ?? '',
          ano: data.ano ?? new Date().getFullYear(),
        };
        setConfig(cfg);
        setForm({
          nomeNucleo: cfg.nomeNucleo, coordenadorNome: cfg.coordenadorNome,
          coordenadorEsposaNome: cfg.coordenadorEsposaNome, ano: String(cfg.ano),
        });
        onConfigChange(cfg);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      nome_nucleo: form.nomeNucleo.trim(),
      coordenador_nome: form.coordenadorNome.trim(),
      coordenador_esposa_nome: form.coordenadorEsposaNome.trim(),
      ano: parseInt(form.ano) || new Date().getFullYear(),
    };
    let error;
    if (config.id) {
      ({ error } = await supabase.from('nucleo_config').update(payload).eq('id', config.id));
    } else {
      const res = await supabase.from('nucleo_config').insert(payload).select().maybeSingle();
      error = res.error;
      if (res.data) setConfig(p => ({ ...p, id: res.data.id }));
    }
    if (error) { toast.error('Erro ao salvar: ' + error.message); }
    else {
      const newCfg: NucleoConfig = { ...config, ...form, ano: parseInt(form.ano) || new Date().getFullYear() };
      setConfig(newCfg);
      onConfigChange(newCfg);
      toast.success('Configurações salvas com sucesso!');
    }
    setSaving(false);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const [alunos, turmas, mensalidades, chamadas, registros, nucleoConfig] = await Promise.all([
        supabase.from('alunos').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('mensalidades').select('*'),
        supabase.from('attendance_sessions').select('*'),
        supabase.from('attendance_records').select('*'),
        supabase.from('nucleo_config').select('*'),
      ]);
      const backup = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          alunos: alunos.data || [],
          turmas: turmas.data || [],
          mensalidades: mensalidades.data || [],
          chamadas: chamadas.data || [],
          registros_presenca: registros.data || [],
          nucleo_config: nucleoConfig.data || [],
        },
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-esteadeb-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup gerado e salvo com sucesso!');
    } catch {
      toast.error('Erro ao gerar backup');
    }
    setBackingUp(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="loading-spinner" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Preview */}
      <div className="content-card p-5 bg-primary/5 border-primary/20">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Visualização da Tela Inicial</p>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{form.nomeNucleo || 'Nome do Núcleo'}</p>
            {form.coordenadorNome && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5" />Coord: <strong className="text-foreground">{form.coordenadorNome}</strong>
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 italic">
          Estas informações aparecem no cabeçalho e na barra lateral do sistema.
        </p>
      </div>

      {/* Form */}
      <div className="content-card p-6 border-l-4 border-l-primary">
        <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />Dados do Núcleo e Coordenação
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="form-label flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />Nome do Núcleo *
            </label>
            <Input className="form-input" placeholder="Ex: Zona Oeste" value={form.nomeNucleo}
              onChange={e => setForm(p => ({ ...p, nomeNucleo: e.target.value }))} />
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />Nome do Coordenador
            </label>
            <Input className="form-input" placeholder="Nome completo do coordenador"
              value={form.coordenadorNome}
              onChange={e => setForm(p => ({ ...p, coordenadorNome: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">Aparecerá no cabeçalho do sistema</p>
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />Nome da Esposa do Coordenador
            </label>
            <Input className="form-input" placeholder="Nome completo"
              value={form.coordenadorEsposaNome}
              onChange={e => setForm(p => ({ ...p, coordenadorEsposaNome: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Ano Letivo</label>
            <Input className="form-input" type="number" min="2020" max="2099" placeholder="2026"
              value={form.ano}
              onChange={e => setForm(p => ({ ...p, ano: e.target.value }))} />
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-border">
          <Button onClick={save} disabled={saving} className="btn-primary gap-2">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            As alterações são aplicadas imediatamente em toda a interface.
          </p>
        </div>
      </div>

      {/* Backup */}
      <div className="content-card p-6 border-l-4 border-l-emerald-500">
        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />Backup dos Dados
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Gere um arquivo JSON com todos os dados do sistema: alunos, turmas, mensalidades, chamadas e registros de presença.
          Guarde este arquivo em local seguro como cópia de segurança.
        </p>
        <Button onClick={handleBackup} disabled={backingUp} variant="outline"
          className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300">
          {backingUp
            ? <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
            : <Download className="w-4 h-4" />}
          {backingUp ? 'Gerando backup...' : 'Baixar Backup Completo (JSON)'}
        </Button>
      </div>

      {/* Info */}
      <div className="content-card p-4 bg-amber-50 border-amber-200">
        <h4 className="text-sm font-semibold text-amber-800 mb-2">Coordenador e Esposa como Bolsistas</h4>
        <p className="text-xs text-amber-700">
          Para marcar o coordenador e sua esposa como bolsistas, vá até a aba <strong>Cadastro de Alunos</strong>,
          edite o aluno e selecione o campo <strong>Tipo / Bolsa</strong> como <strong>Coordenador</strong> ou
          <strong> Esposa do Coordenador</strong>. Isso já foi feito automaticamente para os alunos cadastrados da planilha.
        </p>
      </div>
    </div>
  );
};

export default ConfigTab;
