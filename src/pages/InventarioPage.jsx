import { useMemo, useState } from "react"
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Boxes,
  Building2,
  Lightbulb,
  Package,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Store,
  Tag,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS, formatCOP, sugerirCalculoReceta, costoUnitarioStock } from "@/context/POSContext"
import ProductFormModal, { MiniaturaProducto } from "@/components/inventory/ProductFormModal"
import StockEntryModal from "@/components/inventory/StockEntryModal"
import TransferModal from "@/components/inventory/TransferModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ---------------------------------------------------------------------
// Constantes y utilidades
// ---------------------------------------------------------------------
const CTA = "bg-accent-500 text-text-950 font-bold hover:bg-accent-600 dark:text-[#02180d]"
const UMBRAL_CRITICO = 2
const FILTROS_TIPO = [
  { id: "todos", label: "Todos" },
  { id: "menu", label: "Menú en venta (POS)" },
  { id: "insumo", label: "Insumos internos" },
  { id: "preparado", label: "Platos / Cócteles preparados" },
]

const coincideTipo = (p, filtro) => {
  const t = p.tipoItem ?? "venta_directa"
  if (filtro === "menu") return t === "venta_directa" || t === "preparado"
  if (filtro === "insumo") return t === "insumo"
  if (filtro === "preparado") return t === "preparado"
  return true
}

const GREMIOS = {
  tienda: "Tienda de barrio",
  minimercado: "Minimercado",
  ferreteria: "Ferretería",
  restaurante: "Restaurante / Bar",
  bar: "Restaurante / Bar",
}

const ESTADOS = {
  ok: { label: "Disponible", clase: "bg-accent-500/15 text-accent-700 dark:text-accent-400" },
  bajo: { label: "Stock bajo", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  critico: { label: "Crítico", clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  agotado: { label: "Agotado", clase: "bg-red-500/15 text-red-600 dark:text-red-400" },
  nomanejado: { label: "No manejado en esta sede", clase: "bg-muted text-muted-foreground" },
}

// agotado: 0 · crítico: <= 2 y en alerta · bajo: <= mínimo · ok: por encima del mínimo
const estadoStock = (u, minimo) => {
  if (typeof u !== "number") return "nomanejado"
  if (u <= 0) return "agotado"
  if (u <= minimo) return u <= UMBRAL_CRITICO ? "critico" : "bajo"
  return "ok"
}

const normalizar = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const pct = (n) => `${n.toFixed(1).replace(".", ",")}%`
const margenDe = (p) => (p.precio > 0 ? ((p.precio - p.costoCompra) / p.precio) * 100 : null)

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
const horaCorta = (iso) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })

// ---------------------------------------------------------------------
// Componentes de apoyo
// ---------------------------------------------------------------------
function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
      {children}
    </span>
  )
}

function MargenBadge({ p }) {
  const m = margenDe(p)
  if (!(p.costoCompra > 0) || m === null) {
    return (
      <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Sin costo
      </span>
    )
  }
  const clase =
    m < 0
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : m < 15
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-accent-500/15 text-accent-700 dark:text-accent-400"
  return (
    <span className={cn("cifra mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold", clase)}>
      Margen {pct(m)}
    </span>
  )
}

