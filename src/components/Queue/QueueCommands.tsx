import React, { useState, useEffect, useRef } from "react"
import { IoPlay, IoStop, IoChevronUp, IoChevronDown, IoArrowUp, IoClose, IoLogOutOutline } from "react-icons/io5"
import { Markdown } from "../ui/markdown"
import { startLiveAudio, type Role } from "../../lib/liveAudio"

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
  const [currentTranscription, setCurrentTranscription] = useState("")
  
  // Recording state
  const [isPaused, setIsPaused] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null)

  // Live transcription: mic + system audio → on-device VAD → one transcription per utterance
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState<Array<{ id: number; role: Role; text?: string }>>([])
  const stopAudioRef = useRef<(() => Promise<void>) | null>(null)
  const nextLineId = useRef(0)
  const lastQuestionTime = useRef(0)

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

  // Stop capture if this view unmounts mid-session
  useEffect(() => () => void stopAudioRef.current?.().catch(() => {}), [])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  // Each finished utterance gets a placeholder line right away (keeps order), filled in when its text arrives
  const handleSpeech = async (role: Role, wavBase64: string) => {
    const id = nextLineId.current++
    setTranscript(prev => [...prev, { id, role }])
    try {
      const { text } = await window.electronAPI.transcribeAudio(wavBase64)
      if (!text) {
        setTranscript(prev => prev.filter(line => line.id !== id))
        return
      }
      setTranscript(prev => prev.map(line => line.id === id ? { ...line, text } : line))

      const questions = detectQuestions(text)
      if (questions.length > 0 && Date.now() - lastQuestionTime.current > 2000) { // Prevent spam
        lastQuestionTime.current = Date.now()
        questions.forEach(question => addLiveInsight(question))
        handleInstantResponse(questions.join(" "))
      }
    } catch (error) {
      console.error('Transcription failed:', error)
      setTranscript(prev => prev.filter(line => line.id !== id))
    }
  }
  const handleSpeechRef = useRef(handleSpeech)
  handleSpeechRef.current = handleSpeech

  const startListening = () => {
    const session = startLiveAudio((role, wav) => handleSpeechRef.current(role, wav))
    const stop = () => session.then(stopAudio => stopAudio())
    stopAudioRef.current = stop
    setIsListening(true)
    setShowAskInterface(true) // the transcript lives in the panel
    setCurrentTranscription("")
    session.catch(error => {
      console.error('Failed to start listening:', error)
      if (stopAudioRef.current !== stop) return
      stopAudioRef.current = null
      setIsListening(false)
      setCurrentTranscription("Couldn't start listening. Please check your microphone permissions.")
    })
  }

  const stopListening = () => {
    stopAudioRef.current?.().catch(() => {}) // start failures are reported by startListening
    stopAudioRef.current = null
    setIsListening(false)
  }

  const handleRecordClick = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
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
    if (e.key === 'Enter' && !e.shiftKey) {
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

  const handleInsightClick = (insight: LiveInsight) => {
    setLiveInsights(prev => prev.map(i => i.id === insight.id ? { ...i, isAnswered: true } : i))
    handleInstantResponse(insight.question)
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

  // Keep the newest line in view
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [transcript, conversations])

  const hasContent = transcript.length > 0 || conversations.length > 0 || liveInsights.length > 0
  const roundBtn = "pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full cl-grey cl-hover text-white"

  return (
    <div className="w-full max-w-[540px] mx-auto relative">
      {/* Control pill */}
      <div className="mx-auto flex h-[50px] w-fit items-center gap-1.5 rounded-full cl-glass pl-3 pr-[9px] select-none">
        <div
          className="mr-1.5 size-[26px] shrink-0 rounded-full"
          style={{ background: "conic-gradient(from 270deg at 50% 50%, #3e42be 0deg, #2cb8ff 128deg, #9b4dfa 202deg, #3e42be 359deg)" }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />

        <button
          onClick={handleAskClick}
          className="flex h-8 w-[66px] shrink-0 items-center justify-center gap-1 rounded-full cl-blue cl-hover text-xs font-semibold text-white"
        >
          {showAskInterface ? <IoChevronUp className="size-3.5" /> : <IoChevronDown className="size-3.5" />}
          {showAskInterface ? "Hide" : "Ask"}
        </button>

        <button
          onClick={handleRecordClick}
          aria-label={isListening ? "Stop listening" : "Start listening"}
          title={isListening ? "Stop listening" : "Start listening"}
          className={roundBtn}
        >
          {isListening ? <IoStop className="size-3.5 text-red-400" /> : <IoPlay className="size-4 ml-0.5" />}
        </button>

        <button
          onClick={() => window.electronAPI.quitApp()}
          aria-label="Quit"
          title="Quit"
          className={roundBtn}
        >
          <IoLogOutOutline className="size-4 text-white/70" />
        </button>
      </div>

      {/* Chat panel */}
      {showAskInterface && (
        <div className="mt-2 overflow-hidden rounded-[22px] cl-glass text-[13px] text-white">
          {(hasContent || isListening || currentTranscription) && (
            <div
              ref={scrollRef}
              className="max-h-72 space-y-2.5 overflow-y-auto px-3 pt-3 pb-1"
            >
              {/* Live transcript: you right (blue), them left (grey) */}
              {transcript.map(line => (
                <div key={line.id} className={`flex ${line.role === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] whitespace-pre-wrap break-words px-3 py-2 ${
                      line.role === "me" ? "cl-blue rounded-[11px] rounded-br-[4px]" : "cl-grey rounded-[11px] rounded-bl-[4px]"
                    }`}
                  >
                    {line.text ?? <span className="text-white/50">…</span>}
                  </div>
                </div>
              ))}
              {isListening && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                  {transcript.length === 0 ? "Listening to your mic and system audio…" : "Listening…"}
                </div>
              )}
              {!isListening && currentTranscription && (
                <div className="text-xs text-zinc-400">{currentTranscription}</div>
              )}

              {/* Q&A: question right (blue), answer plain */}
              {conversations.map(conv => (
                <div key={conv.timestamp} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[70%] whitespace-pre-wrap break-words px-3 py-2 cl-blue rounded-[11px] rounded-br-[4px]">
                      {conv.question}
                    </div>
                  </div>
                  <div className="px-1 pb-1 text-white/90 select-text">
                    <Markdown>{conv.answer}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detected questions as quick-action chips */}
          {liveInsights.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1 px-2.5 pt-2 text-xs">
              {liveInsights.slice(0, 3).map((insight, i) => (
                <React.Fragment key={insight.id}>
                  {i > 0 && <span className="text-zinc-500">·</span>}
                  <button
                    onClick={() => handleInsightClick(insight)}
                    title={insight.question}
                    className={`max-w-[170px] truncate rounded-full px-2 py-1.5 font-medium transition hover:bg-white/15 hover:text-white ${
                      insight.isAnswered ? "text-zinc-500" : "text-white/80"
                    }`}
                  >
                    {insight.question}
                  </button>
                </React.Fragment>
              ))}
              <button onClick={() => setLiveInsights([])} className="ml-auto p-1 text-zinc-500 hover:text-white" title="Clear questions">
                <IoClose className="size-3" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="px-2.5 pt-1.5 pb-2.5">
            <div className="relative overflow-hidden rounded-md border-[0.5px] border-white/20 bg-white/5">
              <input
                ref={questionInputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about your screen or conversation…"
                disabled={isSubmitting}
                className="w-full bg-transparent py-2.5 pl-2.5 pr-10 text-[13px] font-medium text-white placeholder-zinc-400 focus:outline-none"
              />
              <button
                onClick={handleSubmitQuestion}
                disabled={!question.trim() || isSubmitting}
                aria-label="Send"
                className="absolute right-[7px] top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full cl-blue cl-hover text-white disabled:opacity-40"
              >
                {isSubmitting
                  ? <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <IoArrowUp className="size-3.5" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-0.5 text-xs text-zinc-400">
              <button onClick={toggleSmartMode} className="transition hover:text-white">
                {isSmartMode ? "⚡ Smart" : "💬 Normal"}
              </button>
              {conversations.length > 0 && (
                <button onClick={handleClearConversations} className="transition hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts tooltip (hover the orb) */}
      {isTooltipVisible && (
        <div
          ref={tooltipRef}
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-xl cl-glass px-4 py-3 text-xs text-white"
        >
          {[["Ask", "Ctrl ↵"], ["Show/Hide", "Ctrl B"]].map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-6 py-0.5">
              <span>{label}</span>
              <span className="flex gap-1">
                {keys.split(" ").map(k => (
                  <kbd key={k} className="rounded border border-white/20 px-1.5 py-0.5">{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default QueueCommands
