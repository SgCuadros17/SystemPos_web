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

// ---------- Contexto ----------
const POSContext = createContext(null)

export const PIN_ADMIN_DEMO = "1234"
export const MINUTOS_ADMIN_TEMPORAL = 10

// Función auxiliar para fechas de la demo
const fechaHace = (dias) => new Date(Date.now() - dias * 86400000).toISOString()

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

// Mantén aquí tus variables iniciales originales o vacías si es el arranque de un nuevo proyecto
const SUCURSALES = [
  { id: "s1", negocio_id: "neg-1", nombre: "Sede Principal", activa: true, creado_en: fechaHace(30) }
]
const PRODUCTOS_INICIALES = []
const CLIENTES_INICIALES = []
const PROVEEDORES_INICIALES = []
const VENTAS_INICIALES = []
const EGRESOS_INICIALES = []

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

const datosNegocioNuevo = ({ negocio, sucursal, usuarios }) => ({
  negocio,
  sucursales: [
    {
      id: sucursal.id,
      nombre: sucursal.nombre,
      direccion: sucursal.direccion ?? "",
      telefono: sucursal.telefono ?? "",
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

const sucursalInicialDe = (usuario, sucursales) =>
  usuario?.rol === "cajero" ? usuario.sucursal_id ?? sucursales[0]?.id ?? "todas" : "todas"

const temaInicial = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"

export function POSProvider({ children }) {
  const [sesionInicial] = useState(() => obtenerSesionGuardada())
  const [datosIniciales] = useState(() => datosParaUsuario(sesionInicial?.usuario))

  const [usuario, setUsuario] = useState(sesionInicial?.usuario ?? null)
  const [requiereOnboarding, setRequiereOnboarding] = useState(
    sesionInicial?.requiereOnboarding ?? false
  )
  const [rol, setRol] = useState(sesionInicial?.usuario?.rol ?? "admin")
  const [sucursalActiva, setSucursalActiva] = useState(() =>
    sucursalInicialDe(sesionInicial?.usuario, datosIniciales.sucursales)
  )
  const [tema, setTema] = useState(temaInicial)

  const [negocio, setNegocio] = useState(datosIniciales.negocio)
  const [sucursales, setSucursales] = useState(datosIniciales.sucursales)
  const [pinAdmin, setPinAdmin] = useState(datosIniciales.pinAdmin)
  const [usuariosNegocio, setUsuariosNegocio] = useState(datosIniciales.usuariosNegocio)
  const [productos, setProductos] = useState(datosIniciales.productos)
  const [clientes, setClientes] = useState(datosIniciales.clientes)
  const [proveedores, setProveedores] = useState(datosIniciales.proveedores)
  const [ventas, setVentas] = useState(datosIniciales.ventas)
  const [egresos, setEgresos] = useState(datosIniciales.egresos)

  const [modalAdminAbierto, setModalAdminAbierto] = useState(false)
  const [adminTemporalHasta, setAdminTemporalHasta] = useState(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const [tieneAccionPendiente, setTieneAccionPendiente] = useState(false)
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
    setSucursalActiva((actual) => (actual === "todas" ? sucursales[0]?.id ?? "todas" : actual))
  }, [sucursales])

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

  const validarPinAdmin = useCallback(
    (pin, modo = "panel") => {
      if (pin !== pinAdmin) return false
      
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
    },
    [pinAdmin]
  )

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
    usuario,
    requiereOnboarding,
    login,
    registro,
    loginDemo,
    logout,
    completarOnboarding,
    negocio,
    sucursales,
    sucursalActiva,
    setSucursalActiva,
    sucursalActual,
    usuariosNegocio,
    setUsuariosNegocio,
    rol,
    pasarACajero,
    pinAdmin,
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