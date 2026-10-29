import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  entryCreate,
  entryDelete,
  entryGet,
  entryList,
  entryUpdate,
  passwordGenerate,
  vaultLock,
  vaultSetIdleTimeout,
  vaultSetup,
  vaultStatus,
  vaultTouch,
  vaultUnlock,
} from './api/commands'
import { InvokeCommandError, isErrorCode } from './api/client'
import type { Entry, EntryInput, EntrySummary, GenerateOptions, VaultStatus } from './api/types'
import './App.css'

type AppPhase = 'booting' | 'setup' | 'unlock' | 'ready'
type DetailMode = 'none' | 'create' | 'edit'

interface EntryDraftForm {
  title: string
  username: string
  password: string
  url: string
  notes: string
  tagsText: string
}

interface PendingLeaveAction {
  reason: string
  action: () => Promise<void>
  onCancel?: () => void
}

const SEARCH_DEBOUNCE_MS = 180
const IDLE_TIMEOUT_SEC = 300
const TOUCH_THROTTLE_MS = 2000

const DEFAULT_GENERATOR_OPTIONS: GenerateOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
}

const EMPTY_DRAFT: EntryDraftForm = {
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  tagsText: '',
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function entryToForm(entry: Entry | EntryInput): EntryDraftForm {
  return {
    title: entry.title,
    username: entry.username,
    password: entry.password,
    url: entry.url,
    notes: entry.notes,
    tagsText: entry.tags.join(', '),
  }
}

function formToEntryInput(form: EntryDraftForm): EntryInput {
  return {
    title: form.title.trim(),
    username: form.username.trim(),
    password: form.password,
    url: form.url.trim(),
    notes: form.notes.trim(),
    tags: parseTags(form.tagsText),
  }
}

function timestampToText(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp * 1000)
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}

