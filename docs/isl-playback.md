# ISL playback

The client uses the existing four word animations (TIME, HOME, PERSON, YOU)
and A–Z fingerspelling assets. This is a limited sign dictionary with spelling
fallback, not a sentence-level ISL translator. HELLO, CARE, and NAMASTE are
spelled, not word signs. Numbers spell each digit's English name. Unsupported
scripts produce an explicit message rather than partial or guessed output.
Medical phrases must never be mapped to loosely related signs.

Playback compiles legacy rotation targets into full canonical poses. Quaternion
interpolation with smoothstep easing synchronizes joints using elapsed time.
Legacy final reset frames are replaced with transitions into the next sign;
repeated letters retain a release. Internal word movements are retained. The
180 ms default hold is applied after each token, replacing the old 600 ms pause
after every internal frame. Speed remains adjustable. Replay uses a request ID
and preserves the loaded model and renderer. Late model loads are disposed after
unmount. New requests blend from the current pose.

Try `/test/isl` for both avatar models and the speed slider. Run:

    cd Frontend
    node --test tests/isl-playback.test.js
    npm run build

## Repository review

Reviewed https://github.com/shoebham/text_to_isl and its main.py on 2026-09-13.
It separates text processing, dictionary lookup, and SiGML avatar playback; its
fallback spells unknown words. The Python pipeline uses Stanza and the Java
Stanford parser. Its SiGML assets require a compatible signing player; they
cannot be used as Three.js joint keyframes directly. The README explicitly says
its SiGML signs may be inaccurate, and the repository is GPL-2.0 licensed.
No upstream code or assets were copied. A production vocabulary expansion needs
reviewed ISL recordings or motion assets, linguistic review of sentence grammar
and nonmanual expression, and compatible asset permissions. Smoother playback
does not validate existing handshapes or the HumanBot retargeting calibration.

Automated tests cover semantic preservation, unsupported input, numeric spelling,
word movement retention, repeated letters, and frame-rate independence. Visual
comprehensibility and real-device latency still require browser and signer review.

## Website text coverage

The global ISL guide is independent of the voice guide and is mounted across
routes. A sign-language toggle is available when disabled. Hover text, focus or
click controls, or select visible text to request playback. The assistant's own
UI is excluded to avoid feedback loops. Password fields are excluded; other
inputs use labels/placeholders, not entered values. Route changes clear playback.

The English translation catalog currently contains 687 string entries and 680
unique alphabetic words. Regression tests check every catalog entry for playable
text (interpolation placeholders are replaced with a sample value for the test).
This measures text/fingerspelling coverage, not native sign vocabulary coverage,
and does not audit text embedded in images, PDF viewers, or remote video.

Exact localized labels resolve through the site's existing translation keys to
the corresponding English text before playback. Ambiguous translations and
unrecognized dynamic non-English content are preserved rather than guessed.
Parameterized localized strings are not currently reverse-translated. Captions
retain the original displayed language. Medical symbols, decimal points, and
alphanumeric units are expanded instead of being silently discarded.

ISLRTC's official dictionary has 10,000 terms including medical terminology:
https://islrtc.nic.in/faq/ . These are recorded videos, not rigged avatar motion.
The user chose avatar-only presentation; recorded video integration is excluded.
No external dictionary assets have been added.

The upstream GitHub tree contains 850 entries in SignFiles. Exact filename
matching finds 133 of the site's 680 unique catalog words (including single-letter
tokens); this is an availability count, not validation of sign correctness or
word sense. See `isl-vocabulary-coverage.csv` for each word. No replacement of the
current rig can create the missing vocabulary automatically. The upstream player
includes client-side animation generation, but needs its own avatar/runtime and
reviewed SiGML assets; it is not a direct Three.js animation import.


## Hand and rendering corrections (2026-09-20)

Clearance now checks skinned hand vertices as well as finger joints against a
live conservative torso boundary. Arm rotations move the wrist out of the
boundary while preserving wrist orientation, finger pose and bone lengths.
This is not full mesh collision detection: hand-to-hand, face contact, and
arbitrary concave clothing geometry are not solved. It can shift contact signs
outward, so linguistic review remains necessary.

Finger retargeting keeps lateral alignment and thumb-base opposition, but removes
bind-pose flexion that previously added curl on top of authored finger bends.
The presentation idle pose lowers the arms without changing the source reference
used to compile signs. Darker clothing, hidden jewelry, and an expandable panel
make the hands easier to distinguish. Existing model geometry/textures remain.

Regression commands from Frontend:

    node --test tests/isl-*.test.js
    npm run dev -- --host 127.0.0.1
    node scripts/check-isl-avatar.mjs

The browser script needs installed Chrome and Playwright (set PLAYWRIGHT_MODULE
to its module entry path if installed outside Frontend). It samples 704 poses
and transitions across A–Z and the four word signs, checking visible hand vertices
against the torso boundary. Observed zero penetration in that sweep; solver cost
averaged about 6.3 ms in local headless Chrome, not a mobile performance guarantee.
