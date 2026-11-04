# 一休 · 密码工程作品集

个人技术作品集网站，展示密码学工程实践、算法研究、工具开发与项目经验。

**在线地址**：https://yixiu-portfolio-3xi4lp7vysq.qoder.website

## 项目结构

```
├── dist/                    # 前端静态文件（发布目录）
│   ├── index.html           # 首页
│   ├── blog.html            # 博客列表
│   ├── post.html            # 文章详情
│   ├── thoughts.html        # 想法/反思
│   ├── mvps.html            # MVP 小项目
│   ├── admin.html           # 管理后台
│   ├── api.js               # API 调用封装
│   ├── blog.js              # 博客逻辑
│   ├── post.js              # 文章详情逻辑
│   ├── admin.js             # 管理端逻辑
│   ├── shell.js             # 全局框架
│   ├── theme.css            # 设计令牌（深色技术工作台）
│   └── site.css             # 全局样式
├── functions/               # Qoder Functions（已弃用，保留参考）
│   ├── index.ts             # 原后端入口
│   ├── routes.mjs           # 原路由逻辑
│   └── seed-blog-posts.mjs  # 博客种子数据
├── supabase/                # Supabase Edge Functions（当前后端）
│   └── functions/
│       └── api/
│           └── index.ts     # 主 API 函数
├── catalog/                 # 数据管线与内容
│   ├── blog-posts/          # 博客文章源文件
│   └── review/              # 素材审核清单
├── tools/                   # 构建与部署脚本
│   ├── build_catalog.py     # 数据管线构建
│   ├── deploy-supabase-functions.bat  # Supabase 部署脚本
│   └── insert-migration-blog-post.mjs # 博客导入工具
└── .qa/                     # QA 测试脚本
```

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript（无框架）
- **后端**：Supabase Edge Functions（Deno 运行时）
- **数据库**：Supabase PostgreSQL
- **托管**：Qoder Sites（静态文件）+ Supabase（API）
- **视觉**：深色技术工作台风格（石墨黑底 + 青色强调）

## 快速开始

### 1. 前置条件

- Node.js 22+
- Supabase CLI 3.0+（`npm install -g supabase`）
- Supabase 账号（免费即可）

### 2. 注册 Supabase

1. 访问 https://supabase.com 注册账号
2. 创建新项目，记录：
   - Project URL（如 `https://xxxxx.supabase.co`）
   - anon/public key（前端用）
   - service_role key（后端用，**不要暴露**）
3. 在 SQL Editor 中执行以下建表语句：

```sql
-- 博客文章表
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  idempotency_key text unique not null,
  creation_title text not null,
  creation_slug text not null,
  creation_hash text not null,
  slug text unique not null,
  title text not null,
  excerpt text default '',
  content text default '',
  cover_url text default '',
  status text check (status in ('draft', 'published')) default 'draft',
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

-- 想法/反思表
create table thoughts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  content text not null,
  tags text[] default '{}',
  status text check (status in ('draft', 'published')) default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MVP 小项目表
create table mvps (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  title text not null,
  slug text unique not null,
  excerpt text default '',
  description text default '',
  url text default '',
  tech_stack text[] default '{}',
  tags text[] default '{}',
  thumbnail text default '',
  source_url text default '',
  status text check (status in ('draft', 'published')) default 'published',
  visibility text check (visibility in ('public', 'notice', 'hidden')) default 'public',
  sort_order integer default 0,
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

-- 启用 RLS
alter table posts enable row level security;
alter table thoughts enable row level security;
alter table mvps enable row level security;

-- 公开读取策略
create policy "posts_select_published" on posts for select
  using (status = 'published');

create policy "thoughts_select_published" on thoughts for select
  using (status = 'published');

create policy "mvps_select_published" on mvps for select
  using (status = 'published' and visibility = 'public');

-- 作者写入策略（需要认证）
create policy "posts_author_all" on posts for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "thoughts_author_all" on thoughts for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "mvps_author_all" on mvps for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- 自动更新 updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at before update on posts
  for each row execute function update_updated_at_column();

create trigger thoughts_updated_at before update on thoughts
  for each row execute function update_updated_at_column();

create trigger mvps_updated_at before update on mvps
  for each row execute function update_updated_at_column();

-- 索引
create index idx_posts_slug on posts(slug);
create index idx_posts_status on posts(status);
create index idx_thoughts_tags on thoughts using gin(tags);
create index idx_mvps_slug on mvps(slug);
create index idx_mvps_status on mvps(status);
```

