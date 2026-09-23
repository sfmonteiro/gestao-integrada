import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const STATUS = {
  EM_ABERTO: { hex: "#FFC233", soft: "#FFF3D1", label: "Em aberto / a vencer" },
  RECEBIDO: { hex: "#14D8A0", soft: "#D2FBEE", label: "Pago" },
  ATRASADO: { hex: "#FF3B5C", soft: "#FFD9E0", label: "Vencido" },
};

const BRL = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// URL base da sua Cloud Function
const API_URL = "https://us-central1-vest-gestao-integrada.cloudfunctions.net/api";

export default function App() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [selecionado, setSelecionado] = useState(null);
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Busca as despesas reais da sua Function sempre que o mês muda
  useEffect(() => {
    setCarregando(true);
    setErro(null);

    fetch(`${API_URL}/contas-a-pagar`)
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar despesas");
        return res.json();
      })
      .then((dados) => {
        // Transforma cada item da API no formato que a tela usa
        const lista = dados.itens.map((item) => ({
          id: item.id,
          desc: item.descricao,
          valor: item.total,
          data: new Date(item.data_vencimento + "T00:00:00"),
          status: item.status_traduzido,
        }));
        setDespesas(lista);
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [mes, ano]);

  const totais = useMemo(() => {
    const t = { EM_ABERTO: 0, RECEBIDO: 0, ATRASADO: 0 };
    despesas.forEach((d) => {
      if (t[d.status] !== undefined) t[d.status] += d.valor;
    });
    return t;
  }, [despesas]);

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  const ehHoje = (d) =>
    d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

  const navegar = (delta) => {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a); setSelecionado(null);
  };

  const despesasDoDia = (d) => despesas.filter((x) => x.data.getDate() === d);

  if (carregando) {
    return <div className="p-8 text-center text-slate-400">Carregando despesas...</div>;
  }

  if (erro) {
    return <div className="p-8 text-center text-red-500">Erro: {erro}</div>;
  }

  return (
    <div style={{ background: "#FBFAFF", minHeight: "100vh" }} className="p-4 md:p-6 font-sans">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl p-2.5" style={{ background: "#8098FF" }}>
            <CalendarDays className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">Agenda</h1>
            <p className="text-xs text-slate-400">Despesas · ContaAzul</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="p-2 rounded-xl bg-white shadow-sm hover:bg-slate-50 transition">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <div className="px-4 py-2 rounded-xl bg-white shadow-sm min-w-[160px] text-center font-semibold text-slate-700">
            {MESES[mes]} {ano}
          </div>
          <button onClick={() => navegar(1)} className="p-2 rounded-xl bg-white shadow-sm hover:bg-slate-50 transition">
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {Object.entries(STATUS).map(([k, s]) => (
          <div key={k} className="rounded-2xl p-3.5 bg-white shadow-sm border-l-4" style={{ borderColor: s.hex }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.hex }} />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-slate-800">{BRL(totais[k])}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 bg-white rounded-3xl shadow-sm p-3 md:p-4">
          <div className="grid grid-cols-7 mb-2">
            {DIAS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celulas.map((d, i) => {
              if (d === null) return <div key={i} />;
              const evs = despesasDoDia(d);
              const sel = selecionado === d;
              return (
                <button
                  key={i}
                  onClick={() => setSelecionado(sel ? null : d)}
                  className="min-h-[74px] rounded-2xl p-1.5 text-left transition border"
                  style={{
                    background: sel ? "#F3F1FF" : "#FCFCFE",
                    borderColor: sel ? "#8098FF" : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                      style={ehHoje(d) ? { background: "#8098FF", color: "#fff" } : { color: "#64748b" }}
                    >{d}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {evs.slice(0, 2).map((e) => (
                      <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate"
                        style={{ background: STATUS[e.status]?.soft || "#eee", color: STATUS[e.status]?.hex || "#666" }}>
                        {e.desc}
                      </div>
                    ))}
                    {evs.length > 2 && (
                      <div className="text-[10px] text-slate-400 pl-1">+{evs.length - 2} mais</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:w-80 bg-white rounded-3xl shadow-sm p-4">
          {selecionado ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800">{selecionado} de {MESES[mes]}</h3>
                <button onClick={() => setSelecionado(null)} className="text-slate-300 hover:text-slate-500">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {despesasDoDia(selecionado).length === 0 && (
                  <p className="text-sm text-slate-400">Sem lançamentos neste dia.</p>
                )}
                {despesasDoDia(selecionado).map((e) => (
                  <div key={e.id} className="rounded-2xl p-3" style={{ background: STATUS[e.status]?.soft || "#eee" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS[e.status]?.hex || "#666" }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: STATUS[e.status]?.hex || "#666" }}>
                        {STATUS[e.status]?.label || e.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{e.desc}</div>
                    <div className="text-lg font-bold text-slate-800">{BRL(e.valor)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-10">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Clique num dia para ver as despesas.</p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Legenda</p>
            <div className="space-y-1.5">
              {Object.values(STATUS).map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.hex }} />
                  <span className="text-xs text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}