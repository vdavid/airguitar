import type { AppContext } from '../app.ts'
import { ICON } from '../ui/icons.ts'
import { createModal, dialogButton } from '../ui/modal.ts'
import { iconButton } from '../ui/topbar.ts'

/**
 * The Help dialog: Music Maker's "How to play", rewritten for our gestures (Build/Mixed/Play, one pitch
 * per string, no radial menu, no looper). Keep it in step with `gestures/` and AGENTS.md's gesture
 * rules when a gesture changes.
 */

const HELP_HTML = `
<h3>Build, Mixed, and Play</h3>
<ul>
  <li><b>Build</b> (the hammer, key <b>B</b>): make strings, move their ends, remove them, and pick their instruments. Plucking works here too.</li>
  <li><b>Mixed</b> (the string with two handles, key <b>M</b>): play, bend, and move ends to change notes. No new strings, no removing, no instrument changes; drop an end on the other and the string stays, just short.</li>
  <li><b>Play</b> (the hand, key <b>P</b>): play only, so nothing moves by accident. Bend works here too.</li>
</ul>
<h3>Making strings</h3>
<ul>
  <li><b>Make a string:</b> pinch thumb to index finger on both hands, pull your hands apart, and let go. With the mouse, drag in empty space. The instruments open right away so you can pick one; close them to keep the one shown at the top. Or open <b>Setups</b> for a ready-made stage. The stage holds up to 32 strings.</li>
  <li><b>Its note:</b> every string plays one note, set by its length. Shorter strings sound higher. Notes snap to the key and tone at the top; pick <b>Free</b> for no snapping.</li>
  <li><b>Move an end:</b> pinch an end and drag it. The note follows the new length.</li>
  <li><b>Remove a string:</b> drag one end onto its other end and let go.</li>
  <li><b>Pick an instrument:</b> pinch the middle of a string, then pinch an instrument. The instrument button at the top sets what new strings play.</li>
</ul>
<h3>Playing</h3>
<ul>
  <li><b>Pluck:</b> sweep an open fingertip across a string. Where you cross it doesn’t matter. Faster sweeps are louder.</li>
  <li><b>Hold a note:</b> rest a fingertip on a string. Bowed, blown, and sung instruments keep sounding while you stay; mallets and drums keep playing.</li>
  <li><b>Bend</b> (Mixed and Play): pinch a string and pull it sideways to bend its note up. Let go and it snaps back, and a big pull plays it.</li>
</ul>
<h3>Beats and recording</h3>
<ul>
  <li><b>Sound</b> (the speaker): <b>Tone</b> makes everything darker or brighter, and <b>Echo</b> adds repeats in time with the beat. Pinch − and + to change them; the speaker turns amber while either is on.</li>
  <li><b>Beat</b> (the drum): pick a backing rhythm, or Off. Its bass and chords follow your key and tone. Change the tempo at the bottom of the same menu, and switch parts on or off next to it.</li>
  <li><b>Record</b> (the red dot): pick video with sound or sound only, then press it to start and again to stop. Save the take as a video, MP3, or WAV.</li>
  <li><b>Shape:</b> landscape, or vertical for phones. <b>Stems</b> (the layers) saves each beat part as its own WAV, ready for a music editor.</li>
</ul>
<h3>Buttons and menus</h3>
<ul>
  <li>The amber ring between your thumb and index finger is your pointer. Put it on any button and pinch.</li>
  <li>Pinch outside a menu or dialog to close it. Esc closes it too.</li>
  <li>Everything saves by itself: reopen the page and your strings, mode, and beat are back.</li>
</ul>
<h3>If tracking struggles</h3>
<ul>
  <li>Sit 40 to 80 cm from the camera, palms toward the screen, with light on your hands.</li>
  <li>If pinches get missed or fire too easily, change <b>Pinch sensitivity</b> in Settings.</li>
</ul>
<p class="small">Based on <a href="https://hashem-al-ghaili.github.io/music-maker/" target="_blank" rel="noopener">Music Maker</a> by Hashem Al-Ghaili.</p>
`

export function mountHelp(ctx: AppContext): void {
  const modal = createModal({ id: 'help-modal', title: 'How to play' })
  const body = document.createElement('div')
  body.innerHTML = HELP_HTML
  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.append(
    dialogButton(
      'Got it',
      () => {
        modal.close()
      },
      { primary: true },
    ),
  )
  modal.card.append(body, actions)

  const button = iconButton({
    icon: ICON.help,
    label: 'How to play',
    onClick: () => {
      modal.open()
    },
  })
  ctx.topBar.mount(button, { slot: 'end', order: 310 })
}
