# Rain Layer Demo Implementation Plan

1. Add a standalone demo module
- Create `src/core/media/generate-rain-layer-demo.js`

2. Write tests first
- Verify the generator creates expected output files
- Verify final ffprobe result has one video stream

3. Implement transparent rain frame generation
- Produce deterministic rain streak positions from a seed
- Generate a short loopable frame sequence

4. Composite with ffmpeg
- Loop the source image
- Overlay the rain frames
- Export a short mp4

5. Run against the existing rain-night image
- Use `jobs/job_20260320_173600_32ac/video_image.png`
- Produce a 5 second demo output

6. Evaluate visually before integrating anywhere else
