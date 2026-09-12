// ===================================================================
// BANCO LOCAL — guarda tudo no localStorage do navegador.
// Não precisa de nenhum servidor rodando. Os dados persistem entre
// recarregamentos de página (F5), mas ficam só nesse navegador/máquina.
// Pra "resetar" os dados de exemplo, roda no Console: resetarBancoLocal()
// ===================================================================

const DB_KEY = "syncrowDB";

const DADOS_INICIAIS = {
  usuarios: [
    { id: "1", nome: "Ana Beatriz", email: "ana@syncrow.com", senha: "123456", perfil: "Administrador" },
    { id: "2", nome: "Carlos Souza", email: "carlos@syncrow.com", senha: "123456", perfil: "Gestor" },
    { id: "3", nome: "Julia Ramos", email: "julia@syncrow.com", senha: "123456", perfil: "Vendedor" },
  ],
  clientes: [
    { id: "1", codigo: "CLI-0001", nome: "Confecção Bela Vista", documento: "12.345.678/0001-90", telefone: "(47) 99123-4567", email: "contato@belavista.com", tokenAcompanhamento: "cli-bela-vista" },
    { id: "2", codigo: "CLI-0002", nome: "Malhas Sul Têxtil", documento: "23.456.789/0001-01", telefone: "(47) 99234-5678", email: "compras@malhassul.com", tokenAcompanhamento: "cli-malhas-sul" },
    { id: "3", codigo: "CLI-0003", nome: "Estação Confecções", documento: "34.567.890/0001-12", telefone: "(47) 99345-6789", email: "financeiro@estacao.com", tokenAcompanhamento: "cli-estacao" },
    { id: "4", codigo: "CLI-0004", nome: "Nordeste Jeans", documento: "45.678.901/0001-23", telefone: "(47) 99456-7890", email: "pedidos@nordestejeans.com", tokenAcompanhamento: "cli-nordeste-jeans" },
    { id: "5", codigo: "CLI-0005", nome: "Bela Vista Modas", documento: "56.789.012/0001-34", telefone: "(47) 99567-8901", email: "contato@belavistamodas.com", tokenAcompanhamento: "cli-bela-vista-modas" },
  ],
  produtos: [
    { id: "1", codigo: "PRD-0001", nome: "Camiseta básica", precoBase: 24.9 },
    { id: "2", codigo: "PRD-0002", nome: "Moletom canguru", precoBase: 68.5 },
    { id: "3", codigo: "PRD-0003", nome: "Jaqueta corta-vento", precoBase: 89.9 },
    { id: "4", codigo: "PRD-0004", nome: "Calça jeans skinny", precoBase: 74.9 },
    { id: "5", codigo: "PRD-0005", nome: "Vestido verão", precoBase: 59.9 },
  ],
  etapas: [
    { id: "1", chave: "corte", nome: "Corte recebido", cor: "#3C3489", ordem: 1 },
    { id: "2", chave: "costura", nome: "Em costura", cor: "#5B4FC9", ordem: 2 },
    { id: "3", chave: "acabamento", nome: "Acabamento", cor: "#8577E0", ordem: 3 },
    { id: "4", chave: "revisao", nome: "Revisão", cor: "#B06A12", ordem: 4 },
    { id: "5", chave: "entregue", nome: "Entregue", cor: "#2C7A9E", ordem: 5 },
    { id: "6", chave: "finalizado", nome: "Finalizado", cor: "#1D9E75", ordem: 6 },
  ],
  pedidos: [
    { id: "1", cliente: "Confecção Bela Vista", modelo: "Camiseta básica", qtd: 480, coluna: "corte", prazo: "2026-08-22", responsavelId: "3", urgente: false },
    { id: "2", cliente: "Malhas Sul Têxtil", modelo: "Moletom canguru", qtd: 320, coluna: "costura", prazo: "2026-08-16", responsavelId: "3", urgente: true },
    { id: "3", cliente: "Estação Confecções", modelo: "Jaqueta corta-vento", qtd: 150, coluna: "acabamento", prazo: "2026-08-13", responsavelId: "2", urgente: false },
    { id: "4", cliente: "Nordeste Jeans", modelo: "Calça jeans skinny", qtd: 260, coluna: "revisao", prazo: "2026-08-20", responsavelId: "3", urgente: false },
    { id: "5", cliente: "Bela Vista Modas", modelo: "Vestido verão", qtd: 210, coluna: "finalizado", prazo: "2026-08-28", responsavelId: "2", urgente: false },
    { id: "6", cliente: "Confecção Bela Vista", modelo: "Jaqueta corta-vento", qtd: 90, coluna: "corte", prazo: "2026-09-02", responsavelId: "3", urgente: true },
  ],
  eventos: [
    { id: "1", pedidoId: "1", etapa: "corte", dataHora: "2026-08-14T09:15:00", observacao: "Tecido cortado conforme ficha técnica." },
    { id: "2", pedidoId: "2", etapa: "corte", dataHora: "2026-08-07T08:00:00", observacao: "" },
    { id: "3", pedidoId: "2", etapa: "costura", dataHora: "2026-08-09T10:30:00", observacao: "" },
    { id: "4", pedidoId: "3", etapa: "corte", dataHora: "2026-08-03T08:00:00", observacao: "" },
    { id: "5", pedidoId: "3", etapa: "costura", dataHora: "2026-08-05T09:00:00", observacao: "" },
    { id: "6", pedidoId: "3", etapa: "acabamento", dataHora: "2026-08-08T14:20:00", observacao: "Pequeno atraso por falta de zíper." },
    { id: "7", pedidoId: "4", etapa: "corte", dataHora: "2026-08-01T08:00:00", observacao: "" },
    { id: "8", pedidoId: "4", etapa: "costura", dataHora: "2026-08-05T08:00:00", observacao: "" },
    { id: "9", pedidoId: "4", etapa: "acabamento", dataHora: "2026-08-09T08:00:00", observacao: "" },
    { id: "10", pedidoId: "4", etapa: "revisao", dataHora: "2026-08-12T11:00:00", observacao: "Em revisão de qualidade." },
    { id: "11", pedidoId: "5", etapa: "corte", dataHora: "2026-07-25T08:00:00", observacao: "" },
    { id: "12", pedidoId: "5", etapa: "costura", dataHora: "2026-07-28T08:00:00", observacao: "" },
    { id: "13", pedidoId: "5", etapa: "acabamento", dataHora: "2026-08-01T08:00:00", observacao: "" },
    { id: "14", pedidoId: "5", etapa: "revisao", dataHora: "2026-08-04T08:00:00", observacao: "" },
    { id: "15", pedidoId: "5", etapa: "finalizado", dataHora: "2026-08-07T16:00:00", observacao: "Pronto para expedição." },
    { id: "16", pedidoId: "6", etapa: "corte", dataHora: "2026-08-20T08:00:00", observacao: "Ordem urgente — priorizar." },
  ],
};

