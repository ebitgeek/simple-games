class SFX {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices: Array<{ osc: OscillatorNode; gain: GainNode }> = []
  private userVolume = 0.6
  private userEnabled = true

  private getContext(): AudioContext {
    if (!this.ctx) {
      const Fallback = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || AudioContext
      this.ctx = new Fallback()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.08 * this.userVolume * (this.userEnabled ? 1 : 0)
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  setEnabled(v: boolean) {
    this.userEnabled = v
    if (this.master) this.master.gain.value = 0.08 * this.userVolume * (this.userEnabled ? 1 : 0)
  }

  setVolume(v: number) {
    this.userVolume = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.value = 0.08 * this.userVolume * (this.userEnabled ? 1 : 0)
  }

  async resume() {
    const ctx = this.getContext()
    if (ctx.state === "suspended") {
      try { await ctx.resume() } catch { /* noop */ }
    }
  }

  private playTone(
    frequency: number,
    durationMs: number,
    type: OscillatorType = "sine",
    volume = 0.9,
    attackMs = 6,
    releaseMs = 40,
  ) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency
    gain.gain.value = 0
    const v = Math.max(0, Math.min(1, volume))
    const attack = attackMs / 1000
    const release = releaseMs / 1000
    const dur = Math.max(0.01, durationMs / 1000)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(v, now + attack)
    gain.gain.setTargetAtTime(0, now + dur, release)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(now)
    this.voices.push({ osc, gain })
    const stopAt = now + dur + release * 3
    osc.stop(stopAt)
    osc.onended = () => {
      this.voices = this.voices.filter(v => v.osc !== osc)
    }
  }

  tick() {
    // soft click
    this.playTone(900, 55, "triangle", 0.35, 3, 30)
  }

  blink() {
    // brief brighter blip
    this.playTone(1200, 80, "square", 0.25, 4, 50)
  }

  start() {
    // subtle start cue
    this.playTone(660, 120, "sine", 0.2, 5, 60)
  }

  win() {
    // smoother single-voice glide arpeggio
    const ctx = this.getContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    const seq = [880, 1108, 1320, 1760]
    osc.frequency.setValueAtTime(seq[0], now)
    osc.frequency.linearRampToValueAtTime(seq[1], now + 0.12)
    osc.frequency.linearRampToValueAtTime(seq[2], now + 0.26)
    osc.frequency.linearRampToValueAtTime(seq[3], now + 0.42)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.04)
    gain.gain.linearRampToValueAtTime(0.22, now + 0.22)
    gain.gain.setTargetAtTime(0, now + 0.42, 0.12)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(now)
    this.voices.push({ osc, gain })
    osc.stop(now + 0.8)
    osc.onended = () => {
      this.voices = this.voices.filter(v => v.osc !== osc)
    }
  }

  quietAll(durationMs = 60) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const t = Math.max(0.01, durationMs / 1000)
    this.voices.forEach(({ osc, gain }) => {
      try {
        const current = gain.gain.value
        gain.gain.setValueAtTime(current, now)
        gain.gain.linearRampToValueAtTime(0, now + t)
        osc.stop(now + t + 0.05)
      } catch { /* noop */ }
    })
  }
}

export const sfx = new SFX()


