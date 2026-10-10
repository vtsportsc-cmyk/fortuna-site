const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => moeda.format(Number(v) || 0);

const ESTADO = {
  config: null,
  bairros: [],
  categorias: [],
  carrinho: [],
  entrega: { tipo: "entrega", bairro: null },
  cupom: null,
  ultimoItens: []
};

const FLUXO_ENTREGA = [
  { key: "recebido", rotulo: "Pedido recebido", desc: "Chegou no Fortuna" },
  { key: "preparando", rotulo: "Em preparo", desc: "Sendo preparado com capricho" },
  { key: "saiu_para_entrega", rotulo: "Saiu para entrega", desc: "A caminho do seu endereço" },
  { key: "entregue", rotulo: "Entregue", desc: "Aproveite!" }
];
const FLUXO_RETIRADA = [
  { key: "recebido", rotulo: "Pedido recebido", desc: "Chegou no Fortuna" },
  { key: "preparando", rotulo: "Em preparo", desc: "Sendo preparado com capricho" },
  { key: "pronto_retirada", rotulo: "Pronto para retirada", desc: "Avise o código no balcão" },
  { key: "entregue", rotulo: "Retirado", desc: "Aproveite!" }
];
const STATUS_ROTULO = {
  recebido: "Recebido",
  preparando: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  pronto_retirada: "Pronto para retirada",
  entregue: "Entregue / Retirado",
  cancelado: "Cancelado"
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function salvar() {
  localStorage.setItem("fortuna_carrinho", JSON.stringify({ carrinho: ESTADO.carrinho, entrega: ESTADO.entrega, cupom: ESTADO.cupom }));
}

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem("fortuna_carrinho"));
    if (d) {
      ESTADO.carrinho = d.carrinho || [];
      ESTADO.entrega = { tipo: "entrega", bairro: null, ...(d.entrega || {}) };
      ESTADO.cupom = d.cupom || null;
    }
  } catch {
    /* ignora */
  }
}

function chaveItem(id, opcoes) {
  return `${id}::${(opcoes || []).map((o) => o.nome).sort().join("|")}`;
}

function produtosAchatados() {
  return ESTADO.categorias.flatMap((c) => c.produtos || []);
}

function encontrarProduto(id) {
  return produtosAchatados().find((p) => p.id === id);
}

function bairrosAtivos() {
  return ESTADO.bairros.filter((b) => b.ativo);
}

/* ============================================================
   CARDÁPIO
   ============================================================ */

function criarCardProduto(p) {
  const card = document.createElement("article");
  card.className = "product-card";

  const thumb = document.createElement("div");
  thumb.className = "product-thumb" + (p.imagem ? "" : " product-thumb--placeholder");
  if (p.imagem) {
    const el = document.createElement("img");
    el.src = p.imagem;
    el.alt = p.nome;
    el.loading = "lazy";
    thumb.appendChild(el);
  } else {
    thumb.innerHTML = '<i class="fa-solid fa-utensils"></i>';
  }
  card.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "product-info";
  const nome = document.createElement("div");
  nome.className = "product-name";
  nome.textContent = p.nome;
  info.appendChild(nome);
  if (p.descricao) {
    const desc = document.createElement("div");
    desc.className = "product-desc";
    desc.textContent = p.descricao;
    info.appendChild(desc);
  }
  card.appendChild(info);

  const acoes = document.createElement("div");
  acoes.className = "product-actions";
  acoes.id = `act-${p.id}`;
  card.appendChild(acoes);
  montarAcoesProduto(acoes, p);
  return card;
}

function montarAcoesProduto(acoes, p) {
  acoes.innerHTML = "";
  acoes.appendChild(precoEl(p));
  const no = ESTADO.carrinho.find((i) => i.produto_id === p.id);
  const m = (delta) => adicionar(p, (no && no.opcoes ? no.opcoes : []).map((n) => ({ nome: n })), delta);
  if (no) {
    const st = document.createElement("div");
    st.className = "qty-stepper";
    st.innerHTML = `<button type="button" data-dir="out" aria-label="Diminuir"><i class="fa-solid fa-minus"></i></button><span>${no.qtd}</span><button type="button" data-dir="in" aria-label="Aumentar"><i class="fa-solid fa-plus"></i></button>`;
    st.querySelector("[data-dir='out']").addEventListener("click", () => m(-1));
    st.querySelector("[data-dir='in']").addEventListener("click", () => m(1));
    acoes.appendChild(st);
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-btn";
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar';
    btn.addEventListener("click", () => abrirProduto(p));
    acoes.appendChild(btn);
  }
}

function precoEl(p) {
  const w = document.createElement("div");
  w.className = "product-price";
  w.textContent = fmt(p.preco);
  if (p.preco_original) {
    const orig = document.createElement("small");
    orig.className = "price-original";
    orig.textContent = `de ${fmt(p.preco_original)}`;
    w.appendChild(orig);
  }
  return w;
}

