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
      {
        size: 4,
        color: "0x9bbcff",
        alpha: 220,
        centerX: "mod(-80+62*t,main_w+overlay_w)-overlay_w/2",
        centerY: "62+14*cos(t/47)+5*sin(t/23)",
        patchSize: 12,
        haloAlpha: 34
      },
      {
        size: 4,
        color: "0xb8fff6",
        alpha: 205,
        centerX: "mod(220+58*t,main_w+overlay_w)-overlay_w/2",
        centerY: "540+12*sin(t/41)+4*cos(t/21)",
        patchSize: 12,
        haloAlpha: 30
      },
      {
        size: 8,
        color: "0xfff3d6",
        alpha: 188,
        centerX: "mod(-260+55*t,main_w+overlay_w)-overlay_w/2",
        centerY: "166+18*cos(t/45)+6*sin(t/29)",
        patchSize: 22,
        haloAlpha: 38
      },
      {
        size: 8,
        color: "0xd7e4ff",
        alpha: 176,
        centerX: "mod(540+61*t,main_w+overlay_w)-overlay_w/2",
        centerY: "104+15*sin(t/43)+5*cos(t/31)",
        patchSize: 22,
        haloAlpha: 34
      },
      {
        size: 16,
        color: "0x9bbcff",
        alpha: 120,
        centerX: "mod(-420+49*t,main_w+overlay_w)-overlay_w/2",
        centerY: "420+11*cos(t/53)+4*sin(t/21)",
        patchSize: 42,
        haloAlpha: 42
      },
      {
        size: 16,
        color: "0xb8fff6",
        alpha: 110,
        centerX: "mod(840+47*t,main_w+overlay_w)-overlay_w/2",
        centerY: "240+10*sin(t/48)+4*cos(t/24)",
        patchSize: 40,
        haloAlpha: 36
      },
      {
        size: 32,
        color: "0xfff3d6",
        alpha: 84,
        centerX: "mod(-700+44*t,main_w+overlay_w)-overlay_w/2",
        centerY: "500+7*cos(t/52)+3*sin(t/18)",
        patchSize: 72,
        haloAlpha: 28
      },
      {
        size: 32,
        color: "0xd7e4ff",
        alpha: 78,
        centerX: "mod(1080+46*t,main_w+overlay_w)-overlay_w/2",
        centerY: "120+6*sin(t/46)+3*cos(t/17)",
        patchSize: 68,
        haloAlpha: 24
      }
    ];

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
