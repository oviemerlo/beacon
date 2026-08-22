from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import SchoolCourseIn, SchoolSearchOut, SchoolVerifyConfirmIn, SchoolVerifyStartIn, SchoolVerifyStatusOut
from app.services import school_service
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("/search", response_model=list[SchoolSearchOut])
async def search_schools(q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    schools = await school_service.search_schools(db, q)
    return [{"id": school.id, "name": school.name, "country": school.country} for school in schools]


@router.post("/verify/start")
async def start_school_verification(
    payload: SchoolVerifyStartIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await school_service.start_verification(db, current_user.id, payload.school_id, payload.school_email)
    return {"status": "code_sent"}


@router.post("/verify/confirm")
async def confirm_school_verification(
    payload: SchoolVerifyConfirmIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await school_service.confirm_verification(db, current_user.id, payload.code)
    school_id, school_name, verified = await school_service.get_verification_status(db, current_user.id)
    if not verified or school_id is None or school_name is None:
        raise NotFoundError("School verification not found")
    return {"status": "verified", "school_name": school_name}


@router.get("/verify/status", response_model=SchoolVerifyStatusOut)
async def school_verification_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    school_id, school_name, verified = await school_service.get_verification_status(db, current_user.id)
    return {"school_id": school_id, "school_name": school_name, "verified": verified}


@router.post("/courses")
async def enroll_in_course(
    payload: SchoolCourseIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await school_service.enroll_in_course(db, current_user.id, payload.course_code)
    return {"status": "ok"}


@router.delete("/courses/{course_code}")
async def unenroll_from_course(
    course_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await school_service.unenroll_from_course(db, current_user.id, course_code)
    return {"status": "ok"}


@router.get("/courses")
async def list_my_courses(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    course_codes = await school_service.get_my_courses(db, current_user.id)
    return {"course_codes": course_codes}
