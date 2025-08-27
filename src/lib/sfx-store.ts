import { create } from "zustand"
import { persist } from "zustand/middleware"

type SfxState = {
  enabled: boolean
  volume: number // 0..1
}

type SfxActions = {
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
}

export const useSfxStore = create<SfxState & SfxActions>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.6,
      setEnabled: (v) => set({ enabled: v }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
    }),
    { name: "lottery-sfx-store" }
  )
)


