export type CommandName =
  | 'vault_exists'
  | 'vault_setup'
  | 'vault_unlock'
  | 'vault_lock'
  | 'vault_status'
  | 'vault_touch'
  | 'vault_set_idle_timeout'
  | 'entry_list'
  | 'entry_get'
  | 'entry_create'
  | 'entry_update'
  | 'entry_delete'
  | 'password_generate'

export type ErrorCode =
  | 'NOT_INITIALIZED'
  | 'ALREADY_INITIALIZED'
  | 'INVALID_PASSWORD'
  | 'VAULT_LOCKED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INTERNAL'

export interface InvokeErrorPayload {
  code: ErrorCode | string
  message: string
}

export interface VaultStatus {
  initialized: boolean
  unlocked: boolean
  idleTimeoutSec: number
  lastActiveAt?: number
}

export interface EntrySummary {
  id: string
  title: string
  username: string
  url: string
  tags: string[]
  updatedAt: number
}

export interface Entry {
  id: string
  title: string
  username: string
  password: string
  url: string
  notes: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface EntryInput {
  title: string
  username: string
  password: string
  url: string
  notes: string
  tags: string[]
}

export interface GenerateOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
}

export interface PasswordGenerateResponse {
  password: string
}
