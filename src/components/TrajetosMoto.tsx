import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, Power } from 'lucide-react';
import type { PontoTrajeto, ViagemGps, ViagensDoPeriodo } from '../types/mkMotos';

const dataInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const duracao = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);
const km = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Seção "Trajetos" da moto: viagens do dia (ligou -> desligou) e o caminho no mapa (OpenStreetMap). */
export const TrajetosMoto: React.FC<{ motoId: string; ultimaPosicao?: string }> = ({ motoId, ultimaPosicao }) => {
  const [dia, setDia] = useState(dataInput(new Date()));
  const [dados, setDados] = useState<ViagensDoPeriodo | null>(null);
  const [viagemSel, setViagemSel] = useState<ViagemGps | null>(null);
  const [pontos, setPontos] = useState<PontoTrajeto[]>([]);
  const [erro, setErro] = useState('');
  const mapaDiv = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);

  const [y, m, d] = dia.split('-').map(Number);
  const de = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  const ate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

  // lista de viagens do dia (atualiza quando chega posição nova)
  useEffect(() => {
    let vivo = true;
    fetch(`/api/gps/viagens/${encodeURIComponent(motoId)}?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || 'Erro ao buscar as viagens.');
        return j as ViagensDoPeriodo;
      })
      .then((j) => {
        if (!vivo) return;
        setDados(j);
        setErro('');
      })
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [motoId, de, ate, ultimaPosicao]);

  useEffect(() => setViagemSel(null), [motoId, dia]);

  // pontos do mapa: a viagem escolhida ou o dia inteiro
  useEffect(() => {
    let vivo = true;
    const ini = viagemSel ? viagemSel.inicio : de;
    const fim = viagemSel ? viagemSel.fim ?? new Date().toISOString() : ate;
    fetch(`/api/gps/pontos/${encodeURIComponent(motoId)}?de=${encodeURIComponent(ini)}&ate=${encodeURIComponent(fim)}&max=600`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => vivo && setPontos(j))
      .catch(() => vivo && setPontos([]));
    return () => {
      vivo = false;
    };
  }, [motoId, de, ate, viagemSel, ultimaPosicao]);

  // cria o mapa uma vez
  useEffect(() => {
    if (!mapaDiv.current) return;
    const mp = L.map(mapaDiv.current, { zoomControl: true }).setView([-15.8, -47.9], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mp);
    camada.current = L.layerGroup().addTo(mp);
    mapa.current = mp;
    return () => {
      mp.remove();
      mapa.current = null;
    };
  }, []);

  // desenha o caminho
  useEffect(() => {
    const grupo = camada.current;
    const mp = mapa.current;
    if (!grupo || !mp) return;
    grupo.clearLayers();
    if (pontos.length === 0) return;
    const linha = pontos.map((p) => [p.lat, p.lon] as [number, number]);
    L.polyline(linha, { color: '#087BFF', weight: 4 }).addTo(grupo);
    L.circleMarker(linha[0], { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 })
      .bindTooltip(`Saída ${hora(pontos[0].dataHora)}`)
      .addTo(grupo);
    const ultimo = pontos[pontos.length - 1];
    L.circleMarker(linha[linha.length - 1], { radius: 7, color: '#E50914', fillColor: '#E50914', fillOpacity: 1 })
      .bindTooltip(`Última posição ${hora(ultimo.dataHora)}`)
      .addTo(grupo);
    mp.invalidateSize();
    mp.fitBounds(L.latLngBounds(linha), { padding: [20, 20], maxZoom: 17 });
  }, [pontos]);

  const hoje = dia === dataInput(new Date());
  const t = dados?.totais;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="flex items-center gap-1.5 font-semibold text-slate-900"
          data-dica="Mostra por onde a moto andou e quantas vezes foi ligada e desligada no dia escolhido."
        >
          <Route className="h-3.5 w-3.5 text-[#087BFF]" /> Trajetos
        </span>
        <input
          type="date"
          value={dia}
          max={dataInput(new Date())}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          data-dica="Escolha o dia que você quer ver."
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        />
      </div>

      {erro && <p className="text-[#E50914]">{erro}</p>}

      {t && (
        <p className="text-slate-700" data-dica="Resumo do dia: quantas vezes a moto foi ligada, quanto rodou e por quanto tempo ficou rodando.">
          <strong>
            Ligou {t.viagens} {t.viagens === 1 ? 'vez' : 'vezes'} {hoje ? 'hoje' : 'neste dia'}
          </strong>
          {t.viagens > 0 && (
            <>
              {' '}
              · {km(t.km)} km · {duracao(t.minutosRodando)} rodando · máx. {t.velocidadeMaxKmh} km/h
            </>
          )}
        </p>
      )}

      {dados && dados.viagens.length === 0 && <p className="text-slate-500">Nenhuma viagem neste dia.</p>}
      {dados && dados.viagens.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {dados.viagens.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setViagemSel(viagemSel?.id === v.id ? null : v)}
                data-dica="Clique para ver só esta viagem no mapa. Clique de novo para voltar ao dia todo."
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                  viagemSel?.id === v.id ? 'border-[#087BFF] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Power className="h-3 w-3 text-emerald-600" />
                  {hora(v.inicio)} → {v.fim ? hora(v.fim) : 'em andamento'}
                </span>
                <span className="text-slate-600">
                  {km(v.km)} km · {duracao(v.duracaoMin)}
                  <span className="ml-2 text-[10px] text-slate-400">{v.origem === 'ignicao' ? 'pela ignição' : 'por movimento'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={mapaDiv} className="h-64 w-full overflow-hidden rounded-lg border border-slate-200" />
      {pontos.length === 0 && <p className="text-slate-500">Sem posições para mostrar neste período.</p>}
    </div>
  );
};
