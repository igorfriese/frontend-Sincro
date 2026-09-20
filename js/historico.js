async function iniciarHistorico() {
  const usuario = montarLayout({
    itemAtivo: "historico",
    titulo: "Histórico",
    subtitulo: "Pedidos finalizados — não aparecem mais no Kanban",
  });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML =
    `<div class="sy-card" style="padding:20px;">Carregando...</div>`;

  let pedidos, etapas;
  try {
    pedidos = await apiListarPedidos();
    etapas = await carregarEtapas();
  } catch (erro) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">${erro.message}</div>`;
    return;
  }

  const etapaFinalObj = etapaFinal(etapas);
  const finalizados = pedidos
    .filter((p) => p.coluna === etapaFinalObj?.chave)
    .sort((a, b) => new Date(b.prazo) - new Date(a.prazo));

  document.getElementById("page-content").innerHTML = `
    <div class="al-resumo">
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Total finalizados</div><div class="al-resumo-numero" style="color:var(--sy-green);">${finalizados.length}</div></div>
    </div>
    <div class="al-busca"><input type="text" id="hBusca" placeholder="Buscar por nº da OP ou cliente..."></div>
    <div class="sy-card"><div class="sy-card-header"><h2 class="sy-card-title">Pedidos no Histórico</h2></div><div class="al-lista" id="hLista"></div></div>
  `;

  function renderizarLista() {
    const termo = document.getElementById("hBusca").value.trim().toLowerCase();
    const filtrados = termo
      ? finalizados.filter((p) =>
          (p.cliente + " " + p.id).toLowerCase().includes(termo),
        )
      : finalizados;

    document.getElementById("hLista").innerHTML = filtrados.length
      ? filtrados
          .map(
            (p) => `
      <div class="al-item" onclick="window.location.href='timeline.html?id=${p.id}'">
        <div class="al-item-icone" style="background:${etapaFinalObj.cor}22;color:${etapaFinalObj.cor};">✓</div>
        <div class="al-item-info">
          <div class="al-item-titulo">Pedido #${p.id} — ${p.cliente} ${p.urgente ? badgeUrgente() : ""}</div>
          <div class="al-item-sub">${p.modelo} • ${p.qtd} un. • prazo: ${formatarDataCurta(p.prazo)}</div>
        </div>
        <span class="sy-badge sy-badge-green"><span class="sy-dot"></span>${etapaFinalObj.nome}</span>
      </div>
    `,
          )
          .join("")
      : `<div class="al-vazio">${termo ? "Nenhum pedido encontrado pra essa busca." : "Nenhum pedido finalizado ainda."}</div>`;
  }

  document.getElementById("hBusca").addEventListener("input", renderizarLista);
  renderizarLista();
}

iniciarHistorico();
