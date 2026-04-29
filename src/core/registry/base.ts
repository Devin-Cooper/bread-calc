export interface Registry<T> {
  register(entry: T): void;
  get(id: string): T | undefined;
  list(): readonly T[];
}

// idOf is the entry's primary-key extractor. Insertion order is preserved by
// using both a Map (for O(1) get) and an array (for ordered list()).
export function createRegistry<T>(idOf: (entry: T) => string): Registry<T> {
  const byId = new Map<string, T>();
  const order: T[] = [];
  return {
    register(entry: T): void {
      const id = idOf(entry);
      if (byId.has(id)) {
        throw new Error(`duplicate registry entry: "${id}"`);
      }
      byId.set(id, entry);
      order.push(entry);
    },
    get(id: string): T | undefined {
      return byId.get(id);
    },
    list(): readonly T[] {
      return order;
    },
  };
}
