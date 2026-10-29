# Mikoya Creative OS — repo rules

The app lives in `Mikoya-Creative-OS/` (see its own `CLAUDE.md`/`AGENTS.md`).

## Reference images for every image and video generation

Before any image or video generation (KnightVision `generate_image`, `generate_video`, `generate_omni_video`, `create_omni_character`, or prompts written for external tools such as Higgsfield), and before writing any storyboard:

1. Read `brand-references/mikoya/manifest.json`.
2. Work out which subjects appear in the shot (pouch, pouch_character, prep_set, bad_matcha, woman, style, lifestyle).
3. Attach every `attach` file of those subjects, and every `attach_when_available` file that exists on `main`, as reference images. Use the public URL `raw_base_url + path`, and check it returns HTTP 200 before generating. Never construct any other URL.
   - URL-encode the path when building the raw URL. Spaces become `%20`, parentheses become `%28` and `%29`.
   - Never attach a file listed under a subject's `on_hold`.
4. Start the prompt with each subject's `descriptor`, word for word.
5. If a subject's required reference is missing or does not resolve, do not generate. Tell the user which file from `brand-references/mikoya/README.md` is missing.
6. Never redraw, re-letter or restyle the real Mikoya packaging.
7. Tools with a reference limit:
   - When a shot has more references than the tool accepts, keep them in this order: pouch, pouch_character, character sheets, prep_set, style.
   - For `generate_omni_video`, register each approved character sheet once with `create_omni_character`, record the returned character_id in the manifest under `omni_character_id`, and reuse it.

## Reference images belong to the user

- All reference images are supplied by the user: product photos, character sheets, style frames.
- Never create a reference image with KnightVision, Higgsfield or any other AI image or video tool. That includes character sheets, turnarounds, style frames and "improved" packaging shots.
- Never edit, upscale, crop, convert, overwrite, rename, move or delete a reference image unless the user explicitly approves that change in the conversation.
- Never use a generated image as a substitute reference, not even temporarily.
- When the user says a reference is uploaded:
  1. Check that its raw URL returns HTTP 200.
  2. Look at it and confirm it matches the slot.
  3. Update only the manifest entry: move the path from `attach_when_available` to `attach`.
  4. Tell the user it is now used automatically.
- Generating ad scenes is still allowed when the user asks for it, but only with the required references attached.
