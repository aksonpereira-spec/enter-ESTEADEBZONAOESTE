# Plan: Portal do Aluno — Redesign + Senha + Página Inicial

## Context
- User wants: modern dark navy/gold theme, password in student portal, welcome page as default

## 1. Database Migration
```sql
ALTER TABLE alunos
  ADD COLUMN IF NOT EXISTS senha_portal TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS senha_definida BOOLEAN DEFAULT FALSE;
```

## 2. Design System (src/index.css)
- Add `--gold: 43 90% 55%` token
- Add `.portal-*` classes with deep dark blue (hsl(222 60% 8%)) background
- Add `.gold-text` and `.gold-btn` utilities
- Portal background: dark navy (#080d1c), cards: slightly lighter (#0f1728)
- Primary stays blue, accents become gold for portal

## 3. PortalAluno.tsx — Full Rewrite

### Auth Flow (3 screens):
1. **Login**: matricula + password field. If senha_definida=false → accept when password=matricula. If senha_definida=true → validate against senha_portal.
2. **ForceChangePassword** (new screen shown once after first login with matricula):
   - "Defina sua senha pessoal" 
   - Two fields: nova senha + confirmar senha
   - Saves to `alunos.senha_portal`, sets `senha_definida=true`
   - Then proceeds to portal
3. **Portal** (logged in state)

### Portal Structure (after login):
- Default tab: `'inicio'` (welcome page, NOT ficha)
- Tabs: Início | Notas | Calendário | Minha Ficha | Documentos

### Welcome Screen (Início tab):
```
┌─────────────────────────────────────────┐
│ Bem-vindo, [Nome]!          [Turma]     │
│ Matrícula: XXXXXXX                      │
│                                         │
│  ┌───────────┐ ┌───────────┐            │
│  │ Notas     │ │ Calendário│            │
│  │ X disc.   │ │ Próx aula │            │
│  └───────────┘ └───────────┘            │
│  ┌───────────┐ ┌───────────┐            │
│  │ Minha     │ │ Documentos│            │
│  │ Ficha     │ │ X arquivos│            │
│  └───────────┘ └───────────┘            │
└─────────────────────────────────────────┘
```
- Hero with ESTEADEB dark navy + gold gradient header
- Navigation cards with icons

### Design Details:
- Portal background: `style={{ background: '#080d1c' }}`
- Header bar: dark navy with gold ESTEADEB logo text
- Cards: `#0f1728` with blue/gold border
- Active/gold accent buttons use `--gold` token
- Tab active state: gold underline

## 4. Files to Modify
- `src/index.css` — add gold token + portal classes
- `src/pages/PortalAluno.tsx` — full rewrite with 3 auth screens + welcome page
- No changes to admin side (MainApp, tabs)

## 5. Verification
- Test login with matricula (first access → force password change)
- Test login after password set → goes directly to Welcome screen
- Welcome screen shows correct name, turma, stats
- Navigation cards work to switch tabs
- Design is dark navy/black + gold accents
