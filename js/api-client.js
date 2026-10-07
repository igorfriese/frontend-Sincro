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

function salvarSessao(token, usuario) {
  sessionStorage.setItem("sincroToken", token);
  sessionStorage.setItem("sincroUsuario", JSON.stringify(usuario));
}

function limparSessao() {
  sessionStorage.removeItem("sincroToken");
  sessionStorage.removeItem("sincroUsuario");
}

// ===================================================================
// API
// ===================================================================

const API_BASE_URL = "https://localhost:7206/api";

async function apiRequest(endpoint, options = {}) {
  const resposta = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(tokenSalvo() ? { Authorization: `Bearer ${tokenSalvo()}` } : {}),
      ...(options.headers || {}),
    },
  });

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

  salvarSessao(dados.token, dados.usuario);

  return dados.usuario;
}

// ---------- Pedidos ----------
// Regra de perfil: Administrador e Gestor veem todos os pedidos;
// Vendedor só vê os que estão sob a própria responsabilidade
// (responsavelId). Central aqui pra valer em toda tela que lista
// pedidos (Kanban, Alertas, Histórico, Dashboard, Assistente) sem
// cada uma precisar reimplementar o filtro.
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
  }));
}

async function apiListarClientes() {
  const dados = await apiRequest("/clientes?pagina=1&tamanho=1000");
  return dados.clientes || [];
}

async function apiListarProdutos() {
  const dados = await apiRequest("/produtos?pagina=1&tamanho=1000");
  return dados.produtos || [];
}

async function apiListarUsuarios() {
  const dados = await apiRequest("/usuarios?pagina=1&tamanho=1000");
  return dados.usuarios || [];
}

async function apiAlterarEtapa(id, novaEtapa) {
  return await apiRequest(`/Pedidos/${id}/etapa`, {
    method: "PUT",
    body: JSON.stringify(novaEtapa),
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

async function apiExcluirEtapa(id) {
  return await apiRequest(`/Etapas/${id}`, {
    method: "DELETE",
  });
}

// Sem o filtro por perfil — usado só pra checagens de integridade
// referencial (ex: "esse cliente tem pedidos de QUALQUER responsável
// antes de excluir?"), onde a resposta não pode depender de quem
// está logado.
async function apiListarTodosPedidos() {
  return await apiRequest("/Pedidos");
}
async function apiBuscarPedido(id) {
  const pedido = await apiRequest(`/Pedidos/${id}`);

  return {
    id: String(pedido.id),
    cliente: pedido.cliente?.nome || `Cliente #${pedido.clienteId}`,
    modelo: pedido.produto?.nome || `Produto #${pedido.produtoId}`,
    qtd: pedido.quantidade,
    prazo: pedido.prazo?.split("T")[0] || "",
    responsavelId: pedido.responsavelId ? String(pedido.responsavelId) : null,
    urgente: pedido.urgente,
    coluna: pedido.coluna,
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
    coluna: pedido.coluna || "corte",
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
    coluna: campos.coluna ?? atual.coluna,
  };

  return await apiRequest(`/Pedidos/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id: Number(id), ...atualizado }),
  });
}

// ---------- Eventos (timeline) ----------
async function apiListarEventosDoPedido(pedidoId) {
  const eventos = await apiRequest(`/Eventos/pedido/${pedidoId}`);

  return eventos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}
async function apiCriarEvento(evento) {
  return await apiRequest("/Eventos", {
    method: "POST",
    body: JSON.stringify({
      pedidoId: evento.pedidoId,
      etapa: evento.etapa,
      observacao: evento.observacao || "",
      dataHora: evento.dataHora || new Date().toISOString(),
    }),
  });
}

// ---------- CRUD genérico — usado por Clientes, Produtos e Usuários ----------
async function apiListar(colecao) {
  const db = carregarBanco();
  return db[colecao] || [];
}
async function apiCriarItem(colecao, dados) {
  const db = carregarBanco();
  if (!db[colecao]) db[colecao] = [];

  const novo = { ...dados, id: proximoIdDe(db[colecao]) };

  if (colecao === "clientes") {
    novo.codigo = novo.codigo || proximoCodigo(db.clientes, "CLI");
    novo.tokenAcompanhamento =
      novo.tokenAcompanhamento || gerarTokenAleatorio("cli");
  }
  if (colecao === "produtos") {
    novo.codigo = novo.codigo || proximoCodigo(db.produtos, "PRD");
  }

  db[colecao].push(novo);
  salvarBanco(db);
  return novo;
}
async function apiAtualizarItem(colecao, id, dados) {
  const db = carregarBanco();
  const item = (db[colecao] || []).find((i) => i.id === id);
  if (!item) throw new Error("Registro não encontrado");
  Object.assign(item, dados);
  salvarBanco(db);
  return item;
}
async function apiExcluirItem(colecao, id) {
  const db = carregarBanco();
  db[colecao] = (db[colecao] || []).filter((i) => i.id !== id);
  salvarBanco(db);
  return { deletado: true };
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
