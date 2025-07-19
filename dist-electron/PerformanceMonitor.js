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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const os = __importStar(require("os"));
class PerformanceMonitor {
    analytics;
    monitoringInterval = null;
    alertHistory = [];
    performanceHistory = [];
    startTime = Date.now();
    // Performance thresholds
    THRESHOLDS = {
        MEMORY_WARNING: 500 * 1024 * 1024, // 500MB
        MEMORY_CRITICAL: 1024 * 1024 * 1024, // 1GB
        CPU_WARNING: 80, // 80%
        CPU_CRITICAL: 95, // 95%
        RESPONSE_TIME_WARNING: 5000, // 5 seconds
        RESPONSE_TIME_CRITICAL: 10000, // 10 seconds
        ERROR_RATE_WARNING: 0.1, // 10%
        ERROR_RATE_CRITICAL: 0.25 // 25%
    };
    // Metrics tracking
    responseTimeBuffer = [];
    errorCount = 0;
    totalRequests = 0;
    cacheHits = 0;
    cacheMisses = 0;
    constructor(analytics) {
        this.analytics = analytics;
        this.startMonitoring();
    }
    startMonitoring() {
        // Collect performance metrics every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, 30000);
        // Initial metrics collection
        this.collectMetrics();
    }
    collectMetrics() {
        const metrics = this.getCurrentMetrics();
        this.performanceHistory.push(metrics);
        // Keep only last 100 metrics (50 minutes of data)
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }
        // Check for performance issues
        this.checkPerformanceAlerts(metrics);
        // Send metrics to analytics
        this.analytics.trackPerformance('memory_usage', metrics.memory.heapUsed, 'bytes');
        this.analytics.trackPerformance('cpu_usage', metrics.cpu.user + metrics.cpu.system, 'microseconds');
        this.analytics.trackPerformance('avg_response_time', metrics.app.responseTime, 'ms');
        this.analytics.trackPerformance('cache_hit_rate', metrics.app.cacheHitRate, 'percentage');
        console.log(`[Performance] Memory: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB, CPU: ${((metrics.cpu.user + metrics.cpu.system) / 1000).toFixed(2)}ms, Avg Response: ${metrics.app.responseTime.toFixed(2)}ms`);
    }
    getCurrentMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            memory: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            system: {
                loadAverage: os.loadavg(),
                freeMemory: os.freemem(),
                totalMemory: os.totalmem(),
                uptime: os.uptime()
            },
            app: {
                responseTime: this.calculateAverageResponseTime(),
                cacheHitRate: this.calculateCacheHitRate(),
                apiCallCount: this.totalRequests,
                errorCount: this.errorCount
            }
        };
    }
    checkPerformanceAlerts(metrics) {
        // Memory alerts
        if (metrics.memory.heapUsed > this.THRESHOLDS.MEMORY_CRITICAL) {
            this.createAlert('memory', 'critical', `Critical memory usage: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`, metrics.memory.heapUsed, this.THRESHOLDS.MEMORY_CRITICAL);
        }
        else if (metrics.memory.heapUsed > this.THRESHOLDS.MEMORY_WARNING) {
            this.createAlert('memory', 'warning', `High memory usage: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`, metrics.memory.heapUsed, this.THRESHOLDS.MEMORY_WARNING);
        }
        // Response time alerts
        if (metrics.app.responseTime > this.THRESHOLDS.RESPONSE_TIME_CRITICAL) {
            this.createAlert('response_time', 'critical', `Critical response time: ${metrics.app.responseTime.toFixed(2)}ms`, metrics.app.responseTime, this.THRESHOLDS.RESPONSE_TIME_CRITICAL);
        }
        else if (metrics.app.responseTime > this.THRESHOLDS.RESPONSE_TIME_WARNING) {
            this.createAlert('response_time', 'warning', `High response time: ${metrics.app.responseTime.toFixed(2)}ms`, metrics.app.responseTime, this.THRESHOLDS.RESPONSE_TIME_WARNING);
        }
        // Error rate alerts
        const errorRate = this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0;
        if (errorRate > this.THRESHOLDS.ERROR_RATE_CRITICAL) {
            this.createAlert('error_rate', 'critical', `Critical error rate: ${(errorRate * 100).toFixed(2)}%`, errorRate, this.THRESHOLDS.ERROR_RATE_CRITICAL);
        }
        else if (errorRate > this.THRESHOLDS.ERROR_RATE_WARNING) {
            this.createAlert('error_rate', 'warning', `High error rate: ${(errorRate * 100).toFixed(2)}%`, errorRate, this.THRESHOLDS.ERROR_RATE_WARNING);
        }
    }
    createAlert(type, severity, message, value, threshold) {
        const alert = {
            type,
            severity,
            message,
            value,
            threshold,
            timestamp: Date.now()
        };
        // Avoid duplicate alerts (same type within 5 minutes)
        const recentAlert = this.alertHistory.find(a => a.type === type &&
            a.severity === severity &&
            Date.now() - a.timestamp < 300000 // 5 minutes
        );
        if (!recentAlert) {
            this.alertHistory.push(alert);
            // Keep only last 50 alerts
            if (this.alertHistory.length > 50) {
                this.alertHistory.shift();
            }
            // Log the alert
            console.warn(`[Performance Alert] ${severity.toUpperCase()}: ${message}`);
            // Send to analytics
            this.analytics.trackEvent('performance_alert', {
                type,
                severity,
                message,
                value,
                threshold
            });
            // Trigger automatic optimization for critical alerts
            if (severity === 'critical') {
                this.triggerAutomaticOptimization(type);
            }
        }
    }
    triggerAutomaticOptimization(alertType) {
        switch (alertType) {
            case 'memory':
                this.optimizeMemory();
                break;
            case 'response_time':
                this.optimizeResponseTime();
                break;
            case 'error_rate':
                this.handleHighErrorRate();
                break;
        }
    }
    optimizeMemory() {
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('[Performance] Forced garbage collection due to high memory usage');
        }
        // Clear old performance history
        if (this.performanceHistory.length > 50) {
            this.performanceHistory = this.performanceHistory.slice(-50);
        }
        // Clear old response times
        if (this.responseTimeBuffer.length > 50) {
            this.responseTimeBuffer = this.responseTimeBuffer.slice(-50);
        }
        this.analytics.trackEvent('automatic_optimization', { type: 'memory' });
    }
    optimizeResponseTime() {
        // Clear response time buffer to reset average
        this.responseTimeBuffer = [];
        this.analytics.trackEvent('automatic_optimization', { type: 'response_time' });
        console.log('[Performance] Response time buffer cleared due to high response times');
    }
    handleHighErrorRate() {
        // Reset error counter to prevent constant alerts
        this.errorCount = Math.floor(this.errorCount * 0.5);
        this.analytics.trackEvent('automatic_optimization', { type: 'error_rate' });
        console.log('[Performance] Error count reduced due to high error rate');
    }
    // Public methods for tracking
    recordResponseTime(responseTime) {
        this.responseTimeBuffer.push(responseTime);
        this.totalRequests++;
        // Keep only last 100 response times
        if (this.responseTimeBuffer.length > 100) {
            this.responseTimeBuffer.shift();
        }
    }
    recordError() {
        this.errorCount++;
        this.totalRequests++;
    }
    recordCacheHit() {
        this.cacheHits++;
    }
    recordCacheMiss() {
        this.cacheMisses++;
    }
    calculateAverageResponseTime() {
        if (this.responseTimeBuffer.length === 0)
            return 0;
        return this.responseTimeBuffer.reduce((sum, time) => sum + time, 0) / this.responseTimeBuffer.length;
    }
    calculateCacheHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        if (total === 0)
            return 0;
        return (this.cacheHits / total) * 100;
    }
    getPerformanceReport() {
        const current = this.getCurrentMetrics();
        const avgResponseTime = this.calculateAverageResponseTime();
        const errorRate = this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;
        // Calculate memory trend
        const recentMemory = this.performanceHistory.slice(-10).map(m => m.memory.heapUsed);
        const memoryTrend = recentMemory.length >= 2 ?
            (recentMemory[recentMemory.length - 1] > recentMemory[0] ? 'increasing' : 'decreasing') : 'stable';
        return {
            current,
            alerts: this.alertHistory.slice(-10), // Last 10 alerts
            uptime: Date.now() - this.startTime,
            summary: {
                avgResponseTime,
                totalRequests: this.totalRequests,
                errorRate,
                cacheHitRate: this.calculateCacheHitRate(),
                memoryTrend
            }
        };
    }
    isPerformanceHealthy() {
        const metrics = this.getCurrentMetrics();
        const errorRate = this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0;
        return metrics.memory.heapUsed < this.THRESHOLDS.MEMORY_WARNING &&
            metrics.app.responseTime < this.THRESHOLDS.RESPONSE_TIME_WARNING &&
            errorRate < this.THRESHOLDS.ERROR_RATE_WARNING;
    }
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=PerformanceMonitor.js.map