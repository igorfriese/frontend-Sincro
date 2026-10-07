const PALETA_CORES = [
  "#3C3489",
  "#5B4FC9",
  "#8577E0",
  "#B06A12",
  "#1D9E75",
  "#2C7A57",
  "#C53434",
  "#3865C9",
  "#B0658A",
  "#6B6580",
];

let pedidosCache = [];
let etapasCache = [];
let usuarioAtualKanban = null;
let editandoEtapaId = null;
let corSelecionada = PALETA_CORES[0];

async function iniciarKanban() {
  usuarioAtualKanban = montarLayout({
    itemAtivo: "ordens",
    titulo: "Ordens de Produção",
    subtitulo: "Acompanhe cada lote pelo pipeline de produção",
  });
  if (!usuarioAtualKanban) return;

  const ehAdmin = usuarioAtualKanban.perfil === "Administrador";

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card kb-filterbar">
      <div class="kb-search"><input type="text" id="kbSearch" placeholder="Buscar por nº da OP ou cliente..."></div>
      <select class="kb-select" id="kbClienteFiltro"><option value="">Todos os clientes</option></select>
      <select class="kb-select" id="kbPrazoFiltro">
        <option value="">Qualquer prazo</option>
        <option value="red">Atrasadas</option>
        <option value="amber">Prazo apertado</option>
        <option value="ok">No prazo</option>
      </select>
      ${ehAdmin ? `<button class="kb-btn-new" type="button" id="kbConfigColunas" title="Configurar colunas" style="background:var(--sy-line);color:var(--sy-ink);padding:9px 12px;">⚙️</button>` : ""}
      <button class="kb-btn-new" type="button" id="kbNovaOrdem" onclick="window.location.href='ordem-form.html'">+ Nova ordem</button>
    </div>
    <div id="kbErro" class="sy-erro-banner" style="display:none;"></div>
    <div id="kbAvisoFinalizados"></div>
    <div class="kb-board" id="kbBoard"></div>

    <div class="cd-modal-fundo" id="modalColunasFundo">
      <div class="sy-card cd-modal" style="width:560px;max-width:90vw;">
        <h2 class="sy-card-title" style="margin-bottom:14px;">Configurar colunas do Kanban</h2>
        <div id="colunasErro" class="sy-erro-banner" style="display:none;"></div>
        <table class="cd-table" style="margin-bottom:14px;">
          <thead><tr><th>Ordem</th><th>Cor</th><th>Nome</th><th>Pedidos</th><th></th></tr></thead>
          <tbody id="corpoTabelaColunas"></tbody>
        </table>
        <button class="kb-btn-new" id="btnNovaColuna" style="width:100%;margin-bottom:10px;">+ Nova coluna</button>
        <button class="kb-btn-new" style="width:100%;background:var(--sy-line);color:var(--sy-ink);" id="btnFecharColunas">Fechar</button>
      </div>
    </div>

    <div class="cd-modal-fundo" id="modalEditarColunaFundo">
      <div class="sy-card cd-modal">
        <h2 class="sy-card-title" style="margin-bottom:14px;" id="modalEditarColunaTitulo">Nova coluna</h2>
        <input class="login-input" id="fNomeColuna" placeholder="Nome da etapa (ex: Bordado)">
        <div class="login-label">Cor</div>
        <div class="cl-cor-opcoes" id="corOpcoes"></div>
        <div id="modalEditarColunaErro" class="sy-erro-banner" style="display:none;"></div>
        <div class="cd-modal-botoes">
          <button class="kb-btn-new cancelar" id="btnCancelarColuna">Cancelar</button>
          <button class="kb-btn-new" id="btnSalvarColuna">Salvar</button>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("kbSearch")
    .addEventListener("input", renderizarBoard);
  document
    .getElementById("kbClienteFiltro")
    .addEventListener("change", renderizarBoard);
  document
    .getElementById("kbPrazoFiltro")
    .addEventListener("change", renderizarBoard);

  if (ehAdmin) {
    montarOpcoesDeCor();
    document
      .getElementById("kbConfigColunas")
      .addEventListener("click", abrirModalColunas);
    document
      .getElementById("btnFecharColunas")
      .addEventListener("click", () =>
        document.getElementById("modalColunasFundo").classList.remove("aberto"),
      );
    document
      .getElementById("btnNovaColuna")
      .addEventListener("click", () => abrirModalEditarColuna());
    document
      .getElementById("btnCancelarColuna")
      .addEventListener("click", () =>
        document
          .getElementById("modalEditarColunaFundo")
          .classList.remove("aberto"),
      );
    document
      .getElementById("btnSalvarColuna")
      .addEventListener("click", salvarColuna);
  }

  await carregarPedidos();
}

