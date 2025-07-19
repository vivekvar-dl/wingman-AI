import React, { useState, useEffect, useRef } from "react"
import { IoInformationCircleOutline, IoLogOutOutline, IoSend, IoClose } from "react-icons/io5"
import { Markdown } from "../ui/markdown"

interface QueueCommandsProps {
  onTooltipVisibilityChange?: (visible: boolean, height: number) => void
  screenshots: Array<{ path: string; preview: string }>
}

interface Conversation {
  question: string
  answer: string
  timestamp: number
}

interface LiveInsight {
  id: string
  question: string
  timestamp: number
  category: string
  isAnswered: boolean
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  
  // Ask interface state
  const [showAskInterface, setShowAskInterface] = useState(false)
  const [question, setQuestion] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isSmartMode, setIsSmartMode] = useState(true) // Add smart mode toggle
  const questionInputRef = useRef<HTMLInputElement>(null)

  // Live insights state
  const [liveInsights, setLiveInsights] = useState<LiveInsight[]>([])
  const [showLiveInsights, setShowLiveInsights] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState("")
  const [selectedInsight, setSelectedInsight] = useState<LiveInsight | null>(null)
  const [insightAnswer, setInsightAnswer] = useState("")
  
  // Recording state
  const [isPaused, setIsPaused] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null)

  // Fast real-time transcription using Web Speech API
  const [speechRecognition, setSpeechRecognition] = useState<any>(null)
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [finalTranscript, setFinalTranscript] = useState("")
  const [lastQuestionTime, setLastQuestionTime] = useState(0)

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange?.(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  useEffect(() => {
    if (showAskInterface && questionInputRef.current) {
      questionInputRef.current.focus()
    }
  }, [showAskInterface])

  useEffect(() => {
    // Initialize Web Speech API for fast real-time transcription
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      
      recognition.onstart = () => {
        setIsListening(true)
        setInterimTranscript("")
        setFinalTranscript("")
      }
      
      recognition.onresult = (event: any) => {
        let interim = ""
        let final = ""
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += transcript + " "
            
            // Fast question detection on final results
            const questions = detectQuestions(transcript)
            if (questions.length > 0) {
              const now = Date.now()
              if (now - lastQuestionTime > 2000) { // Prevent spam
                setLastQuestionTime(now)
                questions.forEach(question => addLiveInsight(question))
                
                // Instant AI response to the question
                handleInstantResponse(question)
              }
            }
          } else {
            interim += transcript
          }
        }
        
        setInterimTranscript(interim)
        setFinalTranscript(prev => prev + final)
        setCurrentTranscription(prev => prev + final)
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognition.onend = () => {
        setIsListening(false)
      }
      
      setSpeechRecognition(recognition)
    }
  }, [lastQuestionTime])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  const handleRecordClick = async () => {
    if (isListening) {
      // Stop listening
      if (speechRecognition) {
        speechRecognition.stop()
      }
      setIsListening(false)
      setShowLiveInsights(false)
    } else {
      // Start listening with Web Speech API for instant transcription
      if (speechRecognition) {
        try {
          speechRecognition.start()
          setShowLiveInsights(true)
          setCurrentTranscription("Listening... Speak naturally and I'll detect your questions instantly!")
        } catch (error) {
          console.error('Failed to start speech recognition:', error)
          setCurrentTranscription("Speech recognition not available. Please check your microphone permissions.")
        }
      } else {
        setCurrentTranscription("Speech recognition not supported in this browser.")
      }
    }
  }

  const handlePauseResume = () => {
    if (isListening) {
      if (speechRecognition) {
        speechRecognition.stop()
        setIsListening(false)
      }
    } else {
      if (speechRecognition) {
        speechRecognition.start()
        setIsListening(true)
      }
    }
  }

  const handleDone = () => {
    if (speechRecognition) {
      speechRecognition.stop()
    }
    setIsListening(false)
    setShowLiveInsights(false)
    setCurrentTranscription("Listening stopped. Your questions and answers are saved above.")
  }

  const handleAskClick = () => {
    setShowAskInterface(!showAskInterface)
  }

  const handleSubmitQuestion = async () => {
    if (!question.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Check if the question is about screen content
      const isScreenQuestion = /\b(screen|display|what.*see|what.*showing|what.*this|analyze.*screen|about.*screen)\b/i.test(question.trim())
      
      let result;
      if (isScreenQuestion) {
        // Take a screenshot first, then analyze with the question
        const screenshot = await window.electronAPI.takeScreenshot()
        // Get the latest screenshot path
        const screenshots = await window.electronAPI.getScreenshots()
        if (screenshots.length > 0) {
          const latestScreenshot = screenshots[screenshots.length - 1]
          result = await window.electronAPI.analyzeScreenWithQuestion(latestScreenshot.path, question.trim(), isSmartMode)
        } else {
          throw new Error("Failed to capture screen")
        }
      } else {
        // Regular text question with mode
        result = await window.electronAPI.analyzeTextQuestion(question.trim(), isSmartMode)
      }
      
      const newConversation: Conversation = {
        question: question.trim(),
        answer: result.text,
        timestamp: Date.now()
      }
      
      setConversations(prev => [...prev, newConversation])
      setQuestion("")
            } catch (err) {
      console.error('Failed to get answer:', err)
      // Show error in conversation
      const errorConversation: Conversation = {
        question: question.trim(),
        answer: "Sorry, I couldn't process your question. Please try again.",
        timestamp: Date.now()
      }
      setConversations(prev => [...prev, errorConversation])
      setQuestion("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSmartMode = () => {
    setIsSmartMode(!isSmartMode)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmitQuestion()
            }
          }

  const handleClearConversations = () => {
    setConversations([])
    // setShowAskInterface(false) - removed to keep Ask open
    setQuestion("")
  }

  // Live insights functions
  const detectQuestions = (text: string): string[] => {
    const questionPatterns = [
      /\b(what|how|why|when|where|which|who)\b.*\?/gi,
      /\b(explain|describe|tell me about|what is|how to|can you)\b/gi,
      /\b(define|show me|give me|help me with)\b/gi
    ]
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const questions: string[] = []
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim()
      if (trimmed.length < 10) return // Skip very short sentences
      
      // Skip sentences that are likely AI responses, not user questions
      const lowerSentence = trimmed.toLowerCase()
      if (
        lowerSentence.includes('here\'s') ||
        lowerSentence.includes('based on') ||
        lowerSentence.includes('for example') ||
        lowerSentence.includes('if the user') ||
        lowerSentence.includes('**') ||
        lowerSentence.includes('* ') ||
        lowerSentence.startsWith('based on the audio') ||
        lowerSentence.startsWith('here\'s how') ||
        lowerSentence.startsWith('for example:') ||
        lowerSentence.includes('common examples') ||
        lowerSentence.includes('general information')
      ) {
        return // Skip AI response patterns
      }
      
      for (const pattern of questionPatterns) {
        if (pattern.test(trimmed)) {
          // Additional check: make sure it's a real question, not part of an explanation
          if (!trimmed.includes('**') && !trimmed.includes('* ') && !trimmed.includes('For example')) {
            questions.push(trimmed)
          }
          break
        }
      }
    })
    
    return questions
  }

  const categorizeQuestion = (question: string): string => {
    const lowerQuestion = question.toLowerCase()
    
    if (/\b(python|javascript|java|c\+\+|html|css|react|node|sql|database)\b/.test(lowerQuestion)) {
      return "Programming"
    } else if (/\b(function|class|method|variable|loop|array|object)\b/.test(lowerQuestion)) {
      return "Coding Concepts"
    } else if (/\b(algorithm|data structure|sorting|searching|complexity)\b/.test(lowerQuestion)) {
      return "Algorithms"
    } else if (/\b(math|equation|formula|calculation|number)\b/.test(lowerQuestion)) {
      return "Mathematics"
    } else {
      return "General"
    }
  }

  const addLiveInsight = (question: string) => {
    // Clean the question
    const cleanQuestion = question.trim()
    
    // Skip if question is too short or contains AI response patterns
    if (cleanQuestion.length < 10) return
    
    const lowerQuestion = cleanQuestion.toLowerCase()
    if (
      lowerQuestion.includes('here\'s') ||
      lowerQuestion.includes('based on') ||
      lowerQuestion.includes('for example') ||
      lowerQuestion.includes('if the user') ||
      lowerQuestion.includes('**') ||
      lowerQuestion.includes('* ') ||
      lowerQuestion.startsWith('based on the audio') ||
      lowerQuestion.startsWith('here\'s how') ||
      lowerQuestion.startsWith('for example:') ||
      lowerQuestion.includes('common examples') ||
      lowerQuestion.includes('general information')
    ) {
      return // Skip AI response patterns
    }
    
    // Check for duplicates
    const isDuplicate = liveInsights.some(insight => 
      insight.question.toLowerCase() === cleanQuestion.toLowerCase()
    )
    
    if (isDuplicate) return
    
    const insight: LiveInsight = {
      id: Date.now().toString(),
      question: cleanQuestion,
      timestamp: Date.now(),
      category: categorizeQuestion(cleanQuestion),
      isAnswered: false
    }
    
    setLiveInsights(prev => [insight, ...prev.slice(0, 9)]) // Keep last 10 insights
  }

  const handleInsightClick = async (insight: LiveInsight) => {
    setSelectedInsight(insight)
    setInsightAnswer("")
    
    try {
      const result = await window.electronAPI.analyzeTextQuestion(insight.question, isSmartMode)
      setInsightAnswer(result.text)
      
      // Mark as answered
      setLiveInsights(prev => 
        prev.map(i => i.id === insight.id ? { ...i, isAnswered: true } : i)
      )
    } catch (error) {
      setInsightAnswer("Sorry, I couldn't process this question right now.")
    }
  }

  const clearLiveInsights = () => {
    setLiveInsights([])
    setSelectedInsight(null)
    setInsightAnswer("")
  }

  const handleInstantResponse = async (question: string) => {
    try {
      const result = await window.electronAPI.analyzeTextQuestion(question, isSmartMode)
      const newConversation: Conversation = {
        question: question,
        answer: result.text,
        timestamp: Date.now()
      }
      setConversations(prev => [...prev, newConversation])
      setQuestion("") // Clear the question input after instant response
    } catch (err) {
      console.error('Failed to get instant answer:', err)
      const errorConversation: Conversation = {
        question: question,
        answer: "Sorry, I couldn't process your question right now.",
        timestamp: Date.now()
      }
      setConversations(prev => [...prev, errorConversation])
      setQuestion("")
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* Main Command Bar */}
      <div className="backdrop-blur-md bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center justify-center gap-3">
        
        {/* Listen Button */}
        <button
          onClick={handleRecordClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
          }`}
        >
          {isListening ? (
            <>
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              Stop Listening
            </>
          ) : (
            <>
              <div className="w-3 h-3 bg-white rounded-full"></div>
              Start Listening
            </>
          )}
        </button>

        {/* Pause/Resume Button */}
        {isListening && (
          <button
            onClick={handlePauseResume}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-all duration-200"
          >
            <span className="text-sm">⏸️</span>
            Pause
            </button>
        )}

        {/* Done Button */}
        {isListening && (
          <button
            onClick={handleDone}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-all duration-200"
          >
            <span className="text-sm">✅</span>
            Done
            </button>
        )}

        {/* Ask Button */}
        <button 
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            showAskInterface 
              ? 'bg-blue-600/70 text-white shadow-lg shadow-blue-600/25' 
              : 'bg-gray-700/50 text-white hover:bg-gray-600/50'
          }`}
          onClick={handleAskClick}
        >
          <span>💬</span>
          <span>Ask</span>
          <div className="flex items-center gap-1">
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">Ctrl</kbd>
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">↵</kbd>
          </div>
            </button>

        {/* Show/Hide Button */}
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-full text-sm font-medium transition-colors">
          <span>Show/Hide</span>
          <div className="flex items-center gap-1">
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">Ctrl</kbd>
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">B</kbd>
          </div>
        </button>

        {/* Info Button */}
        <button
          className="p-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-full transition-colors"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <IoInformationCircleOutline className="w-4 h-4" />
        </button>

        {/* Clear/Reset Button */}
        {(conversations.length > 0) && (
          <button
            className="p-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 rounded-full transition-colors"
            title="Clear Conversation"
            onClick={handleClearConversations}
          >
            <IoClose className="w-4 h-4" />
          </button>
        )}

        {/* Quit Button */}
        <button
          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-full transition-colors"
          title="Quit App"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
        </div>

      {/* Ask Interface */}
      {showAskInterface && (
        <div className="mt-3 backdrop-blur-md bg-gray-900/95 border border-gray-700/50 rounded-xl shadow-xl transition-all duration-300 ease-in-out max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center">
                <span className="text-blue-400 text-xs">🤖</span>
              </div>
              <span className="text-white font-medium text-sm">AI Response</span>
            </div>
          <div className="flex items-center gap-2">
              <button
                onClick={toggleSmartMode}
                className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all duration-200 text-xs ${
                  isSmartMode 
                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-300' 
                    : 'bg-gray-600/20 border-gray-500/30 text-gray-300'
                }`}
              >
                <span>{isSmartMode ? '⚡' : '💬'}</span>
                <span className="font-medium">{isSmartMode ? 'Smart' : 'Normal'}</span>
              </button>
              <button
                onClick={handleAskClick}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Close Ask Interface"
              >
                <IoClose className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="max-h-64 overflow-y-auto p-3">
            {/* Conversation History */}
            {conversations.length > 0 ? (
              <div className="space-y-3">
                {conversations.map((conv, index) => (
                  <div key={conv.timestamp} className="space-y-2">
                    {/* Question */}
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-xs">💬</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                          <div className="text-gray-300 text-xs">{conv.question}</div>
                        </div>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-400 text-xs">🤖</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-800/30 rounded-lg p-2 border border-gray-700/20">
                          <div className="text-white text-xs">
                            <Markdown>{conv.answer}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-700/50 bg-gray-900/50">
        <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  ref={questionInputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isSmartMode 
                    ? "Ask about your screen or any coding question..." 
                    : "Ask anything..."
                  }
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:bg-gray-800/70 transition-all duration-200 text-sm"
                  disabled={isSubmitting}
                />
              </div>
          <button
                onClick={handleSubmitQuestion}
                disabled={!question.trim() || isSubmitting}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-1 text-sm ${
                  question.trim() && !isSubmitting
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                }`}
          >
                {isSubmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </>
            ) : (
                  <>
                    <IoSend className="w-3 h-3" />
                    <span>Submit</span>
                  </>
            )}
          </button>
        </div>

            {/* Clear conversations button */}
            {conversations.length > 0 && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleClearConversations}
                  className="text-gray-400 hover:text-white text-xs transition-colors flex items-center gap-1"
        >
                  <IoClose className="w-2 h-2" />
                  Clear conversation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Insights Panel */}
      {showLiveInsights && (
        <div className="mt-4 p-4 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-blue-400">🔴</span>
              Live Insights
              {isListening && (
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">
                  LIVE
                </span>
              )}
            </h3>
            <button
              onClick={clearLiveInsights}
              className="text-gray-400 hover:text-white text-sm"
            >
              Clear
            </button>
          </div>
          
          {/* Real-time Transcription */}
          <div className="mb-4">
            <div className="text-sm text-gray-300 mb-2">Real-time Transcription:</div>
            <div className="bg-gray-900/50 p-3 rounded-lg text-white text-sm min-h-[60px]">
              {currentTranscription || "Waiting for speech..."}
              {interimTranscript && (
                <span className="text-gray-400 italic">
                  {interimTranscript}
                </span>
              )}
            </div>
          </div>

          {/* Detected Questions */}
          <div>
            <div className="text-sm text-gray-300 mb-2">Detected Questions ({liveInsights.length}):</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {liveInsights.length === 0 ? (
                <div className="text-gray-500 text-sm italic">No questions detected yet...</div>
              ) : (
                liveInsights.map((insight) => (
                  <div
                    key={insight.id}
                    onClick={() => handleInsightClick(insight)}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      insight.isAnswered
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{insight.question}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {insight.category} • {new Date(insight.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {insight.isAnswered ? '✅ Answered' : '⏳ Processing...'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
          {isTooltipVisible && (
            <div
              ref={tooltipRef}
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 backdrop-blur-md bg-black/80 border border-white/10 rounded-xl p-4 text-white text-sm max-w-md z-50 shadow-xl"
            >
                  <div className="space-y-3">
            <div className="text-center font-medium text-white/90 mb-3">
              Keyboard Shortcuts
                    </div>

            <div className="space-y-2">
                      <div className="flex items-center justify-between">
                <span>Submit Question</span>
                <div className="flex gap-1">
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">Ctrl</kbd>
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">↵</kbd>
                        </div>
                    </div>

                      <div className="flex items-center justify-between">
                <span>Toggle Visibility</span>
                <div className="flex gap-1">
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">Ctrl</kbd>
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">B</kbd>
                </div>
              </div>
            </div>
      </div>
        </div>
      )}
    </div>
  )
}

export default QueueCommands
