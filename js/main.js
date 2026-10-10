document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  const navLinks = mainNav ? mainNav.querySelectorAll("a") : [];

  const onScroll = () => {
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 40);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      mainNav.classList.toggle("open");
      const aberto = mainNav.classList.contains("open");
      navToggle.innerHTML = aberto
        ? '<i class="fa-solid fa-xmark"></i>'
        : '<i class="fa-solid fa-bars"></i>';
      navToggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      });
    });
  }

  const revelar = document.querySelectorAll(".section-head, .card, .events-card, .local-grid, .rating-box");

  if ("IntersectionObserver" in window && revelar.length > 0) {
    revelar.forEach((el) => el.classList.add("reveal-core"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revelar.forEach((el) => observer.observe(el));
  }
});