# Motion Preset Mapping Implementation Plan

1. Add resolver module
- Create `src/core/media/motion-presets.js`
- Export:
  - `resolveMotionPresets(...)`
  - `buildMotionPresetPrompt(...)`

2. Add tests first
- Rain scene maps to `rain`
- Rainy neon city maps to `rain + neon`
- Mysterious forest maps to `fog + wind`
- Ocean maps to `water`
- Campfire maps to `fire`
- Unknown scene maps to `none`

3. Replace generic Runway prompt construction
- Update `generate-motion-video.js`
- Use resolver + prompt builder instead of a single generic prompt template

4. Keep current UI unchanged
- Do not add preset controls yet
- First version remains automatic

5. Verify behavior
- Run targeted tests for resolver and motion generation prompt construction
- Run full `node --test`

6. Optional next step
- Expose an advanced manual override later:
  - `Auto`
  - `Rain`
  - `Fog`
  - `Water`
  - `Fire`
  - `Stars`
  - `Wind`
  - `Neon`
