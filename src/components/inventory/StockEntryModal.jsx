import { useMemo, useState } from "react"
import { AlertTriangle, ClipboardCheck, PackagePlus, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS, formatCOP, costoUnitarioStock } from "@/context/POSContext"
import { MiniaturaProducto } from "@/components/inventory/ProductFormModal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const CTA = "bg-accent-500 text-text-950 font-bold hover:bg-accent-600 dark:text-[#02180d]"
const CHIPS = [5, 10, 12, 24, 30]

const MODOS = [
  {
    id: "compra",
    icon: PackagePlus,
    titulo: "Ingreso por compra (Factura)",
    texto: "Suma unidades que llegaron del proveedor y actualiza el costo.",
  },
  {
    id: "ajuste",
    icon: ClipboardCheck,
    titulo: "Ajuste por conteo físico / Lote",
    texto: "Fija el número exacto contado o las porciones listas de un lote.",
  },
]

const pct = (n) => `${n.toFixed(1).replace(".", ",")}%`
const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Moneda con hasta 2 decimales (para costos de lote como $5.833,33)
const formatDec = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)

const normalizar = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

// Tarjeta seleccionable (misma línea visual que el resto de modales)
const opcion = (activo, extra) =>
  cn(
    "min-w-0 rounded-xl border-2 p-3 text-left transition-colors",
    activo ? "border-primary bg-primary-500/10" : "border-border hover:border-primary/50",
    extra
  )

function TipoBadge({ p }) {
  if (p.tipoItem === "insumo") {
    return (
      <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-bold text-primary-600">
        Insumo interno
      </span>
    )
  }
  if (p.tipoItem === "preparado") {
    return (
      <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-700 dark:text-accent-400">
        Preparado
      </span>
    )
  }
  return null
}

function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-muted-foreground">{etiqueta}</span>
      <span className="shrink-0 text-right font-semibold">{children}</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Formulario (se monta al abrir el diálogo, así siempre arranca limpio)
