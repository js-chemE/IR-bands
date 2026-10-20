"""Adsorbed species for the 3D vibration animations.

Builds each surface topology's geometry from internal coordinates (bond
lengths and angles from the literature, given with their sources in
data/molecules3d.jsonc), then turns the mode descriptions written there into
per-atom displacement vectors and rotations. Called by molecules3d.py.

Frame: x along the surface (right), y the surface normal (up), z toward the
viewer. The surface is the plane y = 0. Lengths in the config are in Å,
angles in degrees; the output is in pm like everything else.

Atom order is the order of the hand-drawn geometry in moleculeGeometry.ts,
so the translated modes keep their meaning.

Mode operations, one entry per atom (null = the atom stays still):
    {"bond": j, "along": a, "across": b}
        a along the bond j -> i (positive stretches it), b across it in the
        plane of the drawing (z x bond direction).
    {"toward": k or [k, ...], "bond": j, "a": a}
        a toward atom k (or the mean of several), across the bond j -> i:
        closes the k-i-j angle without stretching i-j. Used for the CH3
        deformations.
    {"along_atoms": [p, q], "a": a}
        a along the direction from atom p to atom q.
    {"dir": [x, y, z]}
        a fixed direction in the frame (may be added to a bond op).
    {"rotate": {"pivot": k | "pivot_anchor": n | "pivot_point": [x, y, z] (Å),
                "axis": [x, y, z] |
                "axis_atoms": [p, q], "deg": d}}
        turn about an axis through a pivot (an atom's or anchor's rest
        position), by d degrees at the turning point.
Linear amounts are in units of the viewer's amplitude (1 = full travel).
"""
from __future__ import annotations

import math

# ---------------------------------------------------------------------------
# vectors (lists of 3 floats)
# ---------------------------------------------------------------------------


def _add(a, b): return [a[i] + b[i] for i in range(3)]
def _sub(a, b): return [a[i] - b[i] for i in range(3)]
def _mul(a, s): return [x * s for x in a]
def _dot(a, b): return sum(a[i] * b[i] for i in range(3))
def _norm(a): return math.sqrt(_dot(a, a))
def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _unit(a):
    n = _norm(a)
    if n < 1e-12:
        raise ValueError("zero-length vector")
    return _mul(a, 1 / n)


def _polar(length, angle_from_up_deg, azimuth_deg=0.0):
    """Vector of `length` tilted `angle_from_up_deg` from +y toward +x, then
    turned `azimuth_deg` about y (positive toward -z, i.e. away)."""
    t, f = math.radians(angle_from_up_deg), math.radians(azimuth_deg)
    return [length * math.sin(t) * math.cos(f), length * math.cos(t), -length * math.sin(t) * math.sin(f)]


# ---------------------------------------------------------------------------
# geometry builders: (params) -> atoms [(element, xyz Å)], anchors [(atom, xyz Å)]
# Atom order follows moleculeGeometry.ts.
# ---------------------------------------------------------------------------


def _co_linear(g):
    c = [0, g["M-C"], 0]
    return [("C", c), ("O", _add(c, [0, g["C-O"], 0]))], [(0, [0, 0, 0])]


def _co_bridged(g):
    half = g["M-M"] / 2
    h = math.sqrt(g["M-C"] ** 2 - half ** 2)
    c = [0, h, 0]
    return [("C", c), ("O", _add(c, [0, g["C-O"], 0]))], [(0, [-half, 0, 0]), (0, [half, 0, 0])]


def _co_hollow(g):
    r = g["M-M"] / math.sqrt(3)   # centre of a triangle of side M-M to its corners
    h = math.sqrt(g["M-C"] ** 2 - r ** 2)
    c = [0, h, 0]
    corners = [[r * math.cos(math.radians(a)), 0, r * math.sin(math.radians(a))] for a in (150, 30, 270)]
    return [("C", c), ("O", _add(c, [0, g["C-O"], 0]))], [(0, p) for p in corners]


def _co_geminal(g):
    m = [0, 0, 0]
    half = g["C-M-C"] / 2
    atoms = [("M", m)]
    for sign in (-1, 1):
        c = _polar(g["M-C"], sign * half)
        o = _add(c, _polar(g["C-O"], sign * half))   # M-C-O linear
        atoms += [("C", c), ("O", o)]
    return atoms, []


def _co_isocarbonyl(g):
    o = [0, g["M-O"], 0]
    return [("O", o), ("C", _add(o, [0, g["C-O"], 0]))], [(0, [0, 0, 0])]


