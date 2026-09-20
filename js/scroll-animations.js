(() => {
  "use strict";

  const selectors = [
    "[data-reveal]",
    ".ld-feature",
    ".ld-passo",
    ".ld-plano",
    ".ld-section-head",
    ".db-metric",
    ".db-row-2 > *",
    ".db-attention-list",
  ].join(", ");

  const initScrollAnimations = () => {
    const elements = () =>
      document.querySelectorAll(
        `${selectors}:not(.reveal-on-scroll):not(.is-visible)`,
      );

    // Se o navegador não suportar IntersectionObserver, o conteúdo
    // continua totalmente visível. A animação é apenas um aprimoramento.
    if (!("IntersectionObserver" in window)) return;

    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      document.querySelectorAll(selectors).forEach((element) => {
        element.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          instance.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -50px",
      },
    );

    const observeNewElements = () => {
      elements().forEach((element) => {
        element.classList.add("reveal-on-scroll");
        observer.observe(element);
      });
    };

    observeNewElements();

    // Algumas telas montam o conteúdo depois de uma chamada assíncrona.
    // Observamos apenas novas inserções, sem interferir na lógica da página.
    const mutationObserver = new MutationObserver(observeNewElements);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollAnimations, {
      once: true,
    });
  } else {
    initScrollAnimations();
  }
})();
