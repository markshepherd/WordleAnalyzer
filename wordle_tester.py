"""
wordle_tester.py  (v3)
======================
Runs the JS color logic (wordle_color_logic.js) via Node.
Pillow reads the image pixels; Node classifies them.
There is no duplicated logic — JS is the single source of truth.

Each test now includes per-row tile expectations in addition to
aggregate green/yellow/gray sets.
"""

import json
import subprocess
from pathlib import Path
from PIL import Image

JS_PATH = Path(__file__).parent / "wordle_color_logic.js"


def classify_tiles(img_path, letters_by_row):
    filled_rows = [r for r in letters_by_row if r.replace(".", "").strip()]
    num_rows = len(filled_rows)

    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    pixels = [list(img.getpixel((x, y))[:3]) for y in range(H) for x in range(W)]

    payload = json.dumps({"pixels": pixels, "width": W, "height": H, "numRows": num_rows})

    result = subprocess.run(
        ["node", str(JS_PATH)],
        input=payload, capture_output=True, text=True, check=True
    )
    colors = json.loads(result.stdout)["colors"]

    tiles = []
    rows = []
    for row_idx, row_str in enumerate(filled_rows):
        row_tiles = []
        for col, letter in enumerate(row_str):
            if letter == ".":
                continue
            color = colors[row_idx * 5 + col]
            t = {"letter": letter.upper(), "color": color}
            tiles.append(t)
            row_tiles.append(t)
        rows.append({"word": row_str.replace(".", ""), "tiles": row_tiles})
    return tiles, rows


def run_test(name, path, letters_by_row, expected, expected_rows=None):
    tiles, rows = classify_tiles(path, letters_by_row)

    green_set, yellow_set, gray_set = set(), set(), set()
    for t in tiles:
        if t["color"] == "green":    green_set.add(t["letter"])
        elif t["color"] == "yellow": yellow_set.add(t["letter"])
        else:                        gray_set.add(t["letter"])

    actual = {"green": green_set, "yellow": yellow_set, "gray": gray_set}

    passed = True
    errors = []

    for category in ["green", "yellow", "gray"]:
        exp = {l.upper() for l in expected.get(category, set())}
        act = actual[category]
        if category == "gray":
            act = act - actual["green"] - actual["yellow"]
        missing = exp - act
        extra   = act - exp
        if missing: errors.append(f"  {category}: missing {sorted(missing)}");    passed = False
        if extra:   errors.append(f"  {category}: unexpected {sorted(extra)}");   passed = False

    if expected_rows:
        for i, (exp_row, act_row) in enumerate(zip(expected_rows, rows)):
            for j, (exp_tile, act_tile) in enumerate(zip(exp_row["tiles"], act_row["tiles"])):
                if exp_tile["color"] != act_tile["color"]:
                    errors.append(f"  row {i+1} {exp_row['word']} col {j+1} ({exp_tile['letter']}): expected {exp_tile['color']}, got {act_tile['color']}")
                    passed = False

    print(f"{'✅ PASS' if passed else '❌ FAIL'}  {name}")
    for e in errors:
        print(e)
    return passed


def row(word, *colors):
    """g=green, y=yellow, x=gray"""
    mapping = {"g": "green", "y": "yellow", "x": "gray"}
    return {"word": word, "tiles": [{"letter": l, "color": mapping[c]} for l, c in zip(word, colors)]}


# ── TEST CASES ────────────────────────────────────────────────────────────────

