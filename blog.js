import { initShell, bindMedia } from "./shell.js";
import {
  RequestError,
  requestJson,
  messageFor,
  formatDate,
  formatDateTime,
  initials
} from "./api.js";

initShell();

const PAGE = 24;
const feed = document.getElementById("notes-feed");
const stateEl = document.getElementById("notes-state");
const moreBtn = document.getElementById("notes-more");
const countEl = document.getElementById("notes-count");
const searchEl = document.getElementById("notes-search");
const yearsEl = document.getElementById("notes-years");
const filterCountEl = document.getElementById("notes-filter-count");

let all = [];
let filtered = [];
let rendered = 0;
let total = 0;
let year = "";
let query = "";
let busy = false;
let truncated = false;
let legacy = false;
let legacyOffset = 0;
let legacyHasMore = false;

function showSkeleton() {
  const wrap = document.createElement("div");
  wrap.className = "notes-skeleton";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
      <div class="note-row is-skeleton">
        <div class="skeleton skeleton-date"></div>
        <div class="note-main">
          <div class="skeleton skeleton-line skeleton-line--short"></div>
          <div class="skeleton skeleton-line skeleton-line--title"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
        <div class="skeleton skeleton-cover"></div>
      </div>`
    )
    .join("");
  feed.replaceChildren(wrap);
}

function buildCover(post, eager) {
  const figure = document.createElement("figure");
  figure.className = "note-cover media";
  figure.dataset.media = "";
  if (post.coverUrl) {
    const img = document.createElement("img");
    img.src = post.coverUrl;
    img.alt = "";
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    figure.appendChild(img);
    const fallback = document.createElement("div");
    fallback.className = "media-fallback";
    fallback.setAttribute("aria-hidden", "true");
    const mark = document.createElement("span");
    mark.className = "mf-mark";
    mark.textContent = initials(post.title);
    const text = document.createElement("span");
    text.className = "mf-text";
    text.textContent = "封面暂时无法加载";
    fallback.append(mark, text);
    figure.appendChild(fallback);
  } else {
    figure.classList.add("note-cover--empty");
    const mark = document.createElement("span");
    mark.className = "note-cover-mark";
    mark.textContent = initials(post.title);
    figure.appendChild(mark);
  }
  return figure;
}

function renderPost(post, index, lead) {
  const row = document.createElement("article");
  row.className = "note-row";
  if (lead) row.classList.add("note-row--lead");

  const link = document.createElement("a");
  link.className = "note-link";
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;

  const side = document.createElement("div");
  side.className = "note-side";
  const num = document.createElement("span");
  num.className = "note-index";
  num.textContent = String(index).padStart(2, "0");
  const date = document.createElement("time");
  date.className = "note-date";
  date.dateTime = post.publishedAt || "";
  date.textContent = formatDate(post.publishedAt);
  const clock = document.createElement("span");
  clock.className = "note-time";
  clock.textContent = post.publishedAt ? formatDateTime(post.publishedAt).split(" ")[1] || "" : "";
  side.append(num, date, clock);

  const main = document.createElement("div");
  main.className = "note-main";
  const meta = document.createElement("p");
  meta.className = "note-meta";
  meta.textContent = lead ? "最新" : "笔记";
  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = post.title;
  main.append(meta, title);
  if (post.excerpt) {
    const excerpt = document.createElement("p");
    excerpt.className = "note-excerpt";
    excerpt.textContent = post.excerpt;
    main.appendChild(excerpt);
  }

  const arrow = document.createElement("span");
  arrow.className = "note-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";

  link.append(side, main, buildCover(post, index <= 3), arrow);
  row.appendChild(link);
  return row;
}

function updateCount() {
  countEl.textContent = total ? `已发布 ${total}${truncated ? "+" : ""} 篇` : "正在读取…";
}

function updateFilterCount() {
  if (!filterCountEl) return;
  const active = Boolean(year || query.trim());
  filterCountEl.textContent = active ? `筛选出 ${filtered.length} 篇` : "";
  filterCountEl.hidden = !active;
}

function buildYears() {
  if (!yearsEl) return;
  const counts = new Map();
  for (const post of all) {
    const key = (post.publishedAt || "").slice(0, 4);
    if (/^\d{4}$/.test(key)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const years = [...counts.keys()].sort((a, b) => Number(b) - Number(a));
  yearsEl.replaceChildren();
  const make = (label, value, amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notes-year";
    button.dataset.year = value;
    button.setAttribute("aria-pressed", String(year === value));
    button.textContent = `${label} ${amount}`;
    button.addEventListener("click", () => {
      year = value;
      applyFilter();
    });
    yearsEl.appendChild(button);
  };
  make("全部", "", all.length);
  for (const value of years) make(value, value, counts.get(value));
}

function applyFilter() {
  const needle = query.trim().toLowerCase();
  filtered = all.filter((post) => {
    if (year && !(post.publishedAt || "").startsWith(year)) return false;
    if (!needle) return true;
    return `${post.title} ${post.excerpt}`.toLowerCase().includes(needle);
  });
  for (const button of yearsEl?.querySelectorAll(".notes-year") || []) {
    button.setAttribute("aria-pressed", String(button.dataset.year === year));
  }
  rendered = 0;
  feed.replaceChildren();
  stateEl.hidden = true;
  stateEl.replaceChildren();
  updateFilterCount();
  if (!filtered.length) {
    showEmpty();
    moreBtn.hidden = true;
    return;
  }
  renderMore();
}

function renderMore() {
  const next = filtered.slice(rendered, rendered + PAGE);
  next.forEach((post, i) => {
    const index = rendered + i + 1;
    feed.appendChild(renderPost(post, index, index === 1 && !year && !query.trim()));
  });
  rendered += next.length;
  const more = rendered < filtered.length || legacyHasMore;
  moreBtn.hidden = !more;
  moreBtn.textContent = "加载更多";
  moreBtn.disabled = false;
  bindMedia(feed);
}

function showEmpty() {
  stateEl.hidden = false;
  const box = document.createElement("div");
  box.className = "notes-empty";
  const kicker = document.createElement("p");
  kicker.className = "notes-empty-kicker";
  kicker.textContent = "NO NOTES";
  const title = document.createElement("h3");
  title.textContent = year || query.trim() ? "这个条件下没有文章。" : "第一篇文章正在路上。";
  const text = document.createElement("p");
  text.textContent =
    year || query.trim()
      ? "换一个年份，或者把关键词缩短一点。"
      : "这里会记录设计、代码，以及独立工作里的判断。";
  box.append(kicker, title, text);
  if (!year && !query.trim()) {
    const link = document.createElement("a");
    link.className = "text-link";
    link.href = "admin.html";
    link.textContent = "去后台写第一篇 ↗";
    box.appendChild(link);
  }
  stateEl.replaceChildren(box);
}

function showError(error) {
  stateEl.hidden = false;
  const box = document.createElement("div");
  box.className = "notes-error";
  const kicker = document.createElement("p");
  kicker.className = "notes-empty-kicker";
  kicker.textContent = error?.code === "login_required" ? "LOGIN REQUIRED" : "CONNECTION";
  const title = document.createElement("h3");
  title.textContent = error?.code === "login_required" ? "请先登录站点。" : "文章暂时没有加载出来。";
  const text = document.createElement("p");
  text.textContent = messageFor(error);
  box.append(kicker, title, text);

  if (error?.code === "login_required") {
    const login = document.createElement("a");
    login.className = "text-link";
    login.href = `/__qoder_auth/start?return_path=${encodeURIComponent("/blog.html")}`;
    login.textContent = "去登录 ↗";
    box.appendChild(login);
  } else {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-link";
    retry.textContent = "重新读取 ↻";
    retry.addEventListener("click", () => {
      stateEl.hidden = true;
      load();
    });
    box.appendChild(retry);
  }
  stateEl.replaceChildren(box);
}

async function loadLegacy() {
  const data = await requestJson(`/api/posts?limit=20&offset=${legacyOffset}`);
  if (!data || !Array.isArray(data.items)) {
    throw new RequestError("invalid_response", 0, true);
  }
  all.push(...data.items);
  legacyOffset = Number.isInteger(data.nextOffset) ? data.nextOffset : legacyOffset + data.items.length;
  legacyHasMore = Boolean(data.hasMore);
  total = all.length;
}

async function loadMoreLegacy() {
  if (busy) return;
  busy = true;
  moreBtn.disabled = true;
  moreBtn.textContent = "读取中…";
  try {
    const before = all.length;
    await loadLegacy();
    filtered = all;
    updateCount();
    filtered.slice(before).forEach((post, i) => {
      feed.appendChild(renderPost(post, before + i + 1, false));
    });
    rendered = all.length;
    moreBtn.hidden = !legacyHasMore;
    moreBtn.textContent = "加载更多";
    bindMedia(feed);
  } catch {
    moreBtn.hidden = false;
    moreBtn.textContent = "加载失败，重试";
  } finally {
    busy = false;
    moreBtn.disabled = false;
  }
}

async function load() {
  busy = true;
  countEl.textContent = "正在读取…";
  moreBtn.hidden = true;
  showSkeleton();
  feed.setAttribute("aria-busy", "true");
  try {
    const data = await requestJson("/api/posts/index");
    if (!data || !Array.isArray(data.items)) {
      throw new RequestError("invalid_response", 0, true);
    }
    all = data.items;
    total = Number.isInteger(data.total) ? data.total : all.length;
    truncated = Boolean(data.truncated);
    updateCount();
    buildYears();
    applyFilter();
  } catch (error) {
    if (error?.code === "not_found") {
      // Older deployment without the index route: fall back to the paged feed.
      legacy = true;
      all = [];
      try {
        await loadLegacy();
        updateCount();
        buildYears();
        applyFilter();
      } catch (inner) {
        feed.replaceChildren();
        countEl.textContent = "读取失败";
        showError(inner);
      }
    } else if (all.length === 0) {
      feed.replaceChildren();
      countEl.textContent = "读取失败";
      showError(error);
    }
  } finally {
    busy = false;
    feed.removeAttribute("aria-busy");
  }
}

moreBtn.addEventListener("click", () => {
  if (rendered < filtered.length) {
    renderMore();
  } else if (legacy && legacyHasMore) {
    loadMoreLegacy();
  }
});

let debounce = 0;
searchEl?.addEventListener("input", () => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    query = searchEl.value;
    applyFilter();
  }, 120);
});

load();
