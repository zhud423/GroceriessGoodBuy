type BackgroundTaskRunner = () => Promise<void>

declare global {
  // eslint-disable-next-line no-var
  var __groceriesGoodBuyBackgroundTasks: Map<string, Promise<void>> | undefined
}

function getBackgroundTaskRegistry() {
  if (!globalThis.__groceriesGoodBuyBackgroundTasks) {
    globalThis.__groceriesGoodBuyBackgroundTasks = new Map<string, Promise<void>>()
  }

  return globalThis.__groceriesGoodBuyBackgroundTasks
}

export function isBackgroundTaskRunning(taskKey: string) {
  return getBackgroundTaskRegistry().has(taskKey)
}

export function startBackgroundTask(taskKey: string, runner: BackgroundTaskRunner) {
  const registry = getBackgroundTaskRegistry()

  if (registry.has(taskKey)) {
    return false
  }

  let task: Promise<void> | undefined

  task = (async () => {
    try {
      await runner()
    } catch (error) {
      console.error(`Background task failed: ${taskKey}`, error)
    } finally {
      if (registry.get(taskKey) === task) {
        registry.delete(taskKey)
      }
    }
  })()

  registry.set(taskKey, task)

  return true
}