function renderizarCardapio() {
  const groups = $("#menu-groups");
  groups.innerHTML = "";
  ESTADO.categorias.forEach((cat) => {
    const grupo = document.createElement("section");
    grupo.className = "menu-group";
    grupo.id = `cat-${cat.id}`;

    const head = document.createElement("div");
    head.className = "menu-group-head";
    head.innerHTML = `<i class="fa-solid ${cat.icone || "fa-utensils"}"></i>`;
    const titulo = document.createElement("div");
    const h2 = document.createElement("h2");
    h2.textContent = cat.nome;
    titulo.appendChild(h2);
    if (cat.descricao) {
      const p = document.createElement("p");
      p.textContent = cat.descricao;
      titulo.appendChild(p);
    }
    head.appendChild(titulo);
    grupo.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "product-grid";
    cat.produtos.forEach((p) => grid.appendChild(criarCardProduto(p)));
    grupo.appendChild(grid);
    groups.appendChild(grupo);
  });

  const nav = $("#cat-nav");
  nav.innerHTML = "";
  ESTADO.categorias.forEach((cat) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "cat-pill";
    pill.dataset.cat = String(cat.id);
    pill.innerHTML = `<i class="fa-solid ${cat.icone || "fa-utensils"}"></i> ${cat.nome}`;
    pill.addEventListener("click", () => {
      document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      ativarPill(pill);
    });
    nav.appendChild(pill);
  });
  if (nav.firstElementChild) ativarPill(nav.firstElementChild);
  observarCategorias();
}

function ativarPill(pill) {
  $$(".cat-pill").forEach((p) => p.classList.toggle("active", p === pill));
}

