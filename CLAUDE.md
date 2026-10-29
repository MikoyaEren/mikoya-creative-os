# Mikoya Creative OS — repo rules

The app lives in `Mikoya-Creative-OS/` (see its own `CLAUDE.md`/`AGENTS.md`).

## Reference images for every image and video generation

Before any image or video generation (KnightVision `generate_image`, `generate_video`, `generate_omni_video`, `create_omni_character`, or prompts written for external tools such as Higgsfield), and before writing any storyboard:

1. Read `brand-references/mikoya/manifest.json`.
2. Work out which subjects appear in the shot (pouch, pouch_character, prep_set, bad_matcha, woman, style, lifestyle).
3. Attach every `attach` file of those subjects, and every `attach_when_available` file that exists on `main`, as reference images. Use the public URL `raw_base_url + path`, and check it returns HTTP 200 before generating. Never construct any other URL.
4. Start the prompt with each subject's `descriptor`, word for word.
5. If a subject's required reference is missing or does not resolve, do not generate. Tell the user which file from `brand-references/mikoya/README.md` is missing.
6. Never redraw, re-letter or restyle the real Mikoya packaging.
7. Tools with a reference limit:
   - When a shot has more references than the tool accepts, keep them in this order: pouch, pouch_character, character sheets, prep_set, style.
   - For `generate_omni_video`, register each approved character sheet once with `create_omni_character`, record the returned character_id in the manifest under `omni_character_id`, and reuse it.

When a new character sheet or packaging photo is approved, commit it under `brand-references/mikoya/` and update `manifest.json`.