function carregarBanco() {
  const bruto = localStorage.getItem(DB_KEY);
  let db;

  if (!bruto) {
    db = structuredClone(DADOS_INICIAIS);
    salvarBanco(db);
    return db;
  }

  try {
    db = JSON.parse(bruto);
  } catch {
    db = structuredClone(DADOS_INICIAIS);
    salvarBanco(db);
    return db;
  }

  let precisaSalvar = false;

  // Auto-migração: se o banco salvo é de antes de alguma coleção nova
  // existir, completa com os dados iniciais dela sem mexer no que o
  // usuário já criou nas outras coleções.
  for (const chave of Object.keys(DADOS_INICIAIS)) {
    if (!db[chave]) {
      db[chave] = structuredClone(DADOS_INICIAIS[chave]);
      precisaSalvar = true;
    }
  }

  // Reforço específico pra "etapas": um Kanban sem nenhuma coluna é
  // sempre um estado quebrado, diferente de clientes/produtos vazios
  // (que podem ser um estado válido se o usuário excluiu todos).
  if (Array.isArray(db.etapas) && db.etapas.length === 0) {
    db.etapas = structuredClone(DADOS_INICIAIS.etapas);
    precisaSalvar = true;
  }

  // Migração: quem já tinha banco salvo antes da etapa "Entregue" existir
  // ganha ela automaticamente, inserida logo antes da última etapa atual.
  // Só roda uma vez (a flag evita reinserir se o Administrador decidir
  // excluir "Entregue" de propósito depois).
  if (
    Array.isArray(db.etapas) && db.etapas.length > 0 &&
    !db.etapas.some((e) => e.chave === "entregue") &&
    !db._migracaoEntregue
  ) {
    const ordenadas = db.etapas.slice().sort((a, b) => a.ordem - b.ordem);
    const ultima = ordenadas[ordenadas.length - 1];
    const novaEntregue = { id: proximoIdDe(db.etapas), chave: "entregue", nome: "Entregue", cor: "#2C7A9E", ordem: ultima.ordem };
    ultima.ordem = ultima.ordem + 1;
    db.etapas.push(novaEntregue);
    db._migracaoEntregue = true;
    precisaSalvar = true;
  }

  // Migração de campos novos em registros que já existiam antes desses
  // campos serem adicionados (código, token de acompanhamento, urgente).
  (db.clientes || []).forEach((c, i) => {
    if (!c.codigo) { c.codigo = `CLI-${String(i + 1).padStart(4, "0")}`; precisaSalvar = true; }
    if (!c.tokenAcompanhamento) { c.tokenAcompanhamento = gerarTokenAleatorio("cli"); precisaSalvar = true; }
  });
  (db.produtos || []).forEach((p, i) => {
    if (!p.codigo) { p.codigo = `PRD-${String(i + 1).padStart(4, "0")}`; precisaSalvar = true; }
  });
  (db.pedidos || []).forEach((p) => {
    if (p.urgente === undefined) { p.urgente = false; precisaSalvar = true; }
  });

  if (precisaSalvar) salvarBanco(db);

  return db;
}

