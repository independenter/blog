import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initShell } from "./shell.js";
import {
  RequestError,
  requestJson,
  messageFor,
  formatDate,
  formatDateTime,
  renderMarkdown,
  renderMathAndMermaid,
  slugify,
  isHttpsUrl
} from "./api.js";

const SUPABASE_URL = 'https://zedpuboljbzkdpbzzlxl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__P11ZWk7IM3teDcCIz5x_g_YrkBLWDP';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

initShell();

const gateEl = document.getElementById("admin-gate");
const gateKicker = document.getElementById("gate-kicker");
const gateTitle = document.getElementById("gate-title");
const gateText = document.getElementById("gate-text");
const gateActions = document.getElementById("gate-actions");
const appEl = document.getElementById("admin-app");
const identityEl = document.getElementById("admin-identity");
const logoutBtn = document.getElementById("logout-btn");
const listEl = document.getElementById("admin-list");
const listCountEl = document.getElementById("admin-list-count");
const searchInput = document.getElementById("admin-search");
const statusFilter = document.getElementById("admin-status-filter");
const listMoreBtn = document.getElementById("admin-list-more");
const adminCountEl = document.getElementById("admin-count");
const statusEl = document.getElementById("admin-status");
const newBtn = document.getElementById("new-post");
const emptyNewBtn = document.getElementById("empty-new");
const refreshBtn = document.getElementById("refresh-posts");
const editorEmpty = document.getElementById("editor-empty");
const form = document.getElementById("editor");
const editorMode = document.getElementById("editor-mode");
const editorVersion = document.getElementById("editor-version");
const titleInput = document.getElementById("f-title");
const slugInput = document.getElementById("f-slug");
const excerptInput = document.getElementById("f-excerpt");
const coverInput = document.getElementById("f-cover");
const contentInput = document.getElementById("f-content");
const titleCount = document.getElementById("title-count");
const excerptCount = document.getElementById("excerpt-count");
const contentCount = document.getElementById("content-count");
const saveBtn = document.getElementById("save-post");
const deleteBtn = document.getElementById("delete-post");
const viewLink = document.getElementById("view-post");
const coverPreview = document.getElementById("cover-preview");
const coverPreviewImg = document.getElementById("cover-preview-img");
const coverPreviewText = document.getElementById("cover-preview-text");
const contentPreview = document.getElementById("content-preview");
const viewButtons = Array.from(document.querySelectorAll(".editor-tabs button"));

const state = {
  session: null,
  me: null,
  posts: [],
  current: null,
  mode: "none",
  createKey: null,
  dirty: false,
  saving: false,
  armed: false,
  armedTimer: null,
  slugAuto: true,
  deepLinkHandled: false,
  openToken: 0,
  coverTimer: null,
  query: "",
  status: "",
  rendered: 60
};

const returnPath = `${window.location.pathname}${window.location.search}`;

function setStatus(text, tone = "") {
  statusEl.textContent = text || "";
  statusEl.dataset.tone = tone;
}

function setDirty(value) {
  state.dirty = value;
  editorMode.classList.toggle("is-dirty", value);
}

