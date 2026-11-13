import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeDollarSign,
  Camera,
  Check,
  Hammer,
  KeyRound,
  Moon,
  Package,
  Receipt,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Sun,
  UtensilsCrossed,
  Users,
  WifiOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePOS, formatCOP } from "@/context/POSContext"
import { AbacoLogo } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const ENLACES = [
  { id: "inicio", label: "Inicio" },
  { id: "quienes-somos", label: "Quiénes somos" },
  { id: "para-que-sirve", label: "¿Para qué sirve?" },
]

const METODOS = {
  efectivo: { label: "Efectivo en cajas", punto: "bg-accent-500" },
  nequi: { label: "Total en Nequi", punto: "bg-secondary-500" },
  fiado: { label: "Fiado por cobrar", punto: "bg-amber-500" },
}

const BARRAS = [48, 62, 55, 78, 70, 92, 84]
const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

// ---------------------------------------------------------------------
// Vista previa animada del dashboard (todo es simulado)
// ---------------------------------------------------------------------
function VistaPrevia() {
  const [caja, setCaja] = useState({ efectivo: 842500, nequi: 513000, fiado: 187000 })
  const [evento, setEvento] = useState(null)
  const [barra, setBarra] = useState(null)

  useEffect(() => {
    let n = 0
    const id = setInterval(() => {
      n += 1
      const metodo = ["efectivo", "nequi", "fiado"][Math.floor(Math.random() * 3)]
      const monto = (Math.floor(Math.random() * 40) + 6) * 1000
      setCaja((c) => ({ ...c, [metodo]: c[metodo] + monto }))
      setEvento({ n, metodo, monto })
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="rounded-2xl border bg-card p-4 shadow-2xl shadow-primary-500/10">
        {/* Barra de ventana */}
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
          <span className="cifra ml-3 rounded-md bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">
            abaco / dashboard
          </span>
        </div>

        {/* Métricas */}
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(METODOS).map(([clave, m]) => (
            <div key={clave} className="rounded-xl border bg-background p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", m.punto)} />
                {m.label}
              </p>
              <p className="cifra mt-1 text-lg font-bold">{formatCOP(caja[clave])}</p>
            </div>
          ))}
        </div>

        {/* Gráfica de barras interactiva */}
        <div className="mt-4 rounded-xl border bg-background p-3">
          <div className="flex items-center justify-between text-xs">
            <p className="font-semibold">Ventas de los últimos 7 días</p>
            <p className="cifra text-muted-foreground">
              {barra !== null ? formatCOP(BARRAS[barra] * 21000) : "Pasa el mouse"}
            </p>
          </div>
          <div className="mt-3 flex h-28 items-end gap-2">
            {BARRAS.map((alto, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ventas del día ${DIAS[i]}`}
                onMouseEnter={() => setBarra(i)}
                onMouseLeave={() => setBarra(null)}
                onFocus={() => setBarra(i)}
                onBlur={() => setBarra(null)}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span
                  className={cn(
                    "w-full rounded-t-md transition-all duration-300",
                    barra === i ? "bg-accent-500" : "bg-primary-500"
                  )}
                  style={{ height: `${alto}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{DIAS[i]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chip: última venta en vivo */}
      {evento && (
        <div
          key={evento.n}
          className="abaco-entrada absolute -bottom-5 left-2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs shadow-lg sm:-left-6"
        >
          <span className={cn("h-2 w-2 rounded-full", METODOS[evento.metodo].punto)} />
          <span className="font-semibold capitalize">{evento.metodo}</span>
          <span className="cifra font-bold">+{formatCOP(evento.monto)}</span>
        </div>
      )}

      {/* Chip flotante: cierre cuadrado */}
      <div className="abaco-flotar absolute -right-2 -top-4 flex items-center gap-2 rounded-xl bg-accent-500 px-3 py-2 text-xs font-bold text-white shadow-lg sm:-right-5">
        <Check className="h-4 w-4" />
        Cierre de caja cuadrado
      </div>
    </div>
  )
}

const NEGOCIOS = [
  { icon: Store, titulo: "Tiendas", texto: "Venta rápida de abarrotes con fiado de confianza." },
  { icon: ShoppingBasket, titulo: "Minimercados", texto: "Varias categorías, alta rotación y varias sedes." },
  { icon: Hammer, titulo: "Ferreterías", texto: "Catálogo grande con códigos de barras y proveedores." },
  { icon: UtensilsCrossed, titulo: "Restaurantes", texto: "Platos y bebidas con cierre de turno exacto." },
]

const MODULOS = [
  {
    icon: ShoppingCart,
    titulo: "Punto de Venta",
    texto: "Cobra en Efectivo, Nequi o Crédito con botones grandes y alto contraste. El stock se descuenta solo.",
  },
  {
    icon: Package,
    titulo: "Inventario y Traslados",
    texto: "Stock por sucursal y traslados entre tiendas en una sola operación, sin tocar el dinero de la caja.",
  },
  {
    icon: KeyRound,
    titulo: "Créditos con PIN",
    texto: "Solo el administrador autoriza clientes. Cada fiado exige el PIN del cliente y confirma su nombre.",
  },
  {
    icon: Users,
    titulo: "Gestión de Cartera",
    texto: "Cada compra fiada es un recibo. Selecciona con checkboxes cuáles deudas se pagan hoy y ve su detalle.",
  },
  {
    icon: Camera,
    titulo: "Proveedores con auditoría",
    texto: "Registra cada pago con la foto de la factura para que el dueño cruce cuentas antes de subir mercancía.",
  },
  {
    icon: Receipt,
    titulo: "Cierres de Caja",
    texto: "Arqueo separado en efectivo y Nequi. El fiado del día se muestra aparte, sin inflar la caja.",
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { usuario, requiereOnboarding, rol, tema, alternarTema } = usePOS()

  const haySesion = Boolean(usuario)
  const destinoPanel = requiereOnboarding ? "/onboarding" : rol === "admin" ? "/dashboard" : "/pos"

  const irA = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes abaco-entrada { from { opacity: 0; transform: translateY(10px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes abaco-flotar { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        .abaco-entrada { animation: abaco-entrada .4s ease-out both }
        .abaco-flotar { animation: abaco-flotar 3.5s ease-in-out infinite }
      `}</style>

      {/* ---------- Header fijo ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a href="#inicio" onClick={(e) => irA(e, "inicio")} className="flex items-center gap-2">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
              <AbacoLogo className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Abaco</span>
          </a>

          <Button onClick={() => navigate(haySesion ? destinoPanel : "/login")}>
            {haySesion ? "Ir a mi Panel" : "Iniciar Sesión"}
          </Button>

          <nav className="mx-auto hidden items-center gap-6 md:flex">
            {ENLACES.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={(e) => irA(e, l.id)}
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Button variant="ghost" size="icon" onClick={alternarTema} aria-label="Cambiar tema">
              {tema === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {!haySesion && (
              <Button
                variant="outline"
                className="hidden sm:inline-flex"
                onClick={() => navigate("/login", { state: { tab: "registro" } })}
              >
                Crear cuenta gratis
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section id="inicio" className="scroll-mt-20 px-4 pb-20 pt-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-600">
                <WifiOff className="h-3.5 w-3.5" />
                Pensado para vender incluso sin internet
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Controla cada <span className="text-primary-500">sucursal</span>, cada{" "}
                <span className="text-accent-600 dark:text-accent-400">peso</span> y cada{" "}
                <span className="text-primary-500">fiado</span>.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Abaco es el punto de venta que cuadra tu caja al centavo: ventas, inventario,
                créditos y proveedores de todas tus tiendas en un solo panel.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="h-12 px-6 text-base"
                  onClick={() =>
                    haySesion
                      ? navigate(destinoPanel)
                      : navigate("/login", { state: { tab: "registro" } })
                  }
                >
                  {haySesion ? "Ir a mi Panel" : "Empezar gratis"}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                {!haySesion && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base"
                    onClick={() => navigate("/login")}
                  >
                    Probar la demo
                  </Button>
                )}
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
                {["Efectivo, Nequi y Crédito", "Multisucursal", "Plan gratis"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <VistaPrevia />
          </div>
        </section>

        {/* ---------- Quiénes somos ---------- */}
        <section id="quienes-somos" className="scroll-mt-20 bg-muted/50 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary-500">Quiénes somos</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Un POS que se adapta a tu negocio, no al revés.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Abaco nace de ver cómo los negocios de barrio llevan sus cuentas entre cuadernos,
              billetes y mensajes de WhatsApp. Creamos una herramienta simple, con botones grandes y
              colores claros, que cualquier persona del equipo aprende a usar en minutos. Es el{" "}
              <strong className="text-foreground">diseño camaleón</strong>: la misma interfaz limpia
              sirve para cualquier tipo de negocio.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {NEGOCIOS.map(({ icon: Icono, titulo, texto }) => (
                <Card key={titulo} className="transition-shadow hover:shadow-lg">
                  <CardContent className="space-y-3 p-5">
                    <div className="inline-flex rounded-xl bg-primary-500/10 p-3 text-primary-600">
                      <Icono className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">{titulo}</h3>
                    <p className="text-sm text-muted-foreground">{texto}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Para qué sirve ---------- */}
        <section id="para-que-sirve" className="scroll-mt-20 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary-500">¿Para qué sirve?</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Seis módulos, una sola verdad contable.
            </h2>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MODULOS.map(({ icon: Icono, titulo, texto }) => (
                <Card key={titulo} className="transition-shadow hover:shadow-lg">
                  <CardContent className="space-y-3 p-6">
                    <div className="inline-flex rounded-xl bg-accent-500/15 p-3 text-accent-700 dark:text-accent-400">
                      <Icono className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">{titulo}</h3>
                    <p className="text-sm text-muted-foreground">{texto}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* La matemática del cierre */}
            <Card className="mt-8 border-primary-500/30 bg-primary-500/5">
              <CardContent className="space-y-4 p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <BadgeDollarSign className="h-6 w-6 text-primary-500" />
                  <h3 className="text-xl font-bold">La matemática exacta del cierre de caja</h3>
                </div>
                <div className="cifra flex flex-wrap items-center gap-x-3 gap-y-2 text-base font-semibold md:text-lg">
                  <span className="rounded-lg bg-card px-3 py-1.5">Ventas en efectivo</span>
                  <span>+</span>
                  <span className="rounded-lg bg-card px-3 py-1.5">Abonos de fiados</span>
                  <span>−</span>
                  <span className="rounded-lg bg-card px-3 py-1.5">Pagos a proveedores</span>
                  <span>=</span>
                  <span className="rounded-lg bg-accent-500 px-3 py-1.5 text-white">Efectivo en el cajón</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Lo mismo para Nequi. Las ventas al fiado no inflan la caja: se muestran aparte como
                  “Total fiado hoy”.
                </p>
              </CardContent>
            </Card>

            {/* Llamado final */}
            <div className="mt-16 rounded-3xl bg-primary p-8 text-center text-primary-foreground md:p-12">
              <ArrowLeftRight className="mx-auto h-8 w-8 opacity-80" />
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
                Pon tu negocio en orden hoy.
              </h2>
              <p className="mx-auto mt-2 max-w-md opacity-90">
                Crea tu cuenta, configura tu primera sucursal en tres pasos y empieza a vender.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="mt-6 h-12 bg-white px-6 text-base text-primary-700 hover:bg-white/90"
                onClick={() =>
                  haySesion
                    ? navigate(destinoPanel)
                    : navigate("/login", { state: { tab: "registro" } })
                }
              >
                {haySesion ? "Ir a mi Panel" : "Crear cuenta gratis"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t bg-muted/40 px-4 pb-8 pt-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                  <AbacoLogo className="h-5 w-5" />
                </span>
                <span className="text-lg font-extrabold">Abaco</span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                POS multisucursal para tiendas, minimercados, ferreterías y restaurantes. Ventas,
                inventario, fiados y cierres de caja en un solo lugar.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold">Producto</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {ENLACES.map((l) => (
                  <li key={l.id}>
                    <a href={`#${l.id}`} onClick={(e) => irA(e, l.id)} className="hover:text-foreground">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold">Acceso</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <button className="hover:text-foreground" onClick={() => navigate("/login")}>
                    Iniciar sesión
                  </button>
                </li>
                <li>
                  <button
                    className="hover:text-foreground"
                    onClick={() => navigate("/login", { state: { tab: "registro" } })}
                  >
                    Crear cuenta gratis
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} Abaco — POS Multisucursal. Todos los derechos reservados.</p>
            <p>Hecho en Colombia</p>
          </div>
        </div>
      </footer>
    </div>
  )
}