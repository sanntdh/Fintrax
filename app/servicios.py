"""Servicios clínicos transaccionales. Los valores [CALIBRAR] no son normas NASA."""
from dataclasses import asdict
from datetime import date, timedelta
import json
from statistics import median

from sqlalchemy import select

from app.db import (Alerta, AlertaEvento, Astronauta, Evaluacion, LineaBaseDB, Medicion,
                    ReglasVersion, ahora)
from app.schemas import MedicionIn
from enfermedades_espaciales import DatosComplementarios, Dosimetria, Estado, MedicionComparada
from parametros import Ambiente, FASES_CICLO, LineaBase, Perfil, REGLAS_DEFAULT, Reglas, Signos, evaluar, validar_entradas


class ErrorNegocio(Exception):
    def __init__(self, status, detalle):
        self.status, self.detalle = status, detalle
        super().__init__(detalle)


def reglas_activas(db):
    version = db.scalar(select(ReglasVersion).order_by(ReglasVersion.id.desc()).limit(1))
    if version is None:
        version = ReglasVersion(motivo="Valores iniciales [CALIBRAR]", contenido=REGLAS_DEFAULT.a_dict())
        db.add(version)
        db.flush()
    return version


def crear_version_reglas(db, cambios, creado_por=None, motivo="Calibración [CALIBRAR]"):
    vigente = reglas_activas(db).contenido
    contenido = {**vigente, **cambios}
    if isinstance(cambios.get("desv"), dict):
        contenido["desv"] = {**vigente["desv"], **cambios["desv"]}
    try:
        reglas = Reglas.desde_dict(contenido)
    except (ValueError, TypeError) as exc:
        raise ErrorNegocio(422, str(exc)) from exc
    version = ReglasVersion(contenido=reglas.a_dict(), creado_por=creado_por, motivo=motivo)
    db.add(version)
    db.flush()
    return version


def fase_del_dia(dia, dur=28):
    if type(dur) is not int or not 21 <= dur <= 45 or type(dia) is not int or not 1 <= dia <= dur:
        raise ValueError("día o duración del ciclo fuera de rango")
    if dia <= 5:
        return "menstrual"
    if dur - 15 <= dia <= dur - 13:
        return "ovulacion"
    return "folicular" if dia < dur - 15 else "lutea"


def derivar_fase(astro, ts):
    if astro.ciclo != "natural":
        return None, None
    if astro.ultima_menstruacion is None:
        return None, "Sin fecha de última menstruación: fase no estimable."
    dias = (ts.date() - astro.ultima_menstruacion).days
    if dias < 0:
        return None, "Lectura anterior a la última menstruación registrada: fase no estimable."
    if dias > 2 * astro.duracion_ciclo:
        return None, "Fecha de última menstruación con más de dos ciclos: actualizar; se asume ciclo regular."
    return fase_del_dia(dias % astro.duracion_ciclo + 1, astro.duracion_ciclo), "Fase estimada por calendario; supone ciclo regular [CALIBRAR]."


def obtener_astronauta(db, astro):
    astro = db.get(Astronauta, astro) if isinstance(astro, int) else astro
    if astro is None or not astro.activo:
        raise ErrorNegocio(404, "Astronauta no disponible")
    return astro


def _filtrar_mad(muestras):
    campos = ("fc", "pas", "fr", "temp", "spo2")
    if not muestras:
        return []
    centro = {k: median(getattr(m, k) for m in muestras) for k in campos}
    mad = {k: median(abs(getattr(m, k) - centro[k]) for m in muestras) for k in campos}
    return [m for m in muestras if all(
        abs(getattr(m, k) - centro[k]) <= 3.5 * 1.4826 * mad[k] if mad[k] else getattr(m, k) == centro[k]
        for k in campos)]


