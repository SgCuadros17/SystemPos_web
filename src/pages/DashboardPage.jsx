import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  HandCoins,
  MapPin,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS, formatCOP } from "@/context/POSContext"
import { obtenerIconoProducto } from "@/config/catalogs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// ---------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------
const CTA = "bg-accent-500 text-text-950 hover:bg-accent-500/90 font-bold dark:text-background-50"

const PERIODOS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "historico", label: "Histórico" },
]
// Rangos en "días atrás" (0 = hoy)
const RANGOS = { hoy: [0, 0], "7d": [0, 6], historico: [0, Infinity] }
const ANTERIOR = { hoy: [1, 1], "7d": [7, 13], historico: null }
const TEXTO_PERIODO = { hoy: "hoy", "7d": "últimos 7 días", historico: "histórico" }
const TEXTO_VS = { hoy: "vs. ayer", "7d": "vs. 7 días previos" }

const TIPOS_NEGOCIO = {
  tienda: "Tienda",
  minimercado: "Minimercado",
  ferreteria: "Ferretería",
  restaurante: "Restaurante",
}

// Nomenclatura oficial de pagos: Efectivo, Transferencias, Tarjeta y Crédito
const TIPOS_PAGO = ["efectivo", "transferencia", "tarjeta", "credito"]
const METODOS = {
  efectivo: {
    label: "Efectivo",
    corto: "Efectivo",
    punto: "bg-accent-500",
    badge: "bg-accent-500/15 text-accent-700 dark:text-accent-400",
  },
  transferencia: {
    label: "Transferencias",
    corto: "Transferencia",
    punto: "bg-primary-500",
    badge: "bg-primary-500/10 text-primary-600",
  },
  tarjeta: {
    label: "Tarjeta",
    corto: "Tarjeta",
    punto: "bg-secondary-500",
    badge: "bg-secondary-500/10 text-secondary-600",
  },
  credito: {
    label: "Crédito",
    corto: "Crédito",
    punto: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
}

// Color por sucursal (estable según su posición en la lista)
const COLORES_SUCURSAL = ["bg-primary-500", "bg-secondary-400", "bg-primary-300", "bg-secondary-700"]

// ---------------------------------------------------------------------
// Utilidades de fecha
// ---------------------------------------------------------------------
const inicioDia = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const diasAtras = (iso, hoy) => Math.round((hoy - inicioDia(iso)) / 86400000)
const enRango = (iso, rango, hoy) => {
  const d = diasAtras(iso, hoy)
  return d >= rango[0] && d <= rango[1]
}

const pct = (n) => `${n.toFixed(1).replace(".", ",")}%`
const fechaLarga = (d) =>
  d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" })

// Hora en formato 24 h construida a mano (evita mezclas como "18:24 a. m." según el navegador)
const horaVenta = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const variacion = (actual, anterior) =>
  anterior > 0 ? ((actual - anterior) / anterior) * 100 : null

// ---------------------------------------------------------------------
// Cálculos contables
// ---------------------------------------------------------------------
const vacioTipos = () => ({ efectivo: 0, transferencia: 0, tarjeta: 0, credito: 0 })

const agruparPagos = (pagosVenta) => {
  const mapa = new Map()
  for (const p of pagosVenta) {
    const lista = mapa.get(p.venta_id)
    if (lista) lista.push(p)
    else mapa.set(p.venta_id, [p])
  }
  return mapa
}

// Totales de una lista de ventas; los montos por tipo salen de pagos_venta
const resumirVentas = (lista, pagosPorVenta) => {
  const r = { total: 0, n: lista.length, tipos: vacioTipos(), ops: vacioTipos(), porSucursal: {} }
  for (const v of lista) {
    r.total += v.total
    r.porSucursal[v.sucursalId] = (r.porSucursal[v.sucursalId] || 0) + v.total
    for (const p of pagosPorVenta.get(v.id) ?? []) {
      if (p.payment_type in r.tipos) {
        r.tipos[p.payment_type] += p.monto
        r.ops[p.payment_type] += 1
      }
    }
  }
  return r
}

// Las 5 Ecuaciones Maestras
//  1. Caja Física (efectivo)       = pagos efectivo + abonos efectivo − egresos efectivo
//  2. Caja Digital (transferencias) = pagos transf. + abonos transf. − egresos transf.
//  3. Caja Datáfono (tarjeta)       = pagos tarjeta + abonos tarjeta
//  4. Liquidez Neta                 = física + digital + datáfono
//  5. Total Crédito (informativo)   = pagos con payment_type 'credito' (no infla la caja; va a cartera)
const calcularCaja = (tiposPagos, abonos, egresos) => {
  const ab = vacioTipos()
  for (const a of abonos) if (a.payment_type in ab) ab[a.payment_type] += a.monto
  const eg = vacioTipos()
  for (const e of egresos) if (e.payment_type in eg) eg[e.payment_type] += e.monto

  const efectivo = tiposPagos.efectivo + ab.efectivo - eg.efectivo
  const transferencias = tiposPagos.transferencia + ab.transferencia - eg.transferencia
  const tarjeta = tiposPagos.tarjeta + ab.tarjeta
  return {
    efectivo,
    transferencias,
    tarjeta,
    liquidez: efectivo + transferencias + tarjeta,
    credito: tiposPagos.credito,
    totalAbonos: ab.efectivo + ab.transferencia + ab.tarjeta,
    totalEgresos: eg.efectivo + eg.transferencia,
  }
}

// ---------------------------------------------------------------------
// Componentes de apoyo
// ---------------------------------------------------------------------
function Entrada({ i = 0, className, children }) {
  return (
    <div className={cn("dash-entrada", className)} style={{ animationDelay: `${i * 70}ms` }}>
      {children}
    </div>
  )
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
      {children}
    </span>
  )
}

