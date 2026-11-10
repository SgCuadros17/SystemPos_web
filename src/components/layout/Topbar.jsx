import { useState } from "react"
import { Building2, Menu, Moon, ShieldCheck, Sun, Timer, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
import { SidebarContent } from "./Sidebar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

export default function Topbar() {
  const {
    sucursales,
    sucursalActiva,
    setSucursalActiva,
    rol,
    pasarACajero,
    solicitarAutorizacion,
    esAdminTemporal,
    segundosRestantes,
    tema,
    alternarTema,
  } = usePOS()
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
      {/* Menú hamburguesa (solo móvil) */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SidebarContent onNavigate={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>

      {/* Indicador de modo */}
      {esAdminTemporal ? (
        <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 sm:inline-flex dark:text-amber-400">
          <Timer className="h-3.5 w-3.5" />
          Admin temporal
          <span className="cifra">{mmss(segundosRestantes)}</span>
        </span>
      ) : (
        <span
          className={cn(
            "hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex",
            rol === "admin"
              ? "bg-primary-500/10 text-primary-600"
              : "bg-accent-500/15 text-accent-700"
          )}
        >
          {rol === "admin" ? "Modo Administrador" : "Modo Cajero"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Selector de sucursal (bloqueado para el cajero) */}
        <Select
          value={sucursalActiva}
          onValueChange={setSucursalActiva}
          disabled={rol === "cajero"}
        >
          <SelectTrigger className="w-[170px] md:w-[210px]" aria-label="Sucursal">
            <Building2 className="mr-1 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {rol === "admin" && <SelectItem value="todas">Vista Global (Todas)</SelectItem>}
            {sucursales.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tema claro / oscuro */}
        <Button
          variant="ghost"
          size="icon"
          onClick={alternarTema}
          aria-label="Cambiar entre tema claro y oscuro"
        >
          {tema === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Cambio de rol: admin -> cajero libre; cajero -> admin pide PIN */}
        {rol === "admin" ? (
          <Button variant="outline" onClick={pasarACajero}>
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">
              {esAdminTemporal ? "Salir de modo admin" : "Ver como Cajero"}
            </span>
          </Button>
        ) : (
          <Button onClick={() => solicitarAutorizacion()}>
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Acceso Admin</span>
          </Button>
        )}
      </div>
    </header>
  )
}