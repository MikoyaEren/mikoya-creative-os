#!/usr/bin/env python3
"""Mikoya label checker - flags possible branding errors in a generated video, frame by frame.

For each frame it reads all visible text with a local OCR model (no cloud, no credits) and checks
the Mikoya labels against the approved packaging text and design:

  Good Matcha (Mikoya pouch): MIKOYA / MATCHA / 100% Ceremonial / 30g, white text on a black pouch,
                              green leaf below the text, elements in the right top-to-bottom order.
  Bose Matcha (villain):      BOSER / MATCHA on a red panel, 30g.

Severity:
  ERROR    wrong or garbled text (e.g. "Caremonial"), wrong colour
  WARNING  an element that should be readable is missing, unexpected text, partial/garbled label
  INFO     label not visible in this frame (fine during fast action, turned away, out of frame)

The result supports visual quality control; it does not replace it.

Usage:
  python label_check.py VIDEO --expect good,bad --out DIR [--every 1] [--start S] [--end S]
"""
import argparse, difflib, json, os, re, sys, unicodedata
import cv2, numpy as np

GOOD = {"mikoya": "MIKOYA", "matcha": "MATCHA", "100%ceremonial": "100% Ceremonial", "30g": "30g"}
BAD = {"boser": "BÖSER", "matcha": "MATCHA", "30g": "30g"}
VOCAB = set(GOOD) | set(BAD) | {"100%", "ceremonial", "bosermatcha"}

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9%]", "", s)
    s = re.sub(r"(?<=[a-z])0|0(?=[a-z]{2})", "o", s)            # OCR reads o as 0 inside words
    s = re.sub(r"(?<=[a-z])1(?=[a-z])", "l", s)
    return s

def canon(s):
    """Fold typical OCR confusions so only real spelling differences remain."""
    s = s.replace("rn", "m").replace("rm", "m")
    s = re.sub(r"(?<=\d)9$", "g", s)
    s = re.sub(r"(?<=\d)9(?=%)", "", s)
    return s

def best(token, vocab):
    sc = [(difflib.SequenceMatcher(None, token, v).ratio(), v) for v in vocab]
    return max(sc) if sc else (0, None)

