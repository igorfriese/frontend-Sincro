async function iniciarTimeline() {
  const usuario = montarLayout({
    itemAtivo: "ordens",
    titulo: "Timeline do pedido",
    subtitulo: "Ciclo de vida completo do lote",
  });
  if (!usuario) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">Nenhum pedido informado na URL (?id=...).</div>`;
    return;
  }

  document.getElementById("page-content").innerHTML =
    `<div class="sy-card" style="padding:20px;">Carregando...</div>`;

  try {
    const pedido = await apiBuscarPedido(id);
    const eventos = await apiListarEventosDoPedido(id);
    const etapas = await carregarEtapas();
    const clientes = await apiListar("clientes");
    const clienteDoPedido = clientes.find((c) => c.nome === pedido.cliente);
    desenharTimeline(pedido, eventos, etapas, clienteDoPedido);
  } catch (erro) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">${erro.message}</div>`;
  }
}

function desenharTimeline(pedido, eventos, etapas, clienteDoPedido) {
  const sev = severidadePrazo(pedido.prazo);
  const badgeClasse =
    sev === "red"
      ? "sy-badge-red"
      : sev === "amber"
        ? "sy-badge-amber"
        : "sy-badge-green";
  const indiceAtual = etapas.findIndex((e) => e.chave === pedido.coluna);

  const stepsHtml = etapas
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

  const historicoHtml = eventos.length
    ? eventos
        .slice()
        .reverse()
        .map((ev) => {
          const etapaInfo = etapas.find((e) => e.chave === ev.etapa);
          return `
      <div class="tl-evento">
        <div class="tl-evento-dot" style="background:${etapaInfo ? etapaInfo.cor : "#5B4FC9"};"></div>
        <div><div class="tl-evento-etapa">${etapaInfo ? etapaInfo.nome : ev.etapa}</div>${ev.observacao ? `<div class="tl-evento-obs">${ev.observacao}</div>` : ""}</div>
        <div class="tl-evento-data">${formatarDataHora(ev.dataHora)}</div>
      </div>`;
        })
        .join("")
    : `<div class="tl-evento">Nenhum evento registrado ainda.</div>`;

  const idxAtualEtapa = etapas.findIndex((e) => e.chave === pedido.coluna);
  const jaFinalizado = idxAtualEtapa === etapas.length - 1;

  // Movimento entre etapas é livre — o dropdown mostra todas. A única
  // trava que resta é depois de já "Finalizado" (painel some, ver abaixo).
  const opcoesEtapaHtml = etapas
    .map(
      (e) =>
        `<option value="${e.chave}" ${e.chave === pedido.coluna ? "selected" : ""}>${e.nome}</option>`,
    )
    .join("");

  // O link agora é por CLIENTE — mostra todos os pedidos dele, não só este.
  const linkPublico = clienteDoPedido
    ? window.location.href.replace(/timeline\.html.*$/, "portal-cliente.html") +
      `?token=${clienteDoPedido.tokenAcompanhamento}`
    : null;

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card tl-header-card">
      <div>
        <div class="tl-op-numero">
          Pedido #${pedido.id}
          ${pedido.urgente ? `<span style="margin-left:8px;">${badgeUrgente()}</span>` : ""}
        </div>
        <div class="tl-cliente">${pedido.cliente}</div>
        <div class="tl-modelo">${pedido.modelo} — ${pedido.qtd} un.</div>
      </div>
      <div class="tl-header-info">
        <div class="tl-info-item"><div class="tl-info-label">Prazo</div><div class="tl-info-value">${formatarDataCurta(pedido.prazo)}</div></div>
        <div class="tl-info-item"><div class="tl-info-label">Situação</div><div class="tl-info-value"><span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${textoPrazo(pedido.prazo)}</span></div></div>
      </div>
    </div>

    <div class="sy-card" style="padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:240px;">
        <div class="login-label" style="margin-bottom:3px;">Link do cliente (mostra todos os pedidos dele)</div>
        <div id="tlLinkTexto" style="font-family:var(--sy-font-mono);font-size:12px;color:var(--sy-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${linkPublico || "Cliente não cadastrado — link indisponível"}</div>
      </div>
      ${linkPublico ? `<button class="kb-btn-new" id="tlCopiarLink" style="flex-shrink:0;">Copiar link</button>` : ""}
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;flex-shrink:0;">
        <input type="checkbox" id="tlUrgente" ${pedido.urgente ? "checked" : ""}> Marcar como urgente
      </label>
    </div>

    <div class="sy-card tl-timeline"><div class="tl-steps">${stepsHtml}</div></div>
    ${
      jaFinalizado
        ? `
    <div class="sy-card" style="margin-top:20px;padding:18px 20px;background:var(--sy-bg);">
      <p style="margin:0;font-size:13.5px;color:var(--sy-ink-soft);">Este pedido já está em <b>"${etapas[idxAtualEtapa].nome}"</b> — não pode mais mudar de etapa. Ele saiu do Kanban e fica registrado permanentemente no <a class="sy-card-link" href="historico.html">Histórico</a>.</p>
    </div>`
        : `
    <div class="sy-card" style="margin-top:20px;padding:18px 20px;">
      <h2 class="sy-card-title" style="margin-bottom:12px;">Registrar novo evento</h2>
      <div id="tlErro" class="sy-erro-banner" style="display:none;"></div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;"><label class="login-label">Etapa</label><select class="login-input" id="tlNovaEtapa" style="margin-bottom:0;">${opcoesEtapaHtml}</select></div>
        <div style="flex:2;min-width:220px;"><label class="login-label">Observação (opcional)</label><input class="login-input" id="tlObservacao" placeholder="Ex: pequeno atraso por falta de insumo" style="margin-bottom:0;"></div>
        <button class="kb-btn-new" id="tlRegistrar">Registrar</button>
      </div>
    </div>`
    }
    <div class="sy-card" style="margin-top:20px;"><div class="sy-card-header"><h2 class="sy-card-title">Histórico completo</h2></div><div class="tl-historico">${historicoHtml}</div></div>
  `;

  if (linkPublico) {
    document
      .getElementById("tlCopiarLink")
      .addEventListener("click", async () => {
        const botao = document.getElementById("tlCopiarLink");
        try {
          await navigator.clipboard.writeText(linkPublico);
          botao.textContent = "Copiado!";
        } catch {
          const range = document.createRange();
          range.selectNode(document.getElementById("tlLinkTexto"));
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          botao.textContent = "Seleciona e Ctrl+C";
        }
        setTimeout(() => {
          botao.textContent = "Copiar link";
        }, 2000);
      });
  }

  document
    .getElementById("tlUrgente")
    .addEventListener("change", async (ev) => {
      try {
        await apiAtualizarPedido(pedido.id, { urgente: ev.target.checked });
        pedido.urgente = ev.target.checked;
        desenharTimeline(pedido, eventos, etapas, clienteDoPedido);
      } catch (erro) {
        alert(`Não foi possível atualizar: ${erro.message}`);
        ev.target.checked = !ev.target.checked;
      }
    });

  const botaoRegistrar = document.getElementById("tlRegistrar");
  if (botaoRegistrar) {
    botaoRegistrar.addEventListener("click", async () => {
      const botao = document.getElementById("tlRegistrar");
      const erroBox = document.getElementById("tlErro");
      const novaEtapa = document.getElementById("tlNovaEtapa").value;
      const observacao = document.getElementById("tlObservacao").value.trim();

      // Defesa extra: revalida mesmo o dropdown já só mostrando opções
      // permitidas (ex: alguém poderia manipular o HTML na mão).
      const validacao = validarTransicaoEtapa(etapas, pedido.coluna, novaEtapa);
      if (!validacao.permitido) {
        erroBox.textContent = validacao.motivo;
        erroBox.style.display = "block";
        return;
      }

      botao.disabled = true;
      botao.textContent = "Registrando...";
      erroBox.style.display = "none";

      try {
        await apiCriarEvento({
          pedidoId: pedido.id,
          etapa: novaEtapa,
          observacao,
        });
        await apiAtualizarPedido(pedido.id, { coluna: novaEtapa });
        const pedidoAtualizado = await apiBuscarPedido(pedido.id);
        const eventosAtualizados = await apiListarEventosDoPedido(pedido.id);
        desenharTimeline(
          pedidoAtualizado,
          eventosAtualizados,
          etapas,
          clienteDoPedido,
        );
      } catch (erro) {
        erroBox.textContent = erro.message;
        erroBox.style.display = "block";
        botao.disabled = false;
        botao.textContent = "Registrar";
      }
    });
  }
}

iniciarTimeline();
