# Mikoya reference images

This is the single source of reference images for every AI image and video generation (storyboards, KnightVision, Higgsfield or any other tool). `manifest.json` maps each recurring subject to its canonical text descriptor and to the files that must be attached as reference images.

## What already exists

| Subject | File | Status |
|---|---|---|
| Pouch, front (current label) | `brand-references/mikoya/product/pouch-front.png.png` | ✅ active (4000×4000) |
| Pouch, three-quarter view | `brand-references/mikoya/product/pouch-three-quarter.png.png` | ✅ active (1254×1254, below the 2000 px guideline; approved for use) |
| Pouch, side | `brand-references/mikoya/product/pouch-side.png.png` | ✅ active (1254×1254, approved) |
| Pouch, back | `brand-references/mikoya/product/pouch-back.png.png` | ✅ active (1254×1254, approved) |
| Preparation set | `Mikoya-Creative-OS/public/references/mikoya-starter-set.webp` | ✅ active, for the set only. It shows the retired "JPN MATCHA" pouch. |
| Lifestyle mood (photo formats only) | `Mikoya-Creative-OS/public/references/mikoya-lifestyle-iced-matcha.webp` | ✅ mood only. It shows the retired pouch. |
| Visual concept board (style, characters, stomach scenes) | `brand-references/mikoya/style/hero-villain-concept.webp` | ✅ active as the primary style reference. It is a concept, not final character sheets. |
| Good Matcha character sheet | `brand-references/mikoya/characters/pouch-character/sheet (3).png` | ✅ active (2304×1536) |
| Böser Matcha character sheet | `brand-references/mikoya/characters/bad-matcha/sheet (5).png` | ✅ active (2304×1206) |
| Woman character sheet | `brand-references/mikoya/characters/woman/sheet (4).png` | ✅ active (2304×1026) |
| Style frame | `brand-references/mikoya/style/style-frame.png` | ⏸ on hold: its Böser Matcha (dark-brown pouch, beige lettering, leaf) conflicts with the approved sheet. Upload a corrected version with the same name. |
| Old pouch front (`mikoya-jpn-matcha-pouch.webp`) | `Mikoya-Creative-OS/public/references/` | ⛔ retired packaging; kept for the app, never used as a reference |

Reference files keep their uploaded names (for example `.png.png` and `sheet (3).png`). If you rename them on GitHub, tell Claude so the manifest can be updated.

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

## Character sheets and style frame (you also upload these)

You create and supply these yourself. Claude never generates, edits or replaces a reference image. Upload them under these exact names:

| File | Content |
|---|---|
| `characters/pouch-character/sheet.png` | The pouch hero character, front plus three-quarter view, neutral and talking expressions, on white |
| `characters/bad-matcha/sheet.png` | The Bad Matcha villain, front plus three-quarter view, smug and angry expressions, on white |
| `characters/woman/sheet.png` | The protagonist: face close-up, full body front, full body three-quarter view, default outfit, on white |
| `style/style-frame.png` | One 9:16 frame that defines the look (light, colour, rendering) |

Sheet requirements:
- PNG.
- At least 2048 px on the long side, under 5 MB.
- Plain white background.
- The character's full design visible in every view: exact colours, proportions and outfit.
- No text or logos other than the real Mikoya label.

## How to upload

1. On GitHub, open the folder (for example `brand-references/mikoya/product`) on the `main` branch.
2. Click **Add file → Upload files**, drop the image in, and keep the exact file name from the tables above.
3. Choose **Commit directly to the main branch** and commit.
4. Tell Claude it's uploaded. Claude checks the file loads, marks it as available in `manifest.json`, and from then on attaches it automatically.

To replace a reference, upload a new file with the same name. Claude never does this for you.

## Rules (enforced by `CLAUDE.md` at the repo root)

1. Every generation attaches the `attach` files of each subject in the shot, plus each `attach_when_available` file once it exists.
2. References are passed as public URLs, `https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/<path>`. Files must be merged to `main` before they resolve.
3. If a required reference is missing, generation stops and asks for it rather than guessing.
4. Claude never generates, edits, upscales, or replaces reference images. Only you supply them. Claude never commits a change to a reference image file without your explicit approval in the conversation.
5. Prompts still repeat the canonical descriptor word for word.
