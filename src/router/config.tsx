import { RouteObject } from 'react-router-dom';
import AppLayout from '@/components/feature/AppLayout';
import DashboardPage from '@/pages/dashboard/page';
import StockPage from '@/pages/stock/page';
import POSPage from '@/pages/pos/page';
import TablesPage from '@/pages/tables/page';
import CashPage from '@/pages/cash/page';
import ReportsPage from '@/pages/reports/page';
import SettingsPage from '@/pages/settings/page';
import ClientsPage from '@/pages/clients/page';
import DebtsPage from '@/pages/debts/page';
import LoginPage from '@/pages/login/page';
import NotFound from '@/pages/NotFound';

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'pos', element: <POSPage /> },
      { path: 'tables', element: <TablesPage /> },
      { path: 'cash', element: <CashPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'debts', element: <DebtsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
];

export default routes;
