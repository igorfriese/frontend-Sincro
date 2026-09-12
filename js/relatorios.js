let usuarioRelatorios = null;
let etapaFinalNomeCache = "";
let ultimoConjuntoFiltrado = []; // guardado pra reaproveitar na exportação sem recalcular

async function iniciarRelatorios() {
  usuarioRelatorios = montarLayout({ itemAtivo: "relatorios", titulo: "Relatórios", subtitulo: "Produção e pontualidade por período" });
  if (!usuarioRelatorios) return;

  if (!["Administrador", "Gestor"].includes(usuarioRelatorios.perfil)) {
    document.getElementById("page-content").innerHTML = `<div class="sy-erro-banner">Esta tela é restrita aos perfis Administrador e Gestor.</div>`;
    return;
  }

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card rl-filtrobar">
      <div class="rl-filtro-campo">
        <label for="rlDataDe">De</label>
        <input type="date" id="rlDataDe">
      </div>
      <div class="rl-filtro-campo">
        <label for="rlDataAte">Até</label>
        <input type="date" id="rlDataAte">
      </div>
      <div class="rl-filtro-acoes">
        <button class="kb-btn-new" style="background:var(--sy-line);color:var(--sy-ink);" id="rlLimpar">Limpar período</button>
        <button class="kb-btn-new" id="rlAplicar">Aplicar</button>
        <button class="kb-btn-new" id="rlExportar">⬇ Exportar CSV</button>
      </div>
    </div>
    <div id="rlErro" class="sy-erro-banner" style="display:none;"></div>
    <div id="rlConteudo"><div class="sy-card" style="padding:20px;">Carregando...</div></div>
  `;

  document.getElementById("rlAplicar").addEventListener("click", () => carregarRelatorio());
  document.getElementById("rlLimpar").addEventListener("click", () => {
    document.getElementById("rlDataDe").value = "";
    document.getElementById("rlDataAte").value = "";
    carregarRelatorio();
  });
  document.getElementById("rlExportar").addEventListener("click", exportarCsv);

  await carregarRelatorio();
}

async function carregarRelatorio() {
  const erroBox = document.getElementById("rlErro");
  const dataDe = document.getElementById("rlDataDe").value;
  const dataAte = document.getElementById("rlDataAte").value;

  let pedidos, eventos, etapas;
  try {
    pedidos = await apiListarPedidos();
    eventos = await apiListar("eventos");
    etapas = await carregarEtapas();
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar os dados: ${erro.message}`;
    erroBox.style.display = "block";
    return;
  }

  const etapaFinalObj = etapaFinal(etapas);
  const etapaInicialObj = etapas[0];
  etapaFinalNomeCache = etapaFinalObj?.nome || "";

  // Pra cada pedido finalizado, acha a data em que ele CHEGOU na etapa
  // final (evento mais recente com essa etapa) — é isso que define se
  // ele entra no período filtrado e se foi pontual ou não.
  const finalizadosComData = pedidos
    .filter((p) => p.coluna === etapaFinalObj?.chave)
    .map((p) => {
      const eventosDoPedido = eventos.filter((e) => e.pedidoId === p.id);
      const eventoConclusao = eventosDoPedido
        .filter((e) => e.etapa === etapaFinalObj.chave)
        .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))[0];
      const eventoInicio = eventosDoPedido
        .filter((e) => e.etapa === etapaInicialObj?.chave)
        .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))[0];

      return {
        ...p,
        concluidoEm: eventoConclusao?.dataHora || null,
        iniciadoEm: eventoInicio?.dataHora || null,
      };
    })
    .filter((p) => p.concluidoEm); // sem data de conclusão registrada, não entra no relatório

  const filtrados = finalizadosComData.filter((p) => {
    const dataConclusaoStr = p.concluidoEm.split("T")[0];
    if (dataDe && dataConclusaoStr < dataDe) return false;
    if (dataAte && dataConclusaoStr > dataAte) return false;
    return true;
  });

  ultimoConjuntoFiltrado = filtrados;
  renderizarRelatorio(filtrados);
}

