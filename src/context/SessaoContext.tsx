import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LoginView } from '../pages/LoginView';
import { infoServidor } from '../lib/servidorInfo';

/** Evento disparado quando qualquer chamada à API responde 401 (sessão vencida). */
export const EVENTO_SESSAO_EXPIRADA = 'mk-sessao-expirada';

interface SessaoInfo {
  exigeLogin: boolean;
  sair: () => Promise<void>;
}

const SessaoContext = createContext<SessaoInfo>({ exigeLogin: false, sair: async () => {} });

export const useSessao = () => useContext(SessaoContext);

type Situacao = 'carregando' | 'offline' | { exigeLogin: boolean; logado: boolean };

/** Só carrega o resto do sistema (e seus dados) depois de confirmar a sessão. */
export const PortaoSessao: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  /** Mensagem do servidor quando ele está no ar mas mal configurado (ex.: faltam variáveis na Vercel). */
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const verificar = useCallback(async () => {
    try {
      const r = await fetch('/api/sessao');
      const j = await r.json();
      if (!r.ok) {
        setErroServidor(typeof j.erro === 'string' ? j.erro : 'O servidor respondeu com erro.');
        return;
      }
      setErroServidor(null);
      if (typeof j.tempoReal === 'boolean') infoServidor.tempoReal = j.tempoReal;
      if (typeof j.limiteUploadMb === 'number') infoServidor.limiteUploadMb = j.limiteUploadMb;
      setSituacao({ exigeLogin: !!j.exigeLogin, logado: !!j.logado });
    } catch {
      setSituacao('offline');
    }
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  useEffect(() => {
    if (situacao === 'offline' || erroServidor) {
      const t = setTimeout(verificar, erroServidor ? 10000 : 5000);
      return () => clearTimeout(t);
    }
  }, [situacao, erroServidor, verificar]);

  useEffect(() => {
    const aoExpirar = () => setSituacao((s) => (typeof s === 'object' ? { ...s, logado: false } : s));
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, []);

  const sair = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    setSituacao((s) => (typeof s === 'object' ? { ...s, logado: false } : s));
  }, []);

  if (erroServidor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] text-white p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-bold">O sistema ainda não está pronto</p>
          <p className="text-sm text-slate-300">{erroServidor}</p>
        </div>
      </div>
    );
  }

  if (situacao === 'carregando' || situacao === 'offline') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] text-white p-6">
        <p className="text-sm text-slate-300">
          {situacao === 'offline' ? 'Servidor do sistema não encontrado. Tentando de novo…' : 'Carregando…'}
        </p>
      </div>
    );
  }

  if (situacao.exigeLogin && !situacao.logado) {
    return <LoginView aoEntrar={() => setSituacao({ exigeLogin: true, logado: true })} />;
  }

  return <SessaoContext.Provider value={{ exigeLogin: situacao.exigeLogin, sair }}>{children}</SessaoContext.Provider>;
};