function observarCategorias() {
  const groups = $$(".menu-group");
  if (!("IntersectionObserver" in window) || !groups.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = en.target.id.replace("cat-", "");
          const alvo = $$(".cat-pill").find((p) => p.dataset.cat === id);
          if (alvo) ativarPill(alvo);
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  groups.forEach((g) => obs.observe(g));
}

/* ============================================================
   CARRINHO
   ============================================================ */

function mudarQtde(produto, delta) {
  adicionar(produto, null, delta);
}

function adicionar(produto, opcoes, delta) {
  delta = delta === undefined ? 1 : delta;
  const k = chaveItem(produto.id, opcoes);
  const existente = ESTADO.carrinho.find((i) => i.chave === k);
  if (existente) {
    existente.qtd = Math.max(1, Math.min(99, existente.qtd + delta));
  } else if (delta > 0) {
    const extra = (opcoes || []).reduce((s, o) => s + (o.adicional || 0), 0);
    ESTADO.carrinho.push({
      chave: k,
      produto_id: produto.id,
      nome: produto.nome,
      imagem: produto.imagem || null,
      preco_unit: Number(produto.preco) + Number(extra),
      qtd: 1,
      opcoes: (opcoes || []).map((o) => o.nome)
    });
  }
  salvar();
  atualizarCarrinho();
  const acoes = document.getElementById(`act-${produto.id}`);
  if (acoes) montarAcoesProduto(acoes, produto);
}

function removerItem(chave) {
  ESTADO.carrinho = ESTADO.carrinho.filter((i) => i.chave !== chave);
  salvar();
  atualizarCarrinho();
  produtosAchatados().forEach((p) => {
    const acoes = document.getElementById(`act-${p.id}`);
    if (acoes) montarAcoesProduto(acoes, p);
  });
}

function atualizarCarrinho() {
  const alvo = $("#cart-panel");
  if (alvo) {
    alvo.innerHTML = "";
    alvo.appendChild(cartCard());
  }
  atualizarDrawer();
  atualizarBadge();
  atualizarBarraMobile();
}

function atualizarBadge() {
  const badge = $("#cart-badge");
  if (!badge) return;
  const n = qtdTotal();
  badge.textContent = n;
  badge.classList.toggle("hidden", n === 0);
}

function subtotal() {
  return ESTADO.carrinho.reduce((s, i) => s + i.preco_unit * i.qtd, 0);
}

function qtdTotal() {
  return ESTADO.carrinho.reduce((s, i) => s + i.qtd, 0);
}

function bairroAtual() {
  return bairrosAtivos().find((b) => b.nome === ESTADO.entrega.bairro) || null;
}

function descontoCupom(base) {
  const cupom = (ESTADO.config && ESTADO.config.cupons) ? ESTADO.config.cupons[ESTADO.cupom] : null;
  if (!cupom) return 0;
  return cupom.tipo === "percentual" ? (base * cupom.valor) / 100 : Math.min(cupom.valor, base);
}

function taxas() {
  const st = subtotal();
  const desc = descontoCupom(st);
  const taxa = ESTADO.entrega.tipo === "entrega" ? (bairroAtual() ? bairroAtual().taxa : 0) : 0;
  return { subtotal: st, desconto: desc, taxa, total: st - desc + taxa };
}

function cartCard() {
  const wrap = document.createElement("div");
  wrap.className = "cart-card";
  const head = document.createElement("div");
  head.className = "cart-header";
  head.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> <span>Sua Sacola</span>';
  wrap.appendChild(head);

  if (!ESTADO.carrinho.length) {
    const vazio = document.createElement("div");
    vazio.className = "cart-empty";
    vazio.innerHTML = '<i class="fa-solid fa-basket-shopping"></i><p>Sua sacola está vazia.<br>Adicione algo delicioso :)</p>';
    wrap.appendChild(vazio);
    return wrap;
  }

  const itens = document.createElement("div");
  itens.className = "cart-items";
  ESTADO.carrinho.forEach((i) => itens.appendChild(itemLinha(i)));
  wrap.appendChild(itens);
  wrap.appendChild(blocoEntrega());
  wrap.appendChild(blocoCupom());
  wrap.appendChild(totaisEl());
  wrap.appendChild(ctaEl());
  return wrap;
}

function itemLinha(i) {
  const row = document.createElement("div");
  row.className = "cart-item";

  const img = document.createElement("div");
  img.className = "cart-item-img" + (i.imagem ? "" : " cart-item-img--ph");
  if (i.imagem) {
    const el = document.createElement("img");
    el.src = i.imagem;
    el.alt = i.nome;
    img.appendChild(el);
  } else {
    img.innerHTML = '<i class="fa-solid fa-utensils"></i>';
  }
  row.appendChild(img);

  const main = document.createElement("div");
  main.className = "cart-item-main";
  const nome = document.createElement("div");
  nome.className = "cart-item-name";
  nome.textContent = `${i.qtd}× ${i.nome}`;
  main.appendChild(nome);
  if (i.opcoes && i.opcoes.length) {
    const opt = document.createElement("div");
    opt.className = "cart-item-opt";
    opt.textContent = i.opcoes.join(", ");
    main.appendChild(opt);
  }
  const preco = document.createElement("div");
  preco.className = "cart-item-price";
  preco.textContent = fmt(i.preco_unit);
  main.appendChild(preco);
  row.appendChild(main);

  const side = document.createElement("div");
  side.className = "cart-item-side";
  const st = document.createElement("div");
  st.className = "qty-stepper";
  st.innerHTML = `<button type="button" data-dir="out" aria-label="Diminuir"><i class="fa-solid fa-minus"></i></button><span>${i.qtd}</span><button type="button" data-dir="in" aria-label="Aumentar"><i class="fa-solid fa-plus"></i></button>`;
  st.querySelector("[data-dir='out']").addEventListener("click", () => {
    const p = encontrarProduto(i.produto_id);
    if (p) mudarQtde(p, -1);
    else if (i.qtd <= 1) removerItem(i.chave);
  });
  st.querySelector("[data-dir='in']").addEventListener("click", () => {
    const p = encontrarProduto(i.produto_id);
    if (p) mudarQtde(p, 1);
  });
  side.appendChild(st);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "cart-remove";
  rm.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  rm.addEventListener("click", () => removerItem(i.chave));
  side.appendChild(rm);
  row.appendChild(side);
  return row;
}

function blocoEntrega() {
  const box = document.createElement("div");
  const seg = document.createElement("div");
  seg.className = "seg";
  seg.style.margin = "14px 0 10px";

  const opE = document.createElement("button");
  opE.type = "button";
  opE.className = "seg-option" + (ESTADO.entrega.tipo === "entrega" ? " active" : "");
  opE.innerHTML = '<i class="fa-solid fa-motorcycle"></i><span>Entrega</span>';
  opE.addEventListener("click", () => setarTipo("entrega"));
  const opR = document.createElement("button");
  opR.type = "button";
  opR.className = "seg-option" + (ESTADO.entrega.tipo === "retirada" ? " active" : "");
  opR.innerHTML = '<i class="fa-solid fa-store"></i><span>Retirada</span>';
  opR.addEventListener("click", () => setarTipo("retirada"));
  seg.appendChild(opE);
  seg.appendChild(opR);
  box.appendChild(seg);

  if (ESTADO.entrega.tipo === "entrega") {
    const sel = document.createElement("select");
    sel.className = "coupon-input";
    sel.style.marginTop = "4px";
    sel.innerHTML = '<option value="">Selecione seu bairro</option>';
    bairrosAtivos().forEach((b) => {
      const o = document.createElement("option");
      o.value = b.nome;
      o.textContent = `${b.nome} — entrega ${fmt(b.taxa)}`;
      sel.appendChild(o);
    });
    if (ESTADO.entrega.bairro) sel.value = ESTADO.entrega.bairro;
    sel.addEventListener("change", () => {
      ESTADO.entrega.bairro = sel.value || null;
      salvar();
      atualizarCarrinho();
    });
    box.appendChild(sel);
  }
  return box;
}

function setarTipo(tipo) {
  if (tipo === "retirada") ESTADO.entrega.bairro = null;
  ESTADO.entrega.tipo = tipo;
  salvar();
  atualizarCarrinho();
}

function blocoCupom() {
  const box = document.createElement("div");
  box.className = "coupon-row";
  box.style.marginTop = "14px";
  const input = document.createElement("input");
  input.className = "coupon-input";
  input.placeholder = "Tem um cupom?";
  input.autocomplete = "off";
  if (ESTADO.cupom) input.value = ESTADO.cupom;
  box.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost btn-sm";
  btn.textContent = "Aplicar";
  btn.addEventListener("click", () => {
    const v = input.value.trim().toUpperCase();
    if (!v) {
      ESTADO.cupom = null;
      salvar();
      atualizarCarrinho();
      return;
    }
    if ((ESTADO.config.cupons || {})[v]) ESTADO.cupom = v;
    else {
      ESTADO.cupom = null;
      alert("Cupom inválido.");
    }
    salvar();
    atualizarCarrinho();
  });
  box.appendChild(btn);
  return box;
}

function totaisEl() {
  const t = taxas();
  const div = document.createElement("div");
  div.className = "cart-totals";
  const semBairro = ESTADO.entrega.tipo === "entrega" && !bairroAtual();
  div.innerHTML = `
    <div class="row"><span>Subtotal</span><strong>${fmt(t.subtotal)}</strong></div>
    ${t.desconto ? `<div class="row"><span>Cupom ${ESTADO.cupom}</span><strong style="color:#2ee078">− ${fmt(t.desconto)}</strong></div>` : ""}
    <div class="row row--tax"><span>Taxa de entrega</span><strong>${ESTADO.entrega.tipo === "retirada" ? "Grátis" : t.taxa ? fmt(t.taxa) : "A calcular"}</strong></div>
    <div class="row row--total"><span>Total</span><strong>${semBairro ? fmt(t.subtotal - t.desconto) + " + entrega" : fmt(t.total)}</strong></div>
  `;
  return div;
}

function ctaEl() {
  const wrap = document.createElement("div");
  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "btn btn-gold cart-cta";
  cta.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Finalizar Pedido';
  cta.addEventListener("click", () => {
    fecharDrawer();
    abrirCheckout();
  });
  wrap.appendChild(cta);
  const note = document.createElement("p");
  note.className = "cart-note";
  note.textContent = `Pedido mínimo: ${fmt(ESTADO.config.valor_pedido_minimo || 0)}`;
  wrap.appendChild(note);
  return wrap;
}

/* ============================================================
   DRAWER + MODAIS
   ============================================================ */

function atualizarDrawer() {
  const drawer = $("#cart-drawer");
  if (!drawer || drawer.classList.contains("hidden")) return;
  drawer.innerHTML = "";
  const head = document.createElement("div");
  head.className = "cart-header";
  head.innerHTML = '<span><i class="fa-solid fa-bag-shopping"></i> Sua Sacola</span>';
  const x = document.createElement("button");
  x.className = "cart-drawer-close";
  x.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  x.addEventListener("click", fecharDrawer);
  head.appendChild(x);
  drawer.appendChild(head);
  drawer.appendChild(cartCard());
}

function atualizarBarraMobile() {
  const bar = $("#mobile-cart-bar");
  if (!bar) return;
  if (!qtdTotal()) {
    bar.classList.add("hidden");
    return;
  }
  const t = taxas();
  const semBairro = ESTADO.entrega.tipo === "entrega" && !bairroAtual();
  $("#mobile-cart-total").textContent = fmt(semBairro ? t.subtotal - t.desconto : t.total);
  $("#mobile-cart-count").textContent = `${qtdTotal()} ${qtdTotal() === 1 ? "item" : "itens"}`;
  bar.classList.remove("hidden");
}

function abrirDrawer() {
  $("#cart-backdrop").classList.remove("hidden");
  $("#cart-drawer").classList.remove("hidden");
  atualizarDrawer();
  document.body.style.overflow = "hidden";
}

function fecharDrawer() {
  $("#cart-drawer").classList.add("hidden");
  $("#cart-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
}

function abrirModal(id) {
  $(`#${id}`).classList.remove("hidden");
  $("#modal-backdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const focus = $(`#${id} input, #${id} button`);
  if (focus) focus.focus();
}

function fecharModais() {
  $$(".modal").forEach((m) => m.classList.add("hidden"));
  $("#modal-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============================================================
   MODAL DE PRODUTO
   ============================================================ */

function abrirProduto(p) {
  const body = $("#product-modal-body");
  body.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "pm-layout";
  const thumb = document.createElement("div");
  thumb.className = "pm-img" + (p.imagem ? "" : " pm-img--ph");
  if (p.imagem) {
    const el = document.createElement("img");
    el.src = p.imagem;
    el.alt = p.nome;
    thumb.appendChild(el);
  } else {
    thumb.innerHTML = '<i class="fa-solid fa-utensils"></i>';
  }
  layout.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "pm-info";
  const nome = document.createElement("div");
  nome.className = "pm-name";
  nome.textContent = p.nome;
  info.appendChild(nome);
  const preco = document.createElement("div");
  preco.className = "pm-price";
  preco.textContent = fmt(p.preco);
  if (p.preco_original) {
    preco.innerHTML += `<span class="price-original" style="text-align:left">de ${fmt(p.preco_original)}</span>`;
  }
  info.appendChild(preco);
  if (p.descricao) {
    const desc = document.createElement("div");
    desc.className = "pm-desc";
    desc.textContent = p.descricao;
    info.appendChild(desc);
  }
  layout.appendChild(info);
  body.appendChild(layout);

  let escolhida = null;
  const rota = (p.opcoes && p.opcoes.length) ? p.opcoes : null;
  if (rota) {
    const opts = document.createElement("div");
    opts.className = "pm-options";
    const h = document.createElement("h4");
    h.textContent = "Escolha a proteína";
    opts.appendChild(h);
    const lista = document.createElement("div");
    lista.className = "option-list";
    rota.forEach((o) => {
      const item = document.createElement("label");
      item.className = "option-item";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "opcao";
      radio.value = o.nome;
      radio.addEventListener("change", () => {
        escolhida = o;
        totalLinha.textContent = fmt(Number(p.preco) + Number(o.adicional || 0));
        $$(".option-item").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
      });
      item.appendChild(radio);
      const span = document.createElement("span");
      span.textContent = o.adicional ? `${o.nome} (+ ${fmt(o.adicional)})` : o.nome;
      item.appendChild(span);
      lista.appendChild(item);
    });
    opts.appendChild(lista);
    body.appendChild(opts);
  }

  const add = document.createElement("div");
  add.className = "option-add";
  const totalLinha = document.createElement("span");
  totalLinha.className = "pm-total";
  totalLinha.textContent = fmt(p.preco);
  add.appendChild(totalLinha);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-gold";
  btn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar à sacola';
  btn.addEventListener("click", () => {
    adicionar(p, escolhida ? [escolhida] : null, 1);
    fecharModais();
  });
  add.appendChild(btn);
  body.appendChild(add);

  abrirModal("product-modal");
}

/* ============================================================
   CHECKOUT
   ============================================================ */

function abrirCheckout() {
  if (!ESTADO.carrinho.length) {
    abrirDrawer();
    return;
  }
  const t = taxas();
  const body = $("#checkout-body");
  body.innerHTML = "";
  body.innerHTML = `
    <div class="modal-title" id="checkout-title">Finalizar Pedido</div>
    <p class="modal-sub">Revise e escolha como receber.</p>
  `;

  const rev = document.createElement("div");
  rev.className = "review-list";
  ESTADO.carrinho.forEach((i) => {
    const rv = document.createElement("div");
    rv.className = "rv";
    const optsHtml = i.opcoes && i.opcoes.length ? ` <small style="color:var(--muted-2)">(${i.opcoes.join(" + ")})</small>` : "";
    rv.innerHTML = `<span>${i.qtd}× ${i.nome}${optsHtml}</span><b>${fmt(i.preco_unit * i.qtd)}</b>`;
    rev.appendChild(rv);
  });
  const ttl = document.createElement("div");
  ttl.className = "rv";
  ttl.innerHTML = `<span><strong>Total</strong>${t.taxa ? ' <small style="color:var(--muted-2)">(inclui entrega)</small>' : ""}</span><b>${fmt(t.total)}</b>`;
  rev.appendChild(ttl);
  body.appendChild(rev);

  if ((ESTADO.config.valor_pedido_minimo || 0) > 0 && t.subtotal < ESTADO.config.valor_pedido_minimo) {
    body.appendChild(errEl(`Pedido mínimo é ${fmt(ESTADO.config.valor_pedido_minimo)}.`));
  }
  body.appendChild(stepTitulo("Como quer receber?", "fa-truck-fast"));
  body.appendChild(segTipo());

  const form = document.createElement("div");
  form.className = "field-grid";
  body.appendChild(form);
  montarForm(form);

  body.appendChild(stepTitulo("Forma de pagamento", "fa-credit-card"));
  body.appendChild(pagEl());

  body.appendChild(stepTitulo("Observações", "fa-pen"));
  const obs = document.createElement("div");
  obs.className = "field field--full";
  obs.innerHTML = '<textarea id="ck-obs" maxlength="200" placeholder="Ex.: tirar a cebola, ponto da carne..."></textarea>';
  body.appendChild(obs);

  const acoes = document.createElement("div");
  acoes.className = "checkout-actions";
  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "btn btn-ghost";
  voltar.textContent = "Voltar";
  voltar.addEventListener("click", () => {
    fecharModais();
    abrirDrawer();
  });
  const confirmar = document.createElement("button");
  confirmar.type = "button";
  confirmar.className = "btn btn-gold";
  confirmar.innerHTML = `<strong>${fmt(t.total)}</strong> · Confirmar Pedido`;
  confirmar.addEventListener("click", () => enviarPedido());
  acoes.appendChild(voltar);
  acoes.appendChild(confirmar);
  body.appendChild(acoes);

  abrirModal("checkout-modal");
}

function stepTitulo(txt, icon) {
  const d = document.createElement("div");
  d.className = "checkout-step-title";
  d.innerHTML = `<i class="fa-solid ${icon}"></i> ${txt}`;
  return d;
}

function errEl(msg) {
  const e = document.createElement("div");
  e.className = "form-error";
  e.textContent = msg;
  return e;
}

function segTipo() {
  const seg = document.createElement("div");
  seg.className = "seg";
  const opE = document.createElement("button");
  opE.type = "button";
  opE.className = "seg-option" + (ESTADO.entrega.tipo === "entrega" ? " active" : "");
  opE.innerHTML = '<i class="fa-solid fa-motorcycle"></i><span>Entrega</span>';
  const opR = document.createElement("button");
  opR.type = "button";
  opR.className = "seg-option" + (ESTADO.entrega.tipo === "retirada" ? " active" : "");
  opR.innerHTML = '<i class="fa-solid fa-store"></i><span>Retirada no local</span>';
  seg.appendChild(opE);
  seg.appendChild(opR);
  opE.addEventListener("click", () => {
    opE.classList.add("active");
    opR.classList.remove("active");
    alternarForm(true);
  });
  opR.addEventListener("click", () => {
    opR.classList.add("active");
    opE.classList.remove("active");
    alternarForm(false);
  });
  return seg;
}

let formaAtual = "entrega";

function montarForm(form) {
  form.innerHTML = `
    <div class="field field--full"><label for="ck-nome">Nome completo</label><input id="ck-nome" maxlength="60" autocomplete="name"></div>
    <div class="field field--full"><label for="ck-fone">WhatsApp (com DDD)</label><input id="ck-fone" maxlength="18" inputmode="tel" placeholder="(21) 9 0000-0000"></div>
    <div class="field field--full entrega-only"><label for="ck-bairro">Bairro</label><select id="ck-bairro"></select><span class="fee-hint" id="ck-fee"></span></div>
    <div class="field field--full entrega-only"><label for="ck-rua">Rua</label><input id="ck-rua" maxlength="80" placeholder="Rua, avenida..."></div>
    <div class="field entrega-only"><label for="ck-num">Número</label><input id="ck-num" maxlength="10"></div>
    <div class="field entrega-only"><label for="ck-comp">Complemento</label><input id="ck-comp" maxlength="40" placeholder="Apto, bloco..."></div>
    <div class="field field--full entrega-only"><label for="ck-ref">Ponto de referência</label><input id="ck-ref" maxlength="80"></div>
  `;
  const sel = form.querySelector("#ck-bairro");
  sel.innerHTML = '<option value="">Selecione</option>';
  bairrosAtivos().forEach((b) => {
    const o = document.createElement("option");
    o.value = b.nome;
    o.textContent = `${b.nome} — ${fmt(b.taxa)} (~${b.tempo} min)`;
    sel.appendChild(o);
  });
  if (formaAtual === "entrega" && ESTADO.entrega.bairro) sel.value = ESTADO.entrega.bairro;
  const fee = form.querySelector("#ck-fee");
  const atual = () => {
    const b = bairrosAtivos().find((x) => x.nome === sel.value);
    fee.innerHTML = b ? `Taxa de entrega: <strong>${fmt(b.taxa)}</strong> · tempo estimado <strong>${b.tempo} min</strong>` : "";
  };
  sel.addEventListener("change", atual);
  atual();
  alternarForm(formaAtual === "entrega");
}

function alternarForm(entrega) {
  formaAtual = entrega ? "entrega" : "retirada";
  $$(".entrega-only").forEach((el) => el.classList.toggle("hidden", !entrega));
}

function pagEl() {
  const pay = document.createElement("div");
  pay.className = "pay-list";
  const formas = [
    { k: "pix", ic: "fa-solid fa-qrcode", txt: "Pix", det: "Enviaremos a chave no WhatsApp" },
    { k: "dinheiro", ic: "fa-solid fa-money-bill", txt: "Dinheiro", det: "Troco para quanto?" },
    { k: "maquina", ic: "fa-solid fa-credit-card", txt: "Cartão / Máquina", det: "Na entrega ou retirada" }
  ];
  let pag = "pix";
  formas.forEach((f) => {
    const item = document.createElement("label");
    item.className = "pay-item" + (f.k === pag ? " selected" : "");
    item.innerHTML = `<i class="${f.ic}"></i><span>${f.txt}</span><small>${f.det}</small>`;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pag";
    radio.checked = f.k === pag;
    radio.addEventListener("change", () => {
      pag = f.k;
      troco.classList.toggle("hidden", f.k !== "dinheiro");
      $$(".pay-item").forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
    });
    item.appendChild(radio);
    pay.appendChild(item);
  });
  const troco = document.createElement("div");
  troco.className = "field hidden";
  troco.innerHTML = '<label for="ck-troco">Troco para</label><input id="ck-troco" maxlength="10" inputmode="decimal" placeholder="Ex.: 50">';
  pay.appendChild(troco);
  return pay;
}

async function enviarPedido() {
  const minimo = ESTADO.config.valor_pedido_minimo || 0;
  if (minimo > 0 && subtotal() < minimo) {
    alert(`Pedido mínimo é ${fmt(minimo)}.`);
    return;
  }
  const corpo = lerFormulario();
  if (corpo.erro) {
    let ex = $("#checkout-body .form-error");
    if (ex) ex.remove();
    $("#checkout-body").appendChild(errEl(corpo.erro));
    return;
  }

  const btn = $("#checkout-body .checkout-actions .btn-gold");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando pedido...';
  }

  let resp = null;
  try {
    const r = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo.dados)
    });
    resp = await r.json();
    if (!r.ok) throw new Error(resp.erro || "Não foi possível registrar o pedido.");
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Confirmar Pedido";
    }
    alert(err.message);
    return;
  }

  ESTADO.ultimoItens = ESTADO.carrinho.slice();
  ESTADO.carrinho = [];
  ESTADO.cupom = null;
  salvar();
  fecharModais();
  atualizarCarrinho();
  montarResultado(resp.pedido, corpo.dados);
}

