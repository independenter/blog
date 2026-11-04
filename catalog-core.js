/* 一休 · 目录核心：数据加载 + 导轨/顶栏壳 + 共享渲染器 */
(function () {
  "use strict";

  const DATA = "assets/data/";
  const cache = new Map();

  async function fetchJson(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then((res) => {
        if (!res.ok) throw new Error(url + " → " + res.status);
        return res.json();
      }));
    }
    return cache.get(url);
  }

  const loadPlatforms = () => fetchJson(DATA + "platforms.json");
  const loadIndex = () => fetchJson(DATA + "index.json");
  const loadPlatform = (pid) => fetchJson(DATA + "tools/" + pid + ".json");
  const loadStats = () => fetchJson(DATA + "stats.json");

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const KIND_LABEL = { product: "产品", research: "研究", script: "脚本", doc: "文档", tool: "工具", admin: "管理端" };
  const VIS_LABEL = { public: "公开", notice: "说明" };

  function badge(vis) {
    return '<span class="badge ' + esc(vis) + '">' + esc(vis) + "</span>";
  }

  function rowThumb(src, alt) {
    if (!src) return '<span class="row-thumb" aria-hidden="true"></span>';
    return '<img class="row-thumb" src="' + esc(src) + '" alt="' + esc(alt || "") + '" loading="lazy" decoding="async">';
  }

  /* ---------- density ---------- */

  function applyDensity(value) {
    document.body.dataset.density = value;
    document.querySelectorAll("[data-density-set]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.densitySet === value));
    });
    try { localStorage.setItem("yx-density", value); } catch (_) { /* private mode */ }
  }

  function initDensity() {
    let value = "comfortable";
    try { value = localStorage.getItem("yx-density") || value; } catch (_) { /* ignore */ }
    applyDensity(value);
    document.querySelectorAll("[data-density-set]").forEach((btn) => {
      btn.addEventListener("click", () => applyDensity(btn.dataset.densitySet));
    });
  }

  /* ---------- shell (rail + topbar) ---------- */

  function initShell(opts) {
    const o = opts || {};
    const rail = document.getElementById("rail");
    const stats = o.stats;

    const platformLinks = (o.platforms || []).map((p) =>
      '<a class="rail-link" href="platform.html?p=' + encodeURIComponent(p.id) + '"' +
      (o.activePlatform === p.id ? ' aria-current="page"' : "") + ">" +
      "<span>" + esc(p.title) + '</span><span class="count">' + p.tools + "</span></a>"
    ).join("");

    rail.innerHTML =
      '<a class="brand" href="index.html">' +
      '<span class="brand-mark">休</span>' +
      "<span><span class=\"brand-name\">一休 · 密码工程</span><br>" +
      '<span class="brand-sub">CRYPTO WORKBENCH</span></span></a>' +
      '<label class="rail-search"><span class="mono muted">/</span>' +
      '<input id="rail-q" type="search" placeholder="搜索 ' + (stats ? stats.tools : "") + ' 个工具…" aria-label="搜索工具">' +
      "<kbd>⌘K</kbd></label>" +
      '<nav class="rail-nav" aria-label="平台"><div class="rail-label">平台 / ' + (o.platforms || []).length + "</div>" +
      platformLinks + "</nav>" +
      '<nav class="rail-nav" aria-label="站点"><div class="rail-label">站点</div>' +
      '<a class="rail-link" href="work.html"' + (o.activeNav === "work" ? ' aria-current="page"' : "") +
      '><span>全部工具目录</span><span class="count">' + (stats ? stats.tools : "") + "</span></a>" +
      '<a class="rail-link" href="blog.html"><span>博客</span><span class="count">↗</span></a>' +
      '<a class="rail-link" href="admin.html"><span>管理端</span><span class="count">↗</span></a></nav>' +
      '<div class="rail-foot">' +
      "<span>BUILD 2026.11.03</span>" +
      "<span>" + (stats ? stats.tools : "?") + " 公开 · " + (stats ? stats.hidden : "?") + " 条内部未公开</span>" +
      "<span>SM2 · SM3 · SM4 · SM9 · ZUC · PQC</span></div>";

    const railQ = document.getElementById("rail-q");
    if (o.onSearch) {
      railQ.addEventListener("input", () => o.onSearch(railQ.value));
      if (o.searchFocus) {
        railQ.addEventListener("focus", () => o.searchFocus());
      }
    } else {
      railQ.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const q = railQ.value.trim();
          location.href = "work.html" + (q ? "?q=" + encodeURIComponent(q) : "");
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        railQ.focus();
      }
      if (e.key === "/" && document.activeElement !== railQ &&
          !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        railQ.focus();
      }
    });

    document.querySelectorAll(".rail-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        rail.dataset.open = rail.dataset.open === "true" ? "false" : "true";
      });
    });

    initDensity();
  }

  /* ---------- incremental table ---------- */

  function createIncrementalTable(tbody, loadMoreEl, renderRow, pageSize) {
    const size = pageSize || 60;
    let items = [];
    let shown = 0;
    let token = 0;

    function paintMore() {
      const end = Math.min(shown + size, items.length);
      let html = "";
      for (let i = shown; i < end; i++) html += renderRow(items[i], i);
      tbody.insertAdjacentHTML("beforeend", html);
      shown = end;
      updateFoot();
    }

    function updateFoot() {
      if (!loadMoreEl) return;
      if (shown >= items.length) {
        loadMoreEl.textContent = items.length
          ? "已加载全部 " + items.length + " 条"
          : "";
        loadMoreEl.style.display = items.length ? "" : "none";
      } else {
        loadMoreEl.textContent = "滚动加载 · 当前 " + shown + " / " + items.length;
        loadMoreEl.style.display = "";
      }
    }

    const observer = ("IntersectionObserver" in window) && loadMoreEl
      ? new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting) && shown < items.length) paintMore();
        }, { rootMargin: "600px" })
      : null;
    if (observer) observer.observe(loadMoreEl);

    return {
      setItems(next) {
        token += 1;
        items = next;
        shown = 0;
        tbody.textContent = "";
        paintMore();
      },
      get count() { return items.length; },
      get shown() { return shown; },
    };
  }

  window.Catalog = {
    loadPlatforms, loadIndex, loadPlatform, loadStats,
    esc, badge, rowThumb, KIND_LABEL, VIS_LABEL,
    initShell, initDensity, applyDensity, createIncrementalTable,
  };
})();
