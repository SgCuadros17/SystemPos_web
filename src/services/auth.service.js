/**
 * SERVICIO DE AUTENTICACIÓN (mock con localStorage)
 * -------------------------------------------------------------------
 * Ningún componente habla con la base de datos: todo pasa por aquí.
 * Cada función documenta cómo se reemplaza por Supabase / Express.
 * AVISO: guardar contraseñas en localStorage es SOLO para la demo.
 */

const CLAVE_SESION = "abaco-sesion"
const CLAVE_CUENTAS = "abaco-cuentas"

const pausa = (ms = 350) => new Promise((r) => setTimeout(r, ms))

const leer = (clave, defecto) => {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : defecto
  } catch {
    return defecto
  }
}

const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento disponible */
  }
}

// UUID generado en el cliente (clave para el modo Offline-First)
export const generarUUID = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
      })

const guardarSesion = (sesion) => {
  escribir(CLAVE_SESION, sesion)
  return sesion
}

// ---------- Usuarios de demostración ----------
export const USUARIO_ADMIN_DEMO = {
  id: "u-admin",
  negocio_id: "neg-1",
  sucursal_id: null,
  nombre: "Administrador Demo",
  email: "admin@abaco.demo",
  rol: "admin",
}

export const USUARIO_CAJERO_DEMO = {
  id: "u-cajero",
  negocio_id: "neg-1",
  sucursal_id: "s1", // Tienda 1
  nombre: "Cajero Demo",
  email: "cajero@abaco.demo",
  rol: "cajero",
}

const USUARIO_NUEVO_DEMO = {
  id: "demo-nuevo",
  negocio_id: null,
  sucursal_id: null,
  nombre: "Laura Dueña",
  email: "laura@abaco.demo",
  rol: "admin",
}

const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

// =====================================================================
// obtenerSesionGuardada()  ->  { usuario, requiereOnboarding } | null
// Es síncrona para poder inicializar el contexto sin pantalla de carga.
// SUPABASE: sería asíncrona -> supabase.auth.getSession() y luego
//   select * from usuarios where id = session.user.id
// =====================================================================
export function obtenerSesionGuardada() {
  const sesion = leer(CLAVE_SESION, null)
  return sesion?.usuario ? sesion : null
}

// =====================================================================
// iniciarSesion({ email, password })  ->  { usuario, requiereOnboarding }
// SUPABASE:
//   const { data, error } = await supabase.auth.signInWithPassword({ email, password })
//   const { data: perfil } = await supabase.from("usuarios").select("*").eq("id", data.user.id).maybeSingle()
//   requiereOnboarding = perfil === null   (autenticado pero sin negocio)
// =====================================================================
export async function iniciarSesion({ email, password }) {
  await pausa()
  const correo = (email || "").trim().toLowerCase()
  const cuenta = leer(CLAVE_CUENTAS, []).find((c) => c.email === correo)
  if (!cuenta || cuenta.password !== password) {
    throw new Error("Correo o contraseña incorrectos")
  }
  const usuario = {
    id: cuenta.id,
    negocio_id: cuenta.negocio_id,
    sucursal_id: cuenta.sucursal_id,
    nombre: cuenta.nombre,
    email: cuenta.email,
    rol: "admin",
  }
  return guardarSesion({ usuario, requiereOnboarding: !cuenta.onboardingCompleto })
}

// =====================================================================
// registrarDueno({ nombre, email, password })
//   -> { usuario: { id, nombre, email, rol: "admin" }, requiereOnboarding: true }
// SUPABASE:
//   const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre } } })
//   data.user.id será el id del perfil en `usuarios` (se crea en el onboarding).
// =====================================================================
export async function registrarDueno({ nombre, email, password }) {
  await pausa()
  const correo = (email || "").trim().toLowerCase()
  if (!nombre?.trim()) throw new Error("El nombre es obligatorio")
  if (!esCorreo(correo)) throw new Error("El correo no tiene un formato válido")
  if ((password || "").length < 6) throw new Error("La contraseña debe tener mínimo 6 caracteres")

  const cuentas = leer(CLAVE_CUENTAS, [])
  if (cuentas.some((c) => c.email === correo)) {
    throw new Error("Ya existe una cuenta con ese correo")
  }

  const cuenta = {
    id: generarUUID(),
    nombre: nombre.trim(),
    email: correo,
    password, // demo: en Supabase Auth se guarda con hash
    negocio_id: null,
    sucursal_id: null,
    onboardingCompleto: false,
  }
  escribir(CLAVE_CUENTAS, [...cuentas, cuenta])

  const usuario = {
    id: cuenta.id,
    nombre: cuenta.nombre,
    email: cuenta.email,
    rol: "admin",
    negocio_id: null,
    sucursal_id: null,
  }
  return guardarSesion({ usuario, requiereOnboarding: true })
}

// =====================================================================
// iniciarSesionDemo("nuevo" | "admin" | "cajero")
//   nuevo  -> requiereOnboarding: true   (va a /onboarding)
//   admin  -> admin del negocio demo     (va a /dashboard)
//   cajero -> cajero asignado a s1       (va a /pos)
// Solo existe para la presentación; no tiene equivalente en Supabase.
// =====================================================================
export async function iniciarSesionDemo(tipo) {
  await pausa(150)
  const mapa = {
    nuevo: { usuario: USUARIO_NUEVO_DEMO, requiereOnboarding: true },
    admin: { usuario: USUARIO_ADMIN_DEMO, requiereOnboarding: false },
    cajero: { usuario: USUARIO_CAJERO_DEMO, requiereOnboarding: false },
  }
  const sesion = mapa[tipo]
  if (!sesion) throw new Error("Tipo de demo no válido")
  return guardarSesion(sesion)
}

// =====================================================================
// actualizarSesionTrasOnboarding(usuario)
// Lo llama el contexto cuando el onboarding termina bien.
// SUPABASE: no hace falta; la sesión de Auth sigue igual y el perfil
//   ya existe en `usuarios`.
// =====================================================================
export function actualizarSesionTrasOnboarding(usuario) {
  guardarSesion({ usuario, requiereOnboarding: false })
  const cuentas = leer(CLAVE_CUENTAS, []).map((c) =>
    c.id === usuario.id
      ? { ...c, negocio_id: usuario.negocio_id, sucursal_id: usuario.sucursal_id, onboardingCompleto: true }
      : c
  )
  escribir(CLAVE_CUENTAS, cuentas)
}

// =====================================================================
// cerrarSesionServicio()
// SUPABASE: await supabase.auth.signOut()
// =====================================================================
export async function cerrarSesionServicio() {
  try {
    localStorage.removeItem(CLAVE_SESION)
  } catch {
    /* sin almacenamiento disponible */
  }
}