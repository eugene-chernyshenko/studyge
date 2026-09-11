declare const __APP_VERSION__: string

/** Build version, injected by Vite from package.json. */
export const APP_VERSION = __APP_VERSION__

/** Appended to every runtime data URL so a new release never reuses a cached one. */
export const cacheBust = `?v=${encodeURIComponent(APP_VERSION)}`
