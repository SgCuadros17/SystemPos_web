import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Calculator,
  Camera,
  LayoutGrid,
  Lightbulb,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingDown,
  Upload,
  Utensils,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS, formatCOP, construirNombreUnificado, sugerirCalculoReceta } from "@/context/POSContext"
import {
  ICONOS_CATALOGO,
  TIPOS_ITEM,
  categoriasParaGremio,
  iconosParaGremio,
  obtenerIconoProducto,
  presentacionesParaGremio,
} from "@/config/catalogs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CTA = "bg-accent-500 text-text-950 font-bold hover:bg-accent-600 dark:text-[#02180d]"
const OTRA = "__otra__"
const MAX_FOTO = 2 * 1024 * 1024 // 2 MB

const pct = (n) => `${n.toFixed(1).replace(".", ",")}%`
const OPCIONES_TIPO = [
  { id: "venta_directa", icon: ShoppingBag },
  { id: "insumo", icon: Package },
  { id: "preparado", icon: Utensils },
]
const nuevaClave = () => crypto.randomUUID?.() ?? String(Math.random())

// ---------------------------------------------------------------------
// Miniatura reutilizable (foto o icono camaleón). También la usa InventarioPage.
// ---------------------------------------------------------------------
export function MiniaturaProducto({ imagenUrl, icono, className, iconClassName = "h-5 w-5" }) {
  const [falloUrl, setFalloUrl] = useState(null) // URL que no cargó
  const Icono = obtenerIconoProducto(icono)
  const mostrarFoto = Boolean(imagenUrl) && imagenUrl !== falloUrl

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-500/10 text-primary-600",
        className
      )}
    >
      {mostrarFoto ? (
        <img
          src={imagenUrl}
          alt=""
          onError={() => setFalloUrl(imagenUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icono className={iconClassName} />
      )}
    </span>
  )
}

