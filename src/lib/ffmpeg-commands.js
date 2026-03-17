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
    const stars = [
      { size: 4, color: "0x9bbcff", alpha: 220, x: "90+26*sin(t/43)+8*cos(t/19)", y: "62+14*cos(t/47)+5*sin(t/23)" },
      { size: 4, color: "0xb8fff6", alpha: 205, x: "1180+18*cos(t/39)+6*sin(t/17)", y: "540+12*sin(t/41)+4*cos(t/21)" },
      { size: 8, color: "0xfff3d6", alpha: 188, x: "220+32*sin(t/51)+10*cos(t/27)", y: "166+18*cos(t/45)+6*sin(t/29)" },
      { size: 8, color: "0xd7e4ff", alpha: 176, x: "960+22*cos(t/49)+7*sin(t/25)", y: "104+15*sin(t/43)+5*cos(t/31)" },
      { size: 16, color: "0x9bbcff", alpha: 120, x: "420+18*sin(t/57)+6*cos(t/33)", y: "420+11*cos(t/53)+4*sin(t/21)", haloSize: 42, haloAlpha: 42 },
      { size: 16, color: "0xb8fff6", alpha: 110, x: "760+16*cos(t/55)+6*sin(t/26)", y: "240+10*sin(t/48)+4*cos(t/24)", haloSize: 40, haloAlpha: 36 },
      { size: 32, color: "0xfff3d6", alpha: 84, x: "140+10*sin(t/61)+4*cos(t/19)", y: "500+7*cos(t/52)+3*sin(t/18)", haloSize: 72, haloAlpha: 28 },
      { size: 32, color: "0xd7e4ff", alpha: 78, x: "1030+9*cos(t/63)+4*sin(t/22)", y: "120+6*sin(t/46)+3*cos(t/17)", haloSize: 68, haloAlpha: 24 }
    ];

    const layers = [];
    for (const star of stars) {
      if (star.haloSize) {
        layers.push({
          size: star.haloSize,
          color: star.color,
          alpha: star.haloAlpha,
          x: star.x,
          y: star.y,
          blurSigma: 1.8
        });
      }
      layers.push({
        size: star.size,
        color: star.color,
        alpha: star.alpha,
        x: star.x,
        y: star.y,
        blurSigma: 0
      });
    }

    const inputs = [
      "-f",
      "lavfi",
      "-i",
      "color=c=0x030611:s=1280x720:r=24"
    ];

    const layerInput = ({ size, color, alpha, blurSigma }) => {
      const radius = size / 2 - 0.5;
      const parts = [
        `color=c=${color}:s=${size}x${size}:r=24`,
        "format=rgba",
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),${radius * radius}),${alpha},0)'`
      ];
      if (blurSigma > 0) {
        parts.push(`gblur=sigma=${blurSigma}:steps=1`);
      }
      return parts.join(",");
    };

    for (const layer of layers) {
      inputs.push("-f", "lavfi", "-i", layerInput(layer));
    }

    const filterParts = [];
    let previousLabel = "[0:v]";
    layers.forEach((layer, index) => {
      const inputLabel = `[${index + 1}:v]`;
      const outputLabel = index === layers.length - 1 ? "[vstars]" : `[v${index + 1}]`;
      filterParts.push(
        `${previousLabel}${inputLabel}overlay=x='${layer.x}':y='${layer.y}'${outputLabel}`
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
