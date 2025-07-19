"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectDetector = void 0;
class SubjectDetector {
    subjects = [
        {
            name: 'mathematics',
            keywords: [
                'equation', 'integral', 'derivative', 'function', 'variable', 'solve', 'calculate',
                'matrix', 'vector', 'theorem', 'proof', 'formula', 'graph', 'limit', 'polynomial',
                'trigonometry', 'calculus', 'algebra', 'geometry', 'statistics', 'probability'
            ],
            patterns: [
                /\b(f\(x\)|g\(x\)|h\(x\))\b/g,
                /\b\d+x\b|\bx\^\d+\b/g,
                /\b(sin|cos|tan|log|ln|sqrt)\b/g,
                /[∫∑∏∂∆∇]/g,
                /\b\d+\s*[+\-*/]\s*\d+\b/g
            ],
            confidence_boost: 0.2,
            specialized_prompts: {
                smart: 'Provide step-by-step mathematical solutions with proper notation. Show work clearly and explain each step. Include alternative methods if applicable.',
                normal: 'Explain this math problem in simple terms. Break down the solution into easy-to-follow steps.'
            }
        },
        {
            name: 'programming',
            keywords: [
                'function', 'class', 'variable', 'method', 'import', 'export', 'const', 'let', 'var',
                'array', 'object', 'string', 'boolean', 'integer', 'loop', 'condition', 'algorithm',
                'debug', 'error', 'exception', 'syntax', 'compile', 'runtime', 'api', 'library'
            ],
            patterns: [
                /\b(function|def|class|public|private|protected)\s+\w+/g,
                /\b(if|else|while|for|switch|case)\b/g,
                /\b(int|string|bool|float|double|char)\b/g,
                /[{}()[\];]/g,
                /\b(console\.log|print|printf|System\.out)\b/g
            ],
            confidence_boost: 0.25,
            specialized_prompts: {
                smart: 'Analyze this code thoroughly. Provide detailed explanations, identify potential issues, suggest optimizations, and include best practices. Show alternative implementations if relevant.',
                normal: 'Explain this code in simple terms. What does it do and how does it work?'
            }
        },
        {
            name: 'chemistry',
            keywords: [
                'molecule', 'atom', 'reaction', 'compound', 'element', 'bond', 'electron', 'proton',
                'neutron', 'acid', 'base', 'ph', 'molarity', 'catalyst', 'oxidation', 'reduction',
                'organic', 'inorganic', 'periodic', 'table', 'valence', 'ionic', 'covalent'
            ],
            patterns: [
                /\b[A-Z][a-z]?\d*\b/g, // Chemical formulas like H2O, NaCl
                /\b(H2O|CO2|NaCl|HCl|NaOH|CH4)\b/g,
                /\b\d+\s*mol\b/g,
                /→|⇌/g, // Reaction arrows
                /\b(pH|pOH)\s*=?\s*\d+/g
            ],
            confidence_boost: 0.3,
            specialized_prompts: {
                smart: 'Provide detailed chemical analysis including molecular structures, reaction mechanisms, thermodynamics, and kinetics. Include balanced equations and theoretical explanations.',
                normal: 'Explain this chemistry concept in simple terms. What happens and why?'
            }
        },
        {
            name: 'physics',
            keywords: [
                'force', 'energy', 'momentum', 'velocity', 'acceleration', 'gravity', 'mass',
                'charge', 'current', 'voltage', 'resistance', 'wave', 'frequency', 'amplitude',
                'quantum', 'relativity', 'electromagnetic', 'thermal', 'nuclear', 'particle'
            ],
            patterns: [
                /\b(F\s*=\s*ma|E\s*=\s*mc²|v\s*=\s*at)\b/g,
                /\b\d+\s*(m\/s|kg|N|J|W|V|A|Ω|Hz)\b/g,
                /\b(sin|cos|tan)\s*\(\s*\w+\s*\)/g,
                /[αβγδεθλμπσφψω]/g, // Greek letters common in physics
                /\b(Newton|Einstein|Planck|Heisenberg)\b/g
            ],
            confidence_boost: 0.25,
            specialized_prompts: {
                smart: 'Provide comprehensive physics analysis including formulas, derivations, units, and real-world applications. Show mathematical relationships and explain underlying principles.',
                normal: 'Explain this physics concept simply. What\'s happening and what are the basic principles?'
            }
        },
        {
            name: 'biology',
            keywords: [
                'cell', 'dna', 'rna', 'protein', 'gene', 'chromosome', 'organism', 'species',
                'evolution', 'natural selection', 'ecosystem', 'photosynthesis', 'respiration',
                'mitosis', 'meiosis', 'virus', 'bacteria', 'membrane', 'nucleus', 'enzyme'
            ],
            patterns: [
                /\b(DNA|RNA|ATP|ADP)\b/g,
                /\b(A|T|G|C|U)\s*-\s*(T|A|C|G|A)\b/g, // Base pairs
                /\b\w+ase\b/g, // Enzymes ending in -ase
                /\b(prokaryote|eukaryote|organelle)\b/g,
                /\b(Homo sapiens|E\. coli)\b/g
            ],
            confidence_boost: 0.2,
            specialized_prompts: {
                smart: 'Provide detailed biological analysis including molecular mechanisms, cellular processes, evolutionary context, and experimental evidence. Include relevant pathways and interactions.',
                normal: 'Explain this biology concept in everyday terms. How does this work in living things?'
            }
        },
        {
            name: 'literature',
            keywords: [
                'author', 'novel', 'poem', 'character', 'theme', 'symbolism', 'metaphor',
                'plot', 'setting', 'narrative', 'prose', 'verse', 'analysis', 'interpretation',
                'literary', 'fiction', 'non-fiction', 'genre', 'style', 'tone', 'mood'
            ],
            patterns: [
                /\b(Shakespeare|Dickens|Austen|Hemingway|Fitzgerald)\b/g,
                /\b(Chapter|Act|Scene)\s+\d+/g,
                /["''][^"'']*["'"]/g, // Quoted text
                /\b(protagonist|antagonist|climax|denouement)\b/g,
                /\b\d{4}\s*(novel|book|poem|play)\b/g
            ],
            confidence_boost: 0.15,
            specialized_prompts: {
                smart: 'Provide in-depth literary analysis including themes, symbolism, historical context, literary devices, and critical interpretations. Reference relevant literary theory.',
                normal: 'Explain this literature topic simply. What\'s the main idea and why is it important?'
            }
        }
    ];
    detectSubject(text, extractedText) {
        const combinedText = `${text} ${extractedText || ''}`.toLowerCase();
        const scores = {};
        const foundKeywords = {};
        // Calculate scores for each subject
        for (const subject of this.subjects) {
            let score = 0;
            const keywords = [];
            // Check keywords
            for (const keyword of subject.keywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = combinedText.match(regex);
                if (matches) {
                    score += matches.length * 0.1;
                    keywords.push(keyword);
                }
            }
            // Check patterns
            for (const pattern of subject.patterns) {
                const matches = combinedText.match(pattern);
                if (matches) {
                    score += matches.length * subject.confidence_boost;
                }
            }
            scores[subject.name] = score;
            foundKeywords[subject.name] = keywords;
        }
        // Find the subject with highest score
        const bestSubject = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        const confidence = Math.min(100, scores[bestSubject] * 10);
        const subjectPattern = this.subjects.find(s => s.name === bestSubject);
        return {
            subject: bestSubject,
            confidence,
            keywords_found: foundKeywords[bestSubject] || [],
            suggestions: this.generateSuggestions(bestSubject),
            specialized_prompt: subjectPattern.specialized_prompts.smart
        };
    }
    generateSuggestions(subject) {
        const suggestions = {
            mathematics: [
                'Solve step by step',
                'Show all work',
                'Explain the concept',
                'Check my answer',
                'Graph this function'
            ],
            programming: [
                'Explain this code',
                'Debug this error',
                'Optimize performance',
                'Add comments',
                'Suggest improvements'
            ],
            chemistry: [
                'Balance this equation',
                'Explain the reaction',
                'Draw the structure',
                'Calculate molarity',
                'Predict products'
            ],
            physics: [
                'Solve this problem',
                'Explain the principle',
                'Show the formula',
                'Draw a diagram',
                'Find the units'
            ],
            biology: [
                'Explain the process',
                'Draw the pathway',
                'Compare structures',
                'Describe function',
                'Trace the flow'
            ],
            literature: [
                'Analyze themes',
                'Explain symbolism',
                'Identify devices',
                'Historical context',
                'Character analysis'
            ]
        };
        return suggestions[subject] || ['Analyze content', 'Explain concept', 'Provide help'];
    }
    enhancePromptWithSubject(basePrompt, detection, isSmartMode) {
        if (detection.confidence < 30) {
            return basePrompt; // Not confident enough to specialize
        }
        const subjectPattern = this.subjects.find(s => s.name === detection.subject);
        if (!subjectPattern) {
            return basePrompt;
        }
        const specializedInstruction = isSmartMode
            ? subjectPattern.specialized_prompts.smart
            : subjectPattern.specialized_prompts.normal;
        return `${basePrompt}\n\nSUBJECT DETECTED: ${detection.subject.toUpperCase()} (${detection.confidence.toFixed(0)}% confidence)\nSPECIALIZED INSTRUCTIONS: ${specializedInstruction}\n\nKeywords found: ${detection.keywords_found.join(', ')}`;
    }
    getSubjectSpecificShortcuts(subject) {
        const shortcuts = {
            mathematics: [
                { key: 'Ctrl+Shift+S', description: 'Solve Equation', action: 'solve-math' },
                { key: 'Ctrl+Shift+G', description: 'Graph Function', action: 'graph-function' },
                { key: 'Ctrl+Shift+C', description: 'Check Answer', action: 'check-answer' }
            ],
            programming: [
                { key: 'Ctrl+Shift+E', description: 'Explain Code', action: 'explain-code' },
                { key: 'Ctrl+Shift+D', description: 'Debug Error', action: 'debug-error' },
                { key: 'Ctrl+Shift+O', description: 'Optimize Code', action: 'optimize-code' }
            ],
            chemistry: [
                { key: 'Ctrl+Shift+B', description: 'Balance Equation', action: 'balance-equation' },
                { key: 'Ctrl+Shift+R', description: 'Reaction Mechanism', action: 'reaction-mechanism' }
            ],
            physics: [
                { key: 'Ctrl+Shift+F', description: 'Find Formula', action: 'find-formula' },
                { key: 'Ctrl+Shift+U', description: 'Unit Analysis', action: 'unit-analysis' }
            ]
        };
        return shortcuts[subject] || [];
    }
}
exports.SubjectDetector = SubjectDetector;
//# sourceMappingURL=SubjectDetector.js.map