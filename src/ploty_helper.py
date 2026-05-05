import textwrap

import scipy.constants as const

def wrap_for_hover(text: str, width: int = 50) -> str:
    """Wrap a long string into lines for Plotly hover tooltips.
    
    Plotly hover labels don't auto-wrap, so we insert <br> tags manually.
    Each input line (split on existing newlines) is wrapped independently
    so existing line breaks are preserved.
    """
    if not text:
        return text
    wrapped_lines = []
    for line in text.split("\n"):
        if line.strip():
            wrapped = textwrap.fill(line, width=width, break_long_words=False)
            wrapped_lines.append(wrapped.replace("\n", "<br>"))
        else:
            wrapped_lines.append("")
    return "<br>".join(wrapped_lines)


h = const.h  # 6.62607015e-34 J·s
c = const.speed_of_light  # 299792458 m/s
eV = const.electron_volt  # 1.602176634e-19 J/eV
NA = const.N_A # 6.02214076e23
CAL_PER_J = 1 / const.calorie  # 1 cal = 4.184 J, so 1 J = 1/4.184 cal ≈ 0.239005736 cal/J

def wn_to_value(wn_cm: float, axis: str, unit: str) -> float:
    """Convert wavenumber in cm⁻¹ to the specified axis/unit combination.
    Returns infinity for unphysical values (e.g., zero wavenumber → infinite wavelength).
    """
    if wn_cm <= 0:
        return float("inf")

    if axis == "wavenumber":
        if unit == "/cm":
            return wn_cm
        elif unit == "/m":
            return wn_cm * 100.0  # 1/cm = 100/m

    elif axis == "wavelength":
        wl_m = 1.0 / (wn_cm * 100.0)  # convert cm⁻¹ to wavelength in m
        if unit == "m":
            return wl_m
        elif unit == "cm":
            return wl_m * 100.0
        elif unit == "μm":
            return wl_m * 1e6
        elif unit == "nm":
            return wl_m * 1e9
        elif unit == "Å":
            return wl_m * 1e10

    elif axis == "energy":
        e_j_per_photon = h * c * wn_cm * 100.0  # E = hc·ν̃ in J/photon
        if unit == "J":
            return e_j_per_photon
        elif unit == "kJ":
            return e_j_per_photon / 1000.0
        elif unit == "eV":
            return e_j_per_photon / eV
        elif unit == "J/mol":
            return e_j_per_photon * NA
        elif unit == "kJ/mol":
            return e_j_per_photon * NA / 1000.0
        elif unit == "kcal":
            return e_j_per_photon * CAL_PER_J / 1000.0
        elif unit == "kcal/mol":
            return e_j_per_photon * NA * CAL_PER_J / 1000.0

    raise ValueError(f"Unknown axis/unit combination: {axis}/{unit}")