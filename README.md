# Syncrow — Front-end

Telas do **Syncrow**: Kanban de produção, timeline dos pedidos, alertas, histórico, relatórios, cadastros e o portal público onde o cliente acompanha os pedidos dele.

HTML, CSS e JavaScript puros, sem framework. Os dados vêm da API do repositório [Sincro](https://github.com/igorfriese/Sincro).

## Como rodar

1. Suba a API (veja o README do Sincro). Ela precisa estar em `https://localhost:7206`, perfil **https**.
2. Abra esta pasta no VS Code, clique com o botão direito em `login.html` → **Open with Live Server**. Tem que ser pela porta **5500**: a API só aceita chamadas de `http://127.0.0.1:5500` e `http://localhost:5500` (CORS).
3. Entre com uma das contas de exemplo (senha `Sincro@123`): `admin@sincro.com`, `gestor@sincro.com`, `vendedor@sincro.com`.

O portal do cliente não precisa de login: é aberto pelo link com o token do cliente (botão "Copiar link" em Clientes ou na timeline do pedido).

## Organização

- `js/api-client.js` — todas as chamadas à API, a sessão (token + refresh token no `sessionStorage`) e a renovação automática do token quando ele vence. Traduz os nomes da API para os das telas (ex.: `quantidade` → `qtd`).
- `js/layout.js` — menu, topo, regras compartilhadas (prazos, etapa final) e `escaparHtml()`, usada em todo texto vindo do banco que entra em HTML.
- `js/<tela>.js` — uma por página.

As regras de verdade (permissões, Kanban, validações) ficam na API; o front só esconde o que o perfil não pode usar.
