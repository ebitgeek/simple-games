import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Prize = {
  id: string
  label: string
  removed: boolean
}

type PrizeStoreState = {
  rawInput: string
  removedLabels: string[]
}

type PrizeStoreActions = {
  setRawInput: (raw: string) => void
  clearAll: () => void
  addRemovedLabel: (label: string) => void
  clearRemoved: () => void
}

type PrizeStore = PrizeStoreState & PrizeStoreActions

export const usePrizeStore = create<PrizeStore>()(
  persist(
    (set) => ({
      rawInput: "",
      removedLabels: [],
      setRawInput: (raw) => set({ rawInput: raw, removedLabels: [] }),
      clearAll: () => set({ rawInput: "", removedLabels: [] }),
      addRemovedLabel: (label) => set((state) => ({
        removedLabels: [...state.removedLabels, label]
      })),
      clearRemoved: () => set({ removedLabels: [] }),
    }),
    {
      name: "lottery-prize-store",
      version: 2,
      migrate: (persisted: any, version) => {
        if (version < 2 && persisted && Array.isArray(persisted.prizes)) {
          const labels = persisted.prizes.map((p: any) => p?.label).filter(Boolean)
          const removed = persisted.prizes.filter((p: any) => p?.removed).map((p: any) => p?.label).filter(Boolean)
          return { rawInput: labels.join(" # "), removedLabels: removed }
        }
        return persisted
      },
      partialize: (state) => ({ rawInput: state.rawInput, removedLabels: state.removedLabels }),
    }
  )
)


