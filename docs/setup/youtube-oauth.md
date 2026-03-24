# YouTube OAuth Setup

## Goal

Configure the web app's in-repo Node uploader so it can publish directly to YouTube without the legacy local Python helper.

## Required Environment Variables

Set these on the deployment host:

```bash
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REFRESH_TOKEN=your_google_oauth_refresh_token
```

The uploader uses:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

## OAuth Flow

1. Create a Google OAuth client for a desktop or web app in Google Cloud Console.
2. Enable YouTube Data API v3 for the project.
3. Run a one-time OAuth consent flow against that client.
4. Capture the returned **refresh token**.
5. Save that refresh token into `YOUTUBE_REFRESH_TOKEN`.

The refresh token is the long-lived credential the server uses to mint short-lived access tokens at upload time.

## Notes

- Do not expose the client secret or refresh token in browser code.
- Restart the app after changing environment variables.
- The `/integrations` page only shows whether each variable is configured or missing.
