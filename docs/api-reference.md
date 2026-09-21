# personal-stack API 接口手册

- 生产 Base URL：`https://stack.personal-stack.ltd`
- 开发 Base URL：`http://localhost:8000`
- 调试入口（仅开发/本机）：Swagger UI `/docs`、OpenAPI `/openapi.json`（生产 Caddy 只路由 `/api/*`，不暴露）

## 通用约定

**鉴权**：登录成功后服务端下发 httpOnly Cookie `access_token`（JWT，7 天）。后续请求浏览器自动携带；用 curl 时用 `-c/-b` 保存并带上 Cookie。需要登录的接口未带或凭据无效时返回 401。

**错误响应**（所有非 2xx）：

```json
{ "code": "invalid_credentials", "message": "用户名或密码错误" }
```

| 状态码 | code 示例 | 说明 |
|---|---|---|
| 400 | `invalid_path` | 非法存储路径（防御性） |
| 401 | `unauthorized` / `invalid_credentials` | 未登录 / 凭据错误 |
| 404 | `not_found` | 资源不存在 |
| 409 | `name_conflict` / `slug_conflict` / `folder_not_empty` / `invalid_move` | 冲突 |
| 413 | `file_too_large` | 超过上传上限 |
| 422 | `validation_error` / `invalid_name` | 参数校验失败 |
| 429 | `rate_limited` | 登录限流（同 IP 每分钟 5 次失败） |
| 500 | `internal_error` | 未预期错误（不泄漏内部细节） |

**分页**：列表接口统一 `{items, total, page, page_size}`；`page` 默认 1，`page_size` 默认 20、上限 100。

**时间**：ISO 8601 字符串（UTC）。

---

## 1. 认证 auth

### POST /api/auth/login

登录并下发 Cookie。

请求：

```json
{ "username": "admin", "password": "your-password" }
```

响应 200：

```json
{ "id": 1, "username": "admin" }
```

响应头包含：`Set-Cookie: access_token=...; HttpOnly; Max-Age=604800; Path=/; SameSite=lax; Secure`

失败：401 `invalid_credentials`；连续失败超过 5 次/分钟：429 `rate_limited`。

### POST /api/auth/logout

清除 Cookie。响应：`{"status":"ok"}`。

### GET /api/auth/me

返回当前登录用户；未登录 401。

```json
{ "id": 1, "username": "admin" }
```

---

## 2. 博客（公开）

### GET /api/posts

已发布文章列表。仅返回 `status=published`。

查询参数：`tag`（标签 slug）、`page`、`page_size`。

响应：