function lerFormulario() {
  const entrega = formaAtual === "entrega";
  const val = (s) => ($(s) ? $(s).value.trim() : "");
  const dados = {
    cliente: val("#ck-nome"),
    telefone: val("#ck-fone"),
    tipo: formaAtual,
    endereco: entrega
      ? {
          rua: val("#ck-rua"),
          numero: val("#ck-num"),
          complemento: val("#ck-comp"),
          bairro: $("#ck-bairro") ? $("#ck-bairro").value : "",
          referencia: val("#ck-ref")
        }
      : null,
    itens: ESTADO.carrinho.map((i) => ({ produto_id: i.produto_id, qtd: i.qtd, opcoes: (i.opcoes || []).map((n) => ({ nome: n })) })),
    cupom: ESTADO.cupom,
    pagamento: ($$("input[name='pag']").find((r) => r.checked) || {}).value || "pix",
    troco_para: $("#ck-troco") && $("#ck-troco").value ? parseFloat($("#ck-troco").value.replace(",", ".")) : null,
    observacao: val("#ck-obs")
  };
  const msgs = [];
  if (dados.cliente.length < 3) msgs.push("Informe seu nome.");
  if (!/^[0-9+\s()-]{10,18}$/.test(dados.telefone)) msgs.push("Informe um WhatsApp válido com DDD.");
  if (entrega) {
    if (!dados.endereco.bairro) msgs.push("Selecione o bairro.");
    if (dados.endereco.rua.length < 3) msgs.push("Informe a rua.");
    if (!dados.endereco.numero) msgs.push("Informe o número.");
  }
  return msgs.length ? { erro: msgs.join(" ") } : { dados };
}