function renderGate({ kicker, title, text, actions = [] }) {
  gateEl.hidden = false;
  appEl.hidden = true;
  gateKicker.textContent = kicker;
  gateTitle.textContent = title;
  gateText.textContent = text;
  gateActions.replaceChildren();
  actions.forEach((action) => {
    const el = document.createElement(action.href ? "a" : "button");
    el.className = action.variant === "primary" ? "admin-primary" : "admin-quiet";
    el.textContent = action.label;
    if (action.href) {
      el.href = action.href;
      if (action.external) {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    } else {
      el.type = "button";
      el.addEventListener("click", action.onClick);
    }
    gateActions.appendChild(el);
  });
}

function showCheckingGate() {
  identityEl.textContent = "正在确认身份…";
  renderGate({ kicker: "CHECKING", title: "正在确认登录状态…", text: "" });
}

function showClaimGate() {
  identityEl.textContent = "账号待绑定";
  renderGate({
    kicker: "FIRST RUN",
    title: "把当前账号设为站长。",
    text: "首次使用会把当前登录账号绑定为唯一管理员。绑定后，只有这个账号能发布和修改文章。",
    actions: [
      {
        label: "绑定当前账号",
        variant: "primary",
        onClick: (event) => claimOwner(event.currentTarget)
      },
      { label: "回到作品集", href: "index.html" }
    ]
  });
}

function showForbiddenGate() {
  identityEl.textContent = "非站长账号";
  renderGate({
    kicker: "NO ACCESS",
    title: "这个后台只对站长开放。",
    text: "当前登录账号不是本站管理员，不能读取或修改文章。",
    actions: [{ label: "回到作品集", href: "index.html" }]
  });
}

function showErrorGate(error) {
  identityEl.textContent = "连接失败";
  renderGate({
    kicker: "CONNECTION",
    title: "暂时无法打开后台。",
    text: messageFor(error),
    actions: [
      { label: "重试", variant: "primary", onClick: () => loadSession() },
      { label: "回到作品集", href: "index.html" }
    ]
  });
}

function handleAuthError(error) {
  if (error instanceof RequestError && error.status === 401) {
    showLoginGate();
    return true;
  }
  if (error instanceof RequestError && error.status === 403) {
    showForbiddenGate();
    return true;
  }
  return false;
}

async function loadMe() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("no identity");
    state.me = { id: user.id, email: user.email, name: user.email };
    identityEl.textContent = `已登录：${user.email}`;
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } catch {
    identityEl.textContent = "未登录";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    state.session = null;
    state.me = null;
    await loadSession();
  });
}

async function claimOwner(button) {
  button.disabled = true;
  button.textContent = "绑定中…";
  try {
    await requestJson("/api/admin/claim", {
      method: "POST",
      body: JSON.stringify({ displayName: state.me?.name || "" })
    });
    await loadSession();
  } catch (error) {
    if (error instanceof RequestError && error.status === 403) {
      showForbiddenGate();
      return;
    }
    renderGate({
      kicker: "BIND FAILED",
      title: "账号没有绑定成功。",
      text: messageFor(error),
      actions: [
        { label: "重试绑定", variant: "primary", onClick: (event) => claimOwner(event.currentTarget) },
        { label: "回到作品集", href: "index.html" }
      ]
    });
  }
}

async function loadSession() {
  showCheckingGate();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showLoginGate();
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showLoginGate();
      return;
    }
    
    const OWNER_EMAILS = ['hui.dong@dbappsecurity.com.cn', 'm15501951002@163.com'];
    const isOwner = OWNER_EMAILS.includes(user.email);
    
    state.session = { claimed: true, isOwner };
    
    if (!isOwner) {
      showForbiddenGate();
      return;
    }
    
    gateEl.hidden = true;
    appEl.hidden = false;
    await loadMe();
    await loadPosts();
    const deepId = new URLSearchParams(window.location.search).get("post");
    if (deepId && !state.deepLinkHandled) {
      state.deepLinkHandled = true;
      if (state.posts.some((post) => post.id === deepId)) {
        await openPost(deepId, { force: true });
      }
    }
  } catch (error) {
    if (!handleAuthError(error)) showErrorGate(error);
  }
}

