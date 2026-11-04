import { initShell, bindMedia } from "./shell.js";
import {
  RequestError,
  requestJson,
  messageFor,
  formatDate,
  formatDateTime,
  readingTime,
  renderMarkdown,
  renderMathAndMermaid,
  initials
} from "./api.js";

initShell();

const params = new URLSearchParams(window.location.search);
const slug = (params.get("slug") || "").trim();
const titleEl = document.getElementById("post-title");
const kickerEl = document.getElementById("post-kicker");
const excerptEl = document.getElementById("post-excerpt");
const metaEl = document.getElementById("post-meta");
const bodyEl = document.getElementById("post-body");
const coverEl = document.getElementById("post-cover");
const coverImg = document.getElementById("post-cover-img");
const coverMark = document.getElementById("post-cover-mark");
const stateEl = document.getElementById("post-state");
const editLink = document.getElementById("post-edit");

function setMeta(description) {
  const tag = document.querySelector('meta[name="description"]');
  if (tag && description) tag.setAttribute("content", description.slice(0, 160));
}

function showError(error) {
  const login = error?.code === "login_required";
  document.title = login ? "需要登录 · 一休" : "文章未找到 · 一休";
  kickerEl.textContent = login ? "LOGIN REQUIRED" : "NOT FOUND";
  titleEl.textContent = login ? "请先登录站点。" : "这篇文章没有找到。";
  excerptEl.textContent = messageFor(error);
  metaEl.replaceChildren();
  coverEl.hidden = true;
  bodyEl.hidden = true;
  editLink.hidden = true;
  stateEl.hidden = false;

  const box = document.createElement("div");
  box.className = "post-error";
  if (login) {
    const link = document.createElement("a");
    link.className = "text-link";
    link.href = `/__qoder_auth/start?return_path=${encodeURIComponent(
      `/post.html?slug=${encodeURIComponent(slug)}`
    )}`;
    link.textContent = "去登录 ↗";
    box.appendChild(link);
  } else if (error?.code !== "not_found") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-link";
    retry.textContent = "重新读取 ↻";
    retry.addEventListener("click", () => window.location.reload());
    box.appendChild(retry);
  }
  const back = document.createElement("a");
  back.className = "text-link";
  back.href = "blog.html";
  back.textContent = "返回札记 →";
  box.appendChild(back);
  stateEl.replaceChildren(box);
}

async function load() {
  if (!slug || !/^[a-z0-9-]{3,80}$/.test(slug)) {
    showError(new RequestError("not_found", 404));
    return;
  }

  try {
    const post = await requestJson(`/api/posts/${encodeURIComponent(slug)}`);
    if (
      !post ||
      typeof post.title !== "string" ||
      typeof post.content !== "string" ||
      typeof post.slug !== "string"
    ) {
      throw new RequestError("invalid_response", 0, true);
    }

    document.title = `${post.title} · 一休`;
    setMeta(post.excerpt || post.title);
    kickerEl.textContent = "笔记 / NOTE";
    titleEl.textContent = post.title;
    excerptEl.textContent = post.excerpt || "";
    excerptEl.hidden = !post.excerpt;

    metaEl.replaceChildren();
    const date = document.createElement("span");
    date.textContent = formatDateTime(post.publishedAt);
    const time = document.createElement("span");
    time.textContent = `${readingTime(post.content)} 分钟阅读`;
    metaEl.append(date, time);
    if (post.updatedAt && post.publishedAt && post.updatedAt !== post.publishedAt) {
      const updated = document.createElement("span");
      updated.textContent = `更新于 ${formatDate(post.updatedAt)}`;
      metaEl.appendChild(updated);
    }

    if (post.coverUrl) {
      coverEl.hidden = false;
      coverImg.src = post.coverUrl;
      coverImg.alt = `${post.title} 封面`;
      coverMark.textContent = initials(post.title);
    }

    bodyEl.innerHTML = renderMarkdown(post.content);
    renderMathAndMermaid(bodyEl);
    bindMedia(coverEl);
    stateEl.hidden = true;
    editLink.href = `admin.html?post=${encodeURIComponent(post.id)}`;
    editLink.hidden = false;
  } catch (error) {
    showError(error);
  }
}

load();
