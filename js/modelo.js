// Modelo de voto útil: proyección de encuestas a provincias, D'Hondt y simulación de escenarios.
// Funciona en el navegador (window.Modelo) y en Node (module.exports) para poder probarlo.
(function (raiz) {
  "use strict";

  const UMBRAL = 0.03; // 3 % de los votos válidos de la circunscripción (LOREG, art. 163)

  // ---------- Utilidades ----------
  function rng(semilla) {
    // mulberry32: generador pseudoaleatorio reproducible
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- D'Hondt ----------
  // votos: array de votos por candidatura; validos: votos válidos (candidaturas + blanco)
  // excluir: índice de una entrada que no opta a escaño ("Otros", que agrupa muchas listas pequeñas)
  function dhondt(votos, escanos, validos, excluir = -1) {
    const n = votos.length;
    const minimo = UMBRAL * validos;
    const res = new Array(n).fill(0);
    if (escanos === 1) {
      // Ceuta y Melilla: gana la lista más votada
      let mejor = 0;
      if (excluir === 0) mejor = 1;
      for (let i = 1; i < n; i++) if (i !== excluir && votos[i] > votos[mejor]) mejor = i;
      res[mejor] = 1;
      return res;
    }
    for (let e = 0; e < escanos; e++) {
      let mejor = -1, mejorQ = -1;
      for (let i = 0; i < n; i++) {
        if (i === excluir || votos[i] < minimo) continue;
        const q = votos[i] / (res[i] + 1);
        if (q > mejorQ) { mejorQ = q; mejor = i; }
      }
      if (mejor < 0) break;
      res[mejor]++;
    }
    return res;
  }

  // ---------- Proyección de la encuesta nacional a cada provincia ----------
  // Ajuste proporcional iterativo: cada candidatura conserva su forma provincial de 2023
  // y se escala hasta que la suma nacional coincide con la media de encuestas.
  function proyectar(base, encuestas) {
    const grupos = encuestas.grupos || {};
    const clave = (p) => grupos[p] || p;
    const fijos = encuestas.fijos || [];
    const objetivo = Object.assign({}, encuestas.voto);
    const sumaEnc = Object.values(objetivo).reduce((a, b) => a + b, 0);
    objetivo.OTROS = Math.max(0.5, 100 - sumaEnc);

    const provs = base.provincias;
    const pesos = provs.map((p) => Object.values(p.votos2023).reduce((a, b) => a + b, 0));
    const pesoTotal = pesos.reduce((a, b) => a + b, 0);
    const mult = {};
    Object.keys(objetivo).forEach((k) => (mult[k] = 1));

    let cuotas = [];
    for (let it = 0; it < 200; it++) {
      cuotas = provs.map((p) => {
        const s = {};
        let tot = 0;
        for (const [partido, v] of Object.entries(p.votos2023)) {
          const m = fijos.includes(partido) ? 1 : mult[clave(partido)];
          if (m === undefined) continue;
          s[partido] = v * m;
          tot += s[partido];
        }
        for (const k in s) s[k] /= tot;
        return s;
      });
      const nac = {};
      cuotas.forEach((s, i) => {
        for (const [partido, c] of Object.entries(s)) {
          if (fijos.includes(partido)) continue;
          const k = clave(partido);
          nac[k] = (nac[k] || 0) + (c * pesos[i]) / pesoTotal;
        }
      });
      let maxErr = 0;
      for (const k of Object.keys(objetivo)) {
        if (!nac[k]) continue;
        const f = objetivo[k] / 100 / nac[k];
        maxErr = Math.max(maxErr, Math.abs(f - 1));
        mult[k] *= f;
      }
      if (maxErr < 1e-7) break;
    }
    return provs.map((p, i) => ({
      ine: p.ine,
      cuotas: cuotas[i], // fracción del voto a candidaturas
      votosCand: pesos[i],
      blanco: p.blanco,
    }));
  }

  // ---------- Análisis de una provincia ----------
  // proy: elemento devuelto por proyectar(); prov: provincia de BASE2023
  // izquierda: array de claves de partido que cuentan como izquierda
  function analizar(prov, proy, encuestas, izquierda) {
    const partidos = Object.keys(proy.cuotas).sort((a, b) => proy.cuotas[b] - proy.cuotas[a]);
    const n = partidos.length;
    const base = partidos.map((p) => proy.cuotas[p]);
    const esIzq = partidos.map((p) => izquierda.includes(p));
    const idxIzq = partidos.map((p, i) => i).filter((i) => esIzq[i]);
    const ex = partidos.indexOf("OTROS");
    const grupos = encuestas.grupos || {};
    const clave = (p) => grupos[p] || p;
    const V = proy.votosCand;
    const validos = V + proy.blanco;
    const escanos = prov.escanos;
    const delta = (encuestas.empujon / 100) * validos;
    const S = encuestas.simulaciones;
    const sn = encuestas.incertidumbre.nacional;
    const sp = encuestas.incertidumbre.provincial;

    // Error nacional: la misma semilla en todas las provincias, para que sean coherentes entre sí
    const rNac = rng(20261129);
    const rProv = rng(parseInt(prov.ine, 10) * 7919 + 17);
    const clavesNac = Array.from(new Set(partidos.map(clave)));

    const sumEsc = new Array(n).fill(0);
    const alMenosUno = new Array(n).fill(0);
    const ganancia = new Array(n).fill(0); // escaños de izquierda ganados con el empujón
    let izqTotal = 0;
    const votos = new Array(n);

    for (let s = 0; s < S; s++) {
      const fn = {};
      clavesNac.forEach((k) => (fn[k] = Math.exp(sn * normal(rNac) - (sn * sn) / 2)));
      let tot = 0;
      for (let i = 0; i < n; i++) {
        const f = fn[clave(partidos[i])] * Math.exp(sp * normal(rProv) - (sp * sp) / 2);
        votos[i] = base[i] * f;
        tot += votos[i];
      }
      for (let i = 0; i < n; i++) votos[i] = (votos[i] / tot) * V;

      const r0 = dhondt(votos, escanos, validos, ex);
      let izq0 = 0;
      for (let i = 0; i < n; i++) {
        sumEsc[i] += r0[i];
        if (r0[i] > 0) alMenosUno[i]++;
        if (esIzq[i]) izq0 += r0[i];
      }
      izqTotal += izq0;

      for (const j of idxIzq) {
        votos[j] += delta;
        const r1 = dhondt(votos, escanos, validos + delta, ex);
        votos[j] -= delta;
        let izq1 = 0;
        for (let i = 0; i < n; i++) if (esIzq[i]) izq1 += r1[i];
        ganancia[j] += izq1 - izq0;
      }
    }

    // Escenario central (sin ruido): margen hasta el siguiente escaño
    const vc = base.map((c) => c * V);
    const rc = dhondt(vc, escanos, validos, ex);
    const minimo = UMBRAL * validos;
    // Para cada lista de izquierdas: cuántos votos más necesita para que la IZQUIERDA EN CONJUNTO
    // gane un escaño (quitándoselo a la derecha), y cuántos puede perder antes de que la izquierda
    // pierda uno. Se busca con D'Hondt real (búsqueda binaria), así cuenta la barrera y los empates entre listas de izquierdas.
    const izqDe = (r) => r.reduce((t, x, k) => t + (esIzq[k] ? x : 0), 0);
    const L0 = izqDe(rc);
    const reparto = (i, e) => {
      const w = vc.slice();
      w[i] = Math.max(0, w[i] + e);
      return dhondt(w, escanos, validos + e, ex);
    };
    const quien = (r, signo) => {
      // la lista no de izquierdas que pierde (signo -1) o gana (signo +1) un escaño
      for (let k = 0; k < n; k++) if (!esIzq[k] && (r[k] - rc[k]) * signo > 0) return partidos[k];
      return null;
    };
    const margenes = partidos.map((p, i) => {
      if (!esIzq[i]) return {};
      let faltan = Infinity, quitaria = null;
      if (izqDe(reparto(i, validos)) > L0) {
        let lo = 0, hi = validos;
        while (hi - lo > 20) { const m = (lo + hi) / 2; if (izqDe(reparto(i, m)) > L0) hi = m; else lo = m; }
        faltan = hi;
        quitaria = quien(reparto(i, hi), -1);
      }
      // Votos para el siguiente escaño de la propia lista (venga de quien venga)
      let faltanPropio = Infinity, quitariaPropio = null;
      if (reparto(i, validos)[i] > rc[i]) {
        let lo = 0, hi = validos;
        while (hi - lo > 20) { const m = (lo + hi) / 2; if (reparto(i, m)[i] > rc[i]) hi = m; else lo = m; }
        faltanPropio = hi;
        const r = reparto(i, hi);
        for (let k = 0; k < n; k++) if (k !== i && r[k] < rc[k]) quitariaPropio = partidos[k];
      }
      let colchon = null, ganaria = null;
      if (rc[i] > 0 && izqDe(reparto(i, -vc[i])) < L0) {
        let lo = 0, hi = vc[i];
        while (hi - lo > 20) { const m = (lo + hi) / 2; if (izqDe(reparto(i, -m)) < L0) hi = m; else lo = m; }
        colchon = hi;
        ganaria = quien(reparto(i, -hi), 1);
      }
      return { faltan, colchon, quitaria, ganaria, faltanPropio, quitariaPropio };
    });

    const filas = partidos.map((p, i) => ({
      partido: p,
      cuota: base[i],
      votosEst: vc[i],
      escanosCentral: rc[i],
      escanosMedia: sumEsc[i] / S,
      probEscano: alMenosUno[i] / S,
      ganancia: esIzq[i] ? ganancia[i] / S : null,
      izquierda: esIzq[i],
      faltan: margenes[i].faltan,
      colchon: margenes[i].colchon,
      quitaria: margenes[i].quitaria,
      ganaria: margenes[i].ganaria,
      faltanPropio: margenes[i].faltanPropio,
      quitariaPropio: margenes[i].quitariaPropio,
    }));
    return {
      ine: prov.ine,
      escanos,
      validos,
      delta,
      izquierdaMedia: izqTotal / S,
      filas,
    };
  }

  const api = { dhondt, proyectar, analizar, UMBRAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Modelo = api;
})(typeof window !== "undefined" ? window : globalThis);
