import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hammer,
  Loader2,
  Plus,
  ShoppingBasket,
  Sparkles,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS } from "@/context/POSContext"
import { AbacoLogo } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const TIPOS = [
  { valor: "tienda", titulo: "Tienda", desc: "Abarrotes y venta al detal", icon: Store },
  { valor: "minimercado", titulo: "Minimercado", desc: "Varias categorías y alta rotación", icon: ShoppingBasket },
  { valor: "ferreteria", titulo: "Ferretería", desc: "Herramientas, tornillería y materiales", icon: Hammer },
  { valor: "restaurante", titulo: "Restaurante", desc: "Platos, bebidas y consumo en sitio", icon: UtensilsCrossed },
]

const PASOS = ["Negocio", "Sucursal", "Equipo"]

const PIN_VALIDO = /^\d{4,6}$/
const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
const soloDigitos = (v) => v.replace(/\D/g, "").slice(0, 6)

// ---------- Componentes de apoyo (fuera del componente principal para no perder el foco) ----------
function Campo({ etiqueta, opcional, error, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </label>
  )
}

function FilaCajero({ cajero, indice, errores, onCambiar, onQuitar }) {
  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Cajero {indice + 1}</p>
        <Button variant="ghost" size="icon" onClick={onQuitar} aria-label="Quitar cajero">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" error={errores.nombre}>
          <Input value={cajero.nombre} onChange={(e) => onCambiar("nombre", e.target.value)} placeholder="Ej. Pedro Pérez" />
        </Campo>
        <Campo etiqueta="Correo" error={errores.email}>
          <Input type="email" value={cajero.email} onChange={(e) => onCambiar("email", e.target.value)} placeholder="pedro@correo.com" />
        </Campo>
      </div>
      <Campo etiqueta="PIN de seguridad (4 a 6 dígitos)" error={errores.pin}>
        <Input
          inputMode="numeric"
          value={cajero.pin_seguridad}
          onChange={(e) => onCambiar("pin_seguridad", soloDigitos(e.target.value))}
          placeholder="••••"
          className="cifra w-40 tracking-[0.3em]"
        />
      </Campo>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { usuario, completarOnboarding } = usePOS()

  const [paso, setPaso] = useState(1)
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [negocio, setNegocio] = useState({ nombre: "", tipo_negocio: "minimercado" })
  const [sucursal, setSucursal] = useState({ nombre: "Sede Principal", direccion: "", telefono: "" })
  const [pin, setPin] = useState("")
  const [cajeros, setCajeros] = useState([])

  // ---------- Validaciones ----------
  const errNegocio = negocio.nombre.trim().length < 2 ? "Escribe el nombre de tu negocio" : ""
  const errSucursal = {
    nombre: sucursal.nombre.trim().length < 2 ? "Escribe el nombre de la sucursal" : "",
    telefono:
      sucursal.telefono.trim() && !/^[0-9+\s()-]{7,20}$/.test(sucursal.telefono.trim())
        ? "Teléfono no válido"
        : "",
  }
  const errPin = PIN_VALIDO.test(pin) ? "" : "El PIN debe tener de 4 a 6 dígitos"

  const erroresCajero = (c, i) => {
    const correo = c.email.trim().toLowerCase()
    const repetido =
      correo === usuario?.email?.toLowerCase() ||
      cajeros.some((otro, j) => j !== i && otro.email.trim().toLowerCase() === correo)
    return {
      nombre: c.nombre.trim().length < 2 ? "Escribe el nombre" : "",
      email: !esCorreo(c.email) ? "Correo no válido" : repetido ? "Correo repetido" : "",
      pin: PIN_VALIDO.test(c.pin_seguridad) ? "" : "PIN de 4 a 6 dígitos",
    }
  }
  const hayErrorCajeros = cajeros.some((c, i) => Object.values(erroresCajero(c, i)).some(Boolean))

  // ---------- Navegación entre pasos ----------
  const siguiente = () => {
    if (paso === 1 && errNegocio) return setMostrarErrores(true)
    if (paso === 2 && (errSucursal.nombre || errSucursal.telefono)) return setMostrarErrores(true)
    setMostrarErrores(false)
    setPaso((p) => p + 1)
  }

  const atras = () => {
    setMostrarErrores(false)
    setPaso((p) => p - 1)
  }

  const finalizar = async () => {
    if (errPin || hayErrorCajeros) return setMostrarErrores(true)
    setEnviando(true)
    try {
      await completarOnboarding({
        negocio,
        sucursal,
        pinSeguridad: pin,
        cajeros: cajeros.map(({ nombre, email, pin_seguridad }) => ({ nombre, email, pin_seguridad })),
      })
      toast.success(`¡Listo! ${negocio.nombre.trim()} ya está configurado`)
      navigate("/dashboard")
    } catch (err) {
      toast.error(err.message || "No se pudo completar la configuración")
      setEnviando(false)
    }
  }

  const agregarCajero = () =>
    setCajeros((l) => [...l, { key: crypto.randomUUID?.() ?? String(Date.now() + l.length), nombre: "", email: "", pin_seguridad: "" }])
  const cambiarCajero = (i, campo, valor) =>
    setCajeros((l) => l.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))
  const quitarCajero = (i) => setCajeros((l) => l.filter((_, j) => j !== i))

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Marca */}
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <AbacoLogo className="h-7 w-7" />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none tracking-tight">Configura tu negocio</p>
            <p className="mt-1 text-sm text-muted-foreground">Tres pasos y empiezas a vender.</p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <ol className="mb-6 flex items-center gap-2">
          {PASOS.map((nombre, i) => {
            const n = i + 1
            const hecho = paso > n
            const actual = paso === n
            return (
              <li key={nombre} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    hecho || actual ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {hecho ? <Check className="h-4 w-4" /> : n}
                </span>
                <span className={cn("hidden text-sm font-semibold sm:inline", actual ? "text-foreground" : "text-muted-foreground")}>
                  {nombre}
                </span>
                {n < PASOS.length && <span className="h-px flex-1 bg-border" />}
              </li>
            )
          })}
        </ol>

        <Card>
          {/* ---------- Paso 1: negocios ---------- */}
          {paso === 1 && (
            <>
              <CardHeader>
                <CardTitle>Cuéntanos sobre tu negocio</CardTitle>
                <CardDescription>Adaptamos la interfaz según el tipo de negocio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Campo etiqueta="Nombre del negocio" error={mostrarErrores ? errNegocio : ""}>
                  <Input
                    value={negocio.nombre}
                    onChange={(e) => setNegocio((n) => ({ ...n, nombre: e.target.value }))}
                    placeholder="Ej. Minimercado La Esquina"
                    autoFocus
                  />
                </Campo>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Tipo de negocio</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {TIPOS.map(({ valor, titulo, desc, icon: Icono }) => {
                      const activo = negocio.tipo_negocio === valor
                      return (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setNegocio((n) => ({ ...n, tipo_negocio: valor }))}
                          aria-pressed={activo}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                            activo
                              ? "border-primary bg-primary-500/10"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <span className={cn("rounded-lg p-2", activo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            <Icono className="h-5 w-5" />
                          </span>
                          <span>
                            <span className="block font-bold">{titulo}</span>
                            <span className="block text-xs text-muted-foreground">{desc}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-accent-500/15 p-4 text-sm">
                  <Sparkles className="h-5 w-5 shrink-0 text-accent-700 dark:text-accent-400" />
                  <p>
                    <strong>Plan Gratis Activo</strong> • Próximamente funciones Pro con IA
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* ---------- Paso 2: sucursales ---------- */}
          {paso === 2 && (
            <>
              <CardHeader>
                <CardTitle>Tu primera sucursal</CardTitle>
                <CardDescription>Después podrás agregar más sedes desde “Sucursales y Equipo”.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Campo etiqueta="Nombre de la sucursal" error={mostrarErrores ? errSucursal.nombre : ""}>
                  <Input
                    value={sucursal.nombre}
                    onChange={(e) => setSucursal((s) => ({ ...s, nombre: e.target.value }))}
                    placeholder="Ej. Sede Principal"
                    autoFocus
                  />
                </Campo>
                <Campo etiqueta="Dirección" opcional>
                  <Input
                    value={sucursal.direccion}
                    onChange={(e) => setSucursal((s) => ({ ...s, direccion: e.target.value }))}
                    placeholder="Ej. Calle 10 #20-30"
                  />
                </Campo>
                <Campo etiqueta="Teléfono" opcional error={mostrarErrores ? errSucursal.telefono : ""}>
                  <Input
                    type="tel"
                    value={sucursal.telefono}
                    onChange={(e) => setSucursal((s) => ({ ...s, telefono: e.target.value }))}
                    placeholder="Ej. 300 123 4567"
                  />
                </Campo>
              </CardContent>
            </>
          )}

          {/* ---------- Paso 3: usuarios ---------- */}
          {paso === 3 && (
            <>
              <CardHeader>
                <CardTitle>Tu equipo</CardTitle>
                <CardDescription>
                  El PIN te permite usar funciones de administrador sin cerrar la sesión de la tienda.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Administrador */}
                <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
                  <p className="text-sm font-bold">Administrador (tú)</p>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="font-semibold">{usuario?.nombre}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Correo</p>
                      <p className="truncate font-semibold">{usuario?.email}</p>
                    </div>
                  </div>
                  <Campo etiqueta="Tu PIN de seguridad (4 a 6 dígitos)" error={mostrarErrores ? errPin : ""}>
                    <Input
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(soloDigitos(e.target.value))}
                      placeholder="••••"
                      className="cifra w-40 text-lg tracking-[0.3em]"
                    />
                  </Campo>
                </div>

                {/* Cajeros */}
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold">
                      Cajeros iniciales <span className="font-normal text-muted-foreground">(opcional)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Puedes omitir este paso y crearlos después en el módulo “Sucursales y Equipo”.
                    </p>
                  </div>

                  {cajeros.map((c, i) => (
                    <FilaCajero
                      key={c.key}
                      cajero={c}
                      indice={i}
                      errores={mostrarErrores ? erroresCajero(c, i) : {}}
                      onCambiar={(campo, valor) => cambiarCajero(i, campo, valor)}
                      onQuitar={() => quitarCajero(i)}
                    />
                  ))}

                  <Button type="button" variant="outline" onClick={agregarCajero}>
                    <Plus className="h-4 w-4" />
                    Agregar cajero
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Botones */}
          <div className="flex items-center justify-between gap-3 border-t p-4 md:p-6">
            {paso > 1 ? (
              <Button variant="ghost" onClick={atras} disabled={enviando}>
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : (
              <span />
            )}

            {paso < 3 ? (
              <Button onClick={siguiente}>
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finalizar} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {cajeros.length === 0 ? "Omitir cajeros y finalizar" : "Finalizar configuración"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}