class Checker:
    def __init__(self, expect, min_conf=0.5):
        from rapidocr_onnxruntime import RapidOCR
        self.ocr = RapidOCR(); self.expect = expect; self.min_conf = min_conf

    def read(self, img):
        res, _ = self.ocr(img)
        out = []
        for box, text, conf in res or []:
            conf = float(conf)
            if conf < self.min_conf: continue
            pts = np.array(box, np.float32)
            out.append({"text": text, "n": norm(text), "conf": round(conf, 2),
                        "box": [int(pts[:, 0].min()), int(pts[:, 1].min()), int(pts[:, 0].max()), int(pts[:, 1].max())]})
        # split merged tokens such as "BOSER MATCHA" or "100%Ceremonial"
        for t in out:
            if t["n"].startswith("boser") and len(t["n"]) > 6: t["parts"] = ["boser", t["n"][5:]]
        return out

    @staticmethod
    def frac(img, box, lo, hi, grow=(0, 0, 0, 0)):
        x0, y0, x1, y1 = box; h, w = img.shape[:2]
        x0, y0, x1, y1 = max(x0 - grow[0], 0), max(y0 - grow[1], 0), min(x1 + grow[2], w), min(y1 + grow[3], h)
        if x1 <= x0 or y1 <= y0: return 0.0
        hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
        m = np.zeros(hsv.shape[:2], np.uint8)
        for a, b in zip(lo, hi): m |= cv2.inRange(hsv, np.array(a), np.array(b))
        return float(m.mean() / 255)

    def check(self, img):
        toks = self.read(img)
        flags = []; found = {}
        def flag(sev, msg): flags.append({"severity": sev, "msg": msg})
        # classify every token
        good_like, bad_like = [], []
        for t in toks:
            n = t["n"]
            if len(n) < 2: continue
            if n.startswith("bos") or n.startswith("bös") or n == "boser" or (best(n, ["boser"])[0] >= 0.7):
                bad_like.append(dict(t, key="boser", exact=(canon(n)[:5] == "boser"))); continue
            if "%" in n or "cer" in n or "mon" in n or best(n, ["100%ceremonial"])[0] >= 0.55:
                good_like.append(dict(t, key="100%ceremonial", exact=(canon(n) == "100%ceremonial"))); continue
            sc, v = best(n, ["mikoya", "matcha", "30g"])
            if sc >= 0.6:
                tgt = dict(t, key=v, exact=(canon(n) == v))
                (good_like if v == "mikoya" else good_like).append(tgt)
            elif len(n) >= 3:
                flag("WARNING", f"unexpected text '{t['text']}'")
        # assign MATCHA / 30g to the villain when they sit right below a BOSER token
        for b in bad_like:
            bx0, by0, bx1, by1 = b["box"]; bh = by1 - by0
            for t in list(good_like):
                if t["key"] in ("matcha", "30g"):
                    x0, y0, x1, y1 = t["box"]
                    if x1 > bx0 - bh and x0 < bx1 + bh and by1 - bh * 0.5 < y0 < by1 + bh * (2.5 if t["key"] == "matcha" else 7):
                        good_like.remove(t); bad_like.append(t)
        # wrong text
        for t in good_like + bad_like:
            if not t["exact"]:
                exp = GOOD.get(t["key"]) or BAD.get(t["key"])
                sev = "ERROR" if len(t["n"]) >= max(3, len(t["key"]) - 1) else "WARNING"
                flag(sev, f"text reads '{t['text']}', expected '{exp}'" if sev == "ERROR" else f"partial/garbled label text '{t['text']}' (expected '{exp}')")
        gk = {t["key"]: t for t in good_like if t["exact"]}; bk = {t["key"]: t for t in bad_like if t["exact"]}
        found["good"] = sorted(gk); found["bad"] = sorted(bk)
        # Good Matcha label
        if "good" in self.expect:
            if not good_like:
                flag("INFO", "Mikoya label not visible")
            else:
                for k, lab in GOOD.items():
                    if k not in gk and not any(t["key"] == k for t in good_like):
                        flag("WARNING", f"Mikoya label: '{lab}' not readable")
                order = [k for k in ("mikoya", "matcha", "100%ceremonial", "30g") if k in gk]
                ys = [gk[k]["box"][1] for k in order]
                if ys != sorted(ys): flag("ERROR", "Mikoya label: elements out of order " + " > ".join(GOOD[k] for k in order))
                if "matcha" in gk:
                    x0, y0, x1, y1 = gk["matcha"]["box"]
                    crop = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
                    if crop.size and np.percentile(crop, 95) < 150: flag("ERROR", "Mikoya label: MATCHA text is not white")
                    if crop.size and np.percentile(crop, 20) > 110: flag("ERROR", "Mikoya label: pouch behind MATCHA is not black")
                if "100%ceremonial" in gk:
                    x0, y0, x1, y1 = gk["100%ceremonial"]["box"]; h = y1 - y0
                    g = self.frac(img, (x0, y1, x1, y1 + h * 7), [(25, 50, 60)], [(70, 255, 255)])
                    if g < 0.01: flag("WARNING", f"Mikoya label: green leaf not found below '100% Ceremonial' ({g:.1%})")
        # Bose Matcha panel
        if "bad" in self.expect:
            if "boser" not in bk:
                if not any(t["key"] == "boser" for t in bad_like):
                    flag("WARNING", "Böser Matcha panel: 'BÖSER MATCHA' not found")
            else:
                r = self.frac(img, bk["boser"]["box"], [(0, 90, 70), (165, 90, 70)], [(10, 255, 255), (180, 255, 255)], grow=(10, 10, 10, 10))
                if r < 0.15: flag("ERROR", f"Böser Matcha panel: lettering is not on a red panel ({r:.0%} red)")
                if "matcha" not in bk: flag("WARNING", "Böser Matcha panel: 'MATCHA' not readable")
        return {"tokens": [{k: t[k] for k in ("text", "conf", "box")} for t in toks], "found": found, "flags": flags}

