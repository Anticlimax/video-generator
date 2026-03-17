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
    const starBoxes = [
      "drawbox=x='120+8*sin(t/17)':y='84+5*cos(t/19)':w=2:h=2:color=white@0.18:t=fill",
      "drawbox=x='240+10*cos(t/13)':y='150+6*sin(t/21)':w=2:h=2:color=white@0.15:t=fill",
      "drawbox=x='380+7*sin(t/15)':y='260+4*cos(t/23)':w=1:h=1:color=white@0.22:t=fill",
      "drawbox=x='520+9*cos(t/16)':y='110+6*sin(t/18)':w=2:h=2:color=white@0.14:t=fill",
      "drawbox=x='680+6*sin(t/14)':y='320+5*cos(t/20)':w=2:h=2:color=white@0.16:t=fill",
      "drawbox=x='810+8*cos(t/22)':y='210+4*sin(t/17)':w=1:h=1:color=white@0.24:t=fill",
      "drawbox=x='940+7*sin(t/12)':y='420+5*cos(t/18)':w=2:h=2:color=white@0.18:t=fill",
      "drawbox=x='1080+8*cos(t/24)':y='140+4*sin(t/16)':w=2:h=2:color=white@0.13:t=fill"
    ].join(",");

    return [
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=1280x720:r=24,${starBoxes}`,
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
