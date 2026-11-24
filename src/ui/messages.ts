/** The hint pill (what to do next) and the toast (one-off notices). */

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string, ms = 2600): void {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.classList.remove('show')
  }, ms)
}

let hintShown = ''

/** Shows `text` in the hint pill, or hides it for an empty string. Cheap to call every frame. */
export function setHint(text: string): void {
  if (text === hintShown) return
  hintShown = text
  const el = document.getElementById('hint')
  if (!el) return
  if (text) el.textContent = text
  el.classList.toggle('show', text !== '')
}
