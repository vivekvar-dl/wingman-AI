import { execSync } from 'child_process'
import path from 'path'

interface ContextInfo {
  activeApp: string
  contentType: 'code' | 'math' | 'text' | 'exam' | 'browser' | 'unknown'
  confidence: number
  suggestions: string[]
  environment: 'development' | 'study' | 'exam' | 'research' | 'general'
  urgency: 'low' | 'medium' | 'high'
}

interface ApplicationPattern {
  names: string[]
  contentType: ContextInfo['contentType']
  environment: ContextInfo['environment']
  urgency: ContextInfo['urgency']
  keywords: string[]
}

export class ContextHelper {
  private applicationPatterns: ApplicationPattern[] = [
    {
      names: ['code', 'vscode', 'visual studio', 'intellij', 'pycharm', 'webstorm', 'atom', 'sublime'],
      contentType: 'code',
      environment: 'development',
      urgency: 'medium',
      keywords: ['function', 'class', 'variable', 'method', 'import', 'export', 'const', 'let']
    },
    {
      names: ['mathematica', 'matlab', 'geogebra', 'desmos', 'calculator'],
      contentType: 'math',
      environment: 'study',
      urgency: 'medium',
      keywords: ['equation', 'function', 'derivative', 'integral', 'matrix', 'vector']
    },
    {
      names: ['chrome', 'firefox', 'edge', 'safari', 'browser'],
      contentType: 'browser',
      environment: 'research',
      urgency: 'low',
      keywords: ['website', 'search', 'article', 'page']
    },
    {
      names: ['exam', 'test', 'quiz', 'proctorio', 'lockdown', 'respondus'],
      contentType: 'exam',
      environment: 'exam',
      urgency: 'high',
      keywords: ['question', 'answer', 'multiple choice', 'essay']
    },
    {
      names: ['word', 'docs', 'notion', 'obsidian', 'notepad'],
      contentType: 'text',
      environment: 'study',
      urgency: 'low',
      keywords: ['document', 'note', 'text', 'writing']
    }
  ]

  private lastContext: ContextInfo | null = null
  private contextHistory: ContextInfo[] = []

  public async getCurrentContext(): Promise<ContextInfo> {
    try {
      const activeApp = await this.getActiveApplication()
      const context = this.analyzeContext(activeApp)
      
      // Store context history
      this.lastContext = context
      this.contextHistory.push(context)
      if (this.contextHistory.length > 10) {
        this.contextHistory.shift()
      }

      console.log(`[Context] Detected: ${context.activeApp} - ${context.contentType} (${context.confidence}%)`)
      return context

    } catch (error) {
      console.error('[Context] Failed to get current context:', error)
      return this.getDefaultContext()
    }
  }

  private async getActiveApplication(): Promise<string> {
    try {
      let command: string
      let activeApp: string

      if (process.platform === 'win32') {
        // Windows: Get active window title
        command = 'powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \\"\\"} | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize"'
        const output = execSync(command, { encoding: 'utf8' })
        activeApp = this.parseWindowsOutput(output)
      } else if (process.platform === 'darwin') {
        // macOS: Get active application
        command = 'osascript -e "tell application \\"System Events\\" to get name of first application process whose frontmost is true"'
        activeApp = execSync(command, { encoding: 'utf8' }).trim()
      } else {
        // Linux: Try xdotool or fallback
        try {
          command = 'xdotool getwindowfocus getwindowname'
          activeApp = execSync(command, { encoding: 'utf8' }).trim()
        } catch {
          activeApp = 'unknown'
        }
      }

      return activeApp.toLowerCase()

    } catch (error) {
      console.error('[Context] Failed to get active application:', error)
      return 'unknown'
    }
  }

