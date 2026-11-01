# Mikoya label checker

A local, zero-credit check for branding errors in generated clips. It reads the text in every frame with a local OCR model (RapidOCR / ONNX; nothing is uploaded) and checks the Mikoya labels against the approved packaging.

| Label | Checked |
|---|---|
| **Good Matcha** (Mikoya pouch) | `MIKOYA`, `MATCHA`, `100% Ceremonial` and `30g` spelled correctly; elements in the right top-to-bottom order; white `MATCHA` text on a black pouch; green leaf below `100% Ceremonial` |
| **Böser Matcha** | `BÖSER` / `MATCHA` lettering present and sitting on a red panel |

It also reports text it doesn't recognise, and labels that are only partly readable.

**The result supports visual QC; it does not replace it.** Always look at the flagged frames and the final cut.

## Install

```bash
pip install -r tools/label-check/requirements.txt
```

## Run

```bash
python tools/label-check/label_check.py CLIP.mp4 --expect good --out qc/clip17
```

- `--expect`: which labels appear in the shot: `good`, `bad` or `good,bad`.
- `--start` / `--end`: check only the part of the clip used in the edit.
- `--every N`: check every Nth frame. `2` is a good default (~0.5 s per checked frame on CPU).
- `--persist N`: how many consecutive checked frames a text error must last to count as an ERROR. Default 3.

It writes:
- `report.md`: verdict, error and warning time ranges, and flag counts.
- `report.json`: every frame, with the OCR tokens, boxes and flags.
- `flagged_frames.jpg`: thumbnails of the flagged frames, with the text boxes drawn in.

## Reading the result

| Verdict | Meaning | Action |
|---|---|---|
| **PASS** | No errors or warnings | Visual spot-check |
| **CHECK** | Only warnings: an element was unreadable, a single-frame misread, or partial/unexpected text | Look at the listed times. Usually motion blur, small text or a label turning away |
| **FAIL** | A text or design error that persists across frames, e.g. `Caremonial` or a missing panel | Trim it out, fix it locally, or retake |

Each flag has a severity:
- **ERROR:** wrong text (persistent) or wrong colour.
- **WARNING:** an element is missing or unreadable, unexpected text, or a possible misread.
- **INFO:** the label isn't visible in that frame, which is fine during fast action.

Known OCR confusions are folded before comparing: `rn`→`m`, `0`→`o` inside words, a trailing `9`→`g` in `30g`. Single-frame misreads are downgraded to warnings, because generated label errors persist while OCR noise flickers.

## Calibration (test clips, every 2nd frame)

| Clip | Verdict | Notes |
|---|---|---|
| Clip 20, original Omni render | FAIL | `Caremonial` in every frame; Böser Matcha panel missing in every frame |
| Clip 20, locally corrected | CHECK | 47/48 frames clean (1 frame with `30g` unreadable) |
| Clip 17, full 5 s Kling render | CHECK | Warnings at 1.25–3.17 s, the tumble and garbled section |
| Clip 17, final 2 s edit | CHECK | 22/24 clean; the flags are the intentional motion-blur frames |
| Clip 01, Omni render | CHECK | 45/47 clean |

## Limits
- **Font-agnostic.** It checks spelling and design, not typeface details or kerning.
- **Small text.** Very small or heavily blurred text reads as "not readable" (a warning), not as wrong.
- **Not covered:** the corner brackets and exact leaf shape. Use visual QC for those.
- **Böser Matcha's panel colour** is checked only when its lettering is readable.
