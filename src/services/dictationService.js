/**
 * Push-to-talk dictation with a provider chain. The Whisper/LiteRT provider
 * is config-gated (see models.config.js); the Web Speech provider is the
 * always-available fallback — labelled honestly in the UI because Chrome
 * routes it through Google's servers.
 */
import { modelsConfig } from '../config/models.config.js'
import { useStore } from '../state/store.js'

let recognition = null

export function dictationCapability() {
  const cfg = modelsConfig.asr
  for (const key of cfg.providerChain) {
    const p = cfg[key]
    if (!p?.enabled) continue
    if (key === 'whisper') return { provider: 'whisper', onDevice: true, label: p.label }
    if (key === 'webspeech') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) return { provider: 'webspeech', onDevice: false, label: p.label }
    }
  }
  return null
}

export function startDictation({ locale = 'en', onFinal }) {
  const store = useStore.getState()
  const cap = dictationCapability()
  if (!cap) return

  if (cap.provider === 'webspeech') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SR()
    recognition.lang = modelsConfig.asr.webspeech.languages[locale] ?? 'en-IN'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) final += chunk
        else interim += chunk
      }
      if (interim) useStore.getState().patchDictation({ interim })
      if (final) onFinal?.(final.trim())
    }
    recognition.onerror = (e) => {
      useStore.getState().patchDictation({ listening: false, error: e.error })
    }
    recognition.onend = () => {
      useStore.getState().patchDictation({ listening: false, interim: '' })
    }

    recognition.start()
    store.patchDictation({ listening: true, interim: '', error: null, ...cap })
  }
}

export function stopDictation() {
  recognition?.stop()
  recognition = null
}
