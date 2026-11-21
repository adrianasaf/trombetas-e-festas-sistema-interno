/**
 * Fila local de retentativa do check-in (seção 11 — Conectividade).
 * Se a internet cair no momento do toque, o pedido fica guardado no IndexedDB e é reenviado
 * quando a conexão voltar, usando a MESMA RPC idempotente (mesmo client_request_id).
 * Não é um modo offline completo: a busca continua precisando de conexão.
 */

export type PendingKind = 'check_in' | 'walk_in'

export interface PendingItem {
  id: string // client_request_id
  kind: PendingKind
  label: string // nome exibido no contador (fica só neste aparelho)
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  lastError?: string
}

export interface QueueStorage {
  all(): Promise<PendingItem[]>
  put(item: PendingItem): Promise<void>
  remove(id: string): Promise<void>
}

export type SendResult = 'ok' | 'retry' | 'drop'
export type Sender = (item: PendingItem) => Promise<{ result: SendResult; error?: string }>

/** Erros de rede (sem resposta do servidor) devem ser retentados; erros de regra, não. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout')
  )
}

export class OfflineQueue {
  private listeners = new Set<(items: PendingItem[]) => void>()
  private flushing: Promise<void> | null = null

  constructor(
    private storage: QueueStorage,
    private sender: Sender,
    private maxAttempts = 50,
  ) {}

  subscribe(fn: (items: PendingItem[]) => void): () => void {
    this.listeners.add(fn)
    void this.storage.all().then(fn)
    return () => this.listeners.delete(fn)
  }

  private async emit() {
    const items = await this.storage.all()
    for (const fn of this.listeners) fn(items)
  }

  async enqueue(item: Omit<PendingItem, 'createdAt' | 'attempts'>): Promise<void> {
    await this.storage.put({ ...item, createdAt: Date.now(), attempts: 0 })
    await this.emit()
  }

  async count(): Promise<number> {
    return (await this.storage.all()).length
  }

  /** Reenvia tudo, em ordem de criação. Chamadas simultâneas compartilham a mesma execução. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null
      })
    }
    return this.flushing
  }

  private async doFlush() {
    const items = (await this.storage.all()).sort((a, b) => a.createdAt - b.createdAt)
    for (const item of items) {
      let outcome: { result: SendResult; error?: string }
      try {
        outcome = await this.sender(item)
      } catch (e) {
        outcome = { result: isNetworkError(e) ? 'retry' : 'drop', error: String((e as Error)?.message ?? e) }
      }
      if (outcome.result === 'retry') {
        const attempts = item.attempts + 1
        if (attempts >= this.maxAttempts) await this.storage.remove(item.id)
        else await this.storage.put({ ...item, attempts, lastError: outcome.error })
        // Sem conexão: não adianta tentar os próximos agora.
        break
      }
      await this.storage.remove(item.id)
    }
    await this.emit()
  }
}

/** Armazenamento em memória (testes e navegadores sem IndexedDB). */
export class MemoryStorage implements QueueStorage {
  private map = new Map<string, PendingItem>()
  async all() {
    return [...this.map.values()]
  }
  async put(item: PendingItem) {
    this.map.set(item.id, item)
  }
  async remove(id: string) {
    this.map.delete(id)
  }
}

const DB_NAME = 'tef-checkin'
const STORE = 'pendentes'

/** IndexedDB, com queda para memória se indisponível (aba anônima, bloqueio do navegador). */
export class IndexedDbStorage implements QueueStorage {
  private dbPromise: Promise<IDBDatabase> | null = null
  private fallback = new MemoryStorage()

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(DB_NAME, 1)
          req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        } catch (e) {
          reject(e)
        }
      })
    }
    return this.dbPromise
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async all(): Promise<PendingItem[]> {
    try {
      return (await this.run('readonly', (s) => s.getAll())) as PendingItem[]
    } catch {
      return this.fallback.all()
    }
  }
  async put(item: PendingItem) {
    try {
      await this.run('readwrite', (s) => s.put(item))
    } catch {
      await this.fallback.put(item)
    }
  }
  async remove(id: string) {
    try {
      await this.run('readwrite', (s) => s.delete(id))
    } catch {
      await this.fallback.remove(id)
    }
  }
}
