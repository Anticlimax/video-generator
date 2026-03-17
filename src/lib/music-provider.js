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

function createInfshProvider() {
  return {
    name: "infsh",
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

export function resolveMusicProvider({ mode = "mock" } = {}) {
  if (mode === "infsh") {
    return createInfshProvider();
  }
  return createMockProvider();
}
