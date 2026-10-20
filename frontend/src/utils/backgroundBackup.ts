import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';
import { EncodingType } from 'expo-file-system/src/legacy/FileSystem.types';
import { expoDb } from '../db/client';
import { performExportBackup } from '../db/export';

export const BACKGROUND_BACKUP_TASK = 'BACKGROUND_BACKUP_TASK';

TaskManager.defineTask(BACKGROUND_BACKUP_TASK, async () => {
  try {
    const now = new Date();
    // Check if it's 8 PM (20:00) or later
    if (now.getHours() < 20) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check if auto backup is enabled
    let autoBackupEnabled = false;
    let autoBackupUri = '';
    let lastBackupDate = '';

    try {
      const enabledRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'auto_backup_enabled'");
      if (enabledRow?.value === 'true') autoBackupEnabled = true;

      const uriRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'auto_backup_uri'");
      if (uriRow?.value) autoBackupUri = uriRow.value;

      const lastDateRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'last_auto_backup_date'");
      if (lastDateRow?.value) lastBackupDate = lastDateRow.value;
    } catch (e) {
      // Table might not be ready or settings missing
      console.log('Background backup: settings not found or db not ready');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (!autoBackupEnabled || !autoBackupUri) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const todayStr = now.toISOString().split('T')[0];
    if (lastBackupDate === todayStr) {
      // Already backed up today
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Perform backup
    const backup = await performExportBackup();
    const backupString = JSON.stringify(backup, null, 2);
    
    // File name: wealthflow_auto_backup_YYYY-MM-DD.json
    const fileName = `wealthflow_auto_backup_${todayStr}.json`;
    
    // StorageAccessFramework to create the file
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      autoBackupUri,
      fileName,
      'application/json'
    );

    // Write content
    await FileSystem.writeAsStringAsync(fileUri, backupString, {
      encoding: EncodingType.UTF8,
    });

    // Update last backup date in database
    expoDb.execSync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_auto_backup_date', '${todayStr}');`);

    console.log('Background backup completed successfully at', new Date().toISOString());
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background backup task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundBackup() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_BACKUP_TASK, {
      minimumInterval: 60 * 60, // 1 hour checks
      stopOnTerminate: false, // android only
      startOnBoot: true,      // android only
    });
    console.log('Background backup task registered');
  } catch (err) {
    console.log('Task Register failed:', err);
  }
}

export async function unregisterBackgroundBackup() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_BACKUP_TASK);
      console.log('Background backup task unregistered');
    }
  } catch (err) {
    console.log('Task Unregister failed:', err);
  }
}

export async function checkAndRegisterBackgroundBackupIfNeeded() {
  try {
    const enabledRow = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'auto_backup_enabled'");
    const autoBackupEnabled = enabledRow?.value === 'true';
    if (autoBackupEnabled) {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
      if (!isRegistered) {
        await registerBackgroundBackup();
      }
    }
  } catch (err) {
    console.log('Failed to check/register background backup on startup:', err);
  }
}
