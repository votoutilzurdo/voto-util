#!/usr/bin/env python3
"""Genera datos/base2023.js a partir de los resultados oficiales del 23J (2023).

Fuente: Ministerio del Interior, Infoelectoral, fichero 02202307_TOTA.zip
(copia ya procesada en herramientas/congreso-2023-oficial.json).

Qué hace:
  1. Agrupa las candidaturas de 2023 en las candidaturas que se presentan el 29-N de 2026.
  2. Aplica los escaños de 2026 (Madrid pasa a 38 y Cádiz a 8; el resto igual que en 2023).
  3. Escribe una "semilla" de voto por candidatura y provincia. La web la ajusta después
     a la media de encuestas que hay en datos/encuestas.js.

Uso:  python3 herramientas/generar_base.py
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

ESCANOS_2026 = {"28": 38, "11": 8}  # cambios respecto a 2023 (Real Decreto de convocatoria, 6-10-2026)

COMUNIDAD = {
    "04": "AND", "11": "AND", "14": "AND", "18": "AND", "21": "AND", "23": "AND", "29": "AND", "41": "AND",
    "22": "ARA", "44": "ARA", "50": "ARA", "33": "AST", "07": "BAL", "35": "CAN", "38": "CAN", "39": "CTB",
    "02": "CLM", "13": "CLM", "16": "CLM", "19": "CLM", "45": "CLM",
    "05": "CYL", "09": "CYL", "24": "CYL", "34": "CYL", "37": "CYL", "40": "CYL", "42": "CYL", "47": "CYL", "49": "CYL",
    "08": "CAT", "17": "CAT", "25": "CAT", "43": "CAT", "51": "CEU", "52": "MEL",
    "03": "VAL", "12": "VAL", "46": "VAL", "06": "EXT", "10": "EXT",
    "15": "GAL", "27": "GAL", "32": "GAL", "36": "GAL", "28": "MAD", "30": "MUR", "31": "NAV",
    "01": "PV", "20": "PV", "48": "PV", "26": "RIO",
}

NOMBRE_CORTO = {
    "03": "Alicante", "12": "Castellón", "46": "Valencia", "01": "Álava", "07": "Islas Baleares",
}

# Cabecera nacional de 2023 -> candidatura del 29-N
CABECERA = {
    "000005": "PP", "000074": "PP",          # UPN va con el PP en Navarra
    "000002": "PSOE", "000006": "VOX",
    "000010": "SUMAR",                        # se reparte abajo entre FA / Compromís-FV / Podemos
    "000032": "FA",                           # NC-BC va dentro de la lista del Frente Amplio en Canarias
    "000050": "ERC", "000057": "JUNTS", "000071": "BILDU", "000075": "PNV",
    "000065": "BNG", "000031": "CC", "000012": "ADELANTE",
}

# Candidaturas locales que en 2023 tuvieron opciones reales de escaño. Se modelan aparte
# (no cuentan como izquierda). El resto de partidos pequeños va a "OTROS", que no reparte escaños.
LOCALES = {"000043": "Soria ¡Ya!", "000023": "Teruel Existe", "000039": "UPL", "000035": "XAV"}
LOCALES_SIGLAS = {"CpM": "Coalición por Melilla", "XAV": "Por Ávila (XAV)"}

# Peso de Podemos dentro del antiguo voto de Sumar donde Podemos se presenta solo.
# Solo fija la forma del reparto entre provincias: el nivel lo ajusta la encuesta.
PODEMOS_EN_SUMAR = 0.20
# Donde Podemos va integrado en otra lista (no hay papeleta propia de Podemos)
PODEMOS_INTEGRADO = {"VAL", "CAN", "BAL", "CAT"}

# Adelante Andalucía: % por provincia en las autonómicas andaluzas del 17-5-2026.
# Solo se usa la forma del reparto entre provincias andaluzas.
ADELANTE_PERFIL = {"04": 3.1, "11": 14.3, "14": 8.3, "18": 6.8, "21": 8.0, "23": 4.4, "29": 9.3, "41": 12.9}

# SALF no se presentó en 2023: semilla uniforme (1 % en cada provincia).
SALF_SEMILLA = 0.01


def main():
    src = json.load(open(os.path.join(AQUI, "congreso-2023-oficial.json"), encoding="utf-8"))
    provincias = []
    for c in src["circunscripciones"]:
        ine = c["codigoINE"]
        ccaa = COMUNIDAD[ine]
        v = {}
        local = None
        for k in c["candidaturas"]:
            p = CABECERA.get(k["cabeceraNacional"], "OTROS")
            if p == "OTROS" and (k["cabeceraNacional"] in LOCALES or k["siglas"] in LOCALES_SIGLAS) \
                    and k["votos"] >= 0.03 * c["votosCandidaturas"]:
                p = "LOCAL"
                local = LOCALES_SIGLAS.get(k["siglas"]) or LOCALES[k["cabeceraNacional"]]
            v[p] = v.get(p, 0) + k["votos"]
        sumar = v.pop("SUMAR", 0)
        if ccaa == "VAL":
            v["COMPROMIS"] = v.get("COMPROMIS", 0) + sumar
        elif ccaa in PODEMOS_INTEGRADO:
            v["FA"] = v.get("FA", 0) + sumar
        else:
            v["FA"] = v.get("FA", 0) + sumar * (1 - PODEMOS_EN_SUMAR)
            v["PODEMOS"] = sumar * PODEMOS_EN_SUMAR
        total = c["votosCandidaturas"]
        if ccaa == "AND":
            v["ADELANTE"] = v.get("ADELANTE", 0) + total * ADELANTE_PERFIL[ine] / 100
        else:
            v.pop("ADELANTE", None)  # Adelante solo se presenta en Andalucía
        v["SALF"] = total * SALF_SEMILLA
        if "VOX" not in v:
            # En 2023 se anuló la lista de Vox en Santa Cruz de Tenerife. Para 2026 se usa como
            # semilla el % que sacó Vox en Las Palmas.
            lp = next(x for x in src["circunscripciones"] if x["codigoINE"] == "35")
            vox_lp = sum(k["votos"] for k in lp["candidaturas"] if k["cabeceraNacional"] == "000006")
            v["VOX"] = total * vox_lp / lp["votosCandidaturas"]
        nombre = NOMBRE_CORTO.get(ine, c["nombre"])
        provincias.append({
            "ine": ine,
            "nombre": nombre,
            "oficial": c["nombre"],
            "ccaa": ccaa,
            "escanos": ESCANOS_2026.get(ine, c["escanos"]),
            "escanos2023": c["escanos"],
            "local": local,
            "blanco": c["votosBlanco"],
            "votos2023": {k: round(x) for k, x in sorted(v.items(), key=lambda t: -t[1]) if round(x) > 0},
            "resultado2023": [
                {"siglas": k["siglas"], "votos": k["votos"], "escanos": k["escanosOficiales"]}
                for k in c["candidaturas"] if k["votos"] >= 0.01 * total or k["escanosOficiales"] > 0
            ],
        })
    provincias.sort(key=lambda p: p["nombre"].replace("Á", "A"))
    assert sum(p["escanos"] for p in provincias) == 350
    out = {
        "fuente": "Ministerio del Interior (Infoelectoral), resultados definitivos del Congreso, 23 de julio de 2023",
        "fuenteUrl": "https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/02202307_TOTA.zip",
        "provincias": provincias,
    }
    destino = os.path.join(RAIZ, "datos", "base2023.js")
    with open(destino, "w", encoding="utf-8") as f:
        f.write("// Generado por herramientas/generar_base.py. No editar a mano.\n")
        f.write("window.BASE2023 = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("Escrito", destino, len(provincias), "provincias")


if __name__ == "__main__":
    main()
