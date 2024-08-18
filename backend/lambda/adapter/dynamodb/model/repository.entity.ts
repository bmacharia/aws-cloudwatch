export interface RepositoryEntity {
  full_name: string;
  description: string;
  forks: number;
  stars: number;
  subscribers_count: number;
  language: string;
  last_updated: string;
  created_at: string;
  open_issues_count: number;
  avatar_url?: string;
}
