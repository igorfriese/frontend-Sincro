// ===================================================================
// API CLIENT — mesma interface de antes (apiListarPedidos, apiLogin,
// etc.), só que agora lendo/escrevendo do localStorage (js/local-db.js)
// em vez de fazer fetch() pra um servidor. Nenhuma tela precisa mudar.
// ===================================================================

function tokenSalvo() {
  return sessionStorage.getItem("syncrowToken");
}

function usuarioLogado() {
  const dados = sessionStorage.getItem("syncrowUsuario");
  return dados ? JSON.parse(dados) : null;
}

function salvarSessao(token, usuario) {
  sessionStorage.setItem("syncrowToken", token);
  sessionStorage.setItem("syncrowUsuario", JSON.stringify(usuario));
}

function limparSessao() {
  sessionStorage.removeItem("syncrowToken");
  sessionStorage.removeItem("syncrowUsuario");
}

// ---------- Autenticação ----------
async function apiLogin(email, senha) {
  const db = carregarBanco();
  const usuario = db.usuarios.find((u) => u.email === email && u.senha === senha);
  if (!usuario) throw new Error("Credenciais inválidas");

  const token = `local-${usuario.id}-${Date.now()}`;
  const usuarioPublico = { ...usuario };
  delete usuarioPublico.senha;

  salvarSessao(token, usuarioPublico);
  return usuarioPublico;
}

// ---------- Pedidos ----------
// Regra de perfil: Administrador e Gestor veem todos os pedidos;
// Vendedor só vê os que estão sob a própria responsabilidade
// (responsavelId). Central aqui pra valer em toda tela que lista
// pedidos (Kanban, Alertas, Histórico, Dashboard, Assistente) sem
// cada uma precisar reimplementar o filtro.
async function apiListarPedidos() {
  const pedidos = carregarBanco().pedidos;
  const usuario = usuarioLogado();
  if (usuario?.perfil === "Vendedor") {
    return pedidos.filter((p) => p.responsavelId === usuario.id);
  }
  return pedidos;
}
// Sem o filtro por perfil — usado só pra checagens de integridade
// referencial (ex: "esse cliente tem pedidos de QUALQUER responsável
// antes de excluir?"), onde a resposta não pode depender de quem
// está logado.
async function apiListarTodosPedidos() {
  return carregarBanco().pedidos;
}
async function apiBuscarPedido(id) {
  const pedido = carregarBanco().pedidos.find((p) => p.id === id);
  if (!pedido) throw new Error(`Pedido #${id} não encontrado`);
  return pedido;
}
async function apiCriarPedido(pedido) {
  const db = carregarBanco();
  const etapas = (db.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
  const primeiraEtapa = etapas[0]?.chave || "corte";

  const novo = {
    urgente: false,
    ...pedido,
    id: proximoIdDe(db.pedidos),
    coluna: primeiraEtapa,
  };
  db.pedidos.push(novo);
  salvarBanco(db);
  return novo;
}
async function apiAtualizarPedido(id, campos) {
  const db = carregarBanco();
  const pedido = db.pedidos.find((p) => p.id === id);
  if (!pedido) throw new Error(`Pedido #${id} não encontrado`);
  Object.assign(pedido, campos);
  salvarBanco(db);
  return pedido;
}
async function apiExcluirPedido(id) {
  const db = carregarBanco();
  db.pedidos = db.pedidos.filter((p) => p.id !== id);
  salvarBanco(db);
  return { deletado: true };
}

// ---------- Eventos (timeline) ----------
async function apiListarEventosDoPedido(pedidoId) {
  const eventos = carregarBanco().eventos.filter((e) => e.pedidoId === pedidoId);
  return eventos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}
async function apiCriarEvento(evento) {
  const db = carregarBanco();
  const novo = {
    ...evento,
    id: proximoIdDe(db.eventos),
    dataHora: evento.dataHora || new Date().toISOString(),
  };
  db.eventos.push(novo);
  salvarBanco(db);
  return novo;
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
    novo.tokenAcompanhamento = novo.tokenAcompanhamento || gerarTokenAleatorio("cli");
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
  const db = carregarBanco();
  const cliente = (db.clientes || []).find((c) => c.tokenAcompanhamento === tokenPublico);
  if (!cliente) throw new Error("Link inválido ou cliente não encontrado");

  const pedidos = db.pedidos
    .filter((p) => p.cliente === cliente.nome)
    .sort((a, b) => new Date(a.prazo) - new Date(b.prazo));

  return { cliente, pedidos };
}

async function apiEventosDoPedidoPublico(pedidoId) {
  const db = carregarBanco();
  return db.eventos
    .filter((e) => e.pedidoId === pedidoId)
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}
