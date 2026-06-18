/**
 * Automatic background backup (Phase F, Stage 2+).
 *
 * Every DB write schedules a debounced upload of the snapshot to the user's
 * Drive appDataFolder, so the cloud copy stays current with zero taps. This is
 * push-only: it never overwrites local data, so it cannot lose anything.
 *
 * Pulling another device's data stays a deliberate action ("Restore from
 * Drive") until the record-level merge lands — auto-replacing the local DB is
 * unsafe without it (a device could clobber un-pushed local changes).
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { isDriveConfigured, driveBackup, driveRestoreSession } from './drivesync';
import { setOnWrite } from '@/database';

const PUSH_DELAY_MS = 4000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending = false;
let pushing = false;
let started = false;

function signedIn(): boolean {
  return isDriveConfigured() && !!GoogleSignin.getCurrentUser();
}

function scheduleAutoBackup(): void {
  if (!isDriveConfigured()) return;
  pending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(runPush, PUSH_DELAY_MS);
}

async function runPush(): Promise<void> {
  pushTimer = null;
  if (!pending || pushing || !signedIn()) return;
  pending = false;
  pushing = true;
  try {
    await driveBackup();
  } catch {
    pending = true; // offline or token expired — retry on the next change
  } finally {
    pushing = false;
  }
}

/** Wire DB writes to a debounced background Drive upload. Call once at app start. */
export function initAutoSync(): void {
  if (started) return;
  started = true;
  setOnWrite(scheduleAutoBackup);
  // Restore the Google session so background pushes can authenticate even if
  // the user never opens the Backup screen this session.
  driveRestoreSession().catch(() => {});
}