def calcular_linea_base(db, astro):
    astro = obtener_astronauta(db, astro)
    reglas = Reglas.desde_dict(reglas_activas(db).contenido)
    muestras = list(db.scalars(select(Medicion).where(Medicion.astronauta_id == astro.id,
                         Medicion.contexto == "preflight").order_by(Medicion.ts, Medicion.id)))
    general = _filtrar_mad(muestras)
    if astro.ciclo == "natural":
        sin_lutea = _filtrar_mad([m for m in muestras if m.fase_ciclo != "lutea"])
        if len(sin_lutea) >= reglas.min_muestras_base:
            general = sin_lutea
    if len(general) < reglas.min_muestras_base:
        raise ErrorNegocio(409, f"Hay {len(general)} muestras válidas; faltan {reglas.min_muestras_base-len(general)} para la línea base")
    previas = list(db.scalars(select(LineaBaseDB).where(LineaBaseDB.astronauta_id == astro.id,
                                                        LineaBaseDB.activa.is_(True))))
    for base in previas:
        base.activa = False
    nuevas = []
    for fase in (None, *FASES_CICLO):
        grupo = general if fase is None else _filtrar_mad([m for m in muestras if m.fase_ciclo == fase])
        minimo = reglas.min_muestras_base if fase is None else reglas.min_muestras_fase
        if len(grupo) < minimo:
            continue
        base = LineaBaseDB(astronauta_id=astro.id, fase_ciclo=fase, n_muestras=len(grupo),
                            masa_kg=astro.masa_kg, activa=True,
                            **{k: median(getattr(m, k) for m in grupo) for k in ("fc", "pas", "fr", "temp", "spo2")})
        db.add(base)
        nuevas.append(base)
    db.flush()
    return nuevas


def bases_activas(db, astro):
    filas = list(db.scalars(select(LineaBaseDB).where(LineaBaseDB.astronauta_id == astro.id,
                            LineaBaseDB.activa.is_(True)).order_by(LineaBaseDB.id)))
    return {b.fase_ciclo: b for b in filas}


def datos_base(base):
    return {k: getattr(base, k) for k in ("fc", "pas", "fr", "temp", "spo2")}


def marcar_desactualizada(db, astro, masa, reglas):
    for base in bases_activas(db, astro).values():
        if abs(masa - base.masa_kg) / base.masa_kg >= reglas.masa_cambio_recalcular - 1e-12:
            base.activa = False


def _complementarios(datos):
    if datos is None:
        return DatosComplementarios()
    datos = dict(datos)
    for campo, tipo in (("dosimetria", Dosimetria), ("densidad_osea", MedicionComparada), ("fuerza_muscular", MedicionComparada)):
        if datos.get(campo) is not None:
            datos[campo] = tipo(**datos[campo])
    return DatosComplementarios(**datos)


def serializar_resultado(r):
    return json.loads(json.dumps(asdict(r), allow_nan=False))


def _evento(db, alerta, accion, usuario=None, nota=None):
    db.add(AlertaEvento(alerta_id=alerta.id, actor=usuario.nombre if usuario else "sistema",
                       rol=usuario.rol if usuario else "sistema", accion=accion, nota=nota))


def emitir_alerta(db, astro_id, tipo, nivel, mensaje, evaluacion_id=None, ts=None):
    nivel = int(nivel)
    abierta = db.scalar(select(Alerta).where(Alerta.astronauta_id == astro_id, Alerta.tipo == tipo,
                                            Alerta.estado != "resuelta").order_by(Alerta.id))
    if abierta:
        abierta.ocurrencias += 1
        abierta.ultima_ts = max(abierta.ultima_ts, ts or ahora())
        if nivel > int(abierta.nivel):
            abierta.nivel = str(nivel)
            abierta.estado = "nueva"
            abierta.mensaje = mensaje
            abierta.evaluacion_id = evaluacion_id
            _evento(db, abierta, "escalada")
        else:
            _evento(db, abierta, "reiterada")
        return abierta
    nueva = Alerta(astronauta_id=astro_id, evaluacion_id=evaluacion_id, tipo=tipo, nivel=str(nivel),
                    mensaje=mensaje, estado="nueva", destinatarios=["astronauta", "medico", "tierra"],
                    ocurrencias=1, ultima_ts=ts or ahora())
    db.add(nueva)
    db.flush()
    _evento(db, nueva, "nueva")
    return nueva


def cambiar_alerta(db, alerta, accion, usuario, nota=None):
    alerta = db.get(Alerta, alerta) if isinstance(alerta, int) else alerta
    if alerta is None:
        raise ErrorNegocio(404, "Alerta no disponible")
    if accion == "reconocer":
        if alerta.estado != "nueva":
            raise ErrorNegocio(409, "Solo una alerta nueva puede reconocerse")
        alerta.estado = "reconocida"
    elif accion == "resolver":
        if alerta.estado not in ("nueva", "reconocida"):
            raise ErrorNegocio(409, "La alerta ya está resuelta")
        if not isinstance(nota, str) or not 3 <= len(nota.strip()) <= 500:
            raise ErrorNegocio(422, "Resolver exige una nota de 3 a 500 caracteres")
        alerta.estado = "resuelta"
    else:
        raise ErrorNegocio(409, "Transición inválida")
    _evento(db, alerta, accion, usuario, nota)
    db.flush()
    return alerta


