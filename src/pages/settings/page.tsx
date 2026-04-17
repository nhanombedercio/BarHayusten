import { useState } from 'react';
import TopBar from '@/components/feature/TopBar';
import BarInfoSettings from './components/BarInfoSettings';
import WarehouseSettings from './components/WarehouseSettings';
import UserSettings from './components/UserSettings';
import BackupSettings from './components/BackupSettings';

type SettingsTab = 'bar' | 'warehouses' | 'users' | 'backup';

const tabs: { key: SettingsTab; label: string; icon: string; desc: string }[] = [
  { key: 'bar', label: 'Dados do Bar', icon: 'ri-store-2-line', desc: 'Nome, localização, moeda e regras' },
  { key: 'warehouses', label: 'Armazéns', icon: 'ri-archive-2-line', desc: 'Locais de armazenamento de stock' },
  { key: 'users', label: 'Utilizadores', icon: 'ri-team-line', desc: 'Contas e permissões por perfil' },
  { key: 'backup', label: 'Backup & Restauro', icon: 'ri-shield-check-line', desc: 'Exportar e restaurar dados' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('bar');

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Configurações" subtitle="Configuração geral do sistema Hayusten BarOne" />
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Settings Sidebar */}
        <div className="w-64 bg-white border-r border-gray-100 flex-shrink-0 p-4 space-y-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all cursor-pointer ${activeTab === t.key ? 'border' : 'hover:bg-gray-50 border border-transparent'}`}
              style={activeTab === t.key ? { background: 'rgba(30,159,212,0.06)', borderColor: 'rgba(30,159,212,0.3)' } : {}}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                style={activeTab === t.key ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : { background: '#f3f4f6' }}>
                <i className={`${t.icon} text-sm ${activeTab === t.key ? 'text-white' : 'text-gray-500'}`}></i>
              </div>
              <div>
                <p className="text-sm font-semibold" style={activeTab === t.key ? { color: '#1E9FD4' } : { color: '#374151' }}>{t.label}</p>
                <p className="text-gray-400 text-xs leading-tight">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            {activeTab === 'bar' && <BarInfoSettings />}
            {activeTab === 'warehouses' && <WarehouseSettings />}
            {activeTab === 'users' && <UserSettings />}
            {activeTab === 'backup' && <BackupSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