function salvarBanco(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Disponível no Console do navegador pra voltar aos dados de exemplo
// originais a qualquer momento (útil antes de recomeçar uma demonstração).
function resetarBancoLocal() {
  salvarBanco(DADOS_INICIAIS);
  console.log("Banco local resetado para os dados de exemplo.");
  location.reload();
}

// Limpa só os PEDIDOS (e os eventos ligados a eles) — mantém clientes,
// produtos, usuários e as colunas do Kanban intactos. Útil pra começar
// uma demonstração do zero sem perder os cadastros já feitos.
function limparPedidosLocal() {
  const db = carregarBanco();
  db.pedidos = [];
  db.eventos = [];
  salvarBanco(db);
  console.log("Todos os pedidos (e seus eventos) foram apagados.");
  location.reload();
}

function proximoIdDe(lista) {
  const existentes = lista.map((i) => parseInt(i.id, 10)).filter((n) => !isNaN(n));
  return String(existentes.length ? Math.max(...existentes) + 1 : 1);
}

function gerarTokenAleatorio(prefixo) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}

// Gera o próximo código sequencial (ex: "CLI-0006") olhando o maior
// número já usado na coleção, pra não repetir mesmo depois de exclusões.
function proximoCodigo(lista, prefixo) {
  const numeros = lista
    .map((i) => (i.codigo || "").match(new RegExp(`^${prefixo}-(\\d+)$`)))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  const proximo = numeros.length ? Math.max(...numeros) + 1 : 1;
  return `${prefixo}-${String(proximo).padStart(4, "0")}`;
}
