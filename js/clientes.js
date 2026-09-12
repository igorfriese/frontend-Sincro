let clientesCache = [];
let editandoId = null;

async function iniciarClientes() {
  const usuario = montarLayout({ itemAtivo: "clientes", titulo: "Clientes", subtitulo: "Confecções atendidas pela facção" });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML = `
    <div class="cd-toolbar">
      <div class="kb-search" style="max-width:280px;"><input type="text" id="fBusca" placeholder="Buscar por nome ou código..."></div>
      <button class="kb-btn-new" id="btnNovo">+ Novo cliente</button>
    </div>
    <div id="erroBox" class="sy-erro-banner" style="display:none;"></div>
    <div class="sy-card">
      <table class="cd-table">
        <thead><tr><th>Código</th><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th></th></tr></thead>
        <tbody id="corpoTabela"></tbody>
      </table>
      <div id="vazio" class="cd-vazio" style="display:none;">Nenhum cliente encontrado.</div>
    </div>

    <div class="cd-modal-fundo" id="modalFundo">
      <div class="sy-card cd-modal">
        <h2 class="sy-card-title" style="margin-bottom:14px;" id="modalTitulo">Novo cliente</h2>
        <input class="login-input" id="fNome" placeholder="Nome da confecção">
        <input class="login-input" id="fDocumento" placeholder="CNPJ">
        <input class="login-input" id="fTelefone" placeholder="Telefone">
        <input class="login-input" id="fEmail" placeholder="E-mail" type="email">
        <div class="cd-modal-botoes">
          <button class="kb-btn-new cancelar" id="btnCancelar">Cancelar</button>
          <button class="kb-btn-new" id="btnSalvar">Salvar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnNovo").addEventListener("click", () => abrirModal());
  document.getElementById("btnCancelar").addEventListener("click", fecharModal);
  document.getElementById("btnSalvar").addEventListener("click", salvar);
  document.getElementById("fBusca").addEventListener("input", renderizarTabela);

  await carregar();
}

async function carregar() {
  const erroBox = document.getElementById("erroBox");
  try {
    clientesCache = await apiListar("clientes");
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar os clientes: ${erro.message}`;
    erroBox.style.display = "block";
    clientesCache = [];
  }
  renderizarTabela();
}

function renderizarTabela() {
  const termo = (document.getElementById("fBusca").value || "").trim().toLowerCase();
  const corpo = document.getElementById("corpoTabela");
  const vazio = document.getElementById("vazio");
  corpo.innerHTML = "";

  const filtrados = clientesCache.filter((c) =>
    !termo || c.nome.toLowerCase().includes(termo) || (c.codigo || "").toLowerCase().includes(termo)
  );

  if (filtrados.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  filtrados.forEach((c) => {
    const linkPublico = `${window.location.href.split("clientes.html")[0]}portal-cliente.html?token=${c.tokenAcompanhamento}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="cl-chave">${c.codigo || "—"}</span></td>
      <td><b>${c.nome}</b></td>
      <td>${c.documento || "—"}</td>
      <td>${c.telefone || "—"}</td>
      <td>${c.email || "—"}</td>
      <td>
        <div class="cd-acoes">
          <button class="cd-btn-icone" data-acao="link" data-id="${c.id}" data-link="${linkPublico}">Copiar link</button>
          <button class="cd-btn-icone" data-acao="editar" data-id="${c.id}">Editar</button>
          <button class="cd-btn-icone excluir" data-acao="excluir" data-id="${c.id}">Excluir</button>
        </div>
      </td>`;
    corpo.appendChild(tr);
  });

  corpo.querySelectorAll('[data-acao="editar"]').forEach((btn) =>
    btn.addEventListener("click", () => abrirModal(btn.dataset.id))
  );
  corpo.querySelectorAll('[data-acao="excluir"]').forEach((btn) =>
    btn.addEventListener("click", () => excluir(btn.dataset.id))
  );
  corpo.querySelectorAll('[data-acao="link"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.link);
        const original = btn.textContent;
        btn.textContent = "Copiado!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      } catch {
        prompt("Copia esse link manualmente:", btn.dataset.link);
      }
    })
  );
}

function abrirModal(id = null) {
  editandoId = id;
  const cliente = id ? clientesCache.find((c) => c.id === id) : null;

  document.getElementById("modalTitulo").textContent = id ? "Editar cliente" : "Novo cliente";
  document.getElementById("fNome").value = cliente?.nome || "";
  document.getElementById("fDocumento").value = cliente?.documento || "";
  document.getElementById("fTelefone").value = cliente?.telefone || "";
  document.getElementById("fEmail").value = cliente?.email || "";
  document.getElementById("modalFundo").classList.add("aberto");
}

function fecharModal() {
  document.getElementById("modalFundo").classList.remove("aberto");
}

async function salvar() {
  const dados = {
    nome: document.getElementById("fNome").value.trim(),
    documento: document.getElementById("fDocumento").value.trim(),
    telefone: document.getElementById("fTelefone").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
  };
  if (!dados.nome) { alert("O nome é obrigatório."); return; }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (editandoId) await apiAtualizarItem("clientes", editandoId, dados);
    else await apiCriarItem("clientes", dados);
    fecharModal();
    await carregar();
  } catch (erro) {
    alert(`Não foi possível salvar: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
}

async function excluir(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  const pedidos = await apiListarTodosPedidos();
  const qtdPedidos = pedidos.filter((p) => p.cliente === cliente.nome).length;
  if (qtdPedidos > 0) {
    alert(`Não é possível excluir "${cliente.nome}": existem ${qtdPedidos} pedido(s) associados a esse cliente.`);
    return;
  }

  if (!confirm("Excluir este cliente?")) return;
  try {
    await apiExcluirItem("clientes", id);
    await carregar();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

iniciarClientes();
