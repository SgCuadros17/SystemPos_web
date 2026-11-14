import {
  Apple,
  Beef,
  Beer,
  BrickWall,
  Candy,
  CakeSlice,
  ChefHat,
  Coffee,
  Cog,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Drill,
  Droplet,
  Drumstick,
  Egg,
  Fish,
  Flame,
  GlassWater,
  HardHat,
  Hammer,
  IceCreamCone,
  Lightbulb,
  Lock,
  Martini,
  Milk,
  Package,
  PaintBucket,
  Paintbrush,
  Pizza,
  Plug,
  Popcorn,
  Ruler,
  Salad,
  Sandwich,
  Scissors,
  Soup,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  Wheat,
  Wine,
  Wrench,
  Zap,
} from "lucide-react"

// ---------------------------------------------------------------------
// ICONOS DEL CATÁLOGO (equivale a categorias/productos.icono_clave en BD)
// gremios: en qué tipo_negocio se ofrece el icono en el selector
// ---------------------------------------------------------------------
const TM = ["tienda", "minimercado"]
const FE = ["ferreteria"]
const RE = ["restaurante"]
const TODOS = ["tienda", "minimercado", "ferreteria", "restaurante"]

const ico = (id, label, icon, gremios) => ({ id, label, icon, gremios })

export const ICONOS_CATALOGO = [
  // ----- Tienda / Minimercado (15) -----
  ico("wheat", "Granos y cereales", Wheat, TM),
  ico("package", "Producto general", Package, TODOS),
  ico("milk", "Lácteos", Milk, TM),
  ico("egg", "Huevos", Egg, [...TM, ...RE]),
  ico("cup-soda", "Gaseosas", CupSoda, [...TM, ...RE]),
  ico("glass-water", "Agua y jugos", GlassWater, [...TM, ...RE]),
  ico("beer", "Cervezas", Beer, [...TM, ...RE]),
  ico("wine", "Vinos y licores", Wine, [...TM, ...RE]),
  ico("croissant", "Panadería", Croissant, [...TM, ...RE]),
  ico("beef", "Carnes", Beef, [...TM, ...RE]),
  ico("drumstick", "Pollo", Drumstick, [...TM, ...RE]),
  ico("apple", "Frutas", Apple, TM),
  ico("coffee", "Café", Coffee, [...TM, ...RE]),
  ico("candy", "Dulces y snacks", Candy, TM),
  ico("sparkles", "Aseo y limpieza", Sparkles, TM),

  // ----- Ferretería (15) -----
  ico("cog", "Repuestos y piñones", Cog, FE),
  ico("wrench", "Llaves y herramientas", Wrench, FE),
  ico("hammer", "Martillos", Hammer, FE),
  ico("drill", "Taladros", Drill, FE),
  ico("plug", "Tomas y conectores", Plug, FE),
  ico("lightbulb", "Bombillos", Lightbulb, FE),
  ico("zap", "Electricidad", Zap, FE),
  ico("paint-bucket", "Pinturas", PaintBucket, FE),
  ico("paintbrush", "Brochas y rodillos", Paintbrush, FE),
  ico("ruler", "Medición", Ruler, FE),
  ico("hard-hat", "Seguridad industrial", HardHat, FE),
  ico("brick-wall", "Construcción", BrickWall, FE),
  ico("droplet", "Líquidos y plomería", Droplet, [...FE, ...TM]),
  ico("lock", "Cerrajería", Lock, FE),
  ico("scissors", "Corte", Scissors, FE),

  // ----- Restaurante (9 + 6 de cocina) -----
  ico("sandwich", "Sándwiches y hamburguesas", Sandwich, RE),
  ico("pizza", "Pizzas", Pizza, RE),
  ico("utensils", "Platos fuertes", Utensils, RE),
  ico("soup", "Sopas", Soup, RE),
  ico("salad", "Ensaladas", Salad, RE),
  ico("flame", "Parrilla", Flame, RE),
  ico("fish", "Pescados y mariscos", Fish, RE),
  ico("cake-slice", "Postres", CakeSlice, RE),
  ico("ice-cream-cone", "Helados", IceCreamCone, RE),
  ico("chef-hat", "Especialidades", ChefHat, RE),
  ico("cooking-pot", "Guisos y cocidos", CookingPot, RE),
  ico("cookie", "Galletas y pasabocas", Cookie, RE),
  ico("utensils-crossed", "Menú del día", UtensilsCrossed, RE),
  ico("martini", "Cócteles", Martini, RE),
  ico("popcorn", "Antojitos", Popcorn, RE),
]

