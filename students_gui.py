#!/usr/bin/env python3
"""
YouChem — Students Live Dashboard
Requires: python3-tk  →  sudo apt install python3-tk

Usage:
    python3 students_gui.py --url https://youchem.up.railway.app --key YOUR_API_KEY

Or set environment variables:
    YOUCHEM_URL=https://youchem.up.railway.app
    YOUCHEM_KEY=your_api_key_here
"""

import os, sys, json, time, argparse, threading
import urllib.request, urllib.error
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime

# ─── CLI / env config ─────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="YouChem Students Live Dashboard")
parser.add_argument("--url", default=os.getenv("YOUCHEM_URL", "https://youchem.up.railway.app"),
                    help="Base URL of your YouChem deployment")
parser.add_argument("--key", default=os.getenv("YOUCHEM_KEY", ""),
                    help="API key from Settings → API Key")
parser.add_argument("--refresh", type=int, default=10,
                    help="Refresh interval in seconds (default: 10)")
args = parser.parse_args()

API_URL     = args.url.rstrip("/") + "/api/public/students"
API_KEY     = args.key
REFRESH_SEC = args.refresh

GRADES = {"2nd_sec": "Grade 11", "3rd_sec": "Grade 12"}

# ─── Kali / dark palette ──────────────────────────────────────────────────────
BG      = "#0d1117"
BG2     = "#161b22"
BG3     = "#21262d"
PURPLE  = "#7c3aed"
PURPLE2 = "#a855f7"
TEAL    = "#06d6a0"
RED     = "#f85149"
YELLOW  = "#e3b341"
GREEN   = "#4ade80"
BLUE    = "#38bdf8"
TEXT    = "#e6edf3"
TEXT2   = "#8b949e"
BORDER  = "#30363d"
ROW_ODD = "#161b22"
ROW_EVN = "#1c2128"


# ─── Fetch helper ─────────────────────────────────────────────────────────────
def fetch_students():
    """Returns (data_dict, error_str). Exactly one of them is None."""
    if not API_KEY:
        return None, "No API key set.\nRun:  python3 students_gui.py --key YOUR_KEY"
    try:
        req = urllib.request.Request(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}",
                     "User-Agent": "YouChem-Dashboard/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode()), None
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return None, "Invalid API key — check Settings → API Key"
        return None, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return None, f"Connection error:\n{e.reason}"
    except Exception as e:
        return None, str(e)


# ─── Animated counter widget ──────────────────────────────────────────────────
class CounterCard(tk.Frame):
    def __init__(self, parent, title, color=PURPLE2, **kw):
        super().__init__(parent, bg=BG2, highlightbackground=BORDER,
                         highlightthickness=1, **kw)
        self._color   = color
        self._target  = 0
        tk.Label(self, text=title, bg=BG2, fg=TEXT2,
                 font=("monospace", 9, "bold")).pack(pady=(10, 2), padx=12)
        self._lbl = tk.Label(self, text="—", bg=BG2, fg=color,
                             font=("monospace", 30, "bold"))
        self._lbl.pack(pady=(0, 10))

    def set(self, value: int):
        if value == self._target and self._lbl.cget("text") != "—":
            return
        old, self._target = self._target, value
        self._ease(old, value, 20, 16)

    def _ease(self, frm, to, steps, delay):
        n = steps
        def step(i):
            if i > n:
                self._lbl.config(text=str(to))
                return
            t = 1 - (1 - i / n) ** 3   # ease-out cubic
            self._lbl.config(text=str(int(frm + (to - frm) * t)))
            self._lbl.after(delay, step, i + 1)
        step(0)


