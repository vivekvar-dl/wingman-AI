"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentModerator = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
class ContentModerator {
    analytics;
    rateLimiter;
    rules;
    blockedPatterns;
    suspiciousUserIds = new Set();
    constructor(analytics) {
        this.analytics = analytics;
        this.initializeRateLimiter();
        this.initializeModerationRules();
        this.initializeBlockedPatterns();
    }
    initializeRateLimiter() {
        // Rate limiting to prevent abuse
        this.rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            points: 50, // Number of requests
            duration: 60, // Per 60 seconds
            blockDuration: 300, // Block for 5 minutes if exceeded
        });
    }
    initializeModerationRules() {
        this.rules = [
            // Academic Integrity Rules
            {
                name: 'exam_cheating',
                pattern: /\b(exam|test|quiz|final|midterm|assignment|homework)\s+(answer|solution|cheat|help)/i,
                severity: 'warning',
                category: 'academic_integrity',
                action: 'warn'
            },
            {
                name: 'direct_cheating',
                pattern: /\b(do my homework|take my test|answer this exam|complete assignment for me)/i,
                severity: 'block',
                category: 'academic_integrity',
                action: 'block'
            },
            {
                name: 'plagiarism',
                pattern: /\b(write my essay|complete this paper|plagiarize|copy paste)/i,
                severity: 'block',
                category: 'academic_integrity',
                action: 'block'
            },
            // Harmful Content Rules
            {
                name: 'violence',
                pattern: /\b(kill|murder|bomb|weapon|terrorist|violence|harm someone)/i,
                severity: 'block',
                category: 'harmful',
                action: 'block'
            },
            {
                name: 'illegal_activity',
                pattern: /\b(hack into|break into|steal|fraud|illegal|drug dealing)/i,
                severity: 'block',
                category: 'harmful',
                action: 'block'
            },
            // Personal Information Rules
            {
                name: 'personal_info',
                pattern: /\b(ssn|social security|credit card|password|bank account|driver.?license)/i,
                severity: 'warning',
                category: 'personal_info',
                action: 'warn'
            },
            // Explicit Content Rules
            {
                name: 'explicit_content',
                pattern: /\b(sex|porn|nude|explicit|nsfw)/i,
                severity: 'warning',
                category: 'explicit',
                action: 'warn'
            },
            // Spam Rules
            {
                name: 'repetitive',
                pattern: /(.{10,})\1{3,}/i, // Detects repeated text
                severity: 'warning',
                category: 'spam',
                action: 'flag'
            }
        ];
    }
    initializeBlockedPatterns() {
        this.blockedPatterns = [
            // Immediate blocking patterns
            /\b(kill\s+yourself|commit\s+suicide|end\s+your\s+life)/i,
            /\b(nazi|hitler|genocide|terrorism)/i,
            /\b(child\s+porn|child\s+abuse|pedophile)/i,
            /\b(bomb\s+making|explosive\s+device|terrorist\s+attack)/i,
        ];
    }
    async moderateRequest(userId, content, context) {
        try {
            // Rate limiting check
            await this.checkRateLimit(userId);
            // Check for immediate blocking patterns
            const immediateBlock = this.checkImmediateBlock(content);
            if (immediateBlock.blocked) {
                this.analytics.trackSecurityEvent('content_blocked', 'high', {
                    reason: immediateBlock.reason,
                    userId,
                    contentLength: content.length
                });
                return {
                    allowed: false,
                    flags: ['immediate_block'],
                    severity: 'blocked',
                    reason: immediateBlock.reason
                };
            }
            // Apply moderation rules
            const moderationResult = this.applyModerationRules(content);
            // Check for suspicious patterns
            this.checkSuspiciousPatterns(userId, content, moderationResult);
            // Academic integrity specific checks
            if (context?.isExamEnvironment) {
                const examResult = this.checkExamEnvironment(content);
                if (examResult.blocked) {
                    this.analytics.trackSecurityEvent('exam_violation', 'high', {
                        userId,
                        content: content.substring(0, 100)
                    });
                    return {
                        allowed: false,
                        flags: ['exam_violation'],
                        severity: 'blocked',
                        reason: 'Academic integrity violation detected in exam environment'
                    };
                }
            }
            // Log moderation result
            this.analytics.trackEvent('content_moderated', {
                userId,
                severity: moderationResult.severity,
                flags: moderationResult.flags,
                allowed: moderationResult.allowed
            });
            return moderationResult;
        }
        catch (rateLimitError) {
            // Rate limit exceeded
            this.analytics.trackSecurityEvent('rate_limit_exceeded', 'medium', {
                userId,
                error: rateLimitError
            });
            return {
                allowed: false,
                flags: ['rate_limited'],
                severity: 'blocked',
                reason: 'Too many requests. Please wait before trying again.'
            };
        }
    }
    async checkRateLimit(userId) {
        try {
            await this.rateLimiter.consume(userId);
        }
        catch (rejRes) {
            throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rejRes.msBeforeNext / 1000)} seconds.`);
        }
    }
    checkImmediateBlock(content) {
        for (const pattern of this.blockedPatterns) {
            if (pattern.test(content)) {
                return {
                    blocked: true,
                    reason: 'Content contains prohibited material'
                };
            }
        }
        return { blocked: false };
    }
    applyModerationRules(content) {
        const flags = [];
        let severity = 'clean';
        let allowed = true;
        let modified;
        for (const rule of this.rules) {
            if (rule.pattern.test(content)) {
                flags.push(rule.name);
                switch (rule.action) {
                    case 'block':
                        allowed = false;
                        severity = 'blocked';
                        break;
                    case 'warn':
                        if (severity === 'clean')
                            severity = 'warning';
                        break;
                    case 'modify':
                        modified = this.applyContentModification(content, rule);
                        if (severity === 'clean')
                            severity = 'warning';
                        break;
                    case 'flag':
                        // Just flag for review
                        break;
                }
                if (rule.severity === 'block') {
                    allowed = false;
                    severity = 'blocked';
                    break;
                }
            }
        }
        return {
            allowed,
            flags,
            severity,
            modified,
            reason: !allowed ? 'Content violates community guidelines' : undefined
        };
    }
    applyContentModification(content, rule) {
        // Apply specific modifications based on rule
        switch (rule.name) {
            case 'personal_info':
                return content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')
                    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[CREDIT CARD REDACTED]');
            case 'exam_cheating':
                return content.replace(/(exam|test|quiz|final|midterm)/gi, 'study material');
            default:
                return content;
        }
    }
    checkSuspiciousPatterns(userId, content, result) {
        // Track users with multiple violations
        if (result.flags.length > 0) {
            this.suspiciousUserIds.add(userId);
            if (result.flags.length >= 3) {
                this.analytics.trackSecurityEvent('suspicious_user', 'medium', {
                    userId,
                    flags: result.flags,
                    flagCount: result.flags.length
                });
            }
        }
        // Check for prompt injection attempts
        if (this.isPromptInjection(content)) {
            this.analytics.trackSecurityEvent('prompt_injection_attempt', 'high', {
                userId,
                content: content.substring(0, 200)
            });
            result.flags.push('prompt_injection');
        }
    }
    isPromptInjection(content) {
        const injectionPatterns = [
            /ignore\s+(previous|all)\s+instructions/i,
            /you\s+are\s+now\s+a/i,
            /forget\s+everything/i,
            /system\s*:\s*/i,
            /\[SYSTEM\]/i,
            /pretend\s+to\s+be/i,
            /roleplay\s+as/i
        ];
        return injectionPatterns.some(pattern => pattern.test(content));
    }
    checkExamEnvironment(content) {
        // Stricter rules in exam environment
        const examPatterns = [
            /answer\s+to\s+question/i,
            /what\s+is\s+the\s+answer/i,
            /solve\s+this\s+problem/i,
            /help\s+me\s+with\s+this/i
        ];
        for (const pattern of examPatterns) {
            if (pattern.test(content)) {
                return {
                    blocked: true,
                    reason: 'Seeking direct answers during exam is not allowed'
                };
            }
        }
        return { blocked: false };
    }
    moderateResponse(response) {
        // Moderate AI responses to ensure they don't contain inappropriate content
        const result = this.applyModerationRules(response);
        // Additional checks for AI responses
        if (this.containsDirectAnswers(response)) {
            result.flags.push('direct_answer_provided');
            if (result.severity === 'clean')
                result.severity = 'warning';
        }
        return result;
    }
    containsDirectAnswers(response) {
        // Check if response provides direct exam answers
        const directAnswerPatterns = [
            /the\s+answer\s+is\s+[A-D]/i,
            /correct\s+answer:\s*[A-D]/i,
            /solution:\s*\d+/i,
            /here\s+is\s+the\s+complete\s+solution/i
        ];
        return directAnswerPatterns.some(pattern => pattern.test(response));
    }
    addCustomRule(rule) {
        this.rules.push(rule);
    }
    isSuspiciousUser(userId) {
        return this.suspiciousUserIds.has(userId);
    }
    getViolationCount(userId) {
        // In a real implementation, you'd track this in a database
        return this.suspiciousUserIds.has(userId) ? 1 : 0;
    }
    clearSuspiciousUser(userId) {
        this.suspiciousUserIds.delete(userId);
    }
    getModerationStats() {
        return {
            totalRules: this.rules.length,
            suspiciousUsers: this.suspiciousUserIds.size,
            recentViolations: 0 // You'd implement this with proper storage
        };
    }
}
exports.ContentModerator = ContentModerator;
//# sourceMappingURL=ContentModerator.js.map