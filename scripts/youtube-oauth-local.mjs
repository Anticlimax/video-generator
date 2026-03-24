#!/usr/bin/env node

import http from "node:http";

import {
  buildYoutubeOAuthAuthorizeUrl,
  exchangeYoutubeAuthorizationCode,
  validateYoutubeOAuthState
} from "../src/core/publish/youtube-local-oauth.js";

function trimText(value) {
  return String(value ?? "").trim();
}

const clientId = trimText(process.env.YOUTUBE_CLIENT_ID);
const clientSecret = trimText(process.env.YOUTUBE_CLIENT_SECRET);
const port = Number(process.env.YOUTUBE_OAUTH_PORT || 8787);
const redirectUri = `http://127.0.0.1:${port}/oauth/youtube/callback`;

if (!clientId || !clientSecret) {
  console.error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET");
  process.exit(1);
}

const { url, state } = buildYoutubeOAuthAuthorizeUrl({
  clientId,
  redirectUri
});

console.log("Open this URL in your browser to authorize YouTube upload access:\n");
console.log(url);
console.log("\nWaiting for callback on:", redirectUri);

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", redirectUri);
    if (requestUrl.pathname !== "/oauth/youtube/callback") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    validateYoutubeOAuthState(state, requestUrl.searchParams.get("state"));
    const code = trimText(requestUrl.searchParams.get("code"));
    if (!code) {
      throw new Error("youtube_oauth_missing_code");
    }

    const tokens = await exchangeYoutubeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri
    });

    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("YouTube OAuth completed. Return to the terminal.");

    console.log("\nYouTube OAuth complete.\n");
    console.log(`YOUTUBE_CLIENT_ID=${clientId}`);
    console.log(`YOUTUBE_CLIENT_SECRET=${clientSecret}`);
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refreshToken}`);

    server.close(() => process.exit(0));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(`OAuth failed: ${String(error?.message || "unknown_error")}`);
    console.error(String(error?.message || "youtube_oauth_failed"));
    server.close(() => process.exit(1));
  }
});

server.listen(port, "127.0.0.1");
