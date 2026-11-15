# Correcciones de seguridad e integración ASTRA
Rama Backend, base a73ef2d; seis commits autorizados por el usuario, sin push. Notas internas ignoradas al cerrar T6.
Verificación: pytest Python 3.14.4 y node --test Node 22.22.1; riesgo 2,3,4,5. Implementación inline salvo unidades T3/T5 paralelas disjuntas.

## Specs
- S1 (T1): “en contexto de misión SIEMPRE se evalúa NEWS2 + CO2 ... aunque no haya línea base”; base=None reproduce y guarda; desviación BAJO, aviso/alerta sin_linea_base MEDIO para médico. Prueba grave sin base→201 y alerta. Corregir expectativas antiguas409.
- S2 (T2): “la masa no debe invalidar la línea base”; flag calculado desactualizada, no columna; GETbase/resumen, nota “Línea base calculada con X kg; masa actual Y kg: recalcular”. Bases activas hasta POSTbase médico. Prueba baja6% y lectura siguiente201.
- S3 (T3): news2/co2/desviacion/tendencia ALTO→astronauta/medico/tierra, MEDIO→astronauta/medico; sin_medicion→medico/tierra; sin_linea_base→medico; cribado:*→medico/astronauta. GETlist/detalle/reconocer filtran destinatarios y scope; medico/admintodo. Tierra sin alertas cribado ni condiciones/evidencia ni ciclo/fase/fecha/entrada ni notas sensibles; las no sensibles se conservan.
- S4 (T4): solo fuentes en enfermedades_espaciales.py: ortostatismo FISIOpp2,5 y EXONpp2,6; muscular p12 solo aclarando contramedidas. docs/FUENTES.md tabla áreas/fuentes/páginasPDF y LIMENimpresas; no son NASA; primarias NASA-STD-3001Vol1RevC2023/HRPEvidence/Hughson2012JApplPhysiol112719–727/NASA-NSBRIJWomensHealth2014 pendientes,porverificar sin inventar.
- S5 (T5): frontend api.js fetch XAPIkey solo sessionStorage,baseURL?api/localStorage,mensajes401/403/409/422. UIbase5lecturas/contextopreflight ycalcmedico/admin, borradorenmemoria; misión signos/síntomas complementarios/backendoficial NEWS2alertas/notas; local evaluation orientativo porzonas etiquetado. Gráficas historialAPI/signoscontra base. ARQUITECTURA decisión. CORSconfig MONITOREO_CORS_ORIGINSvacío=sincors,nunca*credenciales. Nodefetchsimulado+testCORS.
- S6 (T6): temporales portables sin/tmp/opencode,testnode--test sincarpeta,moverrootPythonTests a tests eimports; git rm --cached18pyc yoddnotasinternas dejando local;gitignore. READMEvigente/legado,proponereliminaciónsinborrar;Python3.13/3.14solo verificados. Correr ambas suites y entregar salidas,hashescommits,tabla ydecisiones.

## Tasks
- T1 | S1 | inline | completado: RED5/GREEN14 y suite144 | 8d49558
- T2 | S2 | inline | completado: RED3/GREEN16 y suite146 | 5560448
- T3 | S3 | delegado paralelo con T5 (backend, superficies disjuntas) + ajuste parent notas | completado: 23tests y suite169 | 818da1e
- T4 | S4 | inline | completado: REDcita/GREEN10 y AST solo fuentes | 3721fdf
- T5 | S5 | delegado paralelo con T3 (solo frontend); CORS parent después | completado: Node54/CORS5/DOM40 | fafa4b4
- T6 | S6 | inline | completado:177Python+13skip,Node55,npm55 | c60fefe

## Log
- L1: Usuario exige español, pruebas antes de editar, test por corrección, solo fuentes en enfermedades_espaciales.py y commit por tarea. Se preservan cambios ajenos; únicas diferencias iniciales son tres .pyc autorizadas para retirada del índice en T6.
- L2 (línea base, antes de escrituras): python -m pytest: collected154items;141passed,13skipped,1warning in8.76s. Node22.22.1 `node --test` enfrontend:tests20,pass20,fail0,skipped0,duration388.697665ms. Warning previo Starlette/httpx. No test nuevo corrido todavía.
- L3: Mapeo read-only: frontend sinHTTP, charts genera valores aleatorios; Chrome DevTools no puede iniciar /opt/google/chrome/chrome. No fingir prueba visual. Intentar verificación con herramientas disponibles al cierre; scriptsnoinstaladossinnecesidad.
- L4: Commits por tarea sin push. Notas no sensibles y null se conservan para tierra; se filtran condiciones/evidencia/cribado además de ciclo. Base desactualizada es propiedad calculada sin columna; no se desactiva por masa. Revisión nativa inicial medium/under_budget tras T1 y T2, sin START.
- L5: T5 corrigió inferencias inventadas de escala4 y mareo genérico→ortostatismo, reintento parcial, concurrencia dobleclic, borrado al cambiar paciente/conexión y respuestas tardías. Prueba DOM JSDOM+APIreal descubrió guard getState vs backend; regresión real RED y corrección mínima. Recheck40/40:5preflight/baseactiva/ALTO NEWS2=12confecha/historial/clave solo sesión/aislamiento por paciente/errorparcial visible. Sin prueba visual Chrome.
- L6: T6 mueve seis root testfiles a tests sin duplicar colección, elimina ruta temporal fija, npmtestnode--test; deindexa18pyc y3notasodd, copiaslocales se conservan ignoradas. README vigente/legado y propuesta eliminación sin borrar código; Py3.13 ausente,solo3.14.4 verificado. docs/PRUEBAS.md guarda salidas reales iniciales/finales. pytest177pass13skip1warning;Node55pass0fail y npm55. Scratchdeworkers+DOMretirado y procesos detenidos; .venv del usuario conservado.
- L7: HEAD c60fefe contiene seis commits desde a73ef2d, sin push; workingtree limpio. Evaluación nativa final medium,review_due=false,under_budget,63paths4305lines; no START/consent/receipt. Verificador independiente falló Unauthorized antesdeinspección; falta dictamen, no se inventaPASS. No confundir pruebas funcionales/DOM aprobadas con una revisión externa o render visual en Chrome. Para cerrar la verificación independiente hace falta un ejecutor accesible; no una autorización genérica de datos.
