import { useEffect, useState } from "react";
import {
  MessageSquare, Phone, Send, Trash2, Plus, RefreshCw,
  CheckCircle, Clock, AlertTriangle, Users,
} from "lucide-react";
import { apiWhatsappNumeros, apiWhatsappCadastrar, apiWhatsappDisparar, apiRdoList, apiProjetoContatos, apiProjetoRdos } from "@/lib/api";
import { useProjectContext } from "@/store/projectContext";

type NumeroWA = { id: string; telefone: string; nome: string; funcao: string; ns_id: number };
type RdoItem = Record<string, unknown>;

export function WhatsAppRdoPage() {
  const [numeros, setNumeros] = useState<NumeroWA[]>([]);
  const [rdos, setRdos] = useState<RdoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"numeros" | "rdos" | "config">("numeros");
  const activeProjectId = useProjectContext((s) => s.activeProjectId);

  // Form state
  const [novoTel, setNovoTel] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoFuncao, setNovoFuncao] = useState("apontador");
  const [novoNsId, setNovoNsId] = useState("1");

  async function refresh() {
    setLoading(true);
    try {
      const [nR, rR] = await Promise.allSettled([
        activeProjectId ? apiProjetoContatos(activeProjectId) : apiWhatsappNumeros(),
        activeProjectId ? apiProjetoRdos(activeProjectId) : apiRdoList(),
      ]);
      if (nR.status === "fulfilled") {
        const items = ((nR.value as any).items ?? []).map((c: any) => ({
          id: String(c.id),
          telefone: c.telefone ?? c.telefone_whatsapp ?? "",
          nome: c.nome ?? "-",
          funcao: c.funcao ?? c.cargo ?? c.alcada ?? "responsavel",
          ns_id: Number(c.ns_id ?? 1),
        }));
        setNumeros(items);
      }
      if (rR.status === "fulfilled") setRdos(((rR.value as any).items ?? []).slice(0, 20));
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [activeProjectId]);

  async function handleAdd() {
    if (!novoTel || !novoNome) { setMsg("Preencha telefone e nome"); return; }
    try {
      await apiWhatsappCadastrar({ ns_id: Number(novoNsId) || 1, telefone: novoTel, nome: novoNome, funcao: novoFuncao });
      setMsg(`Numero ${novoTel} cadastrado!`);
      setNovoTel(""); setNovoNome("");
      refresh();
    } catch (e: any) { setMsg(e.message); }
  }

  async function handleDisparar(nsId: number) {
    try {
      await apiWhatsappDisparar(nsId);
      setMsg(`Disparo enviado para NS ${nsId}`);
    } catch (e: any) { setMsg(e.message); }
  }

  const rdosHoje = rdos.filter((r: any) => {
    const d = r.data || r.date || "";
    return d.startsWith(new Date().toISOString().slice(0, 10));
  });
  const rdosPendentes = rdos.filter((r: any) => (r.status || "").toString().toLowerCase().includes("aberto"));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <MessageSquare size={22} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e4f2f8]">WhatsApp RDO</h1>
          <p className="text-sm text-[#5a8caa]">Gestao de RDOs preenchidos via WhatsApp</p>
        </div>
        <button onClick={refresh} className="ml-auto p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-[#2abfdc] transition-colors">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Numeros Cadastrados", value: numeros.length, icon: Users, color: "text-[#2abfdc]" },
          { label: "RDOs Hoje", value: rdosHoje.length, icon: CheckCircle, color: "text-green-400" },
          { label: "Pendentes", value: rdosPendentes.length, icon: Clock, color: "text-yellow-400" },
          { label: "Total RDOs", value: rdos.length, icon: MessageSquare, color: "text-[#8fb3c8]" },
        ].map((k, i) => (
          <div key={i} className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={16} className={k.color} />
              <span className="text-xs text-[#5a8caa]">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className="bg-[#14294e] border border-[#20406a] rounded-lg p-3 text-sm text-[#e4f2f8] flex items-center gap-2">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
          {msg}
          <button onClick={() => setMsg("")} className="ml-auto text-[#6b6b6b] hover:text-white">x</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#20406a] pb-1">
        {(["numeros", "rdos", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
            tab === t ? "bg-[#14294e] text-[#2abfdc] border border-[#20406a] border-b-transparent" : "text-[#6b6b6b] hover:text-[#8fb3c8]"
          }`}>
            {t === "numeros" ? "Numeros WhatsApp" : t === "rdos" ? "RDOs Recebidos" : "Configuracoes"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "numeros" && (
        <div className="space-y-4">
          {/* Add Form */}
          <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#2abfdc]">Cadastrar Novo Numero</h3>
            <div className="grid grid-cols-4 gap-3">
              <input placeholder="+5511999999999" value={novoTel} onChange={e => setNovoTel(e.target.value)}
                className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
              <input placeholder="Nome do responsavel" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
              <select value={novoFuncao} onChange={e => setNovoFuncao(e.target.value)}
                className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-sm text-[#e4f2f8]">
                <option value="encarregado">Encarregado</option>
                <option value="mestre">Mestre de Obras</option>
                <option value="apontador">Apontador</option>
                <option value="tecnico">Tecnico</option>
              </select>
              <div className="flex gap-2">
                <input placeholder="NS ID" type="number" value={novoNsId} onChange={e => setNovoNsId(e.target.value)}
                  className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-sm text-[#e4f2f8] w-20" />
                <button onClick={handleAdd}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 transition-colors">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {numeros.length ? numeros.map((n) => (
              <div key={n.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#e4f2f8]">{n.nome}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#20406a] text-[#8fb3c8]">{n.funcao}</span>
                  </div>
                  <span className="text-xs text-[#5a8caa] font-mono">{n.telefone}</span>
                  <span className="text-xs text-[#5a8caa] ml-2">NS #{n.ns_id}</span>
                </div>
                <button onClick={() => handleDisparar(n.ns_id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2abfdc]/10 text-[#2abfdc] hover:bg-[#2abfdc]/20 text-xs transition-colors">
                  <Send size={12} /> Disparar RDO
                </button>
              </div>
            )) : (
              <div className="text-center py-8 text-[#5a8caa]">Nenhum numero cadastrado ainda.</div>
            )}
          </div>
        </div>
      )}

      {tab === "rdos" && (
        <div className="space-y-2">
          {rdos.length ? rdos.slice(0, 20).map((r: any, i) => (
            <div key={r.id || i} className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#e4f2f8]">RDO {r.numero ?? r.id}</span>
                  <span className="text-xs text-[#5a8caa]">{r.data ?? "-"}</span>
                  <span className="text-xs text-[#5a8caa]">{r.nucleo ?? "-"}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  (r.status || "").toString().toLowerCase().includes("fech")
                    ? "bg-green-500/10 text-green-400"
                    : "bg-yellow-500/10 text-yellow-400"
                }`}>{r.status ?? "ABERTO"}</span>
              </div>
              <div className="mt-2 text-xs text-[#8fb3c8]">
                Resp: {r.responsavel ?? "-"} | Custo: R$ {Number(r.total_custo ?? 0).toLocaleString("pt-BR")} | Apontamentos: {(r.apontamentos ?? []).length}
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-[#5a8caa]">Nenhum RDO disponivel.</div>
          )}
        </div>
      )}

      {tab === "config" && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#2abfdc]">Configuracoes do WhatsApp RDO</h3>
          <div className="space-y-3 text-sm text-[#8fb3c8]">
            <div className="flex items-center justify-between p-3 bg-[#0d2040] rounded-lg border border-[#20406a]">
              <span>Disparo automatico diario (18h)</span>
              <span className="text-yellow-400">Em breve</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0d2040] rounded-lg border border-[#20406a]">
              <span>Parser de respostas</span>
              <span className="text-green-400">Regex local (0 tokens)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0d2040] rounded-lg border border-[#20406a]">
              <span>Webhook endpoint</span>
              <span className="text-[#2abfdc] font-mono text-xs">/webhook/whatsapp</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0d2040] rounded-lg border border-[#20406a]">
              <span>Formato de resposta</span>
              <span className="text-[#8fb3c8] font-mono text-xs">1:qtd 2:horas 3:atividades 4:equip 5:mat 6:ocorr 7:clima</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
