import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zedpuboljbzkdpbzzlxl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__P11ZWk7IM3teDcCIz5x_g_YrkBLWDP';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class RequestError extends Error {
  constructor(code, status = 0, uncertain = false) {
    super(code);
    this.name = "RequestError";
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
  }
}

export async function requestJson(path, init = {}) {
  let response;
  const headers = { ...(init.headers || {}) };
  
  // 添加 Supabase Auth token（使用双重 header 以兼容网关）
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const token = `Bearer ${session.access_token}`;
    headers['authorization'] = token;
    headers['x-supabase-token'] = session.access_token; // 备用 header
  }
  
  if (init.body !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
      credentials: "same-origin",
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(20000)
    });
  } catch {
    throw new RequestError("network_error", 0, true);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new RequestError("invalid_response", response.status, true);
  }

  if (!response.ok) {
    throw new RequestError(
      typeof body?.error === "string" ? body.error : "request_failed",
      response.status,
      response.status >= 500 || response.status === 408
    );
  }
  return body;
}

export function messageFor(error) {
  const code = error instanceof RequestError ? error.code : "";
  const messages = {
    login_required: "请先登录站点，再继续。",
    forbidden: "这个后台只对站长账号开放。",
    owner_not_claimed: "还没有绑定站长账号。",
    not_found: "这篇文章不存在，或尚未发布。",
    invalid_input: "请检查标题、文章地址和正文后再试。",
    payload_too_large: "内容太长了，请精简后再保存。",
    slug_conflict: "这个文章地址已被使用，换一个试试。",
    write_conflict: "这篇文章刚被更新过，请刷新后再保存。",
    idempotency_conflict: "上次保存的内容与这次不同，请刷新列表确认。",
    create_failed: "文章没有保存成功，请稍后重试。",
    owner_claim_failed: "站长账号没有绑定成功，请重试。",
    network_error: "连接中断，保存结果尚未确认。请刷新列表核对。",
    invalid_response: "服务返回了无法识别的结果，请重试。",
    database_not_configured: "数据服务尚未配置完成。",
    database_credential_rejected: "数据服务暂不可用，请联系站点管理员。",
    method_not_allowed: "这个操作暂时不可用。"
  };
  return messages[code] ?? "暂时无法完成操作，请稍后重试。";
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const p = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${p.year}.${p.month}.${p.day}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const p = dateTimeFormatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

export function readingTime(content) {
  const text = String(content || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()~-]/g, " ");
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 400 + latin / 220));
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

