import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  obtenerSesionGuardada,
  iniciarSesion,
  registrarDueno,
  iniciarSesionDemo,
  cerrarSesionServicio,
  actualizarSesionTrasOnboarding,
  generarUUID,
  USUARIO_ADMIN_DEMO,
  USUARIO_CAJERO_DEMO,
} from "@/services/auth.service"
import {
  ejecutarOnboardingTransaccional,
  leerOnboardingGuardado,
} from "@/services/onboarding.service"
import {
  PROVEEDORES_TRANSFERENCIA_DEFAULT,
  FRANQUICIAS_DATAFONO_DEFAULT,
  FRANQUICIA_DATAFONO_PREDETERMINADA,
  normalizarNombrePago,
} from "@/config/catalogs"

// ---------- Utilidades ----------
export const formatCOP = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor)

// "Arroz blanco · Orquídea · 1kg" (omite marca/presentación vacías)
export const construirNombreUnificado = (p) =>
  [p.nombre, p.marca, p.presentacion].filter(Boolean).join(" · ")

const conNombreUnificado = (p) => ({ ...p, nombreUnificado: construirNombreUnificado(p) })

// Redondeo a 2 decimales (equivale a NUMERIC(12,2) en Supabase)
export const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Costo de 1 unidad almacenada en stock (si tiene rendimiento > 1, el stock está en porciones
// y costoCompra es el del paquete/unidad comprada, por lo que 1 porción cuesta costoCompra / rendimiento)
export const costoUnitarioStock = (p) => {
  const costo = Number(p?.costoCompra) || 0
  const rend = Number(p?.rendimiento) > 1 ? Number(p.rendimiento) : 1
  return costo / rend
}

export const sugerirCalculoReceta = (producto, productosMap) => {
  const receta = producto?.receta ?? []
  const buscar = (id) => (productosMap instanceof Map ? productosMap.get(id) : productosMap?.[id])
  let costoSugerido = 0
  let usados = 0

  for (const linea of receta) {
    const insumo = buscar(linea.insumoId)
    const cantidad = Number(linea.cantidad)
    if (!insumo || !(cantidad > 0)) continue
    usados += 1
    costoSugerido += costoUnitarioStock(insumo) * cantidad
  }

  if (usados === 0) return null
  return { costoSugerido: Math.round(costoSugerido) }
}

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
  { id: "s1", nombre: "Tienda 1", direccion: "Calle 10 #20-30", telefono: "300 111 0001", activa: true, numMesas: 0 },
  { id: "s2", nombre: "Tienda 2", direccion: "Carrera 45 #12-18", telefono: "300 111 0002", activa: true, numMesas: 0 },
  { id: "s3", nombre: "Restaurante", direccion: "Avenida Principal #5-60", telefono: "300 111 0003", activa: true, numMesas: 8 },
]

// Producto = productos + inventario_sucursal (stock por sede).
// stock: { idSucursal: unidades }. Si una sede no maneja el producto, no tiene clave.
const prod = (id, nombre, marca, presentacion, categoria, precio, costoCompra, codigoBarras, icono, stock, extra = {}) => ({
  id, nombre, marca, presentacion, categoria, precio, costoCompra, codigoBarras, icono,
  imagenUrl: null,
  stockMinimo: 5,
  activo: true,
  stock,
  tipoItem: "venta_directa", // "venta_directa" | "insumo" | "preparado"
  rendimiento: 1,
  receta: [], // [{ insumoId, cantidad }]
  disponibleMenu: true,
  ...extra,
})

