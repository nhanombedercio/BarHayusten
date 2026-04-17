import { tables } from '@/mocks/tables';

export default function RecentOrders() {
  const activeOrders = tables
    .filter(t => t.orders.length > 0)
    .flatMap(t => t.orders.map(o => ({ ...o, tableNumber: t.number })))
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-gray-900 font-semibold text-sm mb-4">Pedidos Ativos</h3>
      {activeOrders.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Sem pedidos ativos</p>
      ) : (
        <div className="space-y-2">
          {activeOrders.map(order => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="text-gray-800 text-sm font-medium">
                  Mesa {order.tableNumber}{order.personName ? ` — ${order.personName}` : ''}
                </p>
                <p className="text-gray-400 text-xs">{order.items.length} item(s) · {order.waiter}</p>
              </div>
              <span className="text-gray-900 font-bold text-sm">MZN {order.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
