import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Receipt,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/pos", label: "Punto de Venta", icon: ShoppingCart, roles: ["admin", "cajero"] },
  { to: "/inventario", label: "Inventario", icon: Package, roles: ["admin"] },
  { to: "/fiados", label: "Fiados", icon: Users, roles: ["admin", "cajero"] },
  { to: "/cierres", label: "Cierres de Caja", icon: Receipt, roles: ["admin", "cajero"] },
]

// Contenido reutilizable: se usa en el sidebar de escritorio y en el menú móvil
export function SidebarContent({ onNavigate }) {
  const { rol } = usePOS()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(rol))

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
        <div className="rounded-lg bg-emerald-500 p-2 text-white">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold leading-none">POS Multisucursal</p>
          <p className="mt-1 text-xs text-slate-400">Centro de Comando</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario activo */}
      <div className="flex items-center gap-3 border-t border-slate-800 p-4">
        <Avatar>
          <AvatarFallback className="bg-slate-700 text-slate-100">
            {rol === "admin" ? "AD" : "CJ"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">
            {rol === "admin" ? "Administrador" : "Cajero"}
          </p>
          <p className="text-xs text-slate-400">
            {rol === "admin" ? "Dueño del negocio" : "Operario de sucursal"}
          </p>
        </div>
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