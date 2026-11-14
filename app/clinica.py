from dataclasses import asdict
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

from sqlalchemy import select

from enfermedades_espaciales import DatosComplementarios, Dosimetria, MedicionComparada
from parametros import Ambiente, LineaBase, Perfil, Riesgo, Signos, evaluar
from reglas import MOTOR_VERSION, Reglas
from servicios import calcular_base, estimar_fase, temporal
from app.almacen import (ErrorServicio, alerta, asignacion, astronauta, evaluacion, evento_alerta,
                         linea_base, medicion, perfil, regla, uid)


def utc(segundos):
    return datetime.fromtimestamp(segundos, timezone.utc)


def motor_hash():
    raiz = Path(__file__).resolve().parent.parent
    archivos = ("parametros.py", "enfermedades_espaciales.py", "validacion.py", "reglas.py",
                "servicios.py", "app/clinica.py")
    return sha256(b"".join(n.encode() + (raiz / n).read_bytes() for n in archivos)).hexdigest()


def resultado_json(resultado):
    datos = asdict(resultado)
    datos["nivel"] = resultado.nivel.name
    datos["niveles_capas"] = {k: v.name for k, v in resultado.niveles_capas.items()}
    return datos


def complementarios_desde_dict(datos):
    datos = dict(datos)
    for campo, clase in [("dosimetria", Dosimetria), ("densidad_osea", MedicionComparada),
                          ("fuerza_muscular", MedicionComparada)]:
        if datos.get(campo) is not None:
            datos[campo] = clase(**datos[campo])
    return DatosComplementarios(**datos)


