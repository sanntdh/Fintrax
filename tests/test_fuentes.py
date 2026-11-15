from enfermedades_espaciales import DatosComplementarios, Estado, evaluar_condiciones


def test_citas_ortostatismo_y_musculo_sin_cambiar_recomendaciones():
    condiciones = {c.codigo:c for c in evaluar_condiciones(DatosComplementarios())}
    fisio = "Documentación/9f6c57e2e18d8e6baa6a8ea8d4c7a5841539.pdf"
    exon = "Documentación/ef91c634202c62c63a17ee801c4a2c4a1021.pdf"
    orto = condiciones["intolerancia_ortostatica"]
    assert orto.fuentes == [f"{fisio}, pp. 2, 5", f"{exon}, pp. 2, 6"]
    assert orto.recomendacion == (
        "Evaluar postura, sintomas y presion arterial/FC con supervision clinica; "
        "no realizar pruebas de pie sin apoyo si hay presincope.")
    musculo = condiciones["deterioro_muscular"]
    assert musculo.fuentes == [f"{fisio}, p. 2", f"{fisio}, p. 12 (contramedidas)"]
    assert musculo.recomendacion == (
        "Revisar mediciones comparables con medicina de vuelo; "
        "no equivale a osteoporosis ni atrofia confirmada.")
    assert all(c.estado == Estado.NO_EVALUABLE for c in condiciones.values())