async function carregarPedidos() {
  const erroBox = document.getElementById("kbErro");
  try {
    pedidosCache = await apiListarPedidos();
    etapasCache = await apiListarEtapas();
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar as ordens: ${erro.message}`;
    erroBox.style.display = "block";
    pedidosCache = [];
    etapasCache = [];
  }
  popularFiltroClientes();
  renderizarBoard();
}

function popularFiltroClientes() {
  const select = document.getElementById("kbClienteFiltro");
  const atual = select.value;
  select.innerHTML = '<option value="">Todos os clientes</option>';
  [...new Set(pedidosCache.map((p) => p.cliente))].sort().forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
  select.value = atual;
}

function renderizarBoard() {
  const termo = document.getElementById("kbSearch").value.trim().toLowerCase();
  const cliente = document.getElementById("kbClienteFiltro").value;
  const prazoFiltro = document.getElementById("kbPrazoFiltro").value;

  const filtrados = pedidosCache.filter((p) => {
    if (cliente && p.cliente !== cliente) return false;
    if (termo && !(p.cliente + " " + p.id).toLowerCase().includes(termo))
      return false;
    if (prazoFiltro && severidadePrazo(p.prazo) !== prazoFiltro) return false;
    return true;
  });

  const board = document.getElementById("kbBoard");
  board.innerHTML = "";

  if (etapasCache.length === 0) {
    board.innerHTML = `<div class="kb-column-empty" style="padding:24px;">Nenhuma coluna configurada.</div>`;
    return;
  }

  // A ÚLTIMA etapa (ex: "Finalizado") não aparece no board — pedidos que
  // chegam nela saem do Kanban e só ficam visíveis no Histórico.
  const etapasVisiveis = etapasCache.slice(0, -1);
  const etapaFinalObj = etapasCache[etapasCache.length - 1];
  const etapaPenultimaObj = etapasCache[etapasCache.length - 2];

  const qtdFinalizados = pedidosCache.filter(
    (p) => p.coluna === etapaFinalObj?.chave,
  ).length;
  const avisoBox = document.getElementById("kbAvisoFinalizados");
  avisoBox.innerHTML =
    qtdFinalizados > 0
      ? `
    <div class="sy-card" style="padding:12px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;color:var(--sy-ink-soft);">${qtdFinalizados} pedido(s) finalizado(s) — não aparecem mais no Kanban.</span>
      <a class="sy-card-link" href="historico.html">Ver no Histórico →</a>
    </div>`
      : "";

  etapasVisiveis.forEach((etapa) => {
    const doPedidos = filtrados
      .filter((p) => p.coluna === etapa.chave)
      .sort(
        (a, b) =>
          (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) ||
          diasParaPrazo(a.prazo) - diasParaPrazo(b.prazo),
      );
    const coluna = document.createElement("div");
    coluna.className = "kb-column";
    coluna.style.setProperty("--kb-accent", etapa.cor);
    coluna.innerHTML = `
      <div class="kb-column-head"><span class="kb-column-dot"></span><span class="kb-column-name">${etapa.nome}</span><span class="kb-column-count">${doPedidos.length}</span></div>
      <div class="kb-column-body"></div>`;
    const corpo = coluna.querySelector(".kb-column-body");

    if (doPedidos.length === 0)
      corpo.innerHTML = `<div class="kb-column-empty">Nenhuma OP nesta etapa</div>`;
    else doPedidos.forEach((p) => corpo.appendChild(criarCard(p, etapa.cor)));

    corpo.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      corpo.classList.add("kb-drop-target");
    });
    corpo.addEventListener("dragleave", () =>
      corpo.classList.remove("kb-drop-target"),
    );
    corpo.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      corpo.classList.remove("kb-drop-target");
      const id = ev.dataTransfer.getData("text/plain");
      const pedido = pedidosCache.find((p) => p.id === id);
      if (!pedido || pedido.coluna === etapa.chave) return;

      const validacao = validarTransicaoEtapa(
        etapasCache,
        pedido.coluna,
        etapa.chave,
      );
      if (!validacao.permitido) {
        alert(`Movimento não permitido: ${validacao.motivo}`);
        return;
      }

      const colunaAnterior = pedido.coluna;
      pedido.coluna = etapa.chave;
      renderizarBoard();

      try {
        await apiAlterarEtapa(id, etapa.chave);
      } catch (erro) {
        pedido.coluna = colunaAnterior;
        renderizarBoard();

        alert(`Não foi possível mover a ordem: ${erro.message}`);
      }
    });

    board.appendChild(coluna);
  });
}

function criarCard(pedido, cor) {
  const sev = severidadePrazo(pedido.prazo);
  const badgeClasse =
    sev === "red"
      ? "sy-badge-red"
      : sev === "amber"
        ? "sy-badge-amber"
        : "sy-badge-green";
  const etapaUltima = etapasCache[etapasCache.length - 1];
  const etapaPenultima = etapasCache[etapasCache.length - 2];
  // Atalho de "marcar como finalizado" só aparece na penúltima etapa
  // (ex: "Entregue") — pra outra coluna, o pedido continua livre pra
  // ser arrastado pra qualquer lugar, só sem esse botão de atalho.
  const podeFinalizar =
    !!etapaPenultima && pedido.coluna === etapaPenultima.chave;

  const card = document.createElement("div");
  card.className = "kb-card" + (pedido.urgente ? " kb-card-urgente" : "");
  card.style.setProperty("--kb-accent", pedido.urgente ? "#C53434" : cor);
  card.draggable = true;
  card.innerHTML = `
    <div class="kb-card-top">
      <span class="kb-card-op">#${pedido.id}</span>
      <span class="sy-badge ${badgeClasse}"><span class="sy-dot"></span>${textoPrazo(pedido.prazo)}</span>
    </div>
    ${pedido.urgente ? `<div style="margin-bottom:6px;">${badgeUrgente()}</div>` : ""}
    <div class="kb-card-client">${pedido.cliente}</div>
    <div class="kb-card-model">${pedido.modelo}</div>
    <div class="kb-card-foot"><span class="kb-card-qty">${pedido.qtd} un.</span><span class="kb-card-qty">${formatarDataCurta(pedido.prazo)}</span></div>
    ${podeFinalizar ? `<button class="cd-btn-icone" data-acao-finalizar="${pedido.id}" style="width:100%;margin-top:8px;">Marcar como "${etapaUltima.nome}" →</button>` : ""}`;

  card.addEventListener(
    "click",
    () => (window.location.href = `timeline.html?id=${pedido.id}`),
  );
  card.addEventListener("dragstart", (ev) => {
    ev.dataTransfer.setData("text/plain", pedido.id);
    setTimeout(() => card.classList.add("kb-dragging"), 0);
  });
  card.addEventListener("dragend", () => card.classList.remove("kb-dragging"));

  if (podeFinalizar) {
    const botaoFinalizar = card.querySelector("[data-acao-finalizar]");
    botaoFinalizar.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (
        !confirm(
          `Marcar o pedido #${pedido.id} como "${etapaUltima.nome}"? Ele sairá do Kanban e ficará só no Histórico.`,
        )
      ) {
        return;
      }

      try {
        await apiAlterarEtapa(pedido.id, etapaUltima.chave);

        pedido.coluna = etapaUltima.chave;
        renderizarBoard();
      } catch (erro) {
        alert(`Não foi possível finalizar: ${erro.message}`);
      }
    });
  }

  return card;
}

