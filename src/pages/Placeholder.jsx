import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { usePOS } from "@/context/POSContext"
import { etiquetaDe } from "@/config/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Placeholder({ item }) {
  const { rol, sucursalActual, solicitarAutorizacion } = usePOS()
  const Icono = item.icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {etiquetaDe(item, rol)}
        </h1>
        <p className="mt-1 text-muted-foreground">{item.descripcion}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-2xl bg-primary-500/10 p-4 text-primary-600">
            <Icono className="h-10 w-10" />
          </div>
          <div>
            <p className="text-lg font-semibold">Vista en construcción</p>
            <p className="text-sm text-muted-foreground">
              Aquí irá el contenido completo de este módulo.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-3 py-1">
              Rol: <strong>{rol}</strong>
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              Sucursal: <strong>{sucursalActual ? sucursalActual.nombre : "Todas"}</strong>
            </span>
          </div>

          {/* Temporal: prueba del flujo de autorización */}
          <Button
            variant="outline"
            onClick={() =>
              solicitarAutorizacion(() => toast.success("Acción de administrador ejecutada"))
            }
          >
            <ShieldCheck className="h-4 w-4" />
            Probar acción protegida
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}