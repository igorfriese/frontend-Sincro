let produtosCache = [];
let editandoIdProduto = null;

async function iniciarProdutos() {
  const usuario = montarLayout({
    itemAtivo: "produtos",
    titulo: "Produtos / Modelos",
    subtitulo: "Modelos de peça produzidos pela facção",
  });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML = `
    <div class="cd-toolbar">
      <div class="kb-search" style="max-width:280px;"><input type="text" id="fBusca" placeholder="Buscar por nome ou código..."></div>
      <button class="kb-btn-new" id="btnNovo">+ Novo produto</button>
    </div>
    <div id="erroBox" class="sy-erro-banner" style="display:none;"></div>
    <div class="sy-card">
      <table class="cd-table">
        <thead><tr><th>Código</th><th>Nome do modelo</th><th>Preço base</th><th></th></tr></thead>
        <tbody id="corpoTabela"></tbody>
      </table>
      <div id="vazio" class="cd-vazio" style="display:none;">Nenhum produto encontrado.</div>
    </div>

    <div class="cd-modal-fundo" id="modalFundo">
      <div class="sy-card cd-modal">
        <h2 class="sy-card-title" style="margin-bottom:14px;" id="modalTitulo">Novo produto</h2>
        <input class="login-input" id="fNome" placeholder="Nome do modelo">
        <input class="login-input" id="fPreco" placeholder="Preço base (R$)" type="number" step="0.01">
        <div class="cd-modal-botoes">
          <button class="kb-btn-new cancelar" id="btnCancelar">Cancelar</button>
          <button class="kb-btn-new" id="btnSalvar">Salvar</button>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("btnNovo")
    .addEventListener("click", () => abrirModal());
  document
    .getElementById("btnCancelar")
    .addEventListener("click", () =>
      document.getElementById("modalFundo").classList.remove("aberto"),
    );
  document.getElementById("btnSalvar").addEventListener("click", salvar);
  document.getElementById("fBusca").addEventListener("input", renderizarTabela);

  await carregar();
}

async function carregar() {
  const erroBox = document.getElementById("erroBox");
  try {
    produtosCache = await apiListar("produtos");
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar os produtos: ${erro.message}`;
    erroBox.style.display = "block";
    produtosCache = [];
  }
  renderizarTabela();
}

function renderizarTabela() {
  const termo = (document.getElementById("fBusca").value || "")
    .trim()
    .toLowerCase();
  const corpo = document.getElementById("corpoTabela");
  const vazio = document.getElementById("vazio");
  corpo.innerHTML = "";

  const filtrados = produtosCache.filter(
    (p) =>
      !termo ||
      p.nome.toLowerCase().includes(termo) ||
      (p.codigo || "").toLowerCase().includes(termo),
  );

  if (filtrados.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  filtrados.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="cl-chave">${p.codigo || "—"}</span></td>
      <td><b>${p.nome}</b></td>
      <td>R$ ${Number(p.precoBase).toFixed(2)}</td>
      <td>
        <div class="cd-acoes">
          <button class="cd-btn-icone" data-acao="editar" data-id="${p.id}">Editar</button>
          <button class="cd-btn-icone excluir" data-acao="excluir" data-id="${p.id}">Excluir</button>
        </div>
      </td>`;
    corpo.appendChild(tr);
  });

  corpo
    .querySelectorAll('[data-acao="editar"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => abrirModal(btn.dataset.id)),
    );
  corpo
    .querySelectorAll('[data-acao="excluir"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => excluir(btn.dataset.id)),
    );
}

function abrirModal(id = null) {
  editandoIdProduto = id;
  const produto = id ? produtosCache.find((p) => p.id === id) : null;
  document.getElementById("modalTitulo").textContent = id
    ? "Editar produto"
    : "Novo produto";
  document.getElementById("fNome").value = produto?.nome || "";
  document.getElementById("fPreco").value = produto?.precoBase || "";
  document.getElementById("modalFundo").classList.add("aberto");
}

async function salvar() {
  const dados = {
    nome: document.getElementById("fNome").value.trim(),
    precoBase: Number(document.getElementById("fPreco").value) || 0,
  };
  if (!dados.nome) {
    alert("O nome é obrigatório.");
    return;
  }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    if (editandoIdProduto)
      await apiAtualizarItem("produtos", editandoIdProduto, dados);
    else await apiCriarItem("produtos", dados);
    document.getElementById("modalFundo").classList.remove("aberto");
    await carregar();
  } catch (erro) {
    alert(`Não foi possível salvar: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
}

async function excluir(id) {
  const produto = produtosCache.find((p) => p.id === id);
  const pedidos = await apiListarTodosPedidos();
  const qtdPedidos = pedidos.filter((p) => p.modelo === produto.nome).length;
  if (qtdPedidos > 0) {
    alert(
      `Não é possível excluir "${produto.nome}": existem ${qtdPedidos} pedido(s) usando esse modelo.`,
    );
    return;
  }

  if (!confirm("Excluir este produto?")) return;
  try {
    await apiExcluirItem("produtos", id);
    await carregar();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

iniciarProdutos();
