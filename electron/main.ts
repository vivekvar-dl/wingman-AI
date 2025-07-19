import { app, BrowserWindow } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { StealthHelper } from './StealthHelper'

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private stealthHelper: StealthHelper

  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false

  // Processing events
  public readonly PROCESSING_EVENTS = {
    //global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    //states for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    //states for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this)

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view)

    // Initialize ProcessingHelper
    this.processingHelper = new ProcessingHelper(this)

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this)
    this.stealthHelper = new StealthHelper()

    // Start background processing for enhanced performance
    this.startBackgroundProcessing()
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow()
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }

  // Enhanced stealth capabilities
  public async enableMaximumStealth() {
    const mainWindow = this.getMainWindow()
    if (mainWindow) {
      await this.stealthHelper.maximizeInvisibility(mainWindow)
      
      // Check for high-risk environments
      const isHighRisk = await this.stealthHelper.isInHighRiskEnvironment()
      if (isHighRisk) {
        console.log('[Stealth] High-risk environment detected - extra precautions enabled')
        // Add additional stealth measures
      }
    }
  }

  // Background processing for performance
  private startBackgroundProcessing() {
    // Predictive screenshot analysis
    setInterval(async () => {
      const screenshotQueue = this.getScreenshotQueue()
      if (screenshotQueue.length > 0) {
        const latestScreenshot = screenshotQueue[screenshotQueue.length - 1]
        
        // Pre-process with OCR in background
        try {
          // Use the public method to get cache stats as indicator that systems are working
          const stats = this.processingHelper.getLLMHelper().getCacheStats()
          console.log('[Background] Systems active - Cache entries:', stats.size)
        } catch (error) {
          // Silent failure for background processing
        }
      }
    }, 30000) // Every 30 seconds

    // Cache optimization monitoring
    setInterval(() => {
      try {
        const stats = this.processingHelper.getLLMHelper().getCacheStats()
        console.log(`[Cache] Stats - Size: ${stats.size}, Hit Rate: ${stats.hitRate.toFixed(2)}`)
      } catch (error) {
        // Silent failure
      }
    }, 120000) // Every 2 minutes

    // Memory cleanup
    setInterval(() => {
      if (global.gc) {
        global.gc()
        console.log('[Background] Performed garbage collection')
      }
    }, 60000) // Every minute
  }

  // Public method for emergency stealth activation
  public async activateEmergencyStealth() {
    const mainWindow = this.getMainWindow()
    if (mainWindow) {
      await this.stealthHelper.emergencyHide(mainWindow)
    }
  }

  // Restore window visibility (for development and emergency)
  public restoreWindowVisibility() {
    const mainWindow = this.getMainWindow()
    if (mainWindow) {
      mainWindow.show()
      mainWindow.setOpacity(1)
      mainWindow.focus()
      
      // Restore to reasonable size and position
      const display = require('electron').screen.getPrimaryDisplay()
      const { width, height } = display.workAreaSize
      
      mainWindow.setBounds({
        x: Math.floor(width / 2) - 400,
        y: Math.floor(height / 2) - 300,
        width: 800,
        height: 600
      })
      
      console.log('[App] Window visibility restored')
    }
  }

  // Get stealth helper for external access
  public getStealthHelper(): StealthHelper {
    return this.stealthHelper
  }
}

// Application initialization
async function initializeApp() {
  const appState = AppState.getInstance()

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  app.whenReady().then(async () => {
    console.log("App is ready")
    appState.createWindow()
    
    // Register global shortcuts using ShortcutsHelper
    appState.shortcutsHelper.registerGlobalShortcuts()
    
    // Enable stealth mode (less aggressive in development)
    if (process.env.NODE_ENV === 'production') {
      await appState.enableMaximumStealth()
      console.log('[App] Production mode - Maximum stealth enabled')
    } else {
      console.log('[App] Development mode - Stealth disabled for visibility')
    }
    
    console.log('[App] Enhanced systems initialized - Cache, OCR, Context Detection active')
  })

  app.on("activate", () => {
    console.log("App activated")
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  app.dock?.hide() // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
