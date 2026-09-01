from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import upload_service

router = APIRouter(prefix="/uploads", tags=["uploads"])


async def _read_upload(file: UploadFile, fallback_name: str) -> tuple[bytes, str]:
    return await file.read(), file.filename or fallback_name


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_bytes, filename = await _read_upload(file, "avatar")
    row = await upload_service.upload_avatar(db, current_user, file_bytes, filename)
    return {"file_id": str(row.id), "status": "processing"}


@router.post("/broadcasts/{broadcast_id}/attachments")
async def upload_broadcast_attachment(
    broadcast_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_bytes, filename = await _read_upload(file, "attachment")
    row = await upload_service.upload_broadcast_attachment(
        db, current_user, broadcast_id, file_bytes, filename
    )
    return {"file_id": str(row.id), "status": "processing"}


@router.get("/{file_id}/url")
async def get_upload_url(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await upload_service.get_presigned_url(db, current_user, file_id)
