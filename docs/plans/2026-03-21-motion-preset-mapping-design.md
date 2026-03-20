# Motion Preset Mapping Design

## Goal

Make micro-motion behavior fit different visual scenes without requiring users to handcraft motion prompts.

The system should infer a small, controlled set of motion presets from:
- `theme`
- `style`
- `videoVisualPrompt`

Then use those presets to build a tightly constrained Runway motion prompt.

## Why

The current micro-motion path is too generic. A prompt that works for rain scenes is not correct for forests, oceans, fire, or night skies.

If the motion rules are too loose, image-to-video models animate too much:
- camera drift
- scene deformation
- unrelated object movement
- composition changes

The correct approach is to map scenes into a limited motion vocabulary and only allow subtle, scene-appropriate animation.

## Scope

### In scope

- Add a motion preset resolver
- Support one required primary preset
- Support one optional secondary preset
- Build motion prompts from preset templates
- Keep the existing Runway integration path

### Out of scope

- User-authored low-level motion prompting
- Model-specific prompt tuning UI
- More than two simultaneous presets
- LLM-based motion classification in the first version

## Preset Model

The resolver returns:

```json
{
  "primaryPreset": "rain",
  "secondaryPreset": "neon"
}
```

Supported presets:
- `rain`
- `water`
- `fire`
- `fog`
- `wind`
- `stars`
- `neon`
- `none`

## Resolution Strategy

Use deterministic keyword resolution instead of LLM classification.

Inputs are normalized from:
- `theme`
- `style`
- `videoVisualPrompt`

All input text is lowercased, concatenated, and matched against controlled keyword sets.

## Primary preset priority

When multiple strong presets match, choose the primary preset by this priority:

1. `rain`
2. `water`
3. `fire`
4. `fog`
5. `wind`
6. `stars`
7. `neon`
8. `none`

Reasoning:
- `rain`, `water`, and `fire` are visually dominant and should define the scene motion
- `fog`, `wind`, `stars`, and `neon` are usually better as subtle supporting motion

## Keyword groups

### rain

Keywords:
- `rain`
- `rainy`
- `storm`
- `stormy`
- `thunder`
- `drizzle`
- `downpour`
- `wet street`
- `raindrop`

### water

Keywords:
- `ocean`
- `sea`
- `wave`
- `waves`
- `lake`
- `river`
- `shore`
- `water`
- `tide`

### fire

Keywords:
- `fire`
- `flame`
- `flames`
- `campfire`
- `candle`
- `lava`
- `ember`
- `embers`

### fog

Keywords:
- `fog`
- `mist`
- `misty`
- `haze`
- `cloud`
- `clouds`
- `cloudy`
- `smoke`

### wind

Keywords:
- `wind`
- `windy`
- `breeze`
- `gust`
- `gusts`
- `sway`
- `leaves`
- `grass`

### stars

Keywords:
- `stars`
- `starry`
- `night sky`
- `galaxy`
- `cosmos`
- `space`
- `moonlight sky`

### neon

Keywords:
- `neon`
- `cyberpunk`
- `city lights`
- `sign glow`
- `glow sign`
- `electric sign`

## Secondary preset rules

Only allow a small number of safe combinations:

- `rain` may add `neon`
- `rain` may add `wind`
- `fog` may add `wind`
- `stars` may add `neon` only if the scene is clearly urban-night themed

Disallowed combinations:
- `water` with anything else
- `fire` with anything else
- `neon` as the only primary preset unless nothing stronger matches

This keeps motion controlled and prevents "too much movement" scenes.

## Prompt construction

Every prompt starts with a global constraint block:

- keep the camera locked
- preserve the original composition exactly
- no scene transformation
- no object deformation
- no extra motion beyond the selected atmospheric effects
- loop-friendly subtle motion

Then append the primary preset template.

Then append the optional secondary preset template in a weaker form.

## Prompt templates

### rain

- only animate falling rain and subtle raindrop streaks
- keep buildings, people, vehicles, and reflections stable

### water

- only animate gentle water ripples and soft wave movement
- keep shoreline, sky, rocks, and structures still

### fire

- only animate soft flame flicker and tiny ember shimmer
- keep surroundings fixed

### fog

- only animate faint drifting fog or mist
- keep trees, ground, and structures stable

### wind

- only animate very subtle leaf sway or grass movement
- keep the scene structure still

### stars

- only animate tiny star shimmer or faint atmospheric sparkle
- keep sky composition and horizon unchanged

### neon

- only animate subtle neon shimmer or weak reflected light flicker
- keep all objects and framing fixed

## Examples

### Rainy night city

Input:
- `theme = rainy night city`
- `style = cinematic neon ambience`

Output:
- `primaryPreset = rain`
- `secondaryPreset = neon`

### Mysterious forest

Input:
- `theme = mysterious forest`
- `style = dark ambient mist`

Output:
- `primaryPreset = fog`
- `secondaryPreset = wind`

### Ocean moonlight

Input:
- `theme = ocean moonlight`
- `style = calm ambient`

Output:
- `primaryPreset = water`

### Campfire meditation

Input:
- `theme = campfire night`
- `style = meditative ambient`

Output:
- `primaryPreset = fire`

## Failure behavior

If no preset matches:
- return `primaryPreset = none`
- use a generic low-motion prompt:
  - subtle atmospheric movement only
  - preserve composition
  - no scene change

## Recommendation

Implement this as a deterministic resolver plus prompt builder. Do not use LLM classification in the first version.

This keeps the system:
- predictable
- testable
- easy to tune by adjusting keyword lists and prompt templates
