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
    return {
      permitido: false,
      motivo: `Este pedido já está em "${etapasOrdenadas[idxUltima].nome}" — saiu do Kanban e só pode ser consultado no Histórico.`,
    };
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
    {
      chave: "dashboard",
      nome: "Dashboard",
      href: "dashboard.html",
      grupo: "Visão geral",
      icon: "grid",
    },
    {
      chave: "meus-pedidos",
      nome: "Meus Pedidos",
      href: "meus-pedidos.html",
      grupo: "Visão geral",
      somenteVendedor: true,
      icon: "package",
    },
    {
      chave: "relatorios",
      nome: "Relatórios",
      href: "relatorios.html",
      grupo: "Visão geral",
      somenteGestorAdmin: true,
      icon: "chart",
    },
    {
      chave: "ordens",
      nome: "Ordens de Produção",
      href: "kanban.html",
      grupo: "Operação",
      icon: "layers",
    },
    {
      chave: "historico",
      nome: "Histórico",
      href: "historico.html",
      grupo: "Operação",
      icon: "history",
    },
    {
      chave: "alertas",
      nome: "Alertas",
      href: "alertas.html",
      grupo: "Operação",
      icon: "bell",
    },
    {
      chave: "assistente",
      nome: "Assistente (IA)",
      href: "assistente.html",
      grupo: "Operação",
      icon: "spark",
    },
    {
      chave: "clientes",
      nome: "Clientes",
      href: "clientes.html",
      grupo: "Cadastros",
      icon: "users",
    },
    {
      chave: "produtos",
      nome: "Produtos / Modelos",
      href: "produtos.html",
      grupo: "Cadastros",
      icon: "box",
    },
    {
      chave: "usuarios",
      nome: "Usuários",
      href: "usuarios.html",
      grupo: "Cadastros",
      somenteAdmin: true,
      icon: "user",
    },
    {
      chave: "meu-perfil",
      nome: "Meu Perfil",
      href: "meu-perfil.html",
      grupo: "Conta",
      icon: "settings",
    },
  ].filter((item) => {
    if (item.somenteAdmin && usuario.perfil !== "Administrador") return false;
    if (item.somenteVendedor && usuario.perfil !== "Vendedor") return false;
    if (
      item.somenteGestorAdmin &&
      !["Gestor", "Administrador"].includes(usuario.perfil)
    )
      return false;
    return true;
  });
  const grupos = [...new Set(itens.map((i) => i.grupo))];

  const svgNav = (tipo) => {
    const paths = {
      grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      package:
        '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
      chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
      layers:
        '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
      history:
        '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      spark:
        '<path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z"/><path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7L19 16Z"/>',
      users:
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
      box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      settings:
        '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1 1.7 1.3-2 3.4-2-.8a8 8 0 0 1-2 1.1l-.3 2.1h-4l-.3-2.1a8 8 0 0 1-2-1.1l-2 .8-2-3.4 1.7-1.3.1-.1a8 8 0 0 1 0-2l-.1-.1-1.7-1.3 2-3.4 2 .8a8 8 0 0 1 2-1.1L11 5.8h4l.3 2.1a8 8 0 0 1 2 1.1l2-.8 2 3.4-1.7 1.3-.1.1a8 8 0 0 1 0 2Z"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[tipo] || paths.grid}</svg>`;
  };

  let navHtml = "";
  grupos.forEach((grupo) => {
    navHtml += `<section class="sy-nav-group" aria-label="${grupo}"><p class="sy-nav-label">${grupo}</p>`;
    itens
      .filter((i) => i.grupo === grupo)
      .forEach((item) => {
        const ativo = item.chave === itemAtivo ? "active" : "";
        navHtml += `<a class="sy-nav-item ${ativo}" href="${item.href}">${svgNav(item.icon)}<span>${item.nome}</span></a>`;
      });
    navHtml += `</section>`;
  });

  document.getElementById("app-shell").innerHTML = `
    <div class="sy-sidebar-backdrop" id="sySidebarBackdrop" aria-hidden="true"></div>
    <aside class="sy-sidebar" id="sySidebar" aria-label="Menu principal">
      <div class="sy-brand">
        <img class="sy-brand-mark" src="assets/Bola.3.png" alt="">
        <span class="sy-brand-name">Sincro</span>
      </div>
      <nav class="sy-sidebar-nav" aria-label="Navegação do sistema">${navHtml}</nav>
      <div class="sy-sidebar-footer">
        <a class="sy-nav-item" href="#" onclick="sair(); return false;">${svgNav("history")}<span>Sair da conta</span></a>
      </div>
    </aside>
    <div class="sy-main">
      <header class="sy-topbar">
        <button class="sy-menu-toggle" id="syMenuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sySidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div>
          <h1>${titulo}</h1>
          ${subtitulo ? `<div class="sy-topbar-sub">${subtitulo}</div>` : ""}
        </div>
        <div class="sy-topbar-meta"><span class="sy-live-dot"></span><span>Operação conectada</span></div>
        <a class="sy-user-chip" href="meu-perfil.html">
          <div class="sy-avatar">${iniciaisDoNome(usuario.nome)}</div>
          <div class="sy-user-info">
            <div class="sy-user-name">${usuario.nome}</div>
            <div class="sy-user-role">${usuario.perfil}</div>
          </div>
        </a>
      </header>
      <main class="sy-content" id="page-content" tabindex="-1"></main>
    </div>
  `;

  const sidebar = document.getElementById("sySidebar");
  const backdrop = document.getElementById("sySidebarBackdrop");
  const fecharMenu = () => {
    sidebar.classList.remove("aberta");
    backdrop.classList.remove("aberta");
  };
  document.getElementById("syMenuToggle").addEventListener("click", () => {
    const aberto = !sidebar.classList.contains("aberta");
    sidebar.classList.toggle("aberta", aberto);
    backdrop.classList.toggle("aberta", aberto);
    document
      .getElementById("syMenuToggle")
      .setAttribute("aria-expanded", String(aberto));
    backdrop.setAttribute("aria-hidden", String(!aberto));
  });
  backdrop.addEventListener("click", fecharMenu);
  sidebar
    .querySelectorAll(".sy-nav-item")
    .forEach((link) => link.addEventListener("click", fecharMenu));

  return usuario;
}
