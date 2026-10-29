---
name: storyboard-ai-ad
description: Analyze one or more reference ad videos before turning a completed ad script into a clip-by-clip storyboard with consistent characters, animation, speakers, voices, and sound. Produces verbatim script sections, self-contained text-to-image prompts, action-and-dialogue image-to-video prompts, sound and voiceover direction, and estimated duration. Use when the user has a finished ad script plus at least one example or winning ad and wants storyboarding, character or voice consistency, lip-sync planning, sound direction, visual-beat parsing, shot planning, or generation prompts for tools such as Higgsfield. Do not use to write the ad script, generate media, edit footage, or add unsupported factual claims.
---

# AI Ad Storyboard

Analyze the reference ad before planning any clips. Translate the complete script into simple, producible visual beats without generating images or videos.

## Required inputs

Require both:

1. A completed ad script, timestamped or untimed.
2. At least one accessible reference video, provided as a local path or public URL.

Ask only for a missing required input. Accept optional product images, character references, brand rules, aspect ratio, or target generation platform when supplied. Otherwise infer only what is necessary and label material assumptions once before the storyboard.

## Workflow

### 1. Analyze every reference first

Use the installed `$watch` skill for each video. Read its `SKILL.md` completely before running its scripts. Pass an intent focused on ad storyboarding: hook construction, visual-beat timing, shot density, animation style, framing, visual metaphors, caption treatment, product frequency, transformation structure, CTA, transitions, speaker assignment, speaking behavior, voice qualities, music, ambience, and recurring sound effects.

Use an existing user-supplied transcript instead of sending local audio to a transcription service. If the watch frame cap stops before the end of a cut-heavy video, run focused passes over the uncovered ranges. Do not begin parsing the new script until the full reference runtime has been inspected.

For multiple references, identify the shared grammar and the useful differences. Favor the example closest to the new script's offer, format, and audience. Do not copy distinctive characters, branding, or frames.

Summarize the inferred blueprint in 5-8 concise bullets covering:

- Aspect ratio and visual medium
- Hook device
- Typical visual-beat length and shot density
- Framing, camera behavior, and motion
- Recurring visual devices or metaphors
- Character and product roles
- Caption or on-screen-text treatment
- Narrative phases and CTA treatment

Read `references/calibration-ad-grammar.md` when calibrating against the bundled example or when the current reference uses similar educational 3D animation. Treat the current uploaded references as authoritative when they differ.

### 2. Build the character, voice, sound, and style consistency lock

Before writing any clip prompt, create a visible **Character, Voice, Sound, and Style Consistency Lock**. Define every recurring person, creature, mascot, product, important recurring object, narrator, and speaking character. Extract the design and audio behavior from the reference video when available; otherwise define concrete assumptions once and label them.

For each recurring subject, write a canonical descriptor containing the invariant traits needed to recreate it independently:

- Stable label or role
- Species, body type, approximate age, and proportions
- Skin, fur, material, or primary color
- Face shape, eyes, hair, and defining facial features
- Default clothing or surface design
- Unique silhouette, markings, accessories, or packaging details

Also define one canonical style descriptor covering animation medium, rendering style, proportions, lighting, color treatment, and aspect ratio.

For every narrator or speaking character, define a canonical voice descriptor containing:

- Speaker label and whether the voice is on-camera or off-screen
- Approximate age presentation and gender presentation when relevant
- Pitch, timbre, texture, and energy
- Accent or dialect
- Speaking pace and rhythm
- Emotional attitude and persuasive style

Use identical voice-descriptor wording every time that speaker returns. Do not switch pitch, accent, age, timbre, or delivery style between clips unless the script explicitly calls for a transformation.

Create a speaker map before storyboarding. Assign every script section to exactly one delivery mode:

- **On-camera dialogue:** the visible character speaks and lip-syncs the exact line.
- **Off-screen character voice:** a defined character speaks while the visible subject remains silent.
- **Narrator voiceover:** the locked narrator speaks while all visible characters remain silent unless reacting.

