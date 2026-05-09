# 华莱士金融服务 - 会计管理系统 部署说明

## 项目简介

本项目是一套专为加拿大小型金融服务公司设计的全栈会计管理系统，支持：
- 银行账单（PDF/CSV）上传与 AI 自动解析
- 交易记录管理、分类（CRA T2125 标准）
- 财务报表（月度/年度）
- T4A 税单生成（PDF）
- 手机端小票拍照 OCR 识别
- 白名单访问控制

**技术栈：** React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB

---

## 目录结构

```
wallace-accounting/
├── client/          # React 前端（Vite）
├── server/          # Express + tRPC 后端
├── drizzle/         # 数据库 Schema 和迁移文件
├── shared/          # 前后端共享类型
├── scripts/         # 数据导入脚本（可选）
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── drizzle.config.ts
database_dump.sql    # 数据库完整备份（含表结构和数据）
```

---

## 环境要求

| 依赖 | 版本要求 |
|------|---------|
| Node.js | >= 18.x（推荐 22.x） |
| pnpm | >= 9.x（推荐 10.x） |
| MySQL | >= 8.0（或 TiDB Serverless） |

---

## 快速部署步骤

### 第一步：解压项目

```bash
unzip wallace-accounting-backup.zip -d wallace-accounting
cd wallace-accounting
```

### 第二步：安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 第三步：准备数据库

#### 选项 A：使用本地 MySQL

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE wallace_accounting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 导入备份数据
mysql -u root -p wallace_accounting < database_dump.sql
```

#### 选项 B：使用 TiDB Serverless（推荐，免费额度充足）

1. 访问 https://tidbcloud.com 注册账号
2. 创建一个 Serverless 集群（免费）
3. 在集群详情页获取连接字符串，格式为：
   ```
   mysql2://用户名:密码@host:4000/数据库名?ssl={"rejectUnauthorized":true}
   ```
4. 导入数据：
   ```bash
   mysql -h <host> -P 4000 -u <user> -p --ssl-mode=REQUIRED <dbname> < database_dump.sql
   ```

#### 选项 C：使用 PlanetScale / Railway MySQL

按各平台文档创建数据库后，同样使用 `mysql ... < database_dump.sql` 导入。

### 第四步：配置环境变量

在项目根目录创建 `.env` 文件：

```env
# ===== 必填 =====

# 数据库连接（MySQL 格式）
DATABASE_URL=mysql2://用户名:密码@localhost:3306/wallace_accounting

# JWT 密钥（随机字符串，用于 session cookie 签名）
JWT_SECRET=your-random-secret-string-at-least-32-chars

# ===== Manus OAuth（如需保留原登录方式）=====
# 如果在 Codex/自托管环境中不使用 Manus OAuth，需修改认证逻辑（见下方说明）
VITE_APP_ID=your-manus-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# ===== AI 功能（PDF 解析 / OCR / 分类）=====
# 使用 OpenAI 兼容 API
BUILT_IN_FORGE_API_URL=https://api.openai.com/v1
BUILT_IN_FORGE_API_KEY=sk-your-openai-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.openai.com/v1
VITE_FRONTEND_FORGE_API_KEY=sk-your-openai-api-key

# ===== S3 文件存储（账单 PDF 和小票图片）=====
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
# 或使用 Cloudflare R2（S3 兼容）：
# S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com

# ===== 应用信息 =====
VITE_APP_TITLE=华莱士金融服务 - 会计管理系统
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Wallace
```

### 第五步：推送数据库 Schema（可选，如已导入 dump 则跳过）

如果使用全新数据库（未导入 dump），运行：

```bash
pnpm db:push
```

### 第六步：启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

### 第七步：生产构建

```bash
pnpm build
pnpm start
```

---

## 认证系统说明

本项目默认使用 **Manus OAuth** 进行登录认证。如果在 Codex 或自托管环境中无法使用 Manus OAuth，有以下两种替代方案：

### 方案 A：简单密码认证（推荐用于内部工具）

修改 `server/_core/oauth.ts`，将 OAuth 回调替换为本地用户名/密码验证。在 `.env` 中设置：

```env
ADMIN_USERNAME=wallace
ADMIN_PASSWORD=your-password
```

### 方案 B：保留 Manus OAuth

如果在 Manus 平台上部署，OAuth 会自动工作，无需额外配置。

### 白名单用户

当前白名单（`server/_core/oauth.ts`）：
- `amy202601@gmail.com`
- `wallacefinancialservice@gmail.com`
- `wallacecanada0625@gmail.com`
- 用户名 `wallace`

如需修改，编辑 `server/_core/oauth.ts` 中的 `ALLOWED_EMAILS` 和 `ALLOWED_USERNAMES` 数组。

---

## AI 功能配置

本项目使用 LLM API 进行：
1. PDF 银行账单解析（提取交易记录）
2. 交易自动分类（CRA T2125 标准）
3. 小票 OCR 识别

默认调用 `BUILT_IN_FORGE_API_URL` 指定的 OpenAI 兼容 API。

**推荐替代方案：**
- OpenAI API（`https://api.openai.com/v1`）
- Azure OpenAI
- Anthropic Claude API（需修改 `server/_core/llm.ts`）
- 本地 Ollama（需支持 vision 模型用于 OCR）

---

## 文件存储配置

账单 PDF 和小票图片存储在 S3 兼容对象存储中。

**推荐免费方案：**
- **Cloudflare R2**：每月 10GB 免费，无出口流量费
- **Backblaze B2**：每月 10GB 免费

配置方法见 `server/storage.ts`，修改 S3 客户端初始化参数即可。

---

## 数据库备份恢复

备份文件 `database_dump.sql` 包含以下表的完整数据：

| 表名 | 说明 |
|------|------|
| `users` | 用户账号 |
| `bank_accounts` | 银行账户信息 |
| `statements` | 上传的账单文件记录 |
| `transactions` | 所有交易记录（含 AI 分类） |
| `categories` | CRA T2125 分类（30个） |
| `t4a_recipients` | T4A 收款人信息 |
| `t4a_records` | T4A 税单记录 |
| `receipts` | 小票上传记录 |

---

## 常见问题

**Q: pnpm install 报错**
```bash
# 清除缓存重试
pnpm store prune
pnpm install --force
```

**Q: 数据库连接失败**
- 检查 `DATABASE_URL` 格式是否正确
- TiDB Serverless 需要 SSL，连接串末尾加 `?ssl={"rejectUnauthorized":true}`

**Q: AI 解析功能不工作**
- 确认 `BUILT_IN_FORGE_API_KEY` 已设置且有效
- 检查 API 余额

**Q: 文件上传失败**
- 确认 S3 bucket 已创建且 access key 有写入权限
- 检查 bucket 的 CORS 配置（允许来自应用域名的请求）

---

## 技术支持

如有问题，请查阅项目 `todo.md` 了解功能实现历史，或参考 `server/` 目录下各文件的注释。
