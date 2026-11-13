import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { POSProvider, usePOS } from "@/context/POSContext"
import { NAV_ITEMS, rutaInicial } from "@/config/navigation"
import { Toaster } from "@/components/ui/sonner"
import Layout from "@/components/layout/Layout"
import Placeholder from "@/pages/Placeholder"
import LandingPage from "@/pages/LandingPage"
import LoginPage from "@/pages/LoginPage"
import OnboardingPage from "@/pages/OnboardingPage"

// Aquí iremos registrando las páginas reales, por ejemplo:
// import Dashboard from "@/pages/Dashboard"
// const PAGINAS = { "/dashboard": Dashboard }
const PAGINAS = {}

// Toaster global (funciona en Landing, Login, Onboarding y panel)
function AppToaster() {
  const { tema } = usePOS()
  return <Toaster theme={tema} position="top-right" richColors />
}

// Rutas del panel: exigen sesión y onboarding completo
function RequiereSesion({ children }) {
  const { usuario, requiereOnboarding } = usePOS()
  if (!usuario) return <Navigate to="/login" replace />
  if (requiereOnboarding) return <Navigate to="/onboarding" replace />
  return children
}

// El onboarding solo lo ve quien tiene sesión y aún no configuró su negocio
function SoloOnboarding({ children }) {
  const { usuario, requiereOnboarding, rol } = usePOS()
  if (!usuario) return <Navigate to="/login" replace />
  if (!requiereOnboarding) return <Navigate to={rutaInicial(rol)} replace />
  return children
}

// Si el rol no tiene permiso para la ruta, lo mandamos a su pantalla inicial
function Protegida({ roles, children }) {
  const { rol } = usePOS()
  return roles.includes(rol) ? children : <Navigate to={rutaInicial(rol)} replace />
}

export default function App() {
  return (
    <POSProvider>
      <BrowserRouter>
        <Routes>
          {/* Pantalla completa (sin Sidebar ni Topbar) */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/onboarding"
            element={
              <SoloOnboarding>
                <OnboardingPage />
              </SoloOnboarding>
            }
          />

          {/* Panel con Layout */}
          <Route
            element={
              <RequiereSesion>
                <Layout />
              </RequiereSesion>
            }
          >
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AppToaster />
      </BrowserRouter>
    </POSProvider>
  )
}