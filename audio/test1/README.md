# Test 1 listening audio

Questions without `audioSegments` use one MP3 file:

```text
audio/test1/q101.mp3
audio/test1/q102.mp3
...
audio/test1/q110.mp3
```

Multi-speaker questions use one clip per dialogue line. Follow the paths in `data/tests.js`, for example:

```text
audio/test1/q101/01-narrator.mp3
audio/test1/q101/02-woman.mp3
audio/test1/q101/03-man.mp3
audio/test1/q101/04-woman.mp3
audio/test1/q101/05-question.mp3
```

Record exactly the matching segment's `text`. The player sequences every clip automatically, and the entire dialogue counts as one play. Missing clips use speaker-varied Japanese computer voice without discarding the recorded clips that are available.

For another test, create a matching folder such as `audio/test2/` and use the same relative-path convention.

Use clear Japanese speech, remove long silence at the beginning/end, and normalize all recordings to a similar volume. MP3 is the safest format for broad browser support. Until a file is present, the app automatically reads the question's `script` with the browser's Japanese computer voice.

Listening behavior is configured at the top of `js/audio.js`. With `TIMER_MODE: "main"`, the test uses its single duration. With `TIMER_MODE: "section"`, `LISTENING_DURATION_MINUTES` is reserved from the test duration as a separate listening timer.

Practice and retry modes also include shadowing. The browser asks for microphone permission when the learner starts recording. Recordings remain in memory only, can be downloaded manually, and are discarded when the learner changes question or leaves the page.
