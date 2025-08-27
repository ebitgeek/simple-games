import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle.tsx";
import Lottery from "@/components/Lottery";


function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen p-3">
        <div className="flex justify-end">
          <ModeToggle />
        </div>
        <Lottery />
      </div>
    </ThemeProvider>
  )
}

export default App