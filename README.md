# mac-password-manager

本仓库当前提供 **macOS 本地密码管理器后端（Rust）**，核心逻辑在 `src-tauri`，前端页面可由同仓库同学继续补齐。

## 目录

- `src-tauri/`：Rust 后端（SQLite + Argon2id + AES-256-GCM + 会话锁）
- `frontend-dist/`：最小静态占位页（便于 Tauri 壳启动）

## 快速开始

### 运行测试（推荐）

```bash
cd src-tauri
cargo test
```

### 启动 Tauri 壳（命令已注册）

> 当前云环境 Rust/Cargo 版本较旧，默认只跑后端逻辑测试。  
> 若本地工具链可用（建议较新 stable），可启用 `tauri-app` 特性启动桌面壳。

```bash
cd src-tauri
cargo run --features tauri-app
```

## 后端架构（MVP）

### 存储

- SQLite 单文件：应用数据目录下 `vault.sqlite3`
- 表：
  - `vault_meta`：`salt`、Argon2 参数、verifier（密文+nonce）
  - `entries`：业务字段 + 敏感字段密文（`password`、`notes`）

### 密钥与加密

- KDF：Argon2id（主密码 + 随机 salt 派生 32-byte vault key）
- 加密：AES-256-GCM（每个敏感字段独立 nonce）
- 主密码不落盘；会话密钥仅保存在进程内存

### 会话与锁定

- 默认空闲超时：`300` 秒
- `vault_lock`、超时、进程结束都会清空会话密钥
- 成功业务命令会刷新 `lastActiveAt`

## Tauri invoke 命令清单

所有错误统一为：

```json
{ "code": "SOME_CODE", "message": "Human readable message" }
```

错误码：
- `NOT_INITIALIZED`
- `ALREADY_INITIALIZED`
- `INVALID_PASSWORD`
- `VAULT_LOCKED`
- `VALIDATION`
- `NOT_FOUND`
- `INTERNAL`

### 保险库命令

- `vault_exists() -> bool`
- `vault_setup({ masterPassword }) -> VaultStatus`
- `vault_unlock({ masterPassword }) -> VaultStatus`
- `vault_lock() -> VaultStatus`
- `vault_status() -> VaultStatus`
- `vault_touch() -> VaultStatus`
- `vault_set_idle_timeout({ idleTimeoutSec }) -> VaultStatus`

### 条目命令

- `entry_list({ query?, sort?: "updatedAt" | "title" }) -> EntrySummary[]`
  - 默认 `updatedAt` 降序
  - 搜索字段：`title/username/url/tags/notes`
- `entry_get({ id }) -> Entry`
- `entry_create({ entry: EntryInput }) -> Entry`
- `entry_update({ id, entry: EntryInput }) -> Entry`
- `entry_delete({ id }) -> { ok: true }`

### 生成器命令

- `password_generate(GenerateOptions) -> { password }`
  - 默认 `length=16`、四类字符全开
  - `length` 范围 `8..=64`
  - 至少开启一类字符集

## 安全说明（MVP 边界）

- 本地优先：不做同步、不做网络鉴权、不上传数据
- 仅主密码派生密钥，不保存明文主密码
- `password` 与 `notes` 均加密存储
- 搜索采用“解锁态内存过滤”实现（满足 MVP）

## 测试覆盖

已覆盖以下关键用例：

1. `setup -> CRUD -> search -> sort`
2. 错误主密码（`INVALID_PASSWORD`）
3. 锁定态访问受限（`VAULT_LOCKED`）
4. 生成器参数校验（长度与字符集）
5. 空闲超时自动锁（使用可控时钟推进）
