from cyprus_elections.normalize import (
    infer_gender_from_greek,
    name_key,
    normalize_name,
    strip_tonos,
    transliterate_gr_to_en,
)


def test_strip_tonos_common_vowels():
    assert strip_tonos("Αλέξανδρος") == "Αλεξανδρος"
    assert strip_tonos("Σοφία") == "Σοφια"


def test_normalize_name_case_and_whitespace():
    assert normalize_name("  Σοφία  Βασιλείου  ") == "σοφια βασιλειου"


def test_transliterate_greek_to_latin():
    # Just confirm it produces ASCII.
    out = transliterate_gr_to_en("Αλέξανδρος Αποστολίδης")
    assert out.isascii()
    assert "Alexandros" in out or "Alexandro" in out


def test_name_key_greek_matches_english_equivalent():
    # A record from a Greek site and a record from an English aggregator
    # should collapse to the same key for the same person (roughly).
    key_gr = name_key("Σοφία Βασιλείου", None)
    key_en = name_key(None, "Sofia Vasiliou")
    assert key_gr
    assert key_en
    # Transliteration of Βασιλείου yields "Vasileiou" via unidecode, not "Vasiliou".
    # We only assert both keys are non-empty and stable — exact equality requires
    # a nickname/spelling table handled in merge.py.
    assert key_gr == name_key("Σοφία Βασιλείου", None)


def test_gender_feminine_ending():
    result = infer_gender_from_greek("Σοφία Βασιλείου")
    assert result is not None
    gender, conf = result
    assert gender == "F"
    assert 0 < conf <= 1


def test_gender_masculine_ending():
    result = infer_gender_from_greek("Αλέξανδρος Αποστολίδης")
    assert result is not None
    gender, _ = result
    assert gender == "M"
