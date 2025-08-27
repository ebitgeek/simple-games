import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { usePrizeStore, type Prize } from "@/lib/prize-store"
import { Gift, PartyPopper } from "lucide-react"
import { sfx } from "@/lib/sfx"
import { useSfxStore } from "@/lib/sfx-store"

export function Lottery() {
  const rawInput = usePrizeStore(s => s.rawInput)
  const removedLabels = usePrizeStore(s => s.removedLabels)
  const setRawInput = usePrizeStore(s => s.setRawInput)
  const addRemovedLabel = usePrizeStore(s => s.addRemovedLabel)
  const clearRemoved = usePrizeStore(s => s.clearRemoved)
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([])
  const [spinning, setSpinning] = useState<boolean>(false)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [currentPrizeId, setCurrentPrizeId] = useState<string | null>(null)
  const [sizePx, setSizePx] = useState<number>(420)
  const [customOpen, setCustomOpen] = useState<boolean>(false)
  const [customInput, setCustomInput] = useState<string>("")
  const [sfxOpen, setSfxOpen] = useState<boolean>(false)
  const [sfxEnabledLocal, setSfxEnabledLocal] = useState<boolean>(useSfxStore.getState().enabled)
  const [sfxVolumeLocal, setSfxVolumeLocal] = useState<number>(useSfxStore.getState().volume)

  const parsedPrizes: Prize[] = useMemo(() => {
    const labels = rawInput
      .split(/[#\n]+/)
      .map(s => s.trim())
      .filter(Boolean)

    const removedCountMap = removedLabels.reduce<Record<string, number>>((acc, label) => {
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})

    const usedCount: Record<string, number> = {}
    return labels.map((label, idx) => {
      usedCount[label] = (usedCount[label] || 0) + 1
      const removedQuota = removedCountMap[label] || 0
      const isRemoved = usedCount[label] <= removedQuota
      return { id: `c_${idx}_${label}_${usedCount[label]}`, label, removed: isRemoved }
    })
  }, [rawInput, removedLabels])

  const prizesCount = parsedPrizes.length
  const availableIndices = useMemo(() => parsedPrizes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.removed)
    .map(({ i }) => i), [parsedPrizes])

  const currentPrize = useMemo(() => parsedPrizes.find(p => p.id === currentPrizeId) || null, [currentPrizeId, parsedPrizes])

  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const totalDurationRef = useRef<number>(0)
  const winnerTimerRef = useRef<number | null>(null)
  const pendingOrderRef = useRef<number[]>([])

  const shuffle = useCallback(<T, >(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [])

  const runFlash = useCallback(() => {
    const now = performance.now()
    const elapsed = now - startTimeRef.current
    const total = totalDurationRef.current
    const t = Math.min(1, elapsed / total)
    const remainingMs = Math.max(0, total - elapsed)

    // 动态闪烁数量：开始多、结束少
    const maxGroup = Math.min(4, Math.max(1, Math.floor(availableIndices.length / 3)))
    const groupSize = Math.max(1, Math.round((1 - t) * maxGroup))
    // 从待访问队列中按顺序取，队列空时重建并洗牌，确保覆盖
    const subset: number[] = []
    while (subset.length < groupSize) {
      if (pendingOrderRef.current.length === 0) {
        pendingOrderRef.current = shuffle(availableIndices)
        if (pendingOrderRef.current.length === 0) break
      }
      const next = pendingOrderRef.current.shift()!
      subset.push(next)
    }
    setHighlightedIndices(subset)
    if (subset.length > 0 && useSfxStore.getState().enabled) sfx.tick()

    if (remainingMs <= 0 || availableIndices.length === 0) {
      // 结束：随机选择一个可用项作为结果
      const finalIdx = availableIndices.length > 0
        ? availableIndices[Math.floor(Math.random() * availableIndices.length)]
        : -1
      if (finalIdx >= 0) {
        const prize = parsedPrizes[finalIdx]
        setHighlightedIndices([finalIdx])
        setCurrentPrizeId(prize.id)
        // 开始中奖后的闪烁
        const flashes = 6
        let toggles = 0
        const interval = 120
        const blink = () => {
          setHighlightedIndices(prev => (prev.length === 1 && prev[0] === finalIdx) ? [] : [finalIdx])
          if (useSfxStore.getState().enabled) sfx.blink()
          toggles += 1
          if (toggles >= flashes * 2) {
            // 平滑过渡，先快速淡出其他残留音，再播放 win
            if (useSfxStore.getState().enabled) sfx.quietAll(50)
            setHighlightedIndices([finalIdx])
            setSpinning(false)
            if (useSfxStore.getState().enabled) sfx.win()
            setDialogOpen(true)
            if (winnerTimerRef.current) window.clearTimeout(winnerTimerRef.current)
            winnerTimerRef.current = null
            return
          }
          winnerTimerRef.current = window.setTimeout(blink, interval)
        }
        winnerTimerRef.current = window.setTimeout(blink, interval)
      } else {
        setHighlightedIndices([])
        setSpinning(false)
        setDialogOpen(true)
      }
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = null
      return
    }

    // 动态节奏：逐步变慢
    const delay = 60 + t * 160
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(runFlash, delay)
  }, [availableIndices, parsedPrizes, shuffle])

  const handleStart = useCallback(() => {
    if (spinning || availableIndices.length === 0) return
    const { enabled, volume } = useSfxStore.getState()
    if (enabled) {
      sfx.setVolume(volume)
      sfx.setEnabled(true)
      sfx.resume().then(() => sfx.start())
    }
    setSpinning(true)
    setHighlightedIndices([])
    startTimeRef.current = performance.now()
    // 2.5s - 5.0s 之间随机
    totalDurationRef.current = 2500 + Math.random() * 2500
    pendingOrderRef.current = shuffle(availableIndices)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(runFlash, 50)
  }, [spinning, runFlash, shuffle, availableIndices])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    if (!currentPrizeId) return
    if (currentPrize?.label) {
      addRemovedLabel(currentPrize.label)
    }
    setCurrentPrizeId(null)
  }, [currentPrizeId, currentPrize?.label, addRemovedLabel])

  const handleReset = useCallback(() => {
    if (spinning) return
    clearRemoved()
    setHighlightedIndices([])
    setCurrentPrizeId(null)
    setDialogOpen(false)
  }, [spinning, clearRemoved])

  const applyCustomPool = useCallback(() => {
    const raw = customInput
      .split(/[#\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (raw.length === 0) {
      setCustomOpen(false)
      return
    }
    setRawInput(raw.join("#"))
    setHighlightedIndices([])
    setCurrentPrizeId(null)
    setDialogOpen(false)
    setCustomOpen(false)
  }, [customInput, setRawInput])

  const handleGoAgain = useCallback(() => {
    handleDialogClose()
    setTimeout(() => {
      if (availableIndices.length > 0) {
        const { enabled, volume } = useSfxStore.getState()
        if (enabled) {
          sfx.setEnabled(true)
          sfx.setVolume(volume)
        }
        handleStart()
      }
    }, 120)
  }, [handleDialogClose, handleStart, availableIndices.length])

  const applySfxSettings = useCallback(() => {
    useSfxStore.setState({ enabled: sfxEnabledLocal, volume: sfxVolumeLocal })
    sfx.setEnabled(sfxEnabledLocal)
    sfx.setVolume(sfxVolumeLocal)
    setSfxOpen(false)
  }, [sfxEnabledLocal, sfxVolumeLocal])

  // 响应式尺寸：根据视口计算圆盘直径
  useEffect(() => {
    const updateSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const base = Math.min(vw, vh) - 48
      const clamped = Math.max(260, Math.min(base, 620))
      setSizePx(clamped)
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // 圆盘布局与防重叠：基于相邻角距的弦长动态计算图标尺寸
  const padding = 12
  const centerBtnSize = Math.round(Math.max(96, Math.min(sizePx * 0.34, 180)))
  const baseRadius = Math.max(60, Math.floor(sizePx / 2 - padding - centerBtnSize / 2 - 10))
  const angleStep = prizesCount > 0 ? (2 * Math.PI) / prizesCount : 2 * Math.PI
  const chordLen = prizesCount > 1 ? 2 * baseRadius * Math.sin(angleStep / 2) : baseRadius * 2
  const maxIcon = Math.min(Math.floor(sizePx * 0.14), 64)
  const minIcon = 10
  const iconSize = Math.round(Math.max(minIcon, Math.min(Math.floor(chordLen * 0.65), maxIcon)))
  const radiusPx = Math.max(40, Math.floor(sizePx / 2 - padding - iconSize / 2))

  // 卸载/重开清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (winnerTimerRef.current) window.clearTimeout(winnerTimerRef.current)
    }
  }, [])

  return (
    <div className="flex w-full items-center justify-center mt-20">
      <div className="relative" style={{ width: sizePx, height: sizePx }}>
        <div className="absolute inset-0 rounded-full border border-dashed border-border/70"/>

        {parsedPrizes.map((prize, index) => {
          const angleDeg = (360 / Math.max(prizesCount, 1)) * index - 90
          const isActive = highlightedIndices.includes(index)
          return (
            <div
              key={prize.id}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translate(${radiusPx}px) rotate(${-angleDeg}deg)` }}
            >
              <div
                className={`rounded-md border shadow-sm transition-all flex items-center justify-center ${
                  prize.removed
                    ? "opacity-30 grayscale"
                    : isActive
                      ? "ring-2 ring-primary scale-110 bg-accent/40"
                      : "bg-card"
                }`}
                style={{ width: iconSize + 12, height: iconSize + 12 }}
              >
                <Gift style={{ width: iconSize, height: iconSize }}/>
                <span className="sr-only">{prize.label}</span>
              </div>
            </div>
          )
        })}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
          <Button
            onClick={handleStart}
            disabled={spinning || availableIndices.length === 0}
            className="rounded-full text-base"
            style={{ width: centerBtnSize, height: centerBtnSize }}
          >
            {availableIndices.length === 0 ? "已抽完" : (spinning ? "抽取中..." : "点这里")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={spinning} className="h-9 px-4 text-sm">
              重来
            </Button>
            <Button variant="outline" onClick={() => setSfxOpen(true)} disabled={spinning} className="h-9 px-4 text-sm">
              音效设置
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const labels = parsedPrizes.map(p => p.label).filter(Boolean)
                setCustomInput(labels.join("#"))
                setCustomOpen(true)
              }}
              disabled={spinning}
              className="h-9 px-4 text-sm"
            >
              自定义
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl"></DialogTitle>
            <DialogDescription className="text-sm"></DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center gap-3 py-2">
            <div className="grid place-items-center rounded-full p-6 bg-gradient-to-br from-accent/60 to-primary/20 border">
              <PartyPopper className="size-10" />
            </div>
            <div className="text-lg font-semibold">
              {currentPrize ? `${currentPrize.label}` : ""}
            </div>
          </div>
          <DialogFooter className="mt-2 sm:justify-center gap-2">
            <Button variant="outline" onClick={handleGoAgain}>再来一次</Button>
            <Button onClick={handleDialogClose}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customOpen} onOpenChange={(open) => setCustomOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>自定义奖池</DialogTitle>
            <DialogDescription>
              在下面输入项目名称，使用#或换行分隔，将覆盖当前奖池。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Textarea
              rows={6}
              placeholder="示例：一等奖#二等奖#三等奖 或每行一个"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>取消</Button>
            <Button onClick={applyCustomPool} disabled={spinning}>应用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sfxOpen} onOpenChange={setSfxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>音效设置</DialogTitle>
            <DialogDescription>可以开关音效并调整音量。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sfxEnabledLocal} onChange={(e) => setSfxEnabledLocal(e.target.checked)} />
              启用音效
            </label>
            <label className="grid gap-2 text-sm">
              <span>音量：{Math.round(sfxVolumeLocal * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={sfxVolumeLocal}
                     onChange={(e) => setSfxVolumeLocal(parseFloat(e.target.value))} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSfxOpen(false)}>取消</Button>
            <Button onClick={applySfxSettings}>应用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Lottery


