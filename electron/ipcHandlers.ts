// ipcHandlers.ts

import { ipcMain, app } from "electron"
import { spawn, ChildProcess } from "child_process"
import path from "path"
import { AppState } from "./main"

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing text questions
  ipcMain.handle("analyze-text-question", async (event, question: string, isSmartMode: boolean = true) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeTextQuestion(question, isSmartMode)
      return result
    } catch (error: any) {
      console.error("Error in analyze-text-question handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing screen with a question
  ipcMain.handle("analyze-screen-with-question", async (event, imagePath: string, question: string, isSmartMode: boolean = true) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeScreenWithQuestion(imagePath, question, isSmartMode)
      return result
    } catch (error: any) {
      console.error("Error in analyze-screen-with-question handler:", error)
      throw error
    }
  })

  ipcMain.handle("transcribe-audio", (event, wavBase64: string) =>
    appState.processingHelper.getLLMHelper().transcribeAudio(wavBase64)
  )

  // System audio (the other side of the call) via audiotee: a Core Audio process tap, macOS 14.2+.
  // Streams 16kHz mono s16le PCM on stdout; we relay it to the renderer for VAD.
  let audiotee: ChildProcess | null = null
  ipcMain.handle("system-audio-start", (event) => {
    if (process.platform !== "darwin" || audiotee) return false
    const bin = path
      .join(app.getAppPath(), "node_modules/audiotee/bin/audiotee")
      .replace("app.asar", "app.asar.unpacked")
    const proc = spawn(bin, ["--sample-rate", "16000", "--chunk-duration", "0.05"])
    audiotee = proc
    let carry = Buffer.alloc(0) // a pipe read can split a 2-byte sample
    proc.stdout.on("data", (data: Buffer) => {
      const buf = Buffer.concat([carry, data])
      const even = buf.length & ~1
      carry = buf.subarray(even)
      if (!event.sender.isDestroyed()) event.sender.send("system-audio-data", buf.subarray(0, even))
    })
    proc.stderr.on("data", (data: Buffer) => {
      if (data.includes('"error"')) console.error("[audiotee]", data.toString().trim())
    })
    proc.on("error", (error) => console.error("[audiotee] failed to start:", error))
    proc.on("exit", () => {
      if (audiotee === proc) audiotee = null
    })
    return true
  })
  ipcMain.handle("system-audio-stop", () => {
    const proc = audiotee
    audiotee = null
    proc?.kill()
    // audiotee can ignore SIGTERM; never leave it capturing in the background
    setTimeout(() => proc?.kill("SIGKILL"), 2000)
  })
  app.on("will-quit", () => audiotee?.kill("SIGKILL"))

  ipcMain.handle("quit-app", () => {
    app.quit()
  })
}
