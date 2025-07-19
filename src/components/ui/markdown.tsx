import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownProps {
  children: string
  className?: string
}

export const Markdown: React.FC<MarkdownProps> = ({ children, className = "" }) => {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // Style headers
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-white mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-white mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-white mb-1">{children}</h3>
          ),
          
          // Style paragraphs
          p: ({ children }) => (
            <p className="text-gray-100 mb-2 leading-relaxed">{children}</p>
          ),
          
          // Style bold and italic
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-200">{children}</em>
          ),
          
          // Style lists
          ul: ({ children }) => (
            <ul className="list-none space-y-1 mb-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-2 ml-4">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-100">{children}</span>
            </li>
          ),
          
          // Style code blocks
          code: ({ children, className }) => {
            const isInline = !className
            
            if (isInline) {
              return (
                <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              )
            }
            
            return (
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2">
                <code>{children}</code>
              </pre>
            )
          },
          
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-800/50 rounded-r-lg mb-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
} 