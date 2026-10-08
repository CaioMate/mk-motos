/** O que o servidor informa em /api/sessao sobre o ambiente (preenchido por PortaoSessao antes de carregar o resto). */
export const infoServidor = {
  /** false na Vercel: não há canal em tempo real (SSE); o sistema consulta de tempos em tempos. */
  tempoReal: true,
  /** Tamanho máximo de arquivo aceito nos envios (foto/comprovante), em MB. */
  limiteUploadMb: 10,
};
