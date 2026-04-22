"""Shared helpers for extracting social / website / CV links from HTML fragments."""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from selectolax.parser import HTMLParser, Node

_SOCIAL_HOSTS = {
    "facebook": ("facebook.com", "fb.com", "fb.me", "m.facebook.com"),
    "instagram": ("instagram.com",),
    "twitter": ("twitter.com", "x.com"),
    "linkedin": ("linkedin.com", "lnkd.in"),
}

_IGNORE_HOSTS = (
    "wa.me", "api.whatsapp.com", "mailto:", "tel:",
    "google.com", "maps.google.com", "goo.gl",
    "wordpress.org", "gravatar.com",
)

# Social-media handles that are party/organization accounts, not personal.
# Matched case-insensitively against the URL path after the domain.
_PARTY_SOCIAL_HANDLES = {
    "voltcyprus", "voltcy", "volteuropa", "volt.europa",
    "akelkke", "akel.official", "akelcy",
    "disycy", "disyofficial", "disy.rally",
    "dikocy", "dikoofficial",
    "dipacy", "dipaparty",
    "elamcy", "elamofficial",
    "edekcy", "edekofficial",
    "ecologistescy", "kospcy",
    "almacitizensforcyprus", "almacy",
    "ademcy",
    "offsite.com.cy", "philenews", "politiscy", "cyprusmail", "sigmalive",
}

_DOC_EXTS = (".pdf", ".doc", ".docx")

_URL_IN_TEXT_RE = re.compile(r"https?://[^\s<>\"')]+", re.IGNORECASE)


def _classify_host(host: str) -> str | None:
    host = host.lower().lstrip(".")
    for kind, domains in _SOCIAL_HOSTS.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return kind
    return None


def _absolutize(href: str, base_url: str | None) -> str | None:
    href = (href or "").strip()
    if not href or href.startswith(("#", "javascript:")):
        return None
    if href.startswith("//"):
        href = "https:" + href
    if not href.startswith(("http://", "https://")):
        if base_url:
            href = urljoin(base_url, href)
        else:
            return None
    return href


def _looks_like_personal_website(url: str) -> bool:
    """Discard obvious non-personal domains (cdn, news, wikipedia, party sites)."""
    host = urlparse(url).hostname or ""
    host = host.lower().lstrip(".")
    if not host:
        return False
    bad = (
        "wikipedia.org", "wikidata.org", "google.", "youtube.com", "youtu.be",
        "tiktok.com", "amazon.", "apple.com", "cdn.", "s3.amazonaws.com",
        "akel.org.cy", "voltcyprus.org", "volt.team", "volteuropa.org",
        "disy.org.cy", "diko.org.cy", "democraticparty.org.cy",
        "dipa.org.cy", "depa.cy", "elamcy.com", "edek.org.cy",
        "ecologistes.org.cy", "alma.org.cy", "politis.com.cy",
        "philenews.com", "cyprus-mail.com", "offsite.com.cy", "sigmalive.com",
        "stockwatch.com.cy", "kathimerini.com.cy",
    )
    for b in bad:
        if host == b or host.endswith(b):
            return False
    return True


def _is_cv_doc(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(_DOC_EXTS)


def extract_links(nodes: list[Node] | Node | None, base_url: str | None = None) -> dict[str, str]:
    """Return dict of {facebook,twitter,instagram,linkedin,website,cv_url} → url.

    Takes either a single node, a list of nodes, or None. Scans both `<a href>`
    attributes and bare URL patterns in text content. First wins per field.
    """
    if nodes is None:
        return {}
    if isinstance(nodes, Node):
        nodes = [nodes]

    found: dict[str, str] = {}

    def _consider(url: str) -> None:
        url = url.rstrip(").,;:\"'")
        if not url or any(url.lower().startswith(p) for p in _IGNORE_HOSTS):
            return
        try:
            parsed = urlparse(url)
        except ValueError:
            return
        host = (parsed.hostname or "").lower()
        if not host:
            return
        kind = _classify_host(host)
        if kind and kind not in found:
            # Skip party/org social accounts — the first path segment is the handle.
            path = parsed.path.strip("/").split("/")[0].lower()
            if path and path.replace("-", "").replace(".", "") in {
                h.replace("-", "").replace(".", "") for h in _PARTY_SOCIAL_HANDLES
            }:
                return
            found[kind] = url
            return
        if kind is None:
            if _is_cv_doc(url) and "cv_url" not in found:
                found["cv_url"] = url
            elif "website" not in found and _looks_like_personal_website(url):
                found["website"] = url

    for node in nodes:
        for a in node.css("a"):
            href = a.attributes.get("href", "") or ""
            absolute = _absolutize(href, base_url)
            if absolute:
                _consider(absolute)
        text = node.text(separator=" ", strip=False) or ""
        for m in _URL_IN_TEXT_RE.finditer(text):
            _consider(m.group(0))
    return found


def extract_links_from_html(html: str, base_url: str | None = None) -> dict[str, str]:
    tree = HTMLParser(html)
    # Drop site-wide chrome before scanning so party/footer socials don't leak in.
    for sel in ("nav", "header", "footer", ".menu", ".nav", ".navbar",
                ".site-footer", ".site-header", ".social-links",
                "#header", "#footer", "#nav", ".cookie"):
        for n in tree.css(sel):
            n.decompose()
    body = tree.body or tree.root
    if body is None:
        return {}
    # Also block the merch/store domains used by Volt et al.
    found = extract_links([body], base_url=base_url)
    if "website" in found and "merch." in (urlparse(found["website"]).hostname or ""):
        del found["website"]
    return found
