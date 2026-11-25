import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { refreshActive } from './flights';
import { loadFlights } from './store';

const TASK = 'contrail-refresh-flights';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK, async () => {
    try {
      await loadFlights();
      await refreshActive();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundRefresh() {
  if (Platform.OS === 'web') return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
