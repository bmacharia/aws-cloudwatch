import { Constants } from '@/lib/constants';
import { ToggleFeature } from '@/lib/types';

// ----------------------------------------------
// TRACING --------------------------------------

export const submitEvidentlyMetric = async (data: { favoritesAddedInSession: number }) => {
  const result = await fetch(`${Constants.ApiGatewayUrl}/metrics/favorites-added`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!result.ok) {
    throw new Error('Failed to submit evidently metric');
  }
};

// ----------------------------------------------
// FEATURE TOGGLES ------------------------------

export const getFeatureToggles = async () => {
  const res = await fetch(`${Constants.ApiGatewayUrl}/feature-toggles`);
  return res.json();
};

export const toggleFeature = async (params: ToggleFeature) => {
  const result = await fetch(`${Constants.ApiGatewayUrl}/feature-toggles`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!result.ok) {
    throw new Error('Failed to toggle feature');
  }
};

export const getExperiments = async () => {
  const res = await fetch(`${Constants.ApiGatewayUrl}/experiments`);
  return res.json();
};

export const getLaunches = async () => {
  const res = await fetch(`${Constants.ApiGatewayUrl}/launches`);
  return res.json();
};

// ----------------------------------------------
// REPOSITORIES ---------------------------------

export const getRepositories = async () => {
  const res = await fetch(`${Constants.ApiGatewayUrl}/repositories`);
  return res.json();
};

export const getRepository = async (fullName: string) => {
  const urlEncoded = encodeURIComponent(fullName);
  const res = await fetch(`${Constants.ApiGatewayUrl}/repositories/${urlEncoded}`);
  return res.json();
};

export const addRepository = async (url: string) => {
  // Get owner and repository from URL
  const splitUrl = url.split('/');
  let owner, repository;

  if (splitUrl.length === 1) {
    // Case: repository provided without domain
    [owner, repository] = url.split('/');
  } else {
    // Case: repository provided with domain
    [owner, repository] = splitUrl.slice(-2);
  }

  const full_name = `${owner}/${repository}`;

  const result = await fetch(`${Constants.ApiGatewayUrl}/repositories`, {
    method: 'POST',
    body: JSON.stringify({ full_name }),
  });

  if (!result.ok) {
    throw new Error('Failed to add repository');
  }
};

export const removeRepository = async (fullName: string) => {
  const urlEncoded = encodeURIComponent(fullName);
  const result = await fetch(`${Constants.ApiGatewayUrl}/repositories/${urlEncoded}`, {
    method: 'DELETE',
  });

  if (!result.ok) {
    throw new Error('Failed to add repository');
  }
};

export const searchRepositories = async (query: string) => {
  const urlEncoded = encodeURIComponent(query);
  const res = await fetch(`${Constants.ApiGatewayUrl}/search?q=${urlEncoded}`);
  return res.json();
};
