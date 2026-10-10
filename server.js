const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jfif": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4"
};

const DB_PATH = path.join(DATA, "fortuna.db");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    tipo TEXT NOT NULL,
    endereco TEXT,
    itens TEXT NOT NULL,
    subtotal REAL NOT NULL,
    taxa_entrega REAL NOT NULL DEFAULT 0,
    cupom TEXT,
    desconto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    pagamento TEXT NOT NULL,
    troco_para REAL,
    observacao TEXT,
    status TEXT NOT NULL DEFAULT 'recebido',
    criado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
`);

function lerJson(nome) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, nome), "utf8"));
  } catch {
    return null;
  }
}

function configPublico() {
  const cfg = lerJson("restaurante.json") || {};
  const { admin_senha, ...publico } = cfg;
  return publico;
}

function responder(res, code, payload) {
  const corpo = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(corpo)
  });
  res.end(corpo);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (chunk) => {
      dados += chunk;
      if (dados.length > 1e6) reject(new Error("Corpo muito grande"));
    });
    req.on("end", () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function novoCodigo() {
  const agora = new Date();
  const data = [
    String(agora.getFullYear()),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0")
  ].join("");
  const sufixo = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `FOR-${data}-${sufixo}`;
}

const arredondar = (v) => Math.round(v * 100) / 100;

function validarPedido(corpo, bairros, cfg, produtos) {
  const erros = [];
  if (!corpo.cliente || String(corpo.cliente).trim().length < 3) erros.push("Informe seu nome.");
  if (!/^[0-9+\s()-]{10,18}$/.test(String(corpo.telefone || "").trim()))
    erros.push("Informe um telefone válido com DDD.");
  if (corpo.tipo !== "entrega" && corpo.tipo !== "retirada") erros.push("Tipo de pedido inválido.");

  const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (itens.length === 0) erros.push("O carrinho está vazio.");

  let subtotal = 0;
  const itensNorm = [];
  for (const item of itens) {
    const prod = produtos.find((p) => p.id === item.produto_id);
    if (!prod) {
      erros.push(`Produto inválido (id ${item.produto_id}).`);
      continue;
    }
    const qtd = Math.min(Math.max(parseInt(item.qtd, 10) || 1, 1), 99);
    let extensao = 0;
    let opcoes = null;
    if (Array.isArray(item.opcoes)) {
      opcoes = item.opcoes.filter((o) => prod.opcoes && prod.opcoes.some((x) => x.nome === o.nome));
      extensao = opcoes.reduce((s, o) => {
        const base = prod.opcoes.find((x) => x.nome === o.nome) || { adicional: 0 };
        return s + (base.adicional || 0);
      }, 0);
    }
    const totalItem = arredondar((prod.preco + extensao) * qtd);
    subtotal += totalItem;
    itensNorm.push({
      produto_id: prod.id,
      nome: prod.nome,
      imagem: prod.imagem || null,
      preco_unit: arredondar(prod.preco + extensao),
      qtd,
      opcoes,
      subtotal: totalItem
    });
  }
  subtotal = arredondar(subtotal);

  let taxaEntrega = 0;
  let bairro = null;
  if (corpo.tipo === "entrega") {
    let endereco = corpo.endereco || {};
    if (typeof endereco === "string") {
      try {
        endereco = JSON.parse(endereco);
      } catch {
        endereco = {};
      }
    }
    bairro = (bairros || []).find(
      (b) => b.ativo && b.nome.toLowerCase() === String(endereco.bairro || "").toLowerCase()
    );
    if (!bairro) erros.push("Selecione um bairro de entrega válido.");
    if (!endereco.rua || String(endereco.rua).trim().length < 3) erros.push("Informe a rua da entrega.");
    if (!endereco.numero) erros.push("Informe o número do endereço.");
    taxaEntrega = bairro ? bairro.taxa : 0;
  }

  let cupomDesc = 0;
  let cupomNome = null;
  if (corpo.cupom) {
    const cupom = (cfg.cupons || {})[String(corpo.cupom).trim().toUpperCase()];
    if (cupom) {
      cupomNome = String(corpo.cupom).trim().toUpperCase();
      cupomDesc = cupom.tipo === "percentual" ? arredondar((subtotal * cupom.valor) / 100) : Math.min(cupom.valor, subtotal);
    } else {
      erros.push("Cupom de desconto inválido.");
    }
  }

  const total = arredondar(subtotal - cupomDesc + taxaEntrega);

  if (cfg.valor_pedido_minimo && subtotal < cfg.valor_pedido_minimo)
    erros.push(`Pedido mínimo é R$ ${cfg.valor_pedido_minimo.toFixed(2).replace(".", ",")}.`);

  return { erros, pedido: { itens: itensNorm, subtotal, taxaEntrega, cupom: cupomNome, desconto: cupomDesc, total } };
}

const statusValidos = ["recebido", "preparando", "saiu_para_entrega", "pronto_retirada", "entregue", "cancelado"];

function servirArquivo(req, res, urlPath) {
  let decodificado;
  try {
    decodificado = decodeURIComponent(urlPath);
  } catch {
    decodificado = urlPath;
  }
  let caminho = path.join(ROOT, decodificado === "/" ? "index.html" : decodificado);
  if (!caminho.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!path.extname(caminho)) caminho += ".html";

  fs.stat(caminho, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>404 — Página não encontrada</h1>");
    }
    const ext = path.extname(caminho).toLowerCase();
    const tipo = MIME[ext] || "application/octet-stream";
    const stream = fs.createReadStream(caminho);
    res.writeHead(200, {
      "Content-Type": tipo,
      "Content-Length": stats.size,
      "Cache-Control": [".html", ".json", ".js", ".css"].includes(ext) ? "no-cache" : "public, max-age=3600"
    });
    stream.pipe(res);
  });
}

const tokensAdmin = new Set();

function senhaVerifica(candidata, real) {
  const a = Buffer.from(String(candidata));
  const b = Buffer.from(String(real));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    const partes = url.pathname.split("/").filter(Boolean); // ["api", ...]

    if (url.pathname === "/api/produtos") {
      const data = lerJson("produtos.json");
      return data ? responder(res, 200, data) : responder(res, 500, { erro: "Cardápio indisponível." });
    }

    if (url.pathname === "/api/bairros") {
      const data = lerJson("bairros.json");
      return data ? responder(res, 200, data) : responder(res, 500, { erro: "Tabela de entrega indisponível." });
    }

    if (url.pathname === "/api/config") {
      const cfg = configPublico();
      const bairros = lerJson("bairros.json") || { bairros: [] };
      return responder(res, 200, { ...cfg, bairros: bairros.bairros || [] });
    }

    if (url.pathname === "/api/auth" && req.method === "POST") {
      try {
        const corpo = await lerCorpo(req);
        const cfg = lerJson("restaurante.json") || {};
        if (cfg.admin_senha && senhaVerifica(corpo.senha, cfg.admin_senha)) {
          const token = crypto.randomBytes(24).toString("hex");
          tokensAdmin.add(token);
          return responder(res, 200, { ok: true, token });
        }
        return responder(res, 401, { erro: "Senha incorreta." });
      } catch {
        return responder(res, 400, { erro: "Dados inválidos." });
      }
    }

    if (url.pathname === "/api/pedidos" && req.method === "POST") {
      try {
        const corpo = await lerCorpo(req);
        const cfg = lerJson("restaurante.json") || {};
        const bairros = (lerJson("bairros.json") || { bairros: [] }).bairros || [];
        const produtos = (lerJson("produtos.json") || { categorias: [] }).categorias.flatMap((c) => c.produtos || []);
        const { erros, pedido } = validarPedido(corpo, bairros, cfg, produtos);

        if (erros.length) return responder(res, 400, { erro: erros.join(" ") });

        const endereco =
          corpo.tipo === "entrega"
            ? JSON.stringify(typeof corpo.endereco === "string" ? JSON.parse(corpo.endereco) : corpo.endereco)
            : null;

        const codigo = novoCodigo();
        const agora = new Date().toISOString();
        const insere = db.prepare(`
          INSERT INTO pedidos (codigo, cliente, telefone, tipo, endereco, itens, subtotal,
            taxa_entrega, cupom, desconto, total, pagamento, troco_para, observacao, status, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insere.run(
          codigo,
          String(corpo.cliente).trim(),
          String(corpo.telefone).trim(),
          corpo.tipo,
          endereco,
          JSON.stringify(pedido.itens),
          pedido.subtotal,
          pedido.taxaEntrega,
          pedido.cupom,
          pedido.desconto,
          pedido.total,
          String(corpo.pagamento || ""),
          corpo.troco_para || null,
          String(corpo.observacao || "").trim() || null,
          "recebido",
          agora
        );

        return responder(res, 201, {
          pedido: {
            codigo,
            status: "recebido",
            total: pedido.total,
            subtotal: pedido.subtotal,
            taxa_entrega: pedido.taxaEntrega,
            desconto: pedido.desconto,
            tipo: corpo.tipo,
            criado_em: agora
          }
        });
      } catch (e) {
        return responder(res, 400, { erro: e.message || "Não foi possível registrar o pedido." });
      }
    }

    // Acompanhar pedido público: GET /api/pedidos/:codigo
    if (url.pathname.startsWith("/api/pedidos/") && req.method === "GET") {
      if (partes[2] === "acompanhar") {
        const codigo = partes[3];
        const linha = db.prepare("SELECT codigo, tipo, status, total, criado_em FROM pedidos WHERE codigo = ?").get(codigo);
        return linha
          ? responder(res, 200, { pedido: linha })
          : responder(res, 404, { erro: "Pedido não encontrado." });
      }
    }

    // Admin: listar pedidos
    if (url.pathname === "/api/pedidos" && req.method === "GET") {
      if (!tokensAdmin.has(req.headers["x-admin-token"])) return responder(res, 401, { erro: "Não autorizado." });
      const linhas = db.prepare("SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT 200").all();
      const lista = linhas.map((l) => ({
        ...l,
        endereco: l.endereco ? JSON.parse(l.endereco) : null,
        itens: JSON.parse(l.itens)
      }));
      return responder(res, 200, { pedidos: lista });
    }

    // Admin: alterar status: PATCH /api/pedidos/:id/status
    if (url.pathname.match(/^\/api\/pedidos\/\d+\/status$/) && req.method === "PATCH") {
      if (!tokensAdmin.has(req.headers["x-admin-token"])) return responder(res, 401, { erro: "Não autorizado." });
      const id = parseInt(partes[2], 10);
      try {
        const corpo = await lerCorpo(req);
        if (!statusValidos.includes(corpo.status)) return responder(res, 400, { erro: "Status inválido." });
        db.prepare("UPDATE pedidos SET status = ? WHERE id = ?").run(corpo.status, id);
        return responder(res, 200, { ok: true });
      } catch {
        return responder(res, 400, { erro: "Não foi possível atualizar." });
      }
    }

    return responder(res, 404, { erro: "Rota não encontrada." });
  }

  servirArquivo(req, res, url.pathname);
});

server.listen(PORT, () => {
  sincronizarCardapioJs();
  console.log(`Fortuna no ar → http://localhost:${PORT}`);
  console.log(`  Loja ............ http://localhost:${PORT}/index.html`);
  console.log(`  Pedido online ... http://localhost:${PORT}/pedido.html`);
  console.log(`  Admin ........... http://localhost:${PORT}/admin.html`);
});

function sincronizarCardapioJs() {
  try {
    const origem = path.join(DATA, "cardapio.json");
    const destino = path.join(DATA, "cardapio.js");
    const json = fs.readFileSync(origem, "utf8");
    const js = "window.CARDAPIO = " + json.replace(/<\//g, "<\\/") + ";";
    if (!fs.existsSync(destino) || fs.readFileSync(destino, "utf8") !== js) {
      fs.writeFileSync(destino, js);
      console.log("  data/cardapio.js sincronizado com cardapio.json");
    }
  } catch (e) {
    console.warn("  Falha ao sincronizar cardapio.js:", e.message);
  }
}