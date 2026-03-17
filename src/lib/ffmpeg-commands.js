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
    const layers = [
      { size: "4x4", color: "0x9bbcff@0.55", x: "90+120*sin(t/17)", y: "62+40*cos(t/19)" },
      { size: "4x4", color: "0xb8fff6@0.48", x: "1180+80*cos(t/21)", y: "540+28*sin(t/15)" },
      { size: "8x8", color: "0xfff3d6@0.42", x: "220+140*sin(t/23)", y: "166+52*cos(t/18)" },
      { size: "8x8", color: "0xd7e4ff@0.38", x: "960+90*cos(t/20)", y: "104+44*sin(t/14)" },
      { size: "16x16", color: "0x9bbcff@0.26", x: "420+110*sin(t/27)", y: "420+32*cos(t/16)" },
      { size: "16x16", color: "0xb8fff6@0.24", x: "760+100*cos(t/25)", y: "240+36*sin(t/18)" },
      { size: "32x32", color: "0xfff3d6@0.18", x: "140+60*sin(t/31)", y: "500+20*cos(t/17)" },
      { size: "32x32", color: "0xd7e4ff@0.16", x: "1030+55*cos(t/29)", y: "120+18*sin(t/13)" }
    ];

    const inputs = [
      "-f",
      "lavfi",
      "-i",
      "color=c=0x030611:s=1280x720:r=24"
    ];

    for (const layer of layers) {
      inputs.push(
        "-f",
        "lavfi",
        "-i",
        `color=c=${layer.color}:s=${layer.size}:r=24`
      );
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
      `[vstars]gblur=sigma=0.35:steps=1,eq=brightness='0.02+0.012*sin(t/9)'[vout]`
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