# ─── Main window ──────────────────────────────────────────────────────────────
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("YouChem  •  Students Live")
        self.configure(bg=BG)
        self.geometry("980x640")
        self.minsize(720, 500)
        self._build_ui()
        self._do_refresh()

    # ── Layout ────────────────────────────────────────────────────────────────
    def _build_ui(self):
        # ── Header bar ───────────────────────────────────────────────────────
        hdr = tk.Frame(self, bg=BG2, height=50)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        # live indicator dot
        dot_c = tk.Canvas(hdr, width=10, height=10, bg=BG2, highlightthickness=0)
        dot_c.pack(side="left", padx=(16, 6), pady=20)
        self._dot = dot_c
        self._dot_id = dot_c.create_oval(0, 0, 10, 10, fill=TEXT2, outline="")

        tk.Label(hdr, text="YouChem", bg=BG2, fg=TEXT,
                 font=("monospace", 13, "bold")).pack(side="left")
        tk.Label(hdr, text="  •  Students Live", bg=BG2, fg=TEXT2,
                 font=("monospace", 10)).pack(side="left")

        self._clock_lbl = tk.Label(hdr, text="", bg=BG2, fg=TEXT2,
                                   font=("monospace", 9))
        self._clock_lbl.pack(side="right", padx=16)
        self._tick_clock()

        tk.Label(hdr, text=args.url, bg=BG2, fg=TEXT2,
                 font=("monospace", 8)).pack(side="right", padx=4)

        # ── Stat cards ───────────────────────────────────────────────────────
        cards_row = tk.Frame(self, bg=BG)
        cards_row.pack(fill="x", padx=14, pady=(12, 0))

        self._c_total   = CounterCard(cards_row, "Total Students",  PURPLE2)
        self._c_g11     = CounterCard(cards_row, "Grade 11",        TEAL)
        self._c_g12     = CounterCard(cards_row, "Grade 12",        BLUE)
        self._c_codes   = CounterCard(cards_row, "Total Codes",     YELLOW)
        self._c_free    = CounterCard(cards_row, "Available Codes", GREEN)

        for w in (self._c_total, self._c_g11, self._c_g12,
                  self._c_codes, self._c_free):
            w.pack(side="left", fill="x", expand=True, padx=3)

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=14, pady=10)

        # ── Search bar ───────────────────────────────────────────────────────
        sf = tk.Frame(self, bg=BG)
        sf.pack(fill="x", padx=14, pady=(0, 8))
        tk.Label(sf, text="Search:", bg=BG, fg=TEXT2,
                 font=("monospace", 9)).pack(side="left", padx=(0, 6))
        self._q = tk.StringVar()
        self._q.trace_add("write", lambda *_: self._filter())
        tk.Entry(sf, textvariable=self._q, bg=BG3, fg=TEXT,
                 insertbackground=TEXT, relief="flat",
                 font=("monospace", 10),
                 highlightbackground=BORDER,
                 highlightthickness=1).pack(side="left", fill="x",
                                            expand=True, ipady=5, ipadx=6)

        # ── Table ────────────────────────────────────────────────────────────
        cols  = ("#", "Name", "Email", "Grade", "Phone", "Guardian", "School")
        widths= (36, 200, 230, 90, 120, 120, 160)

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("D.Treeview",
                        background=ROW_ODD, foreground=TEXT,
                        fieldbackground=ROW_ODD, rowheight=30,
                        borderwidth=0, font=("monospace", 9))
        style.configure("D.Treeview.Heading",
                        background=BG3, foreground=PURPLE2,
                        relief="flat", font=("monospace", 9, "bold"))
        style.map("D.Treeview",
                  background=[("selected", PURPLE)],
                  foreground=[("selected", TEXT)])

        tf = tk.Frame(self, bg=BG)
        tf.pack(fill="both", expand=True, padx=14)

        vsb = ttk.Scrollbar(tf, orient="vertical")
        vsb.pack(side="right", fill="y")
        hsb = ttk.Scrollbar(tf, orient="horizontal")
        hsb.pack(side="bottom", fill="x")

        self._tree = ttk.Treeview(tf, columns=cols, show="headings",
                                  style="D.Treeview",
                                  yscrollcommand=vsb.set,
                                  xscrollcommand=hsb.set)
        vsb.config(command=self._tree.yview)
        hsb.config(command=self._tree.xview)

        for col, w in zip(cols, widths):
            self._tree.heading(col, text=col,
                               command=lambda c=col: self._sort(c))
            self._tree.column(col, width=w, minwidth=w, anchor="center")

        self._tree.tag_configure("even", background=ROW_EVN)
        self._tree.tag_configure("odd",  background=ROW_ODD)
        self._tree.pack(fill="both", expand=True)

        # ── Status bar ───────────────────────────────────────────────────────
        sb = tk.Frame(self, bg=BG3, height=26)
        sb.pack(fill="x", side="bottom")
        sb.pack_propagate(False)

        self._status_lbl = tk.Label(sb, text="Connecting...", bg=BG3, fg=TEXT2,
                                    font=("monospace", 8))
        self._status_lbl.pack(side="left", padx=10)

        self._cd_lbl = tk.Label(sb, text="", bg=BG3, fg=TEXT2,
                                font=("monospace", 8))
        self._cd_lbl.pack(side="right", padx=10)

        self._next_at = time.time()
        self._tick_countdown()

        # internal state
        self._all = []
        self._sort_col = None
        self._sort_asc = True

    # ── Data ─────────────────────────────────────────────────────────────────
    def _do_refresh(self):
        self._next_at = time.time() + REFRESH_SEC
        threading.Thread(target=self._fetch_thread, daemon=True).start()
        self.after(REFRESH_SEC * 1000, self._do_refresh)

    def _fetch_thread(self):
        data, err = fetch_students()
        self.after(0, self._on_data, data, err)

    def _on_data(self, data, err):
        if err:
            self._dot.itemconfig(self._dot_id, fill=RED)
            self._status_lbl.config(text=f"Error: {err.splitlines()[0]}", fg=RED)
            return

        self._dot.itemconfig(self._dot_id, fill=TEAL)
        self._c_total.set(data["total"])
        self._c_g11.set(data["grade2"])
        self._c_g12.set(data["grade3"])
        self._c_codes.set(data["codesTotal"])
        self._c_free.set(data["codesFree"])

        self._all = data.get("students", [])
        self._filter()

        now = datetime.now().strftime("%H:%M:%S")
        self._status_lbl.config(
            text=f"Last updated: {now}   •   {data['total']} students",
            fg=TEXT2)

    def _filter(self):
        q = self._q.get().strip().lower()
        rows = [
            s for s in self._all
            if not q
               or q in (s.get("name") or "").lower()
               or q in (s.get("email") or "").lower()
               or q in (s.get("phone") or "").lower()
               or q in (s.get("school") or "").lower()
        ]
        self._populate(rows)

    def _populate(self, students):
        for r in self._tree.get_children():
            self._tree.delete(r)
        for i, s in enumerate(students):
            tag = "even" if i % 2 == 0 else "odd"
            self._tree.insert("", "end", tags=(tag,), values=(
                i + 1,
                s.get("name") or "—",
                s.get("email") or "—",
                GRADES.get(s.get("gradeLevel") or "", s.get("gradeLevel") or "—"),
                s.get("phone") or "—",
                s.get("guardianPhone") or "—",
                s.get("school") or "—",
            ))

    def _sort(self, col):
        items = [(self._tree.set(k, col), k) for k in self._tree.get_children("")]
        asc = self._sort_col != col or not self._sort_asc
        items.sort(reverse=not asc,
                   key=lambda x: x[0].lower() if x[0] != "—" else "")
        for i, (_, k) in enumerate(items):
            self._tree.move(k, "", i)
            tag = "even" if i % 2 == 0 else "odd"
            self._tree.item(k, tags=(tag,))
        self._sort_col, self._sort_asc = col, asc

    # ── Timers ────────────────────────────────────────────────────────────────
    def _tick_countdown(self):
        rem = max(0, int(self._next_at - time.time()))
        self._cd_lbl.config(text=f"Refresh in  {rem}s")
        self.after(500, self._tick_countdown)

    def _tick_clock(self):
        self._clock_lbl.config(
            text=datetime.now().strftime("%A  %H:%M:%S"))
        self.after(1000, self._tick_clock)


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not API_KEY:
        print("⚠  No API key provided.")
        print("   Get it from: YouChem dashboard → Settings → API Key")
        print(f"   Then run:  python3 {sys.argv[0]} --key YOUR_KEY")
        print()
    app = App()
    app.mainloop()
