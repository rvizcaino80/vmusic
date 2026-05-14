import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { queryCache, withCache, invalidateCache, TTL, clearCache } from '../../src/lib/query-cache'

describe('QueryCache', () => {
  beforeEach(() => {
    queryCache.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should store and retrieve values', () => {
    queryCache.set('test-key', { foo: 'bar' })
    expect(queryCache.get('test-key')).toEqual({ foo: 'bar' })
  })

  it('should return null for missing keys', () => {
    expect(queryCache.get('nonexistent')).toBeNull()
  })

  it('should return null for expired entries', () => {
    queryCache.set('test-key', 'data', 100) // 100ms TTL
    expect(queryCache.get('test-key')).toBe('data')

    vi.advanceTimersByTime(101)
    expect(queryCache.get('test-key')).toBeNull()
  })

  it('should check key existence', () => {
    queryCache.set('key1', 'data')
    expect(queryCache.has('key1')).toBe(true)
    expect(queryCache.has('key2')).toBe(false)
  })

  it('should invalidate a specific key', () => {
    queryCache.set('key1', 'data1')
    queryCache.set('key2', 'data2')

    queryCache.invalidate('key1')
    expect(queryCache.has('key1')).toBe(false)
    expect(queryCache.has('key2')).toBe(true)
  })

  it('should invalidate by prefix', () => {
    queryCache.set('tags:all', [])
    queryCache.set('tags:recent', [])
    queryCache.set('artists:all', [])

    queryCache.invalidateByPrefix('tags')
    expect(queryCache.has('tags:all')).toBe(false)
    expect(queryCache.has('tags:recent')).toBe(false)
    expect(queryCache.has('artists:all')).toBe(true)
  })

  it('should clear all entries', () => {
    queryCache.set('key1', 'data1')
    queryCache.set('key2', 'data2')

    clearCache()
    expect(queryCache.size).toBe(0)
  })

  it('should prune expired entries', () => {
    queryCache.set('key1', 'data1', 100)
    queryCache.set('key2', 'data2', 5000)

    vi.advanceTimersByTime(101)
    queryCache.prune()
    expect(queryCache.has('key1')).toBe(false)
    expect(queryCache.has('key2')).toBe(true)
  })

  it('withCache should use cached value on subsequent calls', async () => {
    const fetcher = vi.fn().mockResolvedValue('expensive-data')

    const result1 = await withCache('test', fetcher, 1000)
    expect(result1).toBe('expensive-data')
    expect(fetcher).toHaveBeenCalledTimes(1)

    const result2 = await withCache('test', fetcher, 1000)
    expect(result2).toBe('expensive-data')
    expect(fetcher).toHaveBeenCalledTimes(1) // No second call
  })

  it('withCache should re-fetch after TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')

    await withCache('test', fetcher, 100)
    expect(fetcher).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(101)
    await withCache('test', fetcher, 100)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