class Clinica:
    def __init__(self, db, reglas):
        self.db, self.reglas = db, reglas
        self.motor = motor_hash()

    def crear(self, principal, datos, ahora):
        self.db.autorizar(principal, None, "crear_astronauta", ahora, {"oficial_medico"})
        self.validar_calendario(datos, ahora)
        a, p = uid(), uid()
        with self.db.engine.begin() as c:
            c.execute(astronauta.insert().values(id=a, creado=ahora.timestamp(), perfil_actual=p))
            c.execute(perfil.insert().values(id=p, astronauta_id=a, creado=ahora.timestamp(), datos=self.db.sellar(datos)))
            c.execute(asignacion.insert().values(id=uid(), actor=principal.actor, astronauta_id=a))
            self.db.registrar(principal.actor, a, "crear_astronauta", "completado", ahora, c)
        return {"id": a, "perfil_id": p}

    def validar_calendario(self, datos, ahora):
        ultima = datos.get("ultima_menstruacion")
        if ultima and datetime.fromisoformat(ultima).date() > ahora.date():
            raise ErrorServicio(422, "fecha de calendario posterior al momento actual")

    def actualizar_perfil(self, principal, a, datos, ahora):
        self.db.autorizar(principal, a, "actualizar_perfil", ahora, {"oficial_medico", "astronauta"})
        self.validar_calendario(datos, ahora)
        p = uid()
        with self.db.engine.begin() as c:
            self.db.bloquear(c, a)
            c.execute(perfil.insert().values(id=p, astronauta_id=a, creado=ahora.timestamp(), datos=self.db.sellar(datos)))
            c.execute(astronauta.update().where(astronauta.c.id == a).values(perfil_actual=p))
            self.db.registrar(principal.actor, a, "actualizar_perfil", "completado", ahora, c)
        return {"id": a, "perfil_id": p}

    def guardar_reglas(self, c):
        r = self.reglas
        fila = c.execute(select(regla).where(regla.c.version == r.version)).mappings().first()
        if fila and fila["id"] != r.huella:
            raise ErrorServicio(409, "Version de reglas reutilizada con contenido diferente")
        if fila is None:
            c.execute(regla.insert().values(id=r.huella, version=r.version, datos=json.dumps(r.snapshot(), sort_keys=True)))

    def _bases(self, c, a, p, datos_muestra):
        if datos_muestra["preflight"]:
            filas = c.execute(select(medicion.c.datos).where(
                medicion.c.astronauta_id == a, medicion.c.perfil_id == p,
                medicion.c.preflight.is_(True)).order_by(medicion.c.timestamp.desc()).limit(1000)).scalars().all()
            muestras = [self.db.abrir(f) for f in filas]
            for fase in ("general", "menstrual", "folicular", "ovulacion", "lutea"):
                grupo = [Signos(**m["signos"]) for m in muestras if m["apta_base"]
                         and (fase == "general" or m["fase_ciclo"] == fase)]
                resumen = calcular_base(grupo, self.reglas)
                if resumen["base"] is not None:
                    c.execute(linea_base.insert().values(
                        id=uid(), astronauta_id=a, perfil_id=p, reglas_hash=self.reglas.huella,
                        fase=self.db.actor("fase:" + fase), creado=datos_muestra["timestamp"],
                        datos=self.db.sellar(resumen)))
        filas = c.execute(select(linea_base).where(linea_base.c.perfil_id == p,
                          linea_base.c.reglas_hash == self.reglas.huella).order_by(linea_base.c.creado)).mappings().all()
        bases = {f["fase"]: self.db.abrir(f["datos"])["base"] for f in filas}
        general = bases.get(self.db.actor("fase:general"))
        fases = {fase: bases[self.db.actor("fase:" + fase)] for fase in ("menstrual", "folicular", "ovulacion", "lutea")
                 if self.db.actor("fase:" + fase) in bases}
        return general, fases

    def evaluar(self, principal, entrada, ahora):
        a = str(entrada.astronauta_id)
        self.db.autorizar(principal, a, "evaluar", ahora, {"oficial_medico", "astronauta"})
        if entrada.signos.hipercapnico and principal.rol != "oficial_medico":
            self.db.registrar(principal.actor, a, "seleccionar_escala2", "denegado", ahora)
            raise ErrorServicio(403, "Escala NEWS2 2 requiere operador medico e indicacion clinica")
        instante = entrada.timestamp.astimezone(timezone.utc)
        if instante > ahora:
            raise ErrorServicio(422, "timestamp no puede ser futuro")
        with self.db.engine.begin() as c:
            astro = self.db.bloquear(c, a)
            ultima = c.execute(select(medicion.c.timestamp).where(medicion.c.astronauta_id == a)
                               .order_by(medicion.c.timestamp.desc()).limit(1)).scalar_one_or_none()
            if ultima is not None and instante.timestamp() <= ultima:
                raise ErrorServicio(409, "Se requiere una medicion posterior a la ultima registrada")
            p = self.db.abrir(c.execute(select(perfil.c.datos).where(perfil.c.id == astro["perfil_actual"])).scalar_one())
            core = {k: v for k, v in p.items() if k not in ("ultima_menstruacion", "duracion_ciclo")}
            core["fase_ciclo"] = entrada.fase_ciclo
            try:
                perfil_dominio = Perfil(**core)
            except ValueError as exc:
                raise ErrorServicio(422, str(exc)) from exc
            fase_estimada = None
            if p.get("ultima_menstruacion"):
                try:
                    fase_estimada = estimar_fase(datetime.fromisoformat(p["ultima_menstruacion"]).date(),
                                                 p["duracion_ciclo"], instante.date(), self.reglas)
                except ValueError as exc:
                    raise ErrorServicio(422, "Medicion incompatible con el calendario registrado") from exc
            signos, ambiente = entrada.signos.dominio(), entrada.ambiente.dominio()
            comp = entrada.complementarios.dominio()
            resultado_sin_base = evaluar(perfil_dominio, signos, ambiente, complementarios=comp, reglas=self.reglas)
            mid, eid = uid(), uid()
            muestra = {"signos": asdict(signos), "ambiente": asdict(ambiente),
                       "complementarios": asdict(comp), "fase_ciclo": entrada.fase_ciclo,
                       "preflight": entrada.preflight, "timestamp": instante.timestamp(),
                       "apta_base": entrada.preflight and entrada.reposo and resultado_sin_base.news2_total == 0}
            self.guardar_reglas(c)
            c.execute(medicion.insert().values(id=mid, astronauta_id=a, perfil_id=astro["perfil_actual"],
                      timestamp=instante.timestamp(), preflight=entrada.preflight, datos=self.db.sellar(muestra)))
            base, fases = self._bases(c, a, astro["perfil_actual"], muestra)
            r = evaluar(perfil_dominio, signos, ambiente, LineaBase(**base) if base else None,
                        {k: LineaBase(**v) for k, v in fases.items()}, complementarios=comp, reglas=self.reglas)
            anteriores = c.execute(select(evaluacion.c.datos).where(evaluacion.c.astronauta_id == a)
                                   .order_by(evaluacion.c.timestamp.desc()).limit(self.reglas.lecturas_consecutivas)).scalars().all()
            previas = []
            for dato in reversed(anteriores):
                guardado = self.db.abrir(dato)
                if (guardado["perfil_id"] != astro["perfil_actual"]
                        or guardado["salida"]["reglas_hash"] != self.reglas.huella
                        or guardado["preflight"] != entrada.preflight):
                    previas = []
                    continue
                salida = guardado["salida"]
                previas.append({"timestamp": datetime.fromisoformat(salida["timestamp"]),
                                "news2": salida["resultado"]["news2_total"],
                                "nivel": Riesgo[salida["resultado"]["nivel"]].value})
            urgente = r.news2_total >= 5 or any(v == 3 for v in r.news2_desglose.values())
            decision = temporal(previas, instante, r.nivel.value, r.news2_total, urgente, self.reglas)
            salida = {"id": eid, "timestamp": instante.isoformat(), "resultado": resultado_json(r),
                      "temporal": decision, "fase_estimada": fase_estimada,
                      "linea_base_disponible": bool(base or entrada.fase_ciclo in fases),
                      "reglas_version": self.reglas.version, "reglas_hash": self.reglas.huella,
                      "motor_version": MOTOR_VERSION, "motor_hash": self.motor}
            snapshot = {"salida": salida, "perfil_id": astro["perfil_actual"], "perfil": core,
                        "preflight": entrada.preflight, "muestra": muestra, "base": base, "fases": fases,
                        "reglas": self.reglas.snapshot(),
                        "previas": [{**v, "timestamp": v["timestamp"].isoformat()} for v in previas]}
            c.execute(evaluacion.insert().values(id=eid, astronauta_id=a, medicion_id=mid,
                      timestamp=instante.timestamp(), datos=self.db.sellar(snapshot)))
            if decision["emitir"]:
                tipo = "riesgo_alto" if r.nivel == Riesgo.ALTO else "news2_urgente" if urgente else "persistente"
                self.emitir(c, a, tipo, {"evaluacion_id": eid, "nivel": r.nivel.name}, ahora)
            self.db.registrar(principal.actor, a, "evaluar", "completado", ahora, c)
        return salida

    def emitir(self, c, a, tipo, datos, ahora):
        for destinatario in ("astronauta", "oficial_medico", "tierra"):
            existe = c.execute(select(alerta.c.id).where(alerta.c.astronauta_id == a,
                               alerta.c.tipo == tipo, alerta.c.destinatario == destinatario,
                               alerta.c.estado != "resuelto")).first()
            if existe:
                continue
            aid = uid()
            c.execute(alerta.insert().values(id=aid, astronauta_id=a, tipo=tipo,
                      destinatario=destinatario, estado="nuevo", creado=ahora.timestamp(), datos=self.db.sellar(datos)))
            c.execute(evento_alerta.insert().values(id=uid(), alerta_id=aid, actor="sistema", estado="nuevo",
                      timestamp=ahora.timestamp(), secuencia=0))

    def historial(self, principal, a, ahora, limite=50, desplazamiento=0):
        self.db.autorizar(principal, a, "leer_historial", ahora)
        with self.db.engine.connect() as c:
            datos = c.execute(select(evaluacion.c.datos).where(evaluacion.c.astronauta_id == a)
                              .order_by(evaluacion.c.timestamp.desc(), evaluacion.c.id)
                              .limit(limite).offset(desplazamiento)).scalars().all()
        items = [self.db.abrir(d)["salida"] for d in datos]
        if principal.rol == "tierra":
            for item in items:
                item["fase_estimada"] = None
                item["resultado"]["notas"] = []
        return {"items": items}

    def alertas(self, principal, a, ahora):
        self.db.autorizar(principal, a, "leer_alertas", ahora)
        with self.db.engine.connect() as c:
            consulta = select(alerta).where(alerta.c.astronauta_id == a)
            if principal.rol != "oficial_medico":
                consulta = consulta.where(alerta.c.destinatario == principal.rol)
            filas = c.execute(consulta.order_by(alerta.c.creado.desc(), alerta.c.id).limit(100)).mappings().all()
            items = []
            for f in filas:
                eventos = c.execute(select(evento_alerta.c.actor, evento_alerta.c.estado, evento_alerta.c.timestamp)
                                    .where(evento_alerta.c.alerta_id == f["id"])
                                    .order_by(evento_alerta.c.secuencia)).mappings().all()
                items.append({k: f[k] for k in ("id", "tipo", "destinatario", "estado", "creado")}
                             | {"datos": self.db.abrir(f["datos"]), "eventos": [dict(e) for e in eventos]})
        return {"items": items}

    def transicion(self, principal, aid, estado, ahora):
        with self.db.engine.connect() as c:
            a = c.execute(select(alerta.c.astronauta_id).where(alerta.c.id == aid)).scalar_one_or_none()
        if a is None:
            self.db.registrar(principal.actor, aid, "cambiar_alerta", "denegado", ahora)
            raise ErrorServicio(404, "Recurso no disponible")
        self.db.autorizar(principal, a, "cambiar_alerta", ahora)
        with self.db.engine.begin() as c:
            self.db.bloquear(c, a)
            f = c.execute(select(alerta).where(alerta.c.id == aid)).mappings().one()
            if principal.rol != "oficial_medico" and (principal.rol != f["destinatario"] or estado == "resuelto"):
                permitido = False
            else:
                permitido = True
                esperado = "nuevo" if estado == "reconocido" else "reconocido"
                if f["estado"] != esperado:
                    raise ErrorServicio(409, "Transicion de alerta no permitida")
                c.execute(alerta.update().where(alerta.c.id == aid).values(estado=estado))
                c.execute(evento_alerta.insert().values(id=uid(), alerta_id=aid, actor=principal.actor,
                          estado=estado, timestamp=ahora.timestamp(), secuencia=1 if estado == "reconocido" else 2))
            self.db.registrar(principal.actor, aid, "cambiar_alerta", "completado" if permitido else "denegado", ahora, c)
        if not permitido:
            raise ErrorServicio(403, "Transicion no autorizada para este destinatario")
        return {"id": aid, "estado": estado}

    def comprobar_ausencia(self, principal, a, ahora):
        self.db.autorizar(principal, a, "comprobar_ausencia", ahora, {"oficial_medico", "tierra"})
        with self.db.engine.begin() as c:
            astro = self.db.bloquear(c, a)
            ultima = c.execute(select(medicion.c.timestamp).where(medicion.c.astronauta_id == a)
                               .order_by(medicion.c.timestamp.desc()).limit(1)).scalar_one_or_none()
            horas = (ahora.timestamp() - (ultima if ultima is not None else astro["creado"])) / 3600
            vencida = horas >= self.reglas.ausencia_horas
            if vencida:
                self.emitir(c, a, "sin_mediciones", {"horas_sin_medicion": horas}, ahora)
        return {"sin_mediciones": vencida, "horas": horas}

    def reproducir(self, principal, eid, ahora):
        with self.db.engine.connect() as c:
            fila = c.execute(select(evaluacion).where(evaluacion.c.id == eid)).mappings().first()
        if fila is None:
            self.db.registrar(principal.actor, eid, "reproducir", "denegado", ahora)
            raise ErrorServicio(404, "Recurso no disponible")
        self.db.autorizar(principal, fila["astronauta_id"], "reproducir", ahora, {"oficial_medico"})
        snap = self.db.abrir(fila["datos"])
        if snap["salida"]["motor_hash"] != self.motor:
            raise ErrorServicio(409, "Se requiere el artefacto de motor original para reproducir")
        muestra = snap["muestra"]
        r = evaluar(Perfil(**snap["perfil"]), Signos(**muestra["signos"]), Ambiente(**muestra["ambiente"]),
                    LineaBase(**snap["base"]) if snap["base"] else None,
                    {k: LineaBase(**v) for k, v in snap["fases"].items()},
                    complementarios=complementarios_desde_dict(muestra["complementarios"]),
                    reglas=Reglas.desde_dict(snap["reglas"]))
        previas = [{**v, "timestamp": datetime.fromisoformat(v["timestamp"])} for v in snap["previas"]]
        decision = temporal(previas, utc(muestra["timestamp"]), r.nivel.value, r.news2_total,
                            r.news2_total >= 5 or any(v == 3 for v in r.news2_desglose.values()),
                            Reglas.desde_dict(snap["reglas"]))
        nuevo = resultado_json(r)
        # JSON normaliza Enum de cadena y evita diferencias de representacion Python.
        coincide = json.dumps(nuevo, sort_keys=True) == json.dumps(snap["salida"]["resultado"], sort_keys=True)
        return {"coincide": coincide and decision == snap["salida"]["temporal"], "resultado": nuevo}