  private parseWindowsOutput(output: string): string {
    try {
      const lines = output.split('\n').filter(line => line.trim())
      // Find the first process with a meaningful window title
      for (const line of lines) {
        if (line.includes('ProcessName') || line.includes('---')) continue
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
          return parts[0] // Return process name
        }
      }
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  private analyzeContext(activeApp: string): ContextInfo {
    let bestMatch: ApplicationPattern | null = null
    let maxScore = 0

    // Find best matching application pattern
    for (const pattern of this.applicationPatterns) {
      for (const name of pattern.names) {
        if (activeApp.includes(name)) {
          const score = name.length / activeApp.length // Longer matches get higher score
          if (score > maxScore) {
            maxScore = score
            bestMatch = pattern
          }
        }
      }
    }

    if (bestMatch) {
      return {
        activeApp,
        contentType: bestMatch.contentType,
        confidence: Math.min(90, maxScore * 100),
        suggestions: this.generateSuggestions(bestMatch),
        environment: bestMatch.environment,
        urgency: bestMatch.urgency
      }
    }

    return this.getDefaultContext()
  }

  private generateSuggestions(pattern: ApplicationPattern): string[] {
    const suggestions = []
    
    switch (pattern.contentType) {
      case 'code':
        suggestions.push('Explain this code', 'Debug this error', 'Optimize this function', 'Add comments')
        break
      case 'math':
        suggestions.push('Solve this equation', 'Explain this concept', 'Show step-by-step solution')
        break
      case 'exam':
        suggestions.push('Quick explanation', 'Key points only', 'Multiple choice help')
        break
      case 'browser':
        suggestions.push('Summarize this page', 'Explain this concept', 'Find key information')
        break
      case 'text':
        suggestions.push('Improve this writing', 'Check grammar', 'Summarize content')
        break
      default:
        suggestions.push('Analyze screen', 'Explain what you see', 'Provide help')
    }

    return suggestions
  }

  private getDefaultContext(): ContextInfo {
    return {
      activeApp: 'unknown',
      contentType: 'unknown',
      confidence: 0,
      suggestions: ['Analyze screen', 'Explain what you see', 'Provide help'],
      environment: 'general',
      urgency: 'low'
    }
  }

  public enhancePromptWithContext(prompt: string, context: ContextInfo): string {
    let enhancedPrompt = prompt

    // Add context-specific instructions
    switch (context.contentType) {
      case 'code':
        enhancedPrompt += '\n\nContext: User is in a development environment. Focus on code analysis, debugging, and programming concepts. Provide working code examples.'
        break
      case 'math':
        enhancedPrompt += '\n\nContext: User is working on mathematics. Show step-by-step solutions, use proper mathematical notation, and explain concepts clearly.'
        break
      case 'exam':
        enhancedPrompt += '\n\nContext: User appears to be taking an exam. Provide concise, direct answers. Focus on key concepts and avoid lengthy explanations.'
        break
      case 'browser':
        enhancedPrompt += '\n\nContext: User is browsing the web. Help summarize content, explain concepts from web pages, and provide research assistance.'
        break
      case 'text':
        enhancedPrompt += '\n\nContext: User is working with text documents. Help with writing, editing, summarizing, and content analysis.'
        break
    }

    // Add urgency context
    if (context.urgency === 'high') {
      enhancedPrompt += '\n\nUrgency: HIGH - Provide quick, direct answers.'
    }

    return enhancedPrompt
  }

  public getContextualShortcuts(context: ContextInfo): Array<{key: string, description: string, action: string}> {
    const shortcuts = []

    switch (context.contentType) {
      case 'code':
        shortcuts.push(
          { key: 'Ctrl+Shift+E', description: 'Explain Code', action: 'explain-code' },
          { key: 'Ctrl+Shift+D', description: 'Debug Error', action: 'debug-error' },
          { key: 'Ctrl+Shift+O', description: 'Optimize Code', action: 'optimize-code' }
        )
        break
      case 'math':
        shortcuts.push(
          { key: 'Ctrl+Shift+S', description: 'Solve Equation', action: 'solve-math' },
          { key: 'Ctrl+Shift+G', description: 'Graph Function', action: 'graph-function' }
        )
        break
      case 'exam':
        shortcuts.push(
          { key: 'Ctrl+Shift+Q', description: 'Quick Help', action: 'quick-help' },
          { key: 'Ctrl+Shift+M', description: 'Multiple Choice', action: 'mc-help' }
        )
        break
    }

    return shortcuts
  }

  public getRecentContexts(): ContextInfo[] {
    return this.contextHistory.slice(-5) // Return last 5 contexts
  }

  public isHighStealthMode(): boolean {
    return this.lastContext?.environment === 'exam' || this.lastContext?.urgency === 'high'
  }
} 