const MAPA_ICONOS = Object.fromEntries(ICONOS_CATALOGO.map((i) => [i.id, i]))

// ---------------------------------------------------------------------
// CATEGORÍAS SUGERIDAS POR GREMIO (tipo_negocio)
// ---------------------------------------------------------------------
const CATEGORIAS_TIENDA = [
  "Despensa", "Lácteos", "Bebidas", "Panadería", "Carnes",
  "Frutas y verduras", "Aseo", "Dulces y snacks", "Cuidado personal", "Otros",
]

export const CATEGORIAS_POR_GREMIO = {
  tienda: CATEGORIAS_TIENDA,
  minimercado: [
    "Despensa", "Lácteos", "Bebidas", "Licores", "Panadería", "Carnes y embutidos",
    "Frutas y verduras", "Aseo del hogar", "Cuidado personal", "Congelados",
    "Dulces y snacks", "Mascotas", "Otros",
  ],
  ferreteria: [
    "Herramientas", "Tornillería y fijación", "Electricidad", "Plomería",
    "Pinturas y acabados", "Construcción", "Cerrajería", "Iluminación",
    "Adhesivos y selladores", "Seguridad industrial", "Otros",
  ],
  restaurante: [
    "Comida", "Platos fuertes", "Entradas", "Sopas", "Ensaladas", "Postres",
    "Bebidas", "Jugos y batidos", "Cafetería", "Adicionales", "Otros",
  ],
}

// ---------------------------------------------------------------------
// PRESENTACIONES RÁPIDAS (chips) POR GREMIO
// ---------------------------------------------------------------------
const PRESENTACIONES_TIENDA = [
  "Unidad", "Libra (500g)", "1kg", "250g", "1L", "1.5L",
  "Panal x30", "Medio panal", "Media caja", "Caja", "Six-pack", "Sobre",
]

export const PRESENTACIONES_POR_GREMIO = {
  tienda: PRESENTACIONES_TIENDA,
  minimercado: PRESENTACIONES_TIENDA,
  ferreteria: [
    "Unidad", "Metro", "Caja x100", "Bolsa x50", "Galón",
    "Cuñete", "1/4 Galón", "Rollo", "Par", "Kilo",
  ],
  restaurante: [
    "Personal", "Combo", "Porción", "Media porción",
    "Familiar", "Vaso 16oz", "Jarra", "Botella",
  ],
}

// ---------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------

// Devuelve el componente Lucide del producto (Package si no existe la clave)
export const obtenerIconoProducto = (iconoId) => MAPA_ICONOS[iconoId]?.icon ?? Package

// Iconos que se ofrecen en el selector para un tipo de negocio
export const iconosParaGremio = (tipoNegocio) => {
  const lista = ICONOS_CATALOGO.filter((i) => i.gremios.includes(tipoNegocio))
  return lista.length > 0 ? lista : ICONOS_CATALOGO
}

export const categoriasParaGremio = (tipoNegocio) =>
  CATEGORIAS_POR_GREMIO[tipoNegocio] ?? CATEGORIAS_POR_GREMIO.tienda

export const presentacionesParaGremio = (tipoNegocio) =>
  PRESENTACIONES_POR_GREMIO[tipoNegocio] ?? PRESENTACIONES_POR_GREMIO.tienda