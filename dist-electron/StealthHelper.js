"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthHelper = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
class StealthHelper {
    config;
    originalWindowState = {};
    behaviorRandomizer = null;
    constructor(config = {
        invisibilityLevel: 'maximum',
        antiDetection: true,
        resourceMinimization: true,
        randomizedBehavior: true
    }) {
        this.config = config;
    }
    async maximizeInvisibility(window) {
        console.log('[Stealth] Applying maximum invisibility...');
        // Store original state for potential restoration
        this.originalWindowState = {
            bounds: window.getBounds(),
            alwaysOnTop: window.isAlwaysOnTop()
        };
        // Apply invisibility techniques
        await this.applyWindowStealth(window);
        await this.applyProcessStealth();
        if (this.config.randomizedBehavior) {
            this.startBehaviorRandomization();
        }
    }
    async applyWindowStealth(window) {
        try {
            // Advanced window hiding
            window.setSkipTaskbar(true);
            window.setAlwaysOnTop(true, 'screen-saver', 1);
            // Make window appear on all workspaces
            if (process.platform === 'darwin') {
                window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            }
            // Only apply maximum invisibility in production or when explicitly requested
            if (this.config.invisibilityLevel === 'maximum' && process.env.NODE_ENV === 'production') {
                // Position window strategically
                const display = electron_1.screen.getPrimaryDisplay();
                const { width, height } = display.workAreaSize;
                // Position in corner where it's least likely to be noticed
                window.setBounds({
                    x: width - 50,
                    y: height - 50,
                    width: 1,
                    height: 1
                });
                // Make window completely transparent when not in use
                window.setOpacity(0.01);
            }
            else {
                // Development mode - keep window visible but stealthy
                window.setOpacity(0.95); // Slightly transparent but visible
                console.log('[Stealth] Development mode - keeping window visible');
            }
            // Advanced platform-specific hiding (only in production)
            if (process.env.NODE_ENV === 'production') {
                if (process.platform === 'win32') {
                    await this.applyWindowsAdvancedHiding(window);
                }
                else if (process.platform === 'darwin') {
                    await this.applyMacOSAdvancedHiding();
                }
            }
        }
        catch (error) {
            console.error('[Stealth] Failed to apply window stealth:', error);
        }
    }
    async applyWindowsAdvancedHiding(window) {
        try {
            // Hide from Alt+Tab switcher
            const nativeWindow = window.getNativeWindowHandle();
            // Simplified PowerShell command to avoid null byte issues
            const hideScript = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong); [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex); public const int GWL_EXSTYLE = -20; public const int WS_EX_TOOLWINDOW = 0x00000080; }'; $style = [Win32]::GetWindowLong([IntPtr]${nativeWindow}, -20); [Win32]::SetWindowLong([IntPtr]${nativeWindow}, -20, $style -bor 0x00000080)`;
            (0, child_process_1.execSync)(`powershell -Command "${hideScript}"`, { timeout: 5000 });
            console.log('[Stealth] Applied Windows advanced hiding');
        }
        catch (error) {
            console.error('[Stealth] Windows advanced hiding failed:', error);
        }
    }
    async applyMacOSAdvancedHiding() {
        try {
            // Hide from Dock and Mission Control
            electron_1.app.dock?.hide();
            // Use AppleScript for additional hiding
            const hideScript = `
        tell application "System Events"
          set visible of application process "Electron" to false
        end tell
      `;
            (0, child_process_1.execSync)(`osascript -e '${hideScript}'`, { timeout: 5000 });
            console.log('[Stealth] Applied macOS advanced hiding');
        }
        catch (error) {
            console.error('[Stealth] macOS advanced hiding failed:', error);
        }
    }
    async applyProcessStealth() {
        if (!this.config.antiDetection)
            return;
        try {
            // Minimize process visibility
            process.title = 'System Process';
            // Reduce process priority to minimize detection
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)('wmic process where name="electron.exe" CALL setpriority "below normal"', { timeout: 3000 });
            }
            else if (process.platform === 'darwin' || process.platform === 'linux') {
                (0, child_process_1.execSync)(`renice +10 ${process.pid}`, { timeout: 3000 });
            }
            // Limit resource usage
            if (this.config.resourceMinimization) {
                this.applyResourceLimits();
            }
            console.log('[Stealth] Applied process stealth');
        }
        catch (error) {
            console.error('[Stealth] Process stealth failed:', error);
        }
    }
    applyResourceLimits() {
        try {
            // Limit memory usage
            if (global.gc) {
                setInterval(() => {
                    global.gc();
                }, 30000); // Garbage collect every 30 seconds
            }
            // Throttle CPU usage
            process.nextTick(() => {
                // Yield control to prevent high CPU usage
                setTimeout(() => { }, 1);
            });
            console.log('[Stealth] Applied resource limits');
        }
        catch (error) {
            console.error('[Stealth] Resource limiting failed:', error);
        }
    }
    startBehaviorRandomization() {
        if (this.behaviorRandomizer) {
            clearInterval(this.behaviorRandomizer);
        }
        // Randomize behavior patterns to avoid detection
        this.behaviorRandomizer = setInterval(() => {
            const behaviors = [
                () => this.randomDelay(),
                () => this.varyProcessPriority(),
                () => this.randomMemoryCleanup()
            ];
            const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
            randomBehavior();
        }, 60000 + Math.random() * 120000); // Random interval between 1-3 minutes
    }
    async randomDelay() {
        const delay = Math.random() * 200 + 50; // 50-250ms random delay
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    varyProcessPriority() {
        try {
            const priorities = ['below normal', 'normal', 'above normal'];
            const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)(`wmic process where name="electron.exe" CALL setpriority "${randomPriority}"`, { timeout: 3000 });
            }
        }
        catch (error) {
            // Ignore errors in priority changes
        }
    }
    randomMemoryCleanup() {
        if (Math.random() > 0.7 && global.gc) {
            global.gc();
        }
    }
    async createStealthScreenshot(window) {
        try {
            // Temporarily make window visible for screenshot
            const originalOpacity = window.getOpacity();
            window.setOpacity(1);
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
            const screenshot = await window.capturePage();
            // Restore stealth state
            window.setOpacity(originalOpacity);
            return screenshot.toPNG();
        }
        catch (error) {
            console.error('[Stealth] Screenshot capture failed:', error);
            throw error;
        }
    }
    async detectScreenRecording() {
        try {
            if (process.platform === 'darwin') {
                // Check for screen recording on macOS
                const result = (0, child_process_1.execSync)('system_profiler SPDisplaysDataType | grep Resolution', { encoding: 'utf8' });
                return result.includes('Recording');
            }
            else if (process.platform === 'win32') {
                // Check for screen recording on Windows
                const result = (0, child_process_1.execSync)('tasklist | findstr /i "obs\\|bandicam\\|camtasia\\|fraps"', { encoding: 'utf8' });
                return result.length > 0;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async isInHighRiskEnvironment() {
        try {
            const risks = await Promise.all([
                this.detectExamSoftware(),
                this.detectScreenRecording(),
                this.detectRemoteAccess()
            ]);
            return risks.some(risk => risk);
        }
        catch {
            return false;
        }
    }
    async detectExamSoftware() {
        try {
            const examSoftware = [
                'proctorio', 'respondus', 'lockdown', 'examplify', 'honorlock',
                'proctortrack', 'examity', 'proctor360', 'examsoft'
            ];
            if (process.platform === 'win32') {
                for (const software of examSoftware) {
                    try {
                        const result = (0, child_process_1.execSync)(`tasklist | findstr /i "${software}"`, { encoding: 'utf8', timeout: 2000 });
                        if (result.length > 0)
                            return true;
                    }
                    catch {
                        continue;
                    }
                }
            }
            else if (process.platform === 'darwin') {
                for (const software of examSoftware) {
                    try {
                        const result = (0, child_process_1.execSync)(`ps aux | grep -i "${software}"`, { encoding: 'utf8', timeout: 2000 });
                        if (result.length > 0)
                            return true;
                    }
                    catch {
                        continue;
                    }
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async detectRemoteAccess() {
        try {
            const remoteTools = ['teamviewer', 'anydesk', 'chrome remote', 'rdp', 'vnc'];
            if (process.platform === 'win32') {
                for (const tool of remoteTools) {
                    try {
                        const result = (0, child_process_1.execSync)(`netstat -an | findstr ":3389\\|:5900"`, { encoding: 'utf8', timeout: 2000 });
                        if (result.length > 0)
                            return true;
                    }
                    catch {
                        continue;
                    }
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async emergencyHide(window) {
        console.log('[Stealth] EMERGENCY HIDE ACTIVATED');
        try {
            window.hide();
            window.setOpacity(0);
            if (process.platform === 'darwin') {
                electron_1.app.dock?.hide();
            }
            // Wait in hidden state
            await new Promise(resolve => setTimeout(resolve, 5000));
            console.log('[Stealth] Emergency hide completed');
        }
        catch (error) {
            console.error('[Stealth] Emergency hide failed:', error);
        }
    }
    destroy() {
        if (this.behaviorRandomizer) {
            clearInterval(this.behaviorRandomizer);
            this.behaviorRandomizer = null;
        }
        console.log('[Stealth] Stealth helper destroyed');
    }
}
exports.StealthHelper = StealthHelper;
//# sourceMappingURL=StealthHelper.js.map