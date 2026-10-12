let tokenAtual = null;
let etapasPortal = [];

function obterDiasParaPrazo(prazo) {
  if (!prazo) return null;

  const dataPrazo = new Date(prazo);

  if (Number.isNaN(dataPrazo.getTime())) {
    return null;
  }

  const hoje = new Date();

  hoje.setHours(0, 0, 0, 0);
  dataPrazo.setHours(0, 0, 0, 0);

  const diferenca = dataPrazo.getTime() - hoje.getTime();
  return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
}

function severidadePrazo(pedido) {
  const dias = obterDiasParaPrazo(pedido.prazo);

  if (dias === null) return "ok";
  if (dias < 0) return "red";
  if (dias <= 3) return "amber";

  return "ok";
}

function textoPrazo(prazo) {
  const dias = obterDiasParaPrazo(prazo);

  if (dias === null) return "Prazo indisponível";
  if (dias < 0) return `${Math.abs(dias)}d atrasado`;
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "1d p/ prazo";

  return `${dias}d p/ prazo`;
}

async function iniciarPortalCliente() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  tokenAtual = token;
  const conteudo = document.getElementById("conteudo");

  if (!token) {
    conteudo.innerHTML = `<div class="sy-erro-banner">Link inválido — token não informado.</div>`;
    return;
  }

  try {
    const { cliente, pedidos } = await apiAcompanharCliente(token);
    etapasPortal = await carregarEtapas();
    desenharPortal(cliente, pedidos);
  } catch (erro) {
    conteudo.innerHTML = `<div class="sy-erro-banner">${escaparHtml(erro.message)}</div>`;
  }
}

function desenharPortal(cliente, pedidos) {
  const listaHtml = pedidos.length
    ? pedidos.map((p) => criarLinhaPedido(p)).join("")
    : `<div class="sy-card" style="padding:24px;text-align:center;color:var(--sy-ink-soft);">Nenhum pedido encontrado para esse cliente.</div>`;

  document.getElementById("conteudo").innerHTML = `
    <div class="portal-caption">Acompanhamento em tempo real dos seus pedidos</div>
    <div class="sy-card" style="padding:18px 24px;margin-bottom:20px;">
      <div class="tl-cliente" style="font-size:17px;">${escaparHtml(cliente.nome)}</div>
      <div class="tl-modelo">${pedidos.length} pedido(s) no total</div>
    </div>
    <div id="portalLista">${listaHtml}</div>
  `;

  pedidos.forEach((p) => {
    const botao = document.getElementById(`portalToggle-${p.id}`);
    if (botao) botao.addEventListener("click", () => alternarPedido(p));
  });
}

function criarLinhaPedido(pedido) {
  // Pedido na última etapa já foi entregue: mostra "Concluído", não o atraso do prazo
  const concluido =
    etapasPortal.length > 0 &&
    pedido.coluna === etapasPortal[etapasPortal.length - 1].chave;
  const sev = concluido ? "ok" : severidadePrazo(pedido);
  const badgeClasse =
    sev === "red"
      ? "sy-badge-red"
      : sev === "amber"
        ? "sy-badge-amber"
        : "sy-badge-green";
  const textoSituacao = concluido ? "Concluído" : textoPrazo(pedido.prazo);
  const etapaInfo = etapasPortal.find((e) => e.chave === pedido.coluna);

  return `
    <div class="sy-card" style="margin-bottom:12px;overflow:hidden;">
      <div id="portalToggle-${pedido.id}" style="padding:16px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;">
        <div style="width:10px;height:10px;border-radius:50%;background:${etapaInfo?.cor || "#5B4FC9"};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div class="tl-cliente" style="font-size:14.5px;">
            Pedido #${pedido.id} — ${escaparHtml(pedido.modelo)}
            ${pedido.urgente ? `<span style="margin-left:6px;">${badgeUrgente()}</span>` : ""}
          </div>
          <div class="tl-modelo">${pedido.qtd} un. • ${escaparHtml(etapaInfo?.nome || pedido.coluna)}</div>
        </div>
        <span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${textoSituacao}</span>
        <span style="color:var(--sy-ink-soft);font-size:12px;">▾</span>
      </div>
      <div id="portalDetalhe-${pedido.id}" style="display:none;padding:0 20px 20px;"></div>
    </div>`;
}

async function alternarPedido(pedido) {
  const painel = document.getElementById(`portalDetalhe-${pedido.id}`);
  const aberto = painel.style.display !== "none";

  if (aberto) {
    painel.style.display = "none";
    return;
  }

  if (!painel.dataset.carregado) {
    let eventos;
    try {
      eventos = await apiEventosDoPedidoPublico(tokenAtual, pedido.id);
    } catch (erro) {
      painel.innerHTML = `<div class="sy-erro-banner" style="margin-top:10px;">${escaparHtml(erro.message)}</div>`;
      painel.style.display = "block";
      return;
    }
    const indiceAtual = etapasPortal.findIndex(
      (e) => e.chave === pedido.coluna,
    );

    const stepsHtml = etapasPortal
      .map((etapa, i) => {
        const eventoDaEtapa = eventos.find((ev) => ev.etapa === etapa.chave);
        let estado = "pendente";
        if (i < indiceAtual) estado = "concluido";
        // Na etapa final o pedido terminou: ela também aparece como concluída
        if (i === indiceAtual) estado = i === etapasPortal.length - 1 ? "concluido" : "atual";
        const icone = estado === "concluido" ? "✓" : i + 1;
        return `
        <div class="tl-step ${estado}">
          <div class="tl-step-line"></div>
          <div class="tl-step-dot">${icone}</div>
          <div class="tl-step-nome">${escaparHtml(etapa.nome)}</div>
          <div class="tl-step-data">${eventoDaEtapa ? formatarDataCurta(eventoDaEtapa.dataHora) : ""}</div>
        </div>`;
      })
      .join("");

    painel.innerHTML = `<div class="tl-steps" style="margin-top:10px;">${stepsHtml}</div>`;
    painel.dataset.carregado = "1";
  }

  painel.style.display = "block";
}

iniciarPortalCliente();