```json
{
  "items": [
    {
      "id": 1,
      "title": "第一篇文章",
      "slug": "first-post",
      "summary": "摘要",
      "published_at": "2026-09-19T12:00:00",
      "tags": [{ "id": 1, "name": "Python", "slug": "python" }]
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### GET /api/posts/{slug}

文章详情（仅已发布；草稿返回 404）。额外字段：`content_md`、`status`、`created_at`、`updated_at`。

### GET /api/tags

已发布文章使用到的标签列表：`[{id, name, slug}]`。

---

## 3. 博客管理（需登录）

### GET /api/admin/posts

全部文章（含草稿）。查询参数：`status`（`draft`/`published`）、`page`、`page_size`。

响应：`{items: [{id, title, slug, status, published_at, updated_at}], total, page, page_size}`。

### GET /api/admin/posts/{post_id}

编辑页取数，返回同公开详情（含草稿）。

### POST /api/admin/posts

创建文章。

```json
{
  "title": "标题",
  "slug": null,
  "summary": "摘要",
  "content_md": "# 标题\n\n正文",
  "status": "published",
  "tags": ["Python", "FastAPI"]
}
```

约束与语义：

- `title` 1–200；`summary` ≤500；`content_md` ≤200000
- `slug` 可空（自动按标题生成）；非空须匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，≤200
- `tags` 每个 ≤50，最多 20 个；同名标签自动复用
- `status`：`draft` | `published`；首次发布时写入 `published_at`
- slug 冲突：409 `slug_conflict`

响应为文章详情。

### PUT /api/admin/posts/{post_id}

全量更新，字段同上；`slug` 省略时保留原值；把文章改回草稿不会清空 `published_at`。

### DELETE /api/admin/posts/{post_id}

删除。响应：`{"status":"ok"}`。

---

## 4. 网盘（需登录）

### GET /api/folders?parent_id=

列出目录内容（不传 `parent_id` 表示根目录）。

```json
{
  "folder": null,
  "breadcrumb": [],
  "folders": [{"id":1,"name":"文档","parent_id":null,"created_at":"...","updated_at":"..."}],
  "files": [{"id":2,"name":"a.txt","folder_id":null,"size":5,"mime_type":"text/plain","sha256":"...","created_at":"..."}]
}
```

父目录不存在：404。

### GET /api/folders/tree

全部文件夹的扁平树（供移动选择与面包屑）：`[{id, name, parent_id, path}]`。

### POST /api/folders

```json
{ "name": "文档", "parent_id": null }
```

名称 1–255，禁止 `/`、`\`、空字符；同名 409。

### PATCH /api/folders/{folder_id}

局部更新（只传要改的字段）：

```json
{ "name": "新名字", "parent_id": 3 }
```

移入自身或后代：409 `invalid_move`；同名 409。

### DELETE /api/folders/{folder_id}?recursive=false

非空目录返回 409 `folder_not_empty`；`recursive=true` 时级联删除子目录、文件记录与无人引用的 blob。

### POST /api/files/upload

`multipart/form-data`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `file` | 文件 | 必填 |
| `folder_id` | 字符串整数 | 可选，缺省为根目录 |

语义：流式落盘、按内容 sha256 去重（相同内容共享一份 blob）；同名文件 409；超过 `MAX_UPLOAD_SIZE_MB` 返回 413。响应为文件元数据。

### GET /api/files/{file_id}/download

流式下载。响应头：

```
Content-Disposition: attachment; filename="..."; filename*=UTF-8''...
X-Content-Type-Options: nosniff
```

### PATCH /api/files/{file_id}

重命名 / 移动：

```json
{ "name": "新名字.bin", "folder_id": null }
```

### DELETE /api/files/{file_id}

删除记录；若没有其它记录引用同一 blob，则同时删除磁盘文件。

### GET /api/storage/usage

```json
{ "used_bytes": 10485760, "file_count": 3 }
```

---

## 5. 站点设置 settings

### GET /api/settings/theme（公开）

返回站点默认主题（完整值）：

```json
{
  "theme": {
    "mode": "system",
    "accent": "violet",
    "radius": 16,
    "blur": 12,
    "background": { "type": "gradient", "value": "aurora" }
  }
}
```

字段约束：

| 字段 | 取值 |
|---|---|
| `mode` | `light` \| `dark` \| `system` |
| `accent` | `violet` \| `blue` \| `emerald` \| `rose` \| `amber` \| `slate` |
| `radius` | 整数 0–28 |
| `blur` | 整数 0–24 |
| `background.type` | `solid` \| `gradient` \| `mesh` |
| `background.value` | `solid` 为 `#rgb/#rrggbb`；`gradient` 为 `aurora/daylight/dusk`；`mesh` 为 `mesh-violet/mesh-emerald` |

### PUT /api/admin/settings/theme（需登录）

局部更新（只传要改的字段，未知字段与越界值返回 422）：

```json
{ "accent": "emerald", "radius": 6 }
```

响应为更新后的完整主题。语义：访客在浏览器里的本地自定义优先于此默认值；未自定义的访客下次访问即生效。

---

## 6. curl 示例集

```bash
BASE=https://stack.personal-stack.ltd
JAR=/tmp/ps-cookies.txt

# 登录（保存 Cookie）
curl -sS -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<你的密码>"}'

# 当前用户
curl -sS -b "$JAR" "$BASE/api/auth/me"

# 发一篇文章
curl -sS -b "$JAR" -X POST "$BASE/api/admin/posts" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","slug":null,"summary":"摘要","content_md":"## 你好","status":"published","tags":["demo"]}'

# 公开列表与详情
curl -sS "$BASE/api/posts"
curl -sS "$BASE/api/posts/hello"

# 新建文件夹并上传
FOLDER_ID=$(curl -sS -b "$JAR" -X POST "$BASE/api/folders" \
  -H 'Content-Type: application/json' -d '{"name":"测试目录","parent_id":null}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
curl -sS -b "$JAR" -F "file=@/path/to/file.bin" -F "folder_id=$FOLDER_ID" "$BASE/api/files/upload"

# 下载
curl -sS -b "$JAR" -o downloaded.bin "$BASE/api/files/1/download"

# 用量
curl -sS -b "$JAR" "$BASE/api/storage/usage"

# 改站默认主题
curl -sS -b "$JAR" -X PUT "$BASE/api/admin/settings/theme" \
  -H 'Content-Type: application/json' \
  -d '{"accent":"emerald","radius":6}'

# 退出
curl -sS -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/logout"
```
