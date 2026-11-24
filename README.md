# Air guitar

Stretch strings in the air with your hands, then play them with your fingertips. It runs in your browser, uses your webcam to follow your hands, and makes every sound on the spot (no recordings).

**Play it at [airguitar.veszelovszki.com](https://airguitar.veszelovszki.com).** Chrome or Edge on a laptop works best.

## How to play

1. **Stretch a string.** Pinch thumb to index finger on both hands, pull your hands apart, and let go. The string stays where you left it.
2. **Shape it.** Pinch an end to move it. Shorter strings sound higher, like on a real guitar, and every string snaps to the key and scale in the top bar (pick "Free" to turn snapping off).
3. **Pick its instrument.** Pinch the middle of a string and choose from 24 instruments.
4. **Remove it.** Drop one end onto the other end.
5. **Play.** Sweep a fingertip across a string. Switch to Play mode so nothing moves by accident while you jam.

Up to eight hands can play at once, so bring friends. No camera? Choose "Play with the mouse instead": drag to draw a string, and sweep the pointer across it to play.

## Thanks

Air guitar is a rewrite of [Music Maker](https://hashem-al-ghaili.github.io/music-maker/) by Hashem Al-Ghaili ([code](https://github.com/Hashem-Al-Ghaili/music-maker)): the look, the instruments, and many of the ideas are his. Thank you, Hashem! (Based on his "feel free to build on it" in [his post](https://www.reddit.com/r/ClaudeAI/comments/1y1xtu9/i_built_a_musical_instrument_you_play_in_thin_air/), I assumed he just forgot to add a license. I'm happy to take this project down if he meant it to be more strictly licensed.)

## How it's made

[Claude](https://claude.com/claude-code) wrote this code. It's TypeScript with Vite, [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) for hand tracking, and the Web Audio API for sound. To run it locally: `pnpm install`, then `pnpm dev`.

## License

[MIT](LICENSE)