const PRODUCTOS_INICIALES = [
  prod("p1", "Aceite vegetal", "Premier", "1L", "Despensa", 10000, 7800, "770200100001", "droplet", { s1: 24, s2: 12, s3: 6 }),
  prod("p2", "Huevos rojos AA", "Kikes", "Panal x30", "Despensa", 15000, 12200, "770200100002", "egg", { s1: 18, s2: 4, s3: 10 }),
  prod("p3", "Arroz blanco", "Orquídea", "1kg", "Despensa", 4500, 3400, "770200100003", "wheat", { s1: 60, s2: 35, s3: 20 }),
  prod("p4", "Leche entera", "Colanta", "1L", "Lácteos", 4200, 3300, "770200100004", "milk", { s1: 40, s2: 3, s3: 15 }),
  prod("p5", "Gaseosa", "Postobón", "1.5L", "Bebidas", 6500, 4800, "770200100005", "cup-soda", { s1: 30, s2: 22, s3: 18 }),
  prod("p6", "Pan tajado", "Bimbo", "Bolsa 500g", "Panadería", 5800, 4300, "770200100006", "croissant", { s1: 15, s2: 9 }),
  prod("p7", "Café molido", "Sello Rojo", "250g", "Despensa", 9500, 7400, "770200100007", "coffee", { s1: 20, s2: 14, s3: 8 }),
  prod("p8", "Hamburguesa artesanal", "De la casa", "Combo", "Comidas rápidas", 18000, 5400, "", "sandwich", { s3: 45 }, {
    tipoItem: "preparado",
    receta: [{ insumoId: "p10", cantidad: 1 }, { insumoId: "p12", cantidad: 1 }],
  }),
  prod("p9", "Jugo natural", "De la casa", "Vaso 16oz", "Jugos y granizados", 6000, 2500, "", "glass-water", { s3: 50 }),
  prod("p10", "Carne de hamburguesa", "De la casa", "Porción 150g", "Insumos de cocina y barra", 0, 4800, "", "beef", { s3: 18 }, { tipoItem: "insumo", rendimiento: 1 }),
  prod("p11", "Limón Tahití", "Plaza", "Unidad", "Insumos de cocina y barra", 0, 300, "", "apple", { s3: 40 }, { tipoItem: "insumo", rendimiento: 1 }),
  prod("p12", "Pan de hamburguesa", "Bimbo", "Paquete x12", "Insumos de cocina y barra", 0, 7200, "", "sandwich", { s3: 24 }, { tipoItem: "insumo", rendimiento: 12 }),
].map(conNombreUnificado)

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

// ---------- Pagos: modelo relacional (pagos_venta) ----------
// Crea una venta y sus líneas de pago.
// pagos: [[payment_type, payment_provider?, monto?]]
// Una línea sin monto toma lo que falta para completar el total (pago único = todo el total).
// nombreHistorico equivale a detalle_ventas.nombre_historico en Supabase.
const crearVenta = (id, sucursalId, dias, pagos, items, clienteId = null, creditoPagado = false) => {
  const n = parseInt(id.slice(1), 10) || 0
  const detalle = items.map(([productoId, cantidad]) => {
    const producto = PRODUCTOS_INICIALES.find((p) => p.id === productoId)
    return {
      productoId,
      nombreHistorico: producto.nombreUnificado,
      cantidad,
      precio: producto.precio,
      subtotal: producto.precio * cantidad,
    }
  })
  const total = detalle.reduce((suma, i) => suma + i.subtotal, 0)

  let acumulado = 0
  const lineas = pagos.map(([payment_type, payment_provider = null, monto], i) => {
    const valor = monto ?? total - acumulado
    acumulado += valor
    return {
      id: `${id}-pg${i + 1}`,
      venta_id: id,
      payment_type,
      payment_provider,
      monto: valor,
      referencia: null,
    }
  })
  const tieneCredito = lineas.some((l) => l.payment_type === "credito")

  return {
    venta: {
      id,
      sucursalId,
      fecha: fechaDemo(dias, n),
      clienteId,
      // estadoDeuda solo existe si hay una línea de crédito
      estadoDeuda: tieneCredito ? (creditoPagado ? "pagada" : "pendiente") : null,
      items: detalle,
      total,
    },
    pagos: lineas,
  }
}

