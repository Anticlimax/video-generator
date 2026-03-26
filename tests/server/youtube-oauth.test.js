import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { uploadYoutubeVideoOAuth } from "../../src/core/publish/youtube-oauth.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-youtube-oauth-"));
}

test("uploadYoutubeVideoOAuth fails when oauth credentials are missing", async () => {
  const rootDir = makeTempDir();
  const videoPath = path.join(rootDir, "video.mp4");
  fs.writeFileSync(videoPath, "video");

  await assert.rejects(
    () =>
      uploadYoutubeVideoOAuth({
        videoPath,
        title: "storm city",
        description: "ambient storm city",
        tags: ["storm city"],
        privacyStatus: "private",
        category: "10"
      }),
    /missing_youtube_oauth_credentials/
  );
});

test("uploadYoutubeVideoOAuth refreshes a token and uploads a video", async () => {
  const rootDir = makeTempDir();
  const videoPath = path.join(rootDir, "video.mp4");
  fs.writeFileSync(videoPath, "video-bytes");

  const calls = [];
  const result = await uploadYoutubeVideoOAuth({
    videoPath,
    title: "storm city",
    description: "ambient storm city",
    tags: ["storm city", "cinematic storm ambience"],
    privacyStatus: "private",
    category: "10",
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImpl: async (url, init = {}) => {
      calls.push({
        url,
        method: init.method || "GET",
        headers: Object.fromEntries(new Headers(init.headers || {}).entries()),
        body: init.body
      });

      if (String(url) === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "access-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (String(url).startsWith("https://www.googleapis.com/upload/youtube/v3/videos?")) {
        return new Response("", {
          status: 200,
          headers: { location: "https://upload.youtube.test/resumable/abc" }
        });
      }

      if (String(url) === "https://upload.youtube.test/resumable/abc") {
        return new Response(JSON.stringify({ id: "yt-abc123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      throw new Error(`unexpected_request:${url}`);
    }
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(calls[0].method, "POST");
  assert.match(String(calls[0].body), /client_id=client-id/);
  assert.match(String(calls[0].body), /refresh_token=refresh-token/);

  assert.match(calls[1].url, /uploadType=resumable/);
  assert.match(calls[1].url, /part=snippet%2Cstatus|part=snippet,status/);
  assert.equal(calls[1].headers.authorization, "Bearer access-123");

  const initPayload = JSON.parse(String(calls[1].body));
  assert.equal(initPayload.snippet.title, "storm city");
  assert.equal(initPayload.status.privacyStatus, "private");

  assert.equal(calls[2].url, "https://upload.youtube.test/resumable/abc");
  assert.equal(calls[2].method, "PUT");
  assert.equal(calls[2].headers["content-type"], "video/mp4");

  assert.equal(result.videoId, "yt-abc123");
  assert.equal(result.url, "https://www.youtube.com/watch?v=yt-abc123");
  assert.equal(result.studioUrl, "https://studio.youtube.com/video/yt-abc123/edit");
});

test("uploadYoutubeVideoOAuth fails when token refresh fails", async () => {
  const rootDir = makeTempDir();
  const videoPath = path.join(rootDir, "video.mp4");
  fs.writeFileSync(videoPath, "video");

  await assert.rejects(
    () =>
      uploadYoutubeVideoOAuth({
        videoPath,
        title: "storm city",
        description: "ambient storm city",
        tags: ["storm city"],
        privacyStatus: "private",
        category: "10",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), {
            status: 400,
            headers: { "content-type": "application/json" }
          })
      }),
    /youtube_token_refresh_failed:invalid_grant:Token has been expired or revoked\./
  );
});

test("uploadYoutubeVideoOAuth surfaces init upload failure details", async () => {
  const rootDir = makeTempDir();
  const videoPath = path.join(rootDir, "video.mp4");
  fs.writeFileSync(videoPath, "video");

  await assert.rejects(
    () =>
      uploadYoutubeVideoOAuth({
        videoPath,
        title: "storm city",
        description: "ambient storm city",
        tags: ["storm city"],
        privacyStatus: "private",
        category: "10",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
        fetchImpl: async (url) => {
          if (String(url) === "https://oauth2.googleapis.com/token") {
            return new Response(JSON.stringify({ access_token: "access-123" }), {
              status: 200,
              headers: { "content-type": "application/json" }
            });
          }

          return new Response(
            JSON.stringify({
              error: {
                code: 403,
                message: "The request cannot be completed because you have exceeded your quota.",
                errors: [{ reason: "quotaExceeded" }]
              }
            }),
            {
              status: 403,
              headers: { "content-type": "application/json" }
            }
          );
        }
      }),
    /youtube_upload_init_failed:403:.*quotaExceeded/
  );
});
