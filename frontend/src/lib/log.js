// Dev-only logger. In production builds we silently swallow so we don't
// leak tokens/IDs/error stacks into the browser console.
const isDev = process.env.NODE_ENV !== "production";

export const log = {
  error: (...args) => {
    if (isDev) console.error(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
};
