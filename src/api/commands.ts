import { invokeTyped } from './client'
import type {
  Entry,
  EntryInput,
  EntrySummary,
  GenerateOptions,
  PasswordGenerateResponse,
  VaultStatus,
} from './types'

export function vaultExists() {
  return invokeTyped<boolean, undefined>('vault_exists')
}

export function vaultSetup(masterPassword: string) {
  return invokeTyped<VaultStatus, { masterPassword: string }>('vault_setup', {
    masterPassword,
  })
}

export function vaultUnlock(masterPassword: string) {
  return invokeTyped<VaultStatus, { masterPassword: string }>('vault_unlock', {
    masterPassword,
  })
}

export function vaultLock() {
  return invokeTyped<VaultStatus, undefined>('vault_lock')
}

export function vaultStatus() {
  return invokeTyped<VaultStatus, undefined>('vault_status')
}

export function vaultTouch() {
  return invokeTyped<VaultStatus, undefined>('vault_touch')
}

export function vaultSetIdleTimeout(idleTimeoutSec: number) {
  return invokeTyped<VaultStatus, { idleTimeoutSec: number }>('vault_set_idle_timeout', {
    idleTimeoutSec,
  })
}

export function entryList(query?: string, sort: 'updatedAt' | 'title' = 'updatedAt') {
  return invokeTyped<EntrySummary[], { query?: string; sort: 'updatedAt' | 'title' }>('entry_list', {
    query: query || undefined,
    sort,
  })
}

export function entryGet(id: string) {
  return invokeTyped<Entry, { id: string }>('entry_get', { id })
}

export function entryCreate(entry: EntryInput) {
  return invokeTyped<Entry, { entry: EntryInput }>('entry_create', { entry })
}

export function entryUpdate(id: string, entry: EntryInput) {
  return invokeTyped<Entry, { id: string; entry: EntryInput }>('entry_update', { id, entry })
}

export function entryDelete(id: string) {
  return invokeTyped<{ ok: true }, { id: string }>('entry_delete', { id })
}

export function passwordGenerate(options: GenerateOptions) {
  return invokeTyped<PasswordGenerateResponse, GenerateOptions>('password_generate', options)
}
