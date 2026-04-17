import { useState, useEffect, useCallback } from 'react';
import { BarSettings } from '@/mocks/settings';
import { db, onCacheChange } from '@/store/db';

export default function BarInfoSettings() {
  const [settings, setSettings] = useState<BarSettings>(() => db.getBarSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const syncFromCache = useCallback(() => {
    setSettings(db.getBarSettings());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const handleSave = async () => {
    setSaving(true);
    await db.setBarSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 font-semibold text-base mb-1">Dados do Bar</h3>
        <p className="text-gray-500 text-sm">Informações gerais do estabelecimento</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nome do Bar</label>
          <input value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Localização</label>
          <input value={settings.location} onChange={e => setSettings(s => ({ ...s, location: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Moeda</label>
          <select value={settings.currency} onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400">
            <option value="MZN">MZN — Metical Moçambicano</option>
            <option value="USD">USD — Dólar Americano</option>
            <option value="EUR">EUR — Euro</option>
            <option value="ZAR">ZAR — Rand Sul-Africano</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Símbolo da Moeda</label>
          <input value={settings.currencySymbol} onChange={e => setSettings(s => ({ ...s, currencySymbol: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
            placeholder="Ex: MZN, MT, $" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <h4 className="text-gray-800 font-semibold text-sm mb-4">Regras Operacionais</h4>
        <div className="space-y-4">
          {[
            { key: 'allowNegativeStock', label: 'Permitir stock negativo', desc: 'Permite vender produtos mesmo sem stock disponível' },
            { key: 'allowDiscounts', label: 'Permitir descontos', desc: 'Habilita a aplicação de descontos nas vendas' },
            { key: 'tableManagement', label: 'Gestão por mesa', desc: 'Ativa o módulo de gestão de mesas e pedidos' },
            { key: 'personManagement', label: 'Gestão por pessoa', desc: 'Permite associar pedidos a pessoas específicas dentro de uma mesa' },
            { key: 'requirePendingReason', label: 'Motivo obrigatório para pendentes', desc: 'Exige justificação ao marcar uma conta como pendente' },
          ].map(rule => (
            <div key={rule.key} className="flex items-center justify-between py-3 border-b border-gray-50">
              <div>
                <p className="text-gray-800 text-sm font-medium">{rule.label}</p>
                <p className="text-gray-400 text-xs">{rule.desc}</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, [rule.key]: !s[rule.key as keyof BarSettings] }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${settings[rule.key as keyof BarSettings] ? 'bg-amber-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings[rule.key as keyof BarSettings] ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
              </button>
            </div>
          ))}

          {settings.allowDiscounts && (
            <div className="pl-4 border-l-2 border-amber-200">
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Desconto máximo permitido (%)</label>
              <input type="number" min={0} max={100} value={settings.maxDiscountPercent}
                onChange={e => setSettings(s => ({ ...s, maxDiscountPercent: parseInt(e.target.value) || 0 }))}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-all disabled:opacity-60 ${saved ? 'bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
          {saving ? <><i className="ri-loader-4-line animate-spin"></i> A guardar...</>
            : saved ? <><i className="ri-check-line"></i> Guardado!</>
            : <><i className="ri-save-line"></i> Guardar Alterações</>}
        </button>
      </div>
    </div>
  );
}
