/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LayoutShell } from './components/LayoutShell';
import { DashboardView } from './pages/DashboardView';
import { FrotaView } from './pages/FrotaView';
import { ClientesView } from './pages/ClientesView';
import { AlugueisView } from './pages/AlugueisView';
import { ContratosView } from './pages/ContratosView';
import { FinanceiroView } from './pages/FinanceiroView';
import { ManutencaoView } from './pages/ManutencaoView';
import { ComercialView } from './pages/ComercialView';
import { RelatoriosView } from './pages/RelatoriosView';
import { ConfiguracoesView } from './pages/ConfiguracoesView';

const ActivePageRouter: React.FC = () => {
  const { activeTab } = useApp();

  switch (activeTab) {
    case 'dashboard':
      return <DashboardView />;
    case 'frota':
      return <FrotaView />;
    case 'clientes':
      return <ClientesView />;
    case 'alugueis':
      return <AlugueisView />;
    case 'contratos':
      return <ContratosView />;
    case 'financeiro':
      return <FinanceiroView />;
    case 'manutencao':
      return <ManutencaoView />;
    case 'comercial':
      return <ComercialView />;
    case 'relatorios':
      return <RelatoriosView />;
    case 'configuracoes':
      return <ConfiguracoesView />;
    default:
      return <DashboardView />;
  }
};

export default function App() {
  return (
    <AppProvider>
      <LayoutShell>
        <ActivePageRouter />
      </LayoutShell>
    </AppProvider>
  );
}
