import { Pool } from "pg";
import { getConfig } from "./config";
import type { RemoteJob, RemoteCompany, JobsListResponse } from "./job-board-api";

/**
 * Direct Postgres reader for the job board (qajobs) database.
 * Used when JOB_BOARD_DATABASE_URL is set — eliminates the HTTP hop to the
 * deployed app (cold serverless starts / timeouts). Falls back to HTTP in
 * lib/job-board-api when the env var is absent.
 */

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = getConfig().jobBoardDatabaseUrl;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Prisma maps model names to quoted PascalCase table names.
const JOB_TABLE = '"Job"';
const COMPANY_TABLE = '"Company"';

type BoardJobRow = {
  id: string;
  title: string;
  company: string;
  email: string | null;
  location: string | null;
  experience: string | null;
  description: string | null;
  fileName: string | null;
  jobDate: Date | null;
  status: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  companyId: string | null;
};

function rowToRemoteJob(row: BoardJobRow): RemoteJob {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    email: row.email,
    location: row.location,
    experience: row.experience,
    description: row.description,
    fileName: row.fileName,
    jobDate: row.jobDate?.toISOString() ?? null,
    status: row.status ?? "new",
    createdAt: row.createdAt?.toISOString() ?? undefined,
    updatedAt: row.updatedAt?.toISOString() ?? undefined,
    companyId: row.companyId,
  };
}

/** Keyword search across the board tables (same OR shape as the HTTP API). */
function searchWhere(search: string) {
  if (!search.trim()) return { clause: "", params: [] as string[] };
  const q = `%${search.trim()}%`;
  return {
    clause: `AND ("title" ILIKE $1 OR "company" ILIKE $1 OR "location" ILIKE $1 OR "experience" ILIKE $1 OR "email" ILIKE $1)`,
    params: [q],
  };
}

export async function fetchRemoteJobsDb(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  company?: string;
  status?: string;
} = {}): Promise<JobsListResponse> {
  const client = getPool();
  if (!client) throw new Error("JOB_BOARD_DATABASE_URL not set");

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 40));
  const s = searchWhere(opts.search || "");
  const sortCol =
    opts.sort === "oldest"
      ? `"jobDate" ASC, "createdAt" ASC`
      : opts.sort === "company"
        ? `"company" ASC, "jobDate" DESC`
        : `"jobDate" DESC, "createdAt" DESC`;

  const where = `${s.clause}${opts.company ? ` AND "company" ILIKE $${s.params.length + 1}` : ""}${opts.status ? ` AND "status" = $${s.params.length + (opts.company ? 1 : 0) + 1}` : ""}`;
  const params = [...s.params];
  if (opts.company) params.push(`${opts.company}%`);
  if (opts.status) params.push(opts.status);

  const countRes = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM ${JOB_TABLE} WHERE true ${where}`,
    params
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const dataRes = await client.query<BoardJobRow>(
    `SELECT * FROM ${JOB_TABLE} WHERE true ${where} ORDER BY ${sortCol} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );

  const companyRes = await client.query<{ company: string }>(
    `SELECT DISTINCT "company" FROM ${JOB_TABLE} WHERE true ${where}`,
    params
  );
  const sourceRes = await client.query<{ fileName: string | null }>(
    `SELECT DISTINCT "fileName" FROM ${JOB_TABLE} WHERE true ${where} AND "fileName" IS NOT NULL`,
    params
  );

  return {
    jobs: dataRes.rows.map(rowToRemoteJob),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    companyCount: companyRes.rows.length,
    sourceCount: sourceRes.rows.length,
  };
}

export async function fetchRemoteJobDb(id: string): Promise<RemoteJob> {
  const client = getPool();
  if (!client) throw new Error("JOB_BOARD_DATABASE_URL not set");

  const res = await client.query<BoardJobRow>(
    `SELECT * FROM ${JOB_TABLE} WHERE "id" = $1 LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) throw new Error(`Job not found: ${id}`);
  return rowToRemoteJob(row);
}

export async function fetchRemoteCompaniesDb(): Promise<RemoteCompany[]> {
  const client = getPool();
  if (!client) throw new Error("JOB_BOARD_DATABASE_URL not set");

  const res = await client.query<{
    id: string;
    domain: string;
    name: string;
    type: string | null;
    description: string | null;
    location: string | null;
    website: string | null;
    source: string | null;
    jobCount: string;
    jobLocation: string | null;
  }>(
    `SELECT c."id", c."domain", c."name", c."type", c."description", c."location", c."website", c."source",
            COUNT(j."id")::text AS "jobCount",
            (SELECT j2."location" FROM ${JOB_TABLE} j2
             WHERE j2."company" ILIKE c."name"
             AND j2."location" IS NOT NULL AND j2."location" <> ''
             GROUP BY j2."location"
             ORDER BY COUNT(*) DESC, j2."location" ASC
             LIMIT 1) AS "jobLocation"
     FROM ${COMPANY_TABLE} c
     LEFT JOIN ${JOB_TABLE} j ON j."company" ILIKE c."name"
     GROUP BY c."id"
     ORDER BY COUNT(j."id") DESC, c."name" ASC`
  );

  return res.rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    name: r.name,
    type: r.type,
    description: r.description,
    location: r.location || r.jobLocation,
    website: r.website,
    source: r.source,
    _count: { jobs: Number(r.jobCount) },
  }));
}
