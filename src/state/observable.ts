/** A tiny subscribe/notify helper the stores share. */
export class Emitter<T> {
  private readonly listeners = new Set<(event: T) => void>()

  /** Returns an unsubscribe function. */
  subscribe(listener: (event: T) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: T): void {
    for (const listener of this.listeners) listener(event)
  }
}
