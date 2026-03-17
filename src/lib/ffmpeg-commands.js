export function buildAudioExtendArgs({
  inputPath,
  outputPath,
  durationTargetSec,
  crossfadeDurationSec,
  targetLufs
}) {
  return [
    "-stream_loop",
    "-1",
    "-i",
    inputPath,
    "-filter_complex",
    `acrossfade=d=${crossfadeDurationSec},loudnorm=I=${targetLufs}`,
    "-t",
    String(durationTargetSec),
    outputPath
  ];
}

function hashSeed(input) {
  let hash = 2166136261;
  const text = String(input || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedInput) {
  let state = hashSeed(seedInput) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sample(rng, values) {
  return values[Math.floor(rng() * values.length)];
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(rng, min, max, digits = 3) {
  return Number((min + rng() * (max - min)).toFixed(digits));
}

function buildSoftStars(outputPath) {
  const rng = createRng(outputPath);
  const palette = ["0x9bbcff", "0xb8fff6", "0xfff3d6", "0xd7e4ff"];
  const sizes = [4, 4, 4, 8, 8, 8, 16, 16, 32, 4, 8, 16];
  const stars = [];

  for (const size of sizes) {
    const color = sample(rng, palette);
    const alphaBySize = {
      4: randomInt(rng, 190, 225),
      8: randomInt(rng, 160, 195),
      16: randomInt(rng, 100, 135),
      32: randomInt(rng, 72, 92)
    };
    const haloBySize = {
      4: { patch: randomInt(rng, 11, 14), alpha: randomInt(rng, 24, 36) },
      8: { patch: randomInt(rng, 20, 26), alpha: randomInt(rng, 28, 40) },
      16: { patch: randomInt(rng, 38, 48), alpha: randomInt(rng, 32, 46) },
      32: { patch: randomInt(rng, 64, 78), alpha: randomInt(rng, 22, 30) }
    };
    const speed = randomInt(rng, 44, 68);
    const direction = rng() > 0.5 ? 1 : -1;
    const startX = randomInt(rng, -900, 1400);
    const baseY = randomInt(rng, 56, 640);
    const yAmplitude = randomInt(rng, 4, 20);
    const yPeriod = randomInt(rng, 34, 64);
    const yPhase = randomFloat(rng, 0.1, 6.2, 2);
    const driftY = randomFloat(rng, -2.2, 2.2, 2);
    const xWobble = randomInt(rng, 3, 18);
    const xWobblePeriod = randomInt(rng, 17, 41);
    const xPhase = randomFloat(rng, 0.1, 6.2, 2);

    stars.push({
      size,
      color,
      alpha: alphaBySize[size],
      patchSize: haloBySize[size].patch,
      haloAlpha: haloBySize[size].alpha,
      centerX: `mod(${startX}${direction > 0 ? "+" : "-"}${speed}*t,main_w+overlay_w)-overlay_w/2+${xWobble}*sin(t/${xWobblePeriod}+${xPhase})`,
      centerY: `${baseY}${driftY >= 0 ? "+" : ""}${driftY}*t+${yAmplitude}*sin(t/${yPeriod}+${yPhase})`
    });
  }

  return stars;
}

export function buildVideoLoopArgs({
  videoTemplateId,
  durationTargetSec,
  outputPath
}) {
  if (videoTemplateId === "default-black") {
    return [
      "-f",
      "lavfi",
      "-i",
      "color=c=black",
      "-vf",
      "scale=1280:720",
      "-t",
      String(durationTargetSec),
      outputPath
    ];
  }

  if (videoTemplateId === "soft-stars") {
    const stars = buildSoftStars(outputPath);

    const inputs = [
      "-f",
      "lavfi",
      "-i",
      "color=c=0x030611:s=1280x720:r=24"
    ];

    const layerInput = ({ size, patchSize, color, alpha, haloAlpha }) => {
      const coreRadius = size / 2 - 0.5;
      const haloRadius = patchSize / 2 - 0.5;
      const coreRadiusSq = coreRadius * coreRadius;
      const haloRadiusSq = haloRadius * haloRadius;
      const parts = [
        `color=c=${color}:s=${patchSize}x${patchSize}:r=24`,
        "format=rgba",
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),${coreRadiusSq}),${alpha},if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),${haloRadiusSq}),${haloAlpha}*pow((sqrt(${haloRadiusSq})-sqrt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2)))/(sqrt(${haloRadiusSq})-sqrt(${coreRadiusSq})),2),0))'`
      ];
      return parts.join(",");
    };

    for (const star of stars) {
      inputs.push("-f", "lavfi", "-i", layerInput(star));
    }

    const filterParts = [];
    let previousLabel = "[0:v]";
    stars.forEach((star, index) => {
      const inputLabel = `[${index + 1}:v]`;
      const outputLabel = index === stars.length - 1 ? "[vstars]" : `[v${index + 1}]`;
      filterParts.push(
        `${previousLabel}${inputLabel}overlay=x='${star.centerX}':y='${star.centerY}-overlay_h/2':eval=frame${outputLabel}`
      );
      previousLabel = outputLabel;
    });
    filterParts.push(
      "[vstars]tmix=frames=3:weights='1 0.18 0.06',eq=brightness='0.018+0.010*sin(t/12)'[vout]"
    );

    return [
      ...inputs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[vout]",
      "-t",
      String(durationTargetSec),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      outputPath
    ];
  }

  return [outputPath];
}