def _bidentate_xco2(g, top):
    """Formate / carbonate / bicarbonate bridging two surface atoms through
    two O. Atoms: C, O(left), O(right), then `top` above C."""
    half = math.radians(g["O-C-O"] / 2)
    xo = g["C-O"] * math.sin(half)
    a = g["M-M"] / 2
    yo = math.sqrt(g["M-O"] ** 2 - (a - xo) ** 2)
    c = [0, yo + g["C-O"] * math.cos(half), 0]
    atoms = [("C", c), ("O", [-xo, yo, 0]), ("O", [xo, yo, 0])]
    atoms.append((top, _add(c, [0, g["C-top"], 0])))
    return atoms, [(1, [-a, 0, 0]), (2, [a, 0, 0])]


def _monodentate_xco2(g, left, right):
    """Formate / carbonate / bicarbonate bound through one O. Atoms: C,
    O(bound), `left`, `right`. The C sits off the vertical by the M-O-C
    angle, toward +x; `left` points away from the surface, `right` out to
    the side, completing a planar sp2 centre."""
    ob = [0, g["M-O"], 0]
    tilt = 180 - g["M-O-C"]                       # O->C away from the vertical
    c = _add(ob, _polar(g["C-Ob"], tilt))
    down = 180 + tilt                              # direction C->Ob, from +y
    left_dir = down + g["Ob-C-left"]               # the one that ends up on top
    right_dir = down - g["Ob-C-right"]             # the one out to the side
    atoms = [("C", c), ("O", ob),
             (left, _add(c, _polar(g["C-left"], left_dir))),
             (right, _add(c, _polar(g["C-right"], right_dir)))]
    return atoms, [(1, [0, 0, 0])]


def _add_oh(built, o_index, g):
    """H on atom `o_index`, in the molecular plane, C-O-H angle from the
    config, on the +x side."""
    atoms, anchors = built
    c, o = atoms[0][1], atoms[o_index][1]
    u = _unit(_sub(o, c))
    theta = math.radians(180 - g["C-O-H"])
    w = _unit(_cross([0, 0, -1], u))               # in-plane, perpendicular
    if w[0] < 0:
        w = _mul(w, -1)
    d = _add(_mul(u, math.cos(theta)), _mul(w, math.sin(theta)))
    return atoms + [("H", _add(o, _mul(d, g["O-H"])))], anchors


def _methoxy(g):
    """CH3O on a hollow (three anchors) or atop (one) site. Atoms: C, O,
    H, H, H. The C-O axis tilts by `tilt` toward +x."""
    if g.get("site", "hollow") == "hollow":
        r = g["M-M"] / math.sqrt(3)
        h = math.sqrt(g["M-O"] ** 2 - r ** 2)
        anchors = [(1, [r * math.cos(math.radians(a)), 0, r * math.sin(math.radians(a))]) for a in (150, 30, 270)]
    else:
        h = g["M-O"]
        anchors = [(1, [0, 0, 0])]
    o = [0, h, 0]
    axis = _unit(_polar(1, g.get("tilt", 0)))
    c = _add(o, _mul(axis, g["C-O"]))
    # three H at H-C-O from the axis, 120 degrees apart, one in the xy plane
    side = _unit(_cross(axis, [0, 0, 1]))
    side2 = _cross(axis, side)
    t = math.radians(180 - g["H-C-O"])
    hs = []
    for k in range(3):
        f = math.radians(90 + 120 * k)
        d = _add(_mul(axis, math.cos(t)),
                 _mul(_add(_mul(side, math.cos(f)), _mul(side2, math.sin(f))), math.sin(t)))
        hs.append(("H", _add(c, _mul(d, g["C-H"]))))
    return [("C", c), ("O", o)] + hs, anchors


BUILDERS = {
    "co_linear": _co_linear,
    "co_bridged": _co_bridged,
    "co_hollow": _co_hollow,
    "co_geminal": _co_geminal,
    "co_isocarbonyl": _co_isocarbonyl,
    "formate_bidentate": lambda g: _bidentate_xco2(g, "H"),
    "formate_monodentate": lambda g: _monodentate_xco2(g, "O", "H"),
    "carbonate_bidentate": lambda g: _bidentate_xco2(g, "O"),
    "carbonate_monodentate": lambda g: _monodentate_xco2(g, "O", "O"),
    "bicarbonate_bidentate": lambda g: _add_oh(_bidentate_xco2(g, "O"), 3, g),
    "bicarbonate_monodentate": lambda g: _add_oh(_monodentate_xco2(g, "O", "O"), 3, g),
    "methoxy": _methoxy,
}


