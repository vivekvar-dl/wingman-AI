# 🚀 Wingman AI - Your Intelligent Desktop Co-Pilot

[![Stars](https://img.shields.io/github/stars/vivekvar-dl/wingman-AI?style=for-the-badge)](https://github.com/vivekvar-dl/wingman-AI/stargazers)
[![Forks](https://img.shields.io/github/forks/vivekvar-dl/wingman-AI?style=for-the-badge)](https://github.com/vivekvar-dl/wingman-AI/network/members)
[![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.2.0-47848F?style=for-the-badge&logo=electron)](https://www.electronjs.org/)

**An AI-powered desktop assistant that provides instant help for coding, interviews, exams, and any knowledge-based task—right when you need it.**

Built with Electron, React, and Google Gemini AI. Stealth-enabled, lightning-fast, and works offline.

![Wingman AI Demo](image.png)

---

## ✨ Features

### 🤖 **AI-Powered Intelligence**
- **Google Gemini 2.0 Flash** - Lightning-fast AI responses
- **Smart Mode Toggle** - Optimized for coding vs general questions
- **Subject Detection** - Auto-detects math, code, chemistry, physics, biology, and more
- **Context-Aware** - Adapts responses based on your current application

### 🎤 **Real-Time Voice Input**
- **Live Transcription** - Words appear as you speak
- **Instant Q&A** - Get answers in 1-2 seconds
- **Hands-Free Operation** - No typing required
- **Subject Categorization** - Questions auto-tagged by topic

### 📸 **Screen Analysis (OCR)**
- **Text Extraction** - Pull text from screenshots using Tesseract.js
- **Image Enhancement** - Pre-processing for better OCR accuracy
- **"What's on my screen?"** - AI analyzes your current screen
- **Supports** - Code, formulas, diagrams, PDFs, and more

### 🎭 **Stealth Mode**
- **Maximum Privacy** - Advanced window and process hiding
- **Anti-Detection** - Evades monitoring software
- **Minimal Footprint** - Low CPU/memory usage
- **Randomized Behavior** - Unpredictable patterns

### ⚡ **Performance**
- **Intelligent Caching** - Similarity-based response caching
- **< 2s Response Time** - Typical text questions
- **< 100MB RAM** - Lightweight and efficient
- **Offline OCR** - Works without internet for text extraction

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.0.0
- **npm** ≥ 8.0.0
- **Google Gemini API Key** ([Get one here](https://ai.google.dev/))

### Installation

```bash
# Clone the repo
git clone https://github.com/vivekvar-dl/wingman-AI.git
cd wingman-AI

# Install dependencies
npm install

# Set up your API key
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Start development
npm run app:dev
```

### Build for Production

```bash
npm run app:build
# Built app in `release/` folder
```

---

## 🎮 Usage

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl + B` | Toggle window visibility |
| `Ctrl + Enter` | Submit question |
| `Ctrl + T` | Toggle Ask interface |
| `Ctrl + \` | Hide/Show application |
| `Ctrl + Q` | Quit application |

### Voice Commands
1. Click **"Start Listening"**
2. Speak naturally - questions are auto-detected
3. Get instant AI responses
4. Click **"Done"** to stop and save

### Screen Analysis
1. Take a screenshot (or use `Ctrl + Shift + S`)
2. Ask "What's on my screen?"
3. AI analyzes text, code, math, or diagrams
4. Get instant explanations or solutions

---

## 🛠️ Tech Stack

**Frontend**
- React 18 + TypeScript
- Tailwind CSS
- React Query
- React Markdown

**Backend**
- Electron 33
- Google Generative AI
- Tesseract.js (OCR)
- Sharp (Image Processing)

**Build Tools**
- Vite
- Electron Builder
- ESLint + TypeScript

---

## 📦 Project Structure

```
wingman-AI/
├── electron/               # Main process logic
│   ├── LLMHelper.ts       # AI integration
│   ├── CacheHelper.ts     # Smart caching
│   ├── OCRHelper.ts       # Text extraction
│   ├── StealthHelper.ts   # Stealth features
│   └── main.ts            # App state
├── src/                   # Renderer (React UI)
├── renderer/              # Public assets
├── package.json
└── README.md
```

---

## 🔒 Privacy & Security

- **Local-First** - All processing happens on your machine
- **No Cloud Storage** - Your data never leaves your device
- **Secure API Calls** - Encrypted communication with AI providers
- **Temporary Caching** - Auto-cleared on exit

---

## 🤝 Contributing

Contributions welcome! Here's how:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Code Standards:**
- TypeScript strict mode
- ESLint for code quality
- Conventional Commits

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) - Powering the intelligence
- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine
- [React](https://react.dev/) - UI framework

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/vivekvar-dl/wingman-AI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/vivekvar-dl/wingman-AI/discussions)

---

**⭐ Star this repo if you find it useful!**

**Built with ❤️ by [Vivek Varikuti](https://vivekvari.dev)**
