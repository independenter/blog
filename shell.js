export function bindMedia(scope = document) {
  scope.querySelectorAll("[data-media] img").forEach((img) => {
    if (img.dataset.fallbackBound === "true") return;
    img.dataset.fallbackBound = "true";
    const wrap = img.closest("[data-media]");
    const fail = () => {
      if (wrap) wrap.classList.add("is-failed");
    };
    if (img.complete && img.naturalWidth === 0) fail();
    if (img.complete && img.naturalWidth > 0 && wrap) wrap.classList.add("is-loaded");
    img.addEventListener("error", fail, { once: true });
    img.addEventListener(
      "load",
      () => {
        if (wrap) {
          wrap.classList.remove("is-failed");
          wrap.classList.add("is-loaded");
        }
      },
      { once: true }
    );
  });
}

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

export function initShell() {
  const docEl = document.documentElement;
  const header = document.getElementById("site-head");
  const menuBtn = document.querySelector(".menu-btn");
  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  const wordmark = document.querySelector(".wordmark");

  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function setMenu(open) {
    docEl.classList.toggle("nav-open", open);
    docEl.classList.toggle("is-locked", open);
    if (!menuBtn) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "关闭" : "目录";
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", (event) => {
      const open = !docEl.classList.contains("nav-open");
      setMenu(open);
      if (open && event.detail === 0 && navLinks[0]) navLinks[0].focus();
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    wordmark?.addEventListener("click", () => setMenu(false));

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && docEl.classList.contains("nav-open")) setMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (!docEl.classList.contains("nav-open")) return;
      if (event.key === "Escape") {
        setMenu(false);
        menuBtn.focus();
        return;
      }
      if (event.key === "Tab") {
        const focusables = [wordmark, ...navLinks, menuBtn].filter(Boolean);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  const clock = document.getElementById("clock");
  if (clock) {
    const tick = () => {
      clock.textContent = timeFormatter.format(new Date());
    };
    tick();
    window.setInterval(tick, 1000);
  }

  bindMedia(document);
}
