"""HTTP fetch with a basic SSRF guard and Open Graph parsing."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import socket
from urllib.parse import urljoin, urlsplit

import httpx
from selectolax.parser import HTMLParser

from app.services.link_preview.result import LinkPreviewResult
from app.utils.config import settings

logger = logging.getLogger(__name__)

BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
MAX_REDIRECTS = 3


def _is_blocked_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def assert_public_host(host: str) -> None:
    infos = await asyncio.get_running_loop().getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not infos:
        raise ValueError("unresolvable host")
    for info in infos:
        address = info[4][0]
        if _is_blocked_ip(address):
            raise ValueError("blocked address")


def _timeout() -> httpx.Timeout:
    seconds = settings.LINK_PREVIEW_FETCH_TIMEOUT_SECONDS
    return httpx.Timeout(seconds)


async def request_bytes(url: str, *, user_agent: str, accept: str = "*/*") -> tuple[str, bytes, str] | None:
    current = url
    headers = {"User-Agent": user_agent, "Accept": accept}
    async with httpx.AsyncClient(timeout=_timeout(), follow_redirects=False, trust_env=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            host = urlsplit(current).hostname
            if not host:
                return None
            await assert_public_host(host)
            async with client.stream("GET", current, headers=headers) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return None
                    nxt = urljoin(current, location)
                    if urlsplit(nxt).scheme not in ("http", "https"):
                        return None
                    current = nxt
                    continue
                response.raise_for_status()
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > settings.LINK_PREVIEW_MAX_BYTES:
                    return None
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > settings.LINK_PREVIEW_MAX_BYTES:
                        return None
                    chunks.append(chunk)
                return str(response.url), b"".join(chunks), response.headers.get("content-type", "")
    return None


async def request_json(url: str, *, user_agent: str) -> dict | None:
    fetched = await request_bytes(url, user_agent=user_agent, accept="application/json")
    if fetched is None:
        return None
    _, body, _ = fetched
    return json.loads(body)


def _meta(tree: HTMLParser, *keys: str) -> str | None:
    for key in keys:
        node = tree.css_first(f'meta[property="{key}"]') or tree.css_first(f'meta[name="{key}"]')
        if node is None:
            continue
        value = (node.attributes.get("content") or "").strip()
        if value:
            return value
    return None


def _favicon(tree: HTMLParser, page_url: str) -> str | None:
    for selector in ('link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'):
        node = tree.css_first(selector)
        href = (node.attributes.get("href") or "").strip() if node is not None else ""
        if href:
            return urljoin(page_url, href)
    return urljoin(page_url, "/favicon.ico")


def parse_open_graph(html: str, page_url: str, normalized_url: str) -> LinkPreviewResult:
    tree = HTMLParser(html)
    title = _meta(tree, "og:title", "twitter:title")
    if not title:
        title_node = tree.css_first("title")
        title = title_node.text(strip=True) if title_node is not None else None
    description = _meta(tree, "og:description", "twitter:description", "description")
    image = _meta(tree, "og:image", "twitter:image")
    site_name = _meta(tree, "og:site_name")
    if image:
        image = urljoin(page_url, image)
    return LinkPreviewResult.ok(
        normalized_url,
        title=title,
        description=description,
        image_url=image,
        site_name=site_name,
        favicon_url=_favicon(tree, page_url),
    )


async def fetch(url: str, *, user_agent: str = BROWSER_USER_AGENT, normalized_url: str | None = None) -> LinkPreviewResult:
    key = normalized_url or url
    try:
        fetched = await request_bytes(url, user_agent=user_agent, accept="text/html,application/xhtml+xml")
        if fetched is None:
            return LinkPreviewResult.failed(key)
        page_url, body, content_type = fetched
        if "html" not in content_type.lower() and "xml" not in content_type.lower():
            return LinkPreviewResult.failed(key)
        return parse_open_graph(body.decode("utf-8", errors="replace"), page_url, key)
    except Exception as exc:
        logger.error("generic link preview failed for %s: %s", key, exc)
        return LinkPreviewResult.failed(key)
