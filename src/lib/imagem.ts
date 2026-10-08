/** Reduz a foto no navegador (lado maior 1200px, JPEG 80%) e devolve em base64, sem o prefixo "data:". */
export async function reduzirImagem(arquivo: File, ladoMaior = 1200, qualidade = 0.8): Promise<{ base64: string; mime: string }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível ler esta imagem. Tente outra foto (JPG, PNG ou WebP).'));
      i.src = url;
    });
    const escala = Math.min(1, ladoMaior / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a foto.');
    ctx.fillStyle = '#fff'; // fundo branco para PNG com transparência
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
    return { base64: dataUrl.split(',')[1] ?? '', mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
