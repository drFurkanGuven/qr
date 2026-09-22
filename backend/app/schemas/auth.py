from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class CasTokenExchangeRequest(BaseModel):
    ticket: str
    service: str = "https://qr.firat.edu.tr"
    device_uuid: Optional[str] = None


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    university_student_id: Optional[str] = None
    cas_subject: str
    email: str
    full_name: str
    role: str


class EnrolledCourseBrief(BaseModel):
    course_id: str
    course_code: str
    name: str


class UserMeResponse(BaseModel):
    success: bool = True
    user: UserBrief
    enrolled_courses: List[EnrolledCourseBrief] = []


class TokenResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 86400
    user: UserBrief
