from pathlib import Path

from cyprus_elections.config import load_config
from cyprus_elections.scrapers.akel import AkelScraper
from cyprus_elections.scrapers.volt import VoltScraper

FIXTURES = Path(__file__).parent / "fixtures"


def test_volt_parser_extracts_candidates_per_district():
    cfg = load_config()
    party = cfg.party_by_code("VOLT")
    assert party is not None
    html = (FIXTURES / "volt.html").read_text(encoding="utf-8")
    scraper = VoltScraper()
    out = scraper._parse(cfg, party, "https://voltcyprus.org/people/ypopsifioi-vouleftes-volt-2026", html)
    assert len(out) >= 50, f"expected >=50 candidates, got {len(out)}"
    districts = {r.district_code for r in out}
    # Every candidate should have a district assigned.
    assert None not in districts, f"some candidates missing district: {[r.name_gr for r in out if r.district_code is None][:5]}"
    assert {"NIC", "LIM", "FAM", "LAR", "PAF", "KYR"} & districts
    # Smoke: known candidate is present in Nicosia.
    apostolidis = [r for r in out if r.name_gr and "Αποστολίδης" in r.name_gr]
    assert apostolidis, "expected Αλέξανδρος Αποστολίδης in Volt list"
    assert apostolidis[0].district_code == "NIC"
    assert apostolidis[0].fields.get("profession")


def test_akel_parser_extracts_candidates_per_district():
    cfg = load_config()
    party = cfg.party_by_code("AKEL")
    assert party is not None
    html = (FIXTURES / "akel.html").read_text(encoding="utf-8")
    scraper = AkelScraper()
    out = scraper._parse(
        cfg,
        party,
        "https://akel.org.cy/akel-left-social-alliance-candidate-list-for-the-parliamentary-elections-in-may-2026/?lang=en",
        html,
    )
    assert len(out) >= 30, f"expected >=30 AKEL candidates, got {len(out)}"
    districts = {r.district_code for r in out}
    assert {"NIC", "LIM", "FAM", "LAR", "PAF", "KYR"} & districts
    stefanou = [r for r in out if r.name_en and "Stefanos Stefanou" in r.name_en]
    assert stefanou, "expected Stefanos Stefanou in AKEL list"
    assert stefanou[0].district_code == "NIC"
    assert stefanou[0].fields.get("age") == 60
