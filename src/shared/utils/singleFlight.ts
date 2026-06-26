/**
 * Deduplicates concurrent async work keyed by `key`. The in-flight entry is removed when the promise settles.
 */
export function runSingleFlight<K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  factory: () => Promise<V>
): Promise<V> {
  const existing = cache.get(key)
  if (existing) return existing

  const promise = factory().finally(() => {
    cache.delete(key)
  })
  cache.set(key, promise)
  return promise
}