def ranges(bools, fps, every, offset):
    out, start = [], None
    for i, b in enumerate(bools + [False]):
        if b and start is None: start = i
        if not b and start is not None:
            out.append([round(offset + start * every / fps, 2), round(offset + (i - 1) * every / fps, 2)]); start = None
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video"); ap.add_argument("--expect", default="good", help="labels that should appear: good, bad or good,bad")
    ap.add_argument("--out", required=True); ap.add_argument("--every", type=int, default=1)
    ap.add_argument("--persist", type=int, default=3, help="consecutive checked frames a text error must persist to count as ERROR")
    ap.add_argument("--start", type=float, default=0.0); ap.add_argument("--end", type=float, default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    ck = Checker(set(a.expect.split(",")))
    cap = cv2.VideoCapture(a.video); fps = cap.get(cv2.CAP_PROP_FPS) or 24
    cap.set(cv2.CAP_PROP_POS_MSEC, a.start * 1000)
    frames, thumbs, i = [], [], 0
    while True:
        ok, img = cap.read()
        if not ok: break
        t = a.start + i / fps
        if a.end is not None and t > a.end + 1e-6: break
        if i % a.every == 0:
            r = ck.check(img); r["t"] = round(t, 3); frames.append(r)
            sev = {f["severity"] for f in r["flags"]}
            if sev & {"ERROR", "WARNING"}:
                th = img.copy()
                for tok in r["tokens"]:
                    x0, y0, x1, y1 = tok["box"]; cv2.rectangle(th, (x0, y0), (x1, y1), (0, 255, 255), 3)
                th = cv2.resize(th, (240, int(240 * img.shape[0] / img.shape[1])))
                col = (0, 0, 255) if "ERROR" in sev else (0, 200, 255)
                cv2.putText(th, f"{t:.2f}s", (4, 18), 0, 0.6, col, 2); thumbs.append(th)
        i += 1
    # A real generation error persists; OCR noise flickers. Keep an ERROR only when the same
    # kind of text error is present in at least --persist consecutive checked frames.
    def kind(f): return f["msg"].split("', expected")[-1] if f["msg"].startswith("text reads") else None
    for idx, r in enumerate(frames):
        for f in r["flags"]:
            k = kind(f)
            if f["severity"] != "ERROR" or k is None: continue
            run, j = 1, idx - 1
            while j >= 0 and any(kind(g) == k for g in frames[j]["flags"]): run += 1; j -= 1
            j = idx + 1
            while j < len(frames) and any(kind(g) == k for g in frames[j]["flags"]): run += 1; j += 1
            if run < a.persist:
                f["severity"] = "WARNING"; f["msg"] = "possible misread (isolated): " + f["msg"]
    sev = lambda s: [any(f["severity"] == s for f in r["flags"]) for r in frames]
    err, warn, info = sev("ERROR"), sev("WARNING"), sev("INFO")
    counts = {}
    for r in frames:
        for f in r["flags"]:
            msg = re.sub(r" \(.*", "", f["msg"])
            k = f"{f['severity']}: {msg}"; counts[k] = counts.get(k, 0) + 1
    n = max(len(frames), 1)
    summary = {"video": a.video, "expect": sorted(ck.expect), "frames_checked": len(frames),
               "window_s": [a.start, frames[-1]["t"] if frames else a.start],
               "clean_frames": sum(1 for e, w in zip(err, warn) if not e and not w),
               "clean_rate": round(sum(1 for e, w in zip(err, warn) if not e and not w) / n, 3),
               "error_ranges_s": ranges(err, fps, a.every, a.start), "warning_ranges_s": ranges(warn, fps, a.every, a.start),
               "label_not_visible_ranges_s": ranges(info, fps, a.every, a.start),
               "flag_counts": dict(sorted(counts.items(), key=lambda x: -x[1]))}
    summary["verdict"] = ("PASS" if not any(err) and not any(warn) else "CHECK" if not any(err) else "FAIL")
    json.dump({"summary": summary, "frames": frames}, open(os.path.join(a.out, "report.json"), "w"), indent=1, ensure_ascii=False)
    with open(os.path.join(a.out, "report.md"), "w") as f:
        f.write(f"# Label check: {os.path.basename(a.video)}\n\n**Verdict: {summary['verdict']}**, {summary['clean_frames']}/{len(frames)} frames clean ({summary['clean_rate']:.0%})\n\n")
        f.write(f"- Errors at: {summary['error_ranges_s'] or 'none'}\n- Warnings at: {summary['warning_ranges_s'] or 'none'}\n- Label not visible at: {summary['label_not_visible_ranges_s'] or 'never'}\n\n")
        f.write("| Flag | Frames |\n|---|---|\n" + "".join(f"| {k} | {v} |\n" for k, v in summary["flag_counts"].items()))
        f.write("\nAutomated check: confirm flagged frames (flagged_frames.jpg) and the final cut visually.\n")
    if thumbs:
        cols = 8; thumbs = thumbs[:64]
        rows = [np.hstack(thumbs[k:k + cols] + [np.zeros_like(thumbs[0])] * (cols - len(thumbs[k:k + cols]))) for k in range(0, len(thumbs), cols)]
        cv2.imwrite(os.path.join(a.out, "flagged_frames.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(json.dumps(summary, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    main()
