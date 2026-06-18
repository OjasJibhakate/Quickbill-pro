/**
 * Automatic two-way Google Drive sync (Phase F, Stage 3).
 *
 * Push: every DB write schedules a debounced full-snapshot upload.
 * Pull: on app foreground and every ~20s, if the cloud snapshot changed, it is
 *       MERGED into local data (never replaced), so two devices editing at once
 *       can't overwrite each other — stock is summed from a ledger, dues and
 *       payables are recomputed, deletes propagate via tombstones.
 */
import { AppState, AppStateStatus } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  isDriveConfigured,
  driveBackup,
  driveRestore,
  getRemoteMeta,
  driveRestoreSession,
} from './drivesync';
import { setOnWrite } from '@/database';
import { emitRefresh } from './syncbus';

const PUSH_DELAY_MS = 4000;
const POLL_MS = 20000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pending = false;
let pushing = false;
let pulling = false;
let applyingRemote = false;
let started = false;
let lastModified: string | null = null;

function signedIn(): boolean {
  return isDriveConfigured() && !!GoogleSignin.getCurrentUser();
}

/** Debounced background upload after local changes. */
function scheduleAutoBackup(): void {
  if (applyingRemote) return; // a merge is writing — don't echo it back up
  if (!isDriveConfigured()) return;
  pending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(runPush, PUSH_DELAY_MS);
}

async function runPush(): Promise<void> {
  pushTimer = null;
  if (!pending || pushing || pulling || !signedIn()) return;
  pending = false;
  pushing = true;
  try {
    await driveBackup();
    const meta = await getRemoteMeta();
    if (meta) lastModified = meta.modifiedTime; // our own push — don't pull it back
  } catch {
    pending = true; // offline or token expired — retry on the next change
  } finally {
    pushing = false;
  }
}

/** Pull + merge if another device changed the cloud snapshot. */
async function pullIfChanged(): Promise<void> {
  if (!signedIn() || pushing || pulling) return;
  try {
    const meta = await getRemoteMeta();
    if (!meta) return;
    if (lastModified !== null && meta.modifiedTime === lastModified) return; // nothing new
    pulling = true;
    applyingRemote = true;
    try {
      const r = await driveRestore(); // merge, never replace
      lastModified = meta.modifiedTime;
      if (r.found) emitRefresh();
    } finally {
      applyingRemote = false;
      pulling = false;
    }
  } catch {
    /* offline — try again next tick */
  }
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(pullIfChanged, POLL_MS);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Wire DB writes to background upload and start live pull. Call once at app start. */
export function initAutoSync(): void {
  if (started) return;
  started = true;
  setOnWrite(scheduleAutoBackup);

  // Restore the Google session, then do an initial pull and start polling.
  driveRestoreSession()
    .then(() => {
      pullIfChanged();
      startPolling();
    })
    .catch(() => {});

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') {
      pullIfChanged();
      startPolling();
    } else {
      stopPolling();
    }
  });
}