def tendencia(evaluaciones, umbral=0.5):
    n = len(evaluaciones)
    if n < 4:
        return {"estado": "insuficiente", "pendiente": None, "puntos": n}
    valores = [e.news2_total for e in evaluaciones]
    centro_x = (n - 1) / 2
    centro_y = sum(valores) / n
    pendiente = sum((i-centro_x)*(v-centro_y) for i, v in enumerate(valores)) / sum((i-centro_x)**2 for i in range(n))
    estado = "empeorando" if pendiente >= umbral else "mejorando" if pendiente <= -umbral else "estable"
    return {"estado": estado, "pendiente": pendiente, "puntos": n}


def _alertas_evaluacion(db, e, reglas):
    r = e.resultado
    capas = r["niveles_capas"]
    if capas["news2"] >= 1:
        emitir_alerta(db, e.astronauta_id, "news2", capas["news2"], f"NEWS2 total {e.news2_total}", e.id, e.ts)
    if capas["ambiente"] >= 1:
        emitir_alerta(db, e.astronauta_id, "co2", capas["ambiente"], "CO2 de cabina elevado", e.id, e.ts)
    recientes = list(db.scalars(select(Evaluacion).where(Evaluacion.astronauta_id == e.astronauta_id,
                         Evaluacion.ts <= e.ts).order_by(Evaluacion.ts.desc(), Evaluacion.id.desc())
                         .limit(max(reglas.tendencia_ventana, reglas.persistencia_desviacion))))
    seguidas = 0
    for anterior in recientes:
        if anterior.resultado["niveles_capas"]["desviacion"] < 1:
            break
        seguidas += 1
    if capas["desviacion"] == 2 or (capas["desviacion"] == 1 and seguidas >= reglas.persistencia_desviacion):
        emitir_alerta(db, e.astronauta_id, "desviacion", capas["desviacion"], "Desviación de la línea base personal", e.id, e.ts)
    t = tendencia(list(reversed(recientes[:reglas.tendencia_ventana])), reglas.tendencia_pendiente)
    if t["estado"] == "empeorando" and e.news2_total >= 3:
        emitir_alerta(db, e.astronauta_id, "tendencia", 1, "Tendencia ascendente de NEWS2 [CALIBRAR]", e.id, e.ts)
    for c in r["condiciones"]:
        if c["estado"] in (Estado.SOSPECHA.value, Estado.LIMITE_SUPERADO.value):
            nivel = 2 if c["estado"] == Estado.LIMITE_SUPERADO.value else 1
            emitir_alerta(db, e.astronauta_id, "cribado:" + c["codigo"], nivel, c["nombre"] + ": requiere evaluación clínica", e.id, e.ts)


