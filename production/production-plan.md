# Mikoya Hero vs. Villain: production plan for the remaining 39 clips

Prepared after the validation round (Clips 01, 17 and 20 plus the Good Matcha voice test). **Nothing in this plan is generated until each batch is approved separately.**

Source: the approved storyboard with the branding-safe motion guidance (PR #11). Every prompt below is copied from it; the only changes are listed under *Prompt rules*.

## Production rules (from the validation round)

1. **Start frame first.** Nano Banana Pro, 2K, 9:16, with the manifest references attached. Hero product shots (Good Matcha label visible) get **2 variants**; all others get 1. You approve the frame before any animation.

2. **Model by shot type.**
   - **Omni** for on-camera dialogue: registered characters Good Matcha `kv-d32c58f2` (Laomedeia voice) and Böser Matcha `kv-0e909075` (Sadachbia voice), with the approved start frame as the guide image.
   - **Kling v3 image-to-video** (silent) for off-screen-voice and non-dialogue shots.

3. **Off-screen dialogue** comes from Omni voice-only renders (validated: correct German, clean silence between lines, matching pitch) and is cut into one file per line.

4. **QC every clip.** First the label checker (`tools/label-check`, PR #12) on the part of the clip used in the edit, then a visual check.
   - **FAIL:** trim, apply a local fix (as in Clip 20), or **at most one retake**, which needs your approval.
   - **Still failing after one retake:** restage (e.g. split Clip 31).

5. **Edit to the storyboard slot.** Renders are longer than the slots; use the clean section. Omni dialogue is prompted to start immediately (the Clip 01 lesson).

6. **Clean audio.** Omni prompts ask for voice only; music, sound effects and captions are added in the edit.

## Prompt rules (the only deviations from the storyboard text)

- **Shared style description:** the phrases about the woman / Böser Matcha are dropped when that character is **not** in the shot (as approved in the tests: the woman never appears in the stomach, and no villain look in hero-only shots).

- **Omni prompts:**
  - prefixed with the registered character names and "matching the reference start frame"
  - "starting to speak within the first half second" and "in German" are inserted at the dialogue
  - an audio line asks for voice only, with no music or effects

- **Kling prompts** are the storyboard image-to-video prompts unchanged. Kling renders silently; the off-screen voice comes from the voice-only audio.

- **Reference images:** at most 5 per start frame, in manifest priority order: pouch, Good Matcha, character sheets, prep set, concept board. The style frame stays disabled.


## Prices
Current KnightVision prices (Bronze rank):

| Item | Credits |
|---|---|
| Start frame | 15 |
| Omni, 4 s | 120 |
| Omni, 6 s | 130 |
| Omni, 8 s | 140 |
| Omni, 10 s | 150 |
| Kling v3, 5 s, 1080p, silent | 65 |

Every batch is re-quoted before it starts. Prices drop by ~1 credit per job once the account regains Silver rank (1,463 more credits of usage).


---
## Batch A: remaining off-screen dialogue (voice-only renders)

This audio is needed before the matching Kling clips can be cut. Same method as the validated test: Omni, the registered character, a plain studio, a ~1 s pause between lines, voice only.


| Render | Character | Lines (storyboard text, verbatim) | Omni | Credits |
|---|---|---|---|---|
| A1 | Böser Matcha | 2: „Und ich hab dich gerade beim Trinken" ⏸ 3: „fast zum Kotzen gebracht." ⏸ 4: „Du denkst jetzt wahrscheinlich," ⏸ 5: „Matcha ist widerlich" | 10 s | 150 |
| A2 | Good Matcha | 19: „und zeige dir, wie guter Matcha eigentlich schmecken sollte!" ⏸ 27: „schmecke angenehm mild" ⏸ 28: „und leicht nussig" | 10 s | 150 |
| A3 | Good Matcha | 29: „und rieche auch noch unglaublich gut." ⏸ 32: „und deinem Morgenritual das zu geben," ⏸ 33: „was es so lange gesucht hat!" | 10 s | 150 |
| A4 | Good Matcha | 34: „Und damit du mich perfekt lecker" ⏸ 35: „und cremig zubereiten kannst" | 8 s | 140 |

### Batch A: exact prompts
All renders use model `omni`, 1080p, 9:16 and the registered character only (no images, no new registrations). The video is discarded; only the audio is kept.

**A1**: character kv-0e909075 (Böser Matcha, Sadachbia), 10 s, 150 credits, lines 02, 03, 04, 05
> Böser Matcha, the dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace, stands still in a plain, quiet, softly lit studio and looks at camera. It speaks in clear, native standard German with its smug, sarcastic, theatrical villain voice, brisk and expressive with sly timing, with a clear pause of about half a second of silence between each line, saying exactly: "Und ich hab dich gerade beim Trinken" (pause) "fast zum Kotzen gebracht." (pause) "Du denkst jetzt wahrscheinlich," (pause) "Matcha ist widerlich". No music, no sound effects, no ambience, no background noise; only the voice. Static camera.

**A2**: character kv-d32c58f2 (Good Matcha, Laomedeia), 10 s, 150 credits, lines 19, 27, 28
> Good Matcha, the matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers, stands still in a plain, quiet, softly lit studio and looks at camera. It speaks in clear, natural, native standard German with its warm, bright, confident voice, lively and expressive like a friendly ad host, at a medium conversational pace, with a clear pause of about half a second of silence between each line, saying exactly: "und zeige dir, wie guter Matcha eigentlich schmecken sollte!" (pause) "schmecke angenehm mild" (pause) "und leicht nussig". No music, no sound effects, no ambience, no background noise; only the voice. Static camera.

**A3**: character kv-d32c58f2 (Good Matcha, Laomedeia), 10 s, 150 credits, lines 29, 32, 33
> Good Matcha, the matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers, stands still in a plain, quiet, softly lit studio and looks at camera. It speaks in clear, natural, native standard German with its warm, bright, confident voice, lively and expressive like a friendly ad host, at a medium conversational pace, with a clear pause of about half a second of silence between each line, saying exactly: "und rieche auch noch unglaublich gut." (pause) "und deinem Morgenritual das zu geben," (pause) "was es so lange gesucht hat!". No music, no sound effects, no ambience, no background noise; only the voice. Static camera.

**A4**: character kv-d32c58f2 (Good Matcha, Laomedeia), 8 s, 140 credits, lines 34, 35
> Good Matcha, the matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers, stands still in a plain, quiet, softly lit studio and looks at camera. It speaks in clear, natural, native standard German with its warm, bright, confident voice, lively and expressive like a friendly ad host, at a medium conversational pace, with a clear pause of about half a second of silence between each line, saying exactly: "Und damit du mich perfekt lecker" (pause) "und cremig zubereiten kannst". No music, no sound effects, no ambience, no background noise; only the voice. Static camera.

Changes from the validated test prompt:
- **Pause** shortened from ~1 s to ~0.5 s, so 3–4 lines fit in 10 s; the test showed even 0.3 s gaps cut cleanly.
- **"lively and expressive like a friendly ad host"** added, because the test delivery was a bit flatter than Clip 20.
- **Villain voice wording** taken from the voice lock.

**QC per render (free):**
- transcribe and compare word for word with the storyboard
- check pitch and brightness against the character's reference clip (Clip 20 / Clip 01)
- split into one WAV per line and run a loudness check
- fail → report; one re-render from the reserve only with approval

Already done: Lines 22, 24 and 25 (voice test). **Batch A budget: 590 credits** (+ reserve 150 for one re-render if a take fails the transcript check) = **740**.


---
## Batch 1: Hook & villain monologue (Clips 02–16, 15 clips)
Böser Matcha alone on camera (proven in Clip 01) and the woman's reactions.


| Clip | Time | Len | Characters | Model | Start frames | Video | Credits |
|---|---|---|---|---|---|---|---|
| 02 | 00:02.0–00:04.0 | 2.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 03 | 00:04.0–00:06.0 | 2.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 04 | 00:06.0–00:08.0 | 2.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 05 | 00:08.0–00:10.0 | 2.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 06 | 00:10.0–00:13.0 | 3.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 07 | 00:13.0–00:15.0 | 2.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 08 | 00:15.0–00:17.5 | 2.5 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 09 | 00:17.5–00:20.0 | 2.5 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 10 | 00:20.0–00:23.0 | 3.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 11 | 00:23.0–00:25.0 | 2.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 12 | 00:25.0–00:29.0 | 4.0 s | Böser Matcha | Omni | 1 × 15 | Omni 6 s 1080p = 130 | 145 |
| 13 | 00:29.0–00:31.0 | 2.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 14 | 00:31.0–00:33.0 | 2.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 15 | 00:33.0–00:35.0 | 2.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |
| 16 | 00:35.0–00:38.0 | 3.0 s | Böser Matcha | Omni | 1 × 15 | Omni 4 s 1080p = 120 | 135 |

**Batch 1 budget: 1815 credits + 20% retake reserve 365 = 2180.** The reserve is only used with your approval per retake.


### Clip 02 · 00:02.0–00:04.0 · 2.0 s · Kling v3

- **Dialogue:** „Und ich hab dich gerade beim Trinken"
- **Voice / audio:** off screen, Böser Matcha (Sadachbia) from voice-only render A1; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Woman: realistic face/bun/outfit must match the sheet; gag reaction should stay tasteful.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits at a cosy kitchen table, eyes closed, taking a big unsuspecting gulp from a white mug of murky brownish-green matcha, medium close-up. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater tips the mug back and gulps, unaware; she stays silent and does not lip-sync while the Bad Matcha voice says off-screen: “Und ich hab dich gerade beim Trinken” Preserve her face, messy bun, sweater, and realistic look. Static camera.


### Clip 03 · 00:04.0–00:06.0 · 2.0 s · Kling v3

- **Dialogue:** „fast zum Kotzen gebracht."
- **Voice / audio:** off screen, Böser Matcha (Sadachbia) from voice-only render A1; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Expression strength (nausea) can over-animate; keep it comedic.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. Close-up of her at the kitchen table with cheeks puffed out, face tinged green, one hand clamped over her mouth, eyes wide in horror, mug held at arm's length. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater freezes mid-swallow, cheeks bulge, her face flushes queasy green, and she slaps a hand over her mouth; she stays silent and does not lip-sync while the Bad Matcha voice says off-screen: “fast zum Kotzen gebracht.” Preserve her face, messy bun, sweater, and realistic look. Quick push-in.


### Clip 04 · 00:06.0–00:08.0 · 2.0 s · Kling v3

- **Dialogue:** „Du denkst jetzt wahrscheinlich,"
- **Voice / audio:** off screen, Böser Matcha (Sadachbia) from voice-only render A1; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Standard: run the label checker.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits at the kitchen table holding the white mug at a distance, staring into the murky brownish-green matcha with a suspicious frown, medium shot. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater narrows her eyes at the mug and sniffs it warily, lips pressed together; she stays silent and does not lip-sync while the Bad Matcha voice says off-screen: “Du denkst jetzt wahrscheinlich,” Preserve her face, messy bun, sweater, and realistic look. Slow push-in.


### Clip 05 · 00:08.0–00:10.0 · 2.0 s · Kling v3

- **Dialogue:** „Matcha ist widerlich"
- **Voice / audio:** off screen, Böser Matcha (Sadachbia) from voice-only render A1; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Standard: run the label checker.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She pushes the white mug of murky brownish-green matcha across the table with one finger, nose wrinkled and tongue out in disgust, medium shot. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater shoves the mug away, shudders from head to toe, and sticks her tongue out; she stays silent and does not lip-sync while the Bad Matcha voice says off-screen: “Matcha ist widerlich” Preserve her face, messy bun, sweater, and realistic look. Static camera.


### Clip 06 · 00:10.0–00:13.0 · 3.0 s · Omni

- **Dialogue:** „Aber in Wahrheit bin ich einfach schon oxidiert"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Villain body re-texturing (stains spreading) may alter the red panel; check panel every frame.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. Close-up of the villain pouch on a dim countertop watching a fresh brown stain spread across its paper as the powder heap on its top darkens, sickly purple-grey crackle flickering over it, glancing at camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace shrugs at camera as brown stains spread across its crumpled paper and dull powder flakes drift off its heap, purple-grey crackle flickering, and it smirks and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Aber in Wahrheit bin ich einfach schon oxidiert” Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 07 · 00:13.0–00:15.0 · 2.0 s · Omni

- **Dialogue:** „und gehör in den Müll."
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Action: settling into a bin may crumple the panel; trim if garbled.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch sits inside an open grey kitchen trash bin among crumpled paper and a banana peel, arms folded, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace settles into the trash bin, spreads its arms in a carefree shrug, looks at camera, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “und gehör in den Müll.” A fly circles lazily. Branding: keep the motion dynamic and expressive; during the fastest moves let the red BÖSER MATCHA panel turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 08 · 00:15.0–00:17.5 · 2.5 s · Omni

- **Dialogue:** „Ich stamme aus späteren Ernten"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Low risk; outdoor tea field lighting may shift the pouch colour.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch stands in a harsh sunlit tea field among large, tough, dark and yellowing late-season tea leaves, leaning on one oversized leaf, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace pats a tough yellowing leaf proudly, looks at camera, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich stamme aus späteren Ernten” Dry leaves rustle in a hot breeze. Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow pan right. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 09 · 00:17.5–00:20.0 · 2.5 s · Omni

- **Dialogue:** „und wurde möglichst schnell und günstig produziert."
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Action: fast conveyor ride, motion blur; red panel may smear.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch rides a fast grey factory conveyor belt toward a clunky industrial grinder with bright red discount tags hanging off the machinery, three-quarter view. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace speeds along the conveyor with hands up like on a roller coaster, turns to camera, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “und wurde möglichst schnell und günstig produziert.” Dust puffs off the belt. Branding: keep the motion dynamic and expressive; during the fastest moves let the red BÖSER MATCHA panel turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Fast tracking shot alongside. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 10 · 00:20.0–00:23.0 · 3.0 s · Omni

- **Dialogue:** „Ich trage so gut wie keine Antioxidantien"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Hands + jar prop near the panel; occlusion is fine, distortion is not.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch holds open a small glass jar that is empty except for one faint green sparkle at the bottom, on a plain dim background, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace tips the nearly empty jar toward camera as the lone green sparkle fizzles out, then shrugs and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich trage so gut wie keine Antioxidantien” Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 11 · 00:23.0–00:25.0 · 2.0 s · Omni

- **Dialogue:** „und Studien zeigen sogar,"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Magnifying-glass lens over the body distorts the panel optically; keep the lens off the panel.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. A giant brass magnifying glass hovers over the villain pouch on a dark countertop, its body enlarged and lit inside the lens, a nervous sweat drop on its brow. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace glances up at the magnifying glass sliding over it, tugs nervously at its crumpled top edge with a forced grin, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “und Studien zeigen sogar,” Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Static camera; the lens drifts slowly across. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 12 · 00:25.0–00:29.0 · 4.0 s · Omni

- **Dialogue:** „dass ich höhere Werte von Schwermetallen wie Blei beinhalte."
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 6 s 1080p = 130 · **total 145**
- **Branding / consistency risk:** Semi-transparent x-ray look can wash out or garble the red panel; highest villain branding risk.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch is shown semi-translucent like a cartoon x-ray, revealing small dull grey metal pellets mixed into its brown powder, while it pats its front on a dark background. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace bounces once so the grey pellets inside it rattle, pats its front, looks at camera with a smug smirk, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “dass ich höhere Werte von Schwermetallen wie Blei beinhalte.” Branding: keep the motion dynamic and expressive; during the fastest moves let the red BÖSER MATCHA panel turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 13 · 00:29.0–00:31.0 · 2.0 s · Omni

- **Dialogue:** „Aber das ist mir egal"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Deck chair + sunglasses: low risk.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch lounges in a tiny deck chair with small dark sunglasses pushed up on its brow, legs crossed, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace flicks one hand dismissively, rolls its eyes, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Aber das ist mir egal” It drops the sunglasses onto its eyes. Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 14 · 00:31.0–00:33.0 · 2.0 s · Omni

- **Dialogue:** „denn ich liefere meinem Hersteller"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Factory background: low risk.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch stands in front of a grey smoky factory building with a giant conveyor chute, jerking a thumb back toward the factory, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace jerks its thumb at the factory behind it with a sly wink and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “denn ich liefere meinem Hersteller” Grey smoke puffs from the chimneys. Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 15 · 00:33.0–00:35.0 · 2.0 s · Omni

- **Dialogue:** „maximalen Profit."
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Coin shower may cover the panel; fine if readable at the end.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. The villain pouch stands on a large pile of gold coins as more coins rain down around it, rubbing its hands together greedily. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace rubs its hands together greedily as gold coins shower around it, grins at camera, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “maximalen Profit.” Branding: keep the pouch upright with the red BÖSER MATCHA panel facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow low-angle push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 16 · 00:35.0–00:38.0 · 3.0 s · Omni

- **Dialogue:** „Muhahahaha"
- **Voice / audio:** on camera, Böser Matcha (Sadachbia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Omni 4 s 1080p = 120 · **total 135**
- **Branding / consistency risk:** Action: laughing with the body shaking; panel blur acceptable, garbling not.

**Start-frame prompt**
> A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. Low-angle shot of the villain pouch on top of a coin pile against a stormy dark-grey sky, arms spread wide, mouth open mid-laugh, purple-grey crackle around it. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Böser Matcha, matching the reference start frame's composition, lighting and look. The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace throws its head back and laughs theatrically, body shaking and powder clumps puffing off, then looks down into the camera, lip-syncing precisely to: “Muhahahaha” Lightning flickers behind it. Branding: keep the motion dynamic and expressive; during the fastest moves let the red BÖSER MATCHA panel turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Slow low-angle push-in. Audio: only the speaking character's voice; no music, no sound effects.


---
## Batch 2: Good Matcha intro & origin (Clips 18–26, 8 clips)
Hero introduction, Japan/first harvest, shading.


| Clip | Time | Len | Characters | Model | Start frames | Video | Credits |
|---|---|---|---|---|---|---|---|
| 18 | 00:40.0–00:42.5 | 2.5 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 19 | 00:42.5–00:46.0 | 3.5 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 21 | 00:48.0–00:50.5 | 2.5 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 22 | 00:50.5–00:53.0 | 2.5 s | none (hands/macro) | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 23 | 00:53.0–00:56.0 | 3.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 24 | 00:56.0–00:58.5 | 2.5 s | none (hands/macro) | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 25 | 00:58.5–01:01.0 | 2.5 s | none (hands/macro) | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 26 | 01:01.0–01:03.0 | 2.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |

**Batch 2 budget: 920 credits + 20% retake reserve 185 = 1105.** The reserve is only used with your approval per retake.


### Clip 18 · 00:40.0–00:42.5 · 2.5 s · Omni

- **Dialogue:** „Ich bin Mikoya Matcha"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Hero product shot: label must be perfect; 2 start frames.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. Hero shot of the pouch character standing on a sunny wooden kitchen counter with soft lime-green rim light and a small mound of vivid green matcha powder at its feet, one gloved hand on its chest, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers places a gloved hand on its chest, smiles warmly into the camera, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich bin Mikoya Matcha” Fine green sparkles drift upward. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 19 · 00:42.5–00:46.0 · 3.5 s · Kling v3

- **Dialogue:** „und zeige dir, wie guter Matcha eigentlich schmecken sollte!"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A2; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Woman + latte glass: verify the woman's identity matches the sheet.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits at a sunny kitchen table taking a first cautious sip from a glass of vivid lime-green iced matcha latte, eyebrows raised in surprise, medium close-up. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater sips the vivid green latte, pauses, and her surprised face melts into a delighted smile as she looks at the glass; she stays silent and does not lip-sync while the Mikoya Matcha voice says off-screen: “und zeige dir, wie guter Matcha eigentlich schmecken sollte!” Preserve her face, messy bun, sweater, and realistic look. Gentle push-in.


### Clip 21 · 00:48.0–00:50.5 · 2.5 s · Omni

- **Dialogue:** „bestehe ich ausschließlich aus jungen Teeblättern"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Outdoor tea terraces + holding a tea shoot: hand near the label.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character stands among rounded rows of vivid green tea bushes on misty hillside terraces at dawn, holding up a tender bright-green young tea shoot in one gloved hand. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers lifts the young tea shoot toward camera, smiles proudly, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “bestehe ich ausschließlich aus jungen Teeblättern” Morning mist drifts across the terraces. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow crane up. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 22 · 00:50.5–00:53.0 · 2.5 s · Kling v3

- **Dialogue:** „der ersten Ernte aus Japan."
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from line22 WAV (voice test kv-784c30b2); Kling renders silently.
- **Reference images:** [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** No characters; hands only. Low risk.

**Start-frame prompt**
> Close-up of a pair of hands gently plucking the top bud and two bright young leaves from a vivid green tea bush on misty Japanese hillside terraces at sunrise, golden light in the background. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The hands pluck the tender top leaves in one smooth motion as dew glints and golden sunrise light flares; no characters speak on screen while the Mikoya Matcha voice says off-screen: “der ersten Ernte aus Japan.” Slow push-in.


### Clip 23 · 00:53.0–00:56.0 · 3.0 s · Omni

- **Dialogue:** „Ich wurde 30 Tage lang beschattet,"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Shade canopy: dappled light over the label can hurt readability.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character sits in a row of tea bushes under a dark shade-cloth canopy, soft dappled light filtering through, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers gestures up at the shade canopy, then looks back at camera and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich wurde 30 Tage lang beschattet,” Specks of filtered light drift across the leaves. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow tilt down. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 24 · 00:56.0–00:58.5 · 2.5 s · Kling v3

- **Dialogue:** „wodurch sich mein L-Theanin-Gehalt"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from line24 WAV (voice test); Kling renders silently.
- **Reference images:** [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Macro, no characters. Low risk.

**Start-frame prompt**
> Macro view inside a shaded young tea leaf, its veins glowing softly, with tiny round smiling lime-green droplet sprites gathering and multiplying along the veins. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The tiny lime droplet sprites bob happily and multiply along the glowing leaf veins; no character lip-syncs while the Mikoya Matcha voice says off-screen: “wodurch sich mein L-Theanin-Gehalt” Slow macro push-in.


### Clip 25 · 00:58.5–01:01.0 · 2.5 s · Kling v3

- **Dialogue:** „und meine wunderschöne grüne Farbe entwickeln konnten."
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from line25 WAV (voice test); Kling renders silently.
- **Reference images:** [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Macro, no characters. Low risk. **Timing:** the validated Line 25 audio runs 3.0 s against a 2.5 s slot. Either let it run under the start of Clip 26, or use the continuous Line 24+25 take sped up about 8% (pitch preserved). Decide in the edit.

**Start-frame prompt**
> Macro close-up of young tea leaves in soft shade, their surfaces mid-change from pale green to rich vivid jade green, tiny golden light particles rising from them. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The leaves slowly unfurl as their colour deepens to rich jade green and golden particles float upward; no characters are visible while the Mikoya Matcha voice says off-screen: “und meine wunderschöne grüne Farbe entwickeln konnten.” Slow macro push-in.


### Clip 26 · 01:01.0–01:03.0 · 2.0 s · Omni

- **Dialogue:** „Ich bin intensiv grün,"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Powder puff in front of the pouch may cover the label briefly.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character stands on a clean white surface beside a fresh mound of intensely vivid lime-green matcha powder, one gloved arm extended presenting it. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers sweeps its gloved hand over the vivid green powder mound, which puffs up a soft green cloud, then beams at camera and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich bin intensiv grün,” Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


---
## Batch 3: Taste, rescue & ritual (Clips 27–35, 9 clips)
Includes the riskiest two-character shot (Clip 31).


| Clip | Time | Len | Characters | Model | Start frames | Video | Credits |
|---|---|---|---|---|---|---|---|
| 27 | 01:03.0–01:05.0 | 2.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 28 | 01:05.0–01:06.5 | 1.5 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 29 | 01:06.5–01:08.0 | 1.5 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 30 | 01:08.0–01:10.0 | 2.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 31 | 01:10.0–01:13.0 | 3.0 s | Good Matcha, Böser Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 32 | 01:13.0–01:16.0 | 3.0 s | Good Matcha, woman | Kling v3 | 2 × 15 | Kling v3 5 s 1080p (silent) = 65 | 95 |
| 33 | 01:16.0–01:19.0 | 3.0 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 34 | 01:19.0–01:21.5 | 2.5 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |
| 35 | 01:21.5–01:24.0 | 2.5 s | woman | Kling v3 | 1 × 15 | Kling v3 5 s 1080p (silent) = 65 | 80 |

**Batch 3 budget: 875 credits + 20% retake reserve 175 = 1050.** The reserve is only used with your approval per retake.


### Clip 27 · 01:03.0–01:05.0 · 2.0 s · Kling v3

- **Dialogue:** „schmecke angenehm mild"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A2; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Woman sipping from the bowl: hands/bowl consistency.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits by a sunny window holding a pale sky-blue ribbed ceramic bowl of creamy lime-green matcha in both hands, mid-sip with eyes softly closed, medium close-up. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater sips slowly, eyes closed, and her shoulders relax into a contented smile; she stays silent and does not lip-sync while the Mikoya Matcha voice says off-screen: “schmecke angenehm mild” Preserve her face, messy bun, sweater, and realistic look. Static camera.


### Clip 28 · 01:05.0–01:06.5 · 1.5 s · Kling v3

- **Dialogue:** „und leicht nussig"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A2; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Chef's-kiss gesture: hand anatomy check.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits by a sunny window lowering a pale sky-blue ribbed ceramic bowl of creamy lime-green matcha from her lips, eyebrows raised in pleasant surprise, medium close-up. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater lowers the bowl, raises her eyebrows approvingly, and gives a small chef's-kiss gesture with her free hand; she stays silent and does not lip-sync while the Mikoya Matcha voice says off-screen: “und leicht nussig” Preserve her face, messy bun, sweater, and realistic look. Static camera.


### Clip 29 · 01:06.5–01:08.0 · 1.5 s · Kling v3

- **Dialogue:** „und rieche auch noch unglaublich gut."
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A3; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Aroma wisps: low risk.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. Close-up of her leaning over a pale sky-blue ribbed ceramic bowl of frothy lime-green matcha, eyes closed, faint soft-green aroma wisps curling up toward her nose. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater inhales the rising green aroma wisps slowly with a blissful smile; she stays silent and does not lip-sync while the Mikoya Matcha voice says off-screen: “und rieche auch noch unglaublich gut.” Preserve her face, messy bun, sweater, and realistic look. Slow push-in.


### Clip 30 · 01:08.0–01:10.0 · 2.0 s · Omni

- **Dialogue:** „Ich bin hier, um dich"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Hero points at the viewer: label at an angle; keep upright.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character stands at the edge of a sunny kitchen counter, leaning toward camera and pointing a gloved finger straight at the viewer. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers leans toward camera, points at the viewer with a warm determined smile, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Ich bin hier, um dich” Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Quick push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 31 · 01:10.0–01:13.0 · 3.0 s · Omni

- **Dialogue:** „vor einem weiteren Matcha-Trauma zu retten"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [Böser Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/bad-matcha/sheet%20%285%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** HIGHEST RISK: two characters + energy blast + villain tumbling. Likely needs the local panel/label fix or one retake; split into 2 shots only if the first render fails QC.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. A crumpled, grimy stand-up paper pouch in dirty beige-tan covered with dark stains, scuffs and small tears, open at the top and heaped with dull olive-brown matcha powder, with a rough red brush-paint panel on the front carrying 'BÖSER MATCHA' in black graffiti letters and a small red skull and '30g' on a black smudge below it, brought to life as a cartoon character with amber-yellow eyes under heavy furrowed brown eyebrows, a wide grimace of crooked yellowed teeth, black arms ending in grimy off-white four-finger cartoon gloves, and black legs ending in worn, dirt-covered beige sneakers. Inside a cinematic human stomach with glossy warm red-pink folds and soft volumetric light, the pouch character thrusts out a glowing lime-green energy wave while the villain pouch, mid-air, is blasted backward in a burst of brown dust. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, dull brown dust, grime and red accents for the bad matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha and Böser Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers pushes the green energy wave forward, blasting the villain pouch away, then turns to camera with a determined smile and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “vor einem weiteren Matcha-Trauma zu retten” The dirty beige-tan BÖSER MATCHA pouch character heaped with dull brown powder, with amber-yellow eyes, heavy furrowed brows and a crooked yellowed grimace tumbles away into the stomach folds with a shocked face and stays silent. Branding: keep the motion dynamic and expressive; during the fastest moves let the front Mikoya label and the red BÖSER MATCHA panel turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Preserve its face, crumpled pouch shape, red BÖSER MATCHA panel, colours, and cinematic 3D look. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 32 · 01:13.0–01:16.0 · 3.0 s · Kling v3

- **Dialogue:** „und deinem Morgenritual das zu geben,"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A3; Kling renders silently.
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Kling v3 5 s 1080p (silent) = 65 · **total 95**
- **Branding / consistency risk:** Woman + pouch in one Kling shot: pouch label small but visible; label checker on.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. In a bright kitchen at sunrise, the woman stands at the counter whisking matcha in a pale sky-blue ribbed bowl, smiling, with the pouch character standing beside the bowl. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater whisks the matcha in relaxed strokes, glancing at the sunrise with a peaceful smile; she stays silent. the matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers looks up at her contentedly and stays silent, without lip-sync, while the Mikoya Matcha voice says off-screen: “und deinem Morgenritual das zu geben,” Warm sunlight spreads across the counter. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve her face, messy bun, sweater, and realistic look. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow dolly in.


### Clip 33 · 01:16.0–01:19.0 · 3.0 s · Kling v3

- **Dialogue:** „was es so lange gesucht hat!"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A3; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Woman with green glow: skin/outfit colour shift.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. She sits on a sunlit window seat in the morning, cradling a pale sky-blue ribbed bowl of lime-green matcha, a soft lime-green glow outlining her body, eyes closed with a serene smile. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater takes a calm breath as the lime-green glow around her brightens gently, and she opens her eyes with a happy, relieved smile; she stays silent and does not lip-sync while the Mikoya Matcha voice says off-screen: “was es so lange gesucht hat!” Preserve her face, messy bun, sweater, and realistic look. Slow push-in.


### Clip 34 · 01:19.0–01:21.5 · 2.5 s · Kling v3

- **Dialogue:** „Und damit du mich perfekt lecker"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A4; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Overhead hands + sieve: low risk.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. Overhead close-up of her hands holding a stainless-steel fine-mesh sieve over a pale sky-blue ribbed ceramic bowl, vivid lime-green matcha powder sifting through, oatmeal sweater cuffs visible. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The hands of the realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater tap the sieve so fine green powder snows evenly into the bowl; no one speaks on screen while the Mikoya Matcha voice says off-screen: “Und damit du mich perfekt lecker” Preserve her face, messy bun, sweater, and realistic look. Static overhead camera.


### Clip 35 · 01:21.5–01:24.0 · 2.5 s · Kling v3

- **Dialogue:** „und cremig zubereiten kannst"
- **Voice / audio:** off screen, Good Matcha (Laomedeia) from voice-only render A4; Kling renders silently.
- **Reference images:** [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 1 × 15 = 15 · Kling v3 5 s 1080p (silent) = 65 · **total 80**
- **Branding / consistency risk:** Overhead whisking: low risk.

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. Overhead close-up of her hands holding a natural bamboo matcha whisk in a pale sky-blue ribbed ceramic bowl, thick creamy lime-green foam forming, oatmeal sweater cuffs visible. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Kling v3)**
> The hands of the realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater whisk briskly in a zig-zag motion until a thick velvety lime-green foam rises; no one speaks on screen while the Mikoya Matcha voice says off-screen: “und cremig zubereiten kannst” Preserve her face, messy bun, sweater, and realistic look. Static overhead camera.


---
## Batch 4: Offer & CTA (Clips 36–42, 7 clips)
Product hero shots and the closing CTA; branding must be perfect.


| Clip | Time | Len | Characters | Model | Start frames | Video | Credits |
|---|---|---|---|---|---|---|---|
| 36 | 01:24.0–01:26.0 | 2.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 37 | 01:26.0–01:28.5 | 2.5 s | Good Matcha, prep set | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 38 | 01:28.5–01:30.0 | 1.5 s | Good Matcha, prep set | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 39 | 01:30.0–01:31.5 | 1.5 s | Good Matcha, woman | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 40 | 01:31.5–01:34.5 | 3.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 41 | 01:34.5–01:37.0 | 2.5 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |
| 42 | 01:37.0–01:40.0 | 3.0 s | Good Matcha | Omni | 2 × 15 | Omni 4 s 1080p = 120 | 150 |

**Batch 4 budget: 1050 credits + 20% retake reserve 210 = 1260.** The reserve is only used with your approval per retake.


### Clip 36 · 01:24.0–01:26.0 · 2.0 s · Omni

- **Dialogue:** „bekommst du beim Kauf von mir"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Thumbs pointing at its own label: gloves may cover text.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character stands on a sunny wooden kitchen counter pointing both gloved thumbs at itself with a proud grin, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers points both thumbs at itself with a proud grin, bounces on its sneakers, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “bekommst du beim Kauf von mir” Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 37 · 01:26.0–01:28.5 · 2.5 s · Omni

- **Dialogue:** „das Zubereitungs-Set im Wert von 40€"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [prep set photo](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/Mikoya-Creative-OS/public/references/mikoya-starter-set.webp), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Prep set + pouch: set photo shows the old JPN pouch, so pouch refs listed first.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. A matcha preparation set: a pale sky-blue horizontally ribbed ceramic matcha bowl with a pouring spout, a natural bamboo matcha whisk on a pale sky-blue ceramic whisk holder, a curved bamboo matcha scoop resting on a small pale sky-blue ceramic rest, and a stainless-steel fine-mesh sieve with a long looped handle. Clean bright hero shot on a sunny wooden kitchen table: the pouch character stands behind the preparation set with both gloved arms open toward it, the set glowing with a soft lime-green outline. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers spreads its arms toward the glowing preparation set like presenting a gift, looks into the camera with an excited smile, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “das Zubereitungs-Set im Wert von 40€” A golden sparkle passes over the bowl and whisk. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look, and the set's design. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 38 · 01:28.5–01:30.0 · 1.5 s · Omni

- **Dialogue:** „komplett gratis"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [prep set photo](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/Mikoya-Creative-OS/public/references/mikoya-starter-set.webp), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Action: jump for joy + confetti; label blur acceptable, garbling not.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. A matcha preparation set: a pale sky-blue horizontally ribbed ceramic matcha bowl with a pouring spout, a natural bamboo matcha whisk on a pale sky-blue ceramic whisk holder, a curved bamboo matcha scoop resting on a small pale sky-blue ceramic rest, and a stainless-steel fine-mesh sieve with a long looped handle. The pouch character jumps for joy beside the preparation set on a sunny wooden kitchen table as a big green gift ribbon bow pops onto the set and confetti bursts in the air. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers jumps up with both gloved fists raised and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “komplett gratis” A green gift bow pops onto the set and confetti bursts. Branding: keep the motion dynamic and expressive; during the fastest moves let the front Mikoya label turn away briefly, blur with the motion or pass out of frame rather than warp or garble, and bring it back upright, facing the camera and readable for the final beat. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look, and the set's design. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 39 · 01:30.0–01:31.5 · 1.5 s · Omni

- **Dialogue:** „Und keine Sorge –"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [woman sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/woman/sheet%20%284%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Woman holding the pouch while the pouch speaks: Omni can't take the woman's sheet directly (only a start-frame guide); woman identity drift risk. Optional: register the woman as an Omni character (30 credits).

**Start-frame prompt**
> A realistic young adult woman in her late twenties with fair, warm-toned skin, wavy medium-brown hair pulled up in a loose messy high bun with soft face-framing strands, green-hazel eyes, full natural brown eyebrows, a soft oval face with a warm gentle smile and light natural makeup, a thin gold necklace with a small pendant and a small gold clip in her bun, and a slim, healthy build, wearing a loose oatmeal-beige knit sweater with matching loose oatmeal knit trousers and light sneakers. A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. In a bright kitchen, the woman holds the pouch character up in both hands at chest height with a slightly unsure look, while the pouch faces camera with a reassuring smile and one gloved hand raised. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: a realistic human woman in softly lit natural real-world interiors, and stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers raises a calming gloved hand and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “Und keine Sorge –” The realistic young woman with a messy brown high bun, green-hazel eyes and an oatmeal knit sweater watches it, her unsure look softening; she stays silent. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve her face, messy bun, sweater, and realistic look. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Static camera. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 40 · 01:31.5–01:34.5 · 3.0 s · Omni

- **Dialogue:** „du hast 30 Tage Zeit um mich zu testen"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Calendar prop + marker: Omni may add random text on the calendar; keep the calendar blank or numbers only.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. The pouch character stands on a sunny kitchen counter next to a large paper wall calendar with a one-month grid, holding a green marker and tapping the calendar, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers draws a big green circle around the calendar month with the marker, turns to camera with a confident smile, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “du hast 30 Tage Zeit um mich zu testen” Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 41 · 01:34.5–01:37.0 · 2.5 s · Omni

- **Dialogue:** „also, gib mir bitte"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Close-up pleading: label large and must be perfect.

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. Close-up hero shot of the pouch character on a clean white surface with a soft lime-green glow behind it and a small mound of vivid green matcha powder at its feet, gloved hands pressed together pleadingly, facing camera. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. The matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers leans toward camera with gloved hands pressed together, eyes going wide and hopeful, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “also, gib mir bitte” Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in. Audio: only the speaking character's voice; no music, no sound effects.


### Clip 42 · 01:37.0–01:40.0 · 3.0 s · Omni

- **Dialogue:** „noch eine zweite Chance!"
- **Voice / audio:** on camera, Good Matcha (Laomedeia) lip-syncs in the Omni render; the audio comes from the render (voice only).
- **Reference images:** [pouch front](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-front.png.png), [pouch 3/4](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/product/pouch-three-quarter.png.png), [Good Matcha sheet](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/characters/pouch-character/sheet%20%283%29.png), [concept board](https://raw.githubusercontent.com/MikoyaEren/mikoya-creative-os/main/brand-references/mikoya/style/hero-villain-concept.webp)
- **Credits:** start frame 2 × 15 = 30 · Omni 4 s 1080p = 120 · **total 150**
- **Branding / consistency risk:** Pouch shown on a phone screen: small label; on-screen UI text may appear (unexpected text flag).

**Start-frame prompt**
> A matte-black stand-up Mikoya matcha pouch with a zip seal, open at the top and heaped with vibrant lime-green matcha powder spilling over the rim, carrying the current label below its face: 'MIKOYA' in small widely spaced serif capitals between two thin white lines, 'MATCHA' in large bold white sans-serif capitals, '100% Ceremonial' in small white sans-serif text below it, a thin-line green tea-leaf sprig illustration, '30g' near the bottom, and thin white corner-bracket lines at the top right and bottom left; brought to life as a friendly cartoon character with two large round white eyes with green irises and arched brown eyebrows on the upper front panel above the label, a wide open smile, black arms ending in white four-finger cartoon gloves, and black legs ending in chunky off-white sneakers. Close-up of a hand holding a smartphone toward camera; on the bright white screen the pouch character waves both gloved hands beneath a large green checkmark. Cinematic high-end 3D animated commercial look with photorealistic materials and lighting: stylized pouch characters with realistic foil, paper and powder textures; vivid lime-green powder and energy for the good matcha, warm soft key light, shallow depth of field, 9:16 vertical composition.

**Animation prompt (Omni)**
> Good Matcha, matching the reference start frame's composition, lighting and look. On the phone screen, the matte-black MIKOYA MATCHA pouch character heaped with vibrant green powder, with big green-irised eyes, white cartoon gloves and off-white sneakers waves both gloved hands, gives a hopeful smile, and lip-syncs precisely, starting to speak within the first half second, while speaking in German: “noch eine zweite Chance!” The green checkmark pulses once. Branding: keep the pouch upright with the front Mikoya label facing the camera and readable; avoid unnecessary rotation, twisting or crumpling of the label area while the rest of the performance stays lively. Preserve the exact Mikoya label layout and text, face, gloves, sneakers, colours, and cinematic 3D look. Slow push-in toward the screen. Audio: only the speaking character's voice; no music, no sound effects.


---
## Budget overview

| Batch | Content | Size | Planned credits | Retake reserve | Max |
|---|---|---|---|---|---|
| A | Off-screen dialogue audio | 4 renders | 590 | 150 | 740 |
| 1 | Hook & villain monologue | 15 clips | 1815 | 365 | 2180 |
| 2 | Good Matcha intro & origin | 8 clips | 920 | 185 | 1105 |
| 3 | Taste, rescue & ritual | 9 clips | 875 | 175 | 1050 |
| 4 | Offer & CTA | 7 clips | 1050 | 210 | 1260 |
| **Total** | | 39 clips + audio | **5250** | **1085** | **6335** |

Post-production (outside KnightVision): edit to the 1:40 timeline, captions, sound effects and the final mix. One music bed via KnightVision costs about 10 credits; optional, needs approval.


## Recommended order
1. **Batch A (audio)**, so every off-screen line exists before its clip is cut.
2. **Batch 1:** the villain is already proven in Omni, so this is the lowest-risk way to scale up.
3. **Batch 2.**
4. **Batch 3:** contains Clip 31, the highest-risk shot.
5. **Batch 4:** product and CTA shots, where the label must be flawless.

Each batch follows the same steps: you approve the budget, I generate the start frames, you choose them, I run the animations and QC, and you approve the clips.


## Open decisions before Batch 4
- **Clip 39:** register the woman as an Omni character (30 credits), or rely on the start frame as a guide.
- **Clip 37:** a new prep-set photo with the current pouch would remove the old-pouch conflict.
- **Claims review:** lines 10–12 (antioxidants, heavy metals/lead), 21–25 (first harvest, Japan, 30 days shading, L-theanine), 37 (40 € value) and 40 (30-day trial). Production can proceed, but legal sign-off is needed before the ad runs.