// ===================================================================
// GESTÃO DE COLUNAS — modal aberto pela engrenagem, só Administrador
// ===================================================================

function abrirModalColunas() {
  renderizarTabelaColunas();
  document.getElementById("modalColunasFundo").classList.add("aberto");
}

function renderizarTabelaColunas() {
  const corpo = document.getElementById("corpoTabelaColunas");
  corpo.innerHTML = "";

  etapasCache.forEach((etapa, i) => {
    const qtdPedidos = pedidosCache.filter(
      (p) => p.coluna === etapa.chave,
    ).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cl-ordem-btns">
          <button data-acao="subir" data-id="${etapa.id}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button data-acao="descer" data-id="${etapa.id}" ${i === etapasCache.length - 1 ? "disabled" : ""}>▼</button>
        </div>
      </td>
      <td><span class="cl-swatch" style="background:${etapa.cor};"></span></td>
      <td><b>${etapa.nome}</b></td>
      <td>${qtdPedidos}</td>
      <td>
        <div class="cd-acoes">
          <button class="cd-btn-icone" data-acao="editar" data-id="${etapa.id}">Editar</button>
          <button class="cd-btn-icone excluir" data-acao="excluir" data-id="${etapa.id}">Excluir</button>
        </div>
      </td>`;
    corpo.appendChild(tr);
  });

  corpo
    .querySelectorAll('[data-acao="editar"]')
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        abrirModalEditarColuna(btn.dataset.id),
      ),
    );
  corpo
    .querySelectorAll('[data-acao="excluir"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => excluirColuna(btn.dataset.id)),
    );
  corpo
    .querySelectorAll('[data-acao="subir"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => moverColuna(btn.dataset.id, -1)),
    );
  corpo
    .querySelectorAll('[data-acao="descer"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => moverColuna(btn.dataset.id, 1)),
    );
}

function montarOpcoesDeCor() {
  const container = document.getElementById("corOpcoes");
  container.innerHTML = PALETA_CORES.map(
    (cor) =>
      `<div class="cl-cor-opcao" data-cor="${cor}" style="background:${cor};"></div>`,
  ).join("");
  container.querySelectorAll(".cl-cor-opcao").forEach((el) => {
    el.addEventListener("click", () => {
      corSelecionada = el.dataset.cor;
      atualizarSelecaoDeCor();
    });
  });
}

function atualizarSelecaoDeCor() {
  document.querySelectorAll(".cl-cor-opcao").forEach((el) => {
    el.classList.toggle("selecionada", el.dataset.cor === corSelecionada);
  });
}

function abrirModalEditarColuna(id = null) {
  editandoEtapaId = id;
  const etapa = id
    ? etapasCache.find((e) => String(e.id) === String(id))
    : null;

  document.getElementById("modalEditarColunaTitulo").textContent = id
    ? "Editar coluna"
    : "Nova coluna";
  document.getElementById("fNomeColuna").value = etapa?.nome || "";
  document.getElementById("modalEditarColunaErro").style.display = "none";
  corSelecionada =
    etapa?.cor || PALETA_CORES[etapasCache.length % PALETA_CORES.length];
  atualizarSelecaoDeCor();
  document.getElementById("modalEditarColunaFundo").classList.add("aberto");
}

function gerarChaveUnica(nome) {
  const base =
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "etapa";
  let chave = base,
    sufixo = 2;
  while (etapasCache.some((e) => e.chave === chave)) {
    chave = `${base}-${sufixo}`;
    sufixo++;
  }
  return chave;
}

async function salvarColuna() {
  const nome = document.getElementById("fNomeColuna").value.trim();
  const erroBox = document.getElementById("modalEditarColunaErro");

  if (!nome) {
    erroBox.textContent = "O nome é obrigatório.";
    erroBox.style.display = "block";
    return;
  }

  const botao = document.getElementById("btnSalvarColuna");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (editandoEtapaId) {
      const etapaAtual = etapasCache.find(
        (e) => String(e.id) === String(editandoEtapaId),
      );

      if (!etapaAtual) {
        throw new Error("Etapa não encontrada.");
      }

      await apiAtualizarEtapa(editandoEtapaId, {
        chave: etapaAtual.chave,
        nome,
        cor: corSelecionada,
        ordem: etapaAtual.ordem,
      });
    } else {
      const maiorOrdem = etapasCache.reduce(
        (max, e) => Math.max(max, e.ordem),
        0,
      );

      await apiCriarEtapa({
        chave: gerarChaveUnica(nome),
        nome,
        cor: corSelecionada,
        ordem: maiorOrdem + 1,
      });
    }
    document
      .getElementById("modalEditarColunaFundo")
      .classList.remove("aberto");
    etapasCache = await apiListarEtapas();
    renderizarTabelaColunas();
    renderizarBoard();
  } catch (erro) {
    erroBox.textContent = erro.message;
    erroBox.style.display = "block";
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
}

async function excluirColuna(id) {
  const etapa = etapasCache.find((e) => String(e.id) === String(id));
  const qtdPedidos = pedidosCache.filter(
    (p) => p.coluna === etapa.chave,
  ).length;

  if (qtdPedidos > 0) {
    alert(
      `Não é possível excluir "${etapa.nome}": existem ${qtdPedidos} pedido(s) nessa coluna. Move os pedidos pra outra coluna antes de excluir.`,
    );
    return;
  }
  if (!confirm(`Excluir a coluna "${etapa.nome}"?`)) return;

  try {
    await apiExcluirEtapa(id);
    etapasCache = await apiListarEtapas();
    renderizarTabelaColunas();
    renderizarBoard();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

async function moverColuna(id, direcao) {
  const indice = etapasCache.findIndex((e) => String(e.id) === String(id));
  const indiceVizinho = indice + direcao;
  if (indiceVizinho < 0 || indiceVizinho >= etapasCache.length) return;

  const atual = etapasCache[indice];
  const vizinho = etapasCache[indiceVizinho];

  try {
    await apiAtualizarEtapa(atual.id, {
      chave: atual.chave,
      nome: atual.nome,
      cor: atual.cor,
      ordem: vizinho.ordem,
    });

    await apiAtualizarEtapa(vizinho.id, {
      chave: vizinho.chave,
      nome: vizinho.nome,
      cor: vizinho.cor,
      ordem: atual.ordem,
    });

    etapasCache = await apiListarEtapas();
    renderizarTabelaColunas();
    renderizarBoard();
  } catch (erro) {
    alert(`Não foi possível reordenar: ${erro.message}`);
  }
}

iniciarKanban();
