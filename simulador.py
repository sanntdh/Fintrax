"""Demostracion local con datos ficticios; no conecta a la API ni a un IdP."""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from random import Random
from tempfile import TemporaryDirectory

from cryptography.fernet import Fernet

from app.almacen import Almacen
from app.clinica import Clinica
from app.esquemas import EvaluacionEntrada, PerfilEntrada
from reglas import MOTOR_VERSION, cargar_reglas

ESCENARIOS = ("estable", "co2_persistente", "urgencia_news2", "regreso_gravedad", "eva", "cribado_complementario")
AVISO = ("DATOS SINTETICOS: perfiles y eventos ficticios para demostracion; "
         "no son observaciones reales ni validacion clinica. "
         "Los limites de dosimetria del ejemplo NO son recomendaciones medicas.")
INICIO = datetime(2030, 1, 15, 8, tzinfo=timezone.utc)


def _entero(nombre, valor, minimo, maximo):
    if type(valor) is not int or not minimo <= valor <= maximo:
        raise ValueError(f"{nombre}: entero entre {minimo} y {maximo} requerido")
    return valor


def _tripulante(indice, rng):
    escenario = ESCENARIOS[indice % len(ESCENARIOS)]
    sexo = "F" if indice % 2 else "M"
    ciclo = ("suprimido" if escenario == "regreso_gravedad" else "natural") if sexo == "F" else "no_aplica"
    p = {"sexo": sexo, "estatura_m": round(rng.uniform(1.60, 1.85), 2),
         "masa_kg": round(rng.uniform(60, 85), 1), "edad": rng.randint(30, 48), "ciclo": ciclo}
    if ciclo == "natural":
        p.update(ultima_menstruacion=(INICIO.date() - timedelta(days=14)).isoformat(), duracion_ciclo=28)
    perfil = PerfilEntrada(**p).model_dump(mode="json")
    signos = {"fc": rng.randint(60, 68), "fr": rng.randint(13, 15), "pas": rng.randint(114, 124),
              "temp": round(rng.uniform(36.5, 36.8), 1), "spo2": rng.randint(98, 99)}
    return {"alias": f"SIM-{indice + 1:02d}", "escenario": escenario, "perfil": perfil,
            "signos_base": signos, "mediciones": []}


def _evento(tripulante, paso):
    signos = dict(tripulante["signos_base"])
    ambiente, complementarios = {}, {}
    escenario = tripulante["escenario"]
    if escenario == "co2_persistente" and 1 <= paso <= 3:
        ambiente["co2_mmhg"] = 4.2
    elif escenario == "urgencia_news2" and paso == 2:
        signos.update(fc=135, fr=26, pas=95, spo2=92, temp=38.6, conciencia="confuso")
    elif escenario == "regreso_gravedad":
        ambiente["fase"] = "regreso_gravedad"
        if paso < 3:
            signos["pas"] -= 17
    elif escenario == "eva":
        ambiente.update(fase="eva", ejercicio=True)
        signos["fc"] += 16
        signos["fr"] += 2
    elif escenario == "cribado_complementario" and paso >= 3:
        complementarios = {
            "dosimetria": {"dosis_msv": 12, "limite_msv": 10, "periodo": "VENTANA FICTICIA, no limite clinico"},
            "densidad_osea": {"basal": 1.0, "actual": 0.96, "cambio_minimo": 0.02, "comparables": True},
            "fuerza_muscular": {"basal": 100, "actual": 85, "cambio_minimo": 5, "comparables": True},
            "cambio_visual": True, "alteracion_sueno": True,
        }
    return signos, ambiente, complementarios


def _registrar(servicio, medico, a, tripulante, signos, ambiente, complementarios, instante, preflight):
    entrada = EvaluacionEntrada(
        astronauta_id=a, timestamp=instante, signos=signos, ambiente=ambiente,
        complementarios=complementarios, preflight=preflight, reposo=preflight,
        fase_ciclo="lutea" if tripulante["perfil"]["ciclo"] == "natural" else None,
    )
    r = servicio.evaluar(medico, entrada, instante)
    tripulante["mediciones"].append({
        "timestamp": r["timestamp"], "preflight": preflight, "signos": signos,
        "ambiente": ambiente, "complementarios": complementarios,
        "fase_declarada_ficticia": entrada.fase_ciclo,
        "nivel": r["resultado"]["nivel"], "news2": r["resultado"]["news2_total"],
        "linea_base_disponible": r["linea_base_disponible"],
        "emitir_alerta": r["temporal"]["emitir"], "temporal": r["temporal"],
        "condiciones": [{"codigo": c["codigo"], "estado": c["estado"]} for c in r["resultado"]["condiciones"]],
    })


