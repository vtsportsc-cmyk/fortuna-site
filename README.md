# Fortuna Rodízio & Buffet — Pedido Online

Site de pedidos próprio do Fortuna (Seropédica-RJ): cardápio, carrinho com taxa
de entrega por bairro, acompanhamento de pedido e painel do restaurante.

## Rodando localmente

Requisito: **Node.js 22.5+** (necessário para `node:sqlite`, zero dependências npm).

```
npm start        # ou: node server.js
```

Acesse:

- Loja de pedidos: http://localhost:3000/pedido.html
- Site principal:  http://localhost:3000/
- Painel admin:    http://localhost:3000/admin.html

Senha do painel: veja `admin_senha` em `data/restaurante.json`.

## Funcionalidades

- Cardápio vindo do `server.js` (`GET /api/produtos`), com fallback estático em `data/produtos.json`.
- Carrinho persistido no navegador (`localStorage`) com cupom de desconto (BEMVINDO, FORTUNA5).
- Taxa de entrega calculada pelo bairro (`GET /api/bairros`) — retirada no balcão é grátis.
- Pedidos gravados em SQLite (`data/fortuna.db`, tabela `pedidos`), valores recalculados no servidor.
- Código de pedido `FOR-ANO-MES-DIA-XXXX` para acompanhar em `/pedido.html#acompanhar`.
- Painel admin: login por senha, lista de pedidos por status e atualização de status.

## APIs

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/config` | Config pública + bairros |
| GET | `/api/produtos` | Cardápio (categorias + produtos) |
| GET | `/api/bairros` | Tabela de entrega |
| POST | `/api/auth` | `{ senha }` → `{ token }` (admin) |
| POST | `/api/pedidos` | Cria pedido (validado no servidor) |
| GET | `/api/pedidos` | Lista pedidos (header `x-admin-token`) |
| PATCH | `/api/pedidos/:id/status` | Atualiza status (header `x-admin-token`) |
| GET | `/api/pedidos/acompanhar/:codigo` | Consulta pública do pedido |

## Publicação (hospedagem gratuita)

O servidor usa apenas a porta (`PORT` env) e não grava nada fora de `data/`.
O SQLite em disco é **efêmero** em hosts *serverless* gratuitos — para produção
recomendamos um banco externo:

1. **Render (tipo Free):** suba este repositório (ou pasta) como *Web Service*,
   com build/start `npm start`. Mude o banco para um Postgres gerenciado (Neon/Render)
   trocando as chamadas `node:sqlite` em `server.js` por um driver PostgreSQL.
2. **Alternativa VPS:** qualquer servidor Node (Railway Fly.io, Vercel via Docker, etc.)
   mantém o SQLite, desde que haja disco persistente.

Aviso: trocar de host reinicia o banco; os pedidos ficam em `data/fortuna.db`.

## Estrutura

```
data/restaurante.json   config da loja (horários, cupons, admin_senha)
data/produtos.json       cardápio normalizado
data/bairros.json        bairros + taxa + tempo
server.js                servidor Node + API + SQLite
pedido.html              página da loja (cardápio + carrinho + checkout)
admin.html               painel do restaurante
index.html               site institucional
```