def registrar_medicion(db, astro, datos, usuario=None):
    astro = obtener_astronauta(db, astro)
    datos = MedicionIn.model_validate(datos) if isinstance(datos, dict) else datos
    # El lock por astronauta serializa alertas/versiones en motores con FOR UPDATE.
    db.scalar(select(Astronauta).where(Astronauta.id == astro.id).with_for_update())
    version = reglas_activas(db)
    reglas = Reglas.desde_dict(version.contenido)
    fase, aviso = derivar_fase(astro, datos.ts)
    fase = datos.fase_ciclo if datos.fase_ciclo is not None else fase
    p = Perfil(astro.sexo, astro.estatura_m, datos.masa_kg if datos.masa_kg is not None else astro.masa_kg,
               astro.edad, astro.ciclo, fase)
    s = Signos(**datos.signos.model_dump())
    ambiente = Ambiente("vuelo" if datos.contexto == "preflight" else datos.contexto, datos.co2_mmhg, datos.ejercicio)
    comp = datos.complementarios.model_dump() if datos.complementarios is not None else None
    try:
        validar_entradas(p, s, ambiente)
        bases = bases_activas(db, astro)
        base = datos_base(bases[None]) if None in bases else None
        fases = {k: datos_base(v) for k, v in bases.items() if k is not None}
        r = None if datos.contexto == "preflight" else evaluar(p, s, ambiente,
            LineaBase(**base) if base is not None else None, {k: LineaBase(**v) for k, v in fases.items()},
            reglas=reglas, complementarios=_complementarios(comp))
    except (ValueError, TypeError) as exc:
        raise ErrorNegocio(422, str(exc)) from exc
    # Hasta aquí no se ha escrito ninguna medición, evaluación ni cambio de masa.
    ultima = db.scalar(select(Medicion.ts).where(Medicion.astronauta_id == astro.id).order_by(Medicion.ts.desc()).limit(1))
    m = Medicion(astronauta_id=astro.id, ts=datos.ts, contexto=datos.contexto, **datos.signos.model_dump(),
                 co2_mmhg=datos.co2_mmhg, ejercicio=datos.ejercicio, fase_ciclo=fase,
                 masa_kg=datos.masa_kg, complementarios=comp, creado_por=usuario.id if usuario else None)
    db.add(m)
    db.flush()
    if datos.masa_kg is not None and (ultima is None or datos.ts >= ultima):
        marcar_desactualizada(db, astro, datos.masa_kg, reglas)
        astro.masa_kg = datos.masa_kg
    if r is None:
        return {"medicion": m, "evaluacion": None}
    astro.en_mision = True
    resultado = serializar_resultado(r)
    if aviso:
        resultado["notas"].append(aviso)
    entrada = {"perfil": asdict(p), "signos": asdict(s), "ambiente": asdict(ambiente),
               "base": base, "base_por_fase": fases, "complementarios": comp, "avisos": [aviso] if aviso else []}
    e = Evaluacion(medicion_id=m.id, astronauta_id=astro.id, ts=m.ts, nivel=int(r.nivel),
                   news2_total=r.news2_total, resultado=resultado, version_reglas=version.id, entrada=entrada)
    db.add(e)
    db.flush()
    _alertas_evaluacion(db, e, reglas)
    if base is None:
        aviso_base = emitir_alerta(db, astro.id, "sin_linea_base", 1,
                                  "Sin línea base personal: solicitar cálculo al médico", e.id, e.ts)
        aviso_base.destinatarios = ["medico"]
    if (ultima is None or datos.ts >= ultima) and ahora() - datos.ts <= timedelta(hours=reglas.horas_sin_medicion):
        for alerta in db.scalars(select(Alerta).where(Alerta.astronauta_id == astro.id,
                    Alerta.tipo == "sin_medicion", Alerta.estado != "resuelta")):
            alerta.estado = "resuelta"
            _evento(db, alerta, "resuelta_automaticamente", nota="Nueva lectura recibida")
    return {"medicion": m, "evaluacion": e}


def revisar_sin_medicion(db):
    reglas = Reglas.desde_dict(reglas_activas(db).contenido)
    generadas = []
    for astro in db.scalars(select(Astronauta).where(Astronauta.en_mision.is_(True), Astronauta.activo.is_(True))):
        ultima = db.scalar(select(Medicion.ts).where(Medicion.astronauta_id == astro.id,
                              Medicion.contexto != "preflight").order_by(Medicion.ts.desc()).limit(1))
        horas = (ahora() - (ultima or astro.creado)).total_seconds() / 3600
        if horas > reglas.horas_sin_medicion:
            nivel = 2 if horas > 3 * reglas.horas_sin_medicion else 1
            generadas.append(emitir_alerta(db, astro.id, "sin_medicion", nivel,
                                          "Sin medición reciente durante la misión"))
    db.flush()
    return generadas


def reproducir_evaluacion(db, evaluacion):
    e = db.get(Evaluacion, evaluacion) if isinstance(evaluacion, int) else evaluacion
    if e is None:
        raise ErrorNegocio(404, "Evaluación no disponible")
    version = db.get(ReglasVersion, e.version_reglas)
    entrada = e.entrada
    r = evaluar(Perfil(**entrada["perfil"]), Signos(**entrada["signos"]), Ambiente(**entrada["ambiente"]),
                LineaBase(**entrada["base"]) if entrada["base"] is not None else None,
                {k: LineaBase(**v) for k, v in entrada["base_por_fase"].items()},
                reglas=Reglas.desde_dict(version.contenido), complementarios=_complementarios(entrada["complementarios"]))
    resultado = serializar_resultado(r)
    campos = ("nivel", "news2_total", "niveles_capas", "alertas")
    return {"coincide": all(resultado[k] == e.resultado[k] for k in campos), "resultado": resultado,
            "version_reglas": e.version_reglas}


def resumen_astronauta(db, astro):
    astro = obtener_astronauta(db, astro)
    reglas = Reglas.desde_dict(reglas_activas(db).contenido)
    ultimas = list(db.scalars(select(Evaluacion).where(Evaluacion.astronauta_id == astro.id)
                     .order_by(Evaluacion.ts.desc(), Evaluacion.id.desc()).limit(reglas.tendencia_ventana)))
    return {"astronauta_id": astro.id, "en_mision": astro.en_mision,
            "linea_base_disponible": None in bases_activas(db, astro),
            "ultimo_news2": ultimas[0].news2_total if ultimas else None,
            "tendencia": tendencia(list(reversed(ultimas)), reglas.tendencia_pendiente)}
