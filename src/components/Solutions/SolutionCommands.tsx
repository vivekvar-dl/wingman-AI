import React, { useState, useEffect, useRef } from "react"
import { IoInformationCircleOutline, IoLogOutOutline } from "react-icons/io5"

interface SolutionCommandsProps {
  extraScreenshots: any[]
  onTooltipVisibilityChange?: (visible: boolean, height: number) => void
}

const SolutionCommands: React.FC<SolutionCommandsProps> = ({
  extraScreenshots,
  onTooltipVisibilityChange
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onTooltipVisibilityChange) {
      let tooltipHeight = 0
      if (tooltipRef.current && isTooltipVisible) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
    }
  }, [isTooltipVisible, onTooltipVisibilityChange])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* Main Command Bar */}
      <div className="backdrop-blur-md bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center justify-center gap-3">
        
        {/* Process Button */}
        {extraScreenshots.length > 0 && (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600/70 hover:bg-blue-600/80 text-white rounded-full text-sm font-medium transition-colors">
            <span>🔍</span>
            <span>Debug Code</span>
            <div className="flex items-center gap-1">
              <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">⌘</kbd>
              <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">↵</kbd>
            </div>
              </button>
        )}

        {/* Reset Button */}
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-full text-sm font-medium transition-colors">
          <span>🔄</span>
          <span>Reset</span>
          <div className="flex items-center gap-1">
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">⌘</kbd>
            <kbd className="bg-white/10 text-xs px-1.5 py-0.5 rounded">R</kbd>
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

        {/* More Options */}
        <button className="p-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-full transition-colors">
          <span className="text-lg">⋯</span>
        </button>

        {/* Quit Button */}
        <button
          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-full transition-colors"
          title="Quit App"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
            </div>

      {/* Tooltip */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 backdrop-blur-md bg-black/80 border border-white/10 rounded-xl p-4 text-white text-sm max-w-md z-50 shadow-xl"
        >
                    <div className="space-y-3">
            <div className="text-center font-medium text-white/90 mb-3">
              Debug Mode Shortcuts
                          </div>
            
            <div className="space-y-2">
                        <div className="flex items-center justify-between">
                <span>Debug Code</span>
                          <div className="flex gap-1">
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">⌘</kbd>
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">↵</kbd>
                          </div>
                        </div>
              
                        <div className="flex items-center justify-between">
                <span>Reset Session</span>
                          <div className="flex gap-1">
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">⌘</kbd>
                  <kbd className="bg-white/10 px-2 py-1 rounded text-xs">R</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
    </div>
  )
}

export default SolutionCommands
