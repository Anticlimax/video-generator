# Rain Layer Demo Design

## Goal

Build a standalone demo that applies a procedural "rain on window" foreground layer to a static image and renders a short loopable video clip.

This is a focused experiment to validate whether a procedural overlay looks better and behaves more predictably than generic image-to-video for rain scenes.

## Scope

### In scope

- Input a static image
- Generate a transparent animated rain overlay
- Composite the overlay over the image
- Render a short loopable demo clip

### Out of scope

- Integrating into the main web job pipeline
- Road reflections
- Camera shake
- Full water droplet simulation
- Physics-based splashes

## Visual target

The background image remains fully static.

The only motion is a foreground rain layer that feels like:
- rain streaks passing in front of the camera/window
- subtle diagonal movement
- soft blur and alpha variation
- multiple depth layers

No movement should occur in:
- buildings
- cars
- lights
- pedestrians
- street composition

## Recommended approach

Generate a short sequence of transparent PNG frames using Node-side procedural drawing logic, then composite them over the source image with ffmpeg.

This gives:
- deterministic output
- strong control over density and speed
- easy loopability
- no dependency on AI video models

## Output

The demo should produce:
- a short overlay frame sequence or equivalent intermediate artifact
- a short composited mp4, target `5s`

## Architecture

Add a standalone media utility:
- `src/core/media/generate-rain-layer-demo.js`

Responsibilities:
- generate a loopable rain layer
- render the final short mp4 from:
  - source image
  - rain overlay

## First version constraints

- 1280x720 output
- 5 second duration
- 24 fps
- two rain layers:
  - fine background rain
  - larger closer streaks
- light blur / alpha softness

## Why not ffmpeg-only first

Pure ffmpeg drawbox/drawline is possible but tends to look too synthetic. A generated transparent frame sequence gives more control over shape, blur, and density while staying deterministic.

## Verification

Success criteria:
- the resulting clip is playable
- the source image remains static
- rain is visibly the only moving element
- the clip can be looped without obvious jump cuts
