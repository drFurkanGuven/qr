from pydantic import BaseModel, ConfigDict
from typing import Optional


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_code: str
    name: str
    academic_semester: str
    instructor_name: Optional[str] = None
