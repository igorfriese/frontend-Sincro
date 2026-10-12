let clientesCache = [];
let editandoId = null;
// Cadastrar/editar: Administrador e Gestor. Excluir: só Administrador.
// O Vendedor só consulta (e não recebe o link do portal).
let podeEditarClientes = false;
let podeExcluirClientes = false;

async function iniciarClientes() {
  const usuario = montarLayout({
    itemAtivo: "clientes",
    titulo: "Clientes",
    subtitulo: "Confecções atendidas pela facção",
  });
  if (!usuario) return;

  podeEditarClientes = ["Administrador", "Gestor"].includes(usuario.perfil);
  podeExcluirClientes = usuario.perfil === "Administrador";

  document.getElementById("page-content").innerHTML = `
    <div class="cd-toolbar">
      <div class="kb-search" style="max-width:280px;"><input type="text" id="fBusca" placeholder="Buscar por nome ou código..."></div>
      ${podeEditarClientes ? `<button class="kb-btn-new" id="btnNovo">+ Novo cliente</button>` : ""}
    </div>
    <div id="erroBox" class="sy-erro-banner" style="display:none;"></div>
    <div class="sy-card">
      <table class="cd-table">
        <thead><tr><th>Código</th><th>Nome</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th></th></tr></thead>
        <tbody id="corpoTabela"></tbody>
      </table>
      <div id="vazio" class="cd-vazio" style="display:none;">Nenhum cliente encontrado.</div>
    </div>

    <div class="cd-modal-fundo" id="modalFundo">
      <div class="sy-card cd-modal">
        <h2 class="sy-card-title" style="margin-bottom:14px;" id="modalTitulo">Novo cliente</h2>
        <input class="login-input" id="fNome" placeholder="Nome da confecção">
        <input class="login-input" id="fDocumento" placeholder="CNPJ (00.000.000/0000-00)" data-mascara="cnpj" inputmode="numeric">
        <input class="login-input" id="fTelefone" placeholder="Telefone (opcional)" data-mascara="telefone" inputmode="tel">
        <input class="login-input" id="fEmail" placeholder="E-mail (opcional)" type="email">
        <input class="login-input" id="fEndereco" placeholder="Endereço (opcional)">
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
  document.getElementById("btnCancelar").addEventListener("click", fecharModal);
  document.getElementById("btnSalvar").addEventListener("click", salvar);
  document.getElementById("fBusca").addEventListener("input", renderizarTabela);

  await carregar();
}

async function carregar() {
  const erroBox = document.getElementById("erroBox");
  try {
    clientesCache = await apiListarClientes();
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar os clientes: ${erro.message}`;
    erroBox.style.display = "block";
    clientesCache = [];
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

  const filtrados = clientesCache.filter(
    (c) =>
      !termo ||
      c.nome.toLowerCase().includes(termo) ||
      (c.codigo || "").toLowerCase().includes(termo),
  );

  if (filtrados.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  filtrados.forEach((c) => {
    const linkPublico = c.tokenAcompanhamento
      ? `${window.location.href.split("clientes.html")[0]}portal-cliente.html?token=${c.tokenAcompanhamento}`
      : null;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cd-nowrap"><span class="cl-chave">${escaparHtml(c.codigo || "—")}</span></td>
      <td><b>${escaparHtml(c.nome)}</b></td>
      <td class="cd-nowrap">${escaparHtml(c.documento ? mascararCnpj(c.documento) : "—")}</td>
      <td class="cd-nowrap">${escaparHtml(c.telefone ? mascararTelefone(c.telefone) : "—")}</td>
      <td>${escaparHtml(c.email || "—")}</td>
      <td>
        <div class="cd-acoes">
          ${linkPublico ? `<button class="cd-btn-icone" data-acao="link" data-id="${c.id}" data-link="${linkPublico}">Copiar link</button>` : ""}
          ${podeEditarClientes ? `<button class="cd-btn-icone" data-acao="editar" data-id="${c.id}">Editar</button>` : ""}
          ${podeExcluirClientes ? `<button class="cd-btn-icone excluir" data-acao="excluir" data-id="${c.id}">Excluir</button>` : ""}
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
  corpo.querySelectorAll('[data-acao="link"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.link);
        const original = btn.textContent;
        btn.textContent = "Copiado!";
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      } catch {
        prompt("Copia esse link manualmente:", btn.dataset.link);
      }
    }),
  );
}

function abrirModal(id = null) {
  editandoId = id;
  // ids vêm da API como número; o data-id do botão é texto
  const cliente = id ? clientesCache.find((c) => String(c.id) === String(id)) : null;

  document.getElementById("modalTitulo").textContent = id
    ? "Editar cliente"
    : "Novo cliente";
  document.getElementById("fNome").value = cliente?.nome || "";
  document.getElementById("fDocumento").value = mascararCnpj(cliente?.documento);
  document.getElementById("fTelefone").value = mascararTelefone(cliente?.telefone);
  document.getElementById("fEmail").value = cliente?.email || "";
  document.getElementById("fEndereco").value = cliente?.endereco || "";
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
    endereco: document.getElementById("fEndereco").value.trim(),
  };
  if (!dados.nome || !dados.documento) {
    alert("Nome e CNPJ são obrigatórios.");
    return;
  }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (editandoId) await apiAtualizarCliente(editandoId, dados);
    else await apiCriarCliente(dados);
    fecharModal();
    await carregar();
  } catch (erro) {
    alert(`Não foi possível salvar: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
}

// A API recusa excluir cliente com pedidos e devolve a mensagem
async function excluir(id) {
  const cliente = clientesCache.find((c) => String(c.id) === String(id));
  if (!confirm(`Excluir o cliente "${cliente?.nome}"?`)) return;
  try {
    await apiExcluirCliente(id);
    await carregar();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

iniciarClientes();
