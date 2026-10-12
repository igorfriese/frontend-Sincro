// ===================================================================
// API CLIENT — centraliza a comunicação do frontend com a API do Sincro.
// Mantém uma interface única para autenticação, pedidos, eventos,
// clientes, produtos e usuários.
// ===================================================================

function tokenSalvo() {
  return sessionStorage.getItem("sincroToken");
}

function usuarioLogado() {
  const dados = sessionStorage.getItem("sincroUsuario");
  return dados ? JSON.parse(dados) : null;
}

function refreshTokenSalvo() {
  return sessionStorage.getItem("sincroRefreshToken");
}

function salvarSessao(token, usuario, refreshToken) {
  sessionStorage.setItem("sincroToken", token);
  sessionStorage.setItem("sincroUsuario", JSON.stringify(usuario));
  if (refreshToken) sessionStorage.setItem("sincroRefreshToken", refreshToken);
}

function limparSessao() {
  sessionStorage.removeItem("sincroToken");
  sessionStorage.removeItem("sincroUsuario");
  sessionStorage.removeItem("sincroRefreshToken");
}

// ===================================================================
// API
// ===================================================================

const API_BASE_URL = "https://localhost:7206/api";

// ---------- Sessão: renovação automática do token ----------
// O token de acesso dura pouco (1h). Quando a API responde 401, tenta
// renovar com o refresh token (7 dias) e repete a requisição uma vez.
// Se não der, a sessão acabou: volta pro login com aviso.
let renovacaoEmAndamento = null;

async function renovarToken() {
  const refreshToken = refreshTokenSalvo();
  if (!refreshToken) return false;

  // Várias telas podem receber 401 ao mesmo tempo: só uma renova, as outras esperam
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = (async () => {
      try {
        const resposta = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!resposta.ok) return false;

        const dados = await resposta.json();
        salvarSessao(dados.token, dados.usuario, dados.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        renovacaoEmAndamento = null;
      }
    })();
  }
  return await renovacaoEmAndamento;
}

function encerrarSessaoExpirada() {
  limparSessao();
  window.location.href = "login.html?sessao=expirada";
}

async function apiRequest(endpoint, options = {}, jaRenovou = false) {
  const resposta = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(tokenSalvo() ? { Authorization: `Bearer ${tokenSalvo()}` } : {}),
      ...(options.headers || {}),
    },
  });

  // 401 com sessão aberta = token vencido. No login (senha errada) e nas
  // páginas públicas (sem token) o 401 segue como erro normal.
  if (resposta.status === 401 && tokenSalvo() && endpoint !== "/auth/login") {
    if (!jaRenovou && (await renovarToken())) {
      return apiRequest(endpoint, options, true);
    }
    encerrarSessaoExpirada();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (!resposta.ok) {
    let mensagem = `Erro HTTP ${resposta.status}`;

    try {
      const dados = await resposta.json();

      mensagem = dados?.mensagem || dados?.erro || dados?.title || mensagem;
    } catch {
      // Mantém a mensagem padrão caso a API não retorne JSON.
    }

    throw new Error(mensagem);
  }

  if (resposta.status == 204) {
    return null;
  }

  return await resposta.json();
}

// ---------- Autenticação ----------
async function apiLogin(email, senha) {
  const dados = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });

  salvarSessao(dados.token, dados.usuario, dados.refreshToken);

  return dados.usuario;
}

// ---------- Pedidos ----------
// Regra de perfil: Administrador e Gestor veem todos os pedidos;
// Vendedor só vê os que estão sob a própria responsabilidade
// (responsavelId). O filtro é feito pela API, então vale em toda tela
// que lista pedidos (Kanban, Alertas, Histórico, Dashboard, Assistente).
async function apiListarPedidos() {
  const pedidos = await apiRequest("/Pedidos");

  return pedidos.map((pedido) => ({
    id: String(pedido.id),
    cliente: pedido.cliente?.nome || `Cliente #${pedido.clienteId}`,
    modelo: pedido.produto?.nome || `Produto #${pedido.produtoId}`,
    qtd: pedido.quantidade,
    prazo: pedido.prazo?.split("T")[0] || "",
    responsavelId: pedido.responsavelId ? String(pedido.responsavelId) : null,
    urgente: pedido.urgente,
    coluna: pedido.coluna,
    ultimaMovimentacao: pedido.ultimaMovimentacao || null,
  }));
}

// ---------- Clientes ----------
// Campos: id, codigo, nome, documento, telefone, email, endereco,
// tokenAcompanhamento (null pro Vendedor — o link do portal é de Adm/Gestor)
async function apiListarClientes() {
  const dados = await apiRequest("/clientes?pagina=1&tamanho=100");
  return dados.clientes || [];
}

// Campo opcional em branco vai como null: "" não passa na validação
// de email/telefone da API ("Email inválido" num campo que nem foi preenchido)
function clienteParaApi(cliente) {
  const opcional = (valor) => (valor && valor.trim() ? valor.trim() : null);
  return {
    nome: cliente.nome,
    documento: cliente.documento,
    telefone: opcional(cliente.telefone),
    email: opcional(cliente.email),
    endereco: opcional(cliente.endereco),
  };
}