function showLoginGate() {
  gateEl.hidden = false;
  appEl.hidden = true;
  gateKicker.textContent = "LOGIN REQUIRED";
  gateTitle.textContent = "请先登录";
  gateText.textContent = "使用管理员账号登录以访问后台。";
  gateActions.replaceChildren();
  
  const form = document.createElement("form");
  form.style.display = "flex";
  form.style.flexDirection = "column";
  form.style.gap = "12px";
  form.style.maxWidth = "320px";
  
  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.placeholder = "邮箱";
  emailInput.required = true;
  emailInput.className = "admin-quiet";
  emailInput.style.padding = "8px 12px";
  
  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.placeholder = "密码";
  passwordInput.required = true;
  passwordInput.className = "admin-quiet";
  passwordInput.style.padding = "8px 12px";
  
  const loginBtn = document.createElement("button");
  loginBtn.type = "submit";
  loginBtn.textContent = "登录";
  loginBtn.className = "admin-primary";
  loginBtn.style.padding = "10px 16px";
  
  form.appendChild(emailInput);
  form.appendChild(passwordInput);
  form.appendChild(loginBtn);
  
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = "登录中…";
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value
      });
      
      if (error) throw error;
      
      await loadSession();
    } catch (error) {
      gateText.textContent = `登录失败：${error.message}`;
      loginBtn.disabled = false;
      loginBtn.textContent = "登录";
    }
  });
  
  gateActions.appendChild(form);
}

function validSummary(post) {
  return (
    post &&
    typeof post.id === "string" &&
    typeof post.slug === "string" &&
    typeof post.title === "string" &&
    (post.status === "draft" || post.status === "published") &&
    Number.isInteger(post.version)
  );
}

function filteredPosts() {
  const needle = state.query.trim().toLowerCase();
  return state.posts.filter((post) => {
    if (state.status && post.status !== state.status) return false;
    if (!needle) return true;
    return `${post.title} ${post.slug}`.toLowerCase().includes(needle);
  });
}

function renderList() {
  listEl.replaceChildren();
  const items = filteredPosts();
  const filtering = Boolean(state.query.trim() || state.status);
  listCountEl.textContent = state.posts.length
    ? filtering
      ? `(${items.length}/${state.posts.length})`
      : `(${state.posts.length})`
    : "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "admin-list-empty";
    empty.textContent = filtering
      ? "没有符合筛选条件的文章。"
      : "还没有文章。点「新建文章」开始。";
    listEl.appendChild(empty);
    listMoreBtn.hidden = true;
    const publishedEmpty = state.posts.filter((post) => post.status === "published").length;
    adminCountEl.textContent = state.posts.length
      ? `${state.posts.length} 篇 · ${publishedEmpty} 已发布`
      : "0 篇";
    return;
  }

  items.slice(0, state.rendered).forEach((post) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-item";
    button.dataset.id = post.id;
    if (state.current && state.current.id === post.id) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "true");
    }

    const top = document.createElement("span");
    top.className = "admin-item-top";
    const badge = document.createElement("span");
    badge.className = `admin-badge admin-badge--${post.status}`;
    badge.textContent = post.status === "published" ? "已发布" : "草稿";
    const time = document.createElement("span");
    time.className = "admin-item-time";
    time.textContent = formatDate(post.updatedAt);
    top.append(badge, time);

    const title = document.createElement("span");
    title.className = "admin-item-title";
    title.textContent = post.title;

    const slug = document.createElement("span");
    slug.className = "admin-item-slug";
    slug.textContent = `/${post.slug}`;

    button.append(top, title, slug);
    button.addEventListener("click", () => openPost(post.id));
    listEl.appendChild(button);
  });

  listMoreBtn.hidden = items.length <= state.rendered;
  listMoreBtn.textContent = `加载更多（还有 ${Math.max(0, items.length - state.rendered)} 篇）`;

  const published = state.posts.filter((post) => post.status === "published").length;
  adminCountEl.textContent = `${state.posts.length} 篇 · ${published} 已发布`;
}

async function loadPosts() {
  try {
    const data = await requestJson("/api/admin/posts/index");
    if (!data || !Array.isArray(data.items) || !data.items.every(validSummary)) {
      throw new RequestError("invalid_response", 0, true);
    }
    state.posts = data.items;
    state.rendered = Math.max(state.rendered, 60);
    if (state.current && !state.posts.some((post) => post.id === state.current.id)) {
      state.current = null;
      state.mode = "none";
      showEmptyEditor();
      history.replaceState(null, "", "admin.html");
      setStatus("这篇文章已被删除。", "muted");
    }
    renderList();
  } catch (error) {
    if (handleAuthError(error)) return;
    setStatus(`读取文章列表失败：${messageFor(error)}`, "error");
    if (!state.posts.length) {
      listEl.replaceChildren();
      const failed = document.createElement("p");
      failed.className = "admin-list-empty";
      failed.textContent = "列表读取失败，请点「刷新」重试。";
      listEl.appendChild(failed);
    }
  }
}

