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
      "drawbox=x='90+12*sin(t/17)':y='70+6*cos(t/19)':w=3:h=3:color=white@0.55:t=fill",
      "drawbox=x='160+10*cos(t/13)':y='128+5*sin(t/21)':w=2:h=2:color=white@0.38:t=fill",
      "drawbox=x='240+14*sin(t/15)':y='196+7*cos(t/23)':w=3:h=3:color=white@0.48:t=fill",
      "drawbox=x='330+9*cos(t/16)':y='250+4*sin(t/18)':w=2:h=2:color=white@0.32:t=fill",
      "drawbox=x='410+11*sin(t/14)':y='102+5*cos(t/20)':w=3:h=3:color=white@0.44:t=fill",
      "drawbox=x='500+8*cos(t/22)':y='178+6*sin(t/17)':w=2:h=2:color=white@0.30:t=fill",
      "drawbox=x='580+12*sin(t/12)':y='312+5*cos(t/18)':w=3:h=3:color=white@0.40:t=fill",
      "drawbox=x='670+10*cos(t/24)':y='388+6*sin(t/16)':w=2:h=2:color=white@0.28:t=fill",
      "drawbox=x='760+13*sin(t/18)':y='144+4*cos(t/14)':w=3:h=3:color=white@0.42:t=fill",
      "drawbox=x='842+9*cos(t/15)':y='228+5*sin(t/19)':w=2:h=2:color=white@0.34:t=fill",
      "drawbox=x='930+11*sin(t/20)':y='468+7*cos(t/21)':w=3:h=3:color=white@0.46:t=fill",
      "drawbox=x='1012+8*cos(t/12)':y='332+4*sin(t/24)':w=2:h=2:color=white@0.30:t=fill",
      "drawbox=x='1100+12*sin(t/19)':y='122+5*cos(t/17)':w=3:h=3:color=white@0.43:t=fill",
      "drawbox=x='1184+10*cos(t/13)':y='270+5*sin(t/20)':w=2:h=2:color=white@0.31:t=fill",
      "drawbox=x='220+6*sin(t/27)':y='520+3*cos(t/15)':w=4:h=4:color=white@0.60:t=fill",
      "drawbox=x='880+5*cos(t/25)':y='88+3*sin(t/12)':w=4:h=4:color=white@0.58:t=fill"
    ].join(",");

    return [
      "-f",
      "lavfi",
      "-i",
      `color=c=0x030611:s=1280x720:r=24,${starBoxes},eq=brightness='0.02+0.01*sin(t/9)'`,
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
