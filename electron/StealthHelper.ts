import { BrowserWindow, app, screen } from 'electron'
import { execSync } from 'child_process'

interface StealthConfig {
  invisibilityLevel: 'minimal' | 'standard' | 'maximum'
  antiDetection: boolean
  resourceMinimization: boolean
  randomizedBehavior: boolean
}

export class StealthHelper {
  private config: StealthConfig
  private originalWindowState: any = {}
  private behaviorRandomizer: NodeJS.Timeout | null = null

  constructor(config: StealthConfig = {
    invisibilityLevel: 'maximum',
    antiDetection: true,
    resourceMinimization: true,
    randomizedBehavior: true
  }) {
    this.config = config
  }

  public async maximizeInvisibility(window: BrowserWindow): Promise<void> {
    console.log('[Stealth] Applying maximum invisibility...')
    
    // Store original state for potential restoration
    this.originalWindowState = {
      bounds: window.getBounds(),
      alwaysOnTop: window.isAlwaysOnTop()
    }

    // Apply invisibility techniques
    await this.applyWindowStealth(window)
    await this.applyProcessStealth()
    
    if (this.config.randomizedBehavior) {
      this.startBehaviorRandomization()
    }
  }

  private async applyWindowStealth(window: BrowserWindow): Promise<void> {
    try {
      // Advanced window hiding
      window.setSkipTaskbar(true)
      window.setAlwaysOnTop(true, 'screen-saver', 1)
      
      // Make window appear on all workspaces
      if (process.platform === 'darwin') {
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      }

      // Only apply maximum invisibility in production or when explicitly requested
      if (this.config.invisibilityLevel === 'maximum' && process.env.NODE_ENV === 'production') {
        // Position window strategically
        const display = screen.getPrimaryDisplay()
        const { width, height } = display.workAreaSize
        
        // Position in corner where it's least likely to be noticed
        window.setBounds({
          x: width - 50,
          y: height - 50,
          width: 1,
          height: 1
        })

        // Make window completely transparent when not in use
        window.setOpacity(0.01)
      } else {
        // Development mode - keep window visible but stealthy
        window.setOpacity(0.95) // Slightly transparent but visible
        console.log('[Stealth] Development mode - keeping window visible')
      }

      // Advanced platform-specific hiding (only in production)
      if (process.env.NODE_ENV === 'production') {
        if (process.platform === 'win32') {
          await this.applyWindowsAdvancedHiding(window)
        } else if (process.platform === 'darwin') {
          await this.applyMacOSAdvancedHiding()
        }
      }

    } catch (error) {
      console.error('[Stealth] Failed to apply window stealth:', error)
    }
  }

  private async applyWindowsAdvancedHiding(window: BrowserWindow): Promise<void> {
    try {
      // Hide from Alt+Tab switcher
      const nativeWindow = window.getNativeWindowHandle()
      
      // Simplified PowerShell command to avoid null byte issues
      const hideScript = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong); [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex); public const int GWL_EXSTYLE = -20; public const int WS_EX_TOOLWINDOW = 0x00000080; }'; $style = [Win32]::GetWindowLong([IntPtr]${nativeWindow}, -20); [Win32]::SetWindowLong([IntPtr]${nativeWindow}, -20, $style -bor 0x00000080)`
      
