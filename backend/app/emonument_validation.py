"""Validation engine for eMonument form payloads."""

from __future__ import annotations

from dataclasses import dataclass

from app.emonument_form_schema import EMONUMENT_FORM_SCHEMA, FormSection


@dataclass(frozen=True)
class ValidationIssue:
    path: str
    code: str
    message: str


def _is_present(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, dict, set)):
        return len(value) > 0
    return True


def _validate_section(
    payload: dict,
    section: FormSection,
    *,
    path: str,
    strict: bool,
    issues: list[ValidationIssue],
) -> None:
    section_data = payload.get(section.key)
    section_path = f"{path}.{section.key}" if path else section.key

    if section.required and strict and not isinstance(section_data, dict):
        issues.append(
            ValidationIssue(
                path=section_path,
                code="required_section_missing",
                message=f"Section '{section.label}' is required",
            )
        )
        return

    if section_data is None:
        return

    if not isinstance(section_data, dict):
        issues.append(
            ValidationIssue(
                path=section_path,
                code="invalid_section_type",
                message=f"Section '{section.label}' must be an object",
            )
        )
        return

    for field in section.fields:
        field_value = section_data.get(field.key)
        field_path = f"{section_path}.{field.key}"

        if field.required and strict and not _is_present(field_value):
            issues.append(
                ValidationIssue(
                    path=field_path,
                    code="required_field_missing",
                    message=f"Field '{field.label}' is required",
                )
            )
            continue

        if field_value is None:
            continue

        if field.multiple and not isinstance(field_value, list):
            issues.append(
                ValidationIssue(
                    path=field_path,
                    code="invalid_field_type",
                    message=f"Field '{field.label}' must be a list",
                )
            )

    for subsection in section.subsections:
        sub_data = section_data.get(subsection.key)
        sub_path = f"{section_path}.{subsection.key}"

        if sub_data is None:
            if subsection.required and strict:
                issues.append(
                    ValidationIssue(
                        path=sub_path,
                        code="required_subsection_missing",
                        message=f"Subsection '{subsection.label}' is required",
                    )
                )
            continue

        if isinstance(sub_data, list):
            for idx, item in enumerate(sub_data):
                if not isinstance(item, dict):
                    issues.append(
                        ValidationIssue(
                            path=f"{sub_path}[{idx}]",
                            code="invalid_subsection_item",
                            message="Subsection entries must be objects",
                        )
                    )
                    continue
                _validate_section(
                    {subsection.key: item},
                    subsection,
                    path=section_path,
                    strict=strict,
                    issues=issues,
                )
        elif isinstance(sub_data, dict):
            _validate_section(
                {subsection.key: sub_data},
                subsection,
                path=section_path,
                strict=strict,
                issues=issues,
            )
        else:
            issues.append(
                ValidationIssue(
                    path=sub_path,
                    code="invalid_subsection_type",
                    message="Subsection must be an object or list of objects",
                )
            )


def _apply_cross_rules(
    data: dict, strict: bool, issues: list[ValidationIssue]
) -> None:
    """Cross-section rules extracted from the XLSX guidance."""

    if not strict:
        return

    denumire = data.get("identificare", {}).get("denumire")
    judet = data.get("localizare", {}).get("judet")
    pin = data.get("localizare", {}).get("pin")
    ut = data.get("localizare", {}).get("ut")

    if not _is_present(denumire):
        issues.append(
            ValidationIssue(
                path="identificare.denumire",
                code="minimum_required",
                message="Denumire is required before submission",
            )
        )

    if not _is_present(judet):
        issues.append(
            ValidationIssue(
                path="localizare.judet",
                code="minimum_required",
                message="Judet is required before submission",
            )
        )

    if not (_is_present(pin) or _is_present(ut)):
        issues.append(
            ValidationIssue(
                path="localizare.pin",
                code="minimum_required",
                message="Either PIN or UT is required before submission",
            )
        )

    denumiri = data.get("denumire", {}).get("inregistrari", [])
    if isinstance(denumiri, list):
        for idx, item in enumerate(denumiri):
            if not isinstance(item, dict):
                continue
            if item.get("tip_istoric_clasare") == "propunere" and not _is_present(
                item.get("justificare")
            ):
                issues.append(
                    ValidationIssue(
                        path=f"denumire.inregistrari[{idx}].justificare",
                        code="conditional_required",
                        message="Justificare is required when tip_istoric_clasare is 'propunere'",
                    )
                )

    localizare = data.get("localizare", {})
    adresa = localizare.get("adresa", [])
    if isinstance(adresa, list):
        for idx, item in enumerate(adresa):
            if not isinstance(item, dict):
                continue
            if item.get("tip_istoric_clasare") == "propunere" and not _is_present(
                item.get("justificare")
            ):
                issues.append(
                    ValidationIssue(
                        path=f"localizare.adresa[{idx}].justificare",
                        code="conditional_required",
                        message="Justificare is required when address tip_istoric_clasare is 'propunere'",
                    )
                )

    risc = data.get("stare_conservare_riscuri", {})
    prob = risc.get("probabilitate")
    grad = risc.get("grad")
    nivel = risc.get("nivel_risc")

    if isinstance(prob, (int, float)) and isinstance(grad, (int, float)):
        expected = prob * grad
        if isinstance(nivel, (int, float)) and nivel != expected:
            issues.append(
                ValidationIssue(
                    path="stare_conservare_riscuri.nivel_risc",
                    code="invalid_formula",
                    message=f"Nivel risc should be P x G ({expected})",
                )
            )


def validate_fisa_payload(data: dict, strict: bool = False) -> list[ValidationIssue]:
    """Validate a fisa payload against schema and business rules."""

    issues: list[ValidationIssue] = []

    if not isinstance(data, dict):
        return [
            ValidationIssue(
                path="data",
                code="invalid_root",
                message="Fisa payload must be a JSON object",
            )
        ]

    for section in EMONUMENT_FORM_SCHEMA:
        _validate_section(data, section, path="", strict=strict, issues=issues)

    _apply_cross_rules(data, strict, issues)
    return issues
