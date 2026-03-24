import test from "node:test";
import assert from "node:assert/strict";

import {
  buildYoutubeOAuthAuthorizeUrl,
  exchangeYoutubeAuthorizationCode,
  validateYoutubeOAuthState
} from "../../src/core/publish/youtube-local-oauth.js";

test("buildYoutubeOAuthAuthorizeUrl builds a Google consent URL for offline access", () => {
  const result = buildYoutubeOAuthAuthorizeUrl({
    clientId: "client-id",
    redirectUri: "http://127.0.0.1:8787/oauth/youtube/callback",
    state: "state-123"
  });

  assert.equal(result.state, "state-123");
  assert.match(result.url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(result.url, /client_id=client-id/);
  assert.match(result.url, /redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A8787%2Foauth%2Fyoutube%2Fcallback/);
  assert.match(result.url, /access_type=offline/);
  assert.match(result.url, /response_type=code/);
  assert.match(result.url, /scope=https%3A%2F%2Fwww\.googleapis\.com%2Fauth%2Fyoutube\.upload/);
});

test("validateYoutubeOAuthState rejects mismatched state", () => {
  assert.equal(validateYoutubeOAuthState("same", "same"), true);
  assert.throws(() => validateYoutubeOAuthState("expected", "actual"), /youtube_oauth_invalid_state/);
});

test("exchangeYoutubeAuthorizationCode exchanges a code for refresh and access tokens", async () => {
  const calls = [];
  const result = await exchangeYoutubeAuthorizationCode({
    clientId: "client-id",
    clientSecret: "client-secret",
    code: "auth-code",
    redirectUri: "http://127.0.0.1:8787/oauth/youtube/callback",
    fetchImpl: async (url, init = {}) => {
      calls.push({
        url: String(url),
        method: init.method || "GET",
        body: String(init.body || "")
      });

      return new Response(
        JSON.stringify({
          access_token: "access-123",
          refresh_token: "refresh-123",
          expires_in: 3600
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].body, /grant_type=authorization_code/);
  assert.match(calls[0].body, /code=auth-code/);
  assert.equal(result.accessToken, "access-123");
  assert.equal(result.refreshToken, "refresh-123");
});

test("exchangeYoutubeAuthorizationCode fails when refresh token is missing", async () => {
  await assert.rejects(
    () =>
      exchangeYoutubeAuthorizationCode({
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "auth-code",
        redirectUri: "http://127.0.0.1:8787/oauth/youtube/callback",
        fetchImpl: async () =>
          new Response(JSON.stringify({ access_token: "access-123" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
      }),
    /youtube_oauth_missing_refresh_token/
  );
});
