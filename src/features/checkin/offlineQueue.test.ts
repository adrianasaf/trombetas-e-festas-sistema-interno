import { describe, expect, it, vi } from 'vitest'
import { MemoryStorage, OfflineQueue, isNetworkError, type PendingItem } from './offlineQueue'

const item = (id: string) => ({
  id,
  kind: 'check_in' as const,
  label: `Convidado ${id}`,
  payload: { guest: id },
})

describe('OfflineQueue', () => {
  it('guarda pedidos e informa o contador', async () => {
    const q = new OfflineQueue(new MemoryStorage(), async () => ({ result: 'ok' }))
    const seen: number[] = []
    q.subscribe((items) => seen.push(items.length))
    await q.enqueue(item('a'))
    await q.enqueue(item('b'))
    expect(await q.count()).toBe(2)
    expect(seen.at(-1)).toBe(2)
  })

  it('reenvia em ordem e esvazia quando o servidor responde', async () => {
    const sent: string[] = []
    const q = new OfflineQueue(new MemoryStorage(), async (i) => {
      sent.push(i.id)
      return { result: 'ok' }
    })
    await q.enqueue(item('1'))
    await q.enqueue(item('2'))
    await q.flush()
    expect(sent).toEqual(['1', '2'])
    expect(await q.count()).toBe(0)
  })

  it('sem conexão: mantém o pedido, conta a tentativa e para de tentar os demais', async () => {
    const storage = new MemoryStorage()
    const sender = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const q = new OfflineQueue(storage, sender)
    await q.enqueue(item('1'))
    await q.enqueue(item('2'))
    await q.flush()
    expect(sender).toHaveBeenCalledTimes(1)
    const items = await storage.all()
    expect(items).toHaveLength(2)
    expect(items.find((i: PendingItem) => i.id === '1')!.attempts).toBe(1)
  })

  it('erro de regra (ex.: sem permissão) descarta o pedido em vez de repetir para sempre', async () => {
    const q = new OfflineQueue(new MemoryStorage(), async () => {
      throw new Error('Seu perfil não pode marcar presença.')
    })
    await q.enqueue(item('x'))
    await q.flush()
    expect(await q.count()).toBe(0)
  })

  it('flush simultâneo não envia o mesmo pedido duas vezes', async () => {
    let calls = 0
    const q = new OfflineQueue(new MemoryStorage(), async () => {
      calls++
      await new Promise((r) => setTimeout(r, 5))
      return { result: 'ok' }
    })
    await q.enqueue(item('1'))
    await Promise.all([q.flush(), q.flush(), q.flush()])
    expect(calls).toBe(1)
  })

  it('desiste após o máximo de tentativas', async () => {
    const q = new OfflineQueue(new MemoryStorage(), async () => ({ result: 'retry' }), 2)
    await q.enqueue(item('1'))
    await q.flush()
    expect(await q.count()).toBe(1)
    await q.flush()
    expect(await q.count()).toBe(0)
  })
})

describe('isNetworkError', () => {
  it('reconhece falhas de rede e ignora erros de regra', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true)
    expect(isNetworkError({ message: 'Convidado não encontrado.' })).toBe(false)
  })
})
