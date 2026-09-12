async function iniciarAlertas() {
  const usuario = montarLayout({ itemAtivo: "alertas", titulo: "Alertas", subtitulo: "Lotes atrasados ou com prazo apertado" });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML = `<div class="sy-card" style="padding:20px;">Carregando...</div>`;

  let pedidos, etapas;
  try {
    pedidos = await apiListarPedidos();
    etapas = await carregarEtapas();
  } catch (erro) {
    document.getElementById("page-content").innerHTML = `<div class="sy-erro-banner">${erro.message}</div>`;
    return;
  }

  // Pedidos já finalizados saíram do fluxo ativo — não geram mais alerta.
  const etapaFinalObj = etapaFinal(etapas);
  const ativos = pedidos.filter((p) => p.coluna !== etapaFinalObj?.chave);

  const atrasados = ativos.filter((p) => severidadePrazo(p.prazo) === "red");
  const apertados = ativos.filter((p) => severidadePrazo(p.prazo) === "amber");
  const semMovimentacao = ativos.filter((p) => diasParaPrazo(p.prazo) < -3);
  const todosOrdenados = [...atrasados, ...apertados].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || diasParaPrazo(a.prazo) - diasParaPrazo(b.prazo));

  document.getElementById("page-content").innerHTML = `
    <div class="al-resumo">
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Ordens atrasadas</div><div class="al-resumo-numero" style="color:var(--sy-red);">${atrasados.length}</div></div>
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Prazo apertado</div><div class="al-resumo-numero" style="color:var(--sy-amber);">${apertados.length}</div></div>
      <div class="sy-card al-resumo-card"><div class="al-resumo-label">Sem movimentação recente</div><div class="al-resumo-numero">${semMovimentacao.length}</div></div>
    </div>
    <div class="al-busca"><input type="text" id="alBusca" placeholder="Buscar por nº da OP ou cliente..."></div>
    <div class="sy-card"><div class="sy-card-header"><h2 class="sy-card-title">Todos os alertas</h2></div><div class="al-lista" id="alLista"></div></div>
  `;

  function renderizarLista() {
    const termo = document.getElementById("alBusca").value.trim().toLowerCase();
    const filtrados = termo
      ? todosOrdenados.filter((p) => (p.cliente + " " + p.id).toLowerCase().includes(termo))
      : todosOrdenados;

    document.getElementById("alLista").innerHTML = filtrados.length ? filtrados.map((p) => {
      const sev = severidadePrazo(p.prazo);
      const icone = sev === "red" ? "⛔" : "⏰";
      const bg = sev === "red" ? "var(--sy-red-tint)" : "var(--sy-amber-tint)";
      const cor = sev === "red" ? "var(--sy-red)" : "var(--sy-amber)";
      const titulo = sev === "red" ? "Ordem atrasada" : "Prazo apertado";
      return `
        <div class="al-item" onclick="window.location.href='timeline.html?id=${p.id}'">
          <div class="al-item-icone" style="background:${bg};color:${cor};">${icone}</div>
          <div class="al-item-info">
            <div class="al-item-titulo">${p.urgente ? badgeUrgente() + " " : ""}${titulo} — Pedido #${p.id} (${p.cliente})</div>
            <div class="al-item-sub">${p.modelo} • ${textoPrazo(p.prazo)} • prazo: ${formatarDataCurta(p.prazo)}</div>
          </div>
        </div>`;
    }).join("") : `<div class="al-vazio">${termo ? "Nenhum alerta encontrado pra essa busca." : "Nenhum alerta no momento"}</div>`;
  }

  document.getElementById("alBusca").addEventListener("input", renderizarLista);
  renderizarLista();
}

iniciarAlertas();
