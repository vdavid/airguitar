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
  /** Mixed mode: a string with grab handles on its ends (play, and move ends). */
  mixed: svg('<circle cx="5.8" cy="18.2" r="2.6"/><circle cx="18.2" cy="5.8" r="2.6"/><path d="M7.7 16.3 16.3 7.7"/>'),
  /** Play mode: an open hand. */
  play: svg(
    '<path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0V11"/><path d="M10.8 10.2V4.9a1.4 1.4 0 0 1 2.8 0v5.3"/><path d="M13.6 10.2V5.8a1.4 1.4 0 0 1 2.8 0v5.6"/><path d="M16.4 11.2V8.4a1.4 1.4 0 0 1 2.8 0v5.2a6.4 6.4 0 0 1-6.4 6.4h-.7a6 6 0 0 1-4.6-2.2L4.6 14.4a1.4 1.4 0 0 1 2.1-1.8L8 14"/>',
  ),
  /** Key: a music note. */
  key: svg('<path d="M9 18V5.5l10-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  /** Tone (scale): rising steps. */
  tone: svg('<path d="M3.5 19h4v-4h4v-4h4V7h5"/>'),
  /** Setups: a folder. */
  setups: svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
  /** Help: a question mark in a circle. */
  help: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7"/><path d="M12 17.1h.01"/>',
  ),
  /** Sound (tone and echo): a speaker with waves. */
  sound: svg(
    '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.3 6.3a8 8 0 0 1 0 11.4"/>',
  ),
  /** Settings: two sliders. */
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  close: svg('<path d="M6 6 18 18M18 6 6 18"/>', 18),
  chevron: svg('<path d="m7 10 5 5 5-5"/>', 14),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 16),
} as const
