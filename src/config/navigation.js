import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CreditCard,
  WalletCards,
  Truck,
  Receipt,
  Building2,
} from "lucide-react"

export const SECCIONES = ["General", "Operación", "Administración"]

export const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin"],
    seccion: "General",
    descripcion: "KPIs financieros, métricas logradas y comparativa de ventas por sucursal.",
  },
  {
    to: "/pos",
    label: "Punto de Venta",
    icon: ShoppingCart,
    roles: ["admin", "cajero"],
    seccion: "Operación",
    descripcion: "Catálogo por categorías, lector de barras, carrito y cobro en Efectivo, Nequi o Crédito.",
  },
  {
    to: "/inventario",
    label: "Inventario",
    icon: Package,
    roles: ["admin"],
    seccion: "Operación",
    descripcion: "Catálogo de productos, categorías, precios, stock por sede y traslados entre sucursales.",
  },
  {
    to: "/creditos",
    label: "Créditos",
    icon: CreditCard,
    roles: ["admin", "cajero"],
    seccion: "Operación",
    descripcion: "Gestión de clientes a crédito, cupos autorizados, PINs e historial de abonos.",
  },
  {
    to: "/egresos",
    label: "Pago a Proveedores",
    icon: Truck,
    roles: ["cajero"],
    seccion: "Operación",
    descripcion: "Registro rápido de salidas de caja por pago de facturas a proveedores con evidencia fotográfica.",
  },
  {
    to: "/cartera",
    label: "Gestión de Cartera",
    icon: WalletCards,
    roles: ["admin"],
    seccion: "Administración",
    descripcion: "Historial de ventas por calendario, gráficas financieras, productos más vendidos y auditoría de proveedores.",
  },
  {
    to: "/cierres",
    label: "Cierres de Caja",
    labelCajero: "Cierre de Caja",
    icon: Receipt,
    roles: ["admin", "cajero"],
    seccion: "Operación",
    descripcion: "Arqueo diario por turno y sucursal: efectivo, Nequi, abonos, egresos y créditos del día.",
  },
  {
    to: "/sucursales",
    label: "Sucursales y Usuarios",
    icon: Building2,
    roles: ["admin"],
    seccion: "Administración",
    descripcion: "Creación y administración de tiendas, cajeros, roles y PINs de seguridad.",
  },
]

export const etiquetaDe = (item, rol) =>
  (rol === "cajero" && item.labelCajero) || item.label

export const itemsParaRol = (rol) => NAV_ITEMS.filter((i) => i.roles.includes(rol))

export const rutaInicial = (rol) => (rol === "admin" ? "/dashboard" : "/pos")