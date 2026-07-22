"""Project CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.models.project import Project
import uuid

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    jira_url: str | None = None
    test_mgmt_type: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    jira_url: str | None = None
    test_mgmt_type: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    jira_url: str | None = None
    test_mgmt_type: str | None = None


def _to_response(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        jira_url=p.jira_url,
        test_mgmt_type=p.test_mgmt_type,
    )


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return [_to_response(p) for p in result.scalars().all()]


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _to_response(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: uuid.UUID, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(project, key, val)
    await db.commit()
    await db.refresh(project)
    return _to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
