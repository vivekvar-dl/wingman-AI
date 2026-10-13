// Runnable check for src/lib/liveAudio.ts segmentation (macOS: needs `say`).
// Feeds a spoken question + silence through the real VAD segmenter in 128-sample
// blocks (what the mic worklet sends) and asserts exactly one 16kHz WAV comes out.
//   node scripts/check-live-audio.mjs
import { build } from "esbuild"
import { execFileSync } from "child_process"
import { mkdtempSync, readFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import assert from "assert"

const dir = mkdtempSync(join(tmpdir(), "live-audio-"))
const bundle = "node_modules/.cache/check-live-audio/liveAudio.mjs" // inside the project so onnxruntime-web resolves
await build({
  entryPoints: ["src/lib/liveAudio.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
  logLevel: "error",
  external: ["onnxruntime-web"],
  // Vite's `?url` import → plain file path
  plugins: [{
    name: "url",
    setup(b) {
      b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path.replace(/\?url$/, ""), namespace: "url" }))
      b.onLoad({ filter: /.*/, namespace: "url" }, (a) => ({ contents: `export default ${JSON.stringify(a.path)}` }))
    }
  }],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" }
})
const { createSegmenter } = await import(join(process.cwd(), bundle))

const speechFile = join(dir, "speech.wav")
execFileSync("say", ["-o", speechFile, "--data-format=LEI16@16000", "What is the time complexity of quicksort?"])
const wav = readFileSync(speechFile)
const dataAt = wav.indexOf("data") + 8
const speech = Float32Array.from(new Int16Array(wav.buffer.slice(wav.byteOffset + dataAt, wav.byteOffset + wav.length - ((wav.length - dataAt) % 2))), (v) => v / 32768)

const segments = []
const seg = await createSegmenter((b64) => segments.push(Buffer.from(b64, "base64")), {
  modelFetcher: async () => readFileSync("node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx").buffer
})
const audio = new Float32Array(speech.length + 16000) // + 1s silence so the utterance ends
audio.set(speech)
for (let i = 0; i < audio.length; i += 128) seg.push(audio.subarray(i, i + 128))
await seg.flush()

assert.equal(segments.length, 1, `expected 1 utterance, got ${segments.length}`)
const out = segments[0]
assert.equal(out.toString("ascii", 0, 4), "RIFF")
assert.equal(out.readUInt32LE(24), 16000, "sample rate")
assert.equal(out.readUInt16LE(34), 16, "bit depth")
const seconds = (out.length - 44) / 32000
assert.ok(seconds > 1 && seconds < speech.length / 16000 + 1, `utterance length ${seconds}s`)
console.log(`ok: 1 utterance, ${seconds.toFixed(2)}s of ${(speech.length / 16000).toFixed(2)}s speech`)
