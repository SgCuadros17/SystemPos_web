import { useMemo, useState } from "react"
import { ArrowRight, Check, Lock, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
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

const PASOS = [
  { n: 1, label: "Producto", texto: "Elige qué producto vas a mover." },
  { n: 2, label: "Origen", texto: "¿De qué sucursal sale la mercancía?" },
  { n: 3, label: "Destino", texto: "¿A qué sucursal llega?" },
  { n: 4, label: "Cantidad", texto: "Define la cantidad y confirma el traslado." },
]

const normalizar = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const opcion = (activo, extra) =>
  cn(
    "min-w-0 rounded-xl border-2 p-3 text-left transition-colors",
    activo ? "border-primary bg-primary-500/10" : "border-border hover:border-primary/50",
    extra
  )

function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-muted-foreground">{etiqueta}</span>
      <span className="shrink-0 text-right font-semibold">{children}</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Formulario (se monta al abrir el diálogo, así siempre arranca limpio)
// ---------------------------------------------------------------------
function Formulario({ productoInicial, onCerrar }) {
  const { sucursales, sucursalActiva, rol, modoAdminTemporal, productos, registrarTraslado } = usePOS()

  // RLS traslados_insert: cajero (o admin con acceso "solo esta sección") despacha solo desde su sede
  const origenFijoBruto = rol !== "admin" || modoAdminTemporal === "accion" ? sucursalActiva : null
  const origenFijo = origenFijoBruto && origenFijoBruto !== "todas" ? origenFijoBruto : null

  const sedes = useMemo(() => sucursales.filter((s) => s.activa !== false), [sucursales])
  const nombreSede = (id) => sucursales.find((s) => s.id === id)?.nombre ?? "—"

  // Unidades disponibles del producto en el alcance del usuario
  const disponibleAlcance = (p) =>
    origenFijo
      ? p.stock?.[origenFijo] ?? 0
      : sedes.reduce((suma, s) => suma + (p.stock?.[s.id] ?? 0), 0)

  // Solo productos con stock físico (numérico) en el alcance
  const candidatos = useMemo(
    () =>
      productos
        .filter((p) => p.activo !== false)
        .filter((p) =>
          origenFijo
            ? typeof p.stock?.[origenFijo] === "number"
            : Object.values(p.stock ?? {}).some((u) => typeof u === "number")
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos, origenFijo]
  )

  const [productoId, setProductoId] = useState(() => {
    if (!productoInicial) return null
    const p = productos.find((x) => x.id === productoInicial.id)
    return p && p.activo !== false && disponibleAlcance(p) > 0 ? p.id : null
  })
  const [paso, setPaso] = useState(() => (productoInicial && productoId ? 2 : 1))
  const [origenId, setOrigenId] = useState(origenFijo)
  const [destinoId, setDestinoId] = useState(null)
  const [cantidad, setCantidad] = useState("")
  const [nota, setNota] = useState("")
  const [busqueda, setBusqueda] = useState("")

  const producto = productoId ? productos.find((p) => p.id === productoId) ?? null : null

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return candidatos.filter(
      (p) =>
        !q || normalizar([p.nombreUnificado, p.categoria, p.codigoBarras].join(" ")).includes(q)
    )
  }, [candidatos, busqueda])

  // ---------- Cálculos ----------
  const stockOrigen = producto && origenId ? producto.stock?.[origenId] ?? 0 : 0
  const stockDestino = producto && destinoId ? producto.stock?.[destinoId] : undefined
  const cantN = cantidad === "" ? NaN : Number(cantidad)
  const cantidadValida = Number.isInteger(cantN) && cantN >= 1 && cantN <= stockOrigen

  const elegirProducto = (p) => {
    setProductoId(p.id)
    if (!origenFijo) setOrigenId(null)
    setDestinoId(null)
    setCantidad("")
  }
  const elegirOrigen = (id) => {
    setOrigenId(id)
    if (destinoId === id) setDestinoId(null)
    setCantidad("")
  }

  const sumar = (n) =>
    setCantidad(String(Math.min(stockOrigen, (Number.isInteger(cantN) && cantN > 0 ? cantN : 0) + n)))

  const puedeSeguir =
    paso === 1
      ? Boolean(producto)
      : paso === 2
        ? Boolean(origenId) && stockOrigen > 0
        : paso === 3
          ? Boolean(destinoId)
          : cantidadValida

  const confirmar = () => {
    try {
      registrarTraslado({
        productoId: producto.id,
        origenId,
        destinoId,
        cantidad: cantN,
        nota: nota.trim(),
      })
      toast.success(
        `Traslado listo: ${cantN} × ${producto.nombreUnificado} · ${nombreSede(origenId)} → ${nombreSede(destinoId)}`
      )
      onCerrar()
    } catch (err) {
      toast.error(err.message || "No se pudo registrar el traslado")
    }
  }

  const pasoActual = PASOS[paso - 1]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 border-b p-4 text-left sm:p-6">
        <DialogTitle className="pr-8">Trasladar mercancía</DialogTitle>
        <DialogDescription className="pr-8">
          Paso <span className="cifra">{paso}</span> de <span className="cifra">4</span> · {pasoActual.texto}
        </DialogDescription>

        {/* Indicador de pasos */}
        <ol className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
          {PASOS.map(({ n, label }) => {
            const hecho = paso > n
            const actual = paso === n
            return (
              <li key={n} className="min-w-0">
                <button
                  type="button"
                  disabled={n > paso}
                  onClick={() => setPaso(n)}
                  aria-current={actual ? "step" : undefined}
                  className={cn(
                    "flex w-full min-w-0 flex-col items-center gap-1 rounded-lg p-1.5 transition-colors",
                    actual ? "bg-primary-500/10" : "disabled:cursor-default",
                    hecho && "hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "cifra flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      hecho || actual ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {hecho ? <Check className="h-4 w-4" /> : n}
                  </span>
                  <span
                    className={cn(
                      "w-full truncate text-center text-[11px] font-semibold",
                      actual ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {/* ===== Paso 1: producto ===== */}
        {paso === 1 && (
          <div className="space-y-2">
            {origenFijo && (
              <p className="flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Solo ves los productos de {nombreSede(origenFijo)}, la sede desde la que operas.
              </p>
            )}
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
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border p-1.5">
              {lista.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No hay productos con stock para trasladar.
                </p>
              ) : (
                lista.map((p) => {
                  const disp = disponibleAlcance(p)
                  const sedesConStock = sedes.filter((s) => (p.stock?.[s.id] ?? 0) > 0).length
                  const activo = productoId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disp <= 0}
                      onClick={() => elegirProducto(p)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-lg border-2 p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        activo ? "border-primary bg-primary-500/10" : "border-transparent hover:bg-muted"
                      )}
                    >
                      <MiniaturaProducto imagenUrl={p.imagenUrl} icono={p.icono} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">{p.nombreUnificado}</span>
                        <span className="block text-xs text-muted-foreground">
                          {origenFijo ? (
                            <>
                              Disponible en {nombreSede(origenFijo)}:{" "}
                              <span className="cifra font-semibold text-foreground">{disp}</span>
                            </>
                          ) : (
                            <>
                              Total <span className="cifra font-semibold text-foreground">{disp}</span> en{" "}
                              <span className="cifra">{sedesConStock}</span>{" "}
                              {sedesConStock === 1 ? "sede" : "sedes"}
                            </>
                          )}
                          {disp <= 0 && " · Sin unidades"}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ===== Paso 2: origen ===== */}
        {paso === 2 && producto && (
          <div className="space-y-3">
            <p className="break-words text-sm font-semibold">{producto.nombreUnificado}</p>
            {origenFijo ? (
              <>
                <div className={opcion(true)}>
                  <span className="block truncate text-sm font-bold">{nombreSede(origenFijo)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Disponible: <span className="cifra font-semibold text-foreground">{stockOrigen}</span>
                  </span>
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Como operas desde esta sede, el traslado se despacha desde aquí.
                </p>
                {stockOrigen <= 0 && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    Esta sede no tiene unidades de este producto.
                  </p>
                )}
              </>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {sedes.map((s) => {
                  const u = producto.stock?.[s.id]
                  const disp = typeof u === "number" ? u : 0
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={disp <= 0}
                      aria-pressed={origenId === s.id}
                      onClick={() => elegirOrigen(s.id)}
                      className={opcion(origenId === s.id, "disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      <span className="block truncate text-sm font-bold">{s.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {typeof u === "number" ? (
                          <>
                            Disponible: <span className="cifra font-semibold text-foreground">{u}</span>
                          </>
                        ) : (
                          "No lo maneja"
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== Paso 3: destino ===== */}
        {paso === 3 && producto && (
          <div className="space-y-3">
            <p className="break-words text-sm font-semibold">
              {producto.nombreUnificado}
              <span className="font-normal text-muted-foreground"> · sale de {nombreSede(origenId)}</span>
            </p>
            {sedes.filter((s) => s.id !== origenId).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay otra sucursal activa para recibir el traslado.</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {sedes
                  .filter((s) => s.id !== origenId)
                  .map((s) => {
                    const u = producto.stock?.[s.id]
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={destinoId === s.id}
                        onClick={() => setDestinoId(s.id)}
                        className={opcion(destinoId === s.id)}
                      >
                        <span className="block truncate text-sm font-bold">{s.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {typeof u === "number" ? (
                            <>
                              Tiene ahora: <span className="cifra font-semibold text-foreground">{u}</span>
                            </>
                          ) : (
                            "Aún no lo maneja (empezará a manejarlo)"
                          )}
                        </span>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* ===== Paso 4: cantidad y confirmación ===== */}
        {paso === 4 && producto && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <MiniaturaProducto imagenUrl={producto.imagenUrl} icono={producto.icono} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold">{producto.nombreUnificado}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="max-w-[40%] truncate">{nombreSede(origenId)}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="max-w-[40%] truncate">{nombreSede(destinoId)}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  Cantidad a trasladar{" "}
                  <span className="font-normal text-muted-foreground">
                    (máx. <span className="cifra">{stockOrigen}</span>)
                  </span>
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={stockOrigen}
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className="cifra"
                  autoFocus
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[1, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => sumar(n)}
                    className="cifra rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    +{n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCantidad(String(Math.max(1, Math.floor(stockOrigen / 2))))}
                  className="rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  Mitad
                </button>
                <button
                  type="button"
                  onClick={() => setCantidad(String(stockOrigen))}
                  className="rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  Todo el disponible
                </button>
              </div>
              {cantidad !== "" && !cantidadValida && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  Escribe un entero entre 1 y {stockOrigen}.
                </p>
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Nota / Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <Input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Préstamo urgente, reposición de stock bajo"
                maxLength={140}
              />
            </label>

            {/* Antes / después */}
            <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5 text-sm">
              <Fila etiqueta={`Origen (${nombreSede(origenId)})`}>
                <span className="cifra">{stockOrigen}</span> →{" "}
                <span className="cifra font-bold">{cantidadValida ? stockOrigen - cantN : stockOrigen}</span>
              </Fila>
              <Fila etiqueta={`Destino (${nombreSede(destinoId)})`}>
                <span className="cifra">{typeof stockDestino === "number" ? stockDestino : 0}</span> →{" "}
                <span className="cifra font-bold">
                  {(typeof stockDestino === "number" ? stockDestino : 0) + (cantidadValida ? cantN : 0)}
                </span>
              </Fila>
              <p className="pt-1">
                <span className="cifra inline-flex rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-bold text-accent-700 dark:text-accent-400">
                  Impacto en caja: $ 0
                </span>
                <span className="ml-2 text-xs text-muted-foreground">Movimiento interno entre sedes</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pie fijo */}
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end sm:p-6">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCerrar}>
          Cancelar
        </Button>
        {paso > 1 && (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setPaso((p) => p - 1)}>
            Atrás
          </Button>
        )}
        {paso < 4 ? (
          <Button
            type="button"
            className={cn("w-full sm:w-auto", CTA)}
            disabled={!puedeSeguir}
            onClick={() => setPaso((p) => p + 1)}
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className={cn("w-full sm:w-auto", CTA)}
            disabled={!cantidadValida}
            onClick={confirmar}
          >
            Confirmar traslado
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Modal
//   productoInicial: null o el producto que se preselecciona (si tiene stock en el alcance)
// ---------------------------------------------------------------------
export default function TransferModal({ abierto, onCerrar, productoInicial = null }) {
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) onCerrar()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <Formulario productoInicial={productoInicial} onCerrar={onCerrar} />
      </DialogContent>
    </Dialog>
  )
}