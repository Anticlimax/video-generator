import { randomUUID } from "node:crypto";

const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

function trimText(value) {
  return String(value ?? "").trim();
}

export function buildYoutubeOAuthAuthorizeUrl({
  clientId,
  redirectUri,
  state = randomUUID()
} = {}) {
  const resolvedClientId = trimText(clientId);
  const resolvedRedirectUri = trimText(redirectUri);

  if (!resolvedClientId || !resolvedRedirectUri) {
    throw new Error("youtube_oauth_missing_client_config");
  }

  const params = new URLSearchParams({
    client_id: resolvedClientId,
    redirect_uri: resolvedRedirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: YOUTUBE_UPLOAD_SCOPE,
    state
  });

  return {
    state,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export function validateYoutubeOAuthState(expectedState, actualState) {
  if (trimText(expectedState) !== trimText(actualState)) {
    throw new Error("youtube_oauth_invalid_state");
  }
  return true;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function exchangeYoutubeAuthorizationCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
  fetchImpl = fetch
} = {}) {
  const resolvedClientId = trimText(clientId);
  const resolvedClientSecret = trimText(clientSecret);
  const resolvedCode = trimText(code);
  const resolvedRedirectUri = trimText(redirectUri);

  if (!resolvedClientId || !resolvedClientSecret || !resolvedCode || !resolvedRedirectUri) {
    throw new Error("youtube_oauth_missing_exchange_input");
  }

  const body = new URLSearchParams({
    client_id: resolvedClientId,
    client_secret: resolvedClientSecret,
    code: resolvedCode,
    grant_type: "authorization_code",
    redirect_uri: resolvedRedirectUri
  });

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    throw new Error(
      `youtube_oauth_exchange_failed${payload?.error ? `:${String(payload.error)}` : ""}`
    );
  }

  const payload = await parseJsonResponse(response);
  const accessToken = trimText(payload?.access_token);
  const refreshToken = trimText(payload?.refresh_token);

  if (!refreshToken) {
    throw new Error("youtube_oauth_missing_refresh_token");
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: Number(payload?.expires_in || 0) || null
  };
}
