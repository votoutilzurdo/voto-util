// =====================================================================
//  DATOS QUE HAY QUE ACTUALIZAR A MANO
//  Cambia los números de "voto" con la media de encuestas más reciente
//  y actualiza "fecha" y "fuente". La web recalcula todo sola.
// =====================================================================
window.ENCUESTAS = {
  eleccion: "Elecciones generales del 29 de noviembre de 2026",
  fecha: "2026-11-16",
  fuente: "Media de encuestas de Demócrata (17 institutos, ponderada por fecha y muestra)",
  fuenteUrl: "https://www.democrata.es/elecciones-generales-espana/herramientas/encuestas",

  // % de voto estimado a nivel nacional (sobre voto a candidaturas).
  // FA incluye a sus listas aliadas: Compromís-FV (C. Valenciana), Ara Més-FA (Baleares) y la lista de Canarias.
  // ERC incluye a Podem en Cataluña. Lo que no aparece aquí va a "OTROS".
  voto: {
    PP: 31.5,
    PSOE: 27.2,
    VOX: 18.9,
    FA: 6.4,
    ERC: 2.5,
    SALF: 1.8,
    ADELANTE: 1.8,
    PODEMOS: 1.6,
    BILDU: 1.5,
    JUNTS: 1.3,
    BNG: 1.0,
    PNV: 0.8,
    CC: 0.4,
  },

  // Candidaturas que comparten la cifra de una encuesta (se ajustan juntas).
  grupos: { COMPROMIS: "FA" },

  // Candidaturas locales (Teruel Existe, Soria ¡Ya!, UPL...): no salen en las encuestas
  // nacionales, así que conservan su % de 2023.
  fijos: ["LOCAL"],

  // Incertidumbre del modelo (desviación típica relativa, en escala logarítmica).
  // nacional: error de las encuestas, común a todas las provincias.
  // provincial: lo que una provincia se separa del patrón de 2023.
  incertidumbre: { nacional: 0.10, provincial: 0.14 },

  // Tamaño del "empujón" que se prueba: % de los votos válidos de la provincia.
  empujon: 1.0,

  // Nivel de confianza (alto / medio / bajo): fracción de escenarios en que el empujón
  // a una lista da un escaño más a la izquierda. Por encima de "alta" = alto; de "media" = medio.
  confianza: { alta: 0.12, media: 0.05 },

  // Número de escenarios simulados por provincia.
  simulaciones: 4000,
};

// Nombres, colores y bloque de cada candidatura.
// izquierda: "si" o "nac" (independentistas/nacionalistas de izquierda) cuentan como izquierda; "no" no cuenta.
window.PARTIDOS = {
  PSOE:     { nombre: "PSOE", color: "#e1251b", izquierda: "si",
              porComunidad: { CAT: "PSC", GAL: "PSdeG-PSOE", PV: "PSE-EE", NAV: "PSN-PSOE", BAL: "PSIB-PSOE" } },
  FA:       { nombre: "Frente Amplio", color: "#c2185b", izquierda: "si",
              porComunidad: { CAT: "Comuns–Frente Amplio", ARA: "CHA–Frente Amplio", BAL: "Ara Més–Frente Amplio",
                              CAN: "Frente Amplio (con NC-BC y Podemos)", MAD: "Frente Amplio (Más Madrid, IU…)" } },
  COMPROMIS:{ nombre: "Compromís–Front Valencià", color: "#ee7f2d", izquierda: "si" },
  PODEMOS:  { nombre: "Podemos", color: "#6b2e68", izquierda: "si" },
  ADELANTE: { nombre: "Adelante Andalucía", color: "#2e7d5b", izquierda: "si" },
  ERC:      { nombre: "ERC (con Podem)", color: "#f3b219", izquierda: "nac" },
  BILDU:    { nombre: "EH Bildu", color: "#97b51b", izquierda: "nac" },
  BNG:      { nombre: "BNG", color: "#5fa3d6", izquierda: "nac" },
  PP:       { nombre: "PP", color: "#1d84ce", izquierda: "no", porComunidad: { NAV: "UPN–PP" } },
  VOX:      { nombre: "Vox", color: "#5fb526", izquierda: "no" },
  SALF:     { nombre: "SALF", color: "#4a4a4a", izquierda: "no" },
  JUNTS:    { nombre: "Junts", color: "#00a99d", izquierda: "no" },
  PNV:      { nombre: "PNV", color: "#2e8b57", izquierda: "no" },
  CC:       { nombre: "Coalición Canaria", color: "#e8c300", izquierda: "no" },
  LOCAL:    { nombre: "Candidatura local", color: "#8d6e63", izquierda: "no" },
  OTROS:    { nombre: "Otros", color: "#9e9e9e", izquierda: "no" },
};
