"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrashReporter = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const electron_1 = require("electron");
const node_machine_id_1 = require("node-machine-id");
const winston = __importStar(require("winston"));
const Sentry = __importStar(require("@sentry/electron/main"));
class CrashReporter {
    logger;
    machineId = '';
    sessionId;
    crashCount = 0;
    constructor() {
        this.sessionId = this.generateSessionId();
        this.initializeLogger();
        this.initializeCrashReporter();
        this.initializeSentry();
        this.setupGlobalErrorHandling();
        // Get machine ID asynchronously after initialization
        this.initializeMachineId();
    }
    initializeLogger() {
        // Initialize logger synchronously first
        this.logger = winston.createLogger({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            transports: [
                new winston.transports.File({
                    filename: `${electron_1.app.getPath('logs')}/wingman-error.log`,
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: `${electron_1.app.getPath('logs')}/wingman-combined.log`,
                    maxsize: 5242880,
                    maxFiles: 3
                })
            ]
        });
        // Add console transport in development
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.simple()
            }));
        }
        // Configure electron-log
        electron_log_1.default.transports.file.level = 'info';
        electron_log_1.default.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
        electron_log_1.default.transports.console.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
    }
    async initializeMachineId() {
        // Get unique machine ID for analytics
        try {
            this.machineId = await (0, node_machine_id_1.machineId)();
        }
        catch (error) {
            this.machineId = 'unknown';
        }
    }
    initializeCrashReporter() {
        electron_1.crashReporter.start({
            productName: 'Wingman AI',
            companyName: 'WingmanTech',
            submitURL: process.env.CRASH_REPORT_URL || '', // Add your crash reporting endpoint
            uploadToServer: process.env.NODE_ENV === 'production',
            extra: {
                machineId: this.machineId,
                sessionId: this.sessionId,
                version: electron_1.app.getVersion(),
                platform: process.platform,
                arch: process.arch
            }
        });
    }
    initializeSentry() {
        if (process.env.SENTRY_DSN) {
            Sentry.init({
                dsn: process.env.SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                beforeSend: (event) => {
                    // Add machine context
                    event.user = { id: this.machineId };
                    event.tags = {
                        ...event.tags,
                        sessionId: this.sessionId,
                        crashCount: this.crashCount.toString()
                    };
                    return event;
                }
            });
        }
    }
    setupGlobalErrorHandling() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.crashCount++;
            this.logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                machineId: this.machineId,
                crashCount: this.crashCount,
                timestamp: new Date().toISOString()
            });
            if (process.env.SENTRY_DSN) {
                Sentry.captureException(error);
            }
            // Send crash report to analytics
            this.reportCrash('uncaught_exception', error);
            // Don't exit in production, try to recover
            if (process.env.NODE_ENV === 'production') {
                electron_log_1.default.error('Uncaught exception occurred, attempting recovery...');
            }
            else {
                process.exit(1);
            }
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.crashCount++;
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.logger.error('Unhandled Promise Rejection', {
                reason: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                machineId: this.machineId,
                crashCount: this.crashCount,
                timestamp: new Date().toISOString()
            });
            if (process.env.SENTRY_DSN) {
                Sentry.captureException(error);
            }
            this.reportCrash('unhandled_rejection', error);
        });
        // Log app events
        electron_1.app.on('ready', () => this.logEvent('app_ready'));
        electron_1.app.on('window-all-closed', () => this.logEvent('all_windows_closed'));
        electron_1.app.on('before-quit', () => this.logEvent('app_before_quit'));
    }
    logError(error, context) {
        // Safety check to ensure logger is initialized
        if (!this.logger) {
            console.error(`[CrashReporter] Logger not ready, error:`, error.message);
            return;
        }
        this.logger.error('Application Error', {
            error: error.message,
            stack: error.stack,
            context,
            sessionId: this.sessionId,
            machineId: this.machineId,
            timestamp: new Date().toISOString()
        });
        if (process.env.SENTRY_DSN) {
            Sentry.withScope((scope) => {
                if (context)
                    scope.setContext('error_context', context);
                Sentry.captureException(error);
            });
        }
    }
    logEvent(event, data) {
        // Safety check to ensure logger is initialized
        if (!this.logger) {
            console.log(`[CrashReporter] Logger not ready, buffering event: ${event}`);
            return;
        }
        this.logger.info('Application Event', {
            event,
            data,
            sessionId: this.sessionId,
            machineId: this.machineId,
            timestamp: new Date().toISOString()
        });
    }
    logPerformance(metric, value, unit = 'ms') {
        // Safety check to ensure logger is initialized
        if (!this.logger) {
            console.log(`[CrashReporter] Logger not ready, performance metric: ${metric}=${value}${unit}`);
            return;
        }
        this.logger.info('Performance Metric', {
            metric,
            value,
            unit,
            sessionId: this.sessionId,
            machineId: this.machineId,
            timestamp: new Date().toISOString()
        });
    }
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
    async reportCrash(type, error) {
        try {
            // Send crash data to your analytics endpoint
            if (process.env.ANALYTICS_ENDPOINT) {
                const crashData = {
                    type,
                    error: error.message,
                    stack: error.stack,
                    machineId: this.machineId,
                    sessionId: this.sessionId,
                    version: electron_1.app.getVersion(),
                    platform: process.platform,
                    timestamp: new Date().toISOString(),
                    crashCount: this.crashCount
                };
                // Don't await this to avoid blocking
                fetch(process.env.ANALYTICS_ENDPOINT + '/crash', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(crashData)
                }).catch(() => { }); // Silent fail
            }
        }
        catch (error) {
            // Silent fail for crash reporting
        }
    }
    getLogger() {
        return this.logger;
    }
    getMachineId() {
        return this.machineId;
    }
    getSessionId() {
        return this.sessionId;
    }
}
exports.CrashReporter = CrashReporter;
//# sourceMappingURL=CrashReporter.js.map