// ---------------------------------------------------------------------
function Formulario({ productoInicial, sucursalInicial, onCerrar }) {
  const { sucursales, productos, ingresarStockSucursal, ajustarStockSucursal, solicitarAutorizacion } =
    usePOS()

  const sedes = useMemo(() => sucursales.filter((s) => s.activa !== false), [sucursales])

  const [modo, setModo] = useState("compra")
  const [sucursalId, setSucursalId] = useState(() =>
    sucursalInicial !== "todas" && sedes.some((s) => s.id === sucursalInicial)
      ? sucursalInicial
      : sedes[0]?.id ?? ""
  )
  const [productoId, setProductoId] = useState(productoInicial?.id ?? null)
  const [busqueda, setBusqueda] = useState("")
  const [forma, setForma] = useState("unidades") // "unidades" | "porciones"
  const [cantidad, setCantidad] = useState("")
  const [modoCosto, setModoCosto] = useState("unitario") // "unitario" | "lote"
  const [costo, setCosto] = useState(() =>
    productoInicial ? String(productoInicial.costoCompra ?? 0) : ""
  )
  const [costoLote, setCostoLote] = useState("")
  // Ajuste: null = sin tocar (se muestra el valor actual de la sede)
  const [stockExacto, setStockExacto] = useState(null)
  const [noManejado, setNoManejado] = useState(null)

  const producto = productoId ? productos.find((p) => p.id === productoId) ?? null : null
  const sede = sedes.find((s) => s.id === sucursalId) ?? null

  // ---------- Lista de productos ----------
  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return productos
      .filter((p) => p.activo !== false)
      .filter(
        (p) =>
          !q ||
          normalizar([p.nombreUnificado, p.categoria, p.codigoBarras].join(" ")).includes(q)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [productos, busqueda])

  const elegirProducto = (p) => {
    setProductoId(p.id)
    setCosto(String(p.costoCompra ?? 0))
    setCostoLote("")
    setForma("unidades")
    setStockExacto(null)
    setNoManejado(null)
    setBusqueda("")
  }
  const elegirSede = (id) => {
    setSucursalId(id)
    setStockExacto(null)
    setNoManejado(null)
  }

  // ---------- Cálculos comunes ----------
  const actual = producto?.stock?.[sucursalId] // number | undefined
  const stockActual = typeof actual === "number" ? actual : 0
  const esInsumo = producto?.tipoItem === "insumo"
  const rend = producto && Number(producto.rendimiento) > 1 ? Number(producto.rendimiento) : 1
  const tieneRend = rend > 1

  // ---------- Modo compra ----------
  const cantN = cantidad === "" ? NaN : Number(cantidad)
  const cantidadValida = Number.isInteger(cantN) && cantN > 0
  const porciones = cantidadValida ? Math.floor(forma === "unidades" && tieneRend ? cantN * rend : cantN) : 0
  const nuevoStock = stockActual + porciones

  // Costo por unidad/paquete comprado (costoNuevo === null -> no se actualiza el costo)
  let costoNuevo = null
  let costoValido = true
  if (modoCosto === "unitario") {
    if (costo !== "") {
      const n = Number(costo)
      costoValido = Number.isFinite(n) && n >= 0
      costoNuevo = costoValido ? n : null
    }
  } else if (costoLote !== "") {
    const total = Number(costoLote)
    costoValido = Number.isFinite(total) && total >= 0
    if (costoValido && cantidadValida) {
      // Con rendimiento y conteo en porciones: unidades de compra equivalentes = cantN / rend
      costoNuevo = tieneRend && forma === "porciones" ? (total / cantN) * rend : total / cantN
    }
  }
  const lotePendiente = modoCosto === "lote" && costoLote !== "" && costoValido && !cantidadValida

  // Costo Promedio Ponderado (misma fórmula que ingresarStockSucursal)
  const costoAnterior = Number(producto?.costoCompra) || 0
  const stockTotalNegocio = producto
    ? Object.values(producto.stock ?? {}).reduce(
        (suma, u) => suma + (typeof u === "number" && u > 0 ? u : 0),
        0
      )
    : 0
  let cpp = costoAnterior
  if (producto && costoNuevo !== null && porciones > 0) {
    cpp = redondear2(
      stockTotalNegocio > 0 && costoAnterior > 0
        ? (stockTotalNegocio * costoAnterior + porciones * costoNuevo) / (stockTotalNegocio + porciones)
        : costoNuevo
    )
  }

  const precio = producto?.precio ?? 0
  const margen = precio > 0 ? ((precio - cpp) / precio) * 100 : null
  const perdida = !esInsumo && precio > 0 && cpp > precio

  const sumarChip = (n) => setCantidad(String((Number.isInteger(cantN) && cantN > 0 ? cantN : 0) + n))

  const registrar = (agregarOtro) => {
    if (!producto) return toast.error("Selecciona un producto")
    if (!sede) return toast.error("Selecciona una sucursal")
    if (!cantidadValida || porciones <= 0) return toast.error("Escribe una cantidad entera mayor a 0")
    if (!costoValido) return toast.error("El costo no es válido")

    solicitarAutorizacion(() => {
      try {
        const total = ingresarStockSucursal({
          productoId: producto.id,
          sucursalId,
          cantidadAgregada: porciones,
          nuevoCosto: costoNuevo ?? undefined,
        })
        toast.success(`+${porciones} · ${producto.nombreUnificado} en ${sede.nombre} (stock: ${total})`)
        if (agregarOtro) {
          // Mantiene la sede fija y deja listo el siguiente renglón de la factura
          setProductoId(null)
          setCantidad("")
          setCosto("")
          setCostoLote("")
          setBusqueda("")
          setForma("unidades")
        } else {
          onCerrar()
        }
      } catch (err) {
        toast.error(err.message || "No se pudo registrar el ingreso")
      }
    })
  }

  // ---------- Modo ajuste ----------
  const valorExacto = stockExacto ?? String(stockActual)
  const exactoN = valorExacto === "" ? NaN : Number(valorExacto)
  const exactoValido = Number.isInteger(exactoN) && exactoN >= 0
  const noMan = noManejado ?? (producto ? typeof actual !== "number" : false)
  const diferencia = noMan ? -stockActual : exactoValido ? exactoN - stockActual : null
  const impactoDinero =
    diferencia !== null && producto
      ? Math.round(diferencia * costoUnitarioStock(producto) * 100) / 100
      : null

  const aplicarAjuste = () => {
    if (!producto) return toast.error("Selecciona un producto")
    if (!sede) return toast.error("Selecciona una sucursal")
    if (!noMan && !exactoValido) return toast.error("Escribe un stock entero de 0 o más")

    solicitarAutorizacion(() => {
      try {
        ajustarStockSucursal(producto.id, sucursalId, noMan ? null : exactoN)
        toast.success(
          noMan
            ? `${producto.nombreUnificado} ya no se maneja en ${sede.nombre}`
            : `Stock de ${producto.nombreUnificado} en ${sede.nombre}: ${exactoN}`
        )
        onCerrar()
      } catch (err) {
        toast.error(err.message || "No se pudo ajustar el stock")
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 border-b p-4 text-left sm:p-6">
        <DialogTitle className="pr-8">
          {modo === "compra" ? "Ingresar compra" : "Ajuste por conteo físico"}
        </DialogTitle>
        <DialogDescription className="pr-8">
          {modo === "compra"
            ? "Registra la mercancía que llegó con la factura del proveedor."
            : "Corrige el stock de una sede con el conteo real o con un lote cocinado."}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {/* Modo */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {MODOS.map(({ id, icon: Icono, titulo, texto }) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => setModo(id)}
              className={opcion(modo === id)}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icono className="h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{titulo}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{texto}</span>
            </button>
          ))}
        </div>

        {/* Sucursal */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Sucursal</p>
          {sedes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sucursales activas.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {sedes.map((s) => {
                const u = producto?.stock?.[s.id]
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={sucursalId === s.id}
                    onClick={() => elegirSede(s.id)}
                    className={opcion(sucursalId === s.id)}
                  >
                    <span className="block truncate text-sm font-bold">{s.nombre}</span>
                    {producto && (
                      <span className="block text-xs text-muted-foreground">
                        {typeof u === "number" ? (
                          <>
                            Stock: <span className="cifra font-semibold text-foreground">{u}</span>
                          </>
                        ) : (
                          "No lo maneja"
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Producto */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Producto</p>
          {producto ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <MiniaturaProducto imagenUrl={producto.imagenUrl} icono={producto.icono} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold">{producto.nombreUnificado}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{producto.categoria}</span>
                  <TipoBadge p={producto} />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setProductoId(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, categoría o código…"
                  aria-label="Buscar producto"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border p-1.5">
                {lista.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No hay productos que coincidan.
                  </p>
                ) : (
                  lista.map((p) => {
                    const u = p.stock?.[sucursalId]
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => elegirProducto(p)}
                        className="flex w-full min-w-0 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                      >
                        <MiniaturaProducto imagenUrl={p.imagenUrl} icono={p.icono} className="h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold">{p.nombreUnificado}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2">
                            <TipoBadge p={p} />
                            <span className="text-xs text-muted-foreground">
                              {typeof u === "number" ? (
                                <>
                                  Stock en sede: <span className="cifra font-semibold">{u}</span>
                                </>
                              ) : (
                                "No lo maneja esta sede"
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== Modo compra ===== */}
        {producto && modo === "compra" && (
          <>
            {tieneRend && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">¿Cómo cuentas lo que llegó?</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={forma === "unidades"}
                    onClick={() => setForma("unidades")}
                    className={opcion(forma === "unidades")}
                  >
                    <span className="block text-sm font-bold">
                      Por unidades/paquetes comprados (<span className="cifra">×{rend}</span>)
                    </span>
                    <span className="block text-xs text-muted-foreground">Cada unidad suma {rend} porciones.</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={forma === "porciones"}
                    onClick={() => setForma("porciones")}
                    className={opcion(forma === "porciones")}
                  >
                    <span className="block text-sm font-bold">Por porciones directas</span>
                    <span className="block text-xs text-muted-foreground">Escribes las porciones ya contadas.</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  {tieneRend
                    ? forma === "unidades"
                      ? "Unidades / paquetes comprados"
                      : "Porciones a ingresar"
                    : "Cantidad a ingresar"}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className="cifra"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => sumarChip(n)}
                    className="cifra rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    +{n}
                  </button>
                ))}
              </div>
              {tieneRend && forma === "unidades" && porciones > 0 && (
                <p className="text-sm">
                  Se sumarán <span className="cifra font-bold">{porciones}</span> porciones al stock de la sede.
                </p>
              )}
              {cantidad !== "" && !cantidadValida && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  Escribe un número entero mayor a 0.
                </p>
              )}
            </div>

            {/* Cómo digitas el costo de la factura */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">¿Cómo digitas el costo de la factura?</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={modoCosto === "unitario"}
                  onClick={() => setModoCosto("unitario")}
                  className={opcion(modoCosto === "unitario")}
                >
                  <span className="block text-sm font-bold">Costo unitario</span>
                  <span className="block text-xs text-muted-foreground">
                    Lo que cuesta {tieneRend ? "1 unidad o paquete" : "1 unidad"}.
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={modoCosto === "lote"}
                  onClick={() => setModoCosto("lote")}
                  className={opcion(modoCosto === "lote")}
                >
                  <span className="block text-sm font-bold">Costo total del lote</span>
                  <span className="block text-xs text-muted-foreground">
                    Lo que cobró el proveedor por todo el renglón.
                  </span>
                </button>
              </div>

              {modoCosto === "unitario" ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {tieneRend ? "Costo por unidad/paquete comprado (COP)" : "Costo unitario de compra (COP)"}
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="any"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                    placeholder="0"
                    className="cifra"
                  />
                  {!costoValido && (
                    <span role="alert" className="block text-xs font-medium text-destructive">
                      El costo no puede ser negativo.
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    Cámbialo si la factura llegó con un precio nuevo. En blanco, no se actualiza el costo.
                  </span>
                </label>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Costo total del lote (COP)</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="any"
                    value={costoLote}
                    onChange={(e) => setCostoLote(e.target.value)}
                    placeholder="0"
                    className="cifra"
                  />
                  {!costoValido && (
                    <span role="alert" className="block text-xs font-medium text-destructive">
                      El costo no puede ser negativo.
                    </span>
                  )}
                  {costoNuevo !== null && (
                    <span className="block text-sm">
                      Equivale a <span className="cifra font-bold">{formatDec(costoNuevo)}</span> por unidad/paquete
                      comprado
                    </span>
                  )}
                  {lotePendiente && (
                    <span className="block text-xs text-muted-foreground">
                      Escribe la cantidad para calcular el costo por unidad.
                    </span>
                  )}
                </label>
              )}
            </div>

            {/* Resumen de impacto */}
            <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5 text-sm">
              <Fila etiqueta="Stock en sede">
                <span className="cifra">{stockActual}</span> →{" "}
                <span className="cifra font-bold">{nuevoStock}</span>
                {porciones > 0 && <span className="cifra ml-1 text-xs text-muted-foreground">(+{porciones})</span>}
              </Fila>

              <Fila etiqueta="Costo promedio resultante (CPP)">
                <span className="cifra">{formatDec(cpp)}</span>
              </Fila>

              {esInsumo ? (
                <>
                  {costoNuevo !== null && (
                    <Fila etiqueta="Costo unitario de esta compra">
                      <span className="cifra">{formatDec(costoNuevo)}</span>
                    </Fila>
                  )}
                  {tieneRend && (
                    <Fila etiqueta="Costo resultante por porción">
                      <span className="cifra">{formatDec(cpp / rend)}</span>
                    </Fila>
                  )}
                </>
              ) : (
                <>
                  <Fila etiqueta="Precio de venta actual">
                    <span className="cifra">{formatCOP(precio)}</span>
                  </Fila>
                  <Fila etiqueta="Margen resultante (con CPP)">
                    <span className={cn("cifra", perdida && "text-red-600 dark:text-red-400")}>
                      {margen === null ? "—" : pct(margen)}
                    </span>
                  </Fila>
                  {perdida && (
                    <p className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      El costo promedio supera el precio de venta: venderías con pérdida.
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ===== Modo ajuste ===== */}
        {producto && modo === "ajuste" && (
          <>
            <button
              type="button"
              aria-pressed={noMan}
              onClick={() => setNoManejado(!noMan)}
              className={opcion(noMan, "w-full")}
            >
              <span className="block text-sm font-bold">No manejado en esta sede</span>
              <span className="block text-xs text-muted-foreground">
                La sede deja de manejar este producto y no genera alertas de stock.
              </span>
            </button>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Existencias reales contadas</span>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                disabled={noMan}
                value={noMan ? "" : valorExacto}
                onChange={(e) => setStockExacto(e.target.value)}
                placeholder={noMan ? "—" : "0"}
                className="cifra"
              />
              {!noMan && !exactoValido && (
                <span role="alert" className="block text-xs font-medium text-destructive">
                  Escribe un entero de 0 o más.
                </span>
              )}
            </label>

            <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5 text-sm">
              <Fila etiqueta="Stock actual en sede">
                <span className="cifra">{typeof actual === "number" ? actual : "—"}</span>
              </Fila>
              <Fila etiqueta="Después del ajuste">
                <span className="cifra font-bold">{noMan ? "No manejado" : exactoValido ? exactoN : "—"}</span>
              </Fila>
              <Fila etiqueta="Diferencia">
                {diferencia === null ? (
                  "—"
                ) : (
                  <span
                    className={cn(
                      "cifra font-bold",
                      diferencia > 0 && "text-accent-700 dark:text-accent-400",
                      diferencia < 0 && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {diferencia > 0 ? "+" : ""}
                    {diferencia} {Math.abs(diferencia) === 1 ? "unidad" : "unidades"}
                  </span>
                )}
              </Fila>
              <Fila etiqueta="Impacto financiero (Merma / Sobrante)">
                {impactoDinero === null ? (
                  "—"
                ) : impactoDinero < 0 ? (
                  <span className="cifra font-bold text-red-600 dark:text-red-400">
                    - {formatCOP(Math.abs(impactoDinero))}
                  </span>
                ) : impactoDinero > 0 ? (
                  <span className="cifra font-bold text-accent-700 dark:text-accent-400">
                    + {formatCOP(impactoDinero)}
                  </span>
                ) : (
                  <span className="cifra">{formatCOP(0)}</span>
                )}
              </Fila>
            </div>
          </>
        )}
      </div>

      {/* Pie fijo */}
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end sm:p-6">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCerrar}>
          Cancelar
        </Button>
        {modo === "compra" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!producto || !cantidadValida || !costoValido}
              onClick={() => registrar(true)}
            >
              Guardar y agregar otro
            </Button>
            <Button
              type="button"
              className={cn("w-full sm:w-auto", CTA)}
              disabled={!producto || !cantidadValida || !costoValido}
              onClick={() => registrar(false)}
            >
              Registrar ingreso
            </Button>
          </>
        ) : (
          <Button
            type="button"
            className={cn("w-full sm:w-auto", CTA)}
            disabled={!producto || (!noMan && !exactoValido)}
            onClick={aplicarAjuste}
          >
            Aplicar ajuste
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Modal (exclusivo de administrador: se abre desde InventarioPage con solicitarAutorizacion)
// ---------------------------------------------------------------------
export default function StockEntryModal({
  abierto,
  onCerrar,
  productoInicial = null,
  sucursalInicial = "todas",
}) {
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) onCerrar()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <Formulario
          productoInicial={productoInicial}
          sucursalInicial={sucursalInicial}
          onCerrar={onCerrar}
        />
      </DialogContent>
    </Dialog>
  )
}