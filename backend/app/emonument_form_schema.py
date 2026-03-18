"""Schema and validation helpers for eMonument form payloads.

The structure mirrors the XLSX specification at section level and provides a
stable contract for frontend generators and backend validation.
"""

from __future__ import annotations

from dataclasses import dataclass


FieldType = str


@dataclass(frozen=True)
class FormField:
    key: str
    label: str
    type: FieldType
    required: bool = False
    multiple: bool = False
    options: tuple[str, ...] | None = None


@dataclass(frozen=True)
class FormSection:
    key: str
    label: str
    required: bool = False
    fields: tuple[FormField, ...] = ()
    subsections: tuple["FormSection", ...] = ()


EMONUMENT_FORM_SCHEMA: tuple[FormSection, ...] = (
    FormSection(
        key="identificare",
        label="1. Identificare",
        required=True,
        fields=(
            FormField("denumire", "Denumire", "text", required=True),
            FormField("cod_lmi", "Cod LMI", "text"),
            FormField("cod_ran", "Cod RAN", "text"),
            FormField("statut", "Statut", "select", options=(
                "declasat_total",
                "declasat_partial",
                "in_procedura_clasare",
                "clasat",
                "in_litigiu",
                "ran",
                "susceptibil",
            )),
        ),
    ),
    FormSection(
        key="denumire",
        label="1.2 Denumire",
        required=True,
        subsections=(
            FormSection(
                key="inregistrari",
                label="Denumiri",
                required=True,
                fields=(
                    FormField("denumire", "Denumire", "long_text", required=True),
                    FormField(
                        "limba",
                        "Limba",
                        "select",
                        options=("RO", "HU", "DE", "TR", "GR", "LAT"),
                    ),
                    FormField(
                        "tip_istoric_clasare",
                        "Tip in raport cu istoricul de clasare",
                        "select",
                        required=True,
                        options=(
                            "de_inregistrare",
                            "oficiala_actuala",
                            "oficiala_anterioara",
                            "propunere",
                            "alte_denumiri",
                        ),
                    ),
                    FormField("inventar_aferent", "Inventar aferent", "multi_select", multiple=True),
                    FormField("datare_inceput", "Datare inceput", "date"),
                    FormField("datare_sfarsit", "Datare sfarsit", "date"),
                    FormField("justificare", "Justificare", "long_text"),
                    FormField("observatii", "Observatii", "long_text"),
                ),
            ),
        ),
    ),
    FormSection(
        key="localizare",
        label="2. Localizare",
        required=True,
        fields=(
            FormField("tip", "Tip", "select", required=True, options=("actuala", "anterioara")),
            FormField("precizie_localizare", "Precizia localizarii", "select", required=True),
            FormField("data", "Data", "date", required=True),
            FormField("judet", "Judet", "text", required=True),
            FormField("uat", "UAT", "text", required=True),
            FormField("ut", "UT", "text", required=True),
            FormField("pin", "PIN", "text"),
        ),
        subsections=(
            FormSection(
                key="adresa",
                label="Adresa",
                fields=(
                    FormField("tip_artera", "Tip artera", "select", required=True),
                    FormField("denumire_artera", "Denumire artera", "text", required=True),
                    FormField("numar_postal", "Numar postal", "text", required=True),
                    FormField("cod_postal", "Cod postal", "text"),
                    FormField(
                        "tip_istoric_clasare",
                        "Tip in raport cu istoricul de clasare",
                        "select",
                        required=True,
                        options=(
                            "de_inregistrare",
                            "oficiala_actuala",
                            "oficiala_anterioara",
                            "propunere",
                            "alte_denumiri",
                        ),
                    ),
                    FormField("justificare", "Justificare", "long_text"),
                    FormField("observatii", "Observatii", "long_text"),
                ),
            ),
            FormSection(
                key="repere_geografice",
                label="Repere geografice",
                fields=(
                    FormField("forma_relief", "Forma de relief", "long_text"),
                    FormField("reper_hidrografic", "Reper hidrografic", "long_text"),
                    FormField("toponim", "Toponim", "long_text"),
                    FormField("delimitare", "Delimitare", "long_text"),
                ),
            ),
            FormSection(
                key="referinte_cadastrale",
                label="Referinte cadastrale",
                fields=(
                    FormField("numar_carte_funciara", "Numar carte funciara", "text"),
                    FormField("numar_cadastru", "Numar cadastru", "text"),
                    FormField("numar_parcela", "Numar parcela", "text"),
                    FormField("suprafata_parcela", "Suprafata parcela", "number"),
                    FormField("unitate_masura", "Unitate masura", "select", options=("mp", "ha")),
                ),
            ),
            FormSection(
                key="cartare",
                label="Cartare",
                fields=(
                    FormField("autor", "Autor", "text"),
                    FormField("data_realizarii", "Data realizarii", "date"),
                    FormField("sursa_vectorului", "Sursa vectorului", "text"),
                    FormField("sistem_proiectie", "Sistem de proiectie", "text"),
                ),
            ),
        ),
    ),
    FormSection(
        key="tip_proprietate",
        label="3. Tip de proprietate",
        fields=(
            FormField("tip", "Tip", "select", required=True, options=("actual", "anterior")),
            FormField("tip_regim", "Tipul regimului de proprietate", "select", required=True),
            FormField("data_inceput", "Data inceput", "date"),
            FormField("data_sfarsit", "Data sfarsit", "date"),
            FormField("justificare", "Justificare", "long_text"),
            FormField("observatii", "Observatii", "long_text"),
        ),
    ),
    FormSection(
        key="programe_functionale",
        label="3.3 Programe functionale, date privind folosinta",
        fields=(
            FormField("clasificare_destinatie", "Clasificare dupa destinatie", "long_text"),
            FormField("destinatia_terenului", "Destinatia terenului", "long_text"),
            FormField("utilizare_cladiri", "Date privind utilizarea cladirilor", "long_text"),
            FormField("conditii_utilizare", "Conditii de utilizare", "long_text"),
            FormField("conditii_exploatare", "Conditii de exploatare", "long_text"),
        ),
    ),
    FormSection(
        key="datare",
        label="4. Datarea obiectivului",
        fields=(
            FormField("tip_istoric_clasare", "Tip in raport cu istoricul de clasare", "select", required=True),
            FormField("inventar_aferent", "Inventar aferent", "select"),
            FormField("epoca", "Epoca", "long_text"),
            FormField("secol", "Secol", "long_text"),
            FormField("interval_date", "Interval de date", "long_text"),
            FormField("atestare_documentara", "Atestare documentara", "long_text", required=True),
            FormField("observatii", "Observatii", "long_text"),
        ),
    ),
    FormSection(
        key="istoric",
        label="5. Istoric",
        fields=(
            FormField("istoric", "Istoric", "long_text", required=True),
            FormField("evenimente_istorice", "Evenimente istorice", "long_text"),
            FormField("persoane_organizatii", "Persoane/organizatii asociate", "long_text"),
        ),
    ),
    FormSection(
        key="descriere",
        label="6. Descriere",
        fields=(
            FormField("zona", "Zona", "long_text"),
            FormField("amplasament", "Amplasament", "long_text"),
            FormField("obiectiv_individual", "Obiectiv individual", "long_text"),
            FormField("structura", "Structura", "long_text"),
            FormField("sistem_acoperire", "Sistem acoperire", "long_text"),
            FormField("elemente_finisaj", "Elemente nestructurale si de finisaj", "long_text"),
            FormField("componente_artistice", "Componente artistice", "long_text"),
            FormField("instalatii_echipamente", "Instalatii si echipamente", "long_text"),
            FormField("inscriptii", "Inscriptii", "long_text"),
        ),
    ),
    FormSection(
        key="stare_conservare_componente",
        label="7. Starea de conservare a elementelor componente",
        fields=(
            FormField("data_evaluarii", "Data evaluarii", "date", required=True),
            FormField("amplasament", "Evaluare amplasament", "long_text"),
            FormField("obiectiv", "Evaluare obiectiv", "long_text"),
        ),
    ),
    FormSection(
        key="stare_conservare_riscuri",
        label="8. Stare de conservare si riscuri",
        fields=(
            FormField("stare_generala", "Starea generala de conservare", "select", required=True),
            FormField("data_evaluarii", "Data evaluarii", "date", required=True),
            FormField("riscuri", "Riscuri", "long_text"),
            FormField("probabilitate", "Probabilitate (P)", "number"),
            FormField("grad", "Grad impact (G)", "number"),
            FormField("nivel_risc", "Nivel risc (R)", "number"),
            FormField("masuri", "Masuri", "long_text"),
            FormField("recomandari", "Recomandari", "long_text"),
            FormField("conditii_intretinere", "Conditiile de intretinere", "long_text"),
        ),
    ),
    FormSection(
        key="cercetare_documentare",
        label="8.1 Cercetare, documentare",
        fields=(
            FormField("surse_bibliografice", "Surse bibliografice", "long_text"),
            FormField("surse_arhivistice", "Surse arhivistice", "long_text"),
            FormField("surse_electronice", "Surse electronice", "long_text"),
        ),
    ),
    FormSection(
        key="protectie_valorificare",
        label="9. Protectie si valorificare",
        fields=(
            FormField("lmi_administrativ", "LMI - date administrative", "long_text"),
            FormField("criterii_evaluare_globala", "Criterii de evaluare globala", "long_text", required=True),
            FormField("proceduri_protectie", "Proceduri privind regimul de protectie", "long_text"),
            FormField("ran_date", "RAN - date administrative", "long_text"),
            FormField("lista_patrimoniului_mondial", "Lista patrimoniului mondial", "long_text"),
            FormField("lista_indicativa", "Lista indicativa", "long_text"),
            FormField("marca_patrimoniului_european", "Marca patrimoniului european", "long_text"),
            FormField("alte_instrumente", "Alte instrumente", "long_text"),
        ),
    ),
)


def schema_to_dict(sections: tuple[FormSection, ...] = EMONUMENT_FORM_SCHEMA) -> list[dict]:
    """Serialize immutable schema objects for API responses."""

    def _field_to_dict(field: FormField) -> dict:
        payload = {
            "key": field.key,
            "label": field.label,
            "type": field.type,
            "required": field.required,
            "multiple": field.multiple,
        }
        if field.options:
            payload["options"] = list(field.options)
        return payload

    def _section_to_dict(section: FormSection) -> dict:
        return {
            "key": section.key,
            "label": section.label,
            "required": section.required,
            "fields": [_field_to_dict(f) for f in section.fields],
            "subsections": [_section_to_dict(s) for s in section.subsections],
        }

    return [_section_to_dict(s) for s in sections]
