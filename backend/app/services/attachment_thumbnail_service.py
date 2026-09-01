"""PDF/Office attachment thumbnails. Fail open — never block an upload."""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
THUMBNAIL_WIDTH = 300
OFFICE_CONVERT_TIMEOUT_SECONDS = 20


def generate_pdf_thumbnail(pdf_bytes: bytes) -> bytes | None:
    try:
        import fitz

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            page = doc.load_page(0)
            zoom = THUMBNAIL_WIDTH / page.rect.width if page.rect.width else 1
            pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            return pixmap.tobytes("png")
        finally:
            doc.close()
    except Exception as exc:
        logger.error("pdf thumbnail failed: %s", exc)
        return None


def _soffice_bin() -> str | None:
    return shutil.which("soffice") or shutil.which("libreoffice")


async def convert_office_to_pdf(file_bytes: bytes, suffix: str) -> bytes | None:
    binary = _soffice_bin()
    if binary is None:
        logger.error("soffice not on PATH; cannot convert %s", suffix)
        return None
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            source = tmpdir / f"input{suffix}"
            source.write_bytes(file_bytes)
            profile = tmpdir / "lo_profile"
            profile.mkdir()
            proc = await asyncio.create_subprocess_exec(
                binary,
                "--headless",
                "--nologo",
                "--nofirststartwizard",
                f"-env:UserInstallation={profile.resolve().as_uri()}",
                "--convert-to",
                "pdf",
                "--outdir",
                str(tmpdir),
                str(source),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=OFFICE_CONVERT_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                logger.error("soffice timed out converting %s", suffix)
                return None
            if proc.returncode not in (0, None):
                logger.error("soffice failed converting %s: %s", suffix, (stderr or b"").decode("utf-8", "replace")[:500])
            pdfs = sorted(p for p in tmpdir.glob("*.pdf") if p.is_file())
            if not pdfs:
                logger.error("soffice produced no pdf for %s", suffix)
                return None
            return pdfs[0].read_bytes()
    except Exception as exc:
        logger.error("office-to-pdf failed for %s: %s", suffix, exc)
        return None


async def generate_thumbnail(content_type: str, file_bytes: bytes) -> bytes | None:
    if content_type == "application/pdf":
        return generate_pdf_thumbnail(file_bytes)
    if content_type == DOCX_MIME:
        pdf = await convert_office_to_pdf(file_bytes, ".docx")
        return generate_pdf_thumbnail(pdf) if pdf else None
    if content_type == XLSX_MIME:
        pdf = await convert_office_to_pdf(file_bytes, ".xlsx")
        return generate_pdf_thumbnail(pdf) if pdf else None
    return None
