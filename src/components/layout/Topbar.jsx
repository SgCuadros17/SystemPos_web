import { useState } from "react"
import { Building2, Menu, ShieldCheck, User } from "lucide-react"
import { usePOS } from "@/context/POSContext"
import { SidebarContent } from "./Sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

export default function Topbar() {
  const { sucursales, sucursalActiva, setSucursalActiva, rol, alternarRol } = usePOS()
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-white px-4 md:px-6">
      {/* Menú hamburguesa (solo móvil) */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SidebarContent onNavigate={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>

      <Badge variant="secondary" className="hidden sm:inline-flex">
        {rol === "admin" ? "Modo Administrador" : "Modo Cajero"}
      </Badge>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Selector de sucursal */}
        <Select value={sucursalActiva} onValueChange={setSucursalActiva}>
          <SelectTrigger className="w-[180px] md:w-[210px]">
            <Building2 className="mr-1 h-4 w-4 text-slate-500" />
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {rol === "admin" && (
              <SelectItem value="todas">Vista Global (Todas)</SelectItem>
            )}
            {sucursales.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Alternar Admin / Cajero */}
        <Button
          variant={rol === "admin" ? "default" : "outline"}
          onClick={alternarRol}
        >
          {rol === "admin" ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            Vista: {rol === "admin" ? "Admin" : "Cajero"}
          </span>
        </Button>
      </div>
    </header>
  )
}