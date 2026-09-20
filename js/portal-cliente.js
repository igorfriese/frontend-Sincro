let etapasPortal = [];

async function iniciarPortalCliente() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
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
    conteudo.innerHTML = `<div class="sy-erro-banner">${erro.message}</div>`;
  }
}

function desenharPortal(cliente, pedidos) {
  const abertos = pedidos.filter(
    (p) =>
      severidadePrazo(p.prazo) !== "ok" ||
      p.coluna !== etapasPortal[etapasPortal.length - 1]?.chave,
  );

  const listaHtml = pedidos.length
    ? pedidos.map((p) => criarLinhaPedido(p)).join("")
    : `<div class="sy-card" style="padding:24px;text-align:center;color:var(--sy-ink-soft);">Nenhum pedido encontrado para esse cliente.</div>`;

  document.getElementById("conteudo").innerHTML = `
    <div class="portal-caption">Acompanhamento em tempo real dos seus pedidos</div>
    <div class="sy-card" style="padding:18px 24px;margin-bottom:20px;">
      <div class="tl-cliente" style="font-size:17px;">${cliente.nome}</div>
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
  const sev = severidadePrazo(pedido.prazo);
  const badgeClasse =
    sev === "red"
      ? "sy-badge-red"
      : sev === "amber"
        ? "sy-badge-amber"
        : "sy-badge-green";
  const etapaInfo = etapasPortal.find((e) => e.chave === pedido.coluna);

  return `
    <div class="sy-card" style="margin-bottom:12px;overflow:hidden;">
      <div id="portalToggle-${pedido.id}" style="padding:16px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;">
        <div style="width:10px;height:10px;border-radius:50%;background:${etapaInfo?.cor || "#5B4FC9"};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div class="tl-cliente" style="font-size:14.5px;">
            Pedido #${pedido.id} — ${pedido.modelo}
            ${pedido.urgente ? `<span style="margin-left:6px;">${badgeUrgente()}</span>` : ""}
          </div>
          <div class="tl-modelo">${pedido.qtd} un. • ${etapaInfo?.nome || pedido.coluna}</div>
        </div>
        <span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${textoPrazo(pedido.prazo)}</span>
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
    const eventos = await apiEventosDoPedidoPublico(pedido.id);
    const indiceAtual = etapasPortal.findIndex(
      (e) => e.chave === pedido.coluna,
    );

    const stepsHtml = etapasPortal
      .map((etapa, i) => {
        const eventoDaEtapa = eventos.find((ev) => ev.etapa === etapa.chave);
        let estado = "pendente";
        if (i < indiceAtual) estado = "concluido";
        if (i === indiceAtual) estado = "atual";
        const icone = estado === "concluido" ? "✓" : i + 1;
        return `
        <div class="tl-step ${estado}">
          <div class="tl-step-line"></div>
          <div class="tl-step-dot">${icone}</div>
          <div class="tl-step-nome">${etapa.nome}</div>
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