const DEMO_VENTAS = [
  // Hoy
  crearVenta("v001", "s1", 0, [["efectivo"]], [["p1", 1], ["p3", 2]]),
  crearVenta("v002", "s1", 0, [["transferencia", "Nequi"]], [["p2", 1], ["p4", 2]]),
  crearVenta("v003", "s2", 0, [["tarjeta", "Redeban"]], [["p5", 2], ["p6", 1]]),
  crearVenta("v004", "s3", 0, [["efectivo"]], [["p8", 2], ["p9", 2]]),
  crearVenta("v005", "s3", 0, [["transferencia", "Bancolombia"]], [["p8", 1], ["p9", 1]]),
  crearVenta("v006", "s1", 0, [["credito"]], [["p4", 2], ["p6", 1]], "c2"),
  // Pago dividido: $20.000 en efectivo y el resto con tarjeta
  crearVenta("v016", "s3", 0, [["efectivo", null, 20000], ["tarjeta", "Bold"]], [["p8", 2], ["p9", 1]]),
  // Últimos 7 días (para las gráficas)
  crearVenta("v007", "s1", 1, [["efectivo"]], [["p7", 2], ["p3", 4]]),
  crearVenta("v008", "s2", 1, [["transferencia", "Nequi"]], [["p5", 3], ["p2", 1]]),
  crearVenta("v009", "s3", 1, [["efectivo"]], [["p8", 3], ["p9", 3]]),
  crearVenta("v010", "s1", 2, [["tarjeta", "Redeban"]], [["p1", 2], ["p7", 1]]),
  crearVenta("v011", "s2", 2, [["efectivo"]], [["p4", 4], ["p6", 2]]),
  crearVenta("v012", "s3", 3, [["transferencia", "Bre-B"]], [["p8", 4], ["p9", 2]]),
  // Pago dividido: $20.000 en efectivo y el resto por transferencia
  crearVenta("v013", "s1", 4, [["efectivo", null, 20000], ["transferencia", "Bancolombia"]], [["p2", 2], ["p5", 2]]),
  crearVenta("v014", "s2", 5, [["efectivo"]], [["p3", 6], ["p1", 1]]),
  crearVenta("v015", "s3", 6, [["efectivo"]], [["p8", 2], ["p9", 4]]),
  // Créditos de Sebastián (pendientes)
  crearVenta("v101", "s1", 3, [["credito"]], [["p1", 1], ["p2", 1]], "c1"),
  crearVenta("v102", "s2", 1, [["credito"]], [["p7", 1], ["p5", 1]], "c1"),
  // Crédito de Don Carlos (hace 8 días, ya pagado: solo entra en "Histórico")
  crearVenta("v103", "s1", 8, [["credito"]], [["p3", 3]], "c3", true),
]

const VENTAS_INICIALES = DEMO_VENTAS.map((x) => x.venta)
const PAGOS_VENTA_INICIALES = DEMO_VENTAS.flatMap((x) => x.pagos)

// abonos_credito: pagos de deudas (efectivo, transferencia o tarjeta; nunca crédito)
const ABONOS_INICIALES = [
  {
    id: "ab1", clienteId: "c3", sucursalId: "s1",
    payment_type: "efectivo", payment_provider: null,
    monto: 13500, ventasSaldadasIds: ["v103"],
    usuarioNombre: "Administrador Demo", fecha: fechaDemo(0, 2),
  },
]