function updateCounts() {
  titleCount.textContent = `${titleInput.value.length} / 120`;
  excerptCount.textContent = `${excerptInput.value.length} / 240`;
  contentCount.textContent = `${contentInput.value.length} / 30000`;
}

function updateCoverPreview() {
  const url = coverInput.value.trim();
  if (!url) {
    coverPreview.hidden = true;
    coverPreview.classList.remove("is-invalid", "is-error");
    coverPreviewImg.removeAttribute("src");
    return;
  }
  coverPreview.hidden = false;
  if (!isHttpsUrl(url)) {
    coverPreview.classList.add("is-invalid");
    coverPreview.classList.remove("is-error");
    coverPreviewImg.removeAttribute("src");
    coverPreviewText.textContent = "请填写以 https:// 开头的图片地址";
    return;
  }
  coverPreview.classList.remove("is-invalid", "is-error");
  coverPreviewText.textContent = "封面预览";
  if (coverPreviewImg.getAttribute("src") !== url) {
    coverPreviewImg.src = url;
  }
}

coverPreviewImg.addEventListener("error", () => {
  coverPreview.classList.add("is-error");
  coverPreviewText.textContent = "这张图片无法加载，请检查地址";
});

coverPreviewImg.addEventListener("load", () => {
  coverPreview.classList.remove("is-error");
  coverPreviewText.textContent = "封面预览";
});

function setView(view) {
  form.dataset.view = view;
  viewButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  });
  const preview = view === "preview";
  contentInput.hidden = preview;
  contentPreview.hidden = !preview;
  if (preview) {
    contentPreview.innerHTML = contentInput.value.trim()
      ? renderMarkdown(contentInput.value)
      : '<p class="editor-preview-empty">正文还是空的。</p>';
    renderMathAndMermaid(contentPreview);
  }
}

function resetDeleteButton() {
  window.clearTimeout(state.armedTimer);
  state.armed = false;
  deleteBtn.classList.remove("is-armed");
  deleteBtn.textContent = "删除";
}

function fillForm(post) {
  state.fillingEditor = true;
  titleInput.value = post?.title || "";
  slugInput.value = post?.slug || "";
  excerptInput.value = post?.excerpt || "";
  coverInput.value = post?.coverUrl || "";
  contentInput.value = post?.content || "";
  form.querySelector(`input[name="status"][value="${post?.status === "published" ? "published" : "draft"}"]`).checked = true;

  state.slugAuto = !post;
  updateCounts();
  updateCoverPreview();
  setView("write");
  resetDeleteButton();

  editorMode.textContent = post ? "编辑文章" : "新文章";
  editorVersion.textContent = post
    ? `v${post.version} · 更新于 ${formatDateTime(post.updatedAt)}`
    : "尚未保存";
  saveBtn.textContent = post ? "保存更改" : "创建文章";
  viewLink.hidden = !(post && post.status === "published");
  if (post) viewLink.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  deleteBtn.hidden = !post;

  setDirty(false);
  editorEmpty.hidden = true;
  form.hidden = false;
  state.fillingEditor = false;
}

function showEmptyEditor() {
  form.hidden = true;
  editorEmpty.hidden = false;
  setStatus("", "");
}

function revealEditor() {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  const target = form.hidden ? editorEmpty : form;
  target.scrollIntoView({ block: "start", behavior: "smooth" });
}

