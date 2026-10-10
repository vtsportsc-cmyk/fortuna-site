const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const STATUS = [
  ["recebido", "Novos"],
  ["preparando", "Em preparo"],
  ["saiu_para_entrega", "Saiu p/ entrega"],
  ["pronto_retirada", "P/ retirada"],
  ["entregue", "Entregues"],
  ["cancelado", "Cancelados"]
];
const ROTULO = Object.fromEntries(STATUS.map(([k, v]) => [k, v]));

const ESTADO = {
  token: sessionStorage.getItem("fortuna_admin_token"),
  pedidos: [],
  filtro: "todos"
};

const $ = (s) => document.querySelector(s);

function esconder(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function mostrar(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

async function api(url, opcoes) {
  const r = await fetch(url, {
    ...opcoes,
    headers: { "Content-Type": "application/json", "x-admin-token": ESTADO.token, ...(opcoes && opcoes.headers) }
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

function proteger(callback) {
  return async (...args) => {
    if (!ESTADO.token) return mostrar("login-view");
    try {
      await callback(...args);
    } catch {
      sessionStorage.removeItem("fortuna_admin_token");
      ESTADO.token = null;
      mostrar("login-view");
      mostrar("login-err");
      $("#login-err").textContent = "Sessão expirada. Entre novamente.";
    }
  };
}

async function entrar() {
  const senha = $("#login-senha").value;
  const btn = $("#login-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  }
  const { ok, j } = await api("/api/auth", { method: "POST", body: JSON.stringify({ senha }) });
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
  if (!ok || !j.ok) {
    $("#login-err").classList.remove("hidden");
    return;
  }
  ESTADO.token = j.token;
  sessionStorage.setItem("fortuna_admin_token", j.token);
  $("#login-err").classList.add("hidden");
  $("#login-senha").value = "";
  mostrar("dash-view");
  esconder("login-view");
  carregarPedidos();
}

function sair() {
  ESTADO.token = null;
  sessionStorage.removeItem("fortuna_admin_token");
  esconder("dash-view");
  mostrar("login-view");
}

const carregarPedidos = proteger(async () => {
  const { ok, j } = await api("/api/pedidos");
  if (!ok) throw new Error(j.erro);
  ESTADO.pedidos = j.pedidos || [];
  $("#admin-updated").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  renderizarTudo();
});

function stats() {
  const s = { todos: ESTADO.pedidos.length };
  STATUS.forEach(([k]) => {
    s[k] = ESTADO.pedidos.filter((p) => p.status === k).length;
  });
  return s;
}

function renderizarTudo() {
  renderizarStats();
  renderizarTabs();
  renderizarOrdens();
}

function renderizarStats() {
  const s = stats();
  const grid = $("#stat-grid");
  grid.innerHTML = "";
  const cards = [
    ["todos", "Todos", ""],
    ...STATUS.map(([k, v]) => [k, v, k])
  ];
  cards.forEach(([k, rotulo, cls]) => {
    const d = document.createElement("div");
    d.className = "stat-card";
    d.innerHTML = `<b>${s[k] || 0}</b><span>${rotulo}</span>`;
    d.title = `${s[k] || 0} pedido(s)`;
    grid.appendChild(d);
  });
}

function renderizarTabs() {
  const wrap = $("#filter-tabs");
  wrap.innerHTML = "";
  const ali = [["todos", "Todos"], ...STATUS];
  ali.forEach(([k, v]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter-tab" + (ESTADO.filtro === k ? " active" : "");
    b.textContent = v;
    b.addEventListener("click", () => {
      ESTADO.filtro = k;
      renderizarTabs();
      renderizarOrdens();
    });
    wrap.appendChild(b);
  });
}

function filtrar() {
  return ESTADO.filtro === "todos" ? ESTADO.pedidos : ESTADO.pedidos.filter((p) => p.status === ESTADO.filtro);
}

function renderizarOrdens() {
  const lista = filtrar();
  const wrap = $("#orders-list");
  wrap.innerHTML = "";
  if (!lista.length) {
    wrap.innerHTML = '<div class="orders-empty"><i class="fa-solid fa-mug-hot"></i> Nenhum pedido neste filtro.</div>';
    return;
  }
  lista.forEach((p) => wrap.appendChild(cardOrdem(p)));
}

function cardOrdem(p) {
  const card = document.createElement("article");
  card.className = "order-card";
  card.dataset.id = p.id;

  const end = p.endereco || {};
  const data = new Date(p.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const head = document.createElement("div");
  head.className = "order-head";
  head.innerHTML = `
    <div class="order-code">${p.codigo}<small>${data} · id #${p.id}</small></div>
    <span class="status-badge ${p.status}">${ROTULO[p.status] || p.status}</span>
    <span class="order-total">${fmt(p.total)}</span>
    <i class="fa-solid fa-chevron-down order-chevr"></i>
  `;
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "order-body";
  body.innerHTML = `
    <div class="order-meta">
      <div class="m-block"><b>Cliente</b><span>${esc(p.cliente)}</span></div>
      <div class="m-block"><b>WhatsApp</b><span>${esc(p.telefone)}</span></div>
      <div class="m-block"><b>Entrega</b><span>${p.tipo === "retirada" ? "Retirada no balcão" : `${esc(end.bairro || "")} · ${esc(end.rua || "")}, ${esc(end.numero || "")}${end.complemento ? " · " + esc(end.complemento) : ""}${end.referencia ? " (ref: " + esc(end.referencia) + ")" : ""}`}</span></div>
      <div class="m-block"><b>Pagamento</b><span>${pagRotulo(p)}</span></div>
    </div>
    <div class="order-itens">
      ${p.itens.map((i) => `<div class="it"><span>${i.qtd}× ${esc(i.nome)}${i.opcoes && i.opcoes.length ? ` <small>(${esc(i.opcoes.map((o) => o.nome).join(", "))})</small>` : ""}</span><b>${fmt(i.subtotal)}</b></div>`).join("")}
    </div>
    <div class="order-resumo">
      <span>Subtotal <b>${fmt(p.subtotal)}</b></span>
      ${p.desconto ? `<span>Cupom ${esc(p.cupom || "")} <b style="color:#7ee0a3">− ${fmt(p.desconto)}</b></span>` : ""}
      <span>Taxa <b>${p.tipo === "retirada" ? "Grátis" : fmt(p.taxa_entrega)}</b></span>
      ${p.observacao ? `<span>Obs <b>${esc(p.observacao)}</b></span>` : ""}
      <span><b style="color:var(--gold)">Total ${fmt(p.total)}</b></span>
    </div>
    <div class="order-actions">
      <select class="status-select" data-id="${p.id}" aria-label="Alterar status">
        ${STATUS.map(([k, v]) => `<option value="${k}" ${p.status === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <a class="btn btn-ghost btn-sm order-whatsapp"
         href="https://api.whatsapp.com/send/?phone=5521986663972&text=${encodeURIComponent(textoWhatsApp(p))}"
         target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp"></i> Encaminhar no WhatsApp
      </a>
    </div>
  `;
  card.appendChild(body);

  head.addEventListener("click", () => card.classList.toggle("open"));
  const sel = body.querySelector(".status-select");
  sel.addEventListener("click", (e) => e.stopPropagation());
  sel.addEventListener("change", () => mudarStatus(p.id, sel.value));

  return card;
}

function pagRotulo(p) {
  const mapa = { pix: "Pix", dinheiro: "Dinheiro", maquina: "Cartão / máquina" };
  const base = mapa[p.pagamento] || p.pagamento;
  return p.troco_para ? `${base} (troco p/ ${fmt(p.troco_para)})` : base;
}

function textoWhatsApp(p) {
  const end = p.endereco || {};
  const linhas = [
    `*ATUALIZAÇÃO DO PEDIDO ${p.codigo}*`,
    "",
    `Cliente: ${p.cliente}`,
    `Telefone: ${p.telefone}`,
    p.tipo === "entrega"
      ? `Endereço: ${end.rua}, ${end.numero}${end.complemento ? " · " + end.complemento : ""} — ${end.bairro}${end.referencia ? " (ref: " + end.referencia + ")" : ""}`
      : "Retirada no balcão",
    "",
    ...p.itens.map((i) => `${i.qtd}× ${i.nome}${i.opcoes && i.opcoes.length ? ` (${i.opcoes.map((o) => o.nome).join(", ")})` : ""} — ${fmt(i.subtotal)}`),
    "",
    `Total: ${fmt(p.total)}`,
    `Pagamento: ${pagRotulo(p)}`
  ];
  return linhas.join("\n");
}

const mudarStatus = proteger(async (id, status) => {
  const { ok, j } = await api(`/api/pedidos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!ok) {
    alert(j.erro || "Não foi possível atualizar o status.");
    return;
  }
  await carregarPedidos();
});

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  $("#login-btn").addEventListener("click", entrar);
  $("#login-senha").addEventListener("keydown", (e) => {
    if (e.key === "Enter") entrar();
  });
  $("#btn-sair").addEventListener("click", sair);
  $("#btn-refresh").addEventListener("click", carregarPedidos);

  if (ESTADO.token) {
    esconder("login-view");
    mostrar("dash-view");
    mostrar("btn-sair");
    carregarPedidos();
  } else {
    $("#login-senha").focus();
  }
});