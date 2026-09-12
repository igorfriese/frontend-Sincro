async function iniciarMeuPerfil() {
  const usuario = montarLayout({ itemAtivo: "meu-perfil", titulo: "Meu Perfil", subtitulo: "Seus dados de acesso" });
  if (!usuario) return;

  document.getElementById("page-content").innerHTML = `
    <div class="sy-card" style="max-width:440px;padding:24px;">
      <h2 class="sy-card-title" style="margin-bottom:4px;">Dados pessoais</h2>
      <div class="al-item-sub" style="margin-bottom:16px;">Perfil de acesso: <b>${usuario.perfil}</b> (não pode ser alterado por aqui)</div>

      <div id="perfilErro" class="sy-erro-banner" style="display:none;"></div>
      <div id="perfilSucesso" class="sy-erro-banner" style="display:none;background:var(--sy-green-tint);color:var(--sy-green);"></div>

      <label class="login-label">Nome</label>
      <input class="login-input" id="fNome" value="${usuario.nome}">

      <label class="login-label">E-mail</label>
      <input class="login-input" id="fEmail" type="email" value="${usuario.email}">

      <hr style="border:none;border-top:1px solid var(--sy-line);margin:6px 0 16px;">

      <div class="login-label" style="margin-bottom:10px;">Trocar senha (deixa em branco se não quiser alterar)</div>

      <label class="login-label">Senha atual</label>
      <input class="login-input" id="fSenhaAtual" type="password" placeholder="Necessária só se for trocar a senha">

      <label class="login-label">Nova senha</label>
      <input class="login-input" id="fSenhaNova" type="password">

      <label class="login-label">Confirmar nova senha</label>
      <input class="login-input" id="fSenhaConfirma" type="password">

      <button class="kb-btn-new" style="width:100%;margin-top:6px;" id="btnSalvar">Salvar alterações</button>
    </div>
  `;

  document.getElementById("btnSalvar").addEventListener("click", () => salvarPerfil(usuario));
}

async function salvarPerfil(usuario) {
  const erroBox = document.getElementById("perfilErro");
  const sucessoBox = document.getElementById("perfilSucesso");
  erroBox.style.display = "none";
  sucessoBox.style.display = "none";

  const nome = document.getElementById("fNome").value.trim();
  const email = document.getElementById("fEmail").value.trim();
  const senhaAtual = document.getElementById("fSenhaAtual").value;
  const senhaNova = document.getElementById("fSenhaNova").value;
  const senhaConfirma = document.getElementById("fSenhaConfirma").value;

  if (!nome || !email) {
    erroBox.textContent = "Nome e e-mail são obrigatórios.";
    erroBox.style.display = "block";
    return;
  }

  const dadosAtualizados = { nome, email };
  const querTrocarSenha = senhaAtual || senhaNova || senhaConfirma;

  if (querTrocarSenha) {
    const usuarios = await apiListar("usuarios");
    const registroCompleto = usuarios.find((u) => u.id === usuario.id);

    if (!senhaAtual || registroCompleto.senha !== senhaAtual) {
      erroBox.textContent = "Senha atual incorreta.";
      erroBox.style.display = "block";
      return;
    }
    if (!senhaNova || senhaNova.length < 6) {
      erroBox.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
      erroBox.style.display = "block";
      return;
    }
    if (senhaNova !== senhaConfirma) {
      erroBox.textContent = "As senhas novas não coincidem.";
      erroBox.style.display = "block";
      return;
    }
    dadosAtualizados.senha = senhaNova;
  }

  const botao = document.getElementById("btnSalvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    const atualizado = await apiAtualizarItem("usuarios", usuario.id, dadosAtualizados);

    const atualizadoPublico = { ...atualizado };
    delete atualizadoPublico.senha;
    salvarSessao(tokenSalvo(), atualizadoPublico);

    sucessoBox.textContent = "Perfil atualizado com sucesso!";
    sucessoBox.style.display = "block";
    document.getElementById("fSenhaAtual").value = "";
    document.getElementById("fSenhaNova").value = "";
    document.getElementById("fSenhaConfirma").value = "";

    // Atualiza o nome/iniciais no topbar na hora, sem precisar recarregar.
    const chipNome = document.querySelector(".sy-user-chip div div");
    const avatar = document.querySelector(".sy-avatar");
    if (chipNome) chipNome.textContent = atualizadoPublico.nome;
    if (avatar) avatar.textContent = iniciaisDoNome(atualizadoPublico.nome);
  } catch (erro) {
    erroBox.textContent = erro.message;
    erroBox.style.display = "block";
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar alterações";
  }
}

iniciarMeuPerfil();
