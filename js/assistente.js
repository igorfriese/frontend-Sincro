// NOTA: esta tela simula o Assistente de IA usando os dados reais da API
// (não é uma chamada de IA generativa de verdade — isso depende do backend
// com a integração Groq, que ainda não existe). O ponto que importa pra
// demonstração continua válido: a pergunta é respondida com dados já
// filtrados por permissão, nunca a IA "decidindo" o que esconder.

let usuarioAtual = null;
let etapasCache = [];

async function iniciarAssistente() {
  usuarioAtual = montarLayout({
    itemAtivo: "assistente",
    titulo: "Assistente (IA)",
    subtitulo: "Pergunte sobre prazos, produção e pedidos",
  });
  if (!usuarioAtual) return;

  etapasCache = await carregarEtapas();

  const sugestoes = [
    "Quais pedidos estão atrasados?",
    "Qual o prazo do pedido #3?",
    "Quantos pedidos estão em andamento?",
  ];
  if (usuarioAtual.perfil === "Administrador")
    sugestoes.push("Qual o faturamento do mês?");

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card as-wrap">
      <div class="as-aviso">Demonstração — as respostas usam dados reais da API, mas a geração de linguagem natural via IA (Groq) ainda não está integrada.</div>
      <div class="as-mensagens" id="asMensagens"></div>
      <div class="as-sugestoes" id="asSugestoes">
        ${sugestoes.map((s) => `<button class="as-sugestao" data-texto="${s}">${s}</button>`).join("")}
      </div>
      <div class="as-input-bar">
        <input type="text" id="asInput" placeholder="Digite sua pergunta...">
        <button class="kb-btn-new" id="asEnviar">Enviar</button>
      </div>
    </div>
  `;

  adicionarMensagem(
    "bot",
    `Oi, ${usuarioAtual.nome.split(" ")[0]}! Pode perguntar sobre prazos e pedidos.`,
  );

  document
    .getElementById("asEnviar")
    .addEventListener("click", enviarMensagemAtual);
  document.getElementById("asInput").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") enviarMensagemAtual();
  });
  document.querySelectorAll(".as-sugestao").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("asInput").value = btn.dataset.texto;
      enviarMensagemAtual();
    });
  });
}

function adicionarMensagem(tipo, texto, recusa = false) {
  const container = document.getElementById("asMensagens");
  const div = document.createElement("div");
  div.className = `as-msg ${tipo}${recusa ? " recusa" : ""}`;
  div.textContent = texto;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function enviarMensagemAtual() {
  const input = document.getElementById("asInput");
  const pergunta = input.value.trim();
  if (!pergunta) return;
  input.value = "";

  adicionarMensagem("usuario", pergunta);
  await responder(pergunta.toLowerCase());
}

async function responder(pergunta) {
  let pedidos;
  try {
    pedidos = await apiListarPedidos();
  } catch (erro) {
    adicionarMensagem(
      "bot",
      `Não consegui buscar os dados agora: ${erro.message}`,
      true,
    );
    return;
  }

  // apiListarPedidos já filtra por perfil (Vendedor só recebe os
  // próprios pedidos) — mesma regra do resto do sistema.
  if (pergunta.includes("atrasad")) {
    const atrasados = pedidos.filter((p) => severidadePrazo(p.prazo) === "red");
    if (atrasados.length === 0) {
      adicionarMensagem("bot", "Nenhum pedido atrasado no momento. 🎉");
    } else {
      const lista = atrasados
        .map((p) => `#${p.id} (${p.cliente}, ${textoPrazo(p.prazo)})`)
        .join(", ");
      adicionarMensagem(
        "bot",
        `${atrasados.length} pedido(s) atrasado(s): ${lista}.`,
      );
    }
    return;
  }

  if (pergunta.includes("andamento")) {
    const chaveUltimaEtapa = etapaFinal(etapasCache)?.chave;
    const emAndamento = pedidos.filter((p) => p.coluna !== chaveUltimaEtapa);
    adicionarMensagem(
      "bot",
      `Você tem ${emAndamento.length} pedido(s) em andamento no momento.`,
    );
    return;
  }

  const matchPedido = pergunta.match(/#?(\d+)/);
  if (pergunta.includes("prazo") && matchPedido) {
    const id = matchPedido[1];
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) {
      adicionarMensagem(
        "bot",
        `Não encontrei o pedido #${id} entre os que você tem acesso.`,
        true,
      );
    } else {
      adicionarMensagem(
        "bot",
        `O pedido #${pedido.id} (${pedido.cliente}) tem prazo pra ${formatarDataCurta(pedido.prazo)} — ${textoPrazo(pedido.prazo)}.`,
      );
    }
    return;
  }

  if (pergunta.includes("fatur")) {
    if (usuarioAtual.perfil !== "Administrador") {
      adicionarMensagem(
        "bot",
        "Essa informação é restrita ao perfil Administrador — não posso mostrar o faturamento pro seu perfil.",
        true,
      );
    } else {
      const produtos = await apiListar("produtos");
      const total = calcularFaturamento(pedidos, produtos);
      adicionarMensagem(
        "bot",
        `O faturamento estimado do mês é R$ ${total.toLocaleString("pt-BR")}.`,
      );
    }
    return;
  }

  adicionarMensagem(
    "bot",
    "Ainda não sei responder isso na demonstração — tenta perguntar sobre pedidos atrasados, prazos ou pedidos em andamento.",
  );
}

iniciarAssistente();
