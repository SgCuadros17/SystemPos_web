import { createContext, useContext, useMemo, useState } from "react"

// ---------- Utilidades ----------
export const formatCOP = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor)

const fechaHace = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

// ---------- Datos mock ----------
export const SUCURSALES = [
  { id: "s1", nombre: "Tienda 1", direccion: "Calle 10 #20-30" },
  { id: "s2", nombre: "Tienda 2", direccion: "Carrera 45 #12-18" },
  { id: "s3", nombre: "Restaurante", direccion: "Avenida Principal #5-60" },
]

const PRODUCTOS_INICIALES = [
  { id: "p1", nombre: "Aceite 1L", categoria: "Despensa", precio: 10000, stock: { s1: 24, s2: 12, s3: 6 } },
  { id: "p2", nombre: "Panal de huevos", categoria: "Despensa", precio: 15000, stock: { s1: 18, s2: 4, s3: 10 } },
  { id: "p3", nombre: "Arroz 1kg", categoria: "Despensa", precio: 4500, stock: { s1: 60, s2: 35, s3: 20 } },
  { id: "p4", nombre: "Leche 1L", categoria: "Lácteos", precio: 4200, stock: { s1: 40, s2: 3, s3: 15 } },
  { id: "p5", nombre: "Gaseosa 1.5L", categoria: "Bebidas", precio: 6500, stock: { s1: 30, s2: 22, s3: 18 } },
  { id: "p6", nombre: "Pan tajado", categoria: "Panadería", precio: 5800, stock: { s1: 15, s2: 9, s3: 2 } },
  { id: "p7", nombre: "Café 250g", categoria: "Despensa", precio: 9500, stock: { s1: 20, s2: 14, s3: 8 } },
  { id: "p8", nombre: "Hamburguesa", categoria: "Comida", precio: 18000, stock: { s1: 0, s2: 0, s3: 45 } },
  { id: "p9", nombre: "Jugo natural", categoria: "Bebidas", precio: 6000, stock: { s1: 0, s2: 0, s3: 50 } },
]

const CLIENTES_INICIALES = [
  { id: "c1", nombre: "Sebastián Ríos", telefono: "300 111 2233", pin: "2580" },
  { id: "c2", nombre: "María Gómez", telefono: "310 444 5566", pin: "4821" },
  { id: "c3", nombre: "Don Carlos Ruiz", telefono: "320 777 8899", pin: "1357" },
]

const PROVEEDORES_INICIALES = [
  { id: "pr1", nombre: "Lácteos del Valle", contacto: "300 000 0001" },
  { id: "pr2", nombre: "Distribuidora La Montaña", contacto: "300 000 0002" },
  { id: "pr3", nombre: "Panadería El Trigal", contacto: "300 000 0003" },
]

// Crea una venta calculando el total a partir de los productos
const crearVenta = (id, sucursalId, dias, metodo, items, clienteId = null, pagada = true) => {
  const detalle = items.map(([productoId, cantidad]) => {
    const precio = PRODUCTOS_INICIALES.find((p) => p.id === productoId).precio
    return { productoId, cantidad, precio, subtotal: precio * cantidad }
  })
  return {
    id,
    sucursalId,
    fecha: fechaHace(dias),
    metodo, // "efectivo" | "nequi" | "fiado"
    clienteId,
    estadoDeuda: metodo === "fiado" ? (pagada ? "pagada" : "pendiente") : null,
    items: detalle,
    total: detalle.reduce((suma, i) => suma + i.subtotal, 0),
  }
}

const VENTAS_INICIALES = [
  // Hoy
  crearVenta("v001", "s1", 0, "efectivo", [["p1", 1], ["p3", 2]]),
  crearVenta("v002", "s1", 0, "nequi", [["p2", 1], ["p4", 2]]),
  crearVenta("v003", "s2", 0, "efectivo", [["p5", 2], ["p6", 1]]),
  crearVenta("v004", "s3", 0, "efectivo", [["p8", 2], ["p9", 2]]),
  crearVenta("v005", "s3", 0, "nequi", [["p8", 1], ["p9", 1]]),
  crearVenta("v006", "s1", 0, "fiado", [["p4", 2], ["p6", 1]], "c2", false),
  // Últimos 7 días (para las gráficas)
  crearVenta("v007", "s1", 1, "efectivo", [["p7", 2], ["p3", 4]]),
  crearVenta("v008", "s2", 1, "nequi", [["p5", 3], ["p2", 1]]),
  crearVenta("v009", "s3", 1, "efectivo", [["p8", 3], ["p9", 3]]),
  crearVenta("v010", "s1", 2, "nequi", [["p1", 2], ["p7", 1]]),
  crearVenta("v011", "s2", 2, "efectivo", [["p4", 4], ["p6", 2]]),
  crearVenta("v012", "s3", 3, "nequi", [["p8", 4], ["p9", 2]]),
  crearVenta("v013", "s1", 4, "efectivo", [["p2", 2], ["p5", 2]]),
  crearVenta("v014", "s2", 5, "efectivo", [["p3", 6], ["p1", 1]]),
  crearVenta("v015", "s3", 6, "efectivo", [["p8", 2], ["p9", 4]]),
  // Fiados de Sebastián (pendientes)
  crearVenta("v101", "s1", 3, "fiado", [["p1", 1], ["p2", 1]], "c1", false),
  crearVenta("v102", "s2", 1, "fiado", [["p7", 1], ["p5", 1]], "c1", false),
  // Fiado ya pagado de Don Carlos
  crearVenta("v103", "s1", 8, "fiado", [["p3", 3]], "c3", true),
]

