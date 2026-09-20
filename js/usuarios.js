let usuariosCache = [];
let usuarioAtualUsuarios = null;
let editandoIdUsuario = null;

async function iniciarUsuarios() {
  usuarioAtualUsuarios = montarLayout({
    itemAtivo: "usuarios",
    titulo: "Usuários",
    subtitulo: "Gestão de acesso ao sistema",
  });
  if (!usuarioAtualUsuarios) return;

  if (usuarioAtualUsuarios.perfil !== "Administrador") {
    document.getElementById("page-content").innerHTML = `
      <div class="sy-erro-banner">Esta tela é restrita ao perfil Administrador.</div>`;
    return;
  }

  document.getElementById("page-content").innerHTML = `
    <div class="cd-toolbar">
      <div class="kb-search" style="max-width:280px;"><input type="text" id="fBusca" placeholder="Buscar por nome ou e-mail..."></div>
      <button class="kb-btn-new" id="btnNovo">+ Novo usuário</button>
    </div>
    <div id="erroBox" class="sy-erro-banner" style="display:none;"></div>
    <div class="sy-card">
      <table class="cd-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th></th></tr></thead>
        <tbody id="corpoTabela"></tbody>
      </table>
      <div id="vazio" class="cd-vazio" style="display:none;">Nenhum usuário encontrado.</div>
    </div>

    <div class="cd-modal-fundo" id="modalFundo">
      <div class="sy-card cd-modal">
        <h2 class="sy-card-title" style="margin-bottom:14px;" id="modalTitulo">Novo usuário</h2>
        <input class="login-input" id="fNome" placeholder="Nome completo">
        <input class="login-input" id="fEmail" placeholder="E-mail" type="email">
        <input class="login-input" id="fSenha" placeholder="Senha inicial" type="password">
        <select class="login-input" id="fPerfil">
          <option value="Administrador">Administrador</option>
          <option value="Gestor">Gestor</option>
          <option value="Vendedor">Vendedor</option>
        </select>
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
  document.getElementById("btnCancelar").addEventListener("click", fecharModal);
  document.getElementById("btnSalvar").addEventListener("click", salvar);
  document.getElementById("fBusca").addEventListener("input", renderizarTabela);

  await carregar();
}

async function carregar() {
  const erroBox = document.getElementById("erroBox");
  try {
    usuariosCache = await apiListar("usuarios");
    erroBox.style.display = "none";
  } catch (erro) {
    erroBox.textContent = `Não foi possível carregar os usuários: ${erro.message}`;
    erroBox.style.display = "block";
    usuariosCache = [];
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

  const filtrados = usuariosCache.filter(
    (u) =>
      !termo ||
      u.nome.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo),
  );

  if (filtrados.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  filtrados.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${u.nome}</b>${u.id === usuarioAtualUsuarios.id ? ' <span class="al-item-sub">(você)</span>' : ""}</td>
      <td>${u.email}</td>
      <td><span class="sy-badge sy-badge-blue">${u.perfil}</span></td>
      <td>
        <div class="cd-acoes">
          <button class="cd-btn-icone" data-acao="editar" data-id="${u.id}">Editar</button>
          <button class="cd-btn-icone excluir" data-acao="excluir" data-id="${u.id}">Excluir</button>
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
  editandoIdUsuario = id;
  const registro = id ? usuariosCache.find((u) => u.id === id) : null;

  document.getElementById("modalTitulo").textContent = id
    ? "Editar usuário"
    : "Novo usuário";
  document.getElementById("fNome").value = registro?.nome || "";
  document.getElementById("fEmail").value = registro?.email || "";
  document.getElementById("fSenha").value = "";
  document.getElementById("fSenha").placeholder = id
    ? "Nova senha (deixa em branco pra manter a atual)"
    : "Senha inicial";
  document.getElementById("fPerfil").value = registro?.perfil || "Vendedor";
  document.getElementById("modalFundo").classList.add("aberto");
}

function fecharModal() {
  document.getElementById("modalFundo").classList.remove("aberto");
}

async function salvar() {
  const dados = {
    nome: document.getElementById("fNome").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
    senha: document.getElementById("fSenha").value,
    perfil: document.getElementById("fPerfil").value,
  };

  if (!dados.nome || !dados.email) {
    alert("Preenche nome e e-mail.");
    return;
  }
  if (!editandoIdUsuario && !dados.senha) {
    alert("Senha inicial é obrigatória pra um usuário novo.");
    return;
  }
  if (!dados.senha) delete dados.senha;

  if (editandoIdUsuario) {
    const registroAtual = usuariosCache.find((u) => u.id === editandoIdUsuario);
    if (
      registroAtual.perfil === "Administrador" &&
      dados.perfil !== "Administrador"
    ) {
      const outrosAdmins = usuariosCache.filter(
        (u) => u.perfil === "Administrador" && u.id !== editandoIdUsuario,
      );
      if (outrosAdmins.length === 0) {
        alert("Não é possível rebaixar o último Administrador do sistema.");
        return;
      }
    }
  }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    if (editandoIdUsuario) {
      const atualizado = await apiAtualizarItem(
        "usuarios",
        editandoIdUsuario,
        dados,
      );
      if (editandoIdUsuario === usuarioAtualUsuarios.id) {
        const atualizadoPublico = { ...atualizado };
        delete atualizadoPublico.senha;
        salvarSessao(tokenSalvo(), atualizadoPublico);
        usuarioAtualUsuarios = atualizadoPublico;
      }
    } else {
      await apiCriarItem("usuarios", dados);
    }
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
  if (id === usuarioAtualUsuarios.id) {
    alert(
      "Você não pode excluir o próprio usuário enquanto está logado com ele.",
    );
    return;
  }

  const registro = usuariosCache.find((u) => u.id === id);
  if (registro?.perfil === "Administrador") {
    const outrosAdmins = usuariosCache.filter(
      (u) => u.perfil === "Administrador" && u.id !== id,
    );
    if (outrosAdmins.length === 0) {
      alert("Não é possível excluir o último Administrador do sistema.");
      return;
    }
  }

  if (!confirm("Excluir este usuário? Ele perde o acesso ao sistema.")) return;
  try {
    await apiExcluirItem("usuarios", id);
    await carregar();
  } catch (erro) {
    alert(`Não foi possível excluir: ${erro.message}`);
  }
}

iniciarUsuarios();
