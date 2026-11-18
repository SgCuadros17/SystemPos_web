import { NavLink, useNavigate } from "react-router-dom"
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react"
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

// Tooltip ligero (solo CSS) para el modo rail: aparece al pasar el mouse o enfocar con teclado
function Tip({ texto, children }) {
  return (
    <div className="group relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {texto}
      </span>
    </div>
  )
}

// Contenido reutilizable:
//  - escritorio: se usa con compacto (rail w-16) o expandido (w-64) y botón onToggle
//  - móvil: dentro del Sheet, siempre expandido y sin onToggle
export function SidebarContent({ onNavigate, compacto = false, onToggle }) {
  const { rol, sucursalActual, negocio, usuario, esAdminTemporal, logout } = usePOS()
  const navigate = useNavigate()
  const items = itemsParaRol(rol)

  const grupos = SECCIONES.map((seccion) => ({
    seccion,
    items: items.filter((i) => i.seccion === seccion),
  })).filter((g) => g.items.length > 0)

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

  const claseToggle =
    "flex items-center rounded-lg py-2.5 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border py-5",
          compacto ? "justify-center px-2" : "gap-3 px-5"
        )}
      >
        <div className="shrink-0 rounded-xl bg-accent-500 p-2 text-text-950 dark:text-[#02180d]">
          <AbacoLogo className="h-6 w-6" />
        </div>
        {!compacto && (
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-none tracking-tight">Abaco</p>
            <p className="mt-1 truncate text-xs text-sidebar-muted" title={negocio?.nombre}>
              {negocio?.nombre ?? "POS Multisucursal"}
            </p>
          </div>
        )}
      </div>

      {/* Botón expandir / contraer (solo escritorio) */}
      {onToggle && (
        <div className="px-3 pt-3">
          {compacto ? (
            <Tip texto="Expandir menú">
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={false}
                aria-label="Expandir menú lateral"
                className={cn(claseToggle, "w-full justify-center")}
              >
                <ChevronsRight className="h-5 w-5" />
              </button>
            </Tip>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              aria-label="Contraer menú lateral"
              className={cn(claseToggle, "w-full gap-3 px-3")}
            >
              <ChevronsLeft className="h-5 w-5 shrink-0" />
              <span className="truncate">Contraer menú</span>
            </button>
          )}
        </div>
      )}

      {/* Navegación */}
      <nav
        aria-label="Módulos"
        className={cn(
          "flex-1 p-3",
          compacto ? "space-y-1 overflow-visible" : "space-y-5 overflow-y-auto"
        )}
      >
        {grupos.map(({ seccion, items: delGrupo }, idx) => (
          <div
            key={seccion}
            className={cn("space-y-1", compacto && idx > 0 && "border-t border-sidebar-border pt-3")}
          >
            {!compacto && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {seccion}
              </p>
            )}
            {delGrupo.map((item) => {
              const etiqueta = etiquetaDe(item, rol)
              const enlace = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-label={compacto ? etiqueta : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-lg py-3 text-sm font-semibold transition-colors",
                      compacto ? "justify-center" : "gap-3 px-3",
                      isActive
                        ? "bg-accent-500 text-text-950 font-bold dark:text-[#02180d] shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!compacto && <span className="min-w-0 truncate">{etiqueta}</span>}
                </NavLink>
              )
              return compacto ? (
                <Tip key={item.to} texto={etiqueta}>
                  {enlace}
                </Tip>
              ) : (
                enlace
              )
            })}
          </div>
        ))}
      </nav>

      {/* Usuario activo + cerrar sesión */}
      <div className={cn("border-t border-sidebar-border", compacto ? "space-y-2 p-3" : "space-y-3 p-4")}>
        <div className={cn("flex items-center", compacto ? "justify-center" : "gap-3")}>
          <div
            title={compacto ? `${usuario?.nombre ?? "Usuario"} · ${detalleUsuario}` : undefined}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-sm font-bold"
          >
            {iniciales(usuario?.nombre)}
          </div>
          {!compacto && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuario?.nombre ?? "Usuario"}</p>
              <p className="truncate text-xs text-sidebar-muted">{detalleUsuario}</p>
            </div>
          )}
        </div>

        {compacto ? (
          <Tip texto="Cerrar sesión">
            <Button
              variant="ghost"
              size="icon"
              onClick={salir}
              aria-label="Cerrar sesión"
              className="w-full text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </Tip>
        ) : (
          <Button
            variant="ghost"
            onClick={salir}
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        )}
      </div>
    </div>
  )
}

// Sidebar fijo de escritorio (>= md): w-64 expandido, w-16 contraído (icon-rail)
export default function Sidebar({ expandido = true, onToggle, onNavegar }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden transition-all duration-300 md:block",
        expandido ? "w-64" : "w-16"
      )}
    >
      <SidebarContent compacto={!expandido} onToggle={onToggle} onNavigate={onNavegar} />
    </aside>
  )
}