      execSync(`powershell -Command "${hideScript}"`, { timeout: 5000 })
      console.log('[Stealth] Applied Windows advanced hiding')
    } catch (error) {
      console.error('[Stealth] Windows advanced hiding failed:', error)
    }
  }

  private async applyMacOSAdvancedHiding(): Promise<void> {
    try {
      // Hide from Dock and Mission Control
      app.dock?.hide()
      
      // Use AppleScript for additional hiding
      const hideScript = `
        tell application "System Events"
          set visible of application process "Electron" to false
        end tell
      `
      
      execSync(`osascript -e '${hideScript}'`, { timeout: 5000 })
      console.log('[Stealth] Applied macOS advanced hiding')
    } catch (error) {
      console.error('[Stealth] macOS advanced hiding failed:', error)
    }
  }

  private async applyProcessStealth(): Promise<void> {
    if (!this.config.antiDetection) return

    try {
      // Minimize process visibility
      process.title = 'System Process'
      
      // Reduce process priority to minimize detection
      if (process.platform === 'win32') {
        execSync('wmic process where name="electron.exe" CALL setpriority "below normal"', { timeout: 3000 })
      } else if (process.platform === 'darwin' || process.platform === 'linux') {
        execSync(`renice +10 ${process.pid}`, { timeout: 3000 })
      }

      // Limit resource usage
      if (this.config.resourceMinimization) {
        this.applyResourceLimits()
      }

      console.log('[Stealth] Applied process stealth')
    } catch (error) {
      console.error('[Stealth] Process stealth failed:', error)
    }
  }

  private applyResourceLimits(): void {
    try {
      // Limit memory usage
      if (global.gc) {
        setInterval(() => {
          global.gc()
        }, 30000) // Garbage collect every 30 seconds
      }

      // Throttle CPU usage
      process.nextTick(() => {
        // Yield control to prevent high CPU usage
        setTimeout(() => {}, 1)
      })

      console.log('[Stealth] Applied resource limits')
    } catch (error) {
      console.error('[Stealth] Resource limiting failed:', error)
    }
  }

  private startBehaviorRandomization(): void {
    if (this.behaviorRandomizer) {
      clearInterval(this.behaviorRandomizer)
    }

    // Randomize behavior patterns to avoid detection
    this.behaviorRandomizer = setInterval(() => {
      const behaviors = [
        () => this.randomDelay(),
        () => this.varyProcessPriority(),
        () => this.randomMemoryCleanup()
      ]

      const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)]
      randomBehavior()

    }, 60000 + Math.random() * 120000) // Random interval between 1-3 minutes
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.random() * 200 + 50 // 50-250ms random delay
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  private varyProcessPriority(): void {
    try {
      const priorities = ['below normal', 'normal', 'above normal']
      const randomPriority = priorities[Math.floor(Math.random() * priorities.length)]
      
      if (process.platform === 'win32') {
        execSync(`wmic process where name="electron.exe" CALL setpriority "${randomPriority}"`, { timeout: 3000 })
      }
    } catch (error) {
      // Ignore errors in priority changes
    }
  }

  private randomMemoryCleanup(): void {
    if (Math.random() > 0.7 && global.gc) {
      global.gc()
    }
  }

  public async createStealthScreenshot(window: BrowserWindow): Promise<Buffer> {
    try {
      // Temporarily make window visible for screenshot
      const originalOpacity = window.getOpacity()
      window.setOpacity(1)
      
      await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
      
      const screenshot = await window.capturePage()
      
      // Restore stealth state
      window.setOpacity(originalOpacity)
      
      return screenshot.toPNG()
    } catch (error) {
      console.error('[Stealth] Screenshot capture failed:', error)
      throw error
    }
  }

  public async detectScreenRecording(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        // Check for screen recording on macOS
        const result = execSync('system_profiler SPDisplaysDataType | grep Resolution', { encoding: 'utf8' })
        return result.includes('Recording')
      } else if (process.platform === 'win32') {
        // Check for screen recording on Windows
        const result = execSync('tasklist | findstr /i "obs\\|bandicam\\|camtasia\\|fraps"', { encoding: 'utf8' })
        return result.length > 0
      }
      return false
    } catch {
      return false
    }
  }

  public async isInHighRiskEnvironment(): Promise<boolean> {
    try {
      const risks = await Promise.all([
        this.detectExamSoftware(),
        this.detectScreenRecording(),
        this.detectRemoteAccess()
      ])
      
      return risks.some(risk => risk)
    } catch {
      return false
    }
  }

  private async detectExamSoftware(): Promise<boolean> {
    try {
      const examSoftware = [
        'proctorio', 'respondus', 'lockdown', 'examplify', 'honorlock',
        'proctortrack', 'examity', 'proctor360', 'examsoft'
      ]
      
      if (process.platform === 'win32') {
        for (const software of examSoftware) {
          try {
            const result = execSync(`tasklist | findstr /i "${software}"`, { encoding: 'utf8', timeout: 2000 })
            if (result.length > 0) return true
          } catch {
            continue
          }
        }
      } else if (process.platform === 'darwin') {
        for (const software of examSoftware) {
          try {
            const result = execSync(`ps aux | grep -i "${software}"`, { encoding: 'utf8', timeout: 2000 })
            if (result.length > 0) return true
          } catch {
            continue
          }
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  private async detectRemoteAccess(): Promise<boolean> {
    try {
      const remoteTools = ['teamviewer', 'anydesk', 'chrome remote', 'rdp', 'vnc']
      
      if (process.platform === 'win32') {
        for (const tool of remoteTools) {
          try {
            const result = execSync(`netstat -an | findstr ":3389\\|:5900"`, { encoding: 'utf8', timeout: 2000 })
            if (result.length > 0) return true
          } catch {
            continue
          }
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  public async emergencyHide(window: BrowserWindow): Promise<void> {
    console.log('[Stealth] EMERGENCY HIDE ACTIVATED')
    
    try {
      window.hide()
      window.setOpacity(0)
      
      if (process.platform === 'darwin') {
        app.dock?.hide()
      }
      
      // Wait in hidden state
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      console.log('[Stealth] Emergency hide completed')
    } catch (error) {
      console.error('[Stealth] Emergency hide failed:', error)
    }
  }

  public destroy(): void {
    if (this.behaviorRandomizer) {
      clearInterval(this.behaviorRandomizer)
      this.behaviorRandomizer = null
    }
    console.log('[Stealth] Stealth helper destroyed')
  }
} 