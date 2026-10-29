# mac-password-manager (Tauri 2 + React + Vite + TypeScript)

## 中文说明

### 1) 项目简介

这是一个 macOS 本地密码管理器 MVP：

- Tauri 2 壳 + React/Vite/TypeScript UI
- 完整实现 MVP UI 流程：解锁、列表搜索、详情编辑、嵌套密码生成器
- `src-tauri` 已接入真实后端：SQLite + Argon2id + AES-256-GCM
- `src/` 提供完整 MVP 前端界面与交互

---

### 2) 运行与构建

#### 环境要求

- Node.js 20+
- npm 10+
- Rust stable（建议 `rustup default stable`，本项目已用 `cargo check` 验证）
- Linux 下运行 `cargo check` 时需要 GTK/WebKit 开发库（macOS 通常不需要这些包）

#### 安装依赖

```bash
npm install
```

#### 仅启动前端（浏览器）

```bash
npm run dev
```

默认地址：`http://localhost:1420`

#### 启动 Tauri 桌面应用

```bash
npm run tauri:dev
```

#### 构建前端

```bash
npm run build
```

#### 编译检查（Rust）

```bash
cd src-tauri
cargo check
```

---

### 3) 功能覆盖（对应 UI/API 规格）

1. **Unlock**
   - 首次：创建主密码 + 确认（至少 8 位）
   - 日常：主密码解锁
   - 错误文案：`主密码不正确`
   - loading 防连点

2. **List + Search**
   - 搜索占位文案：`搜索名称、用户名、网址、标签…`
   - 防抖：180ms（满足 150–200ms）
   - 工具栏：`新建`、`锁定`
   - 空库态：`还没有密码` + `新建条目`
   - 无结果态：`无匹配条目`
   - 排序：`updatedAt` 降序

3. **Detail/Edit**
   - 字段：名称、用户名、密码、网址、标签、备注
   - 密码行支持：显隐、复制、生成
   - 删除二次确认：`确定删除「{名称}」？此操作不可撤销。`
   - 脏数据离开确认：返回 / 锁定 / 自动锁定时弹出「保存 / 不保存 / 取消」

4. **嵌套生成器（popover）**
   - 长度：8–64，默认 16
   - 字符集：大写/小写/数字/符号
   - 至少一类字符集
   - 预览 + 刷新
   - `填入密码` 仅写回表单并标脏，不自动保存

5. **布局与会话**
   - 宽屏：master-detail
   - 小于约 800px：列表和详情分离，详情有返回按钮
   - 手动锁定 + 300s 空闲自动锁定
   - 使用 `vault_status` / `vault_touch` 维护会话
   - 锁定后清除明文 UI 状态并回到解锁壳

---

### 4) 屏幕 → 文件映射

- `src/App.tsx`
  - 应用状态机（boot/setup/unlock/ready）
  - 解锁壳、列表页、详情编辑页、生成器弹层、离开确认弹窗
  - 搜索防抖、自动锁定、脏数据守卫、复制剪贴板
- `src/App.css`
  - 全部 UI 样式（宽屏/窄屏布局、表单、列表、详情、popover、modal）
- `src/api/types.ts`
  - API 类型定义（VaultStatus、Entry、EntryInput、错误码等）
- `src/api/client.ts`
  - typed invoke 封装 + 统一错误模型 `InvokeCommandError`
- `src/api/commands.ts`
  - 与 API 规格一致的命令名与 payload 入口
- `src-tauri/src/lib.rs`
  - Tauri command 注册与前端 invoke 边界
- `src-tauri/src/service.rs`
  - SQLite 持久化、加解密与会话锁定核心逻辑

---

### 5) API 对接约束

TS 侧 command 名称与约定保持一致（不扩展命令）：

- `vault_exists`
- `vault_setup`
- `vault_unlock`
- `vault_lock`
- `vault_status`
- `vault_touch`
- `vault_set_idle_timeout`
- `entry_list`
- `entry_get`
- `entry_create`
- `entry_update`
- `entry_delete`
- `password_generate`

错误码按约定处理：如 `INVALID_PASSWORD`、`VAULT_LOCKED` 等。

---

### 6) MVP 验证步骤（建议手测）

1. 启动 `npm run tauri:dev`
2. 首次进入创建主密码（两次输入一致且 >=8）
3. 新建条目并保存，确认列表出现
4. 搜索关键字，确认有防抖和结果筛选
5. 进入详情，测试密码显示/隐藏、复制、生成器填入
6. 编辑但不保存，执行以下任一动作确认出现离开弹窗：
   - 切换到其它条目
   - 点击锁定
   - 窄屏下点击返回
7. 删除条目，确认二次确认文案正确
8. 手动锁定后确认回到解锁页且不显示明文数据
9. 空闲约 300 秒后自动锁定（可观察自动回解锁）

---

### 7) 后端实现说明（SQLite + 加密）

当前主分支后端实现为真实本地持久化：

- 存储：SQLite（`vault.sqlite3`，位于应用数据目录）
- KDF：Argon2id（主密码派生 vault key）
- 加密：AES-256-GCM（敏感字段密文存储）
- 会话：默认 300 秒空闲自动锁定，手动锁定会清除会话密钥

---

## English

### 1) Overview

This repository contains a local-first MVP for a macOS password manager:

- Tauri 2 shell + React/Vite/TypeScript UI
- MVP screens implemented: unlock, list/search, detail/edit, nested generator
- `src-tauri` now uses the merged real backend (SQLite + Argon2id + AES-256-GCM)
- `src/` contains the full MVP React UI and typed invoke client

### 2) Run & Build

Requirements:

- Node.js 20+
- npm 10+
- Rust stable (`rustup default stable` recommended)

Install:

```bash
npm install
```

Run web only:

```bash
npm run dev
```

Run desktop app:

```bash
npm run tauri:dev
```

Build frontend:

```bash
npm run build
```

Rust check:

```bash
cd src-tauri
cargo check
```

### 3) Screen-to-file map

- `src/App.tsx`: app state machine + all MVP screens/interactions
- `src/App.css`: layout and component styles
- `src/api/types.ts`: contract types
- `src/api/client.ts`: typed invoke wrapper + normalized errors
- `src/api/commands.ts`: API-contract command wrappers
- `src-tauri/src/lib.rs`: Tauri command registration and invoke boundary
- `src-tauri/src/service.rs`: encrypted SQLite persistence and vault session logic

### 4) Verification checklist

1. Create master password on first launch
2. Unlock with master password (wrong password shows `主密码不正确`)
3. Create/edit/delete entries
4. Search with debounce (180ms)
5. Use password show/hide/copy/generator fill-in
6. Dirty-leave confirm on back/lock/auto-lock
7. Manual lock and idle auto-lock (300s)

### 5) Backend storage and security note

Current backend is persisted and encrypted:

- SQLite vault database in app data directory
- Master password key derivation via Argon2id
- AES-256-GCM encryption for sensitive fields
- Session key cleared on lock/timeout
