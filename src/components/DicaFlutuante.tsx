import React, { useEffect, useState } from 'react';

/**
 * Dica que aparece ao deixar o mouse em cima de qualquer elemento com o atributo `data-dica`.
 * Um único componente para o sistema todo: basta escrever `data-dica="explicação"` no elemento.
 * Usa posição fixa, então não é cortada por tabelas com rolagem ou cartões com overflow.
 */
export const DicaFlutuante: React.FC = () => {
  const [dica, setDica] = useState<{ texto: string; x: number; y: number; acima: boolean } | null>(null);

  useEffect(() => {
    let alvoAtual: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const aoEntrar = (e: MouseEvent) => {
      const alvo = (e.target as HTMLElement | null)?.closest?.('[data-dica]') as HTMLElement | null;
      if (alvo === alvoAtual) return;
      alvoAtual = alvo;
      clearTimeout(timer);
      if (!alvo) {
        setDica(null);
        return;
      }
      timer = setTimeout(() => {
        const texto = alvo.getAttribute('data-dica');
        if (!texto) return;
        const r = alvo.getBoundingClientRect();
        const acima = r.bottom + 90 > window.innerHeight;
        setDica({ texto, x: r.left + r.width / 2, y: acima ? r.top - 8 : r.bottom + 8, acima });
      }, 250);
    };

    const esconder = () => {
      alvoAtual = null;
      clearTimeout(timer);
      setDica(null);
    };

    document.addEventListener('mouseover', aoEntrar);
    document.addEventListener('mousedown', esconder);
    window.addEventListener('scroll', esconder, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseover', aoEntrar);
      document.removeEventListener('mousedown', esconder);
      window.removeEventListener('scroll', esconder, true);
    };
  }, []);

  if (!dica) return null;

  // Mantém a caixa dentro da tela (largura máx. 280 px)
  const metade = 140;
  const x = Math.min(Math.max(dica.x, metade + 8), window.innerWidth - metade - 8);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-[280px] rounded-lg bg-[#0B0B0B] px-3 py-2 text-[11px] leading-snug text-white shadow-xl border border-white/10"
      style={{
        left: x,
        top: dica.y,
        transform: `translate(-50%, ${dica.acima ? '-100%' : '0'})`,
      }}
    >
      {dica.texto}
    </div>
  );
};