tests = [
    {"name": "test1_all_green (CRANE)",
     "path": "/mnt/user-data/uploads/test1_all_green.png",
     "rows": ["CRANE", ".....", ".....", ".....", ".....", "....."],
     "expected": {"green": set("CRANE"), "yellow": set(), "gray": set()},
     "expected_rows": [row("CRANE", "g","g","g","g","g")]},

    {"name": "test2_mix_green_yellow (CRANE: A,E green; C,R,N yellow)",
     "path": "/mnt/user-data/uploads/test2_mix_green_yellow.png",
     "rows": ["CRANE", ".....", ".....", ".....", ".....", "....."],
     "expected": {"green": set("AE"), "yellow": set("CRN"), "gray": set()},
     "expected_rows": [row("CRANE", "y","y","g","y","g")]},

    {"name": "test4_same_letter_green_and_yellow (E is both green & yellow)",
     "path": "/mnt/user-data/uploads/test4_same_letter_green_and_yellow.png",
     "rows": ["ERAST", "ELBOW", ".....", ".....", ".....", "....."],
     "expected": {"green": set("E"), "yellow": set("E"), "gray": set("RASTLBOW")},
     "expected_rows": [
         row("ERAST", "y","x","x","x","x"),
         row("ELBOW", "g","x","x","x","x"),
     ]},

    {"name": "test5_all_yellow (SWING)",
     "path": "/mnt/user-data/uploads/test5_all_yellow.png",
     "rows": ["SWING", ".....", ".....", ".....", ".....", "....."],
     "expected": {"green": set(), "yellow": set("SWING"), "gray": set()},
     "expected_rows": [row("SWING", "y","y","y","y","y")]},

    {"name": "test6_partial_board (green: R,E  yellow: A  gray: C,G)",
     "path": "/mnt/user-data/uploads/test6_partial_board.png",
     "rows": ["GRACE", ".....", ".....", ".....", ".....", "....."],
     "expected": {"green": set("RE"), "yellow": set("A"), "gray": set("CG")},
     "expected_rows": [row("GRACE", "x","g","y","x","g")]},

    {"name": "test7 (green: A,L,O,F,T  yellow: O,T  gray: D,E,I,U,S)",
     "path": "/mnt/user-data/uploads/test7.png",
     "rows": ["ADIEU", "ALTOS", "ALOFT", ".....", ".....", "....."],
     "expected": {"green": set("ALOFT"), "yellow": set("OT"), "gray": set("DEIUS")},
     "expected_rows": [
         row("ADIEU", "g","x","x","x","x"),
         row("ALTOS", "g","g","y","y","x"),
         row("ALOFT", "g","g","g","g","g"),
     ]},

    {"name": "test8 (yellow: R,O,U,H  gray: S,L,A,N,G,T,I,E,D,P,C)",
     "path": "/mnt/user-data/uploads/test8.png",
     "rows": ["SLANG", "TRIED", "POUCH", ".....", ".....", "....."],
     "expected": {"green": set(), "yellow": set("ROUH"), "gray": set("SLANGTIEDPC")},
     "expected_rows": [
         row("SLANG", "x","x","x","x","x"),
         row("TRIED", "x","y","x","x","x"),
         row("POUCH", "x","y","y","x","y"),
     ]},

    {"name": "test9 (green: O,R,N  yellow: R,N  gray: A,B,V,E,I,Y,S,C)",
     "path": "/mnt/user-data/uploads/test9.png",
     "rows": ["ABOVE", "IRONY", "SCORN", ".....", ".....", "....."],
     "expected": {"green": set("ORN"), "yellow": set("RN"), "gray": set("ABVEIYSC")},
     "expected_rows": [
         row("ABOVE", "x","x","g","x","x"),
         row("IRONY", "x","y","g","y","x"),
         row("SCORN", "x","x","g","g","g"),
     ]},

    {"name": "test10 (green: S,T,O,V,E  gray: A,R,Y,L,N,K)",
     "path": "/mnt/user-data/uploads/test10.jpg",
     "rows": ["STARE", "STYLE", "STONE", "STOKE", "STOLE", "STOVE"],
     "expected": {"green": set("STOVE"), "yellow": set(), "gray": set("ARYLNK")},
     "expected_rows": [
         row("STARE", "g","g","x","x","g"),
         row("STYLE", "g","g","x","x","g"),
         row("STONE", "g","g","g","x","g"),
         row("STOKE", "g","g","g","x","g"),
         row("STOLE", "g","g","g","x","g"),
         row("STOVE", "g","g","g","g","g"),
     ]},

    {"name": "test14 QUICK/STACK/RECCE/CLACK/CRANK (green: C,R,A,N,K  yellow: C,R  gray: Q,U,I,S,T,E,L)",
     "path": "/mnt/user-data/uploads/1772041343119_image.png",
     "rows": ["QUICK", "STACK", "RECCE", "CLACK", "CRANK", "....."],
     "expected": {"green": set("CRANK"), "yellow": set("CR"), "gray": set("QUISTEL")},
     "expected_rows": [
         row("QUICK", "x","x","x","y","g"),
         row("STACK", "x","x","g","y","g"),
         row("RECCE", "y","x","y","x","x"),
         row("CLACK", "g","x","g","x","g"),
         row("CRANK", "g","g","g","g","g"),
     ]},

    {"name": "test13 BROWN/FLYER/REAMS/FIERY/QUERY (green: Q,U,E,R,Y  yellow: R,Y,E  gray: B,O,W,N,F,L,A,M,S,I)",
     "path": "/mnt/user-data/uploads/1772041231665_image.png",
     "rows": ["BROWN", "FLYER", "REAMS", "FIERY", "QUERY", "....."],
     "expected": {"green": set("QUERY"), "yellow": set("RYE"), "gray": set("BOWNFLAMSFI")},
     "expected_rows": [
         row("BROWN", "x","y","x","x","x"),
         row("FLYER", "x","x","y","y","y"),
         row("REAMS", "y","y","x","x","x"),
         row("FIERY", "x","x","g","g","g"),
         row("QUERY", "g","g","g","g","g"),
     ]},

    {"name": "test12 MAPLE/WIDER (green: I,E,R  yellow: E  gray: M,A,P,L,W,D)",
     "path": "/mnt/user-data/uploads/1772041155752_image.png",
     "rows": ["MAPLE", "WIDER", ".....", ".....", ".....", "....."],
     "expected": {"green": set("IER"), "yellow": set("E"), "gray": set("MAPLWD")},
     "expected_rows": [
         row("MAPLE", "x","x","x","x","y"),
         row("WIDER", "x","g","x","g","g"),
     ]},

    {"name": "test11 AUDIO/TOADS/ABOUT/BATON (green: B,A,T,O,N  yellow: A,O,T,B  gray: U,D,I,S)",
     "path": "/mnt/user-data/uploads/1772040905007_image.png",
     "rows": ["AUDIO", "TOADS", "ABOUT", "BATON", ".....", "....."],
     "expected": {"green": set("BATON"), "yellow": set("AOTB"), "gray": set("UDIS")},
     "expected_rows": [
         row("AUDIO", "y","x","x","x","y"),
         row("TOADS", "y","y","y","x","x"),
         row("ABOUT", "y","y","y","x","y"),
         row("BATON", "g","g","g","g","g"),
     ]},

    {"name": "test16 QUICK/STACK/RECCE/CLACK (green: A,C,K  yellow: C,R  gray: Q,U,I,S,T,E,L)",
     "path": "/mnt/user-data/uploads/test16.png",
     "rows": ["QUICK", "STACK", "RECCE", "CLACK", ".....", "....."],
     "expected": {"green": set("ACK"), "yellow": set("CR"), "gray": set("QUIS TEL".replace(" ",""))},
     "expected_rows": [
         row("QUICK", "x","x","x","y","g"),
         row("STACK", "x","x","g","y","g"),
         row("RECCE", "y","x","y","x","x"),
         row("CLACK", "g","x","g","x","g"),
     ]},

    {"name": "test17 BROWN/FLYER/REAMS/FIERY (green: E,R,Y  yellow: R,Y,E  gray: B,O,W,N,F,L,A,M,S,I)",
     "path": "/mnt/user-data/uploads/test17.png",
     "rows": ["BROWN", "FLYER", "REAMS", "FIERY", ".....", "....."],
     "expected": {"green": set("ERY"), "yellow": set("RYE"), "gray": set("BOWNFLAMS I".replace(" ",""))},
     "expected_rows": [
         row("BROWN", "x","y","x","x","x"),
         row("FLYER", "x","x","y","y","y"),
         row("REAMS", "y","y","x","x","x"),
         row("FIERY", "x","x","g","g","g"),
     ]},

    {"name": "test18 STARE/STYLE/STONE/STOKE/STOLE (green: S,T,O,E  gray: A,R,Y,L,N,K)",
     "path": "/mnt/user-data/uploads/test18.jpg",
     "rows": ["STARE", "STYLE", "STONE", "STOKE", "STOLE", "....."],
     "expected": {"green": set("STOE"), "yellow": set(), "gray": set("ARYLNK")},
     "expected_rows": [
         row("STARE", "g","g","x","x","g"),
         row("STYLE", "g","g","x","x","g"),
         row("STONE", "g","g","g","x","g"),
         row("STOKE", "g","g","g","x","g"),
         row("STOLE", "g","g","g","x","g"),
     ]},

    {"name": "test19 AUDIO/TOADS/ABOUT (yellow: A,O,T,B  gray: U,D,I,S)",
     "path": "/mnt/user-data/uploads/test19.png",
     "rows": ["AUDIO", "TOADS", "ABOUT", ".....", ".....", "....."],
     "expected": {"green": set(), "yellow": set("AOTB"), "gray": set("UDIS")},
     "expected_rows": [
         row("AUDIO", "y","x","x","x","y"),
         row("TOADS", "y","y","y","x","x"),
         row("ABOUT", "y","y","y","x","y"),
     ]},
]

passed = sum(run_test(t["name"], t["path"], t["rows"], t["expected"], t.get("expected_rows")) for t in tests)
print(f"\n{passed}/{len(tests)} tests passed")
