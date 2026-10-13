import { NonRealTimeVAD, Message, utils, type NonRealTimeVADOptions } from "@ricky0123/vad-web"
import type { FrameProcessorEvent } from "@ricky0123/vad-web/dist/frame-processor"
import modelURL from "@ricky0123/vad-web/dist/silero_vad_legacy.onnx?url"

// Live capture, same shape as Cluely: two separate streams, mic ("me") and system
// audio ("them"), each through on-device Silero VAD; every finished utterance is
// emitted as one 16kHz WAV. Separate streams give speaker labels for free.

export type Role = "me" | "them"

const SAMPLE_RATE = 16000
const MAX_SEGMENT_MS = 20000 // force-split monologues so text keeps flowing

const PCM_TAP_WORKLET = `registerProcessor("pcm-tap", class extends AudioWorkletProcessor {
  process([input]) { if (input[0]) this.port.postMessage(input[0].slice()); return true }
})`

export async function createSegmenter(
  onSpeech: (wavBase64: string) => void,
  vadOptions: Partial<NonRealTimeVADOptions> = {}
) {
  const vad = await NonRealTimeVAD.new({
    redemptionMs: 300, // end the utterance 300ms after speech stops
    preSpeechPadMs: 300, // keep the first syllable
    ...vadOptions
  })
  let pending = new Float32Array(0)
  let queue: Promise<unknown> = Promise.resolve()
  let speaking = false
  let maxTimer: ReturnType<typeof setTimeout> | undefined

  const enqueue = (work: () => unknown) => {
    queue = queue.then(work).catch((error) => console.error("[liveAudio] VAD error:", error))
    return queue
  }
  const endSegment = () => enqueue(() => vad.frameProcessor.endSegment(onEvent))
  const onEvent = (event: FrameProcessorEvent) => {
    if (event.msg === Message.SpeechStart) {
      speaking = true
      maxTimer = setTimeout(endSegment, MAX_SEGMENT_MS)
    } else if (event.msg === Message.VADMisfire || event.msg === Message.SpeechEnd) {
      speaking = false
      clearTimeout(maxTimer)
      if (event.msg === Message.SpeechEnd) {
        onSpeech(utils.arrayBufferToBase64(utils.encodeWAV(event.audio, 1, SAMPLE_RATE, 1, 16)))
      }
    }
  }

  return {
    isSpeaking: () => speaking,
    push: (samples: Float32Array) =>
      enqueue(async () => {
        const merged = new Float32Array(pending.length + samples.length)
        merged.set(pending)
        merged.set(samples, pending.length)
        let offset = 0
        for (; offset + vad.frameSamples <= merged.length; offset += vad.frameSamples) {
          await vad.frameProcessor.process(merged.subarray(offset, offset + vad.frameSamples), onEvent)
        }
        pending = merged.slice(offset)
      }),
    flush: endSegment
  }
}

// Starts capture; resolves to a stop function that also flushes any in-progress utterance.
export async function startLiveAudio(onSpeech: (role: Role, wavBase64: string) => void) {
  const vadOptions: Partial<NonRealTimeVADOptions> = {
    modelURL,
    ortConfig: (ort) => {
      // ponytail: ORT wasm comes from the CDN (the app already needs network for Gemini); bundle it if offline start matters
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`
    }
  }
  const [me, them] = await Promise.all([
    createSegmenter((wav) => onSpeech("me", wav), vadOptions),
    createSegmenter((wav) => onSpeech("them", wav), vadOptions)
  ])

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE }) // Chromium resamples the mic for us
  const workletURL = URL.createObjectURL(new Blob([PCM_TAP_WORKLET], { type: "text/javascript" }))
  await ctx.audioWorklet.addModule(workletURL)
  URL.revokeObjectURL(workletURL)
  const tap = new AudioWorkletNode(ctx, "pcm-tap")
  tap.port.onmessage = ({ data }: MessageEvent<Float32Array>) =>
    // Mute the mic while the other side talks, so speaker bleed isn't transcribed twice
    me.push(them.isSpeaking() ? new Float32Array(data.length) : data)
  ctx.createMediaStreamSource(stream).connect(tap)
  tap.connect(ctx.destination) // the tap outputs silence; connecting keeps it processing

  const offSystemAudio = window.electronAPI.onSystemAudio((pcm) => {
    const ints = new Int16Array(pcm.slice().buffer)
    them.push(Float32Array.from(ints, (v) => v / 32768))
  })
  await window.electronAPI.startSystemAudio() // false off macOS: mic only

  return async () => {
    offSystemAudio()
    await window.electronAPI.stopSystemAudio()
    stream.getTracks().forEach((track) => track.stop())
    await ctx.close()
    await Promise.all([me.flush(), them.flush()])
  }
}
