from cyprus_elections.config import load_config
from cyprus_elections.scrapers import base as registry
from cyprus_elections.scrapers.llm_generic import _clean_html_to_text


def test_clean_html_removes_boilerplate():
    html = """
    <html><head><style>.x{color:red}</style><script>alert(1)</script></head>
    <body>
      <nav>menu</nav>
      <h1>Candidates</h1>
      <p>Maria Nicolaou — Nicosia</p>
      <script>tracker()</script>
      <footer>© 2026</footer>
    </body></html>
    """
    text = _clean_html_to_text(html)
    assert "Candidates" in text
    assert "Maria Nicolaou" in text
    assert "alert" not in text
    assert "tracker" not in text
    assert "menu" not in text
    assert "© 2026" not in text


def test_llm_generic_registered_for_all_aliases():
    registry.load_all()
    for code in (
        "llm_generic", "news", "disy", "diko", "dipa", "elam", "edek",
        "kosp", "alma", "direct_democracy",
    ):
        assert registry.get(code) is not None, f"{code} not registered"


def test_each_enabled_party_has_a_scraper():
    cfg = load_config()
    registry.load_all()
    for party in cfg.parties:
        if not party.enabled:
            continue
        assert registry.get(party.scraper) is not None, (
            f"party {party.code} references missing scraper '{party.scraper}'"
        )
