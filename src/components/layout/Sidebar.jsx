import { NavLink, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
import { SECCIONES, etiquetaDe, itemsParaRol } from "@/config/navigation"
import { Button } from "@/components/ui/button"

// Logo: ábaco minimalista (también se usa en Landing, Login y Onboarding)
export function AbacoLogo({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M3 15h18" />
      <g fill="currentColor" stroke="none">
        <circle cx="8" cy="9" r="1.7" />
        <circle cx="12" cy="9" r="1.7" />
        <circle cx="16.5" cy="9" r="1.7" />
        <circle cx="7" cy="15" r="1.7" />
        <circle cx="14" cy="15" r="1.7" />
        <circle cx="17.5" cy="15" r="1.7" />
      </g>
    </svg>
  )
}

const iniciales = (nombre = "") =>
  nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "AB"

// Contenido reutilizable: sidebar de escritorio y menú móvil
export function SidebarContent({ onNavigate }) {
  const { rol, sucursalActual, negocio, usuario, esAdminTemporal, logout } = usePOS()
  const navigate = useNavigate()
  const items = itemsParaRol(rol)

  const salir = async () => {
    onNavigate?.()
    navigate("/", { replace: true })
    await logout()
  }

  const detalleUsuario =
    rol === "admin"
      ? esAdminTemporal
        ? "Admin temporal"
        : "Administrador"
      : `Cajero · ${sucursalActual?.nombre ?? "Sucursal"}`

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="rounded-xl bg-accent-500 p-2 text-text-950 shadow-sm">
          <AbacoLogo className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-none tracking-tight">Abaco</p>
          <p className="mt-1 truncate text-xs text-sidebar-muted" title={negocio?.nombre}>
            {negocio?.nombre ?? "POS Multisucursal"}
          </p>
        </div>
      </div>

      {/* Navegación agrupada por sección */}
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {SECCIONES.map((seccion) => {
          const delGrupo = items.filter((i) => i.seccion === seccion)
          if (delGrupo.length === 0) return null
          return (
            <div key={seccion} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {seccion}
              </p>
              {delGrupo.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-accent-500 text-text-950 font-bold shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {etiquetaDe(item, rol)}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Usuario activo + cerrar sesión */}
      <div className="space-y-3 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-sm font-bold">
            {iniciales(usuario?.nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{usuario?.nombre ?? "Usuario"}</p>
            <p className="truncate text-xs text-sidebar-muted">{detalleUsuario}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={salir}
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}

// Sidebar fijo para pantallas grandes
export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 md:block">
      <SidebarContent />
    </aside>
  )
}