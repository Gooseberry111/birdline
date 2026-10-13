import { profile, hud } from '../store'

// A little radio: tower and captain lines are shown as a caption and read aloud with the
// browser voice, after a short burst of static. Turn it off in Settings.
export class Radio {
  constructor(audio) {
    this.audio = audio
    this.queue = []
    this.busy = false
    this.voice = null
    this.hideT = null
    if (typeof speechSynthesis !== 'undefined') {
      const pick = () => {
        const v = speechSynthesis.getVoices()
        this.voice = v.find((x) => /en-NG/i.test(x.lang)) || v.find((x) => /en-(GB|ZA|IN|AU)/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null
      }
      pick()
      speechSynthesis.onvoiceschanged = pick
    }
  }

  say(who, text) {
    if (!text) return
    if (this.queue.length > 2) this.queue.shift()
    this.queue.push({ who, text })
    this.next()
  }

  clear() {
    this.queue = []
    this.busy = false
    clearTimeout(this.hideT)
    hud.radio = null
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() } catch (e) { /* ignore */ }
  }

  next() {
    if (this.busy || !this.queue.length) return
    const { who, text } = this.queue.shift()
    this.busy = true
    clearTimeout(this.hideT)
    hud.radio = { who, text }
    this.audio.blip(1650, 0.05, 'square', 0.05)
    const done = () => {
      this.hideT = setTimeout(() => { hud.radio = null }, 900)
      this.busy = false
      setTimeout(() => this.next(), 250)
    }
    const spoken = profile.settings.radio !== false && typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
    if (spoken) {
      try {
        const u = new SpeechSynthesisUtterance(text)
        if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang }
        const tower = /Tower/i.test(who)
        u.pitch = tower ? 0.75 : 1.12
        u.rate = tower ? 1.02 : 1.05
        u.volume = Math.min(1, 0.4 + profile.settings.volume * 0.7)
        u.onend = done
        u.onerror = done
        speechSynthesis.speak(u)
        // some browsers never fire onend, so do not get stuck
        setTimeout(() => { if (this.busy && !speechSynthesis.speaking) done() }, 600 + text.length * 120)
        return
      } catch (e) { /* fall through to a timed caption */ }
    }
    setTimeout(done, 1800 + text.length * 55)
  }
}
