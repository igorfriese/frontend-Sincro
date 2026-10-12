let produtosCache = [];
let editandoIdProduto = null;
// Cadastrar/editar: Administrador e Gestor. Excluir: só Administrador.
let podeEditarProdutos = false;
let podeExcluirProdutos = false;

async function iniciarProdutos() {
  const usuario = montarLayout({
    itemAtivo: "produtos",
    titulo: "Produtos / Modelos",
    subtitulo: "Modelos de peça produzidos pela facção",
  });
  if (!usuario) return;

  podeEditarProdutos = ["Administrador", "Gestor"].includes(usuario.perfil);
  podeExcluirProdutos = usuario.perfil === "Administrador";

  document.getElementById("page-content").innerHTML = `
    <div class="cd-toolbar">
      <div class="kb-search" style="max-width:280px;"><input type="text" id="fBusca" placeholder="Buscar por nome ou código..."></div>
      ${podeEditarProdutos ? `<button class="kb-btn-new" id="btnNovo">+ Novo produto</button>` : ""}
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
        <input class="login-input" id="fDescricao" placeholder="Descrição (opcional)">
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
    ?.addEventListener("click", () => abrirModal());
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
    produtosCache = await apiListarProdutos();
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
      <td><span class="cl-chave">${escaparHtml(p.codigo || "—")}</span></td>
      <td><b>${escaparHtml(p.nome)}</b>${p.descricao ? `<div class="al-item-sub">${escaparHtml(p.descricao)}</div>` : ""}</td>
      <td>R$ ${Number(p.precoBase).toFixed(2)}</td>
      <td>
        <div class="cd-acoes">
          ${podeEditarProdutos ? `<button class="cd-btn-icone" data-acao="editar" data-id="${p.id}">Editar</button>` : ""}
          ${podeExcluirProdutos ? `<button class="cd-btn-icone excluir" data-acao="excluir" data-id="${p.id}">Excluir</button>` : ""}
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
  // ids vêm da API como número; o data-id do botão é texto
  const produto = id ? produtosCache.find((p) => String(p.id) === String(id)) : null;
  document.getElementById("modalTitulo").textContent = id
    ? "Editar produto"
    : "Novo produto";
  document.getElementById("fNome").value = produto?.nome || "";
  document.getElementById("fDescricao").value = produto?.descricao || "";
  document.getElementById("fPreco").value = produto?.precoBase || "";
  document.getElementById("modalFundo").classList.add("aberto");
}

async function salvar() {
  const atual = produtosCache.find(
    (p) => String(p.id) === String(editandoIdProduto),
  );
  const dados = {
    nome: document.getElementById("fNome").value.trim(),
    descricao: document.getElementById("fDescricao").value.trim(),
    precoBase: Number(document.getElementById("fPreco").value) || 0,
    estoque: atual?.estoque ?? 0, // a tela não edita estoque: mantém o atual
  };
  if (!dados.nome || dados.precoBase <= 0) {
    alert("Nome e preço base (maior que zero) são obrigatórios.");
    return;
  }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    if (editandoIdProduto) await apiAtualizarProduto(editandoIdProduto, dados);
    else await apiCriarProduto(dados);
    document.getElementById("modalFundo").classList.remove("aberto");
    await carregar();
  } catch (erro) {
    alert(`Não foi possível salvar: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
}

// A API recusa excluir produto usado em pedidos e devolve a mensagem
async function excluir(id) {
  const produto = produtosCache.find((p) => String(p.id) === String(id));
  if (!confirm(`Excluir o produto "${produto?.nome}"?`)) return;
  try {
    await apiExcluirProduto(id);
    await carregar();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

iniciarProdutos();
