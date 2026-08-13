export type CompanyInfo = {
  id: string;
  domain: string;
  name: string;
  type: string | null;
  description: string | null;
  location: string | null;
  website: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  email: string | null;
  location: string | null;
  experience: string | null;
  description: string | null;
  fileName: string | null;
  jobDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  companyId: string | null;
  companyInfo: CompanyInfo | null;
};

/** Slim job shape returned by /api/user/matches (score rows). */
export type JobLike = {
  id: string;
  title: string;
  company: string;
  email: string | null;
  location: string | null;
  experience: string | null;
  description: string | null;
  jobDate: string | null;
  createdAt?: string | null;
};

export type JobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: Record<string, number>;
  companyCount?: number;
  sourceCount?: number;
  todayCount?: number;
  filters: { search: string; status: string; company: string; sort: string };
  dbError?: boolean;
};

export type CompaniesResponse = {
  companies: (CompanyInfo & { _count: { jobs: number } })[];
};

export type FilterOption = {
  value: string;
  count: number;
};

export type JobFiltersOptions = {
  companies: FilterOption[];
  locations: FilterOption[];
};
