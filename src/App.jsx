import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { POSProvider, usePOS, formatCOP } from "@/context/POSContext"
import Layout from "@/components/layout/Layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Página temporal: la reemplazaremos por las reales en las siguientes etapas
function Pagina({ titulo, descripcion }) {
  const { sucursalActual, rol, productos, clientes, ventas } = usePOS()
  const ventasVisibles = sucursalActual
    ? ventas.filter((v) => v.sucursalId === sucursalActual.id)
    : ventas
  const totalVentas = ventasVisibles.reduce((suma, v) => suma + v.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-slate-600">
        <p>Sucursal activa: <strong>{sucursalActual ? sucursalActual.nombre : "Todas"}</strong></p>
        <p>Rol activo: <strong>{rol}</strong></p>
        <p>Productos: <strong>{productos.length}</strong> | Clientes fiados: <strong>{clientes.length}</strong></p>
        <p>Ventas registradas: <strong>{ventasVisibles.length}</strong> por <strong>{formatCOP(totalVentas)}</strong></p>
      </CardContent>
    </Card>
  )
}

// Si el cajero intenta entrar a una ruta de admin, lo mandamos al POS
function Protegida({ roles, children }) {
  const { rol } = usePOS()
  return roles.includes(rol) ? children : <Navigate to="/pos" replace />
}

export default function App() {
  return (
    <POSProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Protegida roles={["admin"]}>
                  <Pagina titulo="Dashboard" descripcion="KPIs y gráficas (Etapa 3)" />
                </Protegida>
              }
            />
            <Route
              path="/pos"
              element={<Pagina titulo="Punto de Venta" descripcion="Catálogo y carrito (Etapa 6)" />}
            />
            <Route
              path="/inventario"
              element={
                <Protegida roles={["admin"]}>
                  <Pagina titulo="Inventario" descripcion="Stock y traslados (Etapa 4)" />
                </Protegida>
              }
            />
            <Route
              path="/fiados"
              element={<Pagina titulo="Fiados" descripcion="Cartera y abonos (Etapa 5)" />}
            />
            <Route
              path="/cierres"
              element={<Pagina titulo="Cierres de Caja" descripcion="Arqueo y comprobantes (Etapa 7)" />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </POSProvider>
  )
}