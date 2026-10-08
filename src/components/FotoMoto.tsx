import React from 'react';
import { Bike } from 'lucide-react';

/** Foto da moto; sem foto cadastrada mostra um ícone de moto sobre fundo cinza. */
export const FotoMoto: React.FC<{
  foto?: string;
  alt: string;
  className?: string;
  iconeClassName?: string;
}> = ({ foto, alt, className = '', iconeClassName = 'h-1/3 w-1/3 max-h-16 max-w-16' }) =>
  foto ? (
    <img src={foto} alt={alt} referrerPolicy="no-referrer" className={className} />
  ) : (
    <div
      role="img"
      aria-label={`${alt} (sem foto cadastrada)`}
      className={`flex items-center justify-center bg-slate-200 text-slate-400 ${className}`}
    >
      <Bike className={iconeClassName} aria-hidden="true" />
    </div>
  );