function FilaProducto({ p, global, esAdmin, sucursalesAlcance, sucursalActiva, onEditar, onAlternar, productosMap, onIngreso }) {
  const minimo = p.stockMinimo ?? 5
  const tipo = p.tipoItem ?? "venta_directa"
  const esInsumo = tipo === "insumo"
  const esPreparado = tipo === "preparado"
  const sugerencia =
    esPreparado && p.receta?.length > 0
      ? sugerirCalculoReceta(p, productosMap, global ? "todas" : sucursalActiva)
      : null
  const inactivo = p.activo === false
  const total = sucursalesAlcance.reduce((suma, s) => suma + (p.stock?.[s.id] ?? 0), 0)
  const unidadesSede = global ? null : p.stock?.[sucursalActiva]
  const claveSede = global ? null : estadoStock(unidadesSede, minimo)
  const estadoSede = global
    ? null
    : esPreparado && claveSede === "nomanejado"
      ? { label: "Sin conteo manual", clase: ESTADOS.nomanejado.clase }
      : ESTADOS[claveSede]
  const detalle = [p.marca, p.presentacion].filter(Boolean).join(" · ")

  return (
    <TableRow className={cn(inactivo && "opacity-60")}>
      {/* Producto */}
      <TableCell className="min-w-[230px]">
        <div className="flex min-w-0 items-center gap-3">
          <MiniaturaProducto imagenUrl={p.imagenUrl} icono={p.icono} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-bold">
              <span>{p.nombre}</span>
              {inactivo && (
                <Badge variant="outline" className="text-[10px]">
                  Inactivo
                </Badge>
              )}
              {esInsumo && (
              <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-bold text-primary-600">
                Insumo interno
              </span>
            )}
            {esInsumo && p.rendimiento > 1 && (
              <span className="cifra rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                Rinde x{p.rendimiento}
              </span>
            )}
            {esPreparado && (
              <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-700 dark:text-accent-400">
                Preparado
              </span>
            )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {detalle || "Sin marca ni presentación"}
            </p>
            {p.codigoBarras && (
              <p className="cifra text-[11px] text-muted-foreground">{p.codigoBarras}</p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Categoría */}
      <TableCell>
        <Badge variant="secondary">{p.categoria}</Badge>
      </TableCell>

      {/* Precio y costo */}
      <TableCell>
        {esInsumo ? (
          <>
            <p className="text-sm font-bold">Uso interno (Cocina/Barra)</p>
            {esAdmin && (
              <p className="cifra text-xs text-muted-foreground">
                Costo: {formatCOP(p.costoCompra)}
                {p.rendimiento > 1 && ` · ${formatCOP(p.costoCompra / p.rendimiento)} por porción`}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="cifra text-base font-bold">{formatCOP(p.precio)}</p>
            {esAdmin && (
              <>
                <p className="cifra text-xs text-muted-foreground">Costo: {formatCOP(p.costoCompra)}</p>
                <MargenBadge p={p} />
              </>
            )}
          </>
        )}
      </TableCell>

      {/* Stock */}
      <TableCell className="min-w-[200px]">
        {global ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {sucursalesAlcance.map((s) => {
              const u = p.stock?.[s.id]
              const clave = estadoStock(u, minimo)
              const clase =
                clave === "nomanejado" ? "bg-muted/60 text-muted-foreground opacity-60" : ESTADOS[clave].clase
              return (
                <span
                  key={s.id}
                  title={typeof u === "number" ? `${s.nombre}: ${u} unidades` : `${s.nombre}: no lo maneja`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    clase
                  )}
                >
                  <span className="max-w-24 truncate">{s.nombre}</span>
                  <span className="cifra font-bold">{typeof u === "number" ? u : "—"}</span>
                </span>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="cifra text-2xl font-bold">
              {typeof unidadesSede === "number" ? unidadesSede : "—"}
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", estadoSede.clase)}>
              {estadoSede.label}
            </span>
          </div>
        )}
      </TableCell>

      {/* Total global */}
      {global && (
        <TableCell className="text-right">
          <span className="cifra text-lg font-bold">{total}</span>
        </TableCell>
      )}

      {/* Acciones (Exclusivo para el administrador) */}
      {esAdmin && (
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={inactivo} onClick={() => onIngreso(p)}>
              <Plus className="h-4 w-4" />
              Stock
            </Button>
          <Button size="sm" variant="outline" onClick={() => onEditar(p)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAlternar(p)}>
            {inactivo ? <RotateCcw className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            {inactivo ? "Reactivar" : "Desactivar"}
          </Button>
        </div>
      </TableCell>
      )}
    </TableRow>
  )
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function InventarioPage() {
  const {
    negocio,
    sucursales,
    sucursalActiva,
    setSucursalActiva,
    sucursalActual,
    rol,
    modoAdminTemporal,
    solicitarAutorizacion,
    productos,
    cambiarEstadoProducto,
    traslados,
  } = usePOS()

  const [tab, setTab] = useState("catalogo")
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas")
  const [marcaFiltro, setMarcaFiltro] = useState("todas") // "todas" | "__sin__" | marca
  const [soloBajo, setSoloBajo] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)
  const [modal, setModal] = useState({ abierto: false, producto: null })
  const [tipoFiltro, setTipoFiltro] = useState("todos")

  const [modalIngreso, setModalIngreso] = useState({ abierto: false, producto: null })
  const [modalTraslado, setModalTraslado] = useState({ abierto: false, producto: null })

  const global = sucursalActiva === "todas"
  const esAdmin = rol === "admin"
  const mostrarInactivos = esAdmin && verInactivos
  // El cajero solo ve productos que existen en su sede (nunca ve ítems exclusivos del restaurante u otra sede)
  const productosAlcance = useMemo(
    () =>
      esAdmin
        ? productos
        : productos.filter((p) => typeof p.stock?.[sucursalActiva] === "number"),
    [productos, esAdmin, sucursalActiva]
  )

  // Solo muestra los filtros de Insumos / Platos preparados si en el alcance actual existen esos ítems
  const mostrarFiltroTipo = useMemo(
    () =>
      productosAlcance.some((p) => {
        if (p.activo === false) return false
        if (!global && typeof p.stock?.[sucursalActiva] !== "number") return false
        return p.tipoItem === "insumo" || p.tipoItem === "preparado"
      }),
    [productosAlcance, global, sucursalActiva]
  )
  const tipoFiltroEfectivo = mostrarFiltroTipo ? tipoFiltro : "todos"

  // Sedes visibles según el alcance actual
  const sucursalesAlcance = useMemo(
    () =>
      sucursales.filter((s) => s.activa !== false && (global || s.id === sucursalActiva)),
    [sucursales, sucursalActiva, global]
  )

  const tieneAlerta = (p) =>
    sucursalesAlcance.some((s) => {
      const u = p.stock?.[s.id]
      return typeof u === "number" && u <= (p.stockMinimo ?? 5)
    })

  // ---------- KPIs (solo productos activos, en el alcance actual) ----------
 const kpi = useMemo(() => {
    const categorias = new Set()
    let activos = 0
    let unidades = 0
    let venta = 0
    let costoVendibles = 0
    let costoInsumos = 0
    let alertas = 0
    let agotados = 0
    let criticos = 0

    const mapaSedes = new Map(
      sucursalesAlcance.map((s) => [s.id, { id: s.id, nombre: s.nombre, unidades: 0, venta: 0, costo: 0 }])
    )

    for (const p of productos) {
      if (p.activo === false) continue
      const maneja = global || typeof p.stock?.[sucursalActiva] === "number"
      if (maneja) {
        activos += 1
        categorias.add(p.categoria)
      }
      const minimo = p.stockMinimo ?? 5
      const costoUnit = costoUnitarioStock(p)
      const esInsumo = (p.tipoItem ?? "venta_directa") === "insumo"

      for (const s of sucursalesAlcance) {
        const u = p.stock?.[s.id]
        if (typeof u !== "number") continue
        unidades += u
        const infoSede = mapaSedes.get(s.id)
        if (infoSede) infoSede.unidades += u

        if (esInsumo) {
          costoInsumos += costoUnit * u
          if (infoSede) infoSede.costo += costoUnit * u
        } else {
          venta += p.precio * u
          costoVendibles += costoUnit * u
          if (infoSede) {
            infoSede.venta += p.precio * u
            infoSede.costo += costoUnit * u
          }
        }
        const e = estadoStock(u, minimo)
        if (e === "agotado" || e === "critico" || e === "bajo") {
          alertas += 1
          if (e === "agotado") agotados += 1
          else if (e === "critico") criticos += 1
        }
      }
    }
    return {
      activos,
      categorias: categorias.size,
      inactivos: productos.filter((p) => p.activo === false).length,
      unidades,
      venta,
      costoVendibles,
      costoInsumos,
      costoTotal: costoVendibles + costoInsumos,
      ganancia: venta - costoVendibles,
      porSede: [...mapaSedes.values()],
      alertas,
      agotados,
      criticos,
    }
  }, [productos, sucursalesAlcance, sucursalActiva, global])

  // ---------- Opciones de filtros ----------
  const categoriasOpciones = useMemo(
    () =>
      [...new Set(productosAlcance.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [productosAlcance]
  )
  const marcasOpciones = useMemo(
    () =>
      [...new Set(productosAlcance.map((p) => p.marca).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [productosAlcance]
  )

  // ---------- Lista filtrada ----------
  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    const filtrada = productosAlcance.filter((p) => {
      const inactivo = p.activo === false
      if (mostrarInactivos ? !inactivo : inactivo) return false
      if (!coincideTipo(p, tipoFiltroEfectivo)) return false
      if (categoriaFiltro !== "todas" && p.categoria !== categoriaFiltro) return false
      if (marcaFiltro === "__sin__" && p.marca) return false
      if (marcaFiltro !== "todas" && marcaFiltro !== "__sin__" && p.marca !== marcaFiltro) return false
      if (soloBajo && !tieneAlerta(p)) return false
      if (q) {
        const texto = normalizar(
          [p.nombreUnificado, p.nombre, p.marca, p.presentacion, p.categoria, p.codigoBarras].join(" ")
        )
        if (!texto.includes(q)) return false
      }
      return true
    })
    // En una sede, primero lo que maneja; luego orden alfabético
    return filtrada.sort((a, b) => {
      if (!global) {
        const ma = typeof a.stock?.[sucursalActiva] === "number" ? 0 : 1
        const mb = typeof b.stock?.[sucursalActiva] === "number" ? 0 : 1
        if (ma !== mb) return ma - mb
      }
      return a.nombre.localeCompare(b.nombre, "es")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosAlcance, busqueda, categoriaFiltro, marcaFiltro, soloBajo, mostrarInactivos, tipoFiltroEfectivo, sucursalesAlcance, global, sucursalActiva])

  const hayFiltros =
    busqueda !== "" || categoriaFiltro !== "todas" || marcaFiltro !== "todas" || soloBajo || mostrarInactivos || tipoFiltro !== "todos"

  const limpiarFiltros = () => {
    setBusqueda("")
    setCategoriaFiltro("todas")
    setMarcaFiltro("todas")
    setSoloBajo(false)
    setVerInactivos(false)
    setTipoFiltro("todos")
  }

  // ---------- Traslados ----------
  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const nombreSede = (id) => sucursales.find((s) => s.id === id)?.nombre ?? "—"
  const trasladosVista = useMemo(
    () =>
      traslados
        .filter((t) => global || t.origenId === sucursalActiva || t.destinoId === sucursalActiva)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [traslados, global, sucursalActiva]
  )

  // ---------- Acciones (todas las escrituras pasan por solicitarAutorizacion) ----------
  const abrirNuevo = () => solicitarAutorizacion(() => setModal({ abierto: true, producto: null }))
  const abrirEditar = (p) => solicitarAutorizacion(() => setModal({ abierto: true, producto: p }))
  const cerrarModal = () => setModal((m) => ({ ...m, abierto: false }))

  const alternarActivo = (p) =>
    solicitarAutorizacion(() => {
      const activar = p.activo === false
      cambiarEstadoProducto(p.id, activar)
      toast.success(`${p.nombreUnificado ?? p.nombre} ${activar ? "reactivado" : "desactivado"}`, {
        action: { label: "Deshacer", onClick: () => cambiarEstadoProducto(p.id, !activar) },
      })
    })

    // Ingreso de compras / ajuste: solo admin (RLS inventario_insert_admin)
  const abrirIngreso = (producto = null) =>
    solicitarAutorizacion(() =>
      setModalIngreso({ abierto: true, producto: producto?.id ? producto : null })
    )
  const cerrarIngreso = () => setModalIngreso((m) => ({ ...m, abierto: false }))

  // Traslado: lo valida la sede de origen (el cajero puede despachar desde su sede)
  const abrirTraslado = (producto = null) =>
    setModalTraslado({ abierto: true, producto: producto?.id ? producto : null })
  const cerrarTraslado = () => setModalTraslado((m) => ({ ...m, abierto: false }))

  const alternarSoloBajo = () => {
    setTab("catalogo")
    setSoloBajo((v) => !v)
  }

  const vistaTexto = global
    ? "Vista Global · Todas las sucursales"
    : sucursalActual?.nombre ?? "Sucursal"

  return (
    <div className="min-w-0 space-y-6">
      {/* ---------- Cabecera ---------- */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Módulo de inventario</p>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Inventario y Catálogo</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Store className="h-3.5 w-3.5" />
              {GREMIOS[negocio?.tipo_negocio] ?? "Negocio"}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {vistaTexto}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {esAdmin && modoAdminTemporal !== "accion" && (
            <Select value={sucursalActiva} onValueChange={setSucursalActiva}>
              <SelectTrigger className="w-[200px]" aria-label="Alcance del inventario">
                <Building2 className="mr-1 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Vista Global (Todas)</SelectItem>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => abrirTraslado()}>
            <ArrowLeftRight className="h-4 w-4" />
            Trasladar mercancía
          </Button>
          {esAdmin && (
            <>
          <Button variant="outline" onClick={() => abrirIngreso()}>
            <Plus className="h-4 w-4" />
            Ingresar compra
          </Button>
          <Button className={CTA} onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
          </>
          )}
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full min-w-0 gap-0 py-0">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">Catálogo activo</p>
              <span className="rounded-xl bg-primary-500/10 p-2.5 text-primary-600">
                <Tag className="h-5 w-5" />
              </span>
            </div>
            <p className="cifra text-3xl font-bold">{kpi.activos}</p>
            <div className="flex flex-wrap gap-2">
              <Chip>
                <span className="cifra">{kpi.categorias}</span>{" "}
                {kpi.categorias === 1 ? "categoría" : "categorías"}
              </Chip>
              {kpi.inactivos > 0 && (
                <Chip>
                  <span className="cifra">{kpi.inactivos}</span>{" "}
                  {kpi.inactivos === 1 ? "desactivado" : "desactivados"}
                </Chip>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full min-w-0 gap-0 py-0">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">Existencias totales</p>
              <span className="rounded-xl bg-primary-500/10 p-2.5 text-primary-600">
                <Boxes className="h-5 w-5" />
              </span>
            </div>
            <p className="cifra text-3xl font-bold">{kpi.unidades.toLocaleString("es-CO")}</p>
            <div className="flex flex-wrap gap-2">
              <Chip>
                unidades en <span className="cifra">{sucursalesAlcance.length}</span>{" "}
                {sucursalesAlcance.length === 1 ? "sucursal" : "sucursales"}
              </Chip>
            </div>
            {global && kpi.porSede.length > 1 && (
              <div className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                {kpi.porSede.map((s) => (
                  <p key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">{s.nombre}</span>
                    <span className="cifra font-semibold text-foreground">
                      {s.unidades.toLocaleString("es-CO")} uds
                    </span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {esAdmin && (
        <Card className="h-full min-w-0 gap-0 py-0">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">Valorización de inventario</p>
              <span className="rounded-xl bg-accent-500/15 p-2.5 text-accent-700 dark:text-accent-400">
                <Wallet className="h-5 w-5" />
              </span>
            </div>
            <p className="cifra text-3xl font-bold">{formatCOP(kpi.venta)}</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex justify-between gap-2">
                <span>Costo en vendibles</span>
                <span className="cifra font-semibold text-foreground">{formatCOP(kpi.costoVendibles)}</span>
              </p>
              {kpi.costoInsumos > 0 && (
                <>
                  <p className="flex justify-between gap-2">
                    <span>Capital en insumos</span>
                    <span className="cifra font-semibold text-foreground">{formatCOP(kpi.costoInsumos)}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span>Capital total invertido</span>
                    <span className="cifra font-semibold text-foreground">{formatCOP(kpi.costoTotal)}</span>
                  </p>
                </>
              )}
              <p className="flex justify-between gap-2">
                <span>Ganancia potencial</span>
                <span className="cifra font-semibold text-accent-700 dark:text-accent-400">
                  {formatCOP(kpi.ganancia)}
                </span>
              </p>
            </div>
            {global && kpi.porSede.length > 1 && (
              <div className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">Costo invertido por sede:</p>
                {kpi.porSede.map((s) => (
                  <p key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">{s.nombre}</span>
                    <span className="cifra font-semibold text-foreground">{formatCOP(s.costo)}</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        <button
          type="button"
          onClick={alternarSoloBajo}
          aria-pressed={soloBajo}
          className="flex min-w-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card
            className={cn(
              "h-full w-full gap-0 py-0 transition-shadow hover:shadow-lg",
              soloBajo && "ring-2 ring-accent-500"
            )}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-muted-foreground">Alertas de stock bajo</p>
                <span
                  className={cn(
                    "rounded-xl p-2.5",
                    kpi.alertas > 0
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Bell className="h-5 w-5" />
                </span>
              </div>
              <p className="cifra text-3xl font-bold">{kpi.alertas}</p>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <span className="cifra">{kpi.agotados}</span> {kpi.agotados === 1 ? "agotado" : "agotados"}
                </Chip>
                <Chip>
                  <span className="cifra">{kpi.criticos}</span> {kpi.criticos === 1 ? "crítico" : "críticos"}
                </Chip>
              </div>
              <p className="text-xs text-muted-foreground">
                {soloBajo ? "Filtro activo · toca para quitarlo" : "Toca para ver solo stock bajo"}
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* ---------- Pestañas ---------- */}
      <Tabs value={tab} onValueChange={setTab} className="flex min-w-0 flex-col">
        <TabsList className="h-auto w-fit max-w-full flex-wrap justify-start self-start">
          <TabsTrigger value="catalogo">Catálogo y Stock</TabsTrigger>
          <TabsTrigger value="traslados">
            Traslados entre Sucursales
            <span className="cifra ml-1.5 rounded-full bg-background px-1.5 text-xs">
              {trasladosVista.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ===== Catálogo y stock ===== */}
        <TabsContent value="catalogo" className="mt-4 min-w-0 space-y-4">
          {productos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="rounded-2xl bg-primary-500/10 p-4 text-primary-600">
                  <Package className="h-10 w-10" />
                </div>
                <div className="max-w-md">
                  <p className="text-lg font-bold">Tu catálogo está vacío</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crea tu primer producto con su precio, su icono y las sedes donde se vende. Después
                    podrás registrar ventas y ver tus métricas en el Dashboard.
                  </p>
                </div>
                <Button className={CTA} onClick={abrirNuevo}>
                  <Plus className="h-4 w-4" />
                  Crear primer producto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filtros */}
              <Card className="gap-0 py-0">
                <CardContent className="space-y-3 p-4">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, marca, presentación, categoría o código…"
                      aria-label="Buscar productos"
                      className="pl-9"
                    />
                  </div>

                  {mostrarFiltroTipo && (
                  <div role="group" aria-label="Tipo de ítem" className="flex flex-wrap gap-2">
                    {FILTROS_TIPO.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={tipoFiltro === t.id}
                        className={cn(tipoFiltro === t.id && CTA)}
                        onClick={() => setTipoFiltro(t.id)}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                      <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por categoría">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las categorías</SelectItem>
                        {categoriasOpciones.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={marcaFiltro} onValueChange={setMarcaFiltro}>
                      <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por marca">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las marcas</SelectItem>
                        {marcasOpciones.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                        <SelectItem value="__sin__">Sin marca</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={soloBajo}
                      className={cn(soloBajo && CTA)}
                      onClick={() => setSoloBajo((v) => !v)}
                    >
                      <Bell className="h-4 w-4" />
                      Solo stock bajo
                    </Button>

                    {esAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={verInactivos}
                      className={cn(verInactivos && CTA)}
                      onClick={() => setVerInactivos((v) => !v)}
                    >
                      <Power className="h-4 w-4" />
                      Ver desactivados
                      {kpi.inactivos > 0 && <span className="cifra">({kpi.inactivos})</span>}
                    </Button>
                    )}

                    {hayFiltros && (
                      <Button type="button" variant="ghost" onClick={limpiarFiltros}>
                        <X className="h-4 w-4" />
                        Limpiar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                Mostrando <span className="cifra font-semibold text-foreground">{lista.length}</span> de{" "}
                <span className="cifra font-semibold text-foreground">{productosAlcance.length}</span> productos
              </p>

              {/* Tabla multisucursal */}
              <Card className="gap-0 overflow-hidden py-0">
                <div className="overflow-x-auto pb-2">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>{esAdmin ? "Precio y costo" : "Precio de venta"}</TableHead>
                        <TableHead>{global ? "Stock por sucursal" : "Stock en la sede"}</TableHead>
                        {global && <TableHead className="text-right">Total</TableHead>}
                        {esAdmin &&<TableHead className="text-right">Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lista.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={global ? 6 : 5} className="py-12 text-center">
                            <p className="font-semibold">
                              {verInactivos && !busqueda && !soloBajo
                                ? "No hay productos desactivados"
                                : "No hay productos que coincidan con los filtros"}
                            </p>
                            {hayFiltros && (
                              <Button variant="outline" className="mt-3" onClick={limpiarFiltros}>
                                <X className="h-4 w-4" />
                                Limpiar filtros
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        lista.map((p) => (
                          <FilaProducto
                            key={p.id}
                            p={p}
                            global={global}
                            esAdmin={esAdmin}
                            sucursalesAlcance={sucursalesAlcance}
                            sucursalActiva={sucursalActiva}
                            onEditar={abrirEditar}
                            onAlternar={alternarActivo}
                            productosMap={productoPorId}
                            onIngreso={abrirIngreso}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== Traslados ===== */}
        <TabsContent value="traslados" className="mt-4 min-w-0">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-col gap-3 px-5 pb-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Historial de traslados</CardTitle>
                <CardDescription>
                  Mueven mercancía entre sedes sin afectar el dinero de la caja
                  {!global && ` · solo los de ${sucursalActual?.nombre ?? "la sede"}`}.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => abrirTraslado()} className="shrink-0">
                <ArrowLeftRight className="h-4 w-4" />
                Nuevo traslado
              </Button>
            </CardHeader>

            <div className="overflow-x-auto pb-2">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Origen → Destino</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trasladosVista.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        Aún no hay traslados registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    trasladosVista.map((t) => {
                      const prod = productoPorId.get(t.productoId)
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <p className="cifra font-semibold">{fechaCorta(t.fecha)}</p>
                            <p className="cifra text-xs text-muted-foreground">{horaCorta(t.fecha)}</p>
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <div className="flex min-w-0 items-center gap-3">
                              <MiniaturaProducto
                                imagenUrl={prod?.imagenUrl}
                                icono={prod?.icono}
                                className="h-9 w-9"
                              />
                              <p className="text-sm font-semibold">
                                {prod?.nombreUnificado ?? "Producto no disponible"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
                              {nombreSede(t.origenId)}
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              {nombreSede(t.destinoId)}
                            </span>
                          </TableCell>
                          <TableCell className="cifra text-right text-base font-bold">{t.cantidad}</TableCell>
                          <TableCell className="text-sm">{t.usuarioNombre}</TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="truncate text-sm text-muted-foreground" title={t.nota}>
                              {t.nota || "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-bold text-accent-700 dark:text-accent-400">
                              Completado
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de producto (crear / editar) */}
      <ProductFormModal
        abierto={modal.abierto}
        producto={modal.producto}
        sucursalInicial={sucursalActiva}
        onCerrar={cerrarModal}
      />

      <StockEntryModal
        abierto={modalIngreso.abierto}
        productoInicial={modalIngreso.producto}
        sucursalInicial={sucursalActiva}
        onCerrar={cerrarIngreso}
      />

      <TransferModal
        abierto={modalTraslado.abierto}
        productoInicial={modalTraslado.producto}
        onCerrar={cerrarTraslado}
      />

    </div>
  )
}