function IconoKpi({ icon: Icono, className }) {
  return (
    <span className={cn("rounded-xl p-2.5", className)}>
      <Icono className="h-5 w-5" />
    </span>
  )
}

function Barra({ valor, montado, className, delay = 0 }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
          className
        )}
        style={{ width: `${montado ? Math.min(100, Math.max(0, valor)) : 0}%`, transitionDelay: `${delay}ms` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function DashboardPage() {
  const navigate = useNavigate()
  const {
    negocio, sucursales, sucursalActiva, setSucursalActiva, sucursalActual,
    rol, productos, clientes, ventas, pagosVenta, abonosCredito, egresos,
  } = usePOS()

  const [periodo, setPeriodo] = useState("hoy")
  const [sel, setSel] = useState(null) // índice de la barra seleccionada (0..6)
  const [montado, setMontado] = useState(false)

  // Dispara las transiciones de barras después del primer pintado
  useEffect(() => {
    const id = setTimeout(() => setMontado(true), 60)
    return () => clearTimeout(id)
  }, [])

  const hoy = useMemo(() => inicioDia(new Date()), [])

  const d = useMemo(() => {
    const rango = RANGOS[periodo]
    const enAlcance = (x) => sucursalActiva === "todas" || x.sucursalId === sucursalActiva

    const pagosPorVenta = agruparPagos(pagosVenta)
    const creditoDe = (ventaId) =>
      (pagosPorVenta.get(ventaId) ?? [])
        .filter((p) => p.payment_type === "credito")
        .reduce((s, p) => s + p.monto, 0)

    const ventasAlcance = ventas.filter(enAlcance)
    const ventasPeriodo = ventasAlcance.filter((v) => enRango(v.fecha, rango, hoy))
    const abonosPeriodo = abonosCredito.filter(enAlcance).filter((a) => enRango(a.fecha, rango, hoy))
    const egresosPeriodo = egresos.filter(enAlcance).filter((e) => enRango(e.fecha, rango, hoy))

    const actual = resumirVentas(ventasPeriodo, pagosPorVenta)
    const previo = ANTERIOR[periodo]
      ? resumirVentas(ventasAlcance.filter((v) => enRango(v.fecha, ANTERIOR[periodo], hoy)), pagosPorVenta)
      : null

    // Ecuaciones Maestras del periodo y alcance actuales
    const caja = calcularCaja(actual.tipos, abonosPeriodo, egresosPeriodo)
    const eg = { total: caja.totalEgresos, n: egresosPeriodo.length }

    // Créditos pendientes (cartera): solo la línea de crédito, sin importar el periodo
    const pendientes = ventasAlcance.filter((v) => v.estadoDeuda === "pendiente")
    const carteraTotal = pendientes.reduce((s, v) => s + creditoDe(v.id), 0)
    const clientesConSaldo = new Set(pendientes.map((v) => v.clienteId)).size

    // Últimos 7 días (siempre, para la gráfica)
    const dias = []
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy)
      fecha.setDate(fecha.getDate() - i)
      dias.push({
        ...resumirVentas(ventasAlcance.filter((v) => diasAtras(v.fecha, hoy) === i), pagosPorVenta),
        fecha,
      })
    }
    const semana = resumirVentas(ventasAlcance.filter((v) => enRango(v.fecha, RANGOS["7d"], hoy)), pagosPorVenta)
    const maxDia = Math.max(...dias.map((x) => x.total), 0)

    // Comparativa por sucursal (siempre sobre todas las sedes)
    const ventasPeriodoTodas = ventas.filter((v) => enRango(v.fecha, rango, hoy))
    const totalNegocio = ventasPeriodoTodas.reduce((s, v) => s + v.total, 0)
    const comparativa = sucursales.map((s) => {
      const r = resumirVentas(ventasPeriodoTodas.filter((v) => v.sucursalId === s.id), pagosPorVenta)
      const c = calcularCaja(
        r.tipos,
        abonosCredito.filter((a) => a.sucursalId === s.id && enRango(a.fecha, rango, hoy)),
        egresos.filter((e) => e.sucursalId === s.id && enRango(e.fecha, rango, hoy))
      )
      return {
        sucursal: s,
        total: r.total,
        n: r.n,
        neto: c.liquidez,
        creditos: ventas
          .filter((v) => v.sucursalId === s.id && v.estadoDeuda === "pendiente")
          .reduce((suma, v) => suma + creditoDe(v.id), 0),
        aporte: totalNegocio > 0 ? (r.total / totalNegocio) * 100 : 0,
      }
    })

    // Stock crítico: solo sedes activas que manejan el producto, según el stock mínimo de cada uno
    const sucursalesAlcance = sucursales.filter(
      (s) => s.activa !== false && (sucursalActiva === "todas" || s.id === sucursalActiva)
    )
    const criticos = []
    for (const p of productos) {
      if (p.activo === false) continue
      const minimo = p.stockMinimo ?? 5
      for (const s of sucursalesAlcance) {
        const u = p.stock?.[s.id]
        if (typeof u === "number" && u <= minimo) {
          criticos.push({ producto: p, sucursal: s, unidades: u })
        }
      }
    }
    criticos.sort((a, b) => a.unidades - b.unidades)

    const ultimas = [...ventasAlcance]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 6)

    return {
      actual, previo, caja, eg, pagosPorVenta,
      carteraTotal, clientesConSaldo,
      dias, semana, maxDia, comparativa, criticos, ultimas,
    }
  }, [ventas, pagosVenta, abonosCredito, egresos, productos, sucursales, sucursalActiva, periodo, hoy])

  const { actual, previo, caja, eg, dias, semana, maxDia, pagosPorVenta } = d
  const delta = previo ? variacion(actual.total, previo.total) : null
  const ticket = actual.n > 0 ? actual.total / actual.n : 0
  const negocioVacio = ventas.length === 0 && productos.length === 0
  const vistaTexto =
    sucursalActiva === "todas"
      ? "Vista Global · Todas las sucursales"
      : sucursalActual?.nombre ?? "Sucursal"

  // Detalle mostrado sobre la gráfica: día seleccionado o resumen semanal
  const mostrado = sel !== null ? dias[sel] : semana
  const tituloMostrado = sel !== null ? fechaLarga(dias[sel].fecha) : "Resumen de los 7 días"
  const sucursalesVisibles = sucursales.filter(
    (s) => sucursalActiva === "todas" || s.id === sucursalActiva
  )

  const clienteDe = (id) => clientes.find((c) => c.id === id)?.nombre ?? "Cliente"
  const sucursalDe = (id) => sucursales.find((s) => s.id === id)?.nombre ?? "—"

  const distribucion = TIPOS_PAGO.map((clave) => ({
    clave,
    ...METODOS[clave],
    monto: actual.tipos[clave],
    ops: actual.ops[clave],
    porcentaje: actual.total > 0 ? (actual.tipos[clave] / actual.total) * 100 : 0,
  }))

  return (
    <div className="min-w-0 space-y-6">
      <style>{`
        @keyframes dash-entrada { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .dash-entrada { animation: dash-entrada .5s ease-out both }
        @media (prefers-reduced-motion: reduce) { .dash-entrada { animation: none } }
      `}</style>

      {/* ---------- A) Encabezado + acciones ---------- */}
      <Entrada i={0}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Panel gerencial</p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{negocio?.nombre}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Store className="h-3.5 w-3.5" />
                {TIPOS_NEGOCIO[negocio?.tipo_negocio] ?? "Negocio"}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {vistaTexto}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Periodo" className="inline-flex rounded-lg border bg-card p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    periodo === p.id
                      ? "bg-accent-500 font-bold text-text-950 dark:text-background-50"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {sucursalActiva !== "todas" && rol === "admin" && (
              <Button variant="outline" onClick={() => setSucursalActiva("todas")}>
                Volver a todas las sucursales
              </Button>
            )}

            <Button className={CTA} onClick={() => navigate("/pos")}>
              <ShoppingCart className="h-4 w-4" />
              Ir al Punto de Venta
            </Button>
          </div>
        </div>
      </Entrada>

      {/* ---------- B) Estado vacío (negocio nuevo) ---------- */}
      {negocioVacio && (
        <Entrada i={1}>
          <Card className="gap-0 overflow-hidden border-primary-500/30 bg-primary-500/5 py-0">
            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <IconoKpi icon={Sparkles} className="bg-accent-500 text-text-950 dark:text-background-50" />
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
                    ¡Bienvenido a Abaco, {negocio?.nombre}!
                  </h2>
                  <p className="mt-1 text-muted-foreground">
                    Tu negocio está listo. Estos son los primeros pasos para ver tus métricas aquí.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { n: 1, icon: Package, titulo: "Agrega tus productos", texto: "Crea tu catálogo y carga el stock inicial de cada sucursal.", ruta: "/inventario", boton: "Ir a Inventario", accent: true },
                  { n: 2, icon: ShoppingCart, titulo: "Registra tu primera venta", texto: "Cobra en efectivo, transferencia, tarjeta o crédito desde el Punto de Venta.", ruta: "/pos", boton: "Ir al Punto de Venta" },
                  { n: 3, icon: Building2, titulo: "Gestiona tus sucursales", texto: "Agrega sedes y empleados con su PIN de seguridad.", ruta: "/equipo", boton: "Ver sucursales" },
                ].map(({ n, icon: Icono, titulo, texto, ruta, boton, accent }) => (
                  <div key={n} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <span className="cifra flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {n}
                      </span>
                      <Icono className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{titulo}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
                    </div>
                    <Button
                      variant={accent ? "default" : "outline"}
                      className={accent ? CTA : ""}
                      onClick={() => navigate(ruta)}
                    >
                      {accent && <Plus className="h-4 w-4" />}
                      {boton}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Entrada>
      )}

      {/* ---------- C) KPIs ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Ventas del periodo */}
        <Entrada i={2} className="h-full min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">
                  Ventas · {TEXTO_PERIODO[periodo]}
                </p>
                <IconoKpi icon={Receipt} className="bg-primary-500/10 text-primary-600" />
              </div>
              <p className="cifra text-3xl font-bold">{formatCOP(actual.total)}</p>
              <div className="flex flex-wrap gap-2">
                <Chip><span className="cifra">{actual.n}</span> transacciones</Chip>
                <Chip>Ticket prom. <span className="cifra">{formatCOP(ticket)}</span></Chip>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {delta !== null ? (
                  <>
                    {delta >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-accent-700 dark:text-accent-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={cn("cifra font-bold", delta >= 0 ? "text-accent-700 dark:text-accent-400" : "text-red-500")}>
                      {delta >= 0 ? "+" : ""}{pct(delta)}
                    </span>
                    {TEXTO_VS[periodo]}
                  </>
                ) : periodo === "historico" ? (
                  "Desde el primer registro"
                ) : (
                  "Sin datos del periodo anterior"
                )}
              </p>
            </CardContent>
          </Card>
        </Entrada>

        {/* 2. Liquidez real (Ecuaciones Maestras) */}
        <Entrada i={3} className="h-full min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Liquidez real en caja</p>
                <IconoKpi icon={Banknote} className="bg-accent-500/15 text-accent-700 dark:text-accent-400" />
              </div>
              <p className="cifra text-3xl font-bold">{formatCOP(caja.liquidez)}</p>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <span className="h-2 w-2 rounded-full bg-accent-500" />
                  Efectivo <span className="cifra">{formatCOP(caja.efectivo)}</span>
                </Chip>
                <Chip>
                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                  Transferencias <span className="cifra">{formatCOP(caja.transferencias)}</span>
                </Chip>
                <Chip>
                  <span className="h-2 w-2 rounded-full bg-secondary-500" />
                  Tarjeta <span className="cifra">{formatCOP(caja.tarjeta)}</span>
                </Chip>
              </div>
              <p className="text-xs text-muted-foreground">
                Pagos + abonos − egresos. Total crédito {TEXTO_PERIODO[periodo]}:{" "}
                <span className="cifra font-semibold text-foreground">{formatCOP(caja.credito)}</span>
                {" "}(informativo, va a cartera).
              </p>
            </CardContent>
          </Card>
        </Entrada>

        {/* 3. Créditos pendientes */}
        <Entrada i={4} className="h-full min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Créditos pendientes</p>
                <IconoKpi icon={HandCoins} className="bg-amber-500/15 text-amber-700 dark:text-amber-400" />
              </div>
              <p className="cifra text-3xl font-bold">{formatCOP(d.carteraTotal)}</p>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <Users className="h-3.5 w-3.5" />
                  <span className="cifra">{d.clientesConSaldo}</span>{" "}
                  {d.clientesConSaldo === 1 ? "cliente con saldo" : "clientes con saldo"}
                </Chip>
              </div>
              <Button variant="ghost" className="-ml-3 h-8 px-3 text-primary-600" onClick={() => navigate("/creditos")}>
                Ver cartera
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Entrada>

        {/* 4. Egresos y stock */}
        <Entrada i={5} className="h-full min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Pagos a proveedores</p>
                <IconoKpi icon={Truck} className="bg-red-500/10 text-red-600 dark:text-red-400" />
              </div>
              <p className="cifra text-3xl font-bold">{formatCOP(eg.total)}</p>
              <p className="text-xs text-muted-foreground">
                <span className="cifra font-semibold">{eg.n}</span> {eg.n === 1 ? "pago" : "pagos"} · {TEXTO_PERIODO[periodo]}
              </p>
              <button
                type="button"
                onClick={() => navigate("/inventario", { state: { soloBajo: true } })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                  d.criticos.length > 0
                    ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                <Bell className="h-4 w-4 shrink-0" />
                {d.criticos.length > 0 ? (
                  <span>
                    <span className="cifra">{d.criticos.length}</span>{" "}
                    {d.criticos.length === 1 ? "producto" : "productos"} en stock crítico
                  </span>
                ) : (
                  <span>Stock al día</span>
                )}
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
              </button>
            </CardContent>
          </Card>
        </Entrada>
      </div>

      {/* ---------- D) Gráficas ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Barras interactivas: 7 días */}
        <Entrada i={6} className="min-w-0 lg:col-span-2">
          <Card className="h-full gap-0 py-0">
            <CardHeader className="px-5 pb-0 pt-5">
              <CardTitle className="text-lg">Ventas de los últimos 7 días</CardTitle>
              <CardDescription>Pasa el mouse o toca una barra para ver el desglose del día.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {/* Detalle del día / semana */}
              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs font-semibold capitalize text-muted-foreground">{tituloMostrado}</p>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <p className="cifra text-2xl font-bold">{formatCOP(mostrado.total)}</p>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_PAGO.map((t) => (
                      <Chip key={t}>
                        <span className={cn("h-2 w-2 rounded-full", METODOS[t].punto)} />
                        {METODOS[t].label} <span className="cifra">{formatCOP(mostrado.tipos[t])}</span>
                      </Chip>
                    ))}
                    <Chip><span className="cifra">{mostrado.n}</span> ventas</Chip>
                  </div>
                </div>
              </div>

              {/* Barras */}
              <div>
                <div className="flex h-44 items-end gap-2 sm:gap-3" onMouseLeave={() => setSel(null)}>
                  {dias.map((dia, i) => {
                    const alto = maxDia > 0 ? (dia.total / maxDia) * 100 : 0
                    const visible = dia.total > 0 ? Math.max(alto, 4) : 1
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${fechaLarga(dia.fecha)}: ${formatCOP(dia.total)}`}
                        onMouseEnter={() => setSel(i)}
                        onFocus={() => setSel(i)}
                        onBlur={() => setSel(null)}
                        onClick={() => setSel(i)}
                        className="flex h-full min-w-0 flex-1 items-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={cn(
                            "w-full rounded-t-md transition-[height,background-color] duration-700 ease-out motion-reduce:transition-none",
                            sel === i ? "bg-accent-500" : "bg-primary-500",
                            dia.total === 0 && "opacity-30"
                          )}
                          style={{ height: `${montado ? visible : 0}%`, transitionDelay: `${i * 60}ms` }}
                        />
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2 sm:gap-3">
                  {dias.map((dia, i) => (
                    <div key={i} className="min-w-0 flex-1 text-center">
                      <p className={cn("text-[11px] font-semibold capitalize", sel === i ? "text-foreground" : "text-muted-foreground")}>
                        {dia.fecha.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "")}
                      </p>
                      <p className="cifra text-[11px] text-muted-foreground">{dia.fecha.getDate()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proporción por sucursal */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Aporte por sucursal · {sel !== null ? "día seleccionado" : "7 días"}
                </p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {sucursalesVisibles.map((s) => {
                    const valor = mostrado.porSucursal[s.id] || 0
                    const ancho = mostrado.total > 0 ? (valor / mostrado.total) * 100 : 0
                    const idx = sucursales.findIndex((x) => x.id === s.id)
                    return (
                      <div
                        key={s.id}
                        className={cn("h-full transition-[width] duration-500 motion-reduce:transition-none", COLORES_SUCURSAL[idx % COLORES_SUCURSAL.length])}
                        style={{ width: `${ancho}%` }}
                      />
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {sucursalesVisibles.map((s) => {
                    const idx = sucursales.findIndex((x) => x.id === s.id)
                    return (
                      <span key={s.id} className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", COLORES_SUCURSAL[idx % COLORES_SUCURSAL.length])} />
                        {s.nombre}
                        <span className="cifra font-semibold">{formatCOP(mostrado.porSucursal[s.id] || 0)}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </Entrada>

        {/* Distribución por método de pago */}
        <Entrada i={7} className="min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardHeader className="px-5 pb-0 pt-5">
              <CardTitle className="text-lg">Método de pago</CardTitle>
              <CardDescription>Participación · {TEXTO_PERIODO[periodo]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                {distribucion.map((m, i) => (
                  <div
                    key={m.clave}
                    className={cn("h-full transition-[width] duration-700 ease-out motion-reduce:transition-none", m.punto)}
                    style={{ width: `${montado ? m.porcentaje : 0}%`, transitionDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>

              <div className="space-y-3">
                {distribucion.map((m, i) => (
                  <div key={m.clave} className="space-y-2 rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span className={cn("h-2.5 w-2.5 rounded-full", m.punto)} />
                        {m.label}
                      </p>
                      <p className="cifra text-sm font-bold">{pct(m.porcentaje)}</p>
                    </div>
                    <p className="cifra text-lg font-bold">{formatCOP(m.monto)}</p>
                    <Barra valor={m.porcentaje} montado={montado} className={m.punto} delay={i * 100} />
                    <p className="text-xs text-muted-foreground">
                      <span className="cifra font-semibold">{m.ops}</span> {m.ops === 1 ? "operación" : "operaciones"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Entrada>
      </div>

      {/* ---------- E) Comparativa por sucursal ---------- */}
      {sucursalActiva === "todas" ? (
        <Entrada i={8}>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold">Comparativa por sucursal</h2>
              <p className="text-sm text-muted-foreground">
                Toca una sede para filtrar todo el panel · {TEXTO_PERIODO[periodo]}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.comparativa.map(({ sucursal, total, neto, creditos, aporte, n }) => (
                <button
                  key={sucursal.id}
                  type="button"
                  onClick={() => setSucursalActiva(sucursal.id)}
                  className="group min-w-0 space-y-4 rounded-xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded-xl bg-primary-500/10 p-2.5 text-primary-600">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{sucursal.nombre}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{sucursal.direccion || "Sin dirección"}</span>
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-600" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Total vendido</p>
                    <p className="cifra text-2xl font-bold">{formatCOP(total)}</p>
                    <p className="text-xs text-muted-foreground"><span className="cifra">{n}</span> ventas</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Neto en caja</p>
                      <p className="cifra font-bold text-accent-700 dark:text-accent-400">{formatCOP(neto)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Créditos pendientes</p>
                      <p className="cifra font-bold text-amber-700 dark:text-amber-400">{formatCOP(creditos)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Aporte al negocio</span>
                      <span className="cifra font-bold">{pct(aporte)}</span>
                    </div>
                    <Barra valor={aporte} montado={montado} className="bg-primary-500 group-hover:bg-accent-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Entrada>
      ) : (
        <Entrada i={8}>
          <Card className="gap-0 border-accent-500/40 bg-accent-500/5 py-0">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm">
                Estás viendo solo <strong>{sucursalActual?.nombre}</strong>. Todas las métricas están filtradas para esta sede.
              </p>
              {rol === "admin" && (
                <Button variant="outline" onClick={() => setSucursalActiva("todas")}>
                  Volver a todas las sucursales
                </Button>
              )}
            </CardContent>
          </Card>
        </Entrada>
      )}

      {/* ---------- F) Últimas ventas + stock crítico ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Entrada i={9} className="min-w-0 lg:col-span-2">
          <Card className="h-full gap-0 overflow-hidden py-0">
            <CardHeader className="px-5 pb-2 pt-5">
              <CardTitle className="text-lg">Últimas ventas</CardTitle>
              <CardDescription>Las 6 transacciones más recientes de la vista actual.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto pb-2">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Venta</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.ultimas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        Aún no hay ventas registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    d.ultimas.map((v) => {
                      const lineas = pagosPorVenta.get(v.id) ?? []
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            <p className="cifra font-semibold uppercase">{v.id}</p>
                            <p className="cifra text-xs text-muted-foreground">
                              {fechaCorta(v.fecha)} · {horaVenta(v.fecha)}
                            </p>
                          </TableCell>
                          <TableCell>{sucursalDe(v.sucursalId)}</TableCell>
                          <TableCell>{v.clienteId ? clienteDe(v.clienteId) : "Mostrador"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              {lineas.map((p) => (
                                <span
                                  key={p.id}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                                    METODOS[p.payment_type]?.badge
                                  )}
                                >
                                  {METODOS[p.payment_type]?.corto ?? p.payment_type}
                                  {p.payment_provider && ` · ${p.payment_provider}`}
                                  {lineas.length > 1 && (
                                    <span className="cifra font-semibold">{formatCOP(p.monto)}</span>
                                  )}
                                </span>
                              ))}
                              {v.estadoDeuda && (
                                <span className="text-[11px] text-muted-foreground">
                                  {v.estadoDeuda === "pendiente" ? "Crédito pendiente" : "Crédito pagado"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="cifra text-right font-bold">{formatCOP(v.total)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </Entrada>

        <Entrada i={10} className="min-w-0">
          <Card className="h-full gap-0 py-0">
            <CardHeader className="px-5 pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-amber-600" />
                Alertas de stock bajo
              </CardTitle>
              <CardDescription>Productos en o por debajo de su stock mínimo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-2">
              {d.criticos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8" />
                  <p className="text-sm font-semibold">Todo el stock está al día</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {d.criticos.slice(0, 6).map(({ producto, sucursal, unidades }) => {
                    const Icono = obtenerIconoProducto(producto.icono)
                    return (
                      <li
                        key={`${producto.id}-${sucursal.id}`}
                        className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-500/10 text-primary-600">
                          {producto.imagenUrl ? (
                            <img src={producto.imagenUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Icono className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {producto.nombreUnificado ?? producto.nombre}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{sucursal.nombre}</p>
                        </div>
                        <span
                          className={cn(
                            "cifra shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                            unidades <= 2
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {unidades} {unidades === 1 ? "unidad" : "unidades"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {d.criticos.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  y <span className="cifra font-semibold">{d.criticos.length - 6}</span> más…
                </p>
              )}

              <Button variant="outline" className="w-full" onClick={() => navigate("/inventario")}>
                Ir a Inventario
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Entrada>
      </div>
    </div>
  )
}