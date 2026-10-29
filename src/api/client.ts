import { invoke } from '@tauri-apps/api/core'
import type { CommandName, InvokeErrorPayload } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeError(error: unknown): InvokeErrorPayload {
  if (isObject(error) && typeof error.code === 'string') {
    const message = typeof error.message === 'string' ? error.message : error.code
    return { code: error.code, message }
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error)
      if (isObject(parsed) && typeof parsed.code === 'string') {
        return {
          code: parsed.code,
          message: typeof parsed.message === 'string' ? parsed.message : parsed.code,
        }
      }
    } catch {
      return { code: 'INTERNAL', message: error }
    }
  }

  if (error instanceof Error) {
    return { code: 'INTERNAL', message: error.message }
  }

  return { code: 'INTERNAL', message: 'Unknown invoke error' }
}

export class InvokeCommandError extends Error {
  code: string

  constructor(payload: InvokeErrorPayload) {
    super(payload.message)
    this.name = 'InvokeCommandError'
    this.code = payload.code
  }
}

export function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof InvokeCommandError && error.code === code
}

export async function invokeTyped<T, P extends object | undefined>(
  command: CommandName,
  payload?: P,
): Promise<T> {
  try {
    if (payload === undefined) {
      return await invoke<T>(command)
    }
    return await invoke<T>(command, payload as Record<string, unknown>)
  } catch (error) {
    throw new InvokeCommandError(normalizeError(error))
  }
}
