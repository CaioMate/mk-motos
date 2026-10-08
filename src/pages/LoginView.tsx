import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export const LoginView: React.FC<{ aoEntrar: () => void }> = ({ aoEntrar }) => {
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) return aoEntrar();
      const j = await r.json().catch(() => ({}));
      setErro(j.erro || 'Não foi possível entrar. Tente de novo.');
    } catch {
      setErro('Sem conexão com o servidor. Verifique sua internet.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] p-6">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E50914] font-display font-extrabold text-white">
            MK
          </div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-[#0B0B0B]">
            MK <span className="text-[#E50914]">MOTOS</span>
          </h1>
          <p className="text-sm text-slate-500">Digite a senha para entrar no painel.</p>
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type={mostrar ? 'text' : 'password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="Senha"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setMostrar(!mostrar)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
          >
            {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-[#E50914]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
            <span>{erro}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!senha || enviando}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#E50914] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
};
