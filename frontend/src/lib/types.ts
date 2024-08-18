export type Inputs = { url: string };

export type Repository = {
  full_name: string;
  stars: number;
  language: string;
  description: string;
  forks: number;
  last_updated: string;
  subscribers_count: number;
  created_at: string;
  open_issues_count: number;
  avatar_url?: string;
};

export type FeatureToggle = {
  name: string;
  value: string | number | boolean;
  variations: string[];
};

export type ToggleFeature = {
  name: string;
  value: string | number | boolean;
};

export type Experiment = {
  name: string;
  description: string;
  status: string;
};

export type Launch = {
  name: string;
  description: string;
  status: string;
};
