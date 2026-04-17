# Hayusten BarOne — Sistema de Gestão de Bar

## 1. Descrição do Projeto
Sistema completo de gestão para um único bar. Centraliza stock, vendas POS, pedidos por mesa/pessoa, controlo de caixa com turnos, pagamentos e relatórios. Suporta 4 perfis de utilizador com permissões distintas.

## 2. Estrutura de Páginas
- `/` - Dashboard (KPIs, alertas de stock, contas pendentes, mesas ativas)
- `/tables` - Mesas & Pedidos (mapa de mesas, pedidos por pessoa, contas pendentes, fecho com justificação)
- `/pos` - Vendas POS (ponto de venda rápido, associar a mesa/pessoa, pagamentos)
- `/stock` - Gestão de Stock (armazéns, movimentos auditáveis, alertas amarelo/vermelho)
- `/cash` - Caixa & Turnos (abertura/fecho de turno, contas não pagas, diferença contada vs esperada)
- `/reports` - Relatórios (vendas, stock, caixa, contas pendentes, quebras)

## 3. Funcionalidades Principais

### Utilizadores & Perfis
- [x] 4 perfis: Administrador, Gerente, Caixa, Barman
- [ ] Gestão de utilizadores (criar, editar, desativar)
- [ ] Histórico/auditoria de ações

### Configuração do Bar
- [ ] Dados do bar (nome, localização, moeda)
- [ ] Horários, políticas de desconto, regras de venda
- [ ] Armazéns internos (Armazém Principal, Balcão)

### Produtos & Stock
- [x] Produtos com unidade, custo, preço de venda
- [x] Categorias de produtos
- [ ] Produtos compostos (cocktails com receitas)
- [x] Alertas amarelo (stock ≤ mínimo) e vermelho (stock ≤ crítico)
- [ ] Movimentos auditáveis: entradas, saídas, quebras, ofertas, transferências
- [ ] Múltiplos armazéns

### Pedidos por Mesa/Pessoa
- [x] Mapa visual de mesas
- [x] Adicionar itens ao longo do tempo
- [ ] Pedidos por pessoa (dentro da mesa)
- [x] Fecho de conta com pagamento
- [x] Contas pendentes (não pagas) com justificação obrigatória
- [x] Histórico de contas pendentes
- [ ] Pagamento posterior (total ou parcial)

### Vendas POS
- [x] Registo rápido de vendas
- [x] Associação a funcionário e turno
- [x] Estados: rascunho, paga, cancelada, estornada
- [x] Pagamentos parciais

### Pagamentos
- [x] Dinheiro, Cartão, Mobile Money, Transferência
- [x] Pagamentos parciais
- [x] Registo detalhado (valor, método, utilizador, data)

### Caixa & Turnos
- [x] Abertura de caixa com saldo inicial
- [x] Registo automático de movimentos
- [x] Fecho com total esperado, total contado, diferença
- [x] Contas não pagas visíveis no fecho
- [x] Relatórios por turno

### Relatórios
- [x] Vendas por período
- [x] Produtos mais vendidos
- [x] Contas pendentes
- [x] Estado de stock
- [x] Fluxo de caixa por método de pagamento

## 4. Modelo de Dados

### Produtos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | ID único |
| name | string | Nome |
| category | string | Categoria |
| price | number | Preço de venda |
| cost | number | Custo de compra |
| stock | number | Stock atual |
| minStock | number | Stock mínimo (alerta amarelo) |
| criticalStock | number | Stock crítico (alerta vermelho) |
| unit | string | Unidade |
| warehouse | string | Armazém |

### Mesas & Pedidos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | ID único |
| number | number | Número da mesa |
| status | string | livre/ocupada/reservada |
| orders | Order[] | Pedidos ativos |

### Pedidos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | ID único |
| tableId | string | Mesa |
| personName | string | Nome da pessoa (opcional) |
| items | OrderItem[] | Itens |
| total | number | Total |
| paid | number | Valor pago |
| status | string | open/paid/pending |
| pendingReason | string | Motivo de não pagamento |
| closedAt | string | Data de fecho |
| waiter | string | Funcionário |

### Movimentos de Caixa
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | ID único |
| type | string | in/out |
| amount | number | Valor |
| description | string | Descrição |
| paymentMethod | string | dinheiro/cartão/mobile/transferência |
| category | string | Categoria |
| operator | string | Operador |
| shiftId | string | Turno associado |

### Turnos de Caixa
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string | ID único |
| openedBy | string | Quem abriu |
| openedAt | string | Data/hora abertura |
| openingBalance | number | Saldo inicial |
| closedAt | string | Data/hora fecho |
| expectedBalance | number | Total esperado |
| countedBalance | number | Total contado |
| difference | number | Diferença |
| unpaidOrders | number | Contas não pagas |

## 5. Integrações
- Supabase: Fase futura — persistência real, autenticação, multi-utilizador
- Shopify: Não aplicável
- Stripe: Não aplicável

## 6. Plano de Desenvolvimento

### Fase 1: Estrutura Base ✅
- Layout, sidebar, dashboard, dados mock

### Fase 2: Reestruturação Hayusten BarOne ✅ (atual)
- Novo nome, 4 perfis, mesas com contas pendentes, caixa com fecho de turno, stock com alertas duplos

### Fase 3: Gestão de Utilizadores & Configurações (futuro)
- Criar/editar utilizadores, permissões, configuração do bar

### Fase 4: Supabase (futuro)
- Persistência real, login, auditoria
