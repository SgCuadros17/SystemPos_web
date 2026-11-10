import { NavLink } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
import { SECCIONES, etiquetaDe, itemsParaRol } from "@/config/navigation"

function AbacoLogo({ className }) {
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

export function SidebarContent({ onNavigate }) {
  const { rol, sucursalActual } = usePOS()
  const items = itemsParaRol(rol)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="rounded-xl bg-accent-500 p-2 text-text-950 shadow-sm">
          <AbacoLogo className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-extrabold leading-none tracking-tight">Abaco</p>
          <p className="mt-1 text-xs text-sidebar-muted">POS Multisucursal</p>
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

      {/* Badge Plan Gratis / Próximamente IA (solo Admin) */}
      {rol === "admin" && (
        <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-hover/60 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-accent-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Plan Gratis Activo</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-sidebar-muted">
            Próximamente: Plan Pro con predicción de inventario por IA.
          </p>
        </div>
      )}

      {/* Usuario activo */}
      <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-hover text-sm font-bold">
          {rol === "admin" ? "AD" : "CJ"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {rol === "admin" ? "Administrador" : "Cajero"}
          </p>
          <p className="truncate text-xs text-sidebar-muted">
            {rol === "admin"
              ? "Dueño del negocio"
              : sucursalActual?.nombre ?? "Sucursal"}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 md:block">
      <SidebarContent />
    </aside>
  )
}