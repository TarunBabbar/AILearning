export type CompanyInfo = {
  id: string;
  domain: string;
  name: string;
  type: string | null;
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

export type JobsResponse = {
  jobs: Job[];
  total: number;
  counts: Record<string, number>;
  filters: { search: string; status: string; company: string; sort: string };
  dbError?: boolean;
};

export type CompaniesResponse = {
  companies: (CompanyInfo & { _count: { jobs: number } })[];
};
