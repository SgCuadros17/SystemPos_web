import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  obtenerSesionGuardada,
  iniciarSesion,
  registrarDueno,
  iniciarSesionDemo,
  cerrarSesionServicio,
  actualizarSesionTrasOnboarding,
  USUARIO_ADMIN_DEMO,
  USUARIO_CAJERO_DEMO,
} from "@/services/auth.service"
import {
  ejecutarOnboardingTransaccional,
  leerOnboardingGuardado,
} from "@/services/onboarding.service"

// ---------- Utilidades ----------
export const formatCOP = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor)

// Fecha ISO de hace N días (misma hora actual)
const fechaHace = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

// Fecha demo con horas distintas para que las ventas no tengan todas la misma hora.
// Hoy: siempre un momento del día ya transcurrido (nunca en el futuro).
const fechaDemo = (dias, n) => {
  const ahora = new Date()
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  if (dias === 0) {
    const fraccion = ((n % 6) + 1) / 7
    return new Date(inicio.getTime() + (ahora - inicio) * fraccion).toISOString()
  }
  const d = new Date(inicio)
  d.setDate(d.getDate() - dias)
  d.setHours(8 + (n % 11), (n * 17) % 60)
  return d.toISOString()
}

// ---------- Datos mock del negocio demo ----------
export const SUCURSALES = [
  { id: "s1", nombre: "Tienda 1", direccion: "Calle 10 #20-30", telefono: "300 111 0001", activa: true },
  { id: "s2", nombre: "Tienda 2", direccion: "Carrera 45 #12-18", telefono: "300 111 0002", activa: true },
  { id: "s3", nombre: "Restaurante", direccion: "Avenida Principal #5-60", telefono: "300 111 0003", activa: true },
]

// stock: { idSucursal: unidades }. Si una sede no maneja el producto, no tiene clave.
const PRODUCTOS_INICIALES = [
  { id: "p1", nombre: "Aceite 1L", categoria: "Despensa", precio: 10000, stock: { s1: 24, s2: 12, s3: 6 } },
  { id: "p2", nombre: "Panal de huevos", categoria: "Despensa", precio: 15000, stock: { s1: 18, s2: 4, s3: 10 } },
  { id: "p3", nombre: "Arroz 1kg", categoria: "Despensa", precio: 4500, stock: { s1: 60, s2: 35, s3: 20 } },
  { id: "p4", nombre: "Leche 1L", categoria: "Lácteos", precio: 4200, stock: { s1: 40, s2: 3, s3: 15 } },
  { id: "p5", nombre: "Gaseosa 1.5L", categoria: "Bebidas", precio: 6500, stock: { s1: 30, s2: 22, s3: 18 } },
  { id: "p6", nombre: "Pan tajado", categoria: "Panadería", precio: 5800, stock: { s1: 15, s2: 9, s3: 2 } },
  { id: "p7", nombre: "Café 250g", categoria: "Despensa", precio: 9500, stock: { s1: 20, s2: 14, s3: 8 } },
  { id: "p8", nombre: "Hamburguesa", categoria: "Comida", precio: 18000, stock: { s3: 45 } },
  { id: "p9", nombre: "Jugo natural", categoria: "Bebidas", precio: 6000, stock: { s3: 50 } },
]

const CLIENTES_INICIALES = [
  { id: "c1", nombre: "Sebastián Ríos", telefono: "300 111 2233", pin: "2580", cupoMaximo: 200000 },
  { id: "c2", nombre: "María Gómez", telefono: "310 444 5566", pin: "4821", cupoMaximo: 150000 },
  { id: "c3", nombre: "Don Carlos Ruiz", telefono: "320 777 8899", pin: "1357", cupoMaximo: 300000 },
]

const PROVEEDORES_INICIALES = [
  { id: "pr1", nombre: "Lácteos del Valle", contacto: "300 000 0001" },
  { id: "pr2", nombre: "Distribuidora La Montaña", contacto: "300 000 0002" },
  { id: "pr3", nombre: "Panadería El Trigal", contacto: "300 000 0003" },
]