Also define a global sound lock: music-bed genre and intensity, ambient sound style, recurring character motifs, transition effects, and mix priority. Keep voice or dialogue clearly dominant over music and effects.

Separate invariant identity traits from scene variables. Keep identity, facial structure, body proportions, core colors, and packaging fixed. Change pose, expression, location, action, lighting emphasis, damage state, or context-specific wardrobe only when the script requires it. If a recurring character changes wardrobe, retain the complete physical identity descriptor and describe only the wardrobe substitution.

Treat every image-generation prompt as stateless. Repeat the complete canonical descriptor, using identical wording, in every text-to-image prompt containing that subject. Never rely on phrases such as “the same woman,” “the previous character,” “as before,” or a character label by itself. Repeat the full product descriptor in every product shot as well.

Use this pattern:

```text
[Exact canonical subject descriptor]. [Scene-specific setting, pose, action state, and composition]. [Exact canonical style descriptor].
```

When multiple recurring subjects appear, include each relevant canonical descriptor. One-off background characters do not need a lock unless they return later. If the target platform supports reference images, character sheets, or fixed seeds, recommend them briefly, but keep every written prompt self-contained.

### 3. Parse the script into producible clips

Preserve every voiceover word exactly and in order. Do not rewrite, summarize, omit, or add voiceover.

Create a new clip when the visual subject, speaker, delivery mode, action, setting, mechanism, emotional beat, time period, product role, or narrative purpose changes. Do not assume one sentence equals one clip. Give each clip one clear visual event that can be generated from one starting image and animated without an internal cut.

Match the reference's pace. When the reference does not establish a usable pace:

- Target 3-6 seconds per clip.
- Split clips longer than 8 seconds.
- Avoid clips shorter than 2 seconds unless the hook or reference clearly calls for them.
- Prefer a few specific clips over one overloaded prompt containing several scenes.

Use supplied timestamps to calculate duration. For untimed scripts, estimate speech at 150 words per minute, adjust for pauses or emphasis, and round to the nearest 0.5 second. Keep the summed storyboard duration coherent with the script's estimated runtime.

### 4. Write the text-to-image prompt

Describe only the static starting image:

- Main subject
- Setting
- One readable pose or action state
- Framing or composition
- Visual style and lighting
- Aspect ratio only when useful

Keep the prompt short and concrete. Usually use one or two sentences. Exclude camera movement, editing instructions, transitions, dialogue, and long negative-prompt lists. Do not ask the image model to create subtitles or word-synced captions; assume captions are added during editing unless the user explicitly requests baked-in text.

Start with the exact canonical descriptor for every recurring subject in the frame and end with the exact canonical style descriptor. Concision applies to the scene-specific portion, not to the identity lock: never shorten, paraphrase, or omit invariant traits merely to make a later prompt shorter.

When accurate packaging matters, use a supplied product reference. If none exists, describe a generic placeholder and state once that label accuracy requires a reference image.

### 5. Write the image-to-video prompt

Animate the supplied starting image with:

- One primary subject movement
- At most one simple camera movement
- Optional environmental or energy motion
- The intended emotional tempo

Keep the prompt direct and self-contained. Do not redescribe the whole image. Do not request cuts, new locations, character swaps, or multiple sequential events inside one clip. Split those into separate clips.

Name the canonical subject and repeat a short, identical identity anchor containing its most distinctive physical traits. Do not ask the animation model to redesign, transform, replace, or restyle the character unless the script explicitly requires that change. Preserve face, body shape, colors, clothing, product design, and rendering style while animating.

Always specify the visible physical action, facial performance, eye line, and speaking behavior. Do not write only camera movement or vague mood.

Make the dialogue mode explicit and quote the complete verbatim script section inside the prompt:

