# Monitoramento de Acessos do Portal do Aluno

## Objetivo
Permitir ao coordenador ver em tempo real quem está logado no portal do aluno e o histórico de acessos recentes, para acompanhar se os alunos estão utilizando o sistema.

## Abordagem

### 1. Nova tabela: `portal_acessos`
Registra cada sessão de acesso ao portal do aluno.

```sql
CREATE TABLE portal_acessos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  matricula TEXT NOT NULL,
  turma_nome TEXT DEFAULT '',
  login_em TIMESTAMPTZ DEFAULT now(),
  ultimo_heartbeat TIMESTAMPTZ DEFAULT now(),
  logout_em TIMESTAMPTZ DEFAULT NULL,
  online BOOLEAN DEFAULT TRUE,
  dispositivo TEXT DEFAULT ''
);
```

Habilitar Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE "portal_acessos";`

### 2. Modificações em `src/pages/PortalAluno.tsx`
- **No `handleLogin`**: após login bem-sucedido → `INSERT` em `portal_acessos`, salvar `acessoId` no estado e no `localStorage`
- **No `useEffect` de inicialização**: se restaurar sessão do `localStorage` → `INSERT` novo acesso (reentrada)
- **Heartbeat**: `useInterval` de 60 segundos → `UPDATE ultimo_heartbeat = now()` enquanto logado
- **No `handleLogout` e `useEffect` de unmount**: `UPDATE online = false, logout_em = now()`

### 3. Novo arquivo: `src/components/tabs/MonitoramentoTab.tsx`
Painel do coordenador com:
- **Online agora**: alunos com `online = true` AND `ultimo_heartbeat > now() - 3 min` (pulsando verde)
- **Histórico**: últimos acessos (24h / 7 dias) com data/hora de login e logout
- **Stats**: total online, logins hoje, logins na semana
- **Realtime**: subscription no canal `portal_acessos` para atualizar a lista sem refresh
- **Filtros**: todos / online agora / por turma

### 4. Modificações em `src/pages/MainApp.tsx`
- Adicionar import `Activity` do lucide-react
- Adicionar tab `acessos` com label "Monitoramento" no array `TABS`
- Importar e renderizar `<MonitoramentoTab />`

## Arquivos modificados
- `supabase/migrations/` — nova tabela + RLS + realtime
- `src/pages/PortalAluno.tsx` — login/logout/heartbeat
- `src/components/tabs/MonitoramentoTab.tsx` — novo componente
- `src/pages/MainApp.tsx` — nova tab