export function renderMarkdown(source) {
  const lines = String(source ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  let html = "";
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quote = [];

  const mathStore = [];
  const mathRestore = (text) => text.replace(/__MATH_(\d+)__/g, (_, idx) => {
    const i = Number(idx);
    return `<span class="math-inline" data-math="${mathStore[i]}"></span>`;
  });

  const extractMath = (line) => {
    line = line.replace(/\$\$([^$]+)\$\$/g, (_, m) => {
      mathStore.push(escapeHtml(m.trim()));
      return `__MATH_${mathStore.length - 1}__`;
    });
    line = line.replace(/(?<!\$)\$(?!\$)([^$\n]+)\$(?!\$)/g, (_, m) => {
      mathStore.push(escapeHtml(m.trim()));
      return `__MATH_${mathStore.length - 1}__`;
    });
    return line;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${mathRestore(inline(paragraph.join("\n"))).replace(/\n/g, "<br>")}</p>`;
    paragraph = [];
  };
  const flushList = () => {
    if (!listType) return;
    html += `<${listType}>${listItems.join("")}</${listType}>`;
    listType = null;
    listItems = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    html += `<blockquote><p>${mathRestore(inline(quote.join("\n"))).replace(/\n/g, "<br>")}</p></blockquote>`;
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\$\$\s*$/.test(line.trim())) {
      flushAll();
      const math = [];
      i += 1;
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i].trim())) {
        math.push(lines[i]);
        i += 1;
      }
      const tex = escapeHtml(math.join("\n").trim());
      html += `<div class="math-block" data-math="${tex}"></div>`;
      continue;
    }

    if (/^```mermaid\s*$/i.test(line)) {
      flushAll();
      const diagram = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        diagram.push(lines[i]);
        i += 1;
      }
      html += `<div class="mermaid">${escapeHtml(diagram.join("\n"))}</div>`;
      continue;
    }

    if (/^```[a-z0-9-]*\s*$/i.test(line)) {
      flushAll();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
      continue;
    }

    const processed = extractMath(line);

    if (!processed.trim()) {
      flushAll();
      continue;
    }

    if (/^---+$/.test(processed.trim())) {
      flushAll();
      html += "<hr>";
      continue;
    }

    const heading = processed.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html += `<h${level}>${mathRestore(inline(heading[2]))}</h${level}>`;
      continue;
    }

    const quoteLine = processed.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }

    const ordered = processed.match(/^\d+\.\s+(.*)$/);
    const bullet = processed.match(/^[-*]\s+(.*)$/);
    if (ordered || bullet) {
      flushParagraph();
      flushQuote();
      const type = ordered ? "ol" : "ul";
      if (listType !== type) {
        flushList();
        listType = type;
      }
      listItems.push(`<li>${mathRestore(inline((ordered || bullet)[1]))}</li>`);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(processed);
  }

  flushAll();
  return html;
}

let _katexPromise = null;
let _mermaidPromise = null;

function loadKaTeX() {
  if (_katexPromise) return _katexPromise;
  _katexPromise = new Promise((resolve, reject) => {
    if (window.katex) { resolve(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("KaTeX load failed"));
    document.head.appendChild(script);
  });
  return _katexPromise;
}

function loadMermaid() {
  if (_mermaidPromise) return _mermaidPromise;
  _mermaidPromise = new Promise((resolve, reject) => {
    if (window.mermaid) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        themeVariables: {
          darkMode: true,
          background: "#111416",
          primaryColor: "#1d6f66",
          primaryTextColor: "#e7ecec",
          primaryBorderColor: "#3ee0c8",
          lineColor: "#3ee0c8",
          secondaryColor: "#171b1d",
          tertiaryColor: "#0b0d0e",
          fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif",
        }
      });
      resolve();
    };
    script.onerror = () => reject(new Error("Mermaid load failed"));
    document.head.appendChild(script);
  });
  return _mermaidPromise;
}

export async function renderMathAndMermaid(container) {
  if (!container) return;

  const mathBlocks = container.querySelectorAll(".math-block[data-math]");
  const inlineMath = container.querySelectorAll(".math-inline[data-math]");
  const mermaidBlocks = container.querySelectorAll(".mermaid:not([data-processed])");

  if (mathBlocks.length || inlineMath.length) {
    try {
      await loadKaTeX();
      mathBlocks.forEach((el) => {
        const tex = decodeURIComponent(el.dataset.math || "");
        try {
          window.katex.render(tex, el, { displayMode: true, throwOnError: false });
        } catch { el.textContent = tex; }
        delete el.dataset.math;
      });
      inlineMath.forEach((el) => {
        const tex = decodeURIComponent(el.dataset.math || "");
        try {
          window.katex.render(tex, el, { displayMode: false, throwOnError: false });
        } catch { el.textContent = tex; }
        delete el.dataset.math;
      });
    } catch { /* KaTeX unavailable */ }
  }

  if (mermaidBlocks.length) {
    try {
      await loadMermaid();
      for (const el of mermaidBlocks) {
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        try {
          const { svg } = await window.mermaid.render(id, el.textContent);
          el.innerHTML = svg;
        } catch { /* skip broken diagram */ }
        el.dataset.processed = "1";
      }
    } catch { /* Mermaid unavailable */ }
  }
}

export function slugify(title) {
  return String(title)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function initials(title) {
  return String(title || "文").trim().slice(0, 2);
}

export function isHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
