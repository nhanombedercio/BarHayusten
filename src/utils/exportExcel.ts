/**
 * Export utility — generates CSV files (Excel-compatible)
 * No external dependencies needed.
 */

function escapeCSV(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCSV).join(',')];
  rows.forEach(row => lines.push(row.map(escapeCSV).join(',')));
  return '\uFEFF' + lines.join('\n'); // BOM for Excel UTF-8
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportProducts(products: { name: string; category: string; price: number; cost: number; stock: number; unit: string; warehouse: string }[]) {
  const headers = ['Nome', 'Categoria', 'Preço Venda (MZN)', 'Custo Unit. (MZN)', 'Stock', 'Unidade', 'Armazém'];
  const rows = products.map(p => [p.name, p.category, p.price.toFixed(2), p.cost.toFixed(2), p.stock, p.unit, p.warehouse]);
  download(`produtos_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export function exportMovements(movements: { createdAt: string; productName: string; type: string; quantity: number; operator: string; reason?: string }[]) {
  const typeLabels: Record<string, string> = { entry: 'Entrada', sale: 'Venda', waste: 'Desperdício', offer: 'Oferta', transfer: 'Transferência', adjustment: 'Ajuste' };
  const headers = ['Data', 'Produto', 'Tipo', 'Quantidade', 'Operador', 'Motivo'];
  const rows = movements.map(m => [
    new Date(m.createdAt).toLocaleString('pt-PT'),
    m.productName,
    typeLabels[m.type] || m.type,
    m.quantity,
    m.operator,
    m.reason || '',
  ]);
  download(`movimentos_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export function exportSales(sales: { createdAt: string; personName: string; tableName?: string; total: number; payMethod: string; status: string; operator: string }[]) {
  const payLabels: Record<string, string> = { cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência', partial: 'Parcial' };
  const statusLabels: Record<string, string> = { paid: 'Paga', draft: 'Rascunho', cancelled: 'Cancelada', reversed: 'Estornada' };
  const headers = ['Data/Hora', 'Cliente', 'Mesa', 'Total (MZN)', 'Método', 'Estado', 'Operador'];
  const rows = sales.map(s => [
    new Date(s.createdAt).toLocaleString('pt-PT'),
    s.personName || '',
    s.tableName || 'Balcão',
    s.total.toFixed(2),
    payLabels[s.payMethod] || s.payMethod,
    statusLabels[s.status] || s.status,
    s.operator,
  ]);
  download(`vendas_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export function exportDebts(debts: { clientName: string; tableName?: string; totalAmount: number; paidAmount: number; status: string; createdAt: string; dueDate?: string; notes?: string; operator: string }[]) {
  const statusLabels: Record<string, string> = { unpaid: 'Não Pago', partial: 'Parcial', paid: 'Pago' };
  const headers = ['Cliente', 'Mesa', 'Total (MZN)', 'Pago (MZN)', 'Restante (MZN)', 'Estado', 'Data', 'Vencimento', 'Operador', 'Notas'];
  const rows = debts.map(d => [
    d.clientName,
    d.tableName || '',
    d.totalAmount.toFixed(2),
    d.paidAmount.toFixed(2),
    (d.totalAmount - d.paidAmount).toFixed(2),
    statusLabels[d.status] || d.status,
    new Date(d.createdAt).toLocaleDateString('pt-PT'),
    d.dueDate ? new Date(d.dueDate).toLocaleDateString('pt-PT') : '',
    d.operator,
    d.notes || '',
  ]);
  download(`dividas_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export function exportClients(clients: { name: string; phone: string; email?: string; notes?: string; createdAt: string }[]) {
  const headers = ['Nome', 'Contacto', 'Email', 'Notas', 'Data Registo'];
  const rows = clients.map(c => [c.name, c.phone, c.email || '', c.notes || '', new Date(c.createdAt).toLocaleDateString('pt-PT')]);
  download(`clientes_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export function exportCashMovements(movements: { createdAt: string; type: string; amount: number; description: string; paymentMethod: string; category: string; operator: string }[]) {
  const payLabels: Record<string, string> = { cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência' };
  const headers = ['Data/Hora', 'Tipo', 'Valor (MZN)', 'Descrição', 'Método', 'Categoria', 'Operador'];
  const rows = movements.map(m => [
    new Date(m.createdAt).toLocaleString('pt-PT'),
    m.type === 'in' ? 'Entrada' : 'Saída',
    m.amount.toFixed(2),
    m.description,
    payLabels[m.paymentMethod] || m.paymentMethod,
    m.category,
    m.operator,
  ]);
  download(`caixa_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

export interface ShiftReportData {
  shift: {
    openedBy: string;
    openedAt: string;
    closedBy?: string;
    closedAt?: string;
    openingBalance: number;
    expectedBalance: number;
    countedBalance: number;
    difference: number;
    unpaidOrdersCount: number;
    unpaidOrdersTotal: number;
  };
  movements: { createdAt: string; type: string; amount: number; description: string; paymentMethod: string; category: string; operator: string }[];
  noteCounts?: { denomination: number; count: number; label: string }[];
  notes?: string;
  totalIn: number;
  totalOut: number;
  cashIn: number;
  cardIn: number;
  mobileIn: number;
  transferIn: number;
}

export function exportShiftReportCSV(data: ShiftReportData) {
  const payLabels: Record<string, string> = { cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência' };
  const lines: string[] = [];

  lines.push('RELATÓRIO DE FECHO DE CAIXA');
  lines.push(`Data,${new Date(data.shift.openedAt).toLocaleDateString('pt-PT')}`);
  lines.push(`Aberto por,${data.shift.openedBy}`);
  lines.push(`Hora Abertura,${new Date(data.shift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`);
  lines.push(`Fechado por,${data.shift.closedBy || ''}`);
  lines.push(`Hora Fecho,${data.shift.closedAt ? new Date(data.shift.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}`);
  lines.push('');
  lines.push('RESUMO FINANCEIRO');
  lines.push(`Saldo Abertura,MT ${data.shift.openingBalance.toFixed(2)}`);
  lines.push(`Total Entradas,MT ${data.totalIn.toFixed(2)}`);
  lines.push(`Total Saídas,MT ${data.totalOut.toFixed(2)}`);
  lines.push(`Saldo Esperado,MT ${data.shift.expectedBalance.toFixed(2)}`);
  lines.push(`Total Contado,MT ${data.shift.countedBalance.toFixed(2)}`);
  lines.push(`Diferença,MT ${data.shift.difference.toFixed(2)}`);
  lines.push('');
  lines.push('VENDAS POR MÉTODO');
  lines.push(`Dinheiro,MT ${data.cashIn.toFixed(2)}`);
  lines.push(`Cartão,MT ${data.cardIn.toFixed(2)}`);
  lines.push(`Mobile Money,MT ${data.mobileIn.toFixed(2)}`);
  lines.push(`Transferência,MT ${data.transferIn.toFixed(2)}`);
  lines.push('');
  lines.push('CONTAS NÃO PAGAS');
  lines.push(`Quantidade,${data.shift.unpaidOrdersCount}`);
  lines.push(`Total,MT ${data.shift.unpaidOrdersTotal.toFixed(2)}`);

  if (data.noteCounts && data.noteCounts.length > 0) {
    lines.push('');
    lines.push('CONTAGEM DE NOTAS E MOEDAS');
    lines.push('Denominação,Quantidade,Subtotal');
    data.noteCounts.forEach(nc => {
      if (nc.count > 0) {
        lines.push(`${nc.label},${nc.count},MT ${(nc.denomination * nc.count).toFixed(2)}`);
      }
    });
  }

  lines.push('');
  lines.push('MOVIMENTOS DO TURNO');
  lines.push('Hora,Tipo,Valor,Descrição,Método,Categoria,Operador');
  data.movements.forEach(m => {
    lines.push([
      new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      m.type === 'in' ? 'Entrada' : 'Saída',
      `MT ${m.amount.toFixed(2)}`,
      m.description,
      payLabels[m.paymentMethod] || m.paymentMethod,
      m.category,
      m.operator,
    ].map(escapeCSV).join(','));
  });

  if (data.notes) {
    lines.push('');
    lines.push(`Notas de Fecho,${data.notes}`);
  }

  const content = '\uFEFF' + lines.join('\n');
  download(`relatorio_fecho_${new Date(data.shift.openedAt).toISOString().slice(0, 10)}.csv`, content);
}

export function exportShiftReportPDF(data: ShiftReportData) {
  const payLabels: Record<string, string> = { cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência' };
  const diffColor = data.shift.difference === 0 ? '#059669' : data.shift.difference > 0 ? '#0284c7' : '#dc2626';
  const diffLabel = data.shift.difference === 0 ? 'Equilibrada' : data.shift.difference > 0 ? 'Excesso' : 'Falta';

  const noteRows = (data.noteCounts || [])
    .filter(nc => nc.count > 0)
    .map(nc => `
      <tr>
        <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${nc.label}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:center;">${nc.count}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">MT ${(nc.denomination * nc.count).toFixed(2)}</td>
      </tr>
    `).join('');

  const movRows = data.movements.map(m => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;">${new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;">${m.description}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;">${payLabels[m.paymentMethod] || m.paymentMethod}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;">${m.category}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right;font-weight:600;color:${m.type === 'in' ? '#059669' : '#dc2626'};">${m.type === 'in' ? '+' : '-'}MT ${m.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Relatório de Fecho de Caixa</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #f3f4f6; }
  .brand { font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #1E9FD4, #00C8C8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .meta { text-align: right; color: #6b7280; font-size: 12px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .card { background: #f9fafb; border-radius: 10px; padding: 12px 14px; }
  .card-label { font-size: 11px; color: #9ca3af; margin-bottom: 3px; }
  .card-value { font-size: 16px; font-weight: 700; color: #1f2937; }
  .card-value.green { color: #059669; }
  .card-value.red { color: #dc2626; }
  .diff-card { background: #f9fafb; border-radius: 10px; padding: 14px; display: flex; justify-content: space-between; align-items: center; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; padding: 6px 8px; border-bottom: 2px solid #f3f4f6; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Hayusten BarOne</div>
    <div class="subtitle">Relatório de Fecho de Caixa</div>
  </div>
  <div class="meta">
    <div><strong>Data:</strong> ${new Date(data.shift.openedAt).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
    <div><strong>Abertura:</strong> ${new Date(data.shift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} por ${data.shift.openedBy}</div>
    ${data.shift.closedAt ? `<div><strong>Fecho:</strong> ${new Date(data.shift.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} por ${data.shift.closedBy || '—'}</div>` : ''}
    <div style="margin-top:4px;color:#6b7280;">Gerado em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Resumo Financeiro</div>
  <div class="grid-4">
    <div class="card"><div class="card-label">Saldo Abertura</div><div class="card-value">MT ${data.shift.openingBalance.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Total Entradas</div><div class="card-value green">MT ${data.totalIn.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Total Saídas</div><div class="card-value red">MT ${data.totalOut.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Saldo Esperado</div><div class="card-value">MT ${data.shift.expectedBalance.toFixed(2)}</div></div>
  </div>
  <div class="diff-card" style="margin-top:10px;">
    <div>
      <div style="font-size:12px;color:#6b7280;">Total Contado em Caixa</div>
      <div style="font-size:20px;font-weight:800;">MT ${data.shift.countedBalance.toFixed(2)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#6b7280;">Diferença</div>
      <div style="font-size:20px;font-weight:800;color:${diffColor};">${data.shift.difference >= 0 ? '+' : ''}MT ${data.shift.difference.toFixed(2)}</div>
      <span class="badge" style="background:${diffColor}20;color:${diffColor};">${diffLabel}</span>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Vendas por Método de Pagamento</div>
  <div class="grid-4">
    <div class="card"><div class="card-label">Dinheiro</div><div class="card-value green">MT ${data.cashIn.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Cartão</div><div class="card-value" style="color:#0284c7;">MT ${data.cardIn.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Mobile Money</div><div class="card-value" style="color:#d97706;">MT ${data.mobileIn.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Transferência</div><div class="card-value">MT ${data.transferIn.toFixed(2)}</div></div>
  </div>
</div>

${data.shift.unpaidOrdersCount > 0 ? `
<div class="section">
  <div class="section-title">Contas Não Pagas</div>
  <div class="card" style="background:#fffbeb;border:1px solid #fde68a;">
    <span style="color:#92400e;font-weight:600;">${data.shift.unpaidOrdersCount} conta(s) pendente(s) — Total: MT ${data.shift.unpaidOrdersTotal.toFixed(2)}</span>
  </div>
</div>
` : ''}

${noteRows ? `
<div class="section">
  <div class="section-title">Contagem de Notas e Moedas</div>
  <table>
    <thead><tr><th>Denominação</th><th style="text-align:center;">Quantidade</th><th style="text-align:right;">Subtotal</th></tr></thead>
    <tbody>${noteRows}</tbody>
  </table>
</div>
` : ''}

<div class="section">
  <div class="section-title">Movimentos do Turno (${data.movements.length} registos)</div>
  <table>
    <thead><tr><th>Hora</th><th>Descrição</th><th>Método</th><th>Categoria</th><th style="text-align:right;">Valor</th></tr></thead>
    <tbody>${movRows}</tbody>
  </table>
</div>

${data.notes ? `<div class="section"><div class="section-title">Notas de Fecho</div><div class="card"><p style="color:#374151;">${data.notes}</p></div></div>` : ''}

<div class="footer">Hayusten BarOne · Relatório gerado automaticamente · ${new Date().toLocaleString('pt-PT')}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
