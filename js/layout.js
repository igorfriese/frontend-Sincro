// ===================================================================
// REGRAS DE NEGÓCIO COMPARTILHADAS
// ===================================================================
// As etapas do pipeline agora são dinâmicas — configuráveis pelo
// Administrador na tela colunas.html. Isso substitui o antigo array
// fixo ETAPAS: toda tela que precisa das etapas chama carregarEtapas().
async function carregarEtapas() {
  const lista = await apiListar("etapas");
  return lista.slice().sort((a, b) => a.ordem - b.ordem);
}

const LIMITE_PRAZO_APERTADO_DIAS = 3;

function diasParaPrazo(prazoISO) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoISO + "T00:00:00");
  return Math.round((prazo - hoje) / 86400000);
}
function severidadePrazo(prazoISO) {
  const dias = diasParaPrazo(prazoISO);
  if (dias < 0) return "red";
  if (dias <= LIMITE_PRAZO_APERTADO_DIAS) return "amber";
  return "ok";
}
function textoPrazo(prazoISO) {
  const dias = diasParaPrazo(prazoISO);
  if (dias < 0) return `Atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "Vence hoje";
  return `${dias}d p/ prazo`;
}
function formatarDataCurta(iso) {
  const [ano, mes, dia] = iso.split("T")[0].split("-");
  return `${dia}/${mes}`;
}
function formatarDataHora(iso) {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes} às ${hora}:${min}`;
}

