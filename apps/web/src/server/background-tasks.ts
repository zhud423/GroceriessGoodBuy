type BackgroundTaskRunner = () => Promise<void>

const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000

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

export function startBackgroundTask(
  taskKey: string,
  runner: BackgroundTaskRunner,
  timeoutMs = DEFAULT_TASK_TIMEOUT_MS
) {
  const registry = getBackgroundTaskRegistry()

  if (registry.has(taskKey)) {
    return false
  }

  let task: Promise<void> | undefined

  task = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      await Promise.race([
        runner(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Background task timed out after ${timeoutMs}ms: ${taskKey}`))
          }, timeoutMs)
        })
      ])
    } catch (error) {
      console.error(`Background task failed: ${taskKey}`, error)
    } finally {
      if (timeoutId != null) {
        clearTimeout(timeoutId)
      }

      if (registry.get(taskKey) === task) {
        registry.delete(taskKey)
      }
    }
  })()

  registry.set(taskKey, task)

  return true
}