- **On-camera dialogue:** instruct the visible speaker to look toward the intended listener or camera, move its mouth in precise natural synchronization, gesture appropriately, and speak: “verbatim script section.”
- **Off-screen character voice:** state that visible characters remain silent or react naturally while the locked character voice says off-screen: “verbatim script section.”
- **Narrator voiceover:** state that visible characters do not lip-sync while the locked narrator says: “verbatim script section.”

If the target image-to-video tool cannot generate speech audio, keep the exact dialogue, lip-sync, mouth, facial, and gesture instructions in the video prompt for animation, and treat the voice as a separate post-production track. Never omit the speaking action merely because audio will be added later.

### 6. Write the sound and voiceover direction

Add a required **Sound / voiceover direction** for every clip. State:

- Delivery mode and speaker
- The exact canonical voice descriptor, repeated with identical wording
- Whether the visible character lip-syncs, reacts silently, or has no speaking role
- Music-bed behavior
- Ambience and one or two purposeful sound effects
- Mix guidance when useful, keeping speech clearly dominant

Do not invent additional dialogue. The script section is the authoritative spoken content, and the same complete line must appear in the image-to-video prompt. Keep sound effects supportive rather than covering the voice.

### 7. Present the output

Use a normal chat response with lightweight Markdown. Start with the concise reference-ad blueprint, then the Character, Voice, Sound, and Style Consistency Lock, then output every storyboard clip in this exact structure:

```markdown
### Clip 01

**Script section / voiceover text**
“Verbatim script text.”

**Text-to-image prompt**
Concise static-image prompt.

**Image-to-video prompt**
Self-contained action prompt that quotes the exact spoken line and specifies lip-sync or off-screen narration behavior.

**Sound / voiceover direction**
Speaker, locked voice description, dialogue mode, music, ambience, sound effects, and mix direction.

**Estimated length**
4.5 seconds
```

End with the estimated total runtime. Do not add shot-purpose, continuity, editing, or negative-prompt fields unless the user asks for them.

## Quality control

Before answering, verify all of the following:

- Analyze the reference ad before writing any storyboard clips.
- Cover the entire reference runtime, including the offer and CTA.
- Define a canonical descriptor for every recurring character, mascot, product, and important object before writing clip prompts.
- Define a canonical voice descriptor for every narrator and recurring speaking character.
- Map every script section to one speaker and one delivery mode.
- Keep each speaker's pitch, timbre, accent, pace, and delivery style consistent across all clips.
- Define and reuse a global music, ambience, sound-effect, and mix lock.
- Repeat each complete canonical descriptor with identical wording in every relevant text-to-image prompt.
- Repeat a short, identical identity anchor in every relevant image-to-video prompt.
- Never use relative references such as “same character,” “same woman,” “as before,” or a label without its visual description.
- Keep invariant identity traits fixed while allowing only script-required scene variables to change.
- Include every script word exactly once and in the original order within the **Script section / voiceover text** fields. Deliberately repeat that exact text inside the corresponding image-to-video dialogue instruction; do not paraphrase it.
- Keep every clip to one producible visual event.
- Keep prompts simple, specific, and platform-neutral unless the user names a platform.
- Keep static composition in the text-to-image prompt and motion in the image-to-video prompt.
- Give every image-to-video prompt a concrete subject action, facial performance, eye line, and dialogue or narration behavior.
- Make every visible on-camera speaker lip-sync the exact line; explicitly keep non-speaking visible characters silent.
- Include a complete **Sound / voiceover direction** in every clip and repeat the speaker's exact voice lock.
- Make the reference's pacing and visual grammar recognizable without copying proprietary elements.
- Keep clip durations and total runtime internally consistent.
- Preserve claims from the supplied script without strengthening them or inventing proof. For health, financial, or legal claims, use illustrative visuals rather than adding authoritative-looking evidence the script does not provide.
- Complete the full storyboard; do not stop after representative clips.
