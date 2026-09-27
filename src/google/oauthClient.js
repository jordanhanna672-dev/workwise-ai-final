'use strict';
/**
 * Minimal OAuth2 client for Google APIs, built on Node's global fetch
 * instead of the `googleapis` npm package. This is a deliberate choice:
 * the rest of this project has zero runtime dependencies (see ADR 0001),
 * and the OAuth2 "authorization code" flow is a handful of well-documented
 * HTTP calls - not enough complexity to justify pulling in a large SDK
 * just for this one integration. See docs/adr/0004-google-integration.md.
 *
 * Scopes requested are read-only by design (see SCOPES below) - this
 * integration never sends email, creates events, or modifies anything in
 * the connected Google account.
 */
const tokenStore = require('./tokenStore');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getRedirectUri(port) {
  return process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/oauth2callback`;
}

function getAuthUrl(port) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(port),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // required to get a refresh_token back
    prompt: 'consent', // forces refresh_token on every re-auth during testing
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchanges a one-time authorization code (from the OAuth redirect) for tokens. */
async function exchangeCodeForTokens(code, port) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(port),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000;
  tokenStore.writeToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token, // only present on first consent, or with prompt=consent
    expires_at: expiresAt,
  });
  return data;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${body}`);
  }
  return res.json();
}

/** Returns a currently-valid access token, refreshing it first if it's expired or about to expire. */
async function getValidAccessToken() {
  const stored = tokenStore.readToken();
  if (!stored) return null;

  const aboutToExpire = !stored.expires_at || Date.now() > stored.expires_at - 60_000;
  if (!aboutToExpire) return stored.access_token;

  if (!stored.refresh_token) {
    throw new Error('Access token expired and no refresh token is stored - reconnect via /auth/google.');
  }
  const refreshed = await refreshAccessToken(stored.refresh_token);
  const expiresAt = Date.now() + refreshed.expires_in * 1000;
  tokenStore.writeToken({
    access_token: refreshed.access_token,
    refresh_token: stored.refresh_token, // refresh responses don't repeat the refresh_token
    expires_at: expiresAt,
  });
  return refreshed.access_token;
}

function isAuthorized() {
  return Boolean(tokenStore.readToken());
}

module.exports = { isConfigured, isAuthorized, getAuthUrl, exchangeCodeForTokens, getValidAccessToken, SCOPES };
