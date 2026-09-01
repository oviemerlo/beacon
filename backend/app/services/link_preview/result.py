from dataclasses import dataclass


@dataclass(frozen=True)
class LinkPreviewResult:
    normalized_url: str
    title: str | None
    description: str | None
    image_url: str | None
    site_name: str | None
    favicon_url: str | None
    status: str

    @staticmethod
    def failed(normalized_url: str) -> "LinkPreviewResult":
        return LinkPreviewResult(normalized_url, None, None, None, None, None, "failed")

    @staticmethod
    def ok(
        normalized_url: str,
        *,
        title: str | None = None,
        description: str | None = None,
        image_url: str | None = None,
        site_name: str | None = None,
        favicon_url: str | None = None,
    ) -> "LinkPreviewResult":
        if not any((title, description, image_url, site_name)):
            return LinkPreviewResult.failed(normalized_url)
        return LinkPreviewResult(normalized_url, title, description, image_url, site_name, favicon_url, "ok")
