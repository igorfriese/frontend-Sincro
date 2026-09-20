let clientesDisponiveis = [];
let produtosDisponiveis = [];
let usuariosDisponiveis = [];
let clienteSelecionado = null;
let produtoSelecionado = null;
let usuarioAtualForm = null;

async function iniciarFormOrdem() {
  usuarioAtualForm = montarLayout({
    itemAtivo: "ordens",
    titulo: "Ordem de Produção",
    subtitulo: "Cadastro de uma nova OP",
  });
  if (!usuarioAtualForm) return;

  const params = new URLSearchParams(window.location.search);
  const idEdicao = params.get("id");

  let pedidoAtual = null;
  try {
    [clientesDisponiveis, produtosDisponiveis] = await Promise.all([
      apiListar("clientes"),
      apiListar("produtos"),
    ]);
    if (usuarioAtualForm.perfil !== "Vendedor")
      usuariosDisponiveis = await apiListar("usuarios");
    if (idEdicao) pedidoAtual = await apiBuscarPedido(idEdicao);
  } catch (erro) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">${erro.message}</div>`;
    return;
  }

  clienteSelecionado = pedidoAtual
    ? clientesDisponiveis.find((c) => c.nome === pedidoAtual.cliente) || null
    : null;
  produtoSelecionado = pedidoAtual
    ? produtosDisponiveis.find((p) => p.nome === pedidoAtual.modelo) || null
    : null;

  const campoResponsavel =
    usuarioAtualForm.perfil === "Vendedor"
      ? `<input class="login-input" value="${usuarioAtualForm.nome} (você)" disabled style="opacity:.7;">`
      : `<select class="login-input" id="fResponsavel">
        <option value="">Selecione um responsável...</option>
        ${usuariosDisponiveis.map((u) => `<option value="${u.id}" ${pedidoAtual?.responsavelId === u.id ? "selected" : ""}>${u.nome} (${u.perfil})</option>`).join("")}
      </select>`;

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card" style="max-width:480px;padding:24px;">
      <h2 class="sy-card-title" style="margin-bottom:16px;">${idEdicao ? "Editar ordem #" + idEdicao : "Nova ordem de produção"}</h2>
      <div id="formErro" class="sy-erro-banner" style="display:none;"></div>

      <label class="login-label">Cliente</label>
      <div class="ac-wrap">
        <input class="login-input" id="fClienteBusca" placeholder="Digite o nome ou código do cliente..." autocomplete="off" value="${pedidoAtual?.cliente || ""}">
        <div class="ac-lista" id="fClienteLista" style="display:none;"></div>
      </div>

      <label class="login-label">Modelo / produto</label>
      <div class="ac-wrap">
        <input class="login-input" id="fProdutoBusca" placeholder="Digite o nome ou código do produto..." autocomplete="off" value="${pedidoAtual?.modelo || ""}">
        <div class="ac-lista" id="fProdutoLista" style="display:none;"></div>
      </div>

      <label class="login-label">Responsável</label>
      ${campoResponsavel}

      <label class="login-label">Quantidade</label>
      <input class="login-input" id="fQtd" type="number" value="${pedidoAtual?.qtd || ""}">

      <label class="login-label">Prazo</label>
      <input class="login-input" id="fPrazo" type="date" value="${pedidoAtual?.prazo || ""}">

      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-bottom:16px;">
        <input type="checkbox" id="fUrgente" ${pedidoAtual?.urgente ? "checked" : ""}> Marcar como urgente
      </label>

      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="kb-btn-new" style="flex:1;background:var(--sy-line);color:var(--sy-ink);" onclick="window.location.href='kanban.html'">Cancelar</button>
        <button class="kb-btn-new" style="flex:1;" id="btnSalvar">${idEdicao ? "Salvar alterações" : "Criar ordem"}</button>
      </div>
    </div>
  `;

  configurarAutocomplete({
    inputId: "fClienteBusca",
    listaId: "fClienteLista",
    itens: clientesDisponiveis,
    aoSelecionar: (item) => {
      clienteSelecionado = item;
    },
    aoLimpar: () => {
      clienteSelecionado = null;
    },
  });

  configurarAutocomplete({
    inputId: "fProdutoBusca",
    listaId: "fProdutoLista",
    itens: produtosDisponiveis,
    aoSelecionar: (item) => {
      produtoSelecionado = item;
    },
    aoLimpar: () => {
      produtoSelecionado = null;
    },
  });

  document
    .getElementById("btnSalvar")
    .addEventListener("click", () => salvar(idEdicao));
}

// Componente de busca com filtro: digita, filtra por nome OU código,
// mostra lista, clicar seleciona. Reaproveitado pra Cliente e Produto.
function configurarAutocomplete({
  inputId,
  listaId,
  itens,
  aoSelecionar,
  aoLimpar,
}) {
  const input = document.getElementById(inputId);
  const lista = document.getElementById(listaId);

  function renderizarLista(termo) {
    const termoBusca = termo.trim().toLowerCase();
    if (!termoBusca) {
      lista.style.display = "none";
      return;
    }

    const filtrados = itens
      .filter(
        (it) =>
          it.nome.toLowerCase().includes(termoBusca) ||
          (it.codigo || "").toLowerCase().includes(termoBusca),
      )
      .slice(0, 8);

    if (filtrados.length === 0) {
      lista.innerHTML = `<div class="ac-vazio">Nenhum resultado encontrado.</div>`;
    } else {
      lista.innerHTML = filtrados
        .map(
          (it) => `
        <div class="ac-item" data-id="${it.id}">
          <span>${it.nome}</span>
          <span class="ac-item-codigo">${it.codigo || ""}</span>
        </div>`,
        )
        .join("");

      lista.querySelectorAll(".ac-item").forEach((el) => {
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault(); // evita o blur do input disparar antes do click
          const item = itens.find((it) => it.id === el.dataset.id);
          input.value = item.nome;
          lista.style.display = "none";
          aoSelecionar(item);
        });
      });
    }
    lista.style.display = "block";
  }

  input.addEventListener("input", () => {
    aoLimpar();
    renderizarLista(input.value);
  });
  input.addEventListener("focus", () => renderizarLista(input.value));
  input.addEventListener("blur", () =>
    setTimeout(() => {
      lista.style.display = "none";
    }, 100),
  );
}

async function salvar(idEdicao) {
  const erroBox = document.getElementById("formErro");

  if (!clienteSelecionado) {
    erroBox.textContent =
      "Seleciona um cliente da lista (digita e clica numa opção).";
    erroBox.style.display = "block";
    return;
  }
  if (!produtoSelecionado) {
    erroBox.textContent =
      "Seleciona um produto da lista (digita e clica numa opção).";
    erroBox.style.display = "block";
    return;
  }

  const responsavelId =
    usuarioAtualForm.perfil === "Vendedor"
      ? usuarioAtualForm.id
      : document.getElementById("fResponsavel").value;

  if (!responsavelId) {
    erroBox.textContent = "Seleciona um responsável pela ordem.";
    erroBox.style.display = "block";
    return;
  }

  const dados = {
    cliente: clienteSelecionado.nome,
    modelo: produtoSelecionado.nome,
    qtd: Number(document.getElementById("fQtd").value),
    prazo: document.getElementById("fPrazo").value,
    urgente: document.getElementById("fUrgente").checked,
    responsavelId,
  };

  if (!dados.qtd || !dados.prazo) {
    erroBox.textContent = "Preenche quantidade e prazo.";
    erroBox.style.display = "block";
    return;
  }

  erroBox.style.display = "none";
  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (idEdicao) {
      await apiAtualizarPedido(idEdicao, dados);
    } else {
      const criado = await apiCriarPedido(dados);
      await apiCriarEvento({
        pedidoId: criado.id,
        etapa: criado.coluna,
        observacao: "Ordem de produção criada.",
      });
    }
    window.location.href = "kanban.html";
  } catch (erro) {
    erroBox.textContent = erro.message;
    erroBox.style.display = "block";
    botao.disabled = false;
    botao.textContent = idEdicao ? "Salvar alterações" : "Criar ordem";
  }
}

iniciarFormOrdem();
