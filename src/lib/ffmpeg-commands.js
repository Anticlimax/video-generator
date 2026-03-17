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
      "drawbox=x='80+17*sin(t/17)':y='62+8*cos(t/19)':w=1:h=1:color=0x9bbcff@0.42:t=fill",
      "drawbox=x='126+11*cos(t/13)':y='108+7*sin(t/21)':w=2:h=2:color=0xb8fff6@0.34:t=fill",
      "drawbox=x='214+15*sin(t/15)':y='166+9*cos(t/23)':w=3:h=3:color=0xfff3d6@0.48:t=fill",
      "drawbox=x='302+12*cos(t/16)':y='228+5*sin(t/18)':w=1:h=1:color=0xd7e4ff@0.30:t=fill",
      "drawbox=x='384+16*sin(t/14)':y='92+7*cos(t/20)':w=2:h=2:color=0x9bbcff@0.38:t=fill",
      "drawbox=x='470+10*cos(t/22)':y='158+8*sin(t/17)':w=3:h=3:color=0xb8fff6@0.40:t=fill",
      "drawbox=x='548+18*sin(t/12)':y='286+6*cos(t/18)':w=1:h=1:color=0xfff3d6@0.28:t=fill",
      "drawbox=x='636+13*cos(t/24)':y='352+8*sin(t/16)':w=2:h=2:color=0xd7e4ff@0.32:t=fill",
      "drawbox=x='724+16*sin(t/18)':y='126+5*cos(t/14)':w=3:h=3:color=0x9bbcff@0.44:t=fill",
      "drawbox=x='806+12*cos(t/15)':y='206+6*sin(t/19)':w=1:h=1:color=0xb8fff6@0.30:t=fill",
      "drawbox=x='890+14*sin(t/20)':y='438+9*cos(t/21)':w=2:h=2:color=0xfff3d6@0.39:t=fill",
      "drawbox=x='972+9*cos(t/12)':y='304+5*sin(t/24)':w=3:h=3:color=0xd7e4ff@0.34:t=fill",
      "drawbox=x='1058+17*sin(t/19)':y='104+7*cos(t/17)':w=1:h=1:color=0x9bbcff@0.31:t=fill",
      "drawbox=x='1146+12*cos(t/13)':y='244+6*sin(t/20)':w=2:h=2:color=0xb8fff6@0.29:t=fill",
      "drawbox=x='180+7*sin(t/27)':y='504+4*cos(t/15)':w=4:h=4:color=0xfff3d6@0.55:t=fill",
      "drawbox=x='842+6*cos(t/25)':y='76+4*sin(t/12)':w=4:h=4:color=0x9bbcff@0.50:t=fill",
      "drawbox=x='1118+5*sin(t/31)':y='516+3*cos(t/14)':w=4:h=4:color=0xb8fff6@0.46:t=fill",
      "drawbox=x='448+4*cos(t/29)':y='418+3*sin(t/11)':w=4:h=4:color=0xd7e4ff@0.43:t=fill"
    ].join(",");

    return [
      "-f",
      "lavfi",
      "-i",
      `color=c=0x030611:s=1280x720:r=24,${starBoxes},gblur=sigma=0.22:steps=1,eq=brightness='0.02+0.012*sin(t/9)'`,
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
