"use strict";
// ipcHandlers.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeIpcHandlers = initializeIpcHandlers;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
function initializeIpcHandlers(appState) {
    electron_1.ipcMain.handle("update-content-dimensions", async (event, { width, height }) => {
        if (width && height) {
            appState.setWindowDimensions(width, height);
        }
    });
    electron_1.ipcMain.handle("delete-screenshot", async (event, path) => {
        return appState.deleteScreenshot(path);
    });
    electron_1.ipcMain.handle("take-screenshot", async () => {
        try {
            const screenshotPath = await appState.takeScreenshot();
            const preview = await appState.getImagePreview(screenshotPath);
            return { path: screenshotPath, preview };
        }
        catch (error) {
            console.error("Error taking screenshot:", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("get-screenshots", async () => {
        console.log({ view: appState.getView() });
        try {
            let previews = [];
            if (appState.getView() === "queue") {
                previews = await Promise.all(appState.getScreenshotQueue().map(async (path) => ({
                    path,
                    preview: await appState.getImagePreview(path)
                })));
            }
            else {
                previews = await Promise.all(appState.getExtraScreenshotQueue().map(async (path) => ({
                    path,
                    preview: await appState.getImagePreview(path)
                })));
            }
            previews.forEach((preview) => console.log(preview.path));
            return previews;
        }
        catch (error) {
            console.error("Error getting screenshots:", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("toggle-window", async () => {
        appState.toggleMainWindow();
    });
    electron_1.ipcMain.handle("reset-queues", async () => {
        try {
            appState.clearQueues();
            console.log("Screenshot queues have been cleared.");
            return { success: true };
        }
        catch (error) {
            console.error("Error resetting queues:", error);
            return { success: false, error: error.message };
        }
    });
    // IPC handler for analyzing audio from base64 data
    electron_1.ipcMain.handle("analyze-audio-base64", async (event, data, mimeType) => {
        try {
            const result = await appState.processingHelper.processAudioBase64(data, mimeType);
            return result;
        }
        catch (error) {
            console.error("Error in analyze-audio-base64 handler:", error);
            throw error;
        }
    });
    // IPC handler for analyzing audio from file path
    electron_1.ipcMain.handle("analyze-audio-file", async (event, path) => {
        try {
            const result = await appState.processingHelper.processAudioFile(path);
            return result;
        }
        catch (error) {
            console.error("Error in analyze-audio-file handler:", error);
            throw error;
        }
    });
    // IPC handler for analyzing image from file path
    electron_1.ipcMain.handle("analyze-image-file", async (event, path) => {
        try {
            const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path);
            return result;
        }
        catch (error) {
            console.error("Error in analyze-image-file handler:", error);
            throw error;
        }
    });
    // IPC handler for analyzing text questions
    electron_1.ipcMain.handle("analyze-text-question", async (event, question, isSmartMode = true) => {
        try {
            const result = await appState.processingHelper.getLLMHelper().analyzeTextQuestion(question, isSmartMode);
            return result;
        }
        catch (error) {
            console.error("Error in analyze-text-question handler:", error);
            throw error;
        }
    });
    // IPC handler for analyzing screen with a question
    electron_1.ipcMain.handle("analyze-screen-with-question", async (event, imagePath, question, isSmartMode = true) => {
        try {
            const result = await appState.processingHelper.getLLMHelper().analyzeScreenWithQuestion(imagePath, question, isSmartMode);
            return result;
        }
        catch (error) {
            console.error("Error in analyze-screen-with-question handler:", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("transcribe-audio", (event, wavBase64) => appState.processingHelper.getLLMHelper().transcribeAudio(wavBase64));
    // System audio (the other side of the call) via audiotee: a Core Audio process tap, macOS 14.2+.
    // Streams 16kHz mono s16le PCM on stdout; we relay it to the renderer for VAD.
    let audiotee = null;
    electron_1.ipcMain.handle("system-audio-start", (event) => {
        if (process.platform !== "darwin" || audiotee)
            return false;
        const bin = path_1.default
            .join(electron_1.app.getAppPath(), "node_modules/audiotee/bin/audiotee")
            .replace("app.asar", "app.asar.unpacked");
        const proc = (0, child_process_1.spawn)(bin, ["--sample-rate", "16000", "--chunk-duration", "0.05"]);
        audiotee = proc;
        let carry = Buffer.alloc(0); // a pipe read can split a 2-byte sample
        proc.stdout.on("data", (data) => {
            const buf = Buffer.concat([carry, data]);
            const even = buf.length & ~1;
            carry = buf.subarray(even);
            if (!event.sender.isDestroyed())
                event.sender.send("system-audio-data", buf.subarray(0, even));
        });
        proc.stderr.on("data", (data) => {
            if (data.includes('"error"'))
                console.error("[audiotee]", data.toString().trim());
        });
        proc.on("error", (error) => console.error("[audiotee] failed to start:", error));
        proc.on("exit", () => {
            if (audiotee === proc)
                audiotee = null;
        });
        return true;
    });
    electron_1.ipcMain.handle("system-audio-stop", () => {
        const proc = audiotee;
        audiotee = null;
        proc?.kill();
        // audiotee can ignore SIGTERM; never leave it capturing in the background
        setTimeout(() => proc?.kill("SIGKILL"), 2000);
    });
    electron_1.app.on("will-quit", () => audiotee?.kill("SIGKILL"));
    electron_1.ipcMain.handle("quit-app", () => {
        electron_1.app.quit();
    });
}
//# sourceMappingURL=ipcHandlers.js.map