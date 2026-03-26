import fs from "fs/promises";

function trimText(value) {
  return String(value ?? "").trim();
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

function describeYoutubeHttpError(prefix, status, payload) {
  const detail =
    payload?.error?.message ||
    payload?.error_description ||
    payload?.error ||
    payload?.raw ||
    "";
  const reason =
    Array.isArray(payload?.error?.errors) && payload.error.errors.length > 0
      ? payload.error.errors.map((entry) => entry?.reason).filter(Boolean).join(",")
      : "";
  return [prefix, String(status || ""), String(detail).trim(), reason].filter(Boolean).join(":");
}

export async function uploadYoutubeVideoOAuth({
  videoPath,
  title,
  description,
  tags = [],
  privacyStatus = "private",
  category = "10",
  clientId = "",
  clientSecret = "",
  refreshToken = "",
  fetchImpl = fetch
} = {}) {
  const resolvedClientId = trimText(clientId);
  const resolvedClientSecret = trimText(clientSecret);
  const resolvedRefreshToken = trimText(refreshToken);
  const resolvedVideoPath = trimText(videoPath);

  if (!resolvedClientId || !resolvedClientSecret || !resolvedRefreshToken) {
    throw new Error("missing_youtube_oauth_credentials");
  }
  if (!resolvedVideoPath) {
    throw new Error("missing_video_path");
  }

  const tokenBody = new URLSearchParams({
    client_id: resolvedClientId,
    client_secret: resolvedClientSecret,
    refresh_token: resolvedRefreshToken,
    grant_type: "refresh_token"
  });

  const tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: tokenBody.toString()
  });

  if (!tokenResponse.ok) {
    const tokenError = await parseJsonResponse(tokenResponse);
    const errorParts = [
      "youtube_token_refresh_failed",
      tokenError?.error ? String(tokenError.error) : "",
      tokenError?.error_description ? String(tokenError.error_description) : ""
    ].filter(Boolean);
    throw new Error(
      errorParts.join(":")
    );
  }

  const tokenPayload = await parseJsonResponse(tokenResponse);
  const accessToken = trimText(tokenPayload?.access_token);
  if (!accessToken) {
    throw new Error("youtube_token_refresh_failed");
  }

  const videoBytes = await fs.readFile(resolvedVideoPath);
  const initResponse = await fetchImpl(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(videoBytes.byteLength),
        "x-upload-content-type": "video/mp4"
      },
      body: JSON.stringify({
        snippet: {
          title: trimText(title),
          description: trimText(description),
          tags: Array.isArray(tags) ? tags : [],
          categoryId: trimText(category) || "10"
        },
        status: {
          privacyStatus: trimText(privacyStatus) || "private"
        }
      })
    }
  );

  if (!initResponse.ok) {
    const initError = await parseJsonResponse(initResponse);
    throw new Error(describeYoutubeHttpError("youtube_upload_init_failed", initResponse.status, initError));
  }

  const uploadUrl = initResponse.headers.get("location");
  if (!trimText(uploadUrl)) {
    throw new Error("youtube_upload_init_failed");
  }

  const uploadResponse = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "content-length": String(videoBytes.byteLength)
    },
    body: videoBytes
  });

  if (!uploadResponse.ok) {
    const uploadError = await parseJsonResponse(uploadResponse);
    throw new Error(describeYoutubeHttpError("youtube_upload_failed", uploadResponse.status, uploadError));
  }

  const uploadPayload = await parseJsonResponse(uploadResponse);
  const videoId = trimText(uploadPayload?.id);
  if (!videoId) {
    throw new Error("youtube_publish_parse_failed");
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    studioUrl: `https://studio.youtube.com/video/${videoId}/edit`
  };
}