async function apiCriarCliente(cliente) {
  return await apiRequest("/clientes", {
    method: "POST",
    body: JSON.stringify(clienteParaApi(cliente)),
  });
}

async function apiAtualizarCliente(id, cliente) {
  return await apiRequest(`/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(clienteParaApi(cliente)),
  });
}

async function apiExcluirCliente(id) {
  return await apiRequest(`/clientes/${id}`, { method: "DELETE" });
}

// ---------- Produtos ----------
// A API chama o preço de "preco"; as telas usam "precoBase".
function produtoDaApi(produto) {
  return { ...produto, precoBase: produto.preco };
}

function produtoParaApi(produto) {
  return {
    nome: produto.nome,
    descricao: produto.descricao || null,
    preco: Number(produto.precoBase),
    estoque: Number(produto.estoque) || 0,
  };
}

async function apiListarProdutos() {
  const dados = await apiRequest("/produtos?pagina=1&tamanho=100");
  return (dados.produtos || []).map(produtoDaApi);
}

async function apiCriarProduto(produto) {
  const criado = await apiRequest("/produtos", {
    method: "POST",
    body: JSON.stringify(produtoParaApi(produto)),
  });
  return produtoDaApi(criado);
}

async function apiAtualizarProduto(id, produto) {
  const atualizado = await apiRequest(`/produtos/${id}`, {
    method: "PUT",
    body: JSON.stringify(produtoParaApi(produto)),
  });
  return produtoDaApi(atualizado);
}

async function apiExcluirProduto(id) {
  return await apiRequest(`/produtos/${id}`, { method: "DELETE" });
}

// ---------- Usuários (Administrador) ----------
// A API chama o perfil de "role"; as telas e a sessão usam "perfil".
function usuarioDaApi(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.role,
  };
}

async function apiListarUsuarios() {
  const dados = await apiRequest("/usuarios?pagina=1&tamanho=100");
  return (dados.usuarios || []).map(usuarioDaApi);
}

async function apiCriarUsuario(usuario) {
  const criado = await apiRequest("/usuarios", {
    method: "POST",
    body: JSON.stringify({
      nome: usuario.nome,
      email: usuario.email,
      senha: usuario.senha,
      role: usuario.perfil,
    }),
  });
  return usuarioDaApi(criado);
}

// senha vazia/ausente mantém a senha atual
async function apiAtualizarUsuario(id, usuario) {
  const atualizado = await apiRequest(`/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.perfil,
      novaSenha: usuario.senha || null,
    }),
  });
  return usuarioDaApi(atualizado);
}

async function apiExcluirUsuario(id) {
  return await apiRequest(`/usuarios/${id}`, { method: "DELETE" });
}

// ---------- Meu Perfil (usuário logado) ----------
async function apiAtualizarMeuPerfil(dados) {
  const perfil = await apiRequest("/usuarios/me", {
    method: "PUT",
    body: JSON.stringify({ nome: dados.nome, email: dados.email }),
  });
  return usuarioDaApi(perfil);
}

// A API confere a senha atual (nada de senha guardada no navegador)
async function apiAlterarMinhaSenha(senhaAtual, novaSenha) {
  return await apiRequest("/usuarios/me/senha", {
    method: "PUT",
    body: JSON.stringify({ senhaAnterior: senhaAtual, novaSenha }),
  });
}

// Lista enxuta (id, nome, role) pra escolher o responsável de um pedido.
// Liberada pra Administrador e Gestor (a /usuarios completa é só do Administrador).
async function apiListarResponsaveis() {
  return await apiRequest("/usuarios/responsaveis");
}

// Única forma de mudar a coluna de um pedido. O servidor valida a regra
// do Kanban e registra o evento na timeline (com a observação, se houver)
// — o front NÃO deve criar outro evento depois.
async function apiAlterarEtapa(id, novaEtapa, observacao = "") {
  return await apiRequest(`/Pedidos/${id}/etapa`, {
    method: "PUT",
    body: JSON.stringify({ etapa: novaEtapa, observacao }),
  });
}

// ---------- Etapas / Colunas ----------

async function apiListarEtapas() {
  return await apiRequest("/Etapas");
}

async function apiCriarEtapa(etapa) {
  return await apiRequest("/Etapas", {
    method: "POST",
    body: JSON.stringify(etapa),
  });
}

