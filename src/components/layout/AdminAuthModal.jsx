import { useCallback, useEffect, useState } from "react"
import { Delete, Lock, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePOS, PIN_ADMIN_DEMO } from "@/context/POSContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const LARGO_MIN = 4
const LARGO_MAX = 6
const MAX_INTENTOS = 3
const CLAVE_BLOQUEO = "abaco_pin_lock"

const leerBloqueo = () => {
  try {
    const raw = sessionStorage.getItem(CLAVE_BLOQUEO)
    return raw ? JSON.parse(raw) : { intentos: 0, bloqueadoHasta: 0, nivel: 0 }
  } catch {
    return { intentos: 0, bloqueadoHasta: 0, nivel: 0 }
  }
}

const guardarBloqueo = (estado) => {
  try {
    sessionStorage.setItem(CLAVE_BLOQUEO, JSON.stringify(estado))
  } catch {
    /* sin sessionStorage */
  }
}

export default function AdminAuthModal() {
  const {
    modalAdminAbierto,
    tieneAccionPendiente,
    cerrarModalAdmin,
    validarPinAdmin,
    negocio,
  } = usePOS()

  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [seguridad, setSeguridad] = useState(leerBloqueo)
  const [segundosBloqueo, setSegundosBloqueo] = useState(0)

  const bloqueado = segundosBloqueo > 0
  const hayAccion = tieneAccionPendiente()

  // Cuenta regresiva del bloqueo anti-fuerza bruta
  useEffect(() => {
    const actualizar = () => {
      const rest = Math.max(0, Math.ceil((seguridad.bloqueadoHasta - Date.now()) / 1000))
      setSegundosBloqueo(rest)
    }
    actualizar()
    if (seguridad.bloqueadoHasta <= Date.now()) return
    const id = setInterval(actualizar, 1000)
    return () => clearInterval(id)
  }, [seguridad.bloqueadoHasta])

  // Al cerrar solo limpiamos el PIN digitado, NUNCA el contador de intentos fallidos
  useEffect(() => {
    if (!modalAdminAbierto) {
      setPin("")
      setError("")
    }
  }, [modalAdminAbierto])

  const agregar = useCallback(
    (digito) => {
      if (bloqueado) return
      setError("")
      setPin((p) => (p.length < LARGO_MAX ? p + digito : p))
    },
    [bloqueado]
  )

  const borrar = useCallback(() => {
    if (bloqueado) return
    setPin((p) => p.slice(0, -1))
  }, [bloqueado])

  const confirmar = useCallback(
    (modo = "accion") => {
      if (bloqueado || pin.length < LARGO_MIN) return
      if (validarPinAdmin(pin, modo)) {
        const limpio = { intentos: 0, bloqueadoHasta: 0, nivel: 0 }
        setSeguridad(limpio)
        guardarBloqueo(limpio)
        toast.success(
          modo === "accion"
            ? "Sección desbloqueada para el administrador"
            : "Panel de administrador habilitado"
        )
        return
      }

      const nuevosIntentos = seguridad.intentos + 1
      setPin("")

      if (nuevosIntentos >= MAX_INTENTOS) {
        const nuevoNivel = seguridad.nivel + 1
        const duracionSegundos = nuevoNivel === 1 ? 60 : 300 // 1 min la 1ra vez, 5 min si reincide
        const nuevoEstado = {
          intentos: 0,
          bloqueadoHasta: Date.now() + duracionSegundos * 1000,
          nivel: nuevoNivel,
        }
        setSeguridad(nuevoEstado)
        guardarBloqueo(nuevoEstado)
        setError("")
        toast.error(`PIN bloqueado temporalmente por ${duracionSegundos === 60 ? "1 minuto" : "5 minutos"}`)
        return
      }

      const parcial = { ...seguridad, intentos: nuevosIntentos }
      setSeguridad(parcial)
      guardarBloqueo(parcial)
      setError(`PIN incorrecto. Te quedan ${MAX_INTENTOS - nuevosIntentos} intento(s).`)
    },
    [bloqueado, pin, seguridad, validarPinAdmin]
  )

  useEffect(() => {
    if (!modalAdminAbierto) return
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) agregar(e.key)
      else if (e.key === "Backspace") borrar()
      else if (e.key === "Enter") {
        e.preventDefault()
        confirmar("accion")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modalAdminAbierto, agregar, borrar, confirmar])

  return (
    <Dialog
      open={modalAdminAbierto}
      onOpenChange={(abierto) => {
        if (!abierto) cerrarModalAdmin()
      }}
    >
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              "mb-1 rounded-full p-3",
              bloqueado
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-primary-500/10 text-primary-600"
            )}
          >
            {bloqueado ? <Lock className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <DialogTitle>
            {bloqueado ? "Acceso bloqueado temporalmente" : "Autorización de administrador"}
          </DialogTitle>
          <DialogDescription>
            { hayAccion
              ? "Ingresa el PIN del administrador para autorizar esta acción sin cerrar la caja."
              : "Elige si deseas desbloquear solo esta sección o abrir el panel completo." }
          </DialogDescription>
        </DialogHeader>

        {bloqueado ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm font-medium text-red-600 dark:text-red-400"
          >
            Demasiados intentos fallidos. Espera{" "}
            <span className="cifra font-bold">{segundosBloqueo}s</span> para volver a intentar.
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-3 py-1" aria-label={`${pin.length} dígitos ingresados`}>
              {Array.from({ length: LARGO_MAX }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all",
                    i < pin.length ? "scale-110 border-primary bg-primary" : "border-input"
                  )}
                />
              ))}
            </div>

            <p role="alert" className="min-h-5 text-center text-sm font-medium text-destructive">
              {error}
            </p>
          </>
        )}

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button
              key={d}
              variant="outline"
              disabled={bloqueado}
              className="cifra h-16 text-2xl font-semibold"
              onClick={() => agregar(d)}
            >
              {d}
            </Button>
          ))}
          <Button variant="ghost" className="h-16" disabled={bloqueado} onClick={() => setPin("")}>
            Limpiar
          </Button>
          <Button
            variant="outline"
            disabled={bloqueado}
            className="cifra h-16 text-2xl font-semibold"
            onClick={() => agregar("0")}
          >
            0
          </Button>
          <Button
            variant="ghost"
            className="h-16"
            disabled={bloqueado}
            onClick={borrar}
            aria-label="Borrar último dígito"
          >
            <Delete className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="h-11 bg-accent-500 font-bold text-text-950 hover:bg-accent-600 dark:text-[#02180d]"
            disabled={bloqueado || pin.length < LARGO_MIN}
            onClick={() => confirmar("accion")}
          >
            {hayAccion ? "Autorizar solo esta acción" : "Autorizar solo en esta sección"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bloqueado || pin.length < LARGO_MIN}
            onClick={() => confirmar("panel")}
          >
            Cambiar a Panel Administrador
          </Button>
        </div>

        {/* Solo para la demo en clase: quitar en producción */}
        {negocio?.id === "neg-1" && (
          <p className="text-center text-xs text-muted-foreground">
            Demo: el PIN de administrador es <span className="cifra font-bold">{PIN_ADMIN_DEMO}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}