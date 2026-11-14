import { useCallback, useEffect, useState } from "react"
import { Delete, ShieldCheck } from "lucide-react"
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
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    if (!modalAdminAbierto) {
      setPin("")
      setError("")
      setIntentos(0)
    }
  }, [modalAdminAbierto])

  const agregar = useCallback((digito) => {
    setError("")
    setPin((p) => (p.length < LARGO_MAX ? p + digito : p))
  }, [])

  const borrar = useCallback(() => setPin((p) => p.slice(0, -1)), [])

  const confirmar = useCallback(
    (modo = "panel") => {
      if (pin.length < LARGO_MIN) return
      if (validarPinAdmin(pin, modo)) {
        toast.success(
          modo === "accion"
            ? "Acción autorizada por el administrador"
            : "Panel de administrador habilitado"
        )
        return
      }
      const n = intentos + 1
      setPin("")
      if (n >= MAX_INTENTOS) {
        toast.error("Demasiados intentos fallidos")
        cerrarModalAdmin()
        return
      }
      setIntentos(n)
      setError(`PIN incorrecto. Te quedan ${MAX_INTENTOS - n} intento(s).`)
    },
    [pin, intentos, validarPinAdmin, cerrarModalAdmin]
  )

  useEffect(() => {
    if (!modalAdminAbierto) return
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) agregar(e.key)
      else if (e.key === "Backspace") borrar()
      else if (e.key === "Enter") {
        e.preventDefault()
        confirmar(tieneAccionPendiente() ? "accion" : "panel")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modalAdminAbierto, agregar, borrar, confirmar, tieneAccionPendiente])

  return (
    <Dialog
      open={modalAdminAbierto}
      onOpenChange={(abierto) => {
        if (!abierto) cerrarModalAdmin()
      }}
    >
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center">
          <div className="mb-1 rounded-full bg-primary-500/10 p-3 text-primary-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <DialogTitle>Autorización de administrador</DialogTitle>
          <DialogDescription>
            {tieneAccionPendiente
              ? "Ingresa el PIN del administrador para desbloquear esta acción sin cerrar la caja."
              : "Ingresa tu PIN de seguridad para abrir el panel de administrador."}
          </DialogDescription>
        </DialogHeader>

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

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button
              key={d}
              variant="outline"
              className="cifra h-16 text-2xl font-semibold"
              onClick={() => agregar(d)}
            >
              {d}
            </Button>
          ))}
          <Button variant="ghost" className="h-16" onClick={() => setPin("")}>
            Limpiar
          </Button>
          <Button
            variant="outline"
            className="cifra h-16 text-2xl font-semibold"
            onClick={() => agregar("0")}
          >
            0
          </Button>
          <Button variant="ghost" className="h-16" onClick={borrar} aria-label="Borrar último dígito">
            <Delete className="h-6 w-6" />
          </Button>
        </div>

        {tieneAccionPendiente ? (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="h-11 bg-accent-500 text-text-950 hover:bg-accent-600 font-bold"
              disabled={pin.length < LARGO_MIN}
              onClick={() => confirmar("accion")}
            >
              Autorizar solo esta acción
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pin.length < LARGO_MIN}
              onClick={() => confirmar("panel")}
            >
              Cambiar a Panel Administrador
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={pin.length < LARGO_MIN}
            onClick={() => confirmar("panel")}
          >
            Abrir Panel Administrador
          </Button>
        )}

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