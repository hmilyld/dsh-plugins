/** A minimal snapshot store, structurally the `HostObservable` slot hooks accept. */

/** Read-only observable snapshot. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Writable variant owned by a controller. */
export interface WritableStore<T> extends Store<T> {
  set(next: T): void
}

/**
 * Create a writable snapshot store.
 * @param initial - first published state.
 * @returns the store; every `set` notifies all current subscribers.
 */
export function createStore<T>(initial: T): WritableStore<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: (next) => {
      state = next
      // Snapshot first: a listener may unsubscribe while being notified.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const listener of [...listeners]) listener()
    },
  }
}
