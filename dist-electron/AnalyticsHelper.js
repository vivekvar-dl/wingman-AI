"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsHelper = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const node_machine_id_1 = require("node-machine-id");
const electron_1 = require("electron");
class AnalyticsHelper {
    client = null;
    machineId = '';
    sessionId;
    eventQueue = [];
    metrics;
    isEnabled = false;
    flushInterval = null;
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.metrics = this.initializeMetrics();
        this.initializeAnalytics();
        this.startMetricsCollection();
    }
    async initializeAnalytics() {
        try {
            this.machineId = await (0, node_machine_id_1.machineId)();
        }
        catch (error) {
            this.machineId = 'unknown';
        }
        // Only enable analytics in production with user consent
        this.isEnabled = process.env.NODE_ENV === 'production' &&
            process.env.ANALYTICS_ENABLED === 'true' &&
            process.env.ANALYTICS_ENDPOINT !== undefined;
        if (this.isEnabled && process.env.ANALYTICS_ENDPOINT) {
            this.client = axios_1.default.create({
                baseURL: process.env.ANALYTICS_ENDPOINT,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `WingmanAI/${electron_1.app.getVersion()} (${process.platform})`
                }
            });
            // Configure retry logic
            (0, axios_retry_1.default)(this.client, {
                retries: 3,
                retryDelay: axios_retry_1.default.exponentialDelay,
                retryCondition: (error) => {
                    return axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
                        (error.response?.status !== undefined && error.response.status >= 500);
                }
            });
            // Start automatic flushing
            this.flushInterval = setInterval(() => {
                this.flushEvents();
            }, 30000); // Flush every 30 seconds
        }
    }
    initializeMetrics() {
        return {
            questionsAsked: 0,
            screenshotsAnalyzed: 0,
            smartModeUsage: 0,
            normalModeUsage: 0,
            sessionsStarted: 1,
            crashesReported: 0,
            averageResponseTime: 0,
            features_used: []
        };
    }
    startMetricsCollection() {
        // Track app launch
        this.trackEvent('app_launched', {
            version: electron_1.app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            locale: electron_1.app.getLocale(),
            is_dev: process.env.NODE_ENV !== 'production'
        });
        // Track session start
        this.trackEvent('session_started', {
            sessionId: this.sessionId,
            timestamp: Date.now()
        });
    }
    trackEvent(event, properties) {
        if (!this.isEnabled)
            return;
        const analyticsEvent = {
            event,
            properties: {
                ...properties,
                machineId: this.machineId,
                sessionId: this.sessionId,
                version: electron_1.app.getVersion(),
                platform: process.platform,
                arch: process.arch
            },
            timestamp: Date.now(),
            userId: this.machineId,
            sessionId: this.sessionId
        };
        this.eventQueue.push(analyticsEvent);
        // Update metrics based on event
        this.updateMetrics(event, properties);
        // Flush immediately for critical events
        if (this.isCriticalEvent(event)) {
            this.flushEvents();
        }
    }
    updateMetrics(event, properties) {
        switch (event) {
            case 'question_asked':
                this.metrics.questionsAsked++;
                if (properties?.isSmartMode) {
                    this.metrics.smartModeUsage++;
                }
                else {
                    this.metrics.normalModeUsage++;
                }
                break;
            case 'screenshot_analyzed':
                this.metrics.screenshotsAnalyzed++;
                break;
            case 'crash_reported':
                this.metrics.crashesReported++;
                break;
            case 'feature_used':
                if (properties?.feature && !this.metrics.features_used.includes(properties.feature)) {
                    this.metrics.features_used.push(properties.feature);
                }
                break;
            case 'response_time_recorded':
                if (properties?.responseTime) {
                    // Calculate running average
                    const currentAvg = this.metrics.averageResponseTime;
                    const count = this.metrics.questionsAsked;
                    this.metrics.averageResponseTime = (currentAvg * (count - 1) + properties.responseTime) / count;
                }
                break;
        }
    }
    isCriticalEvent(event) {
        const criticalEvents = [
            'app_crashed',
            'security_violation',
            'api_error',
            'license_violation',
            'exam_software_detected'
        ];
        return criticalEvents.includes(event);
    }
    trackUsage(feature, metadata) {
        this.trackEvent('feature_used', {
            feature,
            ...metadata
        });
    }
    trackPerformance(metric, value, unit = 'ms') {
        this.trackEvent('performance_metric', {
            metric,
            value,
            unit
        });
        if (metric === 'ai_response_time') {
            this.trackEvent('response_time_recorded', { responseTime: value });
        }
    }
    trackError(error, context) {
        this.trackEvent('error_occurred', {
            error: error.message,
            stack: error.stack?.substring(0, 1000), // Limit stack trace length
            context: JSON.stringify(context).substring(0, 500)
        });
    }
    trackUserAction(action, details) {
        this.trackEvent('user_action', {
            action,
            ...details
        });
    }
    trackAIInteraction(type, success, responseTime, isSmartMode) {
        this.trackEvent('ai_interaction', {
            type,
            success,
            responseTime,
            isSmartMode
        });
        this.trackEvent('question_asked', { isSmartMode });
        this.trackPerformance('ai_response_time', responseTime);
    }
    trackSecurityEvent(event, severity, details) {
        this.trackEvent('security_event', {
            securityEvent: event,
            severity,
            ...details
        });
    }
    async flushEvents() {
        if (!this.isEnabled || !this.client || this.eventQueue.length === 0) {
            return;
        }
        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];
        try {
            await this.client.post('/events', {
                events: eventsToSend,
                metrics: this.metrics,
                meta: {
                    flushTime: Date.now(),
                    eventCount: eventsToSend.length
                }
            });
        }
        catch (error) {
            // Re-queue events on failure (with limit)
            if (this.eventQueue.length < 100) {
                this.eventQueue.unshift(...eventsToSend.slice(-50)); // Keep last 50 events
            }
        }
    }
    async getMetrics() {
        return { ...this.metrics };
    }
    async sendHeartbeat() {
        if (!this.isEnabled)
            return;
        this.trackEvent('heartbeat', {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        });
    }
    async trackSessionEnd() {
        this.trackEvent('session_ended', {
            sessionDuration: Date.now() - parseInt(this.sessionId.split('-')[0]),
            totalQuestions: this.metrics.questionsAsked,
            totalScreenshots: this.metrics.screenshotsAnalyzed,
            features_used: this.metrics.features_used
        });
        // Final flush
        await this.flushEvents();
    }
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flushEvents(); // Final flush
    }
}
exports.AnalyticsHelper = AnalyticsHelper;
//# sourceMappingURL=AnalyticsHelper.js.map