def simular(*, semilla=42, tripulantes=6, lecturas=8):
    """Misma semilla/parametros/reglas/motor producen el mismo informe.

    No recibe una URL, ruta de base, token o perfil real. El almacen y la clave
    se crean para cada ejecucion y se destruyen al salir, incluso ante errores.
    """
    _entero("semilla", semilla, 0, 2**32 - 1)
    _entero("tripulantes", tripulantes, 1, 12)
    _entero("lecturas", lecturas, 5, 48)
    reglas = cargar_reglas()
    # Los eventos son un guion con tres lecturas de CO2 y cinco muestras basales
    # por defecto; se informa siempre la configuracion usada, no un resultado esperado.
    rng = Random(semilla)
    tripulacion = [_tripulante(i, rng) for i in range(tripulantes)]
    with TemporaryDirectory(prefix="tripulacion-sintetica-") as temporal:
        url = "sqlite:///" + str(Path(temporal, "sintetico.db"))
        db = Almacen(url, Fernet.generate_key().decode(), "https://identidad-sintetica.invalid")
        try:
            db.inicializar()
            db.dar_rol("medico-ficticio", "oficial_medico")
            medico = db.principal("medico-ficticio")
            servicio = Clinica(db, reglas)
            ids = [servicio.crear(medico, t["perfil"], INICIO - timedelta(minutes=1))["id"] for t in tripulacion]
            for paso in range(reglas.min_muestras):
                instante = INICIO + timedelta(minutes=paso * 5)
                for a, t in zip(ids, tripulacion):
                    _registrar(servicio, medico, a, t, dict(t["signos_base"]), {}, {}, instante, True)
            mision = INICIO + timedelta(minutes=reglas.min_muestras * 5 + 30)
            for paso in range(lecturas):
                instante = mision + timedelta(minutes=paso * 10)
                for a, t in zip(ids, tripulacion):
                    signos, ambiente, complementarios = _evento(t, paso)
                    _registrar(servicio, medico, a, t, signos, ambiente, complementarios, instante, False)
            cierre = instante + timedelta(minutes=1)
            for a, t in zip(ids, tripulacion):
                # Accion medica ficticia y explicita tras la recuperacion simulada;
                # la vuelta a valores normales no resuelve alertas automaticamente.
                if t["mediciones"][-1]["nivel"] == "BAJO":
                    for aviso in servicio.alertas(medico, a, cierre)["items"]:
                        if aviso["destinatario"] == "oficial_medico" and aviso["estado"] == "nuevo":
                            servicio.transicion(medico, aviso["id"], "reconocido", cierre)
                            servicio.transicion(medico, aviso["id"], "resuelto", cierre + timedelta(seconds=1))
                        elif aviso["destinatario"] == "astronauta" and aviso["estado"] == "nuevo":
                            servicio.transicion(medico, aviso["id"], "reconocido", cierre)
            ausencia = cierre + timedelta(hours=reglas.ausencia_horas + 1)
            servicio.comprobar_ausencia(medico, ids[-1], ausencia)
            for a, t in zip(ids, tripulacion):
                t["evaluaciones_guardadas"] = len(servicio.historial(medico, a, ausencia, limite=100)["items"])
                t["alertas"] = [{
                    "tipo": aviso["tipo"], "destinatario": aviso["destinatario"], "estado": aviso["estado"],
                    "eventos": [{"estado": e["estado"], "timestamp": e["timestamp"],
                                 "actor": "medico_ficticio" if e["actor"] == medico.actor else "sistema"}
                                for e in aviso["eventos"]],
                } for aviso in servicio.alertas(medico, a, ausencia)["items"]]
                # UUIDs internos no son parte del informe reproducible.
                t["alertas"].sort(key=lambda a: (a["tipo"], a["destinatario"]))
            informe = {"sintetico": True, "aviso": AVISO, "semilla": semilla,
                       "inicio": INICIO.isoformat(), "reglas_version": reglas.version,
                       "reglas_hash": reglas.huella, "motor_version": MOTOR_VERSION,
                       "politicas": {"min_muestras": reglas.min_muestras,
                                     "lecturas_consecutivas": reglas.lecturas_consecutivas,
                                     "ausencia_horas": reglas.ausencia_horas},
                       "tripulacion": tripulacion}
        finally:
            db.engine.dispose()
    return json.loads(json.dumps(informe, allow_nan=False))


def resumen(informe):
    lineas = [informe["aviso"], f"Semilla: {informe['semilla']} | Reglas: {informe['reglas_version']}"]
    niveles = {"BAJO": 0, "MEDIO": 1, "ALTO": 2}
    for t in informe["tripulacion"]:
        maximo = max((l["nivel"] for l in t["mediciones"]), key=niveles.get)
        estados = {e: sum(a["estado"] == e for a in t["alertas"]) for e in ("nuevo", "reconocido", "resuelto")}
        hallazgos = sum(c["estado"] in ("hallazgo_compatible_requiere_evaluacion",
                                        "limite_de_protocolo_alcanzado_o_superado")
                        for c in t["mediciones"][-1]["condiciones"])
        lineas.append(f"{t['alias']} | {t['escenario']} | {t['evaluaciones_guardadas']} evaluaciones "
                      f"| riesgo maximo {maximo} | hallazgos complementarios {hallazgos} | alertas {estados}")
    lineas.append("Sin servidor, red ni datos reales. Base temporal eliminada; JSON disponible con --formato json.")
    return "\n".join(lineas)


def main(argv=None):
    parser = argparse.ArgumentParser(description=AVISO)
    parser.add_argument("--semilla", type=int, default=42, help="Semilla reproducible de 0 a 4294967295 (42)")
    parser.add_argument("--tripulantes", type=int, default=6, help="Perfiles ficticios, de 1 a 12 (6)")
    parser.add_argument("--lecturas", type=int, default=8, help="Lecturas en mision por persona, de 5 a 48 (8); preflight adicional")
    parser.add_argument("--formato", choices=("resumen", "json"), default="resumen", help="Formato de salida (resumen)")
    args = parser.parse_args(argv)
    try:
        informe = simular(semilla=args.semilla, tripulantes=args.tripulantes, lecturas=args.lecturas)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(informe, ensure_ascii=False, indent=2) if args.formato == "json" else resumen(informe))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
