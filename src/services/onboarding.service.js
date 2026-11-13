import { generarUUID } from "./auth.service"

/**
 * SERVICIO DE ONBOARDING (mock con localStorage)
 * -------------------------------------------------------------------
 * ORDEN EXIGIDO POR LAS POLÍTICAS RLS (no cambiarlo en Supabase real):
 *
 *  1. negocios   -> policy negocios_insert_registro: solo si mi_negocio_id() IS NULL.
 *                   Insertar SIN .select(): aún no hay perfil para leerlo de vuelta.
 *  2. usuarios   -> policy usuarios_insert_registro: id = auth.uid(), rol = 'admin',
 *     (admin)       sucursal_id IS NULL y negocio_sin_usuarios(negocio_id).
 *                   Desde aquí es_admin() = true.
 *  3. sucursales -> policy sucursales_insert_admin: requiere es_admin() (paso 2 hecho).
 *  4. usuarios   -> UPDATE del admin con su sucursal_id (usuarios_update_admin).
 *  5. usuarios   -> cajeros (usuarios_insert_admin). Cada cajero debe existir antes en
 *     (cajeros)     auth.users: créalos desde el backend con supabase.auth.admin.createUser
 *                   (service_role) y luego inserta su perfil.
 *
 * Supabase JS no tiene transacciones: para que sea atómico, en producción conviene
 * una función SQL (RPC, SECURITY DEFINER) `crear_negocio_inicial(...)` que haga los pasos
 * 1-5 y se llame con supabase.rpc(...). Si un paso falla, se revierte todo.
 */

const CLAVE_NEGOCIOS = "abaco-negocios"

const leerMapa = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_NEGOCIOS) || "{}")
  } catch {
    return {}
  }
}

// Recupera un negocio creado en el onboarding (para recargar la página)
export function leerOnboardingGuardado(negocioId) {
  return leerMapa()[negocioId] ?? null
}

const PIN_VALIDO = /^\d{4,6}$/

// =====================================================================
// ejecutarOnboardingTransaccional({ negocio, sucursal, usuarioAdmin, cajeros })
//   negocio:      { nombre, tipo_negocio }
//   sucursal:     { nombre, direccion?, telefono? }
//   usuarioAdmin: { id (= auth.uid()), nombre, email, pin_seguridad }
//   cajeros:      [{ nombre, email, pin_seguridad }]
//   -> { negocio, sucursal, usuarios: [admin, ...cajeros] }
// =====================================================================
export async function ejecutarOnboardingTransaccional({
  negocio,
  sucursal,
  usuarioAdmin,
  cajeros = [],
}) {
  await new Promise((r) => setTimeout(r, 600))

  if (!negocio?.nombre?.trim()) throw new Error("El nombre del negocio es obligatorio")
  if (!["tienda", "minimercado", "ferreteria", "restaurante"].includes(negocio.tipo_negocio)) {
    throw new Error("Selecciona un tipo de negocio")
  }
  if (!sucursal?.nombre?.trim()) throw new Error("El nombre de la sucursal es obligatorio")
  if (!PIN_VALIDO.test(usuarioAdmin?.pin_seguridad || "")) {
    throw new Error("El PIN de seguridad debe tener de 4 a 6 dígitos")
  }
  for (const c of cajeros) {
    if (!c.nombre?.trim() || !c.email?.trim() || !PIN_VALIDO.test(c.pin_seguridad || "")) {
      throw new Error("Revisa los datos de los cajeros")
    }
  }

  const ahora = new Date().toISOString()

  // 1) negocios
  // SUPABASE: await supabase.from("negocios").insert(negocioFila)   // sin .select()
  const negocioFila = {
    id: generarUUID(),
    nombre: negocio.nombre.trim(),
    tipo_negocio: negocio.tipo_negocio,
    plan_suscripcion: "gratis",
    creado_en: ahora,
  }

  // 2) usuarios (admin) -> primero SIN sucursal, como exige usuarios_insert_registro
  // SUPABASE: await supabase.from("usuarios").insert(adminInicial)
  const adminInicial = {
    id: usuarioAdmin.id,
    negocio_id: negocioFila.id,
    sucursal_id: null,
    nombre: usuarioAdmin.nombre,
    email: usuarioAdmin.email,
    rol: "admin",
    pin_seguridad: usuarioAdmin.pin_seguridad,
    creado_en: ahora,
  }

  // 3) sucursales (ya somos admin, la policy lo permite)
  // SUPABASE: await supabase.from("sucursales").insert(sucursalFila)
  const sucursalFila = {
    id: generarUUID(),
    negocio_id: negocioFila.id,
    nombre: sucursal.nombre.trim(),
    direccion: sucursal.direccion?.trim() || null,
    telefono: sucursal.telefono?.trim() || null,
    activa: true,
    creado_en: ahora,
  }

  // 4) UPDATE del admin con su sucursal
  // SUPABASE: await supabase.from("usuarios").update({ sucursal_id: sucursalFila.id }).eq("id", adminInicial.id)
  const adminFinal = { ...adminInicial, sucursal_id: sucursalFila.id }

  // 5) usuarios (cajeros opcionales)
  // SUPABASE: backend crea auth.users y luego insert en "usuarios"
  const cajerosFilas = cajeros.map((c) => ({
    id: generarUUID(), // en real: el id que devuelve auth.admin.createUser
    negocio_id: negocioFila.id,
    sucursal_id: sucursalFila.id,
    nombre: c.nombre.trim(),
    email: c.email.trim().toLowerCase(),
    rol: "cajero",
    pin_seguridad: c.pin_seguridad,
    creado_en: ahora,
  }))

  const resultado = {
    negocio: negocioFila,
    sucursal: sucursalFila,
    usuarios: [adminFinal, ...cajerosFilas],
  }

  // Persistencia mock
  try {
    const mapa = leerMapa()
    mapa[negocioFila.id] = resultado
    localStorage.setItem(CLAVE_NEGOCIOS, JSON.stringify(mapa))
  } catch {
    /* sin almacenamiento disponible */
  }

  return resultado
}