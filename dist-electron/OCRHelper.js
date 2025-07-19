"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCRHelper = void 0;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
class OCRHelper {
    worker = null;
    constructor() {
        this.initializeWorker();
    }
    async initializeWorker() {
        try {
            this.worker = await tesseract_js_1.default.createWorker('eng');
            await this.worker.setParameters({
                tessedit_pageseg_mode: tesseract_js_1.default.PSM.SPARSE_TEXT,
            });
            console.log('[OCR] Worker initialized successfully');
        }
        catch (error) {
            console.error('[OCR] Failed to initialize worker:', error);
        }
    }
    async preprocessImage(imagePath) {
        try {
            const outputPath = imagePath.replace('.png', '_enhanced.png');
            // Enhance image for better OCR
            await (0, sharp_1.default)(imagePath)
                .grayscale()
                .normalize()
                .sharpen()
                .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
                .png({ quality: 100 })
                .toFile(outputPath);
            return outputPath;
        }
        catch (error) {
            console.error('[OCR] Image preprocessing failed:', error);
            return imagePath; // Return original if preprocessing fails
        }
    }
    async extractText(imagePath) {
        if (!this.worker) {
            await this.initializeWorker();
        }
        if (!this.worker) {
            throw new Error('OCR worker not available');
        }
        try {
            console.log('[OCR] Starting text extraction...');
            const startTime = Date.now();
            // Preprocess image for better OCR
            const enhancedImagePath = await this.preprocessImage(imagePath);
            // Perform OCR
            const { data } = await this.worker.recognize(enhancedImagePath);
            const extractionTime = Date.now() - startTime;
            console.log(`[OCR] Text extraction completed in ${extractionTime}ms`);
            // Clean up enhanced image if it was created
            if (enhancedImagePath !== imagePath) {
                try {
                    fs_1.default.unlinkSync(enhancedImagePath);
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            // Process OCR results
            const text = data.text.trim();
            const confidence = data.confidence;
            const hasText = text.length > 10 && confidence > 30;
            // Extract regions with text
            const regions = data.words
                .filter(word => word.confidence > 50)
                .map(word => ({
                text: word.text,
                bbox: word.bbox,
                confidence: word.confidence
            }));
            const result = {
                text,
                confidence,
                hasText,
                regions
            };
            console.log(`[OCR] Extracted ${text.length} characters with ${confidence.toFixed(1)}% confidence`);
            return result;
        }
        catch (error) {
            console.error('[OCR] Text extraction failed:', error);
            return {
                text: '',
                confidence: 0,
                hasText: false,
                regions: []
            };
        }
    }
    async isTextHeavyImage(imagePath) {
        try {
            const ocrResult = await this.extractText(imagePath);
            // Consider image text-heavy if:
            // 1. Has decent amount of text (>100 chars)
            // 2. Good confidence (>60%)
            // 3. Multiple text regions
            return ocrResult.text.length > 100 &&
                ocrResult.confidence > 60 &&
                ocrResult.regions.length > 5;
        }
        catch (error) {
            console.error('[OCR] Failed to analyze image text density:', error);
            return false;
        }
    }
    async createOptimizedPrompt(imagePath, originalPrompt) {
        try {
            const ocrResult = await this.extractText(imagePath);
            if (ocrResult.hasText && ocrResult.text.length > 50) {
                // Text-heavy image - use OCR text with minimal image
                const optimizedPrompt = `${originalPrompt}\n\nExtracted text from image:\n${ocrResult.text}`;
                return {
                    useTextOnly: ocrResult.confidence > 80 && ocrResult.text.length > 200,
                    optimizedPrompt,
                    extractedText: ocrResult.text
                };
            }
            else {
                // Image-heavy or no text - use original approach
                return {
                    useTextOnly: false,
                    optimizedPrompt: originalPrompt,
                    extractedText: ''
                };
            }
        }
        catch (error) {
            console.error('[OCR] Failed to create optimized prompt:', error);
            return {
                useTextOnly: false,
                optimizedPrompt: originalPrompt,
                extractedText: ''
            };
        }
    }
    async destroy() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            console.log('[OCR] Worker terminated');
        }
    }
}
exports.OCRHelper = OCRHelper;
//# sourceMappingURL=OCRHelper.js.map