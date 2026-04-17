import { products, getStockAlert } from '@/mocks/products';
import { pendingOrders } from '@/mocks/tables';

export default function AlertsPanel() {
  const alertProducts = products.filter(p => getStockAlert(p) !== 'ok').slice(0, 5);
  const alertLabel: Record<string, string> = { low: 'Baixo', critical: 'Crítico', out: 'Esgotado' };
  const alertColor: Record<string, string> = { low: 'text-amber-600 bg-amber-50', critical: 'text-red-600 bg-red-50', out: 'text-red-700 bg-red-100' };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #1E9FD4, #00C8C8)' }}></div>
        <h3 className="text-gray-900 font-semibold text-sm">Alertas</h3>
      </div>
      <div className="space-y-2 mb-4">
        {alertProducts.map(p => {
          const level = getStockAlert(p);
          return (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
              <div>
                <p className="text-gray-800 text-sm font-medium">{p.name}</p>
                <p className="text-gray-400 text-xs">{p.stock} {p.unit} restantes</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alertColor[level]}`}>{alertLabel[level]}</span>
            </div>
          );
        })}
      </div>
      {pendingOrders.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#c47d00' }}>{pendingOrders.length} Conta(s) Pendente(s)</p>
          {pendingOrders.slice(0, 2).map(o => (
            <div key={o.id} className="flex justify-between text-xs" style={{ color: '#c47d00' }}>
              <span>{o.personName || 'Cliente'}</span>
              <span className="font-bold">MZN {(o.total - o.paid).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
