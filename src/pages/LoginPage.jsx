import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, ShoppingCart, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { usePOS } from "@/context/POSContext"
import { rutaInicial } from "@/config/navigation"
import { AbacoLogo } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const DEMOS = [
  {
    tipo: "nuevo",
    icon: UserPlus,
    titulo: "Dueño Nuevo (Probar Onboarding)",
    detalle: "Configura un negocio desde cero → /onboarding",
  },
  {
    tipo: "admin",
    icon: ShieldCheck,
    titulo: "Administrador Demo",
    detalle: "Panel completo con datos → /dashboard",
  },
  {
    tipo: "cajero",
    icon: ShoppingCart,
    titulo: "Cajero Demo (Tienda 1)",
    detalle: "Vista operativa de caja → /pos",
  },
]

const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, registro, loginDemo } = usePOS()

  const [tab, setTab] = useState(location.state?.tab === "registro" ? "registro" : "login")
  const [form, setForm] = useState({ nombre: "", email: "", password: "" })
  const [verPass, setVerPass] = useState(false)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }))
    setError("")
  }

  const validar = (modo) => {
    if (modo === "registro" && form.nombre.trim().length < 2) return "Escribe tu nombre completo"
    if (!esCorreo(form.email)) return "El correo no tiene un formato válido"
    if (form.password.length < 6) return "La contraseña debe tener mínimo 6 caracteres"
    return ""
  }

  const enviar = async (e, modo) => {
    e.preventDefault()
    const mensaje = validar(modo)
    if (mensaje) {
      setError(mensaje)
      return
    }
    setCargando(true)
    try {
      if (modo === "login") {
        const res = await login({ email: form.email, password: form.password })
        navigate(res.requiereOnboarding ? "/onboarding" : rutaInicial(res.usuario.rol))
      } else {
        await registro({ nombre: form.nombre, email: form.email, password: form.password })
        toast.success("Cuenta creada. Ahora configura tu negocio")
        navigate("/onboarding")
      }
    } catch (err) {
      setError(err.message || "No se pudo completar la solicitud")
    } finally {
      setCargando(false)
    }
  }

  const entrarDemo = async (tipo) => {
    setCargando(true)
    try {
      const res = await loginDemo(tipo)
      navigate(res.requiereOnboarding ? "/onboarding" : rutaInicial(res.usuario.rol))
    } catch (err) {
      setError(err.message)
      setCargando(false)
    }
  }

  // No es un componente (es una función) para que los inputs no pierdan el foco al escribir
  const renderFormulario = (modo) => (
    <form onSubmit={(e) => enviar(e, modo)} className="space-y-4" noValidate>
      {modo === "registro" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Nombre completo</span>
          <Input
            value={form.nombre}
            onChange={cambiar("nombre")}
            placeholder="Ej. Laura Gómez"
            autoComplete="name"
          />
        </label>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Correo electrónico</span>
        <Input
          type="email"
          value={form.email}
          onChange={cambiar("email")}
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Contraseña</span>
        <div className="relative">
          <Input
            type={verPass ? "text" : "password"}
            value={form.password}
            onChange={cambiar("password")}
            placeholder="Mínimo 6 caracteres"
            autoComplete={modo === "login" ? "current-password" : "new-password"}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setVerPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <p role="alert" className="min-h-5 text-sm font-medium text-destructive">
        {error}
      </p>

      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={cargando}>
        {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
        {modo === "login" ? "Entrar" : "Crear cuenta y continuar"}
      </Button>
    </form>
  )

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Button>

        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <AbacoLogo className="h-7 w-7" />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none tracking-tight">Abaco</p>
            <p className="mt-1 text-sm text-muted-foreground">POS Multisucursal</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bienvenido</CardTitle>
            <CardDescription>Accede a tu panel o crea tu cuenta gratis.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v)
                setError("")
              }}
            >
              <TabsList className="mb-5 grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="registro">Crear Cuenta</TabsTrigger>
              </TabsList>
              <TabsContent value="login">{renderFormulario("login")}</TabsContent>
              <TabsContent value="registro">{renderFormulario("registro")}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Accesos rápidos demo */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            Accesos rápidos demo
            <span className="h-px flex-1 bg-border" />
          </div>

          {DEMOS.map(({ tipo, icon: Icono, titulo, detalle }) => (
            <button
              key={tipo}
              type="button"
              disabled={cargando}
              onClick={() => entrarDemo(tipo)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary-500/5 disabled:opacity-60"
            >
              <span className="rounded-lg bg-primary-500/10 p-2.5 text-primary-600">
                <Icono className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{detalle}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}