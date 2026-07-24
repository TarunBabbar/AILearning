export interface Status { resume_loaded: boolean; resume_filename: string; resume_words: number; job_count: number; }
export interface Job {
  id: string;
  title: string; company: string; email: string; location: string; experience: string;
  description: string; status: string; score?: number; strengths?: string; gaps?: string;
  scoring_method?: string; email_sent?: boolean; email_sent_at?: string;
  created_at?: string; status_updated_at?: string;
}
export interface CompanyEntry {
  company: string;
  personName: string;
  location: string;
  type: string;
  updatedAt: string;
}
