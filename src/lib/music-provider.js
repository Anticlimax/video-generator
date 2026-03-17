function createAudioSpec() {
  return {
    format: "wav",
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16
  };
}

function createMockProvider() {
  return {
    name: "mock",
    timeoutSec: 180,
    maxRetries: 1,
    async normalizeResult(input) {
      return {
        path: input?.path ?? "jobs/job_001/master_audio.wav",
        audioSpec: createAudioSpec()
      };
    }
  };
}

function createInfshProviderWithApp({ infshAppId }) {
  return {
    name: "infsh",
    timeoutSec: 180,
    maxRetries: 1,
    prepareRequest({ prompt, durationSec }) {
      return {
        command: "infsh",
        args: [
          "app",
          "run",
          infshAppId,
          "--input",
          JSON.stringify({
            prompt,
            duration_sec: durationSec,
            format: "wav",
            sample_rate: 48000,
            channels: 2
          })
        ]
      };
    },
    async normalizeResult(input) {
      return {
        path: input?.path ?? "jobs/job_001/master_audio.wav",
        audioSpec: createAudioSpec()
      };
    }
  };
}

export function resolveMusicProvider({ mode = "mock", infshAppId } = {}) {
  if (mode === "infsh") {
    if (!infshAppId) {
      throw new Error("infsh_app_id_required");
    }
    return createInfshProviderWithApp({ infshAppId });
  }
  return createMockProvider();
}
