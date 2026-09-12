async function iniciarMeusPedidos() {
  const usuario = montarLayout({ itemAtivo: "meus-pedidos", titulo: "Meus Pedidos", subtitulo: "Lotes sob sua responsabilidade" });
  if (!usuario) return;

  let pedidos, etapas;
  try {
    pedidos = await apiListarPedidos();
    etapas = await carregarEtapas();
  } catch (erro) {
    document.getElementById("page-content").innerHTML = `<div class="sy-erro-banner">${erro.message}</div>`;
    return;
  }

  const chaveUltimaEtapa = etapas[etapas.length - 1]?.chave;

  const meus = pedidos
    .filter((p) => p.responsavelId === usuario.id)
    .sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || diasParaPrazo(a.prazo) - diasParaPrazo(b.prazo));

  const emAndamento = meus.filter((p) => p.coluna !== chaveUltimaEtapa).length;
  const atrasados = meus.filter((p) => severidadePrazo(p.prazo) === "red").length;

  document.getElementById("page-content").innerHTML = `
    <div class="al-resumo">
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Total de pedidos</div><div class="al-resumo-numero">${meus.length}</div></div>
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Em andamento</div><div class="al-resumo-numero" style="color:var(--sy-blue);">${emAndamento}</div></div>
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Atrasados</div><div class="al-resumo-numero" style="color:var(--sy-red);">${atrasados}</div></div>
    </div>
    <div class="al-busca"><input type="text" id="mpBusca" placeholder="Buscar por nº da OP ou cliente..."></div>
    <div class="sy-card"><div class="sy-card-header"><h2 class="sy-card-title">Meus pedidos</h2></div><div class="al-lista" id="mpLista"></div></div>
  `;

  function renderizarLista() {
    const termo = document.getElementById("mpBusca").value.trim().toLowerCase();
    const filtrados = termo
      ? meus.filter((p) => (p.cliente + " " + p.id).toLowerCase().includes(termo))
      : meus;

    document.getElementById("mpLista").innerHTML = filtrados.length ? filtrados.map((p) => {
      const sev = severidadePrazo(p.prazo);
      const badgeClasse = sev === "red" ? "sy-badge-red" : sev === "amber" ? "sy-badge-amber" : "sy-badge-green";
      const etapaInfo = etapas.find((e) => e.chave === p.coluna);
      return `
        <div class="al-item" onclick="window.location.href='timeline.html?id=${p.id}'">
          <div class="al-item-icone" style="background:${etapaInfo?.cor || '#5B4FC9'}22;color:${etapaInfo?.cor || '#5B4FC9'};">●</div>
          <div class="al-item-info">
            <div class="al-item-titulo">${p.urgente ? badgeUrgente() + " " : ""}Pedido #${p.id} — ${p.cliente}</div>
            <div class="al-item-sub">${p.modelo} • ${etapaInfo?.nome || p.coluna} • prazo: ${formatarDataCurta(p.prazo)}</div>
          </div>
          <span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${textoPrazo(p.prazo)}</span>
        </div>`;
    }).join("") : `<div class="al-vazio">${termo ? "Nenhum pedido encontrado pra essa busca." : "Nenhum pedido sob sua responsabilidade no momento."}</div>`;
  }

  document.getElementById("mpBusca").addEventListener("input", renderizarLista);
  renderizarLista();
}

iniciarMeusPedidos();