function renderizarRelatorio(pedidos) {
  const conteudo = document.getElementById("rlConteudo");

  if (pedidos.length === 0) {
    conteudo.innerHTML = `<div class="sy-card rl-vazio">Nenhum pedido finalizado no período selecionado.</div>`;
    return;
  }

  const totalProduzido = pedidos.reduce((s, p) => s + Number(p.qtd), 0);
  const pontuais = pedidos.filter((p) => new Date(p.concluidoEm) <= new Date(p.prazo + "T23:59:59"));
  const atrasados = pedidos.filter((p) => !pontuais.includes(p));
  const percentualPontualidade = Math.round((pontuais.length / pedidos.length) * 100);

  const comTempoDeProducao = pedidos.filter((p) => p.iniciadoEm);
  const tempoMedioDias = comTempoDeProducao.length
    ? Math.round(
        comTempoDeProducao.reduce((s, p) => s + (new Date(p.concluidoEm) - new Date(p.iniciadoEm)), 0) /
        comTempoDeProducao.length / 86400000
      )
    : null;

  // Produção por cliente (top 6), pra o gráfico de barras
  const porCliente = {};
  pedidos.forEach((p) => { porCliente[p.cliente] = (porCliente[p.cliente] || 0) + Number(p.qtd); });
  const rankingClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maiorValorCliente = rankingClientes[0]?.[1] || 1;

  const barrasHtml = rankingClientes.map(([cliente, qtd]) => `
    <div class="rl-bar-row">
      <div class="rl-bar-label">${cliente}</div>
      <div class="rl-bar-track"><div class="rl-bar-fill" style="width:${(qtd / maiorValorCliente) * 100}%;"></div></div>
      <div class="rl-bar-valor">${qtd.toLocaleString("pt-BR")} un.</div>
    </div>
  `).join("");

  const linhasTabela = pedidos
    .slice()
    .sort((a, b) => new Date(b.concluidoEm) - new Date(a.concluidoEm))
    .map((p) => {
      const pontual = pontuais.includes(p);
      const badge = pontual
        ? `<span class="sy-badge sy-badge-green"><span class="sy-dot"></span>No prazo</span>`
        : `<span class="sy-badge sy-badge-red"><span class="sy-dot"></span>Atrasado</span>`;
      return `
        <tr>
          <td><span class="cl-chave">#${p.id}</span></td>
          <td><b>${p.cliente}</b></td>
          <td>${p.modelo}</td>
          <td>${p.qtd}</td>
          <td>${formatarDataCurta(p.prazo)}</td>
          <td>${formatarDataCurta(p.concluidoEm)}</td>
          <td>${badge}</td>
        </tr>`;
    }).join("");

  conteudo.innerHTML = `
    <div class="rl-metrics">
      <div class="sy-card rl-metric">
        <div class="rl-metric-label">Total produzido</div>
        <div class="rl-metric-value">${totalProduzido.toLocaleString("pt-BR")}<span style="font-size:14px;color:var(--sy-ink-soft);font-weight:500;"> peças</span></div>
        <div class="rl-metric-sub">${pedidos.length} pedido(s) finalizado(s)</div>
      </div>
      <div class="sy-card rl-metric">
        <div class="rl-metric-label">Pontualidade</div>
        <div class="rl-metric-value">${percentualPontualidade}%</div>
        <div class="rl-metric-sub">${pontuais.length} no prazo · ${atrasados.length} atrasado(s)</div>
      </div>
      <div class="sy-card rl-metric">
        <div class="rl-metric-label">Tempo médio de produção</div>
        <div class="rl-metric-value mono">${tempoMedioDias !== null ? tempoMedioDias : "—"}${tempoMedioDias !== null ? '<span style="font-size:14px;color:var(--sy-ink-soft);font-weight:500;"> dias</span>' : ""}</div>
        <div class="rl-metric-sub">do início ao "${etapaFinalNomeCache || "final"}"</div>
      </div>
      <div class="sy-card rl-metric">
        <div class="rl-metric-label">Ticket médio</div>
        <div class="rl-metric-value">${Math.round(totalProduzido / pedidos.length).toLocaleString("pt-BR")}<span style="font-size:14px;color:var(--sy-ink-soft);font-weight:500;"> un/pedido</span></div>
        <div class="rl-metric-sub">peças por ordem de produção</div>
      </div>
    </div>

    <div class="sy-card" style="padding:20px;margin-bottom:20px;">
      <h2 class="sy-card-title" style="margin-bottom:16px;">Produção por cliente</h2>
      ${barrasHtml}
    </div>

    <div class="sy-card">
      <div class="sy-card-header"><h2 class="sy-card-title">Pedidos finalizados no período</h2></div>
      <table class="cd-table">
        <thead><tr><th>OP</th><th>Cliente</th><th>Modelo</th><th>Qtd</th><th>Prazo</th><th>Concluído em</th><th>Situação</th></tr></thead>
        <tbody>${linhasTabela}</tbody>
      </table>
    </div>
  `;
}

function exportarCsv() {
  if (ultimoConjuntoFiltrado.length === 0) {
    alert("Não há dados no período selecionado pra exportar.");
    return;
  }

  const cabecalho = ["OP", "Cliente", "Modelo", "Quantidade", "Prazo", "Concluido_em", "Situacao"];
  const linhas = ultimoConjuntoFiltrado.map((p) => {
    const pontual = new Date(p.concluidoEm) <= new Date(p.prazo + "T23:59:59");
    return [
      p.id,
      p.cliente,
      p.modelo,
      p.qtd,
      p.prazo,
      p.concluidoEm.split("T")[0],
      pontual ? "No prazo" : "Atrasado",
    ].map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(";");
  });

  const csv = [cabecalho.join(";"), ...linhas].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-producao-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

iniciarRelatorios();