function montarResultado(pedido, dados) {
  const body = $("#done-body");
  const t = taxas();
  body.innerHTML = "";
  body.innerHTML = `
    <div class="success-icon"><i class="fa-solid fa-check"></i></div>
    <div class="modal-title" id="done-title" style="text-align:center">Pedido confirmado!</div>
    <p class="modal-sub" style="text-align:center">O Fortuna já recebeu o seu pedido e começa a preparar.</p>
    <div class="done-code">${pedido.codigo}</div>
    <p class="done-total">Total: <strong style="color:var(--gold)">${fmt(pedido.total)}</strong>
      ${pedido.tipo === "retirada" ? "· retirada no balcão" : "· entrega em sua casa"}</p>
  `;

  const acoes = document.createElement("div");
  acoes.className = "done-actions";
  const wa = document.createElement("a");
  wa.className = "btn btn-whatsapp";
  wa.href = `https://api.whatsapp.com/send/?phone=${ESTADO.config.whatsapp}&text=${encodeURIComponent(textoWhatsApp(pedido, dados))}`;
  wa.target = "_blank";
  wa.rel = "noopener";
  wa.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Enviar resumo no WhatsApp';
  acoes.appendChild(wa);
  const trk = document.createElement("button");
  trk.type = "button";
  trk.className = "btn btn-ghost";
  trk.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Acompanhar status';
  trk.addEventListener("click", () => {
    fecharModais();
    $("#track-code").value = pedido.codigo;
    document.getElementById("acompanhar").scrollIntoView({ behavior: "smooth" });
    buscarStatus(pedido.codigo);
  });
  acoes.appendChild(trk);
  body.appendChild(acoes);

  const fluxo = fluxoPara(pedido.tipo);
  const tl = document.createElement("div");
  tl.className = "status-timeline";
  tl.innerHTML = barraStatus(fluxo, "recebido");
  body.appendChild(tl);

  abrirModal("done-modal");
}

