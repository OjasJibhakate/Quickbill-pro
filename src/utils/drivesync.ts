/**
 * Google Drive sync (Phase F, Stage 2).
 *
 * Stores one snapshot file (the same JSON as the local Backup feature) in the
 * user's Drive **appDataFolder** — a hidden, app-private folder that:
 *   - never clutters their Drive (invisible in the Drive UI),
 *   - is scoped to this app via the non-sensitive `drive.appdata` scope, and
 *   - syncs across devices for the same Google account.
 *
 * This removes the "save to Drive then star the file" hack from Stage 1.
 *
 * Requires a native build (Google Sign-In can't run in Expo Go) and a Web
 * OAuth client id in app.json -> extra.googleWebClientId.
 */
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { snapshotToJson, mergeSnapshot } from '@/database/backup';
import { isRestaurant } from '@/utils/mode';

// Separate cloud file per flavor so a restaurant and a shop signed into the
// same Google account never overwrite each other's snapshot.
const FILE_NAME = isRestaurant ? 'quickserve-snapshot.json' : 'quickbill-snapshot.json';
const APPDATA = 'appDataFolder';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const OWNER_EMAIL_KEY = 'qbp_owner_google_email';

async function rememberEmail(email: string) {
  try {
    await AsyncStorage.setItem(OWNER_EMAIL_KEY, email);
  } catch {
    /* ignore */
  }
}

/** The Google account linked to this shop, used to authorize PIN recovery. */
export async function getRecoveryEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(OWNER_EMAIL_KEY);
  } catch {
    return null;
  }
}

const webClientId = ((Constants.expoConfig?.extra as any)?.googleWebClientId as string) || '';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId,
    scopes: [DRIVE_SCOPE],
    offlineAccess: false,
  });
  configured = true;
}

/** True once a real Web client id is set in app.json -> extra.googleWebClientId. */
export function isDriveConfigured(): boolean {
  return webClientId.length > 0 && !webClientId.startsWith('REPLACE_WITH');
}

/** Restore a previous session without UI; returns the email or null. */
export async function driveRestoreSession(): Promise<string | null> {
  if (!isDriveConfigured()) return null;
  ensureConfigured();
  try {
    const current = GoogleSignin.getCurrentUser();
    if (current) {
      await rememberEmail(current.user.email);
      return current.user.email;
    }
    const res = await GoogleSignin.signInSilently();
    if (res.type === 'success') {
      await rememberEmail(res.data.user.email);
      return res.data.user.email;
    }
    return null;
  } catch {
    return null;
  }
}

/** Interactive sign in; returns the email. Throws 'cancelled' if dismissed. */
export async function driveSignIn(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) throw new Error('cancelled');
  await rememberEmail(res.data.user.email);
  return res.data.user.email;
}

/**
 * Forces the Google account picker (signs out first so a cached session can't
 * silently authorize) and returns the chosen email WITHOUT saving it as the
 * shop account. Used to verify identity for PIN recovery.
 */
export async function verifyGoogleAccount(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    await GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) throw new Error('cancelled');
  return res.data.user.email;
}

export async function driveSignOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
}

async function getAccessToken(): Promise<string> {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

async function findSnapshotId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=${APPDATA}&q=${q}&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

/** Cheap check of the snapshot's last-modified time (for live polling). */
export async function getRemoteMeta(): Promise<{ id: string; modifiedTime: string } | null> {
  if (!isDriveConfigured() || !GoogleSignin.getCurrentUser()) return null;
  ensureConfigured();
  const token = await getAccessToken();
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=${APPDATA}&q=${q}&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string; modifiedTime: string }[] };
  const f = data.files?.[0];
  return f ? { id: f.id, modifiedTime: f.modifiedTime } : null;
}

/** Upload the current DB snapshot to appDataFolder (create or overwrite). */
export async function driveBackup(): Promise<void> {
  ensureConfigured();
  const token = await getAccessToken();
  const json = await snapshotToJson();
  const existingId = await findSnapshotId(token);

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: json,
      }
    );
    if (!res.ok) throw new Error(`Drive update failed (${res.status})`);
  } else {
    const boundary = 'qbp_' + Date.now();
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: FILE_NAME, parents: [APPDATA] }) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      json +
      `\r\n--${boundary}--`;
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
  }
}

/** Download the snapshot from Drive and replace local data. */
export async function driveRestore(): Promise<{ found: boolean; rows: number }> {
  ensureConfigured();
  const token = await getAccessToken();
  const id = await findSnapshotId(token);
  if (!id) return { found: false, rows: 0 };
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const json = await res.text();
  const summary = await mergeSnapshot(json);
  return { found: true, rows: summary.rows };
}