def build_geometry(kind, g):
    return BUILDERS[kind](g)


# ---------------------------------------------------------------------------
# modes
# ---------------------------------------------------------------------------


def _in_plane_across(u):
    w = _cross([0, 0, 1], u)
    return _unit(w) if _norm(w) > 1e-6 else [1, 0, 0]


def resolve_mode(ops, xyz, anchors):
    """Per-atom displacement vectors (amplitude units) and rotations (pm)."""
    disp, rots = [], []
    for i, op in enumerate(ops):
        d, r = [0.0, 0.0, 0.0], None
        if op:
            if "bond" in op and ("along" in op or "across" in op):
                u = _unit(_sub(xyz[i], xyz[op["bond"]]))
                d = _add(_mul(u, op.get("along", 0)), _mul(_in_plane_across(u), op.get("across", 0)))
            if "toward" in op:
                u = _unit(_sub(xyz[i], xyz[op["bond"]]))
                ks = op["toward"] if isinstance(op["toward"], list) else [op["toward"]]
                target = _mul([sum(xyz[k][c] for k in ks) for c in range(3)], 1 / len(ks))
                t = _sub(target, xyz[i])
                t = _sub(t, _mul(u, _dot(t, u)))
                d = _add(d, _mul(_unit(t), op["a"]))
            if "along_atoms" in op:
                p_, q_ = op["along_atoms"]
                d = _add(d, _mul(_unit(_sub(xyz[q_], xyz[p_])), op["a"]))
            if "dir" in op:
                d = _add(d, [float(x) for x in op["dir"]])
            if "rotate" in op:
                ro = op["rotate"]
                if "pivot" in ro:
                    pivot = xyz[ro["pivot"]]
                elif "pivot_anchor" in ro:
                    pivot = anchors[ro["pivot_anchor"]][1]
                else:
                    pivot = _mul([float(x) for x in ro["pivot_point"]], 100.0)
                if "axis_atoms" in ro:
                    p, q = ro["axis_atoms"]
                    axis = _unit(_sub(xyz[q], xyz[p]))
                else:
                    axis = _unit([float(x) for x in ro.get("axis", [0, 0, 1])])
                r = {"pivot": [round(c, 1) for c in pivot], "axis": [round(c, 4) for c in axis],
                     "deg": ro["deg"]}
        disp.append([round(c, 3) for c in d])
        rots.append(r)
    return disp, (rots if any(rots) else None)


def build_adsorbate(mol_id, topo_id, cfg, vib_modes):
    atoms, anchors = build_geometry(cfg["adsorbate"], cfg["geometry"])
    xyz = [_mul(p, 100.0) for _, p in atoms]                 # Å -> pm
    anchors = [(a, _mul(p, 100.0)) for a, p in anchors]
    elements = [e for e, _ in atoms]
    bonds = [[i, j, o] for i, j, o in cfg["bonds"]]
    modes = {}
    for mode_id, ops in cfg["modes"].items():
        if mode_id not in vib_modes:
            raise ValueError(f"{mol_id}/{topo_id}: mode {mode_id!r} is not in vibrations.jsonc")
        if len(ops) != len(xyz):
            raise ValueError(f"{mol_id}/{topo_id}: {mode_id} has {len(ops)} entries for {len(xyz)} atoms")
        disp, rots = resolve_mode(ops, xyz, anchors)
        m = {"cccbdb_index": None, "symmetry": None, "harmonic_cm": None, "ir_intensity": None,
             "displacement": disp}
        if rots:
            m["rotations"] = rots
        modes[mode_id] = m
    view = cfg.get("view", {})
    return {
        "atoms": [{"element": e, "xyz": [round(c, 1) for c in p]} for e, p in zip(elements, xyz)],
        "bonds": bonds,
        "modes": modes,
        "surface": {"anchors": [{"atom": a, "at": [round(c, 1) for c in p]} for a, p in anchors],
                    "view": {"turn": view.get("turn", 0), "tip": view.get("tip", 0)}},
        "source": cfg.get("source", "geometry from the literature, see data/molecules3d.jsonc; "
                                    "motion translated from the hand-drawn animation"),
    }
