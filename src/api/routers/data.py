from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..models import ProjectResponse, CompanyResponse, StatsResponse

router = APIRouter()


def get_neo4j_driver():
    """获取 Neo4j 驱动"""
    try:
        from neo4j import GraphDatabase
        return GraphDatabase.driver(
            "bolt://localhost:7687",
            auth=("neo4j", "password")
        )
    except Exception:
        return None


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    province: Optional[str] = None,
    city: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """项目列表"""
    driver = get_neo4j_driver()
    if not driver:
        return []

    with driver.session() as session:
        query = "MATCH (p:Project) WHERE true"
        params = {}
        if province:
            query += " AND p.province = $province"
            params["province"] = province
        if city:
            query += " AND p.city = $city"
            params["city"] = city
        query += " RETURN p ORDER BY p.date DESC SKIP $skip LIMIT $limit"
        params["skip"] = (page - 1) * page_size
        params["limit"] = page_size

        results = session.run(query, params)
        projects = []
        for record in results:
            p = record["p"]
            projects.append(ProjectResponse(
                id=p.get("id", ""),
                name=p.get("name", ""),
                amount=p.get("amount"),
                winner=p.get("winner", ""),
                date=p.get("date", ""),
                province=p.get("province", ""),
                city=p.get("city", ""),
                district=p.get("district"),
                buyer_name=p.get("buyer_name"),
            ))
        return projects


@router.get("/companies", response_model=list[CompanyResponse])
async def list_companies(
    enriched: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
):
    """企业列表"""
    driver = get_neo4j_driver()
    if not driver:
        return []

    with driver.session() as session:
        query = "MATCH (c:Company) WHERE true"
        params = {}
        if enriched is not None:
            query += " AND c.enriched = $enriched"
            params["enriched"] = enriched
        query += " RETURN c ORDER BY c.name SKIP $skip LIMIT $limit"
        params["skip"] = (page - 1) * page_size
        params["limit"] = page_size

        results = session.run(query, params)
        companies = []
        for record in results:
            c = record["c"]
            companies.append(CompanyResponse(
                id=c.get("id", ""),
                name=c.get("name", ""),
                phone=c.get("phone"),
                mobile=c.get("mobile"),
                email=c.get("email"),
                address=c.get("address"),
                enriched=c.get("enriched", False),
            ))
        return companies


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """统计概览"""
    driver = get_neo4j_driver()
    if not driver:
        return StatsResponse(total_projects=0, total_companies=0, enriched_companies=0, provinces=0)

    with driver.session() as session:
        projects = session.run("MATCH (p:Project) RETURN count(p) as c").single()
        companies = session.run("MATCH (c:Company) RETURN count(c) as c").single()
        enriched = session.run("MATCH (c:Company) WHERE c.enriched = true RETURN count(c) as c").single()
        provinces = session.run("MATCH (p:Province) RETURN count(p) as c").single()

        return StatsResponse(
            total_projects=projects["c"] if projects else 0,
            total_companies=companies["c"] if companies else 0,
            enriched_companies=enriched["c"] if enriched else 0,
            provinces=provinces["c"] if provinces else 0,
        )
