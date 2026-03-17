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

function createElevenLabsProviderWithKey({ elevenLabsApiKey }) {
  return {
    name: "elevenlabs",
    timeoutSec: 180,
    maxRetries: 1,
    prepareRequest({ prompt, durationSec }) {
      return {
        method: "POST",
        url: "https://api.elevenlabs.io/v1/music?output_format=pcm_44100",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "content-type": "application/json"
        },
        body: {
          model_id: "music_v1",
          prompt,
          music_length_ms: durationSec * 1000
        }
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

export function resolveMusicProvider({ mode = "mock", infshAppId, elevenLabsApiKey } = {}) {
  if (mode === "elevenlabs") {
    if (!elevenLabsApiKey) {
      throw new Error("elevenlabs_api_key_required");
    }
    return createElevenLabsProviderWithKey({ elevenLabsApiKey });
  }
  if (mode === "infsh") {
    if (!infshAppId) {
      throw new Error("infsh_app_id_required");
    }
    return createInfshProviderWithApp({ infshAppId });
  }
  return createMockProvider();
}