function App() {
  const [phase, setPhase] = useState<AppPhase>('booting')
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [globalError, setGlobalError] = useState('')

  const [setupPassword, setSetupPassword] = useState('')
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('')
  const [setupError, setSetupError] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  const [entries, setEntries] = useState<EntrySummary[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null)
  const [draftForm, setDraftForm] = useState<EntryDraftForm>(EMPTY_DRAFT)
  const [baselineForm, setBaselineForm] = useState<EntryDraftForm>(EMPTY_DRAFT)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const [isNarrowLayout, setIsNarrowLayout] = useState(window.innerWidth < 800)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generatorOptions, setGeneratorOptions] = useState<GenerateOptions>(DEFAULT_GENERATOR_OPTIONS)
  const [generatorPreview, setGeneratorPreview] = useState('')
  const [generatorLoading, setGeneratorLoading] = useState(false)
  const [generatorError, setGeneratorError] = useState('')

  const [pendingLeaveAction, setPendingLeaveAction] = useState<PendingLeaveAction | null>(null)

  const latestSearchRef = useRef('')
  const activeAtRef = useRef(Date.now())
  const lastTouchAtRef = useRef(0)
  const lockAttemptingRef = useRef(false)

  const isDirty = useMemo(
    () => JSON.stringify(draftForm) !== JSON.stringify(baselineForm),
    [draftForm, baselineForm],
  )

  const clearSensitiveView = useCallback(() => {
    setEntries([])
    setSearchInput('')
    setDetailMode('none')
    setCurrentEntryId(null)
    setDraftForm(EMPTY_DRAFT)
    setBaselineForm(EMPTY_DRAFT)
    setShowPassword(false)
    setGeneratorOpen(false)
    setGeneratorPreview('')
    setGeneratorError('')
    setDetailError('')
    setCopyStatus('')
    setPendingLeaveAction(null)
  }, [])

  const switchToUnlock = useCallback(() => {
    lockAttemptingRef.current = false
    clearSensitiveView()
    setUnlockPassword('')
    setUnlockError('')
    setPhase('unlock')
    setStatus((prev) => {
      if (!prev) {
        return prev
      }
      return { ...prev, unlocked: false }
    })
  }, [clearSensitiveView])

  const handleCommandError = useCallback(
    (error: unknown): boolean => {
      if (isErrorCode(error, 'VAULT_LOCKED')) {
        switchToUnlock()
        return true
      }
      return false
    },
    [switchToUnlock],
  )

  const touchVault = useCallback(async () => {
    if (phase !== 'ready') {
      return
    }
    const now = Date.now()
    if (now - lastTouchAtRef.current < TOUCH_THROTTLE_MS) {
      return
    }
    lastTouchAtRef.current = now
    try {
      const nextStatus = await vaultTouch()
      setStatus(nextStatus)
      activeAtRef.current = now
    } catch (error) {
      handleCommandError(error)
    }
  }, [phase, handleCommandError])

  const markUserActive = useCallback(() => {
    activeAtRef.current = Date.now()
    void touchVault()
  }, [touchVault])

  const refreshEntries = useCallback(
    async (query: string) => {
      latestSearchRef.current = query
      setEntriesLoading(true)
      setGlobalError('')
      try {
        const list = await entryList(query, 'updatedAt')
        const ordered = list.sort((a, b) => b.updatedAt - a.updatedAt)
        setEntries(ordered)
      } catch (error) {
        if (!handleCommandError(error)) {
          const message = error instanceof InvokeCommandError ? error.message : '加载条目失败'
          setGlobalError(message)
        }
      } finally {
        setEntriesLoading(false)
      }
    },
    [handleCommandError],
  )

  const bootstrap = useCallback(async () => {
    setGlobalError('')
    setPhase('booting')
    try {
      const initialStatus = await vaultStatus()
      setStatus(initialStatus)

      if (!initialStatus.initialized) {
        setPhase('setup')
        return
      }

      if (!initialStatus.unlocked) {
        setPhase('unlock')
        return
      }

      await vaultSetIdleTimeout(IDLE_TIMEOUT_SEC)
      setPhase('ready')
      activeAtRef.current = Date.now()
      await refreshEntries('')
    } catch (error) {
      const message = error instanceof InvokeCommandError ? error.message : '初始化失败'
      setGlobalError(message)
      setPhase('unlock')
    }
  }, [refreshEntries])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (phase !== 'ready') {
      return
    }
    void refreshEntries(debouncedSearch)
  }, [phase, debouncedSearch, refreshEntries])

  useEffect(() => {
    const onResize = () => {
      setIsNarrowLayout(window.innerWidth < 800)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (phase !== 'ready') {
      return
    }

    const onUserAction = () => {
      markUserActive()
    }

    window.addEventListener('mousedown', onUserAction)
    window.addEventListener('keydown', onUserAction)
    window.addEventListener('touchstart', onUserAction)

    return () => {
      window.removeEventListener('mousedown', onUserAction)
      window.removeEventListener('keydown', onUserAction)
      window.removeEventListener('touchstart', onUserAction)
    }
  }, [phase, markUserActive])

  const performLock = useCallback(async () => {
    if (lockAttemptingRef.current) {
      return
    }
    lockAttemptingRef.current = true
    try {
      await vaultLock()
    } catch (error) {
      if (!handleCommandError(error)) {
        setGlobalError(error instanceof InvokeCommandError ? error.message : '锁定失败')
      }
    } finally {
      switchToUnlock()
    }
  }, [handleCommandError, switchToUnlock])

  const runWithDirtyGuard = useCallback(
    (reason: string, action: () => Promise<void>, onCancel?: () => void) => {
      if (!isDirty) {
        void action()
        return
      }
      setPendingLeaveAction({ reason, action, onCancel })
    },
    [isDirty],
  )

  useEffect(() => {
    if (phase !== 'ready') {
      return
    }

    const timer = window.setInterval(async () => {
      const timeoutSec = status?.idleTimeoutSec ?? IDLE_TIMEOUT_SEC
      const idleMs = timeoutSec * 1000
      if (Date.now() - activeAtRef.current >= idleMs) {
        runWithDirtyGuard(
          '检测到会话空闲即将自动锁定。是否先处理未保存修改？',
          performLock,
          () => {
            activeAtRef.current = Date.now()
            void touchVault()
          },
        )
        return
      }
      try {
        const nextStatus = await vaultStatus()
        setStatus(nextStatus)
        if (!nextStatus.unlocked) {
          switchToUnlock()
        }
      } catch (error) {
        handleCommandError(error)
      }
    }, 4000)

    return () => window.clearInterval(timer)
  }, [phase, status?.idleTimeoutSec, performLock, runWithDirtyGuard, touchVault, switchToUnlock, handleCommandError])

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (detailMode === 'none') {
      return true
    }

    const payload = formToEntryInput(draftForm)
    if (!payload.title) {
      setDetailError('名称为必填项')
      return false
    }

    setDetailSaving(true)
    setDetailError('')
    try {
      let savedEntry: Entry
      if (detailMode === 'create') {
        savedEntry = await entryCreate(payload)
      } else if (currentEntryId) {
        savedEntry = await entryUpdate(currentEntryId, payload)
      } else {
        return false
      }

      const nextForm = entryToForm(savedEntry)
      setDraftForm(nextForm)
      setBaselineForm(nextForm)
      setDetailMode('edit')
      setCurrentEntryId(savedEntry.id)
      await refreshEntries(latestSearchRef.current)
      return true
    } catch (error) {
      if (handleCommandError(error)) {
        return false
      }
      setDetailError(error instanceof InvokeCommandError ? error.message : '保存失败')
      return false
    } finally {
      setDetailSaving(false)
    }
  }, [detailMode, draftForm, currentEntryId, refreshEntries, handleCommandError])

  const openEntry = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetailError('')
      setCopyStatus('')
      setGeneratorOpen(false)
      try {
        const entry = await entryGet(id)
        const nextForm = entryToForm(entry)
        setCurrentEntryId(id)
        setDetailMode('edit')
        setDraftForm(nextForm)
        setBaselineForm(nextForm)
      } catch (error) {
        if (!handleCommandError(error)) {
          setDetailError(error instanceof InvokeCommandError ? error.message : '加载条目失败')
        }
      } finally {
        setDetailLoading(false)
      }
    },
    [handleCommandError],
  )

  const closeDetailView = useCallback(async () => {
    setDetailMode('none')
    setCurrentEntryId(null)
    setDraftForm(EMPTY_DRAFT)
    setBaselineForm(EMPTY_DRAFT)
    setShowPassword(false)
    setGeneratorOpen(false)
    setGeneratorPreview('')
    setGeneratorError('')
    setDetailError('')
  }, [])

  const createNewEntry = useCallback(async () => {
    const nextForm = { ...EMPTY_DRAFT }
    setDetailMode('create')
    setCurrentEntryId(null)
    setDraftForm(nextForm)
    setBaselineForm(nextForm)
    setDetailError('')
    setShowPassword(false)
    setCopyStatus('')
    setGeneratorOpen(false)
  }, [])

  const deleteCurrentEntry = useCallback(async () => {
    if (!currentEntryId) {
      return
    }
    const title = draftForm.title.trim() || '未命名条目'
    const confirmed = window.confirm(`确定删除「${title}」？此操作不可撤销。`)
    if (!confirmed) {
      return
    }

    setDetailSaving(true)
    try {
      await entryDelete(currentEntryId)
      await refreshEntries(latestSearchRef.current)
      await closeDetailView()
    } catch (error) {
      if (!handleCommandError(error)) {
        setDetailError(error instanceof InvokeCommandError ? error.message : '删除失败')
      }
    } finally {
      setDetailSaving(false)
    }
  }, [currentEntryId, draftForm.title, refreshEntries, closeDetailView, handleCommandError])

  const handleSetupSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSetupError('')
      if (setupPassword.length < 8) {
        setSetupError('主密码长度至少为 8 位')
        return
      }
      if (setupPassword !== setupPasswordConfirm) {
        setSetupError('两次输入的主密码不一致')
        return
      }
      setUnlockLoading(true)
      try {
        const nextStatus = await vaultSetup(setupPassword)
        setStatus(nextStatus)
        await vaultSetIdleTimeout(IDLE_TIMEOUT_SEC)
        setSetupPassword('')
        setSetupPasswordConfirm('')
        setPhase('ready')
        activeAtRef.current = Date.now()
        await refreshEntries('')
      } catch (error) {
        const message = error instanceof InvokeCommandError ? error.message : '创建保险库失败'
        setSetupError(message)
      } finally {
        setUnlockLoading(false)
      }
    },
    [setupPassword, setupPasswordConfirm, refreshEntries],
  )

  const handleUnlockSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!unlockPassword.trim()) {
        return
      }
      setUnlockLoading(true)
      setUnlockError('')
      try {
        const nextStatus = await vaultUnlock(unlockPassword)
        setStatus(nextStatus)
        await vaultSetIdleTimeout(IDLE_TIMEOUT_SEC)
        setUnlockPassword('')
        setPhase('ready')
        activeAtRef.current = Date.now()
        await refreshEntries('')
      } catch (error) {
        if (isErrorCode(error, 'INVALID_PASSWORD')) {
          setUnlockError('主密码不正确')
        } else {
          setUnlockError(error instanceof InvokeCommandError ? error.message : '解锁失败')
        }
      } finally {
        setUnlockLoading(false)
      }
    },
    [unlockPassword, refreshEntries],
  )

  const copyPassword = useCallback(async () => {
    if (!draftForm.password) {
      return
    }
    try {
      await navigator.clipboard.writeText(draftForm.password)
      setCopyStatus('已复制')
      window.setTimeout(() => setCopyStatus(''), 1500)
    } catch {
      setCopyStatus('复制失败')
    }
  }, [draftForm.password])

  const charsetEnabled =
    generatorOptions.uppercase ||
    generatorOptions.lowercase ||
    generatorOptions.digits ||
    generatorOptions.symbols

  const refreshGeneratedPassword = useCallback(async () => {
    if (!charsetEnabled) {
      setGeneratorError('至少选择一种字符集')
      setGeneratorPreview('')
      return
    }
    setGeneratorLoading(true)
    setGeneratorError('')
    try {
      const result = await passwordGenerate(generatorOptions)
      setGeneratorPreview(result.password)
    } catch (error) {
      if (!handleCommandError(error)) {
        setGeneratorError(error instanceof InvokeCommandError ? error.message : '生成失败')
      }
    } finally {
      setGeneratorLoading(false)
    }
  }, [charsetEnabled, generatorOptions, handleCommandError])

  useEffect(() => {
    if (!generatorOpen) {
      return
    }
    void refreshGeneratedPassword()
  }, [generatorOpen, generatorOptions, refreshGeneratedPassword])

  const fillPasswordFromGenerator = useCallback(() => {
    if (!generatorPreview) {
      return
    }
    setDraftForm((prev) => ({ ...prev, password: generatorPreview }))
    setShowPassword(true)
  }, [generatorPreview])

  const leavePromptSave = useCallback(async () => {
    if (!pendingLeaveAction) {
      return
    }
    const saved = await saveDraft()
    if (!saved) {
      return
    }
    const action = pendingLeaveAction.action
    setPendingLeaveAction(null)
    await action()
  }, [pendingLeaveAction, saveDraft])

  const leavePromptDiscard = useCallback(async () => {
    if (!pendingLeaveAction) {
      return
    }
    setDraftForm(baselineForm)
    const action = pendingLeaveAction.action
    setPendingLeaveAction(null)
    await action()
  }, [pendingLeaveAction, baselineForm])

  const leavePromptCancel = useCallback(() => {
    pendingLeaveAction?.onCancel?.()
    setPendingLeaveAction(null)
  }, [pendingLeaveAction])

  const showList = !isNarrowLayout || detailMode === 'none'
  const showDetail = !isNarrowLayout || detailMode !== 'none'

  if (phase === 'booting') {
    return (
      <main className="unlock-shell">
        <section className="unlock-card">
          <h1>加载中…</h1>
          <p>正在检查保险库状态</p>
        </section>
      </main>
    )
  }

  if (phase === 'setup') {
    return (
      <main className="unlock-shell">
        <section className="unlock-card">
          <h1>创建主密码</h1>
          <p>主密码用于解锁本机保险库，无法找回，请妥善保存。</p>
          <form className="form-stack" onSubmit={handleSetupSubmit}>
            <label>
              主密码
              <input
                autoFocus
                type="password"
                minLength={8}
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                disabled={unlockLoading}
              />
            </label>
            <label>
              确认主密码
              <input
                type="password"
                minLength={8}
                value={setupPasswordConfirm}
                onChange={(event) => setSetupPasswordConfirm(event.target.value)}
                disabled={unlockLoading}
              />
            </label>
            {setupError ? <p className="error-text">{setupError}</p> : null}
            <button type="submit" className="primary-button" disabled={unlockLoading}>
              {unlockLoading ? '创建中…' : '创建保险库'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (phase === 'unlock') {
    return (
      <main className="unlock-shell">
        <section className="unlock-card">
          <h1>解锁</h1>
          <form className="form-stack" onSubmit={handleUnlockSubmit}>
            <label>
              主密码
              <input
                autoFocus
                type="password"
                value={unlockPassword}
                onChange={(event) => setUnlockPassword(event.target.value)}
                disabled={unlockLoading}
              />
            </label>
            {unlockError ? <p className="error-text">{unlockError}</p> : null}
            {globalError ? <p className="error-text">{globalError}</p> : null}
            <button type="submit" className="primary-button" disabled={unlockLoading}>
              {unlockLoading ? '解锁中…' : '解锁'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="vault-shell">
      <header className="toolbar">
        <input
          type="search"
          placeholder="搜索名称、用户名、网址、标签…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <div className="toolbar-actions">
          <button
            type="button"
            onClick={() =>
              runWithDirtyGuard('切换到新建条目将离开当前未保存内容。', createNewEntry)
            }
          >
            新建
          </button>
          <button
            type="button"
            onClick={() => runWithDirtyGuard('锁定前检测到未保存修改。', performLock)}
          >
            锁定
          </button>
        </div>
      </header>

      <section className="workspace">
        {showList ? (
          <aside className="list-pane">
            {entriesLoading ? <p className="helper-text">正在加载…</p> : null}
            {!entriesLoading && entries.length === 0 && !debouncedSearch ? (
              <section className="empty-state">
                <p>还没有密码</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void createNewEntry()}
                >
                  新建条目
                </button>
              </section>
            ) : null}
            {!entriesLoading && entries.length === 0 && Boolean(debouncedSearch) ? (
              <section className="empty-state">
                <p>无匹配条目</p>
              </section>
            ) : null}
            <ul className="entry-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={entry.id === currentEntryId ? 'entry-row active' : 'entry-row'}
                    onClick={() =>
                      runWithDirtyGuard('切换条目前将离开未保存修改。', async () => openEntry(entry.id))
                    }
                  >
                    <span className="entry-title">{entry.title}</span>
                    <span className="entry-meta">{entry.username || '—'}</span>
                    <span className="entry-meta">{timestampToText(entry.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        {showDetail ? (
          <section className="detail-pane">
            {detailMode === 'none' ? (
              <section className="placeholder">
                <p>从左侧选择条目，或点击“新建”开始。</p>
              </section>
            ) : (
              <>
                <header className="detail-header">
                  {isNarrowLayout ? (
                    <button
                      type="button"
                      onClick={() =>
                        runWithDirtyGuard('返回列表前检测到未保存修改。', closeDetailView)
                      }
                    >
                      返回
                    </button>
                  ) : null}
                  <h2>{detailMode === 'create' ? '新建条目' : '编辑条目'}</h2>
                </header>

                {detailLoading ? <p className="helper-text">正在加载条目…</p> : null}

                {!detailLoading ? (
                  <form
                    className="form-stack detail-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void saveDraft()
                    }}
                  >
                    <label>
                      名称
                      <input
                        value={draftForm.title}
                        onChange={(event) =>
                          setDraftForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      用户名
                      <input
                        value={draftForm.username}
                        onChange={(event) =>
                          setDraftForm((prev) => ({ ...prev, username: event.target.value }))
                        }
                      />
                    </label>

                    <label>
                      密码
                      <div className="password-row">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={draftForm.password}
                          onChange={(event) =>
                            setDraftForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                        />
                        <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                          {showPassword ? '隐藏' : '显示'}
                        </button>
                        <button type="button" onClick={copyPassword}>
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => setGeneratorOpen((prev) => !prev)}
                        >
                          生成
                        </button>
                      </div>
                    </label>

                    {copyStatus ? <p className="helper-text">{copyStatus}</p> : null}

                    {generatorOpen ? (
                      <section className="generator-popover">
                        <div className="generator-preview">
                          <code>{generatorPreview || '等待生成...'}</code>
                          <button
                            type="button"
                            onClick={() => void refreshGeneratedPassword()}
                            disabled={generatorLoading}
                          >
                            刷新
                          </button>
                        </div>
                        <label>
                          长度 {generatorOptions.length}
                          <input
                            type="range"
                            min={8}
                            max={64}
                            value={generatorOptions.length}
                            onChange={(event) =>
                              setGeneratorOptions((prev) => ({
                                ...prev,
                                length: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <div className="generator-flags">
                          <label>
                            <input
                              type="checkbox"
                              checked={generatorOptions.uppercase}
                              onChange={(event) =>
                                setGeneratorOptions((prev) => ({
                                  ...prev,
                                  uppercase: event.target.checked,
                                }))
                              }
                            />
                            大写
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={generatorOptions.lowercase}
                              onChange={(event) =>
                                setGeneratorOptions((prev) => ({
                                  ...prev,
                                  lowercase: event.target.checked,
                                }))
                              }
                            />
                            小写
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={generatorOptions.digits}
                              onChange={(event) =>
                                setGeneratorOptions((prev) => ({
                                  ...prev,
                                  digits: event.target.checked,
                                }))
                              }
                            />
                            数字
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={generatorOptions.symbols}
                              onChange={(event) =>
                                setGeneratorOptions((prev) => ({
                                  ...prev,
                                  symbols: event.target.checked,
                                }))
                              }
                            />
                            符号
                          </label>
                        </div>
                        {generatorError ? <p className="error-text">{generatorError}</p> : null}
                        <button
                          type="button"
                          className="primary-button"
                          onClick={fillPasswordFromGenerator}
                          disabled={!generatorPreview}
                        >
                          填入密码
                        </button>
                      </section>
                    ) : null}

                    <label>
                      网址
                      <input
                        value={draftForm.url}
                        onChange={(event) =>
                          setDraftForm((prev) => ({ ...prev, url: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      标签
                      <input
                        placeholder="逗号分隔，例如：work,bank"
                        value={draftForm.tagsText}
                        onChange={(event) =>
                          setDraftForm((prev) => ({ ...prev, tagsText: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      备注
                      <textarea
                        rows={5}
                        value={draftForm.notes}
                        onChange={(event) =>
                          setDraftForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </label>

                    {detailError ? <p className="error-text">{detailError}</p> : null}
                    <footer className="detail-actions">
                      <button type="submit" className="primary-button" disabled={detailSaving}>
                        {detailSaving ? '保存中…' : '保存'}
                      </button>
                      {detailMode === 'edit' ? (
                        <button type="button" className="danger-button" onClick={deleteCurrentEntry}>
                          删除
                        </button>
                      ) : null}
                    </footer>
                  </form>
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </section>

      {pendingLeaveAction ? (
        <div className="modal-mask" role="dialog" aria-modal="true">
          <section className="modal-card">
            <h3>未保存更改</h3>
            <p>{pendingLeaveAction.reason}</p>
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => void leavePromptSave()}>
                保存
              </button>
              <button type="button" onClick={() => void leavePromptDiscard()}>
                不保存
              </button>
              <button type="button" onClick={leavePromptCancel}>
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App
