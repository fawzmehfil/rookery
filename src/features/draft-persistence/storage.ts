/**
 * The only module that touches browser storage. Methods throw on failure; the
 * repository maps those exceptions to stable draft error codes.
 */
export interface DraftStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/** Returns localStorage behind DraftStorage, or null on the server or when storage is blocked. */
export function browserDraftStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;

  let storage: Storage;
  try {
    // Accessing localStorage throws a SecurityError when site data is blocked.
    storage = window.localStorage;
  } catch {
    return null;
  }

  if (!storage) return null;

  return {
    read: (key) => storage.getItem(key),
    write: (key, value) => storage.setItem(key, value),
    remove: (key) => storage.removeItem(key),
  };
}

export type MemoryDraftStorageOptions = Readonly<{
  /** Maximum total characters across stored values; writes above it throw QuotaExceededError. */
  quotaBytes?: number;
  /** Every operation throws SecurityError, as blocked browser storage does. */
  unavailable?: boolean;
  /** Initial contents. */
  initial?: Readonly<Record<string, string>>;
}>;

/** A realistic in-memory adapter for tests that raises the same DOMExceptions as browsers. */
export function createMemoryDraftStorage(options: MemoryDraftStorageOptions = {}): DraftStorage {
  const values = new Map<string, string>(Object.entries(options.initial ?? {}));
  const guard = () => {
    if (options.unavailable) throw new DOMException("Storage is blocked.", "SecurityError");
  };

  return {
    read(key) {
      guard();
      return values.get(key) ?? null;
    },
    write(key, value) {
      guard();
      const others = [...values].reduce((total, [storedKey, stored]) => total + (storedKey === key ? 0 : stored.length), 0);
      if (options.quotaBytes !== undefined && others + value.length > options.quotaBytes) {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }
      values.set(key, value);
    },
    remove(key) {
      guard();
      values.delete(key);
    },
  };
}
