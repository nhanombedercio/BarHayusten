export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  personName?: string;
}

export interface TableOrder {
  id: string;
  tableId: string;
  personName?: string;
  items: OrderItem[];
  total: number;
  paid: number;
  status: 'open' | 'paid' | 'pending';
  pendingReason?: string;
  pendingResponsible?: string;
  createdAt: string;
  closedAt?: string;
  waiter: string;
}

export interface Table {
  id: string;
  name: string;
  number: number;
  capacity: number;
  status: 'free' | 'occupied' | 'reserved';
  orders: TableOrder[];
  clientName?: string;
}

export const tables: Table[] = [
  {
    id: 't1', name: 'Mesa 1', number: 1, capacity: 2, status: 'occupied', clientName: 'Carlos',
    orders: [
      {
        id: 'o1', tableId: 't1', personName: 'Carlos', waiter: 'João',
        items: [
          { productId: 'p1', productName: 'Super Bock', quantity: 2, price: 1.5, personName: 'Carlos' },
          { productId: 'p18', productName: 'Tosta Mista', quantity: 1, price: 3.5, personName: 'Carlos' },
        ],
        total: 6.5, paid: 0, status: 'open', createdAt: '2026-04-15T20:15:00',
      },
    ],
  },
  {
    id: 't2', name: 'Mesa 2', number: 2, capacity: 4, status: 'occupied', clientName: 'Grupo Ana',
    orders: [
      {
        id: 'o2a', tableId: 't2', personName: 'Ana', waiter: 'Maria',
        items: [
          { productId: 'p11', productName: 'Mojito', quantity: 2, price: 7.0, personName: 'Ana' },
          { productId: 'p19', productName: 'Francesinha', quantity: 1, price: 9.5, personName: 'Ana' },
        ],
        total: 23.5, paid: 0, status: 'open', createdAt: '2026-04-15T19:45:00',
      },
      {
        id: 'o2b', tableId: 't2', personName: 'Pedro', waiter: 'Maria',
        items: [
          { productId: 'p14', productName: 'Coca-Cola', quantity: 2, price: 2.0, personName: 'Pedro' },
          { productId: 'p19', productName: 'Francesinha', quantity: 1, price: 9.5, personName: 'Pedro' },
        ],
        total: 13.5, paid: 0, status: 'open', createdAt: '2026-04-15T19:45:00',
      },
    ],
  },
  { id: 't3', name: 'Mesa 3', number: 3, capacity: 4, status: 'free', orders: [] },
  { id: 't4', name: 'Terraço A', number: 4, capacity: 6, status: 'reserved', orders: [] },
  {
    id: 't5', name: 'Mesa 5', number: 5, capacity: 2, status: 'occupied', clientName: 'Sofia',
    orders: [
      {
        id: 'o3', tableId: 't5', personName: 'Sofia', waiter: 'João',
        items: [
          { productId: 'p10', productName: 'Gin Tanqueray', quantity: 2, price: 5.0, personName: 'Sofia' },
          { productId: 'p15', productName: 'Água s/ Gás', quantity: 2, price: 1.0, personName: 'Sofia' },
        ],
        total: 12.0, paid: 0, status: 'open', createdAt: '2026-04-15T20:30:00',
      },
    ],
  },
  { id: 't6', name: 'Mesa 6', number: 6, capacity: 4, status: 'free', orders: [] },
  { id: 't7', name: 'VIP', number: 7, capacity: 8, status: 'free', orders: [] },
  {
    id: 't8', name: 'Mesa 8', number: 8, capacity: 4, status: 'occupied',
    orders: [
      {
        id: 'o4', tableId: 't8', waiter: 'Ana',
        items: [
          { productId: 'p5', productName: 'Vinho Tinto Casa', quantity: 4, price: 2.5 },
          { productId: 'p20', productName: 'Amendoins', quantity: 2, price: 1.5 },
        ],
        total: 13.0, paid: 0, status: 'open', createdAt: '2026-04-15T20:00:00',
      },
    ],
  },
  { id: 't9', name: 'Mesa 9', number: 9, capacity: 2, status: 'free', orders: [] },
  { id: 't10', name: 'Esplanada', number: 10, capacity: 6, status: 'reserved', orders: [] },
  { id: 't11', name: 'Mesa 11', number: 11, capacity: 4, status: 'free', orders: [] },
  {
    id: 't12', name: 'Balcão', number: 12, capacity: 2, status: 'occupied', clientName: 'Rui',
    orders: [
      {
        id: 'o5', tableId: 't12', personName: 'Rui', waiter: 'Maria',
        items: [
          { productId: 'p13', productName: 'Gin Tónico', quantity: 2, price: 8.0, personName: 'Rui' },
        ],
        total: 16.0, paid: 0, status: 'open', createdAt: '2026-04-15T20:45:00',
      },
    ],
  },
];

export const pendingOrders: TableOrder[] = [
  {
    id: 'pend1', tableId: 't3', personName: 'Miguel Ferreira', waiter: 'João',
    items: [
      { productId: 'p11', productName: 'Mojito', quantity: 3, price: 7.0 },
      { productId: 'p19', productName: 'Francesinha', quantity: 2, price: 9.5 },
    ],
    total: 40.0, paid: 20.0, status: 'pending',
    pendingReason: 'Cliente saiu sem pagar o restante. Prometeu pagar amanhã.',
    pendingResponsible: 'João',
    createdAt: '2026-04-14T21:30:00',
    closedAt: '2026-04-14T23:00:00',
  },
  {
    id: 'pend2', tableId: 't7', personName: 'Grupo Empresa XYZ', waiter: 'Maria',
    items: [
      { productId: 'p5', productName: 'Vinho Tinto Casa', quantity: 8, price: 2.5 },
      { productId: 'p1', productName: 'Super Bock', quantity: 12, price: 1.5 },
      { productId: 'p18', productName: 'Tosta Mista', quantity: 4, price: 3.5 },
    ],
    total: 52.0, paid: 0, status: 'pending',
    pendingReason: 'Empresa vai pagar por transferência bancária até sexta-feira.',
    pendingResponsible: 'Admin',
    createdAt: '2026-04-13T20:00:00',
    closedAt: '2026-04-13T23:30:00',
  },
  {
    id: 'pend3', tableId: 't1', personName: 'Luís Santos', waiter: 'Ana',
    items: [
      { productId: 'p8', productName: 'Whisky Jack Daniel\'s', quantity: 4, price: 4.5 },
      { productId: 'p21', productName: 'Batatas Fritas', quantity: 2, price: 2.0 },
    ],
    total: 22.0, paid: 10.0, status: 'pending',
    pendingReason: 'Não tinha dinheiro suficiente. Pagamento parcial aceite.',
    pendingResponsible: 'Maria',
    createdAt: '2026-04-12T22:00:00',
    closedAt: '2026-04-12T23:45:00',
  },
];