4. 在 Authentication → Providers 中启用 Email 登录

### 3. 配置 Supabase Edge Functions

编辑 `supabase/functions/api/index.ts`，替换以下常量：

```typescript
const SUPABASE_URL = 'https://你的项目.supabase.co'
const SUPABASE_SERVICE_KEY = '你的 service_role key'
const OWNER_EMAILS = ['你的邮箱@example.com']
```

### 4. 部署 Supabase Edge Functions

```bash
# 登录 Supabase
supabase login

# 链接项目
supabase link --project-ref 你的项目ID

# 部署函数
supabase functions deploy api --no-verify-jwt --yes
```

部署成功后会显示函数 URL：
```
https://你的项目.supabase.co/functions/v1/api
```

### 5. 配置前端

编辑 `dist/api.js`，替换以下常量：

```javascript
const SUPABASE_URL = 'https://你的项目.supabase.co';
const SUPABASE_ANON_KEY = '你的 anon/public key';
```

确保 `requestJson` 函数中的 base URL 指向你的 Supabase Edge Function：

```javascript
response = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
  // ...
});
```

### 6. 本地启动

```bash
# 方式 1：直接用 HTTP 服务器
cd dist
python -m http.server 4173

# 方式 2：用 Node.js
npx serve dist -p 4173
```

访问 http://localhost:4173

### 7. 发布到 Qoder Sites

```bash
# 使用 Qoder Desktop 的 Sites 功能
# 或在 Qoder 中执行发布命令
```

发布后网站地址：
```
https://你的项目名.qoder.website
```

## 数据迁移

### 导入博客文章

```bash
node tools/insert-migration-blog-post.mjs
```

### 批量种子数据

```bash
node functions/seed-blog-posts.mjs
```

## 管理后台

访问 `/admin.html`，使用 Supabase Auth 登录。

功能：
- 创建/编辑/删除博客文章
- 创建/编辑/删除想法
- 创建/编辑/删除 MVP 项目

## API 端点

所有 API 通过 Supabase Edge Functions 提供：

### 公开端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/posts` | 博客列表（分页） |
| GET | `/posts/index` | 博客索引（全部） |
| GET | `/posts/:slug` | 单篇文章 |
| GET | `/thoughts` | 想法列表（支持 `?tag=` 筛选） |
| GET | `/mvps` | MVP 列表 |
| GET | `/mvps/:slug` | 单个 MVP |

### 管理端点（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/posts` | 创建文章 |
| PATCH | `/posts/:id` | 更新文章 |
| DELETE | `/posts/:id` | 删除文章 |
| POST | `/thoughts` | 创建想法 |
| PATCH | `/thoughts/:id` | 更新想法 |
| DELETE | `/thoughts/:id` | 删除想法 |
| POST | `/mvps` | 创建 MVP |
| PATCH | `/mvps/:id` | 更新 MVP |
| DELETE | `/mvps/:id` | 删除 MVP |

## 架构说明

### 之前（Qoder Functions）

```
浏览器 → Qoder 网关 → Qoder Functions → Supabase Database
```

问题：Qoder 网关不稳定，返回 `409 sites_gateway_supabase_not_ready`

### 现在（Supabase Edge Functions）

```
浏览器 → Qoder 网站（HTML/CSS/JS）
          ↓
       Supabase Edge Functions → Supabase Database
```

优势：
- 完全绕过 Qoder 网关
- 后端直接跑在 Supabase 基础设施上
- 更低的延迟和更高的稳定性

## 开发记录

- [从 Qoder Functions 迁移到 Supabase Edge Functions](catalog/blog-posts/migration-to-supabase-edge-functions.md)
- [深色技术工作台：设计令牌与视觉系统](catalog/blog-posts/dark-theme-design.md)
- [站内搜索工程：600 条工具的毫秒级筛选](catalog/blog-posts/search-engine.md)

## 许可证

MIT

## 联系方式

- 邮箱：m15501951002@163.com
- 手机：15501951002
- 所在地：杭州