// ---------- Indicador visual de "urgente" ----------
// Ícone de alerta (triângulo com exclamação), em vez do emoji 🔥 —
// reaproveitado em toda tela que mostra pedidos urgentes.
function svgUrgente(tamanho = 12) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`;
}
// Badge completo ("URGENTE" + ícone) pra cabeçalhos e listas.
function badgeUrgente() {
  return `<span class="badge-urgente">${svgUrgente(11)}Urgente</span>`;
}

// ---------- Fluxo obrigatório do Kanban ----------
// Regra: as DUAS ÚLTIMAS etapas do pipeline (por ordem, sejam quais
// forem os nomes) funcionam como "Entregue" → "Finalizado":
//   - só chega na última etapa vindo da penúltima
//   - da penúltima só se avança pra última (nunca volta)
//   - a última etapa "sai" do Kanban — só aparece no Histórico
//   - não dá pra pular etapas no meio do caminho
// Isso vale tanto pro drag-and-drop do Kanban quanto pro formulário
// de "Registrar novo evento" da Timeline.
function validarTransicaoEtapa(etapasOrdenadas, chaveAtual, chaveDestino) {
  if (chaveAtual === chaveDestino) return { permitido: true };

  const idxAtual = etapasOrdenadas.findIndex((e) => e.chave === chaveAtual);
  const idxDestino = etapasOrdenadas.findIndex((e) => e.chave === chaveDestino);
  const idxUltima = etapasOrdenadas.length - 1;

  if (idxAtual === -1 || idxDestino === -1) {
    return { permitido: false, motivo: "Etapa inválida." };
  }

  // Única trava que resta: uma vez "Finalizado", o pedido é terminal —
  // saiu do Kanban e só existe no Histórico. Fora isso, mover pra
  // qualquer outra coluna, em qualquer ordem, é livre.
  if (idxAtual === idxUltima) {
    return { permitido: false, motivo: `Este pedido já está em "${etapasOrdenadas[idxUltima].nome}" — saiu do Kanban e só pode ser consultado no Histórico.` };
  }

  return { permitido: true };
}

// A última etapa (por ordem) é tratada como "estado final" — pedidos
// nela saem da visão ativa do Kanban/Alertas/Meus Pedidos.
function etapaFinal(etapasOrdenadas) {
  return etapasOrdenadas[etapasOrdenadas.length - 1];
}

// ---------- Faturamento ----------
// Soma qtd × preço base de cada pedido, casando pelo nome do produto
// (pedido.modelo === produto.nome). Pedido cujo produto foi excluído
// não entra na conta. Reaproveitado pelo Dashboard e pelo Assistente.
function calcularFaturamento(pedidos, produtos) {
  return pedidos.reduce((total, p) => {
    const produto = produtos.find((pr) => pr.nome === p.modelo);
    return total + (produto ? Number(p.qtd) * Number(produto.precoBase) : 0);
  }, 0);
}

// ===================================================================
// LAYOUT — sidebar + topbar, injetado em toda tela autenticada
// ===================================================================
function exigirLogin() {
  const usuario = usuarioLogado();
  if (!usuario || !tokenSalvo()) {
    window.location.href = "login.html";
    return null;
  }
  return usuario;
}

function sair() {
  limparSessao();
  window.location.href = "login.html";
}

function iniciaisDoNome(nome) {
  const partes = nome.trim().split(" ");
  const primeira = partes[0]?.[0] || "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function montarLayout({ itemAtivo, titulo, subtitulo }) {
  const usuario = exigirLogin();
  if (!usuario) return null;

  const itens = [
    { chave: "dashboard", nome: "Dashboard", href: "dashboard.html", grupo: "Visão geral" },
    { chave: "meus-pedidos", nome: "Meus Pedidos", href: "meus-pedidos.html", grupo: "Visão geral", somenteVendedor: true },
    { chave: "relatorios", nome: "Relatórios", href: "relatorios.html", grupo: "Visão geral", somenteGestorAdmin: true },
    { chave: "ordens", nome: "Ordens de Produção", href: "kanban.html", grupo: "Operação" },
    { chave: "historico", nome: "Histórico", href: "historico.html", grupo: "Operação" },
    { chave: "alertas", nome: "Alertas", href: "alertas.html", grupo: "Operação" },
    { chave: "assistente", nome: "Assistente (IA)", href: "assistente.html", grupo: "Operação" },
    { chave: "clientes", nome: "Clientes", href: "clientes.html", grupo: "Cadastros" },
    { chave: "produtos", nome: "Produtos / Modelos", href: "produtos.html", grupo: "Cadastros" },
    { chave: "usuarios", nome: "Usuários", href: "usuarios.html", grupo: "Cadastros", somenteAdmin: true },
    { chave: "meu-perfil", nome: "Meu Perfil", href: "meu-perfil.html", grupo: "Conta" },
  ].filter((item) => {
    if (item.somenteAdmin && usuario.perfil !== "Administrador") return false;
    if (item.somenteVendedor && usuario.perfil !== "Vendedor") return false;
    if (item.somenteGestorAdmin && !["Gestor", "Administrador"].includes(usuario.perfil)) return false;
    return true;
  });
  const grupos = [...new Set(itens.map((i) => i.grupo))];

  let navHtml = "";
  grupos.forEach((grupo) => {
    navHtml += `<div class="sy-nav-group"><div class="sy-nav-label">${grupo}</div>`;
    itens.filter((i) => i.grupo === grupo).forEach((item) => {
      const ativo = item.chave === itemAtivo ? "active" : "";
      navHtml += `<a class="sy-nav-item ${ativo}" href="${item.href}">${item.nome}</a>`;
    });
    navHtml += `</div>`;
  });

  document.getElementById("app-shell").innerHTML = `
    <div class="sy-sidebar-backdrop" id="sySidebarBackdrop"></div>
    <aside class="sy-sidebar" id="sySidebar">
      <div class="sy-brand">
        <svg class="sy-brand-mark" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="19" fill="#5B4FC9" />
          <path d="M11 24c2-6 5-11 11-11 4.5 0 7 2.6 8 5.4-1.6-.6-3-.6-4 .2 1.7.4 2.8 1.4 3.3 3-1.6-.9-3.1-1-4.4-.2.3 2-.5 3.6-2.1 4.6-2.6 1.6-6.6 1.5-9.6-.2Z" fill="#fff" />
          <circle cx="24.5" cy="17.6" r="1.1" fill="#221C46" />
        </svg>
        <span class="sy-brand-name">Syncrow</span>
      </div>
      <nav style="flex:1;overflow-y:auto;">${navHtml}</nav>
      <div class="sy-sidebar-footer">
        <a class="sy-nav-item" href="#" onclick="sair(); return false;">Sair</a>
      </div>
    </aside>
    <div class="sy-main">
      <header class="sy-topbar">
        <button class="sy-menu-toggle" id="syMenuToggle" type="button" aria-label="Abrir menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div>
          <h1>${titulo}</h1>
          ${subtitulo ? `<div class="sy-topbar-sub">${subtitulo}</div>` : ""}
        </div>
        <a class="sy-user-chip" href="meu-perfil.html" style="cursor:pointer;margin-left:auto;">
          <div class="sy-avatar">${iniciaisDoNome(usuario.nome)}</div>
          <div>
            <div style="font-size:13px;font-weight:600;line-height:1.1;">${usuario.nome}</div>
            <div class="sy-user-role">${usuario.perfil}</div>
          </div>
        </a>
      </header>
      <main class="sy-content" id="page-content"></main>
    </div>
  `;

  const sidebar = document.getElementById("sySidebar");
  const backdrop = document.getElementById("sySidebarBackdrop");
  const fecharMenu = () => { sidebar.classList.remove("aberta"); backdrop.classList.remove("aberta"); };
  document.getElementById("syMenuToggle").addEventListener("click", () => {
    sidebar.classList.toggle("aberta");
    backdrop.classList.toggle("aberta");
  });
  backdrop.addEventListener("click", fecharMenu);
  sidebar.querySelectorAll(".sy-nav-item").forEach((link) => link.addEventListener("click", fecharMenu));

  return usuario;
}
