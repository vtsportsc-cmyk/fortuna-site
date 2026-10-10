const CARDAPIO_URL = "data/cardapio.json";
const ICON_FALLBACK = "fa-utensils";

async function carregarCardapio() {
  if (window.CARDAPIO) return window.CARDAPIO;
  try {
    const resposta = await fetch(CARDAPIO_URL);
    if (!resposta.ok) throw new Error(`Erro: ${resposta.status}`);
    return await resposta.json();
  } catch (erro) {
    console.warn("Não foi possível carregar o cardápio:", erro.message);
    return null;
  }
}

function criarSlot(item) {
  const slot = document.createElement("div");
  slot.className = "sticker-slot";

  if (item.destaque) slot.classList.add("special-slot");
  if (item.esgotado) slot.classList.add("esgotado");

  const numero = document.createElement("div");
  numero.className = "slot-number";
  numero.textContent = `#${String(item.numero).padStart(2, "0")}`;
  slot.appendChild(numero);

  const nome = document.createElement("div");
  nome.className = "slot-name";
  nome.textContent = item.nome;
  slot.appendChild(nome);

  const detalhe = document.createElement("div");
  detalhe.className = "slot-role";
  detalhe.textContent = item.detalhe || "";
  slot.appendChild(detalhe);

  if (item.preco) {
    const preco = document.createElement("div");
    preco.className = "slot-preco";
    preco.textContent = `R$ ${item.preco}`;
    slot.appendChild(preco);
  }

  if (item.esgotado) {
    const flag = document.createElement("span");
    flag.className = "slot-flag";
    flag.innerHTML = '<i class="fa-solid fa-ban"></i>';
    flag.setAttribute("aria-label", "Esgotado hoje");
    slot.appendChild(flag);
  }

  if (item.imagem) {
    const img = document.createElement("img");
    img.src = item.imagem;
    img.alt = item.nome;
    img.className = "sticker-img";
    img.onload = () => {
      slot.classList.add("slot-preenchido");
      setTimeout(() => {
        img.style.animation = "none";
        img.style.opacity = "1";
      }, 600);
    };
    img.onerror = () => console.warn(`Imagem não encontrada: ${item.imagem}`);
    slot.insertBefore(img, slot.firstChild);
  }

  return slot;
}

function criarPagina(pagina, indice) {
  const wrapper = document.createElement("div");
  wrapper.className = indice % 2 === 0 ? "page page-left" : "page page-right";

  const conteudo = document.createElement("div");
  conteudo.className = "page-content";

  const header = document.createElement("div");
  header.className = "page-header";

  const badge = document.createElement("span");
  badge.className = "tech-badge";
  badge.innerHTML = `<i class="fa-solid ${pagina.icone || ICON_FALLBACK}"></i> ${pagina.badge}`;
  header.appendChild(badge);

  const titulo = document.createElement("h3");
  titulo.className = "page-title";
  titulo.textContent = pagina.titulo;
  header.appendChild(titulo);

  if (pagina.descricao) {
    const desc = document.createElement("p");
    desc.className = "page-desc";
    desc.textContent = pagina.descricao;
    header.appendChild(desc);
  }

  conteudo.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "stickers-grid";
  pagina.slots.forEach((item) => grid.appendChild(criarSlot(item)));
  conteudo.appendChild(grid);

  const footer = document.createElement("div");
  footer.className = "page-footer";
  const esquerda = document.createElement("span");
  esquerda.textContent = "FORTUNA · RODÍZIO & BUFFET";
  const direita = document.createElement("span");
  direita.textContent = `Pág. ${indice}  ·  `;
  const icone = document.createElement("i");
  icone.className = `fa-solid ${pagina.icone || ICON_FALLBACK}`;
  direita.appendChild(icone);
  footer.appendChild(esquerda);
  footer.appendChild(direita);

  conteudo.appendChild(footer);
  wrapper.appendChild(conteudo);

  return wrapper;
}

