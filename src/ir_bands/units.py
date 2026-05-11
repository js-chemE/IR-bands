"""Unit conversions for the x-axis (wavenumber → wavelength → energy).

Three axis types, each with a few common units. The defaults are picked
to match how IR spectroscopists actually read these numbers (μm for
wavelength, not nm or meters; kJ/mol for energy).
"""
from __future__ import annotations

from typing import NamedTuple

import scipy.constants as const


# Physical constants
H = const.h                  # 6.62607015e-34 J·s
C = const.speed_of_light     # 299792458 m/s
EV_J = const.electron_volt   # 1.602176634e-19 J
NA = const.N_A               # 6.02214076e23 /mol
J_PER_CAL = const.calorie    # 4.184 J/cal


class AxisDef(NamedTuple):
    """One x-axis option: type + units + which unit is the default."""
    name: str
    units: tuple[str, ...]
    default_unit: str
    reversed: bool  # True if higher value goes on the left (IR convention)


AXES: dict[str, AxisDef] = {
    "wavenumber": AxisDef(
        name="wavenumber",
        units=("cm⁻¹", "m⁻¹"),
        default_unit="cm⁻¹",
        reversed=True,    # IR convention: 4000 on left, 400 on right
    ),
    "wavelength": AxisDef(
        name="wavelength",
        units=("μm", "nm"),       # m, cm, Å dropped — wrong scale for IR
        default_unit="μm",
        reversed=False,
    ),
    "energy": AxisDef(
        name="energy",
        units=("meV", "eV", "kJ/mol", "kcal/mol"),
        default_unit="kJ/mol",
        reversed=True,    # higher energy on left, parallels wavenumber
    ),
}


def axis_label(axis: str, unit: str) -> str:
    return f"{axis} / {unit}"


def wn_to_value(wn_cm: float, axis: str, unit: str) -> float:
    """Convert wavenumber (cm⁻¹) to the requested axis/unit.

    Returns +inf for unphysical inputs (zero wavenumber → infinite wavelength).
    """
    if wn_cm <= 0:
        return float("inf")

    if axis == "wavenumber":
        if unit == "cm⁻¹":
            return wn_cm
        if unit == "m⁻¹":
            return wn_cm * 100.0

    elif axis == "wavelength":
        wl_m = 1.0 / (wn_cm * 100.0)
        if unit == "m":   return wl_m
        if unit == "cm":  return wl_m * 100.0
        if unit == "μm":  return wl_m * 1e6
        if unit == "nm":  return wl_m * 1e9
        if unit == "Å":   return wl_m * 1e10

    elif axis == "energy":
        e_j = H * C * wn_cm * 100.0  # E = hc·ν̃, in J/photon
        if unit == "J":         return e_j
        if unit == "kJ":        return e_j / 1000.0
        if unit == "meV":       return e_j / EV_J * 1000.0
        if unit == "eV":        return e_j / EV_J
        if unit == "J/mol":     return e_j * NA
        if unit == "kJ/mol":    return e_j * NA / 1000.0
        if unit == "kcal":      return e_j / J_PER_CAL / 1000.0
        if unit == "kcal/mol":  return e_j * NA / J_PER_CAL / 1000.0

    raise ValueError(f"Unknown axis/unit combination: {axis}/{unit}")


def axis_range(wn_lo: float, wn_hi: float, axis: str, unit: str) -> list[float]:
    """Convert a wavenumber range (low, high) to a Plotly axis range
    [start, end], respecting axis direction.

    For reversed axes the returned range has start > end so Plotly draws
    it right-to-left (IR convention).
    """
    v_lo = wn_to_value(wn_lo, axis, unit)
    v_hi = wn_to_value(wn_hi, axis, unit)
    spec = AXES[axis]
    if spec.reversed:
        # Larger wavenumber on the left: range goes from high value to low
        if axis == "wavelength":
            # Higher wn = shorter wl, so reversed-wavelength means short on left.
            return [min(v_lo, v_hi), max(v_lo, v_hi)]
        return [max(v_lo, v_hi), min(v_lo, v_hi)]
    return [min(v_lo, v_hi), max(v_lo, v_hi)]


def wrap_for_hover(text: str, width: int = 50) -> str:
    """Wrap long text into <br>-separated lines for Plotly hover tooltips."""
    import textwrap
    if not text:
        return text
    out = []
    for line in text.split("\n"):
        if line.strip():
            wrapped = textwrap.fill(line, width=width, break_long_words=False)
            out.append(wrapped.replace("\n", "<br>"))
        else:
            out.append("")
    return "<br>".join(out)
