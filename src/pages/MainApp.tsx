import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Users, Building2, CreditCard, ClipboardCheck, GraduationCap, Menu, X, ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AlunosTab from '@/components/tabs/AlunosTab';
import TurmasTab from '@/components/tabs/TurmasTab';
import MensalidadeTab from '@/components/tabs/MensalidadeTab';
import ChamadaTab from '@/components/tabs/ChamadaTab';
import FinanceiroTab from '@/components/tabs/FinanceiroTab';

type Tab = 'alunos' | 'turmas' | 'mensalidade' | 'chamada' | 'financeiro';

const TABS = [
  { id: 'alunos' as Tab, label: 'Cadastro de Alunos', icon: Users, desc: 'Gerencie os alunos cadastrados' },
  { id: 'turmas' as Tab, label: 'Turmas', icon: Building2, desc: 'Cadastre e organize as turmas' },
  { id: 'mensalidade' as Tab, label: 'Mensalidade', icon: CreditCard, desc: 'Controle de pagamentos' },
  { id: 'chamada' as Tab, label: 'Chamada', icon: ClipboardCheck, desc: 'Lista de presença' },
  { id: 'financeiro' as Tab, label: 'Financeiro', icon: BarChart3, desc: 'Resumo financeiro e comissões' },
];

const MainApp = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('alunos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const CurrentIcon = currentTab.icon;

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      {/* ─── Top Header ─────────────────────────────────────── */}
      <header className="app-header sticky top-0 z-40 h-16 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src="/logo-esteadeb.png" alt="Esteadeb" className="h-8 w-auto object-contain" />
          <div className="hidden sm:block h-6 w-px bg-white/20" />
          <span className="hidden sm:block text-white/70 text-sm font-medium">Sistema de Gestão</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:block text-white/60 text-xs mr-2">
            <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
            ESTEADEB
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 text-xs h-8"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Sidebar ────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 app-sidebar pt-16 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:pt-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full py-4 overflow-y-auto">
            <div className="px-4 mb-4 hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted mb-1">Navegação</p>
            </div>
            <nav className="flex-1 px-3 space-y-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                    className={`sidebar-nav-item w-full ${isActive ? 'active' : ''}`}
                  >
                    <div className={`sidebar-nav-icon ${isActive ? 'active' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium leading-tight">{tab.label}</div>
                      <div className="text-xs opacity-60 mt-0.5 leading-tight hidden lg:block">{tab.desc}</div>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />}
                  </button>
                );
              })}
            </nav>

            {/* Footer info */}
            <div className="mt-auto px-4 pt-4 border-t border-sidebar-border">
              <div className="text-xs text-sidebar-muted space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <span>Banco conectado</span>
                </div>
                <p className="text-xs leading-tight">Escola Teológica das<br/>Assembleias de Deus no Brasil</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ─── Main Content ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-header flex items-center gap-3 px-4 lg:px-8 py-5">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <CurrentIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{currentTab.label}</h1>
              <p className="text-sm text-muted-foreground">{currentTab.desc}</p>
            </div>
          </div>

          <div className="px-4 lg:px-8 pb-8">
            {activeTab === 'alunos' && <AlunosTab />}
            {activeTab === 'turmas' && <TurmasTab />}
            {activeTab === 'mensalidade' && <MensalidadeTab />}
            {activeTab === 'chamada' && <ChamadaTab />}
            {activeTab === 'financeiro' && <FinanceiroTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainApp;