// ---------------------------------------------------------------------
// Piezas de apoyo
// ---------------------------------------------------------------------
function Interruptor({ activo, onChange, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onChange(!activo)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        activo ? "bg-accent-500" : "bg-input"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          activo ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

function Campo({ etiqueta, opcional, error, ayuda, className, children }) {
  return (
    <label className={cn("block min-w-0 space-y-1.5", className)}>
      <span className="text-sm font-semibold">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs font-medium text-destructive">
          {error}
        </span>
      ) : ayuda ? (
        <span className="block text-xs text-muted-foreground">{ayuda}</span>
      ) : null}
    </label>
  )
}

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------
// Formulario (se monta al abrir el diálogo, así siempre arranca limpio)
// ---------------------------------------------------------------------
function Formulario({ producto, sucursalInicial, onCerrar, cierreRef }) {
  const { negocio, sucursales, productos, guardarProducto, solicitarAutorizacion } = usePOS()
  const p = producto
  const tipo = negocio?.tipo_negocio
  const archivoRef = useRef(null)

  const [f, setF] = useState(() => ({
    nombre: p?.nombre ?? "",
    marca: p?.marca ?? "",
    presentacion: p?.presentacion ?? "",
    categoria: p?.categoria ?? "",
    precio: p ? String(p.precio) : "",
    costoCompra: p ? String(p.costoCompra ?? 0) : "",
    codigoBarras: p?.codigoBarras ?? "",
    stockMinimo: String(p?.stockMinimo ?? 5),
    icono: p?.icono ?? "package",
    imagenUrl: p?.imagenUrl ?? "",
    tipoItem: p?.tipoItem ?? "venta_directa",
    rendimiento: String(p?.rendimiento ?? 1),
  }))
  const set = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }))
  const onInput = (campo) => (e) => set(campo, e.target.value)
  const esInsumo = f.tipoItem === "insumo"
  const esPreparado = f.tipoItem === "preparado"
  const mostrarTipos = tipo !== "ferreteria" || f.tipoItem !== "venta_directa"

  const [intentado, setIntentado] = useState(false)

  // Categoría: lista del gremio o personalizada
  const categorias = useMemo(() => categoriasParaGremio(tipo), [tipo])
  const [categoriaOtra, setCategoriaOtra] = useState(
    () => Boolean(p?.categoria) && !categoriasParaGremio(tipo).includes(p.categoria)
  )

  // Imagen: icono camaleón o foto
  const [modoImagen, setModoImagen] = useState(p?.imagenUrl ? "foto" : "icono")
  const [verTodos, setVerTodos] = useState(
    () => !iconosParaGremio(tipo).some((i) => i.id === (p?.icono ?? "package"))
  )
  const iconos = verTodos ? ICONOS_CATALOGO : iconosParaGremio(tipo)
  const iconoSeleccionado = ICONOS_CATALOGO.find((i) => i.id === f.icono)
  const imagenEfectiva = modoImagen === "foto" ? f.imagenUrl : ""
  const esDataUrl = f.imagenUrl.startsWith("data:")

  // Stock por sucursal
  const [manejada, setManejada] = useState(() => {
    const m = {}
    for (const s of sucursales) {
      m[s.id] = p
        ? typeof p.stock?.[s.id] === "number"
        : sucursalInicial === "todas" || sucursalInicial === s.id
    }
    return m
  })
  const [cantidades, setCantidades] = useState(() => {
    const c = {}
    for (const s of sucursales) {
      c[s.id] = p && typeof p.stock?.[s.id] === "number" ? String(p.stock[s.id]) : "0"
    }
    return c
  })

    // Receta sugerida (solo plato preparado) y calculadora de rendimiento (solo insumo)
  const [receta, setReceta] = useState(() =>
    (p?.receta ?? []).map((r) => ({ k: nuevaClave(), insumoId: r.insumoId, cantidad: String(r.cantidad) }))
  )
  const [compradas, setCompradas] = useState("")
  const [sedeCalcId, setSedeCalcId] = useState("")

  const cambiarTipo = (id) => {
    set("tipoItem", id)
    // Un producto nuevo: el plato preparado arranca sin conteo manual; los demás en las sedes de la vista
    if (!p) {
      setManejada(
        Object.fromEntries(
          sucursales.map((s) => [
            s.id,
            id !== "preparado" && (sucursalInicial === "todas" || sucursalInicial === s.id),
          ])
        )
      )
    }
  }
  const agregarIngrediente = () =>
    setReceta((l) => [...l, { k: nuevaClave(), insumoId: "", cantidad: "1" }])
  const cambiarIngrediente = (k, campo, valor) =>
    setReceta((l) => l.map((r) => (r.k === k ? { ...r, [campo]: valor } : r)))
  const quitarIngrediente = (k) => setReceta((l) => l.filter((r) => r.k !== k))

  const marcas = useMemo(
    () => [...new Set(productos.map((x) => x.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [productos]
  )

  // Ingredientes posibles: aislados por las sedes donde se maneja este plato (nunca cruza stock de otras tiendas)
  const candidatos = useMemo(() => {
    const idsEnReceta = new Set(receta.map((r) => r.insumoId).filter(Boolean))
    const sedesActivasPlato = sucursales.filter((s) => manejada[s.id]).map((s) => s.id)
    const sedesFiltro =
      sedesActivasPlato.length > 0
        ? sedesActivasPlato
        : sucursalInicial !== "todas"
          ? [sucursalInicial]
          : []

    return productos
      .filter((x) => {
        if (x.activo === false || x.tipoItem === "preparado" || x.id === p?.id) return false
        if (idsEnReceta.has(x.id)) return true
        if (sedesFiltro.length > 0) {
          return sedesFiltro.some((sid) => typeof x.stock?.[sid] === "number")
        }
        return x.tipoItem === "insumo"
      })
      .sort(
        (a, b) =>
          (a.tipoItem === "insumo" ? 0 : 1) - (b.tipoItem === "insumo" ? 0 : 1) ||
          a.nombre.localeCompare(b.nombre, "es")
      )
  }, [productos, p, manejada, sucursales, sucursalInicial, receta])

  const mapaProductos = useMemo(() => new Map(productos.map((x) => [x.id, x])), [productos])

  // ---------- ¿Hay cambios sin guardar? ----------
  const huellaImagen = f.imagenUrl
    ? `${f.imagenUrl.length}:${f.imagenUrl.slice(0, 40)}:${f.imagenUrl.slice(-40)}`
    : ""
  const huella = JSON.stringify([
    { ...f, imagenUrl: huellaImagen },
    manejada,
    cantidades,
    categoriaOtra,
    receta.map((r) => [r.insumoId, r.cantidad]),
  ])
  const [huellaInicial] = useState(huella) // foto del formulario al abrirlo
  const hayCambios = huella !== huellaInicial
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const solicitarCierre = () => (hayCambios ? setConfirmarSalida(true) : onCerrar())

  // El contenedor (X, Esc, clic afuera) pregunta aquí antes de cerrar
  useEffect(() => {
    cierreRef.current = solicitarCierre
    return () => {
      cierreRef.current = null
    }
  })

  // ---------- Cálculos en vivo ----------
  const nombreUnificado = construirNombreUnificado({
    nombre: f.nombre.trim(),
    marca: f.marca.trim(),
    presentacion: f.presentacion.trim(),
  })
  const precioN = f.precio === "" ? (esInsumo ? 0 : null) : Number(f.precio)
  const costoN = f.costoCompra === "" ? 0 : Number(f.costoCompra)
  const minimoN = f.stockMinimo === "" ? NaN : Number(f.stockMinimo)
  const utilidad = precioN !== null && Number.isFinite(precioN) ? precioN - costoN : null
  const margen = utilidad !== null && precioN > 0 ? (utilidad / precioN) * 100 : null
  const perdida = !esInsumo && utilidad !== null && utilidad < 0

  // Rendimiento y calculadora (insumo)
  const rendN = f.rendimiento === "" ? 1 : Number(f.rendimiento)
  const compradasN = Number(compradas)
  const totalPorciones =
    Number.isFinite(compradasN) && compradasN > 0 && rendN > 0 ? Math.floor(compradasN * rendN) : 0
  const sedesManejadas = sucursales.filter((s) => manejada[s.id])
  const sedeCalc = sedesManejadas.find((s) => s.id === sedeCalcId) ?? sedesManejadas[0] ?? null

  // Sugerencia de receta (plato preparado): solo guía, nunca bloquea
  const recetaValida = receta
    .filter((r) => r.insumoId && Number(r.cantidad) > 0)
    .map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) }))
  const sugerencia = esPreparado
    ? sugerirCalculoReceta({ receta: recetaValida }, mapaProductos, sucursalInicial)
    : null

  // ---------- Validaciones ----------
  const barras = f.codigoBarras.trim()
  const errores = {
    nombre: f.nombre.trim() ? "" : "El nombre es obligatorio",
    precio:
      precioN === null || !Number.isFinite(precioN) || precioN < 0
        ? "Escribe un precio válido (0 o más)"
        : "",
    costo: !Number.isFinite(costoN) || costoN < 0 ? "El costo no puede ser negativo" : "",
    minimo: !Number.isInteger(minimoN) || minimoN < 0 ? "Escribe un entero de 0 o más" : "",
    rendimiento:
      esInsumo && (!Number.isFinite(rendN) || rendN <= 0) ? "Debe ser mayor a 0" : "",
    barras:
      barras && productos.some((x) => x.id !== p?.id && x.codigoBarras === barras)
        ? "Ya existe otro producto con este código"
        : "",
  }
  const erroresStock = {}
  for (const s of sucursales) {
    if (!manejada[s.id]) continue
    const n = cantidades[s.id] === "" ? NaN : Number(cantidades[s.id])
    if (!Number.isInteger(n) || n < 0) erroresStock[s.id] = "Entero de 0 o más"
  }
  const hayErrores = Object.values(errores).some(Boolean) || Object.keys(erroresStock).length > 0
  const ver = (msg) => (intentado ? msg : "")

  // ---------- Foto ----------
  const subirArchivo = (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ""
    if (!archivo) return
    if (!archivo.type.startsWith("image/")) return toast.error("El archivo debe ser una imagen")
    if (archivo.size > MAX_FOTO) return toast.error("La imagen supera 2 MB. Elige una más liviana")
    const lector = new FileReader()
    lector.onload = () => set("imagenUrl", String(lector.result))
    lector.onerror = () => toast.error("No se pudo leer la imagen")
    lector.readAsDataURL(archivo)
  }

  // ---------- Guardar ----------
  const guardar = () => {
    setIntentado(true)
    setConfirmarSalida(false)
    if (hayErrores) {
      toast.error("Revisa los campos marcados en rojo")
      return
    }

    // Conserva claves de sedes que no aparecen en la lista; ajusta las listadas
    const stock = { ...(p?.stock ?? {}) }
    for (const s of sucursales) {
      if (manejada[s.id]) stock[s.id] = Math.floor(Number(cantidades[s.id]))
      else delete stock[s.id]
    }

    const datos = {
      id: p?.id,
      nombre: f.nombre.trim(),
      marca: f.marca.trim(),
      presentacion: f.presentacion.trim(),
      categoria: f.categoria.trim(),
      precio: precioN,
      costoCompra: costoN,
      codigoBarras: barras,
      icono: f.icono,
      imagenUrl: imagenEfectiva || null,
      stockMinimo: minimoN,
      tipoItem: f.tipoItem,
      rendimiento: rendN,
      receta: esPreparado ? recetaValida : [],
      stock,
    }

    // Escritura protegida: el cajero necesita el PIN de administrador
    solicitarAutorizacion(() => {
      try {
        const guardado = guardarProducto(datos)
        toast.success(
          p
            ? `Producto actualizado: ${guardado.nombreUnificado}`
            : `Producto creado: ${guardado.nombreUnificado}`
        )
        onCerrar()
      } catch (err) {
        toast.error(err.message || "No se pudo guardar el producto")
      }
    })
  }

  const chips = presentacionesParaGremio(tipo)

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      {/* Cabecera fija */}
      <DialogHeader className="shrink-0 border-b p-4 pr-12 sm:p-6 sm:pr-12">
        <DialogTitle>{p ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        <DialogDescription>
          {p
            ? "Actualiza los datos del producto y el stock de cada sede."
            : "Crea un producto del catálogo y asígnalo a las sedes donde se vende."}
        </DialogDescription>
      </DialogHeader>

      {/* Cuerpo deslizable */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {/* Vista previa en vivo */}
        <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-4">
          <MiniaturaProducto
            imagenUrl={imagenEfectiva}
            icono={f.icono}
            className="h-16 w-16"
            iconClassName="h-8 w-8"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Así se verá
            </p>
            <p className="truncate font-bold">{nombreUnificado || "Nombre del producto"}</p>
            <span className="mt-1 inline-flex rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
              {f.categoria.trim() || "Sin categoría"}
            </span>
          </div>
          {esInsumo ? (
            <p className="shrink-0 text-sm font-bold text-muted-foreground">Uso interno</p>
          ) : (
            <p className="cifra shrink-0 text-lg font-bold">
              {formatCOP(precioN !== null && Number.isFinite(precioN) ? precioN : 0)}
            </p>
          )}
        </div>

        {mostrarTipos && (
          <Seccion titulo="Tipo de producto">
            <div className="grid gap-3 sm:grid-cols-3">
              {OPCIONES_TIPO.map(({ id, icon: Icono }) => {
                const activo = f.tipoItem === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => cambiarTipo(id)}
                    className={cn(
                      "flex min-w-0 flex-col gap-2 rounded-xl border-2 p-3 text-left transition-colors",
                      activo ? "border-primary bg-primary-500/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-fit rounded-lg p-2",
                        activo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icono className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-bold">{TIPOS_ITEM[id].label}</span>
                    <span className="text-xs text-muted-foreground">{TIPOS_ITEM[id].descripcion}</span>
                  </button>
                )
              })}
            </div>
          </Seccion>
        )}

        {/* Identidad */}
        <Seccion titulo="Identidad del producto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre base" error={ver(errores.nombre)}>
              <Input value={f.nombre} onChange={onInput("nombre")} placeholder="Ej. Arroz blanco" autoFocus />
            </Campo>
            <Campo etiqueta="Marca" opcional>
              <Input
                value={f.marca}
                onChange={onInput("marca")}
                placeholder="Ej. Orquídea, De la casa"
                list="marcas-sugeridas"
              />
              <datalist id="marcas-sugeridas">
                {marcas.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Campo>
          </div>

          <div className="min-w-0 space-y-2">
            <Campo etiqueta="Presentación / Medida" opcional>
              <Input
                value={f.presentacion}
                onChange={onInput("presentacion")}
                placeholder="Ej. 1kg, Panal x30, Combo"
              />
            </Campo>
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={f.presentacion === c}
                  onClick={() => set("presentacion", c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    f.presentacion === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <span className="text-sm font-semibold">Categoría</span>
              <Select
                value={categoriaOtra ? OTRA : f.categoria}
                onValueChange={(v) => {
                  if (v === OTRA) {
                    setCategoriaOtra(true)
                    set("categoria", "")
                  } else {
                    setCategoriaOtra(false)
                    set("categoria", v)
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-label="Categoría">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTRA}>Otra…</SelectItem>
                </SelectContent>
              </Select>
              {!categoriaOtra && !f.categoria && (
                <p className="text-xs text-muted-foreground">Si no eliges, se guarda como “Otros”.</p>
              )}
            </div>
            {categoriaOtra && (
              <Campo etiqueta="Nombre de la categoría">
                <Input value={f.categoria} onChange={onInput("categoria")} placeholder="Ej. Mascotas" />
              </Campo>
            )}
          </div>
        </Seccion>

        {/* Precios */}
        <Seccion titulo={esInsumo ? "Costo de compra y código" : "Precios, rentabilidad y código"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Costo de compra (COP)" error={ver(errores.costo)}>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={f.costoCompra}
                onChange={onInput("costoCompra")}
                placeholder="0"
                className="cifra"
              />
            </Campo>
            {!esInsumo && (
            <Campo etiqueta="Precio de venta (COP)" error={ver(errores.precio)}>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={f.precio}
                onChange={onInput("precio")}
                placeholder="0"
                className="cifra"
              />
            </Campo>
            )}
          </div>

          <div
            className={cn(
              "grid grid-cols-2 gap-3 rounded-xl border p-3",
              perdida ? "border-red-500/40 bg-red-500/10" : "bg-muted/40",
              esInsumo && "hidden"
            )}
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Utilidad unitaria</p>
              <p className={cn("cifra text-lg font-bold", perdida && "text-red-600 dark:text-red-400")}>
                {utilidad === null ? "—" : formatCOP(utilidad)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Margen</p>
              <p className={cn("cifra text-lg font-bold", perdida && "text-red-600 dark:text-red-400")}>
                {margen === null ? "—" : pct(margen)}
              </p>
            </div>
            {perdida && (
              <p className="col-span-2 flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                <TrendingDown className="h-4 w-4 shrink-0" />
                El precio es menor al costo: venderías con pérdida.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Código de barras / SKU" opcional error={ver(errores.barras)}>
              <Input
                value={f.codigoBarras}
                onChange={onInput("codigoBarras")}
                placeholder="Escanea o escribe el código"
                className="cifra"
              />
            </Campo>
            <Campo
              etiqueta="Stock mínimo de alerta"
              error={ver(errores.minimo)}
              ayuda="Avisamos cuando las unidades lleguen a este número."
            >
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={f.stockMinimo}
                onChange={onInput("stockMinimo")}
                className="cifra"
              />
            </Campo>
          </div>
        </Seccion>

        {/* Rendimiento (insumo) */}
        {esInsumo && (
          <Seccion titulo="Rendimiento del insumo (opcional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Rendimiento por unidad"
                error={ver(errores.rendimiento)}
                ayuda="¿Cuántas porciones salen de 1 unidad o paquete? Déjalo en 1 si no aplica."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={f.rendimiento}
                  onChange={onInput("rendimiento")}
                  className="cifra"
                />
              </Campo>
              <div className="min-w-0 space-y-1 rounded-xl border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Costo por porción</p>
                <p className="cifra text-lg font-bold">
                  {formatCOP(Number.isFinite(costoN) && rendN > 0 ? costoN / rendN : 0)}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Calculator className="h-4 w-4 text-primary-600" />
                Calculadora rápida
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Compré</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  aria-label="Unidades o paquetes comprados"
                  value={compradas}
                  onChange={(e) => setCompradas(e.target.value)}
                  className="cifra w-24"
                />
                <span>× salen</span>
                <span className="cifra font-bold">{Number.isFinite(rendN) ? rendN : 0}</span>
                <span>de cada uno =</span>
                <span className="cifra text-lg font-bold">{totalPorciones}</span>
                <span>porciones</span>
              </div>

              {totalPorciones > 0 && sedeCalc && (
                <div className="flex flex-wrap items-center gap-2">
                  {sedesManejadas.length > 1 && (
                    <Select value={sedeCalc.id} onValueChange={setSedeCalcId}>
                      <SelectTrigger className="w-44" aria-label="Sede donde aplicar el resultado">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sedesManejadas.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCantidades((c) => ({ ...c, [sedeCalc.id]: String(totalPorciones) }))}
                  >
                    Poner {totalPorciones} como stock en {sedeCalc.nombre}
                  </Button>
                </div>
              )}
              {totalPorciones > 0 && !sedeCalc && (
                <p className="text-xs text-muted-foreground">
                  Activa una sede en “Stock por sucursal” para aplicar este resultado.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Con rendimiento mayor a 1, el stock de este insumo se cuenta en porciones.
              </p>
            </div>
          </Seccion>
        )}

        {/* Receta sugerida (plato / cóctel preparado) */}
        {esPreparado && (
          <Seccion titulo="Receta sugerida de insumos (Opcional · Configurable a tu medida)">
            <div className="space-y-2.5">
              {receta.map((r) => {
                const ins = mapaProductos.get(r.insumoId)
                const cant = Number(r.cantidad)
                const rendIns = ins && Number(ins.rendimiento) > 1 ? Number(ins.rendimiento) : 1
                const costoUnit = ins ? (Number(ins.costoCompra) || 0) / rendIns : 0
                const subtotal = cant > 0 ? Math.round(costoUnit * cant) : 0

                return (
                  <div key={r.k} className="space-y-1 rounded-lg border bg-muted/20 p-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={r.insumoId}
                          onValueChange={(v) => cambiarIngrediente(r.k, "insumoId", v)}
                        >
                          <SelectTrigger className="w-full" aria-label="Insumo">
                            <SelectValue placeholder="Elige un insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {candidatos.map((x) => (
                              <SelectItem key={x.id} value={x.id}>
                                {x.nombreUnificado}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        aria-label="Cantidad por plato"
                        value={r.cantidad}
                        onChange={(e) => cambiarIngrediente(r.k, "cantidad", e.target.value)}
                        className="cifra w-20 text-right"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar insumo"
                        onClick={() => quitarIngrediente(r.k)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {ins && (
                      <p className="px-1 text-[11px] text-muted-foreground">
                        {rendIns > 1 ? (
                          <>
                            Paquete <span className="cifra">{formatCOP(ins.costoCompra)}</span> ÷ rinde{" "}
                            <span className="cifra">{rendIns}</span> ={" "}
                            <span className="cifra font-semibold text-foreground">
                              {formatCOP(Math.round(costoUnit))}
                            </span>{" "}
                            por porción
                          </>
                        ) : (
                          <>
                            Costo por unidad:{" "}
                            <span className="cifra font-semibold text-foreground">
                              {formatCOP(ins.costoCompra)}
                            </span>
                          </>
                        )}
                        {cant > 0 && (
                          <>
                            {" · "}Subtotal (×<span className="cifra">{cant}</span>):{" "}
                            <span className="cifra font-semibold text-foreground">{formatCOP(subtotal)}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )
              })}
              <Button type="button" variant="outline" onClick={agregarIngrediente}>
                <Plus className="h-4 w-4" />
                Agregar insumo
              </Button>
              <p className="text-xs text-muted-foreground">
                La cantidad es cuántas unidades (o porciones) gasta cada plato. Las filas incompletas se ignoran.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-primary-500/30 bg-primary-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Lightbulb className="h-4 w-4 text-primary-600" />
                Costo sugerido según la receta
              </p>
              {sugerencia ? (
                <>
                  <p className="text-sm">
                    Costo estimado de preparar 1 unidad:{" "}
                    <span className="cifra font-bold">{formatCOP(sugerencia.costoSugerido)}</span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => set("costoCompra", String(sugerencia.costoSugerido))}
                  >
                    Usar costo sugerido
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Agrega insumos arriba para calcular el costo estimado de preparar 1 plato.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Es solo una guía: el costo y el precio que escribas arriba siempre mandan.
              </p>
            </div>
          </Seccion>
        )}

        {/* Imagen */}
        <Seccion titulo="Imagen del producto">
          <div role="group" aria-label="Tipo de imagen" className="inline-flex rounded-lg border bg-card p-1">
            {[
              { id: "icono", label: "Icono", icon: LayoutGrid },
              { id: "foto", label: "Foto (opcional)", icon: Camera },
            ].map(({ id, label, icon: Icono }) => (
              <button
                key={id}
                type="button"
                aria-pressed={modoImagen === id}
                onClick={() => setModoImagen(id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  modoImagen === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icono className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {modoImagen === "icono" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Interruptor
                  activo={verTodos}
                  onChange={setVerTodos}
                  etiqueta="Ver todos los iconos del catálogo"
                />
                <span className="text-sm font-medium">Ver los {ICONOS_CATALOGO.length} iconos</span>
              </div>

              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                {iconos.map(({ id, label, icon: Icono }) => {
                  const activo = f.icono === id
                  return (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={activo}
                      onClick={() => set("icono", id)}
                      className={cn(
                        "flex aspect-square min-w-0 items-center justify-center rounded-xl border-2 transition-colors",
                        activo
                          ? "border-primary bg-primary-500/10 text-primary-600"
                          : "border-transparent bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <Icono className="h-5 w-5" />
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                Seleccionado: <strong className="text-foreground">{iconoSeleccionado?.label ?? "Producto general"}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Campo etiqueta="URL de la imagen">
                <Input
                  type="url"
                  value={esDataUrl ? "" : f.imagenUrl}
                  onChange={onInput("imagenUrl")}
                  placeholder="https://…/foto.jpg"
                />
              </Campo>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={archivoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={subirArchivo}
                />
                <Button type="button" variant="outline" onClick={() => archivoRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Subir desde el dispositivo
                </Button>
                {f.imagenUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      set("imagenUrl", "")
                      setModoImagen("icono")
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar foto y volver al icono
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {esDataUrl
                  ? "Foto cargada desde tu dispositivo (máx. 2 MB). "
                  : "Si la foto no carga, se mostrará el icono. "}
                En la versión real se guardará en Supabase Storage.
              </p>
            </div>
          )}
        </Seccion>

        {/* Stock por sucursal */}
        <Seccion titulo={esPreparado ? "Porciones listas por sede (opcional)" : "Stock por sucursal"}>
          {esPreparado && (
            <p className="text-xs text-muted-foreground">
              Actívalo solo si cocinas por lotes (ej. “hoy saqué 20 porciones de costillas BBQ”). Si no,
              guíate por la sugerencia de insumos.
            </p>
          )}
          <div className="space-y-2">
            {sucursales.map((s) => (
              <div key={s.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <Interruptor
                    activo={manejada[s.id] ?? false}
                    onChange={(v) => setManejada((m) => ({ ...m, [s.id]: v }))}
                    etiqueta={`Se maneja en ${s.nombre}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.nombre}
                      {s.activa === false && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(inactiva)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {manejada[s.id] ? "Se maneja en esta sede" : "No se maneja en esta sede"}
                    </p>
                  </div>
                  {manejada[s.id] && (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      aria-label={`Unidades en ${s.nombre}`}
                      value={cantidades[s.id] ?? ""}
                      onChange={(e) => setCantidades((c) => ({ ...c, [s.id]: e.target.value }))}
                      className="cifra w-24 text-right"
                    />
                  )}
                </div>
                {intentado && erroresStock[s.id] && (
                  <p role="alert" className="mt-2 text-right text-xs font-medium text-destructive">
                    {erroresStock[s.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Las sedes que no manejan el producto no generan alertas de stock.
          </p>
        </Seccion>
      </div>

      {/* Pie fijo */}
      {confirmarSalida ? (
        <div
          role="alertdialog"
          aria-label="Cambios sin guardar"
          className="flex shrink-0 flex-col gap-3 border-t bg-amber-500/10 p-4 sm:p-6"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            Tienes cambios sin guardar. ¿Qué deseas hacer?
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmarSalida(false)}>
              Seguir editando
            </Button>
            <Button type="button" variant="outline" className="text-destructive" onClick={onCerrar}>
              Salir sin guardar
            </Button>
            <Button type="button" className={CTA} onClick={guardar}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" variant="outline" onClick={solicitarCierre}>
            Cancelar
          </Button>
          <Button type="submit" className={CTA}>
            {p ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------
// Modal
//   abierto:         boolean
//   producto:        null (crear) o el producto a editar
//   sucursalInicial: "todas" o id de sede; define en qué sedes arranca activo un producto nuevo
// ---------------------------------------------------------------------
export default function ProductFormModal({
  abierto,
  onCerrar,
  producto = null,
  sucursalInicial = "todas",
}) {
  const cierreRef = useRef(null)

  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (o) return
        // X, Esc o clic afuera: el formulario decide si pregunta antes de cerrar
        if (cierreRef.current) cierreRef.current()
        else onCerrar()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <Formulario
          producto={producto}
          sucursalInicial={sucursalInicial}
          onCerrar={onCerrar}
          cierreRef={cierreRef}
        />
      </DialogContent>
    </Dialog>
  )
}