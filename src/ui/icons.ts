/**
 * Top bar icons: inline SVG strings on a 24 × 24 grid, stroked in `currentColor` so they follow
 * the button's colour. Add new ones here so every feature's buttons share one look.
 */

const svg = (body: string, size = 20): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICON = {
  /** Build mode: a hammer. */
  build: svg(
    '<path d="M14.5 5.5 18.5 9.5"/><path d="M11 9 3.8 16.2a2 2 0 0 0 2.8 2.8L13.8 11.8"/><path d="M12.2 3.6 20.4 11.8 18.6 13.6 10.4 5.4Z"/>',
  ),
  /** Play mode: an open hand. */
  play: svg(
    '<path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0V11"/><path d="M10.8 10.2V4.9a1.4 1.4 0 0 1 2.8 0v5.3"/><path d="M13.6 10.2V5.8a1.4 1.4 0 0 1 2.8 0v5.6"/><path d="M16.4 11.2V8.4a1.4 1.4 0 0 1 2.8 0v5.2a6.4 6.4 0 0 1-6.4 6.4h-.7a6 6 0 0 1-4.6-2.2L4.6 14.4a1.4 1.4 0 0 1 2.1-1.8L8 14"/>',
  ),
  /** Key: a music note. */
  key: svg('<path d="M9 18V5.5l10-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  /** Tone (scale): rising steps. */
  tone: svg('<path d="M3.5 19h4v-4h4v-4h4V7h5"/>'),
  close: svg('<path d="M6 6 18 18M18 6 6 18"/>', 18),
  chevron: svg('<path d="m7 10 5 5 5-5"/>', 14),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 16),
} as const
