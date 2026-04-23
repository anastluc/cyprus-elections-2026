from __future__ import annotations

import re
import unicodedata

from unidecode import unidecode

_GREEK_TONOS = {
    "ά": "α", "έ": "ε", "ή": "η", "ί": "ι", "ό": "ο", "ύ": "υ", "ώ": "ω",
    "ϊ": "ι", "ϋ": "υ", "ΐ": "ι", "ΰ": "υ",
    "Ά": "Α", "Έ": "Ε", "Ή": "Η", "Ί": "Ι", "Ό": "Ο", "Ύ": "Υ", "Ώ": "Ω",
    "Ϊ": "Ι", "Ϋ": "Υ",
}

_WS_RE = re.compile(r"\s+")


def strip_tonos(s: str) -> str:
    return "".join(_GREEK_TONOS.get(ch, ch) for ch in s)


def is_greek(s: str) -> bool:
    for ch in s:
        if "\u0370" <= ch <= "\u03ff" or "\u1f00" <= ch <= "\u1fff":
            return True
    return False


def detect_lang(value: str | None) -> str | None:
    """Return 'gr', 'en', or None for a free-text field value.

    Counts alphabetic characters (ignoring whitespace, digits, punctuation,
    emoji) and classifies by which script dominates. Returns None when the
    letter count is below 3 — too short to tell (e.g. "MD", "45").
    """
    if not value:
        return None
    gr = 0
    en = 0
    for ch in value:
        if "\u0370" <= ch <= "\u03ff" or "\u1f00" <= ch <= "\u1fff":
            gr += 1
        elif ("a" <= ch <= "z") or ("A" <= ch <= "Z"):
            en += 1
    total = gr + en
    if total < 3:
        return None
    if gr >= en:
        return "gr"
    return "en"


def normalize_name(name: str) -> str:
    """Canonical form used only for dedupe/matching: lowercase, no accents."""
    name = unicodedata.normalize("NFC", name).strip()
    name = strip_tonos(name).lower()
    name = _WS_RE.sub(" ", name)
    return name


_GR_LATIN_DIGRAPHS = [
    ("ου", "ou"), ("Ου", "Ou"), ("ΟΥ", "OU"),
    ("αι", "ai"), ("Αι", "Ai"), ("ΑΙ", "AI"),
    ("ει", "ei"), ("Ει", "Ei"), ("ΕΙ", "EI"),
    ("οι", "oi"), ("Οι", "Oi"), ("ΟΙ", "OI"),
    ("υι", "ui"), ("Υι", "Ui"),
    ("μπ", "mp"), ("Μπ", "Mp"), ("ΜΠ", "MP"),
    ("ντ", "nt"), ("Ντ", "Nt"), ("ΝΤ", "NT"),
    ("γγ", "ng"), ("Γγ", "Ng"),
    ("γκ", "g"),  ("Γκ", "G"),
]
_GR_LATIN_CHARS = {
    "α":"a","β":"v","γ":"g","δ":"d","ε":"e","ζ":"z","η":"i","θ":"th",
    "ι":"i","κ":"k","λ":"l","μ":"m","ν":"n","ξ":"x","ο":"o","π":"p",
    "ρ":"r","σ":"s","ς":"s","τ":"t","υ":"y","φ":"f","χ":"ch","ψ":"ps","ω":"o",
    "Α":"A","Β":"V","Γ":"G","Δ":"D","Ε":"E","Ζ":"Z","Η":"I","Θ":"Th",
    "Ι":"I","Κ":"K","Λ":"L","Μ":"M","Ν":"N","Ξ":"X","Ο":"O","Π":"P",
    "Ρ":"R","Σ":"S","Τ":"T","Υ":"Y","Φ":"F","Χ":"Ch","Ψ":"Ps","Ω":"O",
}


def transliterate_gr_to_en(name: str) -> str:
    """Greek→Latin transliteration following common Cypriot conventions.

    Priority vs unidecode (which produces e.g. "Kharalampous"): we map χ→ch,
    η→i, ω→o, matching the spelling published on party sites.
    """
    if not is_greek(name):
        return _WS_RE.sub(" ", unidecode(name)).strip()
    s = strip_tonos(name)
    for src, dst in _GR_LATIN_DIGRAPHS:
        s = s.replace(src, dst)
    s = "".join(_GR_LATIN_CHARS.get(ch, ch) for ch in s)
    # Anything still non-ASCII (diacritics, unknown) → unidecode cleanup.
    s = unidecode(s)
    return _WS_RE.sub(" ", s).strip()


