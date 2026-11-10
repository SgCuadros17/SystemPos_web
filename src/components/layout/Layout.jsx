import { Outlet } from "react-router-dom"
import { usePOS } from "@/context/POSContext"
import { Toaster } from "@/components/ui/sonner"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import AdminAuthModal from "./AdminAuthModal"

export default function Layout() {
  const { tema } = usePOS()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <AdminAuthModal />
      <Toaster theme={tema} position="top-right" richColors />
    </div>
  )
}