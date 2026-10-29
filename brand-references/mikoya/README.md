# Mikoya reference images

This is the single source of reference images for every AI image and video generation (storyboards, KnightVision, Higgsfield or any other tool). `manifest.json` maps each recurring subject to its canonical text descriptor and to the files that must be attached as reference images.

## What already exists

| Subject | File | Status |
|---|---|---|
| Pouch, front | `Mikoya-Creative-OS/public/references/mikoya-jpn-matcha-pouch.webp` | ✅ present (2000×2000) |
| Preparation set | `Mikoya-Creative-OS/public/references/mikoya-starter-set.webp` | ✅ present (2000×2000) |
| Lifestyle mood (photo formats only) | `Mikoya-Creative-OS/public/references/mikoya-lifestyle-iced-matcha.webp` | ✅ present (2000×2000) |

These three stay in `public/references/` because the app loads them from there. Don't move or rename them.

## What you need to upload (real product photos)

Put these in `brand-references/mikoya/product/` using exactly these file names:

| File | What to shoot | Needed for |
|---|---|---|
| `pouch-three-quarter.png` | The pouch turned about 45° to the right, so the front label and the side gusset are both visible | The pouch character turning, walking or being held at an angle |
| `pouch-side.png` | Straight side profile, so the gusset depth and zip thickness are visible | Shots from the side; stops generators inventing a box shape |
| `pouch-back.png` | The back of the pouch, flat-on | Any shot where the pouch turns or is seen from behind |

Photo requirements:
- **Format:** PNG or JPG.
- **Size:** at least 2000 px on the long side, under 5 MB.
- **Background:** plain white or light grey, with no props and no matcha powder.
- **Lighting:** soft and even, with no glare on the label.
- **Framing:** the pouch filled and upright, centred, the label text sharp and straight. A full (unopened) pouch, so the shape is natural.

Optional uploads (nice to have):
- `product/mikoya-logo.svg`, for captions and end cards in the edit.

## What gets generated and approved (not uploaded)

Claude generates these once, using the pouch photo as a reference. You approve them, they get committed here, and from then on every generation attaches them.

| File | Content |
|---|---|
| `characters/pouch-character/sheet.png` | The pouch hero character, front plus three-quarter view, neutral and talking expressions, on white |
| `characters/bad-matcha/sheet.png` | The Bad Matcha villain, front plus three-quarter view, smug and angry expressions, on white |
| `characters/woman/sheet.png` | The protagonist: face close-up, full body front, full body three-quarter view, default outfit, on white |
| `style/style-frame.png` | One approved 9:16 frame that defines the look (light, colour, rendering) |

## Rules (enforced by `CLAUDE.md` at the repo root)

1. Every generation attaches the `attach` files of each subject in the shot, plus each `attach_when_available` file once it exists.
2. References are passed as public URLs, `https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/<path>`. Files must be merged to `main` before they resolve.
3. If a required reference is missing, generation stops and asks for it rather than guessing.
4. Prompts still repeat the canonical descriptor word for word.
