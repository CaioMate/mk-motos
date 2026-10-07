import React, { useState } from 'react';
import { Building2, Users, Shield, Bell, Sliders, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

type ConfigSection = 'empresa' | 'usuarios' | 'permissoes' | 'notificacoes' | 'preferencias';

export const ConfiguracoesView: React.FC = () => {
  const { showToast } = useApp();
  const [section, setSection] = useState<ConfigSection>('empresa');

  const tabs: Array<{ id: ConfigSection; label: string; icon: React.ElementType }> = [
    { id: 'empresa', label: 'Dados da empresa', icon: Building2 },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'permissoes', label: 'Permissões', icon: Shield },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'preferencias', label: 'Preferências', icon: Sliders },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-[#E50914] tracking-wide">
          ADMINISTRAÇÃO DO SISTEMA SAAS
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gerencie dados corporativos da MK Motos, equipe administrativa, permissões e alertas.
        </p>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#0B0B0B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {section === 'empresa' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <h2 className="text-base font-bold text-slate-900">Dados da empresa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  defaultValue="MK MOTOS — Locação de Motocicletas"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  defaultValue="48.921.304/0001-19"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Telefone / Central WhatsApp
                </label>
                <input
                  type="text"
                  defaultValue="(11) 99800-1200"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chave PIX Corporativa
                </label>
                <input
                  type="text"
                  defaultValue="financeiro@mkmotos.com.br"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular text-slate-900"
                />
              </div>
            </div>
            <button
              onClick={() => showToast('Configurações da empresa salvas ✓')}
              className="rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Salvar Alterações
            </button>
          </div>
        )}

        {section === 'usuarios' && (
          <div className="space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Usuários da Operação MK Motos</h2>
            <div className="divide-y divide-slate-100">
              {[
                {
                  nome: 'Proprietário / Diretor MK Motos',
                  email: 'diretoria@mkmotos.com.br',
                  cargo: 'Administrador Master',
                },
                {
                  nome: 'Fernanda Rocha',
                  email: 'financeiro@mkmotos.com.br',
                  cargo: 'Gestão Financeira & Contratos',
                },
                {
                  nome: 'Ricardo Mecânico Chefe',
                  email: 'oficina@mkmotos.com.br',
                  cargo: 'Controle de Frota & Manutenção',
                },
                {
                  nome: 'Gabriel Atendimento',
                  email: 'comercial@mkmotos.com.br',
                  cargo: 'Central Comercial / CRM',
                },
              ].map((u, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{u.nome}</p>
                    <p className="text-slate-500">{u.email}</p>
                  </div>
                  <span className="font-semibold text-[#087BFF]">{u.cargo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'permissoes' && (
          <div className="space-y-4 text-xs max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Níveis de Permissão por Perfil</h2>
            <div className="space-y-2.5">
              {[
                'Administrador: Acesso irrestrito a Frota, Financeiro, Contratos e Relatórios.',
                'Comercial / CRM: Acesso a Leads, Cadastro de Clientes e Simulação de Aluguel.',
                'Oficina & Pátio: Atualização de quilometragem, revisões e status de manutenção.',
              ].map((perm, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-800 font-medium">{perm}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'notificacoes' && (
          <div className="space-y-4 text-xs max-w-xl">
            <h2 className="text-base font-bold text-slate-900">Regras de Alertas Automáticos</h2>
            {[
              'Avisar 3 dias antes do vencimento da mensalidade do locatário',
              'Gerar alerta de revisão preventiva faltando 500 km para o limite',
              'Notificar imediatamente quando novo lead entrar pelo Instagram',
            ].map((rule, i) => (
              <label
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer"
              >
                <span className="font-medium text-slate-800">{rule}</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#E50914]" />
              </label>
            ))}
          </div>
        )}

        {section === 'preferencias' && (
          <div className="space-y-4 text-xs max-w-xl">
            <h2 className="text-base font-bold text-slate-900">Parâmetros Padrão de Locação</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ciclo Padrão de Revisão (km)
                </label>
                <input
                  type="number"
                  defaultValue={5000}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Caução Padrão Sugerido (R$)
                </label>
                <input
                  type="number"
                  defaultValue={500}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular"
                />
              </div>
            </div>
            <button
              onClick={() => showToast('Preferências atualizadas ✓')}
              className="rounded-xl bg-[#0B0B0B] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Salvar Preferências
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
