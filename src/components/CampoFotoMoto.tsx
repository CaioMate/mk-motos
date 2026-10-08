import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';

/** Escolher arquivo ou tirar foto pelo celular, com prévia. */
export const CampoFotoMoto: React.FC<{
  arquivo: File | null;
  onChange: (arquivo: File | null) => void;
  fotoAtual?: string;
  rotulo?: string;
}> = ({ arquivo, onChange, fotoAtual, rotulo = 'Foto da moto' }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string>('');

  useEffect(() => {
    if (!arquivo) {
      setPrevia('');
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const mostrar = previa || fotoAtual || '';
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600">{rotulo} (opcional)</label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-200 flex items-center justify-center text-slate-400">
          {mostrar ? (
            <img src={mostrar} alt="Prévia da foto da moto" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          data-dica="Escolha uma foto do computador ou, no celular, tire a foto da moto na hora. O sistema diminui a imagem sozinho."
        >
          <Camera className="h-3.5 w-3.5" /> {mostrar ? 'Trocar foto' : 'Escolher ou tirar foto'}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={rotulo}
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