async function apiAtualizarEtapa(id, etapa) {
  return await apiRequest(`/Etapas/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      id: Number(id),
      chave: etapa.chave,
      nome: etapa.nome,
      cor: etapa.cor,
      ordem: etapa.ordem,
    }),
  });
}

// Manda os ids de TODAS as etapas na nova ordem, numa chamada só.
// A API recusa tirar a etapa final do fim enquanto houver pedidos nela.
async function apiReordenarEtapas(idsNaNovaOrdem) {
  return await apiRequest("/Etapas/reordenar", {
    method: "PUT",
    body: JSON.stringify({ ids: idsNaNovaOrdem.map(Number) }),
  });
}

async function apiExcluirEtapa(id) {
  return await apiRequest(`/Etapas/${id}`, {
    method: "DELETE",
  });
}

async function apiBuscarPedido(id) {
  const pedido = await apiRequest(`/Pedidos/${id}`);

  return {
    id: String(pedido.id),
    clienteId: pedido.clienteId,
    produtoId: pedido.produtoId,
    cliente: pedido.cliente?.nome || `Cliente #${pedido.clienteId}`,
    modelo: pedido.produto?.nome || `Produto #${pedido.produtoId}`,
    qtd: pedido.quantidade,
    prazo: pedido.prazo?.split("T")[0] || "",
    responsavelId: pedido.responsavelId ? String(pedido.responsavelId) : null,
    urgente: pedido.urgente,
    coluna: pedido.coluna,
    ultimaMovimentacao: pedido.ultimaMovimentacao || null,
    // null para o Vendedor (o link do portal é de Administrador/Gestor)
    clienteTokenAcompanhamento: pedido.cliente?.tokenAcompanhamento || null,
  };
}

async function apiCriarPedido(pedido) {
  const body = {
    clienteId: pedido.clienteId,
    produtoId: pedido.produtoId,
    responsavelId: pedido.responsavelId,
    quantidade: Number(pedido.qtd),
    prazo: `${pedido.prazo}T00:00:00`,
    urgente: !!pedido.urgente,
    // Sem coluna, o servidor usa a primeira etapa (o Administrador pode ter mudado as colunas)
    coluna: pedido.coluna || null,
  };

  return await apiRequest("/Pedidos", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function apiAtualizarPedido(id, campos) {
  const atual = await apiRequest(`/Pedidos/${id}`);

  const atualizado = {
    clienteId: campos.clienteId ?? atual.clienteId,
    produtoId: campos.produtoId ?? atual.produtoId,
    responsavelId:
      campos.responsavelId !== undefined
        ? campos.responsavelId
        : atual.responsavelId,
    quantidade: campos.qtd ?? campos.quantidade ?? atual.quantidade,
    prazo: campos.prazo ? `${campos.prazo}T00:00:00` : atual.prazo,
    urgente: campos.urgente !== undefined ? campos.urgente : atual.urgente,
    // coluna não vai aqui: mudança de etapa é só pelo apiAlterarEtapa
  };

  return await apiRequest(`/Pedidos/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id: Number(id), ...atualizado }),
  });
}

async function apiExcluirPedido(id) {
  return await apiRequest(`/Pedidos/${id}`, {
    method: "DELETE",
  });
}

// ---------- Eventos (timeline) ----------
async function apiListarEventosDoPedido(pedidoId) {
  const eventos = await apiRequest(`/Eventos/pedido/${pedidoId}`);

  return eventos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}
// Anotação na timeline. A etapa é a atual do pedido e a data é a do
// servidor — mudança de etapa é pelo apiAlterarEtapa.
async function apiCriarEvento(evento) {
  return await apiRequest("/Eventos", {
    method: "POST",
    body: JSON.stringify({
      pedidoId: Number(evento.pedidoId),
      observacao: evento.observacao || "",
    }),
  });
}

// ---------- Relatórios (Administrador e Gestor) ----------
// Período opcional (yyyy-mm-dd): sem datas, o servidor considera todos
// os pedidos finalizados. O cálculo (conclusão, pontualidade, tempo
// médio) é feito na API; aqui só traduz pro formato das telas.
async function apiRelatorioProducao(dataInicio, dataFim) {
  const params = new URLSearchParams();
  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);
  const query = params.toString() ? `?${params}` : "";

  const dados = await apiRequest(`/relatorios/producao${query}`);

  return {
    ...dados,
    pedidos: dados.pedidos.map((pedido) => ({
      id: String(pedido.id),
      cliente: pedido.cliente,
      modelo: pedido.modelo,
      qtd: pedido.quantidade,
      prazo: pedido.prazo?.split("T")[0] || "",
      concluidoEm: pedido.concluidoEm,
      iniciadoEm: pedido.iniciadoEm,
      pontual: pedido.pontual,
    })),
  };
}

// ---------- Portal do Cliente — rota "pública" (não olha sessão nenhuma) ----------
// O link é por CLIENTE, não por pedido: mostra todos os pedidos dele.
async function apiAcompanharCliente(tokenPublico) {
  return await apiRequest(
    `/Pedidos/publico/cliente/${encodeURIComponent(tokenPublico)}`,
  );
}

async function apiEventosDoPedidoPublico(tokenPublico, pedidoId) {
  const eventos = await apiRequest(
    `/Eventos/publico/cliente/${encodeURIComponent(tokenPublico)}/pedido/${pedidoId}`,
  );

  return eventos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}
