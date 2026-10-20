"""Build docs/data/molecules3d.json: 3D geometry and normal modes for the
vibration animations.

Reads data/molecules3d.jsonc (configuration, documented there) and the raw
NIST CCCBDB tables in data/molecules3d/cccbdb/, checks every mapped mode
against data/vibrations.jsonc, and writes one JSON file the frontend draws
with MoleculeViewer3D. Standard library only.

Run from the repo root:
    python src/ir_bands/molecules3d.py

Output, per molecule id and topology id:
    atoms   [{element, xyz}]   pm, drawing frame: x right, y up, z toward the
                               viewer; centred on the outline in x, y and on
                               the centroid in z
    bonds   [[i, j, order]]    indices into atoms
    modes   {mode_id: {cccbdb_index, symmetry, harmonic_cm, ir_intensity,
                       displacement}}
            displacement is one [dx, dy, dz] per atom in the same frame,
            scaled so the largest atom displacement has length 1; the
            viewer multiplies by its own amplitude.
    source  short provenance string
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from ir_bands.loader import load_jsonc  # noqa: E402
from ir_bands.adsorbates import build_adsorbate  # noqa: E402

CONFIG = ROOT / "data" / "molecules3d.jsonc"
RAW_DIR = ROOT / "data" / "molecules3d" / "cccbdb"
VIBRATIONS = ROOT / "data" / "vibrations.jsonc"
OUT = ROOT / "docs" / "data" / "molecules3d.json"

ELEMENT_BY_Z = {1: "H", 6: "C", 7: "N", 8: "O", 9: "F", 17: "Cl", 35: "Br", 53: "I"}
# Single-bond covalent radii, pm. Cordero et al., Dalton Trans. 2008, 2832.
COVALENT_PM = {"H": 31, "C": 76, "N": 71, "O": 66, "F": 57, "Cl": 102, "Br": 120, "I": 139}
BOND_TOLERANCE = 1.25
# Standard atomic weights (IUPAC, abridged), only used for the diatomic stretch.
MASS = {"H": 1.008, "C": 12.011, "N": 14.007, "O": 15.999, "F": 18.998,
        "Cl": 35.45, "Br": 79.904, "I": 126.90}

CCCBDB_SOURCE = "NIST CCCBDB (SRD 101), B3LYP/aug-cc-pVTZ, retrieved 2026-10-20"


# ---------------------------------------------------------------------------
# Small vector helpers
# ---------------------------------------------------------------------------

def _sub(a, b): return [a[i] - b[i] for i in range(3)]
def _dot(a, b): return sum(a[i] * b[i] for i in range(3))
def _norm(a): return math.sqrt(_dot(a, a))
def _scale(a, s): return [x * s for x in a]
def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def _unit(a):
    n = _norm(a)
    if n < 1e-9:
        raise ValueError(f"zero-length direction {a}")
    return _scale(a, 1 / n)
def _matvec(m, v): return [_dot(row, v) for row in m]
def _matmul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def _rot_rotate(deg):  # in the screen plane, counter-clockwise
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]]


def _rot_turn(deg):  # about the vertical; positive brings the right side forward
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[c, 0, -s], [0, 1, 0], [s, 0, c]]


def _rot_tip(deg):  # about the horizontal; positive brings the top forward
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[1, 0, 0], [0, c, -s], [0, s, c]]


# ---------------------------------------------------------------------------
# Symmetry labels: vibrations.jsonc writes Σ<sub>g</sub>⁺, A₁, A′; CCCBDB
# writes Σg, A1, A'. Compare them in one plain form.
# ---------------------------------------------------------------------------

_SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def plain_symmetry(s: str) -> str:
    s = re.sub(r"</?sub>|</?sup>", "", s or "")
    s = s.translate(_SUB).replace("′", "'").replace("″", '"').replace("⁺", "").replace("+", "")
    return s.replace(" ", "")


# ---------------------------------------------------------------------------
# Building one molecule
# ---------------------------------------------------------------------------

def _direction(spec, atoms_A, centroid):
    if isinstance(spec, str) and spec.startswith("atom:"):
        idx = int(spec.split(":")[1])
        return _sub(atoms_A[idx - 1], centroid)
    return [float(x) for x in spec]


def frame_matrix(cfg, atoms_A, centroid):
    """Rows are the screen axes (right, up, toward) in CCCBDB coordinates,
    followed by the configured view rotations."""
    frame = cfg.get("frame", {"up": [0, 1, 0], "toward": [0, 0, 1]})
    up = _unit(_direction(frame["up"], atoms_A, centroid))
    toward = _direction(frame["toward"], atoms_A, centroid)
    toward = _unit(_sub(toward, _scale(up, _dot(toward, up))))
    right = _cross(up, toward)
    m = [right, up, toward]
    view = cfg.get("view", {})
    for rot in (_rot_rotate(view.get("rotate", 0)), _rot_turn(view.get("turn", 0)),
                _rot_tip(view.get("tip", 0))):
        m = _matmul(rot, m)
    return m


def _centre_outline(xyz):
    """Shift so the middle of the drawn outline (x, y extent of the rest
    geometry in this view) sits at the origin. Depth stays centroid-based."""
    shift = [(max(p[k] for p in xyz) + min(p[k] for p in xyz)) / 2 for k in (0, 1)]
    return [[p[0] - shift[0], p[1] - shift[1], p[2]] for p in xyz]


def perceive_bonds(elements, xyz_pm, orders):
    bonds = []
    n = len(elements)
    for i in range(n):
        for j in range(i + 1, n):
            limit = (COVALENT_PM[elements[i]] + COVALENT_PM[elements[j]]) * BOND_TOLERANCE
            if _norm(_sub(xyz_pm[i], xyz_pm[j])) <= limit:
                bonds.append([i, j, orders.get((i, j), 1)])
    return bonds


def build_cccbdb(mol_id, cfg, vib_modes, report):
    raw = json.loads((RAW_DIR / f"{cfg['cccbdb']}.json").read_text(encoding="utf-8"))
    elements = [ELEMENT_BY_Z[a["Z"]] for a in raw["atoms"]]
    atoms_A = [[float(a["x"]), float(a["y"]), float(a["z"])] for a in raw["atoms"]]
    n = len(atoms_A)
    centroid = [sum(a[k] for a in atoms_A) / n for k in range(3)]
    m = frame_matrix(cfg, atoms_A, centroid)
    xyz = [_scale(_matvec(m, _sub(a, centroid)), 100.0) for a in atoms_A]  # Å -> pm
    xyz = _centre_outline(xyz)

    orders = {}
    for i, j, o in cfg.get("bond_orders", []):
        orders[(min(i, j) - 1, max(i, j) - 1)] = o
    bonds = perceive_bonds(elements, xyz, orders)

    rows = {r["index"]: r for r in raw["modes"]}
    ev = {}
    for e in raw["eigenvectors"]:
        ev.setdefault(int(e["mode index"]), []).append(
            [float(e["evx"]), float(e["evy"]), float(e["evz"])])

    modes = {}
    for mode_id, index in cfg["modes"].items():
        if mode_id not in vib_modes:
            raise ValueError(f"{mol_id}: mode {mode_id!r} is not in vibrations.jsonc")
        row = rows[index]
        want = plain_symmetry(vib_modes[mode_id].get("symmetry", ""))
        have = plain_symmetry(row["symmetry"])
        if want and want != have:
            raise ValueError(f"{mol_id}: {mode_id} is {want} in vibrations.jsonc but CCCBDB "
                             f"mode index {index} is {have}")
        vecs = [_matvec(m, v) for v in ev[index]]
        if len(vecs) != n:
            raise ValueError(f"{mol_id}: mode {index} has {len(vecs)} vectors for {n} atoms")
        biggest = max(_norm(v) for v in vecs)
        modes[mode_id] = {
            "cccbdb_index": index,
            "symmetry": row["symmetry"],
            "harmonic_cm": float(row["frequency"]),
            "ir_intensity": float(row["ir_intensity"]),
            "displacement": [[round(c / biggest, 3) for c in v] for v in vecs],
        }
        report.append((mol_id, mode_id, vib_modes[mode_id].get("herzberg_notation"),
                       row["symmetry"], index, row["frequency"],
                       vib_modes[mode_id].get("wn_start")))
    return {
        "atoms": [{"element": e, "xyz": [round(c, 1) for c in p]} for e, p in zip(elements, xyz)],
        "bonds": bonds,
        "modes": modes,
        "source": f"{CCCBDB_SOURCE}; {raw['species']['formula']}",
    }


def build_diatomic(mol_id, cfg, vib_modes, diatomics, report):
    formula = cfg["diatomic"]
    r_pm = diatomics[formula]["r_e"] * 100.0
    a, b = cfg["elements"]
    ma, mb = MASS[a], MASS[b]
    # Centre of mass fixed: displacements opposite and inversely proportional
    # to the masses.
    da, db = -mb / (ma + mb), ma / (ma + mb)
    big = max(abs(da), abs(db))
    disp = [[round(da / big, 3), 0, 0], [round(db / big, 3), 0, 0]]
    modes = {}
    for mode_id in cfg["modes"]:
        if mode_id not in vib_modes:
            raise ValueError(f"{mol_id}: mode {mode_id!r} is not in vibrations.jsonc")
        modes[mode_id] = {"cccbdb_index": None, "symmetry": None, "harmonic_cm": None,
                          "ir_intensity": None, "displacement": disp}
        report.append((mol_id, mode_id, vib_modes[mode_id].get("herzberg_notation"),
                       "", "", "", vib_modes[mode_id].get("wn_start")))
    # Centre of mass at the origin, so the stretch is about the drawing centre.
    xa = -r_pm * mb / (ma + mb)
    return {
        "atoms": [{"element": a, "xyz": [round(xa, 1), 0, 0]},
                  {"element": b, "xyz": [round(xa + r_pm, 1), 0, 0]}],
        "bonds": [[0, 1, cfg.get("bond_order", 1)]],
        "modes": modes,
        "source": (f"r_e from NIST CCCBDB experimental geometries "
                   f"({diatomics[formula]['cccbdb_source']}); stretch from the masses"),
    }


def build() -> dict:
    config = load_jsonc(CONFIG)
    vib = load_jsonc(VIBRATIONS)
    diatomics = {d["formula"]: d for d in
                 json.loads((RAW_DIR / "diatomics.json").read_text(encoding="utf-8"))["molecules"]}
    by_id = {m["id"]: m for m in vib["molecules"]}

    out, report, missing = {}, [], []
    for mol_id, topologies in config["molecules"].items():
        if mol_id not in by_id:
            raise ValueError(f"molecules3d.jsonc names {mol_id!r}, which vibrations.jsonc lacks")
        for topo_id, cfg in topologies.items():
            vib_modes = {m["id"]: m for m in by_id[mol_id]["modes"]
                         if m.get("topology") in (None, topo_id)}
            if "adsorbate" in cfg:
                entry = build_adsorbate(mol_id, topo_id, cfg, vib_modes,
                                        config.get("settings", {}).get("surface_gap", 1.0))
            elif "diatomic" in cfg:
                entry = build_diatomic(mol_id, cfg, vib_modes, diatomics, report)
            else:
                entry = build_cccbdb(mol_id, cfg, vib_modes, report)
            missing += [f"{mol_id}/{topo_id}: {k}" for k in vib_modes if k not in entry["modes"]]
            out.setdefault(mol_id, {})[topo_id] = entry

    return {
        "_about": "Generated by src/ir_bands/molecules3d.py from data/molecules3d.jsonc "
                  "and data/molecules3d/cccbdb/ (adsorbates: src/ir_bands/adsorbates.py). Do not edit.",
        "depth_cue": config.get("settings", {}).get("depth_cue", 0.2),
        "molecules": out,
    }, report, missing


def main() -> int:
    payload, report, missing = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")
    print(f"✓ Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print(f"  {'mode':34s} {'ν':4s} {'sym':4s} {'idx':>3s} {'calc':>6s} {'listed':>6s}")
    for mol, mode, herz, sym, idx, calc, listed in report:
        flag = ""
        if calc and listed:
            ratio = float(calc) / float(listed)
            if not 0.9 <= ratio <= 1.1:
                flag = f"  <- calc/listed = {ratio:.2f}"
        print(f"  {mode:34s} {herz or '':4s} {sym:4s} {str(idx):>3s} {calc:>6s} {str(listed):>6s}{flag}")
    for m in missing:
        print(f"  ! no 3D mode for {m}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
