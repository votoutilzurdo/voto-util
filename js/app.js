(function () {
  "use strict";
  const B = window.BASE2023, E = window.ENCUESTAS, P = window.PARTIDOS, M = window.Modelo;

  const ALIAS = {
    "15": ["La Coruña", "Coruña"], "03": ["Alacant"], "12": ["Castelló"], "46": ["València"],
    "01": ["Araba", "Alava"], "48": ["Vizcaya", "Bilbao"], "20": ["Guipúzcoa", "Guipuzcoa", "Donostia", "San Sebastián"],
    "07": ["Baleares", "Mallorca", "Menorca", "Ibiza", "Eivissa", "Formentera", "Palma"],
    "17": ["Gerona"], "25": ["Lérida"], "32": ["Orense"], "33": ["Oviedo", "Gijón"], "39": ["Santander"],
    "26": ["Logroño", "Rioja"], "31": ["Pamplona", "Iruña"], "30": ["Región de Murcia"],
    "35": ["Gran Canaria", "Lanzarote", "Fuerteventura"],
    "38": ["Tenerife", "La Palma", "La Gomera", "El Hierro"],
  };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const fmt = (x, d = 0) => x.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (x, d = 1) => fmt(100 * x, d) + " %";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const provincias = B.provincias.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const proyeccion = M.proyectar(B, E);
  const proyPorIne = {};
  B.provincias.forEach((p, i) => (proyPorIne[p.ine] = proyeccion[i]));
  const slug = (p) => norm(p.nombre).replace(/ /g, "-");

  function nombrePartido(clave, prov) {
    if (clave === "LOCAL") return prov.local || P.LOCAL.nombre;
    const d = P[clave] || { nombre: clave };
    return (d.porComunidad && d.porComunidad[prov.ccaa]) || d.nombre;
  }
  const color = (k) => (P[k] || P.OTROS).color;
  // Cuentan como izquierda todas las candidaturas marcadas así en datos/encuestas.js
  // (ERC, EH Bildu y BNG incluidos donde se presentan).
  const IZQ = Object.keys(P).filter((k) => P[k].izquierda !== "no");
  const izquierda = () => IZQ;

  // ---------- Buscador ----------
  const input = document.getElementById("provincia");
  const lista = document.getElementById("sugerencias");
  const error = document.getElementById("error");
  let activa = -1, opciones = [];

  function buscar(texto) {
    const q = norm(texto);
    if (!q) return provincias;
    const res = [];
    for (const p of provincias) {
      const nombres = [p.nombre, p.oficial].concat(ALIAS[p.ine] || []).map(norm);
      const empieza = nombres.some((n) => n.startsWith(q) || n.split(" ").some((w) => w.startsWith(q)));
      const contiene = nombres.some((n) => n.includes(q));
      if (empieza) res.unshift(p); else if (contiene) res.push(p);
    }
    return res;
  }
  function pintarSugerencias() {
    opciones = buscar(input.value).slice(0, 52);
    activa = opciones.length ? 0 : -1;
    lista.innerHTML = opciones.map((p, i) =>
      `<li><button type="button" role="option" data-ine="${p.ine}" aria-selected="${i === activa}">${esc(p.nombre)}<span>${p.escanos} escaños</span></button></li>`).join("");
    lista.hidden = opciones.length === 0;
    input.setAttribute("aria-expanded", String(!lista.hidden));
  }
  function cerrar() { lista.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function marcar(i) {
    activa = i;
    lista.querySelectorAll("button").forEach((b, j) => {
      b.setAttribute("aria-selected", String(j === i));
      if (j === i) b.scrollIntoView({ block: "nearest" });
    });
  }
  input.addEventListener("input", () => { error.hidden = true; pintarSugerencias(); });
  input.addEventListener("focus", () => { input.select(); pintarSugerencias(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && opciones.length) { e.preventDefault(); if (lista.hidden) pintarSugerencias(); else marcar(Math.min(activa + 1, opciones.length - 1)); }
    else if (e.key === "ArrowUp" && opciones.length) { e.preventDefault(); marcar(Math.max(activa - 1, 0)); }
    else if (e.key === "Escape") cerrar();
  });
  lista.addEventListener("mousedown", (e) => e.preventDefault());
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ine]");
    if (b) elegir(B.provincias.find((p) => p.ine === b.dataset.ine));
  });
  input.addEventListener("blur", () => setTimeout(cerrar, 100));
  document.getElementById("buscador").addEventListener("submit", (e) => {
    e.preventDefault();
    const elegida = opciones[activa] || buscar(input.value)[0];
    if (elegida) elegir(elegida);
    else { error.textContent = "No encontramos esa provincia. Prueba con el nombre de la provincia, por ejemplo «Málaga» o «Bizkaia»."; error.hidden = false; }
  });

  let actual = null;
  function elegir(prov) {
    input.value = prov.nombre;
    cerrar();
    input.blur();
    mostrar(prov);
    try { history.replaceState(null, "", "#" + slug(prov)); } catch (e) { /* sin historial */ }
  }

  // ---------- Resultado ----------
  // Nivel de confianza: con qué frecuencia, en los escenarios simulados, más votos a esta lista
  // acaban dándole un escaño más a la izquierda. Umbrales en datos/encuestas.js.
  const UMB = E.confianza || { alta: 0.12, media: 0.05 };
  function confianza(g) {
    if (g >= UMB.alta) return { clase: "alta", texto: "alto" };
    if (g >= UMB.media) return { clase: "media", texto: "medio" };
    return { clase: "baja", texto: "bajo" };
  }
  const chip = (g) => { const c = confianza(g); return `<span class="confianza ${c.clase}">Nivel de confianza: ${c.texto}</span>`; };
  const votos = (v) => {
    const r = v < 1000 ? Math.ceil(v / 50) * 50 : Math.ceil(v / 100) * 100;
    return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Frase principal: qué escaño puede ganar (o no perder) la izquierda frente a la derecha
  function frase(f, prov) {
    const nom = `<b>${esc(nombrePartido(f.partido, prov))}</b>`;
    const rival = (k) => (k ? esc(nombrePartido(k, prov)) : "la derecha");
    const esIzq = (k) => izquierda().includes(k);
    const cual = f.escanosCentral === 0 ? "su primer escaño" : "un escaño más";
    const enAire = f.colchon !== null && f.colchon < Math.min(f.faltan, f.faltanPropio);
    if (enAire) {
      return `${nom} tiene ${f.escanosCentral === 1 ? "su escaño" : "su último escaño"} en el aire: con unos ${votos(f.colchon)} votantes menos se lo quitaría ${rival(f.ganaria)}. Votarle ayuda a no perderlo.`;
    }
    if (!isFinite(f.faltanPropio)) {
      return `Aunque ${nom} sumara muchos votos, no ganaría más escaños para la izquierda en ${esc(prov.nombre)}.`;
    }
    if (prov.escanos === 1) {
      return `Si ${nom} consigue unos ${votos(f.faltanPropio)} votantes más, superaría a ${rival(f.quitariaPropio)} y se llevaría el único escaño.`;
    }
    if (f.quitariaPropio && esIzq(f.quitariaPropio)) {
      // Su siguiente escaño saldría, con la media de encuestas, de otra lista de izquierdas
      const otra = rival(f.quitariaPropio);
      if (f.ganancia >= UMB.media) {
        return `Si ${nom} consigue unos ${votos(f.faltanPropio)} votantes más puede obtener ${cual}. Con la media de encuestas se lo quitaría a ${otra}, pero en muchos escenarios ese escaño se lo quita a la derecha.`;
      }
      return `Si ${nom} consigue unos ${votos(f.faltanPropio)} votantes más puede obtener ${cual}, pero se lo quitaría a ${otra}, así que la izquierda no sumaría.`;
    }
    const lejos = f.ganancia < UMB.media && f.escanosCentral === 0 && f.probEscano < 0.05;
    return `Si ${nom} consigue unos ${votos(f.faltanPropio)} votantes más puede obtener ${cual}, quitándoselo a ${rival(f.quitariaPropio)}.${lejos ? " Está lejos: un voto aquí casi seguro no se convierte en diputado." : ""}`;
  }

  function mostrar(prov) {
    actual = prov;
    const a = M.analizar(prov, proyPorIne[prov.ine], E, izquierda());
    const izq = a.filas.filter((f) => f.izquierda).sort((x, y) => y.ganancia - x.ganancia || y.cuota - x.cuota);
    const mejor = izq[0];
    // Listas con opciones reales: confianza media o alta y cerca de la mejor. Se presentan por igual.
    let opciones = izq.filter((f) => f.ganancia >= UMB.media && f.ganancia >= 0.5 * mejor.ganancia).slice(0, 3);
    if (!opciones.length) opciones = [mejor];

    let intro;
    if (mejor.ganancia < UMB.media) {
      intro = `En ${esc(prov.nombre)} el reparto parece bastante decidido: es difícil que la izquierda le quite un escaño a la derecha. Donde más puede contar tu voto es aquí:`;
    } else if (opciones.length === 1) {
      intro = `En ${esc(prov.nombre)}, el voto de izquierdas con más opciones de ganarle un escaño a la derecha es:`;
    } else {
      intro = `En ${esc(prov.nombre)} hay ${opciones.length === 2 ? "dos" : "tres"} listas de izquierdas con opciones reales de ganarle o no perder un escaño frente a la derecha. Cualquiera de ellas es un buen voto útil:`;
    }
    const papeletas = opciones.map((f) => `
      <div class="opcion-voto">
        <div class="voto"><svg class="sobre" viewBox="0 0 48 40" aria-hidden="true"><rect x="2" y="6" width="36" height="26" rx="3" fill="var(--papeleta)" stroke="var(--tinta)" stroke-width="2.5"/><path d="M3 8 L20 21 L37 8" fill="none" stroke="var(--tinta)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="36" cy="28" r="10" fill="var(--ok)"/><path d="M31 28.5 L34.5 32 L41 25" fill="none" stroke="var(--papeleta)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="partido">${esc(nombrePartido(f.partido, prov))}</span></div>
        <p class="explica">${frase(f, prov)}</p>
        ${chip(f.ganancia)}
      </div>`).join("");

    // Escaños del escenario central, de izquierda a derecha
    const orden = Object.keys(P);
    const conEscano = a.filas.filter((f) => f.escanosCentral > 0)
      .sort((x, y) => (y.izquierda - x.izquierda) || orden.indexOf(x.partido) - orden.indexOf(y.partido));
    const cuadros = conEscano.flatMap((f) => Array(f.escanosCentral).fill(`<span class="cuadro" style="background:${color(f.partido)}" title="${esc(nombrePartido(f.partido, prov))}"></span>`)).join("");
    const leyenda = conEscano.map((f) => `<li><i style="background:${color(f.partido)}"></i>${esc(nombrePartido(f.partido, prov))} ${f.escanosCentral}</li>`).join("");
    const izqCentral = conEscano.filter((f) => f.izquierda).reduce((s, f) => s + f.escanosCentral, 0);

    const filas = izq.map((f) => `
      <div class="fila">
        <div class="nombre"><i style="background:${color(f.partido)}"></i><span>${esc(nombrePartido(f.partido, prov))}</span></div>
        <div class="cifras">${pct(f.cuota)} · ${f.escanosCentral} esc.</div>
        <p class="estado">${frase(f, prov)}</p>
        <div>${chip(f.ganancia)}</div>
      </div>`).join("");


    document.getElementById("resultado").innerHTML = `
      <div style="display:grid;gap:24px">
        <article class="papeleta">
          <div class="contexto"><span>Congreso · ${esc(prov.nombre)}</span><span>${prov.escanos} ${prov.escanos === 1 ? "escaño" : "escaños"}</span></div>
          <p class="explica">${intro}</p>
          <div class="opciones-voto n${opciones.length}">${papeletas}</div>
        </article>

        <section class="escanos" aria-labelledby="t-escanos">
          <h2 id="t-escanos">Reparto estimado en ${esc(prov.nombre)}</h2>
          <div class="cuadros" role="img" aria-label="Reparto estimado de escaños">${cuadros}</div>
          <ul class="leyenda">${leyenda}</ul>
          <p class="nota-tabla">Con la media de encuestas, la izquierda sacaría ${izqCentral} de ${prov.escanos} escaños.</p>
        </section>

        <section style="display:grid;gap:12px" aria-labelledby="t-izq">
          <h2 id="t-izq">Todas las listas de izquierdas</h2>
          <p class="nota-tabla">Voto estimado, escaños estimados y cuántos votantes más le harían falta a cada lista. El nivel de confianza indica lo probable que es que esos votos acaben de verdad en un escaño más para la izquierda, teniendo en cuenta que las encuestas fallan. Los votos son aproximados (con la participación de 2023).</p>
          <div class="lista">${filas}</div>
        </section>
      </div>`;
  }

  // ---------- Pie ----------
  const fecha = new Date(E.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("pie").innerHTML = `
    <p>Encuestas: <a href="${E.fuenteUrl}" rel="noopener" target="_blank">${esc(E.fuente)}</a>, actualizada el ${fecha}.</p>
    <p>Resultados de 2023: <a href="${B.fuenteUrl}" rel="noopener" target="_blank">${esc(B.fuente)}</a>.</p>
    <p>Web independiente y sin cookies. Solo contamos visitas de forma anónima. Todo el cálculo se hace en tu navegador.</p>
    <p>Para cualquier cosa, escríbeme a <a href="mailto:votoutilzurdo@proton.me">votoutilzurdo@proton.me</a>.</p>`;

  // ---------- Inicio ----------
  let inicial = null;
  const h = decodeURIComponent((location.hash || "").slice(1));
  if (h) inicial = provincias.find((p) => slug(p) === h || p.ine === h);
  // Sin provincia en la dirección (#sevilla, #madrid...), la página empieza en blanco
  if (inicial) { input.value = inicial.nombre; mostrar(inicial); }
  window.addEventListener("hashchange", () => {
    const p = provincias.find((x) => slug(x) === decodeURIComponent(location.hash.slice(1)));
    if (p) { input.value = p.nombre; mostrar(p); }
  });
})();
