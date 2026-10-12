document
  .getElementById("formLogin")
  .addEventListener("submit", async function (ev) {
    ev.preventDefault();

    const email = document.getElementById("inputEmail").value.trim();
    const senha = document.getElementById("inputSenha").value;
    const erroBox = document.getElementById("loginErro");
    const botao = document.getElementById("btnEntrar");

    erroBox.style.display = "none";
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
      await apiLogin(email, senha);
      window.location.href = "dashboard.html";
    } catch (erro) {
      erroBox.textContent = erro.message || "Não foi possível entrar.";
      erroBox.style.display = "block";
      botao.disabled = false;
      botao.textContent = "Entrar";
    }
  });

// Veio de uma sessão expirada (api-client.js): avisa em vez de só mostrar o form
if (new URLSearchParams(window.location.search).get("sessao") === "expirada") {
  const avisoBox = document.getElementById("loginErro");
  avisoBox.textContent = "Sua sessão expirou. Entre novamente.";
  avisoBox.style.display = "block";
}

// Se já estiver logado, pula direto pro dashboard
if (usuarioLogado() && tokenSalvo()) {
  window.location.href = "dashboard.html";
}
