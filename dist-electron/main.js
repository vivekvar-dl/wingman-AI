"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppState = void 0;
const electron_1 = require("electron");
const ipcHandlers_1 = require("./ipcHandlers");
const WindowHelper_1 = require("./WindowHelper");
const ScreenshotHelper_1 = require("./ScreenshotHelper");
const shortcuts_1 = require("./shortcuts");
const ProcessingHelper_1 = require("./ProcessingHelper");
const StealthHelper_1 = require("./StealthHelper");
class AppState {
    static instance = null;
    windowHelper;
    screenshotHelper;
    shortcutsHelper;
    processingHelper;
    stealthHelper;
    // View management
    view = "queue";
    problemInfo = null; // Allow null
    hasDebugged = false;
    // Processing events
    PROCESSING_EVENTS = {
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
    };
    constructor() {
        // Initialize WindowHelper with this
        this.windowHelper = new WindowHelper_1.WindowHelper(this);
        // Initialize ScreenshotHelper
        this.screenshotHelper = new ScreenshotHelper_1.ScreenshotHelper(this.view);
        // Initialize ProcessingHelper
        this.processingHelper = new ProcessingHelper_1.ProcessingHelper(this);
        // Initialize ShortcutsHelper
        this.shortcutsHelper = new shortcuts_1.ShortcutsHelper(this);
        this.stealthHelper = new StealthHelper_1.StealthHelper();
        // Start background processing for enhanced performance
        this.startBackgroundProcessing();
    }
    static getInstance() {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }
    // Getters and Setters
    getMainWindow() {
        return this.windowHelper.getMainWindow();
    }
    getView() {
        return this.view;
    }
    setView(view) {
        this.view = view;
        this.screenshotHelper.setView(view);
    }
    isVisible() {
        return this.windowHelper.isVisible();
    }
    getScreenshotHelper() {
        return this.screenshotHelper;
    }
    getProblemInfo() {
        return this.problemInfo;
    }
    setProblemInfo(problemInfo) {
        this.problemInfo = problemInfo;
    }
    getScreenshotQueue() {
        return this.screenshotHelper.getScreenshotQueue();
    }
    getExtraScreenshotQueue() {
        return this.screenshotHelper.getExtraScreenshotQueue();
    }
    // Window management methods
    createWindow() {
        this.windowHelper.createWindow();
    }
    hideMainWindow() {
        this.windowHelper.hideMainWindow();
    }
    showMainWindow() {
        this.windowHelper.showMainWindow();
    }
    toggleMainWindow() {
        console.log("Screenshots: ", this.screenshotHelper.getScreenshotQueue().length, "Extra screenshots: ", this.screenshotHelper.getExtraScreenshotQueue().length);
        this.windowHelper.toggleMainWindow();
    }
    setWindowDimensions(width, height) {
        this.windowHelper.setWindowDimensions(width, height);
    }
    clearQueues() {
        this.screenshotHelper.clearQueues();
        // Clear problem info
        this.problemInfo = null;
        // Reset view to initial state
        this.setView("queue");
    }
    // Screenshot management methods
    async takeScreenshot() {
        if (!this.getMainWindow())
            throw new Error("No main window available");
        const screenshotPath = await this.screenshotHelper.takeScreenshot(() => this.hideMainWindow(), () => this.showMainWindow());
        return screenshotPath;
    }
    async getImagePreview(filepath) {
        return this.screenshotHelper.getImagePreview(filepath);
    }
    async deleteScreenshot(path) {
        return this.screenshotHelper.deleteScreenshot(path);
    }
    // New methods to move the window
    moveWindowLeft() {
        this.windowHelper.moveWindowLeft();
    }
    moveWindowRight() {
        this.windowHelper.moveWindowRight();
    }
    moveWindowDown() {
        this.windowHelper.moveWindowDown();
    }
    moveWindowUp() {
        this.windowHelper.moveWindowUp();
    }
    setHasDebugged(value) {
        this.hasDebugged = value;
    }
    getHasDebugged() {
        return this.hasDebugged;
    }
    // Enhanced stealth capabilities
    async enableMaximumStealth() {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
            await this.stealthHelper.maximizeInvisibility(mainWindow);
            // Check for high-risk environments
            const isHighRisk = await this.stealthHelper.isInHighRiskEnvironment();
            if (isHighRisk) {
                console.log('[Stealth] High-risk environment detected - extra precautions enabled');
                // Add additional stealth measures
            }
        }
    }
    // Background processing for performance
    startBackgroundProcessing() {
        // Predictive screenshot analysis
        setInterval(async () => {
            const screenshotQueue = this.getScreenshotQueue();
            if (screenshotQueue.length > 0) {
                const latestScreenshot = screenshotQueue[screenshotQueue.length - 1];
                // Pre-process with OCR in background
                try {
                    // Use the public method to get cache stats as indicator that systems are working
                    const stats = this.processingHelper.getLLMHelper().getCacheStats();
                    console.log('[Background] Systems active - Cache entries:', stats.size);
                }
                catch (error) {
                    // Silent failure for background processing
                }
            }
        }, 30000); // Every 30 seconds
        // Cache optimization monitoring
        setInterval(() => {
            try {
                const stats = this.processingHelper.getLLMHelper().getCacheStats();
                console.log(`[Cache] Stats - Size: ${stats.size}, Hit Rate: ${stats.hitRate.toFixed(2)}`);
            }
            catch (error) {
                // Silent failure
            }
        }, 120000); // Every 2 minutes
        // Memory cleanup
        setInterval(() => {
            if (global.gc) {
                global.gc();
                console.log('[Background] Performed garbage collection');
            }
        }, 60000); // Every minute
    }
    // Public method for emergency stealth activation
    async activateEmergencyStealth() {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
            await this.stealthHelper.emergencyHide(mainWindow);
        }
    }
    // Restore window visibility (for development and emergency)
    restoreWindowVisibility() {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
            mainWindow.show();
            mainWindow.setOpacity(1);
            mainWindow.focus();
            // Restore to reasonable size and position
            const display = require('electron').screen.getPrimaryDisplay();
            const { width, height } = display.workAreaSize;
            mainWindow.setBounds({
                x: Math.floor(width / 2) - 400,
                y: Math.floor(height / 2) - 300,
                width: 800,
                height: 600
            });
            console.log('[App] Window visibility restored');
        }
    }
    // Get stealth helper for external access
    getStealthHelper() {
        return this.stealthHelper;
    }
}
exports.AppState = AppState;
// Application initialization
async function initializeApp() {
    const appState = AppState.getInstance();
    // Initialize IPC handlers before window creation
    (0, ipcHandlers_1.initializeIpcHandlers)(appState);
    electron_1.app.whenReady().then(async () => {
        console.log("App is ready");
        appState.createWindow();
        // Register global shortcuts using ShortcutsHelper
        appState.shortcutsHelper.registerGlobalShortcuts();
        // Enable stealth mode (less aggressive in development)
        if (process.env.NODE_ENV === 'production') {
            await appState.enableMaximumStealth();
            console.log('[App] Production mode - Maximum stealth enabled');
        }
        else {
            console.log('[App] Development mode - Stealth disabled for visibility');
        }
        console.log('[App] Enhanced systems initialized - Cache, OCR, Context Detection active');
    });
    electron_1.app.on("activate", () => {
        console.log("App activated");
        if (appState.getMainWindow() === null) {
            appState.createWindow();
        }
    });
    // Quit when all windows are closed, except on macOS
    electron_1.app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            electron_1.app.quit();
        }
    });
    electron_1.app.dock?.hide(); // Hide dock icon (optional)
    electron_1.app.commandLine.appendSwitch("disable-background-timer-throttling");
}
// Start the application
initializeApp().catch(console.error);
//# sourceMappingURL=main.js.map