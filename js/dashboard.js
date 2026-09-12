const META_PRODUCAO_MES = 2500;

async function iniciarDashboard() {
  const usuario = montarLayout({ itemAtivo: "dashboard", titulo: "Dashboard", subtitulo: "Visão geral da operação" });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML = `<div class="sy-card" style="padding:20px;">Carregando...</div>`;

  let pedidos, etapas, produtos;
  try {
    [pedidos, etapas, produtos] = await Promise.all([apiListarPedidos(), carregarEtapas(), apiListar("produtos")]);
  } catch (erro) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">Não foi possível carregar os dados: ${erro.message}</div>`;
    return;
  }

  const chaveUltimaEtapa = etapas[etapas.length - 1]?.chave;

  const producaoDoMes = pedidos.reduce((s, p) => s + Number(p.qtd), 0);
  const percentualMeta = Math.min(100, Math.round((producaoDoMes / META_PRODUCAO_MES) * 100));
  const ordensEmAndamento = pedidos.filter((p) => p.coluna !== chaveUltimaEtapa).length;
  const lotesEmAtraso = pedidos.filter((p) => severidadePrazo(p.prazo) === "red").length;
  const faturamentoDoMes = calcularFaturamento(pedidos, produtos);
  const mostrarFaturamento = usuario.perfil === "Administrador";

  const raio = 60, circunferencia = 2 * Math.PI * raio;
  const progresso = circunferencia * (percentualMeta / 100);

  const totalPipeline = pedidos.length;
  // Etapas com 0 pedidos ficam de fora da barra — um <div> a 0% de
  // largura ainda ocupa espaço (min-width automático de flex item por
  // causa do texto "0" e da borda), o que quebrava o visual.
  const segmentosHtml = etapas
    .map((etapa) => ({ etapa, qtd: pedidos.filter((p) => p.coluna === etapa.chave).length }))
    .filter(({ qtd }) => qtd > 0)
    .map(({ etapa, qtd }) => {
      const largura = (qtd * 100) / totalPipeline;
      return `<div class="db-thread-seg" style="width:${largura}%;background:${etapa.cor};">${qtd}</div>`;
    }).join("");
  const legendaHtml = etapas.map((e) => `
    <div class="db-pipeline-legend-item"><div class="db-pipeline-swatch" style="background:${e.cor};"></div>${e.nome}</div>
  `).join("");

  const emAtencao = pedidos.filter((p) => p.coluna !== chaveUltimaEtapa && severidadePrazo(p.prazo) !== "ok")
    .sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || diasParaPrazo(a.prazo) - diasParaPrazo(b.prazo)).slice(0, 6);

  const linhasAtencaoHtml = emAtencao.length ? emAtencao.map((p) => {
    const sev = severidadePrazo(p.prazo);
    const badgeClasse = sev === "red" ? "sy-badge-red" : "sy-badge-amber";
    const badgeTexto = sev === "red" ? "Atrasado" : "Atenção";
    return `
      <div class="db-attention-row">
        <span class="db-attention-op">#${p.id}</span>
        <span class="db-attention-client">${p.urgente ? badgeUrgente() + " " : ""}${p.cliente}</span>
        <span class="db-attention-motivo">${p.modelo} — ${textoPrazo(p.prazo)}</span>
        <span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${badgeTexto}</span>
      </div>`;
  }).join("") : `<div class="db-attention-row"><span class="db-attention-motivo">Nenhum lote precisa de atenção agora</span></div>`;

  document.getElementById("page-content").innerHTML = `
    <div class="db-metrics">
      <div class="sy-card db-metric">
        <div class="db-metric-label">Produção do mês</div>
        <div class="db-metric-value">${producaoDoMes.toLocaleString("pt-BR")}<span style="font-size:15px;color:var(--sy-ink-soft);font-weight:500;"> peças</span></div>
        <div class="db-metric-foot"><span class="sy-badge sy-badge-blue"><span class="sy-dot"></span>${percentualMeta}% da meta</span></div>
      </div>
      <div class="sy-card db-metric">
        <div class="db-metric-label">Ordens em andamento</div>
        <div class="db-metric-value">${ordensEmAndamento}</div>
        <div class="db-metric-foot"><span class="sy-badge sy-badge-blue"><span class="sy-dot"></span>ativas no pipeline</span></div>
      </div>
      <div class="sy-card db-metric">
        <div class="db-metric-label">Lotes em atraso</div>
        <div class="db-metric-value">${lotesEmAtraso}</div>
        <div class="db-metric-foot"><span class="sy-badge sy-badge-red"><span class="sy-dot"></span>precisam de atenção</span></div>
      </div>
      ${mostrarFaturamento ? `
      <div class="sy-card db-metric">
        <div class="db-metric-label">Faturamento do mês</div>
        <div class="db-metric-value mono">R$ ${faturamentoDoMes.toLocaleString("pt-BR")}</div>
        <div class="db-metric-foot"><span class="sy-badge sy-badge-green"><span class="sy-dot"></span>dado restrito ao ADM</span></div>
      </div>` : ""}
    </div>
    <div class="db-row-2">
      <div class="sy-card db-donut-wrap">
        <div class="sy-card-header" style="padding:0;align-self:flex-start;"><h2 class="sy-card-title">Meta mensal</h2></div>
        <div class="db-donut-figure">
          <svg width="148" height="148" viewBox="0 0 148 148">
            <circle cx="74" cy="74" r="${raio}" fill="none" stroke="var(--sy-line)" stroke-width="14" />
            <circle cx="74" cy="74" r="${raio}" fill="none" stroke="#5B4FC9" stroke-width="14" stroke-linecap="round"
              transform="rotate(-90 74 74)" stroke-dasharray="${progresso.toFixed(1)} ${circunferencia.toFixed(1)}" />
          </svg>
          <div class="db-donut-center"><div class="db-donut-pct">${percentualMeta}%</div><div class="db-donut-caption">da meta</div></div>
        </div>
        <div class="db-donut-legend"><b>${producaoDoMes.toLocaleString("pt-BR")}</b> de <b>${META_PRODUCAO_MES.toLocaleString("pt-BR")}</b> peças</div>
      </div>
      <div class="sy-card db-pipeline">
        <div class="sy-card-header" style="padding:0;">
          <h2 class="sy-card-title">Ordens por etapa</h2>
          <a class="sy-card-link" href="kanban.html">Ver Ordens de Produção →</a>
        </div>
        <div class="db-thread-track">${segmentosHtml}</div>
        <div class="db-pipeline-legend">${legendaHtml}</div>
      </div>
    </div>
    <div class="sy-card">
      <div class="sy-card-header"><h2 class="sy-card-title">Lotes que precisam de atenção</h2><a class="sy-card-link" href="alertas.html">Ver todos os alertas →</a></div>
      <div class="db-attention-list">${linhasAtencaoHtml}</div>
    </div>
  `;
}

iniciarDashboard();