function readForm() {
  return {
    title: titleInput.value.trim(),
    slug: slugInput.value.trim(),
    excerpt: excerptInput.value.trim(),
    coverUrl: coverInput.value.trim(),
    content: contentInput.value.trim(),
    status: form.querySelector('input[name="status"]:checked')?.value || "draft"
  };
}

function validate(values) {
  if (!values.title) return { message: "请填写标题。", field: titleInput };
  if (values.title.length > 120) return { message: "标题不能超过 120 个字符。", field: titleInput };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length < 3 || values.slug.length > 80) {
    return {
      message: "文章地址需为 3–80 位小写字母、数字或短横线，例如 design-notes-01。",
      field: slugInput
    };
  }
  if (values.excerpt.length > 240) return { message: "摘要不能超过 240 个字符。", field: excerptInput };
  if (values.coverUrl && !isHttpsUrl(values.coverUrl)) {
    return { message: "封面地址需要以 https:// 开头。", field: coverInput };
  }
  if (values.content.length > 30000) return { message: "正文不能超过 30000 个字符。", field: contentInput };
  if (values.status === "published" && !values.content) {
    return { message: "发布前需要先写正文。", field: contentInput };
  }
  return null;
}

function setSaving(on) {
  state.saving = on;
  form.setAttribute("aria-busy", String(on));
  saveBtn.disabled = on;
  deleteBtn.disabled = on;
  newBtn.disabled = on;
  refreshBtn.disabled = on;
  saveBtn.textContent = on ? "保存中…" : state.current ? "保存更改" : "创建文章";
}