function fluxoPara(tipo) {
  return tipo === "retirada" ? FLUXO_RETIRADA : FLUXO_ENTREGA;
}

function textoWhatsApp(pedido, dados) {
  const linhas = [
    `*NOVO PEDIDO — ${pedido.codigo}*`,
    "",
    ...ESTADO.ultimoItens.map((i) => `${i.qtd}× ${i.nome}${i.opcoes && i.opcoes.length ? ` (${i.opcoes.join(", ")})` : ""} — ${fmt(i.preco_unit * i.qtd)}`),
    "",
    `Subtotal: ${fmt(pedido.subtotal)}`,
    pedido.desconto ? `Cupom ${pedido.cupom || ""}: − ${fmt(pedido.desconto)}` : "",
    pedido.tipo === "retirada" ? "Retirada na loja" : `Entrega: ${fmt(pedido.taxa_entrega)}`,
    `*Total: ${fmt(pedido.total)}*`,
    "",
    `Cliente: ${dados.cliente}`,
    `Telefone: ${dados.telefone}`,
    dados.tipo === "entrega" ? `Endereço: ${dados.endereco.rua}, ${dados.endereco.numero}${dados.endereco.complemento ? " · " + dados.endereco.complemento : ""} — ${dados.endereco.bairro}${dados.endereco.referencia ? ` (ref: ${dados.endereco.referencia})` : ""}` : "",
    `Pagamento: ${dados.pagamento}${dados.troco_para ? ` (troco p/ ${fmt(dados.troco_para)})` : ""}`,
    dados.observacao ? `Observações: ${dados.observacao}` : ""
  ].filter(Boolean);
  return linhas.join("\n");
}

