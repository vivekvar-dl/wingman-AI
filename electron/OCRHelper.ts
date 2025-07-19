import Tesseract from 'tesseract.js'
import fs from 'fs'
import sharp from 'sharp'

interface OCRResult {
  text: string
  confidence: number
  hasText: boolean
  regions: Array<{
    text: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
    confidence: number
  }>
}

export class OCRHelper {
  private worker: Tesseract.Worker | null = null

  constructor() {
    this.initializeWorker()
  }

  private async initializeWorker() {
    try {
      this.worker = await Tesseract.createWorker('eng')
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      })
      console.log('[OCR] Worker initialized successfully')
    } catch (error) {
      console.error('[OCR] Failed to initialize worker:', error)
    }
  }

  private async preprocessImage(imagePath: string): Promise<string> {
    try {
      const outputPath = imagePath.replace('.png', '_enhanced.png')
      
      // Enhance image for better OCR
      await sharp(imagePath)
        .grayscale()
        .normalize()
        .sharpen()
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .png({ quality: 100 })
        .toFile(outputPath)
      
      return outputPath
    } catch (error) {
      console.error('[OCR] Image preprocessing failed:', error)
      return imagePath // Return original if preprocessing fails
    }
  }

  public async extractText(imagePath: string): Promise<OCRResult> {
    if (!this.worker) {
      await this.initializeWorker()
    }

    if (!this.worker) {
      throw new Error('OCR worker not available')
    }

    try {
      console.log('[OCR] Starting text extraction...')
      const startTime = Date.now()

      // Preprocess image for better OCR
      const enhancedImagePath = await this.preprocessImage(imagePath)

      // Perform OCR
      const { data } = await this.worker.recognize(enhancedImagePath)
      
      const extractionTime = Date.now() - startTime
      console.log(`[OCR] Text extraction completed in ${extractionTime}ms`)

      // Clean up enhanced image if it was created
      if (enhancedImagePath !== imagePath) {
        try {
          fs.unlinkSync(enhancedImagePath)
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      // Process OCR results
      const text = data.text.trim()
      const confidence = data.confidence
      const hasText = text.length > 10 && confidence > 30

      // Extract regions with text
      const regions = data.words
        .filter(word => word.confidence > 50)
        .map(word => ({
          text: word.text,
          bbox: word.bbox,
          confidence: word.confidence
        }))

      const result: OCRResult = {
        text,
        confidence,
        hasText,
        regions
      }

      console.log(`[OCR] Extracted ${text.length} characters with ${confidence.toFixed(1)}% confidence`)
      return result

    } catch (error) {
      console.error('[OCR] Text extraction failed:', error)
      return {
        text: '',
        confidence: 0,
        hasText: false,
        regions: []
      }
    }
  }

  public async isTextHeavyImage(imagePath: string): Promise<boolean> {
    try {
      const ocrResult = await this.extractText(imagePath)
      
      // Consider image text-heavy if:
      // 1. Has decent amount of text (>100 chars)
      // 2. Good confidence (>60%)
      // 3. Multiple text regions
      return ocrResult.text.length > 100 && 
             ocrResult.confidence > 60 && 
             ocrResult.regions.length > 5
    } catch (error) {
      console.error('[OCR] Failed to analyze image text density:', error)
      return false
    }
  }

  public async createOptimizedPrompt(imagePath: string, originalPrompt: string): Promise<{
    useTextOnly: boolean
    optimizedPrompt: string
    extractedText: string
  }> {
    try {
      const ocrResult = await this.extractText(imagePath)
      
      if (ocrResult.hasText && ocrResult.text.length > 50) {
        // Text-heavy image - use OCR text with minimal image
        const optimizedPrompt = `${originalPrompt}\n\nExtracted text from image:\n${ocrResult.text}`
        
        return {
          useTextOnly: ocrResult.confidence > 80 && ocrResult.text.length > 200,
          optimizedPrompt,
          extractedText: ocrResult.text
        }
      } else {
        // Image-heavy or no text - use original approach
        return {
          useTextOnly: false,
          optimizedPrompt: originalPrompt,
          extractedText: ''
        }
      }
    } catch (error) {
      console.error('[OCR] Failed to create optimized prompt:', error)
      return {
        useTextOnly: false,
        optimizedPrompt: originalPrompt,
        extractedText: ''
      }
    }
  }

  public async destroy() {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      console.log('[OCR] Worker terminated')
    }
  }
} 