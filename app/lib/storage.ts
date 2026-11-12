const STORAGE_PREFIX = "taller-movil:";

export function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(key));

    if (!rawValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(rawValue) as T;

    if (parsedValue === null || parsedValue === undefined) {
      return fallback;
    }

    return parsedValue;
  } catch {
    return fallback;
  }
}

export function safeWriteStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    // Se ignora para mantener la experiencia usable en caso de que el almacenamiento esté lleno.
  }
}
