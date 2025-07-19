"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoUpdater = void 0;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
class AutoUpdater {
    analytics;
    mainWindow = null;
    updateInfo = null;
    isUpdating = false;
    updateCheckInterval = null;
    downloadProgress = null;
    constructor(analytics) {
        this.analytics = analytics;
        this.configureUpdater();
        this.setupEventHandlers();
    }
    configureUpdater() {
        // Configure logging
        electron_updater_1.autoUpdater.logger = electron_log_1.default;
        // Set update server URL
        if (process.env.UPDATE_SERVER_URL) {
            electron_updater_1.autoUpdater.setFeedURL({
                provider: 'generic',
                url: process.env.UPDATE_SERVER_URL
            });
        }
        // Configure update behavior
        electron_updater_1.autoUpdater.autoDownload = false; // Manual download control
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        // Allow prereleases in development
        electron_updater_1.autoUpdater.allowPrerelease = process.env.NODE_ENV !== 'production';
        electron_log_1.default.info('[AutoUpdater] Configured with server:', process.env.UPDATE_SERVER_URL);
    }
    setupEventHandlers() {
        // Check for updates result
        electron_updater_1.autoUpdater.on('checking-for-update', () => {
            electron_log_1.default.info('[AutoUpdater] Checking for updates...');
            this.analytics.trackEvent('update_check_started');
        });
        // Update available
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            electron_log_1.default.info('[AutoUpdater] Update available:', info.version);
            this.updateInfo = {
                version: info.version,
                releaseDate: info.releaseDate,
                size: info.files?.[0]?.size || 0,
                releaseNotes: Array.isArray(info.releaseNotes)
                    ? info.releaseNotes.map(note => note.note || '').join('\n')
                    : (info.releaseNotes || 'Bug fixes and improvements'),
                mandatory: this.isMandatoryUpdate(info.version)
            };
            this.analytics.trackEvent('update_available', {
                version: info.version,
                currentVersion: electron_1.app.getVersion(),
                size: this.updateInfo.size,
                mandatory: this.updateInfo.mandatory
            });
            this.promptUserForUpdate();
        });
        // No update available
        electron_updater_1.autoUpdater.on('update-not-available', () => {
            electron_log_1.default.info('[AutoUpdater] No updates available');
            this.analytics.trackEvent('update_not_available');
        });
        // Download progress
        electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
            this.downloadProgress = {
                percent: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                total: progressObj.total,
                transferred: progressObj.transferred
            };
            electron_log_1.default.info(`[AutoUpdater] Download progress: ${progressObj.percent.toFixed(2)}%`);
            // Notify renderer process
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('update-download-progress', this.downloadProgress);
            }
            // Track progress milestones
            if (progressObj.percent >= 50 && progressObj.percent < 60) {
                this.analytics.trackEvent('update_download_halfway');
            }
        });
        // Update downloaded
        electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
            electron_log_1.default.info('[AutoUpdater] Update downloaded:', info.version);
            this.isUpdating = false;
            this.analytics.trackEvent('update_downloaded', {
                version: info.version,
                downloadTime: Date.now() // You'd calculate actual download time
            });
            this.promptUserForInstall();
        });
        // Update error
        electron_updater_1.autoUpdater.on('error', (error) => {
            electron_log_1.default.error('[AutoUpdater] Update error:', error);
            this.isUpdating = false;
            this.analytics.trackEvent('update_error', {
                error: error.message,
                stack: error.stack?.substring(0, 500)
            });
            this.showErrorDialog(error.message);
        });
    }
    isMandatoryUpdate(newVersion) {
        // Define your mandatory update logic here
        // Example: Security updates or major breaking changes
        const currentVersion = electron_1.app.getVersion();
        const mandatory_versions = process.env.MANDATORY_UPDATE_VERSIONS?.split(',') || [];
        return mandatory_versions.includes(newVersion) ||
            this.isSecurityUpdate(newVersion, currentVersion);
    }
    isSecurityUpdate(newVersion, currentVersion) {
        // Simple logic - you can enhance this based on your versioning scheme
        const newParts = newVersion.split('.').map(Number);
        const currentParts = currentVersion.split('.').map(Number);
        // If major version changed, consider it mandatory
        return newParts[0] > currentParts[0];
    }
    async promptUserForUpdate() {
        if (!this.updateInfo || !this.mainWindow)
            return;
        const options = {
            type: 'info',
            title: 'Update Available',
            message: `Wingman AI ${this.updateInfo.version} is available`,
            detail: `${this.updateInfo.releaseNotes}\n\nSize: ${(this.updateInfo.size / 1024 / 1024).toFixed(2)} MB\n\nWould you like to download this update?`,
            buttons: this.updateInfo.mandatory
                ? ['Download Now', 'Download Later']
                : ['Download Now', 'Skip This Version', 'Download Later'],
            defaultId: 0,
            cancelId: this.updateInfo.mandatory ? 1 : 2
        };
        const dialogResult = await electron_1.dialog.showMessageBox(this.mainWindow, options);
        switch (dialogResult.response || dialogResult) {
            case 0: // Download Now
                this.analytics.trackEvent('update_prompt_accepted', {
                    version: this.updateInfo.version,
                    mandatory: this.updateInfo.mandatory
                });
                this.downloadUpdate();
                break;
            case 1: // Skip This Version (or Download Later for mandatory)
                if (this.updateInfo.mandatory) {
                    this.analytics.trackEvent('update_prompt_deferred', {
                        version: this.updateInfo.version
                    });
                    this.scheduleUpdateReminder();
                }
                else {
                    this.analytics.trackEvent('update_prompt_skipped', {
                        version: this.updateInfo.version
                    });
                    // Add to skip list
                    this.addToSkipList(this.updateInfo.version);
                }
                break;
            case 2: // Download Later
                this.analytics.trackEvent('update_prompt_deferred', {
                    version: this.updateInfo.version
                });
                this.scheduleUpdateReminder();
                break;
        }
    }
    downloadUpdate() {
        if (this.isUpdating)
            return;
        this.isUpdating = true;
        this.analytics.trackEvent('update_download_started', {
            version: this.updateInfo?.version
        });
        // Show download progress notification
        this.showDownloadProgress();
        electron_updater_1.autoUpdater.downloadUpdate().catch((error) => {
            electron_log_1.default.error('[AutoUpdater] Download failed:', error);
            this.isUpdating = false;
        });
    }
    showDownloadProgress() {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        // Send to renderer to show progress
        this.mainWindow.webContents.send('update-download-started', {
            version: this.updateInfo?.version
        });
    }
    async promptUserForInstall() {
        if (!this.updateInfo || !this.mainWindow)
            return;
        const options = {
            type: 'info',
            title: 'Update Ready',
            message: `Wingman AI ${this.updateInfo.version} is ready to install`,
            detail: 'The application will restart to complete the installation.',
            buttons: ['Install Now', 'Install on Next Restart'],
            defaultId: 0
        };
        const dialogResult = await electron_1.dialog.showMessageBox(this.mainWindow, options);
        if ((dialogResult.response || dialogResult) === 0) {
            this.analytics.trackEvent('update_install_accepted', {
                version: this.updateInfo.version
            });
            this.installUpdate();
        }
        else {
            this.analytics.trackEvent('update_install_deferred', {
                version: this.updateInfo.version
            });
            // Will install on next app quit
        }
    }
    installUpdate() {
        electron_log_1.default.info('[AutoUpdater] Installing update...');
        this.analytics.trackEvent('update_install_started');
        // Give analytics time to flush
        setTimeout(() => {
            electron_updater_1.autoUpdater.quitAndInstall(false, true);
        }, 1000);
    }
    showErrorDialog(message) {
        if (!this.mainWindow)
            return;
        electron_1.dialog.showMessageBox(this.mainWindow, {
            type: 'error',
            title: 'Update Error',
            message: 'Failed to update Wingman AI',
            detail: `Error: ${message}\n\nPlease try again later or download the update manually from our website.`,
            buttons: ['OK']
        });
    }
    scheduleUpdateReminder() {
        // Remind user about update in 24 hours
        setTimeout(() => {
            if (this.updateInfo) {
                this.promptUserForUpdate();
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }
    addToSkipList(version) {
        // Store skipped versions (you can enhance this with persistent storage)
        const skippedVersions = process.env.SKIPPED_VERSIONS?.split(',') || [];
        if (!skippedVersions.includes(version)) {
            skippedVersions.push(version);
            process.env.SKIPPED_VERSIONS = skippedVersions.join(',');
        }
    }
    // Public methods
    setMainWindow(window) {
        this.mainWindow = window;
    }
    checkForUpdates() {
        if (process.env.NODE_ENV === 'development') {
            electron_log_1.default.info('[AutoUpdater] Skipping update check in development');
            return;
        }
        if (!process.env.UPDATE_SERVER_URL) {
            electron_log_1.default.warn('[AutoUpdater] No update server configured');
            return;
        }
        electron_updater_1.autoUpdater.checkForUpdates().catch((error) => {
            electron_log_1.default.error('[AutoUpdater] Check for updates failed:', error);
        });
    }
    startAutoUpdateCheck() {
        // Check for updates every 6 hours
        this.updateCheckInterval = setInterval(() => {
            this.checkForUpdates();
        }, 6 * 60 * 60 * 1000);
        // Initial check after 1 minute
        setTimeout(() => {
            this.checkForUpdates();
        }, 60000);
    }
    stopAutoUpdateCheck() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
        }
    }
    getUpdateInfo() {
        return this.updateInfo;
    }
    getDownloadProgress() {
        return this.downloadProgress;
    }
    isUpdateInProgress() {
        return this.isUpdating;
    }
    destroy() {
        this.stopAutoUpdateCheck();
    }
}
exports.AutoUpdater = AutoUpdater;
//# sourceMappingURL=AutoUpdater.js.map