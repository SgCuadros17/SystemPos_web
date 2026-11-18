import { useState } from "react"
import { Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import AdminAuthModal from "./AdminAuthModal"

export default function Layout() {
  // Escritorio: expandido (w-64) o icon-rail (w-16). Se contrae al elegir un módulo.
  const [expandido, setExpandido] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        expandido={expandido}
        onToggle={() => setExpandido((v) => !v)}
        onNavegar={() => setExpandido(false)}
      />
      <div className={cn("transition-all duration-300", expandido ? "md:pl-64" : "md:pl-16")}>
        <Topbar />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <AdminAuthModal />
    </div>
  )
}