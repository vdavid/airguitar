/**
 * Recording icons, drawn like `ui/icons.ts` (24 × 24, stroked in `currentColor`) so they match the
 * rest of the top bar.
 */
const svg = (body: string, size = 20): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const RECORD_ICON = {
  /** A filled dot. */
  record: svg('<circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/>'),
  /** A filled square. */
  stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>'),
  /** A video camera. */
  video: svg('<rect x="3" y="6.5" width="12.5" height="11" rx="2"/><path d="m15.5 10.5 5.5-3v9l-5.5-3"/>'),
  /** A microphone. */
  audio: svg(
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  ),
  /** A wide frame. */
  landscape: svg('<rect x="3" y="6.5" width="18" height="11" rx="2"/>'),
  /** A tall frame. */
  vertical: svg('<rect x="6.5" y="3" width="11" height="18" rx="2"/>'),
  /** Stacked layers: the stems zip. */
  stems: svg(
    '<path d="m12 3 8.5 4.5L12 12 3.5 7.5Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="M3.5 16.5 12 21l8.5-4.5"/>',
  ),
} as const