async function save(event) {
  event.preventDefault();
  if (state.saving) return;

  const values = readForm();
  const problem = validate(values);
  if (problem) {
    setStatus(problem.message, "error");
    problem.field.focus();
    return;
  }

  setSaving(true);
  setStatus("正在保存…", "muted");
  const isNew = state.mode === "new" || !state.current;

  try {
    let post;
    if (isNew) {
      state.createKey = state.createKey || crypto.randomUUID();
      post = await requestJson("/api/admin/posts", {
        method: "POST",
        body: JSON.stringify({ ...values, idempotencyKey: state.createKey })
      });
    } else {
      post = await requestJson(`/api/admin/posts/${state.current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...values, version: state.current.version })
      });
    }

    if (!post || typeof post.id !== "string" || !Number.isInteger(post.version)) {
      throw new RequestError("invalid_response", 0, true);
    }

    state.current = post;
    state.mode = "edit";
    state.createKey = null;
    fillForm(post);
    history.replaceState(null, "", `admin.html?post=${post.id}`);
    await loadPosts();
    renderList();
    setStatus(post.status === "published" ? "已发布 · 刚刚保存。" : "草稿已保存。", "ok");
  } catch (error) {
    if (handleAuthError(error)) return;
    if (error instanceof RequestError && error.code === "write_conflict") {
      setStatus("这篇文章刚被更新过。请刷新列表，核对后再保存；当前输入已保留。", "error");
      await loadPosts();
      return;
    }
    if (error instanceof RequestError && error.code === "idempotency_conflict") {
      setStatus("上次保存的内容与这次不同。请刷新列表确认是否已创建，再决定是否重试。", "error");
      await loadPosts();
      return;
    }
    setStatus(`保存失败：${messageFor(error)}`, "error");
    if (error instanceof RequestError && error.uncertain && isNew) {
      setStatus("连接中断，文章可能已经创建。请刷新列表核对后再重试。", "error");
    }
  } finally {
    setSaving(false);
  }
}

async function openPost(id, { force = false } = {}) {
  if (state.dirty && !force) {
    const leave = window.confirm("当前修改还没有保存，确定离开？");
    if (!leave) return;
  }
  const token = ++state.openToken;
  setStatus("正在读取文章…", "muted");
  try {
    const post = await requestJson(`/api/admin/posts/${id}`);
    if (token !== state.openToken) return;
    if (!post || typeof post.id !== "string" || typeof post.content !== "string") {
      throw new RequestError("invalid_response", 0, true);
    }
    state.current = post;
    state.mode = "edit";
    state.createKey = null;
    fillForm(post);
    renderList();
    revealEditor();
    history.replaceState(null, "", `admin.html?post=${post.id}`);
    setStatus("已读取最新版本。", "muted");
  } catch (error) {
    if (token !== state.openToken) return;
    if (handleAuthError(error)) return;
    setStatus(`读取失败：${messageFor(error)}`, "error");
    if (error instanceof RequestError && error.code === "not_found") {
      await loadPosts();
      showEmptyEditor();
      history.replaceState(null, "", "admin.html");
    }
  }
}

function startNew() {
  if (state.dirty) {
    const leave = window.confirm("当前修改还没有保存，确定新建一篇？");
    if (!leave) return;
  }
  state.current = null;
  state.mode = "new";
  state.createKey = crypto.randomUUID();
  fillForm(null);
  renderList();
  revealEditor();
  history.replaceState(null, "", "admin.html");
  setStatus("新文章 · 尚未保存。", "muted");
  titleInput.focus();
}

async function removePost() {
  if (!state.current) return;
  if (!state.armed) {
    state.armed = true;
    deleteBtn.classList.add("is-armed");
    deleteBtn.textContent = "再点一次确认删除";
    setStatus("删除后无法恢复。再点一次确认。", "warn");
    window.clearTimeout(state.armedTimer);
    state.armedTimer = window.setTimeout(() => {
      resetDeleteButton();
      setStatus("已取消删除。", "muted");
    }, 4000);
    return;
  }

  resetDeleteButton();
  state.saving = true;
  deleteBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus("正在删除…", "muted");
  try {
    await requestJson(`/api/admin/posts/${state.current.id}?version=${state.current.version}`, {
      method: "DELETE"
    });
    state.current = null;
    state.mode = "none";
    state.createKey = null;
    showEmptyEditor();
    history.replaceState(null, "", "admin.html");
    await loadPosts();
    renderList();
    setStatus("文章已删除。", "ok");
  } catch (error) {
    if (handleAuthError(error)) return;
    setStatus(`删除失败：${messageFor(error)}`, "error");
    if (error instanceof RequestError && error.code === "write_conflict") {
      await loadPosts();
    }
  } finally {
    state.saving = false;
    deleteBtn.disabled = false;
    saveBtn.disabled = false;
  }
}

function markDirty() {
  if (state.fillingEditor) return;
  setDirty(true);
  updateCounts();
}

form.addEventListener("input", markDirty);
form.addEventListener("change", markDirty);

titleInput.addEventListener("input", () => {
  if (state.mode === "new" && state.slugAuto) {
    slugInput.value = slugify(titleInput.value);
  }
});

slugInput.addEventListener("input", () => {
  state.slugAuto = false;
});

coverInput.addEventListener("input", () => {
  window.clearTimeout(state.coverTimer);
  state.coverTimer = window.setTimeout(updateCoverPreview, 350);
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

contentInput.addEventListener("input", () => {
  if (form.dataset.view === "preview") setView("preview");
});

form.addEventListener("submit", save);
newBtn.addEventListener("click", startNew);
emptyNewBtn.addEventListener("click", startNew);
refreshBtn.addEventListener("click", () => loadPosts());

let adminSearchTimer = 0;
searchInput?.addEventListener("input", () => {
  window.clearTimeout(adminSearchTimer);
  adminSearchTimer = window.setTimeout(() => {
    state.query = searchInput.value;
    state.rendered = 60;
    renderList();
  }, 120);
});

statusFilter?.addEventListener("change", () => {
  state.status = statusFilter.value;
  state.rendered = 60;
  renderList();
});

listMoreBtn?.addEventListener("click", () => {
  state.rendered += 60;
  renderList();
});
deleteBtn.addEventListener("click", removePost);

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && !form.hidden) {
    event.preventDefault();
    form.requestSubmit();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

showEmptyEditor();
loadSession();
