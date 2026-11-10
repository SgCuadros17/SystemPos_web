import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { POSProvider, usePOS } from "@/context/POSContext"
import { NAV_ITEMS, rutaInicial } from "@/config/navigation"
import Layout from "@/components/layout/Layout"
import Placeholder from "@/pages/Placeholder"

// Aquí iremos registrando las páginas reales, por ejemplo:
// import Dashboard from "@/pages/Dashboard"
// const PAGINAS = { "/dashboard": Dashboard }
const PAGINAS = {}

// Si el rol no tiene permiso para la ruta, lo mandamos a su pantalla inicial
function Protegida({ roles, children }) {
  const { rol } = usePOS()
  return roles.includes(rol) ? children : <Navigate to={rutaInicial(rol)} replace />
}

function Inicio() {
  const { rol } = usePOS()
  return <Navigate to={rutaInicial(rol)} replace />
}

export default function App() {
  return (
    <POSProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            {NAV_ITEMS.map((item) => {
              const Pagina = PAGINAS[item.to] ?? Placeholder
              return (
                <Route
                  key={item.to}
                  path={item.to}
                  element={
                    <Protegida roles={item.roles}>
                      <Pagina item={item} />
                    </Protegida>
                  }
                />
              )
            })}
            <Route path="*" element={<Inicio />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </POSProvider>
  )
}