/* ============================================================
   ACOMPANHAR
   ============================================================ */

function barraStatus(fluxo, status, cancelado) {
  if (cancelado) {
    return '<div class="form-error"><i class="fa-solid fa-circle-xmark"></i> Este pedido foi cancelado. Fale conosco pelo WhatsApp (21) 98666-3972.</div>';
  }
  const idx = fluxo.findIndex((f) => f.key === status);
  return fluxo.map((f, i) => {
    const cls = i < idx ? "done" : i === idx ? "active" : "";
    const icono = i < idx
      ? '<i class="fa-solid fa-check"></i>'
      : `<i class="fa-solid ${i === idx ? "fa-spinner fa-spin" : "fa-regular fa-circle"}"></i>`;
    return `<div class="status-step ${cls}">
      <span class="status-dot">${icono}</span>
      <span class="st-text"><strong>${f.rotulo}</strong><small>${f.desc}</small></span>
    </div>`;
  }).join("");
}

async function buscarStatus(codigo) {
  const alvo = $("#track-result");
  alvo.innerHTML = '<p style="color:var(--muted-2);text-align:center">Buscando...</p>';
  try {
    const r = await fetch(`/api/pedidos/acompanhar/${encodeURIComponent(codigo)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Não encontrado.");
    const p = j.pedido;
    alvo.innerHTML = `
      <div class="review-list rv" style="margin-bottom:12px">
        <span>Pedido <b style="color:var(--gold)">${p.codigo}</b></span>
        <span><b>${STATUS_ROTULO[p.status] || p.status}</b></span>
      </div>
      ${barraStatus(fluxoPara(p.tipo), p.status, p.status === "cancelado")}
    `;
  } catch (e) {
    alvo.innerHTML = `<p class="form-error" style="text-align:center">${e.message || "Pedido não encontrado."}</p>`;
  }
}

/* ============================================================
   INFORMAÇÕES + INICIALIZAÇÃO
   ============================================================ */

function renderizarBairros() {
  const grid = $("#districts-grid");
  if (!grid) return;
  grid.innerHTML = "";
  bairrosAtivos().forEach((b) => {
    const chip = document.createElement("div");
    chip.className = "district-chip";
    chip.innerHTML = `<span><i class="fa-solid fa-location-dot" style="color:var(--gold);margin-right:6px"></i>${b.nome}</span><span>${fmt(b.taxa)}</span>`;
    grid.appendChild(chip);
  });
}

function aplicarConfig() {
  const c = ESTADO.config;
  const el = $("#dados-horarios");
  if (el && c.horario_almoço && c.horario_rodizio) {
    const ini = c.horario_almoço.includes("–") ? c.horario_almoço.split("–")[0] : c.horario_almoço;
    const fim = c.horario_rodizio.includes("–") ? c.horario_rodizio.split("–")[1] : c.horario_rodizio;
    el.textContent = `${ini} às ${fim}`;
  }
  const t1 = $("#dados-tempo");
  if (t1) t1.textContent = `${c.tempo_entrega_estimado_min} a ${c.tempo_entrega_estimado_max} min`;
  const t2 = $("#dados-minimo");
  if (t2) t2.textContent = fmt(c.valor_pedido_minimo);
}

async function apiJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha na API");
  return r.json();
}

async function iniciar() {
  carregar();
  $("#menu-loading").classList.remove("hidden");

  try {
    const [cfg, prod, bai] = await Promise.all([
      apiJson("/api/config"),
      apiJson("/api/produtos"),
      apiJson("/api/bairros")
    ]);
    ESTADO.config = cfg;
    ESTADO.categorias = (prod.categorias || []);
    ESTADO.bairros = Array.isArray(cfg.bairros) ? cfg.bairros : (bai.bairros || []);
  } catch {
    try {
      const [cfg, prod, bai] = await Promise.all([
        fetch("data/restaurante.json").then((r) => r.json()),
        fetch("data/produtos.json").then((r) => r.json()),
        fetch("data/bairros.json").then((r) => r.json())
      ]);
      ESTADO.config = cfg;
      ESTADO.categorias = prod.categorias || [];
      ESTADO.bairros = bai.bairros || [];
    } catch {
      $("#menu-loading").innerHTML = "<p>Não foi possível carregar o cardápio. Verifique se o servidor está no ar (node server.js).</p>";
      return;
    }
  }

  $("#menu-loading").classList.add("hidden");
  renderizarCardapio();
  renderizarBairros();
  aplicarConfig();
  atualizarCarrinho();

  $("#cart-button").addEventListener("click", abrirDrawer);
  $("#cart-backdrop").addEventListener("click", fecharDrawer);
  $("#mobile-cart-open").addEventListener("click", abrirDrawer);
  $("#product-modal-close").addEventListener("click", fecharModais);
  $("#checkout-close").addEventListener("click", fecharModais);
  $("#done-close").addEventListener("click", fecharModais);
  $("#modal-backdrop").addEventListener("click", fecharModais);
  $("#track-button").addEventListener("click", () => {
    const v = $("#track-code").value.trim().toUpperCase();
    if (v) buscarStatus(v);
  });
  $("#track-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = e.target.value.trim().toUpperCase();
      if (v) buscarStatus(v);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharDrawer();
      fecharModais();
    }
  });
}

document.addEventListener("DOMContentLoaded", iniciar);