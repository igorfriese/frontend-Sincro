let clientesDisponiveis = [];
let produtosDisponiveis = [];
let usuariosDisponiveis = [];
let clienteSelecionado = null;
let produtoSelecionado = null;
let usuarioAtualForm = null;
let pedidoAtualColuna = null; // pedido novo: o servidor coloca na primeira etapa

async function iniciarFormOrdem() {
  const params = new URLSearchParams(window.location.search);
  const idEdicao = params.get("id");

  usuarioAtualForm = montarLayout({
    itemAtivo: "ordens",
    titulo: "Ordem de Produção",
    subtitulo: idEdicao ? "Alterar os dados da OP" : "Cadastro de uma nova OP",
  });
  if (!usuarioAtualForm) return;

  let pedidoAtual = null;
  try {
    [clientesDisponiveis, produtosDisponiveis] = await Promise.all([
      apiListarClientes(),
      apiListarProdutos(),
    ]);
    if (usuarioAtualForm.perfil !== "Vendedor")
      usuariosDisponiveis = await apiListarResponsaveis();

    if (idEdicao) {
      pedidoAtual = await apiBuscarPedido(idEdicao);
    }

    if (pedidoAtual?.coluna) {
      pedidoAtualColuna = pedidoAtual.coluna;
    }
  } catch (erro) {
    document.getElementById("page-content").innerHTML =
      `<div class="sy-erro-banner">${escaparHtml(erro.message)}</div>`;
    return;
  }

  // Pelo id, não pelo nome: dois clientes podem ter o mesmo nome
  clienteSelecionado = pedidoAtual
    ? clientesDisponiveis.find((c) => String(c.id) === String(pedidoAtual.clienteId)) || null
    : null;
  produtoSelecionado = pedidoAtual
    ? produtosDisponiveis.find((p) => String(p.id) === String(pedidoAtual.produtoId)) || null
    : null;

  const campoResponsavel =
    usuarioAtualForm.perfil === "Vendedor"
      ? `<input class="login-input" value="${escaparHtml(usuarioAtualForm.nome)} (você)" disabled style="opacity:.7;">`
      : `<select class="login-input" id="fResponsavel">
        <option value="">${idEdicao ? "Sem responsável" : "Selecione um responsável..."}</option>
        ${usuariosDisponiveis.map((u) => `<option value="${u.id}" ${pedidoAtual?.responsavelId === u.id ? "selected" : ""}>${escaparHtml(u.nome)} (${escaparHtml(u.role)})</option>`).join("")}
      </select>`;

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card" style="max-width:480px;padding:24px;">
      <h2 class="sy-card-title" style="margin-bottom:16px;">${idEdicao ? "Editar ordem #" + escaparHtml(pedidoAtual.id) : "Nova ordem de produção"}</h2>
      <div id="formErro" class="sy-erro-banner" style="display:none;"></div>

      <label class="login-label">Cliente</label>
      <div class="ac-wrap">
        <input class="login-input" id="fClienteBusca" placeholder="Digite o nome ou código do cliente..." autocomplete="off" value="${escaparHtml(pedidoAtual?.cliente || "")}">
        <div class="ac-lista" id="fClienteLista" style="display:none;"></div>
      </div>

      <label class="login-label">Modelo / produto</label>
      <div class="ac-wrap">
        <input class="login-input" id="fProdutoBusca" placeholder="Digite o nome ou código do produto..." autocomplete="off" value="${escaparHtml(pedidoAtual?.modelo || "")}">
        <div class="ac-lista" id="fProdutoLista" style="display:none;"></div>
      </div>

      <label class="login-label">Responsável</label>
      ${campoResponsavel}

      <label class="login-label">Quantidade (peças)</label>
      <input class="login-input" id="fQtd" type="number" min="1" max="100000" placeholder="Ex: 300" value="${pedidoAtual?.qtd || ""}">

      <label class="login-label">Prazo</label>
      <input class="login-input" id="fPrazo" type="date" ${idEdicao ? "" : `min="${hojeISO()}"`} value="${pedidoAtual?.prazo || ""}">

      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-bottom:16px;">
        <input type="checkbox" id="fUrgente" ${pedidoAtual?.urgente ? "checked" : ""}> Marcar como urgente
      </label>

      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="kb-btn-new" style="flex:1;background:var(--sy-line);color:var(--sy-ink);" id="btnCancelar">Cancelar</button>
        <button class="kb-btn-new" style="flex:1;" id="btnSalvar">${idEdicao ? "Salvar alterações" : "Criar ordem"}</button>
      </div>
    </div>
  `;

  // Editando: volta para a timeline do pedido; criando: volta para o Kanban
  const destinoVoltar = idEdicao ? `timeline.html?id=${encodeURIComponent(idEdicao)}` : "kanban.html";
  document.getElementById("btnCancelar").addEventListener("click", () => {
    window.location.href = destinoVoltar;
  });

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
    .addEventListener("click", () => salvar(idEdicao, destinoVoltar));
}

// Data de hoje no formato do <input type="date"> (yyyy-mm-dd), no fuso local
function hojeISO() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// Componente de busca com filtro: digita, filtra por nome OU código,
// mostra lista, clicar seleciona. Enter escolhe a primeira opção e, ao sair
// do campo, um nome/código digitado completo (ou uma única opção) já vale.
// Reaproveitado pra Cliente e Produto.
function configurarAutocomplete({
  inputId,
  listaId,
  itens,
  aoSelecionar,
  aoLimpar,
}) {
  const input = document.getElementById(inputId);
  const lista = document.getElementById(listaId);
  let selecionado = false;

  const filtrar = (termo) => {
    const termoBusca = termo.trim().toLowerCase();
    if (!termoBusca) return [];
    return itens.filter(
      (it) =>
        it.nome.toLowerCase().includes(termoBusca) ||
        (it.codigo || "").toLowerCase().includes(termoBusca),
    );
  };

  const selecionar = (item) => {
    input.value = item.nome;
    lista.style.display = "none";
    selecionado = true;
    aoSelecionar(item);
  };

  function renderizarLista(termo) {
    if (!termo.trim()) {
      lista.style.display = "none";
      return;
    }

    const filtrados = filtrar(termo).slice(0, 8);

    if (filtrados.length === 0) {
      lista.innerHTML = `<div class="ac-vazio">Nenhum resultado encontrado.</div>`;
    } else {
      lista.innerHTML = filtrados
        .map(
          (it) => `
        <div class="ac-item" data-id="${it.id}">
          <span>${escaparHtml(it.nome)}</span>
          <span class="ac-item-codigo">${escaparHtml(it.codigo || "")}</span>
        </div>`,
        )
        .join("");

      lista.querySelectorAll(".ac-item").forEach((el) => {
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault(); // evita o blur do input disparar antes do click
          selecionar(itens.find((it) => String(it.id) === el.dataset.id));
        });
      });
    }
    lista.style.display = "block";
  }

  // Campo de edição já vem preenchido com uma opção válida
  selecionado = !!input.value;

  input.addEventListener("input", () => {
    selecionado = false;
    aoLimpar();
    renderizarLista(input.value);
  });
  input.addEventListener("focus", () => {
    if (!selecionado) renderizarLista(input.value);
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    const primeiro = filtrar(input.value)[0];
    if (primeiro) {
      ev.preventDefault();
      selecionar(primeiro);
    }
  });
  input.addEventListener("blur", () =>
    setTimeout(() => {
      lista.style.display = "none";
      if (selecionado) return;
      const termo = input.value.trim().toLowerCase();
      const exato = itens.find(
        (it) => it.nome.toLowerCase() === termo || (it.codigo || "").toLowerCase() === termo,
      );
      const opcoes = filtrar(input.value);
      if (exato) selecionar(exato);
      else if (opcoes.length === 1) selecionar(opcoes[0]);
    }, 100),
  );
}

async function salvar(idEdicao, destinoVoltar) {
  const erroBox = document.getElementById("formErro");

  const responsavelId =
    usuarioAtualForm.perfil === "Vendedor"
      ? usuarioAtualForm.id
      : document.getElementById("fResponsavel").value;
  const qtd = Number(document.getElementById("fQtd").value);
  const prazo = document.getElementById("fPrazo").value;

  // Avisa tudo o que falta de uma vez, em vez de um campo por clique
  const faltando = [];
  if (!clienteSelecionado) faltando.push("cliente");
  if (!produtoSelecionado) faltando.push("produto");
  // Na edição dá para manter sem responsável (pedidos antigos podem não ter)
  if (!responsavelId && !idEdicao) faltando.push("responsável");
  if (!qtd || qtd < 1) faltando.push("quantidade");
  if (!prazo) faltando.push("prazo");

  if (faltando.length > 0) {
    // "cliente, produto e prazo"
    const lista = faltando.length > 1
      ? `${faltando.slice(0, -1).join(", ")} e ${faltando[faltando.length - 1]}`
      : faltando[0];
    const dica = !clienteSelecionado || !produtoSelecionado
      ? " Cliente e produto precisam ser escolhidos na lista de sugestões."
      : "";
    erroBox.textContent = `Falta preencher: ${lista}.${dica}`;
    erroBox.style.display = "block";
    return;
  }

  const dados = {
    clienteId: clienteSelecionado.id,
    produtoId: produtoSelecionado.id,
    qtd,
    prazo,
    urgente: document.getElementById("fUrgente").checked,
    responsavelId,
    coluna: pedidoAtualColuna,
  };

  erroBox.style.display = "none";
  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (idEdicao) {
      await apiAtualizarPedido(idEdicao, dados);
    } else {
      // O servidor já registra o evento "Ordem de produção criada."
      await apiCriarPedido(dados);
    }
    window.location.href = destinoVoltar;
  } catch (erro) {
    erroBox.textContent = erro.message;
    erroBox.style.display = "block";
    botao.disabled = false;
    botao.textContent = idEdicao ? "Salvar alterações" : "Criar ordem";
  }
}

iniciarFormOrdem();
