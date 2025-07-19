import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

interface CacheEntry {
  question: string
  answer: string
  timestamp: number
  mode: string
  similarity_hash: string
  usage_count: number
}

export class CacheHelper {
  private cachePath: string
  private cache: Map<string, CacheEntry>
  private maxCacheSize: number = 1000
  private similarityThreshold: number = 0.85

  constructor() {
    this.cachePath = path.join(__dirname, '..', 'cache', 'ai_responses.json')
    this.cache = new Map()
    this.ensureCacheDirectory()
    this.loadCache()
  }

  private ensureCacheDirectory() {
    const cacheDir = path.dirname(this.cachePath)
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf8')
        const entries = JSON.parse(data)
        this.cache = new Map(entries.map((entry: CacheEntry) => [entry.similarity_hash, entry]))
      }
    } catch (error) {
      console.error('Failed to load cache:', error)
    }
  }

  private saveCache() {
    try {
      const entries = Array.from(this.cache.values())
      fs.writeFileSync(this.cachePath, JSON.stringify(entries, null, 2))
    } catch (error) {
      console.error('Failed to save cache:', error)
    }
  }

  private generateSimilarityHash(text: string): string {
    // Normalize text for similarity comparison
    const normalized = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    return crypto.createHash('md5').update(normalized).digest('hex')
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity calculation
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  public async getCachedResponse(question: string, mode: string): Promise<string | null> {
    const questionHash = this.generateSimilarityHash(question)
    
    // Check for exact match first
    const exactMatch = this.cache.get(questionHash)
    if (exactMatch && exactMatch.mode === mode) {
      exactMatch.usage_count++
      console.log(`[Cache] Exact match found for: ${question.substring(0, 50)}...`)
      return exactMatch.answer
    }

    // Check for similar questions
    for (const [hash, entry] of this.cache.entries()) {
      if (entry.mode === mode) {
        const similarity = this.calculateSimilarity(question, entry.question)
        if (similarity >= this.similarityThreshold) {
          entry.usage_count++
          console.log(`[Cache] Similar match found (${Math.round(similarity * 100)}%): ${entry.question.substring(0, 50)}...`)
          return entry.answer
        }
      }
    }

    return null
  }

  public async cacheResponse(question: string, answer: string, mode: string): Promise<void> {
    const hash = this.generateSimilarityHash(question)
    
    const entry: CacheEntry = {
      question,
      answer,
      timestamp: Date.now(),
      mode,
      similarity_hash: hash,
      usage_count: 1
    }

    this.cache.set(hash, entry)

    // Cleanup old entries if cache is too large
    if (this.cache.size > this.maxCacheSize) {
      this.cleanupCache()
    }

    this.saveCache()
    console.log(`[Cache] Stored response for: ${question.substring(0, 50)}...`)
  }

  private cleanupCache() {
    // Remove least used and oldest entries
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => {
      const scoreA = a[1].usage_count * 0.7 + (Date.now() - a[1].timestamp) * 0.3
      const scoreB = b[1].usage_count * 0.7 + (Date.now() - b[1].timestamp) * 0.3
      return scoreA - scoreB
    })

    // Remove bottom 20%
    const toRemove = Math.floor(entries.length * 0.2)
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }

    console.log(`[Cache] Cleaned up ${toRemove} old entries`)
  }

  public getCacheStats(): { size: number; hitRate: number } {
    const totalUsage = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.usage_count, 0)
    const totalEntries = this.cache.size
    
    return {
      size: totalEntries,
      hitRate: totalEntries > 0 ? totalUsage / totalEntries : 0
    }
  }
} 