# Runway Micro-Motion Implementation Plan

1. Add job model support
- Add `generateMotionVideo` and `motionVideoPath` to job record normalization and merge logic
- Update web API parsing for the new checkbox input

2. Add failing tests
- Cover job parsing
- Cover pipeline branching
- Cover render precedence for motion video

3. Implement Runway provider
- Add `src/core/media/generate-motion-video.js`
- Implement Runway image-to-video create/poll/download flow
- Keep provider-specific logic isolated here

4. Wire job runner
- Generate motion clip after video image generation
- Store motion artifact path on the top-level job
- Fall back cleanly on failure

5. Wire renderer
- Allow `renderVideo` to loop a motion clip when present
- Preserve static image and template fallback behavior

6. Update UI
- Add `生成微动视频` checkbox to the form
- Show `微动视频` artifact in the detail page when available

7. Runtime config
- Read `RUNWAY_API_KEY` from web env and pass it into core runtime config

8. Verify
- Run targeted tests first
- Run full `node --test`
- Smoke the web flow locally