// egresos_caja: pagos a proveedores (efectivo o transferencia)
const EGRESOS_INICIALES = [
  { id: "e1", sucursalId: "s1", proveedorId: "pr1", monto: 120000, payment_type: "efectivo", payment_provider: null, fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Lacteos" },
  { id: "e2", sucursalId: "s3", proveedorId: "pr2", monto: 85000, payment_type: "transferencia", payment_provider: "Nequi", fecha: fechaHace(0), urlFoto: "https://placehold.co/400x520?text=Factura+Montana" },
  { id: "e3", sucursalId: "s2", proveedorId: "pr3", monto: 60000, payment_type: "efectivo", payment_provider: null, fecha: fechaHace(1), urlFoto: "https://placehold.co/400x520?text=Factura+Trigal" },
]

// Traslados internos (traslados_inventario): no afectan el dinero de la caja
const TRASLADOS_INICIALES = [
  {
    id: "t1", productoId: "p4", origenId: "s1", destinoId: "s2", cantidad: 20,
    estado: "completado", usuarioNombre: "Administrador Demo",
    nota: "Reposición de leche por stock bajo en Tienda 2", fecha: fechaHace(2),
  },
  {
    id: "t2", productoId: "p7", origenId: "s1", destinoId: "s3", cantidad: 6,
    estado: "completado", usuarioNombre: "Administrador Demo",
    nota: "Café para el servicio del restaurante", fecha: fechaHace(3),
  },
  {
    id: "t3", productoId: "p2", origenId: "s1", destinoId: "s2", cantidad: 12,
    estado: "completado", usuarioNombre: "Cajero Demo",
    nota: "Traslado de emergencia", fecha: fechaHace(5),
  },
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

// Configuración de medios de pago (SUPABASE: tabla payment_providers por negocio, con activo = borrado lógico)
const configPagosInicial = () => ({
  proveedoresTransferencia: PROVEEDORES_TRANSFERENCIA_DEFAULT.map((nombre, i) => ({
    id: `pt${i + 1}`, nombre, activo: true,
  })),
  franquiciasDatafono: FRANQUICIAS_DATAFONO_DEFAULT.map((nombre, i) => ({
    id: `fd${i + 1}`, nombre, activo: true,
  })),
  franquiciaPredeterminada: FRANQUICIA_DATAFONO_PREDETERMINADA,
})

// PIN numérico único de 6 dígitos (patrón ^[0-9]{4,6}$ de clientes_credito.pin_autorizacion)
export const generarPinCliente = (pinsExistentes = [], largo = 6) => {
  const usados = new Set(pinsExistentes)
  for (let intento = 0; intento < 300; intento++) {
    const azar =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : Math.floor(Math.random() * 4294967296)
    const pin = String(azar % 10 ** largo).padStart(largo, "0")
    if (!/^[0-9]{4,6}$/.test(pin)) continue
    if (usados.has(pin)) continue
    if (/^(\d)\1+$/.test(pin)) continue // descarta 000000, 111111...
    return pin
  }
  throw new Error("No se pudo generar un PIN único")
}

// Datos del negocio de demostración (con ventas, stock, créditos...)
const datosDemo = () => ({
  negocio: NEGOCIO_DEMO,
  sucursales: SUCURSALES,
  productos: PRODUCTOS_INICIALES,
  clientes: CLIENTES_INICIALES,
  proveedores: PROVEEDORES_INICIALES,
  ventas: VENTAS_INICIALES,
  egresos: EGRESOS_INICIALES,
  pagosVenta: PAGOS_VENTA_INICIALES,
  abonosCredito: ABONOS_INICIALES,
  configPagos: configPagosInicial(),
  traslados: TRASLADOS_INICIALES,
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
  pagosVenta: [],
  abonosCredito: [],
  configPagos: configPagosInicial(),
  traslados: [],
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

// ---------- Normalización de productos ----------
const aTexto = (v) => (v ?? "").toString().trim()
const aNumero = (v, defecto = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : defecto
}

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
  const [productosBase, setProductosBase] = useState(datosIniciales.productos)
  const [clientes, setClientes] = useState(datosIniciales.clientes)
  const [proveedores, setProveedores] = useState(datosIniciales.proveedores)
  const [ventas, setVentas] = useState(datosIniciales.ventas)
  const [egresos, setEgresos] = useState(datosIniciales.egresos)
  const [pagosVenta, setPagosVenta] = useState(datosIniciales.pagosVenta ?? [])
  const [abonosCredito, setAbonosCredito] = useState(datosIniciales.abonosCredito ?? [])
  const [configPagos, setConfigPagos] = useState(datosIniciales.configPagos ?? configPagosInicial())
  const [traslados, setTraslados] = useState(datosIniciales.traslados)

  // Autorización de administrador (PIN)
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false)
  const [adminTemporalHasta, setAdminTemporalHasta] = useState(null)
  const [modoAdminTemporal, setModoAdminTemporal] = useState(null) // null | "accion" | "panel"
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const accionPendiente = useRef(null) // función pendiente de ejecutar tras validar PIN

  const aplicarDatos = useCallback((d) => {
    setNegocio(d.negocio)
    setSucursales(d.sucursales)
    setPinAdmin(d.pinAdmin)
    setUsuariosNegocio(d.usuariosNegocio)
    setProductosBase(d.productos)
    setClientes(d.clientes)
    setProveedores(d.proveedores)
    setVentas(d.ventas)
    setEgresos(d.egresos)
    setPagosVenta(d.pagosVenta ?? [])
    setAbonosCredito(d.abonosCredito ?? [])
    setConfigPagos(d.configPagos ?? configPagosInicial())
    setTraslados(d.traslados ?? [])
  }, [])

  // Todos los productos expuestos incluyen nombreUnificado (siempre recalculado)
  const productos = useMemo(() => productosBase.map(conNombreUnificado), [productosBase])

   // La deuda sale de la línea de crédito de cada venta pendiente (no del total de la venta)
  const clientesConDeuda = useMemo(() => {
    const creditoPorVenta = new Map()
    for (const p of pagosVenta) {
      if (p.payment_type === "credito") {
        creditoPorVenta.set(p.venta_id, (creditoPorVenta.get(p.venta_id) ?? 0) + p.monto)
      }
    }
    return clientes.map((c) => ({
      ...c,
      deuda: ventas
        .filter((v) => v.clienteId === c.id && v.estadoDeuda === "pendiente")
        .reduce((suma, v) => suma + (creditoPorVenta.get(v.id) ?? 0), 0),
    }))
  }, [clientes, ventas, pagosVenta])

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
    setModoAdminTemporal(null)
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
    (pin, modo = "panel") => {
      if (pin !== pinAdmin) return false
      const accion = accionPendiente.current
      accionPendiente.current = null
      setModalAdminAbierto(false)
      setRol("admin")
      setModoAdminTemporal(modo === "accion" ? "accion" : "panel")
      setAdminTemporalHasta(Date.now() + MINUTOS_ADMIN_TEMPORAL * 60 * 1000)
      accion?.()
      return true
    },
    [pinAdmin]
  )

  // =====================================================================
  // INVENTARIO
  // Todas lanzan un Error con mensaje claro si algo no es válido.
  // La restricción "solo el admin ingresa stock" la aplica la interfaz con
  // solicitarAutorizacion(); en Supabase la refuerzan las políticas RLS.
  // SUPABASE: cada función se convertiría en un servicio (inventario.service.js).
  // =====================================================================

  // Crea (sin id, o con un id nuevo generado en el cliente) o actualiza un producto.
  // Campos: nombre, marca, presentacion, categoria, precio, costoCompra, codigoBarras,
  // icono, imagenUrl, stockMinimo, activo, stock. Los campos no enviados se conservan.
  // SUPABASE: upsert en `productos` (+ filas de `inventario_sucursal` según `stock`).
  const guardarProducto = useCallback(
    (datos) => {
      const existente = datos.id ? productosBase.find((p) => p.id === datos.id) : null
      const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined))
      const base = existente ?? {}
      const m = { ...base, ...limpio }

      const nombre = aTexto(m.nombre)
      if (!nombre) throw new Error("El nombre del producto es obligatorio")
      const precio = aNumero(m.precio, NaN)
      if (!Number.isFinite(precio) || precio < 0) throw new Error("El precio de venta no es válido")
      const costoBruto = aNumero(m.costoCompra, 0)
      if (costoBruto < 0) throw new Error("El costo de compra no puede ser negativo")
      const costoCompra = redondear2(costoBruto)
      const tipoItem = ["venta_directa", "insumo", "preparado"].includes(m.tipoItem)
        ? m.tipoItem
        : "venta_directa"
      const rendimientoN = aNumero(m.rendimiento, 1)
      const rendimiento = rendimientoN > 0 ? rendimientoN : 1
      const receta =
        tipoItem === "preparado" && Array.isArray(m.receta)
          ? m.receta
              .map((r) => ({ insumoId: r.insumoId, cantidad: aNumero(r.cantidad, 0) }))
              .filter((r) => r.insumoId && r.cantidad > 0 && r.insumoId !== existente?.id)
          : []  

      const producto = {
        id: existente ? existente.id : datos.id || `p-${generarUUID()}`,
        nombre,
        marca: aTexto(m.marca),
        presentacion: aTexto(m.presentacion),
        categoria: aTexto(m.categoria) || "Otros",
        precio,
        costoCompra,
        codigoBarras: aTexto(m.codigoBarras),
        icono: aTexto(m.icono) || "package",
        imagenUrl: m.imagenUrl || null,
        stockMinimo: Math.max(0, Math.floor(aNumero(m.stockMinimo, 5))),
        activo: m.activo !== false,
        tipoItem,
        rendimiento,
        receta,
        disponibleMenu: m.disponibleMenu !== false,
        stock: { ...(limpio.stock ?? base.stock ?? {}) },
      }

      setProductosBase((lista) =>
        existente
          ? lista.map((p) => (p.id === producto.id ? producto : p))
          : [...lista, producto]
      )
      return conNombreUnificado(producto)
    },
    [productosBase]
  )

  // Suma stock en una sede (ingreso de mercancía tras revisar la factura).
  // Si viene nuevoCosto válido, actualiza costoCompra con el Costo Promedio Ponderado (CPP)
  // entre el stock existente (todas las sedes) y la entrada nueva. El factor rendimiento se
  // cancela: stock y entrada están en la misma unidad y ambos costos son por unidad de compra.
  // SUPABASE: update inventario_sucursal set stock_actual = stock_actual + n (mejor vía RPC).
  const ingresarStockSucursal = useCallback(
    ({ productoId, sucursalId, cantidadAgregada, nuevoCosto }) => {
      const producto = productosBase.find((p) => p.id === productoId)
      if (!producto) throw new Error("El producto no existe")
      if (!sucursales.some((s) => s.id === sucursalId)) throw new Error("La sucursal no existe")
      const cantidad = Number(cantidadAgregada)
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser un entero mayor a 0")
      }

      const nuevoStock = (producto.stock?.[sucursalId] ?? 0) + cantidad
      const costoValido =
        nuevoCosto !== undefined && nuevoCosto !== null && nuevoCosto !== "" &&
        Number.isFinite(Number(nuevoCosto)) && Number(nuevoCosto) >= 0

      let costoCompra = producto.costoCompra
      if (costoValido) {
        const costoNuevo = Number(nuevoCosto)
        const stockExistenteTotal = Object.values(producto.stock ?? {}).reduce(
          (suma, u) => suma + (typeof u === "number" && u > 0 ? u : 0),
          0
        )
        const costoAnterior = Number(producto.costoCompra) || 0
        const costoPromedio =
          stockExistenteTotal > 0 && costoAnterior > 0
            ? (stockExistenteTotal * costoAnterior + cantidad * costoNuevo) /
              (stockExistenteTotal + cantidad)
            : costoNuevo
        costoCompra = redondear2(costoPromedio)
      }

      setProductosBase((lista) =>
        lista.map((p) =>
          p.id === productoId
            ? { ...p, costoCompra, stock: { ...p.stock, [sucursalId]: nuevoStock } }
            : p
        )
      )
      return nuevoStock
    },
    [productosBase, sucursales]
  )

  // Define el stock exacto de una sede (conteo físico).
  // stockExacto = null -> la sede deja de manejar el producto (se elimina la clave).
  // SUPABASE: update/delete lógico en inventario_sucursal.
  const ajustarStockSucursal = useCallback(
    (productoId, sucursalId, stockExacto) => {
      const producto = productosBase.find((p) => p.id === productoId)
      if (!producto) throw new Error("El producto no existe")
      if (!sucursales.some((s) => s.id === sucursalId)) throw new Error("La sucursal no existe")

      const dejaDeManejarlo = stockExacto === null || stockExacto === undefined || stockExacto === ""
      if (!dejaDeManejarlo) {
        const n = Number(stockExacto)
        if (!Number.isInteger(n) || n < 0) throw new Error("El stock debe ser un entero de 0 o más")
      }

      setProductosBase((lista) =>
        lista.map((p) => {
          if (p.id !== productoId) return p
          const stock = { ...p.stock }
          if (dejaDeManejarlo) delete stock[sucursalId]
          else stock[sucursalId] = Number(stockExacto)
          return { ...p, stock }
        })
      )
    },
    [productosBase, sucursales]
  )

  // Borrado lógico: nunca se elimina físicamente (productos.activo = false)
  const cambiarEstadoProducto = useCallback((productoId, activo) => {
    setProductosBase((lista) =>
      lista.map((p) => (p.id === productoId ? { ...p, activo: Boolean(activo) } : p))
    )
  }, [])

  // Traslado interno: resta en origen y suma en destino en una sola operación.
  // No toca ventas ni egresos, así que no afecta la caja.
  // SUPABASE: RPC transaccional (resta + suma + insert en traslados_inventario).
  const registrarTraslado = useCallback(
    ({ productoId, origenId, destinoId, cantidad, nota }) => {
      const producto = productosBase.find((p) => p.id === productoId)
      if (!producto) throw new Error("Selecciona un producto")
      const origen = sucursales.find((s) => s.id === origenId)
      const destino = sucursales.find((s) => s.id === destinoId)
      if (!origen) throw new Error("Selecciona la sucursal de origen")
      if (!destino) throw new Error("Selecciona la sucursal de destino")
      if (origenId === destinoId) throw new Error("El origen y el destino deben ser distintos")

      const unidades = Number(cantidad)
      if (!Number.isInteger(unidades) || unidades <= 0) {
        throw new Error("La cantidad debe ser un entero mayor a 0")
      }
      const disponible = producto.stock?.[origenId] ?? 0
      if (unidades > disponible) {
        throw new Error(`Solo hay ${disponible} unidad(es) disponibles en ${origen.nombre}`)
      }

      // --- DETERMINAR EL RESPONSABLE REAL ---
      // Si hay un usuario logueado con nombre, usamos su nombre.
      // Si no, determinamos si el rol activo o la vista actual es de cajero o admin.
      let nombreResponsable = usuario?.nombre;
      if (!nombreResponsable) {
        // Verificamos si el rol es cajero o si estamos operando bajo la vista de cajero
        const esCajeroActivo = rol === "cajero" || (window.location && window.location.pathname.includes("cajero"));
        nombreResponsable = esCajeroActivo ? "Cajero Demo" : "Administrador Demo";
      }

      const traslado = {
        id: generarUUID(),
        productoId,
        origenId,
        destinoId,
        cantidad: unidades,
        estado: "completado",
        usuarioNombre: nombreResponsable,
        nota: aTexto(nota),
        fecha: new Date().toISOString(),
      }

      setProductosBase((lista) =>
        lista.map((p) =>
          p.id === productoId
            ? {
                ...p,
                stock: {
                  ...p.stock,
                  [origenId]: (p.stock?.[origenId] ?? 0) - unidades,
                  [destinoId]: (p.stock?.[destinoId] ?? 0) + unidades,
                },
              }
            : p
        )
      )

      setTraslados((prev) => [traslado, ...prev])
      return traslado
    },
    [productosBase, sucursales, usuario, rol]
  )

    // =====================================================================
  // MEDIOS DE PAGO: proveedores de transferencia y franquicias de datáfono
  // Borrado lógico: se desactivan, nunca se eliminan (el historial guarda el nombre tal cual).
  // =====================================================================
  const claveConfig = (tipo) => (tipo === "tarjeta" ? "franquiciasDatafono" : "proveedoresTransferencia")

  // tipo: "transferencia" (Nequi, Bancolombia...) | "tarjeta" (Redeban, Bold...)
  const agregarProveedorPago = useCallback(
    (tipo, nombre) => {
      if (tipo !== "transferencia" && tipo !== "tarjeta") throw new Error("Tipo de pago no válido")
      const limpio = aTexto(nombre)
      if (limpio.length < 2) throw new Error("Escribe el nombre del proveedor")
      if (limpio.length > 50) throw new Error("El nombre admite máximo 50 caracteres")

      const clave = claveConfig(tipo)
      const existente = configPagos[clave].find(
        (p) => normalizarNombrePago(p.nombre) === normalizarNombrePago(limpio)
      )
      if (existente?.activo) throw new Error(`“${existente.nombre}” ya existe`)

      setConfigPagos((c) => ({
        ...c,
        [clave]: existente
          ? c[clave].map((p) => (p.id === existente.id ? { ...p, activo: true } : p))
          : [...c[clave], { id: `pp-${generarUUID()}`, nombre: limpio, activo: true }],
      }))
      return existente?.nombre ?? limpio
    },
    [configPagos]
  )

  const cambiarEstadoProveedorPago = useCallback(
    (tipo, id, activo) => {
      const clave = claveConfig(tipo)
      const item = configPagos[clave].find((p) => p.id === id)
      if (!item) throw new Error("El proveedor no existe")

      let predeterminada = configPagos.franquiciaPredeterminada
      if (
        !activo &&
        tipo === "tarjeta" &&
        normalizarNombrePago(item.nombre) === normalizarNombrePago(predeterminada)
      ) {
        // No se puede desactivar la predeterminada sin dejar otra activa en su lugar
        const otra = configPagos.franquiciasDatafono.find((p) => p.id !== id && p.activo)
        if (!otra) throw new Error("Debe quedar al menos una franquicia de datáfono activa")
        predeterminada = otra.nombre
      }

      setConfigPagos((c) => ({
        ...c,
        franquiciaPredeterminada: predeterminada,
        [clave]: c[clave].map((p) => (p.id === id ? { ...p, activo: Boolean(activo) } : p)),
      }))
    },
    [configPagos]
  )

  const establecerFranquiciaPredeterminada = useCallback(
    (nombre) => {
      const f = configPagos.franquiciasDatafono.find(
        (x) => x.activo && normalizarNombrePago(x.nombre) === normalizarNombrePago(nombre)
      )
      if (!f) throw new Error("Elige una franquicia activa")
      setConfigPagos((c) => ({ ...c, franquiciaPredeterminada: f.nombre }))
    },
    [configPagos]
  )

  // Crea un cliente de crédito con PIN numérico único de 6 dígitos (exclusivo del admin: usar con solicitarAutorizacion)
  // SUPABASE: insert en clientes_credito (pin_autorizacion con el patrón ^[0-9]{4,6}$)
  const crearClienteCredito = useCallback(
    ({ nombre, telefono, cupoMaximo }) => {
      const nombreLimpio = aTexto(nombre)
      if (nombreLimpio.length < 2) throw new Error("El nombre del cliente es obligatorio")
      const cupo = aNumero(cupoMaximo, 0)
      if (cupo < 0) throw new Error("El cupo máximo no puede ser negativo")

      const cliente = {
        id: `c-${generarUUID()}`,
        nombre: nombreLimpio,
        telefono: aTexto(telefono),
        pin: generarPinCliente(clientes.map((c) => c.pin)),
        cupoMaximo: redondear2(cupo),
      }
      setClientes((lista) => [...lista, cliente])
      return cliente
    },
    [clientes]
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
    modoAdminTemporal,
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
    setProductos: setProductosBase,
    guardarProducto,
    ingresarStockSucursal,
    ajustarStockSucursal,
    cambiarEstadoProducto,
    traslados,
    setTraslados,
    registrarTraslado,
    clientes: clientesConDeuda,
    setClientes,
    proveedores,
    setProveedores,
    ventas,
    setVentas,
    egresos,
    setEgresos,
    pagosVenta,
    setPagosVenta,
    abonosCredito,
    setAbonosCredito,
    configPagos,
    agregarProveedorPago,
    cambiarEstadoProveedorPago,
    establecerFranquiciaPredeterminada,
    crearClienteCredito,
  }

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS() {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error("usePOS debe usarse dentro de <POSProvider>")
  return ctx
}