// Crea una venta calculando el total a partir de los productos
const crearVenta = (id, sucursalId, dias, metodo, items, clienteId = null, pagada = true) => {
  const n = parseInt(id.slice(1), 10) || 0
  const detalle = items.map(([productoId, cantidad]) => {
    const precio = PRODUCTOS_INICIALES.find((p) => p.id === productoId).precio
    return { productoId, cantidad, precio, subtotal: precio * cantidad }
  })
  return {
    id,
    sucursalId,
    fecha: fechaDemo(dias, n),
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
  // Fiado ya pagado de Don Carlos (hace 8 días: solo entra en "Histórico")
  crearVenta("v103", "s1", 8, "fiado", [["p3", 3]], "c3", true),
]

const EGRESOS_INICIALES = [
  { id: "e1", sucursalId: "s1", proveedorId: "pr1", monto: 120000, metodo: "efectivo", fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Lacteos" },
  { id: "e2", sucursalId: "s3", proveedorId: "pr2", monto: 85000, metodo: "nequi", fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Montana" },
  { id: "e3", sucursalId: "s2", proveedorId: "pr3", monto: 60000, metodo: "efectivo", fecha: fechaHace(1), urlFoto: "https://placehold.co/400x520?text=Factura+Trigal" },
]

// ---------- Contexto ----------
const POSContext = createContext(null)

// Demo: en producción el PIN se valida contra Supabase (con hash), nunca en el cliente
export const PIN_ADMIN_DEMO = "1234"
export const MINUTOS_ADMIN_TEMPORAL = 10

export const NEGOCIO_DEMO = {
  id: "neg-1",
  nombre: "Abaco Demo",
  tipo_negocio: "minimercado",
  plan_suscripcion: "gratis",
}

const USUARIOS_DEMO = [
  { ...USUARIO_ADMIN_DEMO, pin_seguridad: PIN_ADMIN_DEMO, creado_en: fechaHace(30) },
  { ...USUARIO_CAJERO_DEMO, pin_seguridad: "4321", creado_en: fechaHace(30) },
]

// Datos del negocio de demostración (con ventas, stock, fiados...)
const datosDemo = () => ({
  negocio: NEGOCIO_DEMO,
  sucursales: SUCURSALES,
  productos: PRODUCTOS_INICIALES,
  clientes: CLIENTES_INICIALES,
  proveedores: PROVEEDORES_INICIALES,
  ventas: VENTAS_INICIALES,
  egresos: EGRESOS_INICIALES,
  usuariosNegocio: USUARIOS_DEMO,
  pinAdmin: PIN_ADMIN_DEMO,
})

// Un negocio recién creado en el onboarding empieza vacío
const datosNegocioNuevo = ({ negocio, sucursal, usuarios }) => ({
  negocio,
  sucursales: [
    {
      id: sucursal.id,
      nombre: sucursal.nombre,
      direccion: sucursal.direccion ?? "",
      telefono: sucursal.telefono ?? "",
      activa: true,
    },
  ],
  productos: [],
  clientes: [],
  proveedores: [],
  ventas: [],
  egresos: [],
  usuariosNegocio: usuarios,
  pinAdmin: usuarios.find((u) => u.rol === "admin")?.pin_seguridad ?? PIN_ADMIN_DEMO,
})

const datosParaUsuario = (usuario) => {
  if (usuario?.negocio_id && usuario.negocio_id !== NEGOCIO_DEMO.id) {
    const guardado = leerOnboardingGuardado(usuario.negocio_id)
    if (guardado) return datosNegocioNuevo(guardado)
  }
  return datosDemo()
}

// El cajero arranca en su sucursal; el admin en la vista global
const sucursalInicialDe = (usuario, sucursales) =>
  usuario?.rol === "cajero" ? usuario.sucursal_id ?? sucursales[0]?.id ?? "todas" : "todas"

const temaInicial = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"

export function POSProvider({ children }) {
  // Sesión guardada (lectura síncrona al montar)
  const [sesionInicial] = useState(() => obtenerSesionGuardada())
  const [datosIniciales] = useState(() => datosParaUsuario(sesionInicial?.usuario))

  const [usuario, setUsuario] = useState(sesionInicial?.usuario ?? null)
  const [requiereOnboarding, setRequiereOnboarding] = useState(
    sesionInicial?.requiereOnboarding ?? false
  )
  const [rol, setRol] = useState(sesionInicial?.usuario?.rol ?? "admin") // "admin" | "cajero"
  const [sucursalActiva, setSucursalActiva] = useState(() =>
    sucursalInicialDe(sesionInicial?.usuario, datosIniciales.sucursales)
  )
  const [tema, setTema] = useState(temaInicial) // "light" | "dark"

  // Datos del negocio
  const [negocio, setNegocio] = useState(datosIniciales.negocio)
  const [sucursales, setSucursales] = useState(datosIniciales.sucursales)
  const [pinAdmin, setPinAdmin] = useState(datosIniciales.pinAdmin)
  const [usuariosNegocio, setUsuariosNegocio] = useState(datosIniciales.usuariosNegocio)
  const [productos, setProductos] = useState(datosIniciales.productos)
  const [clientes, setClientes] = useState(datosIniciales.clientes)
  const [proveedores, setProveedores] = useState(datosIniciales.proveedores)
  const [ventas, setVentas] = useState(datosIniciales.ventas)
  const [egresos, setEgresos] = useState(datosIniciales.egresos)

  // Autorización de administrador (PIN)
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false)
  const [adminTemporalHasta, setAdminTemporalHasta] = useState(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const accionPendiente = useRef(null)

  const aplicarDatos = useCallback((d) => {
    setNegocio(d.negocio)
    setSucursales(d.sucursales)
    setPinAdmin(d.pinAdmin)
    setUsuariosNegocio(d.usuariosNegocio)
    setProductos(d.productos)
    setClientes(d.clientes)
    setProveedores(d.proveedores)
    setVentas(d.ventas)
    setEgresos(d.egresos)
  }, [])

  // La deuda de cada cliente se calcula a partir de sus ventas fiadas pendientes
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

  const sucursalActual = sucursales.find((s) => s.id === sucursalActiva) || null

  // ---------- Tema claro / oscuro ----------
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark")
    try {
      localStorage.setItem("abaco-tema", tema)
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [tema])

  const alternarTema = () => setTema((t) => (t === "dark" ? "light" : "dark"))

  // ---------- Roles ----------
  // El cajero trabaja en una sola sucursal: no tiene vista global
  const pasarACajero = useCallback(() => {
    setRol("cajero")
    setAdminTemporalHasta(null)
    setSucursalActiva((actual) => (actual === "todas" ? sucursales[0]?.id ?? "todas" : actual))
  }, [sucursales])

  // Cuenta regresiva del acceso temporal de administrador
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
        toast.info("El acceso de administrador expiró")
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [adminTemporalHasta, pasarACajero])

  // Pide el PIN de admin. Si ya eres admin, ejecuta la acción directamente.
  // Uso: solicitarAutorizacion(() => abrirDialogo())
  const solicitarAutorizacion = useCallback(
    (accion) => {
      if (rol === "admin") {
        accion?.()
        return
      }
      accionPendiente.current = accion ?? null
      setModalAdminAbierto(true)
    },
    [rol]
  )

  // ¿Hay una acción esperando la autorización? (función: lee un ref, no es estado)
  const tieneAccionPendiente = useCallback(() => accionPendiente.current !== null, [])

  const cerrarModalAdmin = useCallback(() => {
    accionPendiente.current = null
    setModalAdminAbierto(false)
  }, [])

  // Devuelve true si el PIN es correcto.
  //  modo "temporal" (por defecto): eleva el rol a admin por MINUTOS_ADMIN_TEMPORAL y ejecuta la acción.
  //  modo "unico": solo ejecuta la acción pendiente, sin cambiar el rol de la sesión.
  const validarPinAdmin = useCallback(
    (pin, modo = "temporal") => {
      if (pin !== pinAdmin) return false
      const accion = accionPendiente.current
      accionPendiente.current = null
      setModalAdminAbierto(false)
      if (modo !== "unico") {
        setRol("admin")
        setAdminTemporalHasta(Date.now() + MINUTOS_ADMIN_TEMPORAL * 60 * 1000)
      }
      accion?.()
      return true
    },
    [pinAdmin]
  )

  // ---------- Sesión (usa la capa de servicios) ----------
  const aplicarSesion = useCallback(
    (sesion) => {
      const datos = datosParaUsuario(sesion.usuario)
      aplicarDatos(datos)
      setUsuario(sesion.usuario)
      setRequiereOnboarding(sesion.requiereOnboarding)
      setRol(sesion.usuario.rol)
      setAdminTemporalHasta(null)
      setSucursalActiva(sucursalInicialDe(sesion.usuario, datos.sucursales))
    },
    [aplicarDatos]
  )

  // Cada método devuelve { usuario, requiereOnboarding } o lanza un Error
  const login = useCallback(
    async (credenciales) => {
      const sesion = await iniciarSesion(credenciales)
      aplicarSesion(sesion)
      return sesion
    },
    [aplicarSesion]
  )

  const registro = useCallback(
    async (datos) => {
      const sesion = await registrarDueno(datos)
      aplicarSesion(sesion)
      return sesion
    },
    [aplicarSesion]
  )

  const loginDemo = useCallback(
    async (tipo) => {
      const sesion = await iniciarSesionDemo(tipo)
      aplicarSesion(sesion)
      return sesion
    },
    [aplicarSesion]
  )

  const logout = useCallback(async () => {
    await cerrarSesionServicio()
    setUsuario(null)
    setRequiereOnboarding(false)
    setRol("admin")
    setAdminTemporalHasta(null)
    setModalAdminAbierto(false)
  }, [])

  // formulario: { negocio, sucursal, pinSeguridad, cajeros }
  const completarOnboarding = useCallback(
    async ({ negocio: n, sucursal: s, pinSeguridad, cajeros }) => {
      if (!usuario) throw new Error("No hay una sesión activa")

      const resultado = await ejecutarOnboardingTransaccional({
        negocio: n,
        sucursal: s,
        usuarioAdmin: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          pin_seguridad: pinSeguridad,
        },
        cajeros,
      })

      const admin = resultado.usuarios.find((u) => u.rol === "admin")
      const usuarioNuevo = {
        id: admin.id,
        negocio_id: admin.negocio_id,
        sucursal_id: admin.sucursal_id,
        nombre: admin.nombre,
        email: admin.email,
        rol: "admin",
      }

      actualizarSesionTrasOnboarding(usuarioNuevo)
      aplicarDatos(datosNegocioNuevo(resultado))
      setUsuario(usuarioNuevo)
      setRequiereOnboarding(false)
      setRol("admin")
      setSucursalActiva("todas")
      return resultado
    },
    [usuario, aplicarDatos]
  )

  const value = {
    // sesión
    usuario,
    requiereOnboarding,
    login,
    registro,
    loginDemo,
    logout,
    completarOnboarding,
    // negocio
    negocio,
    sucursales,
    sucursalActiva,
    setSucursalActiva,
    sucursalActual,
    usuariosNegocio,
    setUsuariosNegocio,
    // roles y PIN
    rol,
    pasarACajero,
    pinAdmin,
    esAdminTemporal: adminTemporalHasta !== null,
    segundosRestantes,
    solicitarAutorizacion,
    tieneAccionPendiente,
    modalAdminAbierto,
    cerrarModalAdmin,
    validarPinAdmin,
    // tema
    tema,
    alternarTema,
    // datos
    productos,
    setProductos,
    clientes: clientesConDeuda,
    setClientes,
    proveedores,
    setProveedores,
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