const EGRESOS_INICIALES = [
  { id: "e1", sucursalId: "s1", proveedorId: "pr1", monto: 120000, metodo: "efectivo", fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Lacteos" },
  { id: "e2", sucursalId: "s3", proveedorId: "pr2", monto: 85000, metodo: "nequi", fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Montana" },
  { id: "e3", sucursalId: "s2", proveedorId: "pr3", monto: 60000, metodo: "efectivo", fecha: fechaHace(1), urlFoto: "https://placehold.co/400x520?text=Factura+Trigal" },
]

// ---------- Contexto ----------
const POSContext = createContext(null)

export const PIN_ADMIN_DEMO = "1234"
export const MINUTOS_ADMIN_TEMPORAL = 10

const temaInicial = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"

export function POSProvider({ children }) {
  const [sucursalActiva, setSucursalActiva] = useState("todas")
  const [rol, setRol] = useState("admin")
  const [tema, setTema] = useState(temaInicial)

  const [modalAdminAbierto, setModalAdminAbierto] = useState(false)
  const [tieneAccionPendiente, setTieneAccionPendiente] = useState(false)
  const [adminTemporalHasta, setAdminTemporalHasta] = useState(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const accionPendiente = useRef(null)

  const [productos, setProductos] = useState(PRODUCTOS_INICIALES)
  const [clientes] = useState(CLIENTES_INICIALES)
  const [proveedores] = useState(PROVEEDORES_INICIALES)
  const [ventas, setVentas] = useState(VENTAS_INICIALES)
  const [egresos, setEgresos] = useState(EGRESOS_INICIALES)

  const clientesConDeuda = useMemo(
    () =>
      clientes.map((c) => ({
        ...c,
        deuda: ventas
          .filter((v) => v.clienteId === c.id && v.estadoDeuda === "pendiente")
          .reduce((suma, v) => suma + v.total, 0),
      })),
    [clientes, ventas]
  )

  const sucursalActual = SUCURSALES.find((s) => s.id === sucursalActiva) || null

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark")
    try {
      localStorage.setItem("abaco-tema", tema)
    } catch {}
  }, [tema])

  const alternarTema = () => setTema((t) => (t === "dark" ? "light" : "dark"))

  const pasarACajero = useCallback(() => {
    setRol("cajero")
    setAdminTemporalHasta(null)
    setSucursalActiva((actual) => (actual === "todas" ? "s1" : actual))
  }, [])

  useEffect(() => {
    if (!adminTemporalHasta) {
      setSegundosRestantes(0)
      return
    }
    const tick = () => {
      const restante = Math.max(0, Math.round((adminTemporalHasta - Date.now()) / 1000))
      setSegundosRestantes(restante)
      if (restante === 0) {
        pasarACajero()
        toast.info("El acceso temporal de administrador expiró")
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [adminTemporalHasta, pasarACajero])

  const solicitarAutorizacion = useCallback(
    (accion) => {
      if (rol === "admin") {
        accion?.()
        return
      }
      accionPendiente.current = accion ?? null
      setTieneAccionPendiente(Boolean(accion))
      setModalAdminAbierto(true)
    },
    [rol]
  )

  const cerrarModalAdmin = useCallback(() => {
    accionPendiente.current = null
    setTieneAccionPendiente(false)
    setModalAdminAbierto(false)
  }, [])

  // modo: "panel" (cambia a vista Admin) | "accion" (solo ejecuta la acción y sigue en Cajero)
  const validarPinAdmin = useCallback((pin, modo = "panel") => {
    if (pin !== PIN_ADMIN_DEMO) return false
    const accion = accionPendiente.current
    accionPendiente.current = null
    setTieneAccionPendiente(false)
    setModalAdminAbierto(false)

    if (modo === "panel") {
      setRol("admin")
      setAdminTemporalHasta(Date.now() + MINUTOS_ADMIN_TEMPORAL * 60 * 1000)
    }
    accion?.()
    return true
  }, [])

  const value = {
    sucursales: SUCURSALES,
    sucursalActiva,
    setSucursalActiva,
    sucursalActual,
    rol,
    pasarACajero,
    esAdminTemporal: adminTemporalHasta !== null,
    segundosRestantes,
    solicitarAutorizacion,
    modalAdminAbierto,
    tieneAccionPendiente,
    cerrarModalAdmin,
    validarPinAdmin,
    tema,
    alternarTema,
    productos,
    setProductos,
    clientes: clientesConDeuda,
    proveedores,
    ventas,
    setVentas,
    egresos,
    setEgresos,
  }

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS() {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error("usePOS debe usarse dentro de <POSProvider>")
  return ctx
}