document.addEventListener("DOMContentLoaded", async () => {
  const cardapio = await carregarCardapio();
  const container = document.getElementById("dynamic-pages");

  if (cardapio && container) {
    const fragment = document.createDocumentFragment();
    cardapio.paginas.forEach((pagina, indice) => {
      fragment.appendChild(criarPagina(pagina, indice + 1));
    });
    container.appendChild(fragment);
  }

  const bookElement = document.getElementById("book");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  if (!bookElement || !btnPrev || !btnNext) return;

  let pageFlip = null;

  try {
    pageFlip = new St.PageFlip(bookElement, {
      width: 550,
      height: 800,
      size: "stretch",
      minWidth: 315,
      maxWidth: 1000,
      minHeight: 420,
      maxHeight: 1350,
      drawShadow: true,
      maxShadowOpacity: 0.4,
      showCover: true,
      mobileScrollSupport: true,
      useMouseEvents: false,
      showPageCorners: false,
      disableFlipByClick: true,
      flippingTime: 800
    });

    pageFlip.loadFromHTML(document.querySelectorAll(".page"));

    let activeDragPage = null;
    let isClicking = false;
    let startX = 0;
    let startY = 0;
    let dragStarted = false;

    document.querySelectorAll(".page").forEach((page, index) => {
      page.addEventListener("mousedown", (e) => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        isClicking = true;
        startX = e.clientX;
        startY = e.clientY;
        dragStarted = false;
        activeDragPage = { page, index };
      });

      page.addEventListener("touchstart", (e) => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        const touch = e.touches[0];
        isClicking = true;
        startX = touch.clientX;
        startY = touch.clientY;
        dragStarted = false;
        activeDragPage = { page, index };
      });
    });

    const handleMove = (clientX, clientY, isTouch = false) => {
      if (!isClicking || !activeDragPage) return;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      const bookRect = bookElement.getBoundingClientRect();

      if (distance > 10 && !dragStarted) {
        dragStarted = true;
        let cornerX, cornerY;

        const centerY = bookRect.top + bookRect.height / 2;
        cornerY = startY < centerY ? 0 : bookRect.height;

        cornerX = activeDragPage.index % 2 === 0 ? bookRect.width : 0;

        document.body.classList.add("dragging");
        pageFlip.startUserTouch({ x: cornerX, y: cornerY });
      }

      if (dragStarted) {
        pageFlip.userMove(
          { x: clientX - bookRect.left, y: clientY - bookRect.top },
          isTouch
        );
      }
    };

    const handleRelease = (clientX, clientY, isTouch = false) => {
      if (dragStarted) {
        const bookRect = bookElement.getBoundingClientRect();
        pageFlip.userStop(
          { x: clientX - bookRect.left, y: clientY - bookRect.top },
          isTouch
        );
      }
      isClicking = false;
      dragStarted = false;
      activeDragPage = null;
      document.body.classList.remove("dragging");
    };

    window.addEventListener("mousemove", (e) => handleMove(e.clientX, e.clientY, false));
    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY, true);
      }
    });
    window.addEventListener("mouseup", (e) => handleRelease(e.clientX, e.clientY, false));
    window.addEventListener("touchend", (e) => {
      const touch = e.changedTouches[0] || e.touches[0];
      handleRelease(touch ? touch.clientX : startX, touch ? touch.clientY : startY, true);
    });

    bookElement.style.display = "block";

    pageFlip.on("flip", (e) => {
      const currentPage = e.data;
      const totalPages = pageFlip.getPageCount();

      if (currentPage === 0) {
        btnPrev.classList.add("hidden");
      } else {
        btnPrev.classList.remove("hidden");
      }

      if (currentPage === totalPages - 1) {
        btnNext.classList.add("hidden");
      } else {
        btnNext.classList.remove("hidden");
      }
    });

    btnPrev.addEventListener("click", () => pageFlip.flipPrev());
    btnNext.addEventListener("click", () => pageFlip.flipNext());

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        pageFlip.flipPrev();
      } else if (e.key === "ArrowRight") {
        pageFlip.flipNext();
      }
    });

    btnPrev.classList.add("hidden");

    const params = new URLSearchParams(window.location.search);
    const paginaAlvo = parseInt(params.get("pagina"), 10);
    if (!isNaN(paginaAlvo) && paginaAlvo > 0 && paginaAlvo < pageFlip.getPageCount()) {
      setTimeout(() => pageFlip.flip(paginaAlvo), 350);
    }
  } catch (error) {
    console.error("Erro ao inicializar o álbum:", error);
  }
});