_NAME_NOISE = {"dr", "dr.", "mr", "mrs", "ms", "prof", "prof."}
# Vowel and near-equivalent consonant collapses — tolerates Cypriot
# transliteration variance (mb/mp, b/v, es/is, ou/u, d/nt, …).
_FUZZY_COLLAPSE = str.maketrans({
    "y": "i", "e": "i", "o": "o", "u": "u",
    "h": "", "v": "b", "f": "p", "w": "v",
})
# Digraph collapses run before the char-level map.
_FUZZY_DIGRAPHS = [
    ("ou", "u"), ("mp", "b"), ("mb", "b"), ("nt", "d"), ("ng", "g"),
    ("ph", "f"), ("th", "t"), ("ch", "c"), ("ks", "x"), ("tz", "z"),
    ("ps", "s"), ("kh", "c"), ("gh", "g"),
]


def fuzzy_name_key(name_gr: str | None, name_en: str | None) -> str:
    """Looser key for fallback matching.

    Collapses digraphs (mp↔mb↔b, ou→u, nt→d, th→t, ph→f, ch→c, ks→x, tz→z),
    then maps vowels y/e→i, consonant v↔b, drops h/f, then collapses doubled
    characters.

    Useful when two sources spell the same name differently
    ("Pasiourtides" vs "Pasioutidis", "Charalambous" vs "Charalampous",
    "Tzioni" vs "Tzionis").
    """
    key = name_key(name_gr, name_en)
    if not key:
        return ""
    for src, dst in _FUZZY_DIGRAPHS:
        key = key.replace(src, dst)
    collapsed = key.translate(_FUZZY_COLLAPSE)
    # Collapse doubled chars: "mm" → "m", "ss" → "s", "ii" → "i".
    out = []
    prev = ""
    for ch in collapsed:
        if ch == prev and ch != " ":
            continue
        out.append(ch)
        prev = ch
    # Also drop trailing-s on each token (Greek masculines -ης/-ος vs English -i).
    tokens = [t.rstrip("s") for t in "".join(out).split() if t]
    return " ".join(sorted(tokens))


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            ins = curr[j - 1] + 1
            dele = prev[j] + 1
            sub = prev[j - 1] + (ca != cb)
            curr.append(min(ins, dele, sub))
        prev = curr
    return prev[-1]


def similar_name_keys(key_a: str, key_b: str, max_edits: int = 2) -> bool:
    """Token-order-tolerant edit-distance check, used as a last-ditch dedupe."""
    if not key_a or not key_b:
        return False
    if key_a == key_b:
        return True
    toks_a = sorted(key_a.split())
    toks_b = sorted(key_b.split())
    if len(toks_a) != len(toks_b):
        return False
    total = 0
    for ta, tb in zip(toks_a, toks_b):
        if abs(len(ta) - len(tb)) > max_edits:
            return False
        total += _levenshtein(ta, tb)
        if total > max_edits:
            return False
    return total <= max_edits


def name_key(name_gr: str | None, name_en: str | None) -> str:
    """Dedupe key: latinized, normalized, token-sorted, parentheticals stripped.

    Order-independent so "Andreou Marina" and "Marina Andreou" collide.
    Parenthetical nicknames/maiden names ("(Lakis)", "(Liasis)") are dropped.
    """
    if name_en:
        base = transliterate_gr_to_en(name_en)
    elif name_gr:
        base = transliterate_gr_to_en(name_gr)
    else:
        return ""
    base = re.sub(r"\([^)]*\)", " ", base)
    normalized = normalize_name(base)
    tokens = [t for t in normalized.split() if t and t not in _NAME_NOISE and len(t) > 1]
    return " ".join(sorted(tokens))


# Feminine-gendered Greek surname/first-name endings (heuristic).
_FEMININE_ENDINGS = ("ου", "α", "η", "ινα", "ίνα")
_MASCULINE_ENDINGS = ("ος", "ης", "ας", "ίδης", "ίδης", "άκης", "ίου")


def infer_gender_from_greek(name_gr: str) -> tuple[str, float] | None:
    """Return (gender, heuristic_confidence) or None if uncertain.

    Looks at the first given name (first token) stripped of tonos.
    """
    if not name_gr:
        return None
    first = strip_tonos(name_gr.strip().split()[0]).lower()
    if first.endswith(_FEMININE_ENDINGS):
        return ("F", 0.75)
    if first.endswith(_MASCULINE_ENDINGS):
        return ("M", 0.75)
    return None
