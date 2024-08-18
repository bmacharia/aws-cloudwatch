import { Button } from '@/components/ui/button';
import { GithubCard } from '@/components/ui/githubcard';
import { Input } from '@/components/ui/input';
import AppContext from '@/lib/app-context';
import { Constants } from '@/lib/constants';
import { FeatureToggle, Inputs, Repository } from '@/lib/types';
import { debounce } from '@/lib/utils';
import {
  addRepository,
  getFeatureToggles,
  getRepositories,
  removeRepository,
  submitEvidentlyMetric,
} from '@/services/api';
import { useCallback, useContext, useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import SearchBar from '../ui/searchbar';
import { useToast } from '../ui/use-toast';

export default function RepositoryList() {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<Inputs>();
  const [searchQuery, setSearchQuery] = useState('');
  const [repositoriesAdded, setRepositoriesAdded] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { awsRum } = useContext(AppContext) ?? {};

  const { data: featureToggles } = useQuery<FeatureToggle[]>('featureToggles', getFeatureToggles);
  const { data, refetch } = useQuery<Repository[]>('repositories', getRepositories);
  const mutation = useMutation(addRepository, {
    onSuccess: () => {
      toast({
        title: 'Success ✅',
        description: `Repository added!`,
        variant: 'default',
      });
      queryClient.invalidateQueries('repositories');
      refetch();
      setRepositoriesAdded((prev) => prev + 1);
      reset();
    },
    onError: () => {
      toast({
        title: 'Error ❌',
        description: 'Could not add repository!',
        variant: 'default',
      });
    },
  });

  const mutationRemove = useMutation(removeRepository, {
    onSuccess: () => {
      toast({
        title: 'Success ✅',
        description: `Repository removed!`,
        variant: 'default',
      });
      queryClient.invalidateQueries('repositories');
      refetch();
    },
    onError: () => {
      toast({
        title: 'Error ❌',
        description: 'Could not remove repository!',
        variant: 'default',
      });
    },
  });

  const showSearchBarIsActive = featureToggles?.find((featureToggle) => featureToggle.name === 'show_searchbar')?.value;

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    mutation.mutate(data.url);
    awsRum?.recordEvent('AddRepository', {
      full_name: data.url,
    });
  };

  const removeHandler = (fullName: string) => {
    mutationRemove.mutate(fullName);
    awsRum?.recordEvent('RemoveRepository', {
      full_name: fullName,
    });
  };

  const recordSearchEvent = useCallback(
    debounce((query: string) => {
      if (!query || query === '') return;
      awsRum?.recordEvent('UseSearchBar', { full_name: query });
      console.info(`Search query: ${query}`);
    }, 500),
    [awsRum]
  );

  useEffect(() => recordSearchEvent.cancel, [recordSearchEvent]);

  const addRepositoryToFavorites = (repository: Repository) => {
    mutation.mutate(repository.full_name);
    awsRum?.recordEvent('AddRepository', {
      full_name: repository.full_name,
    });
  };

  const clearSearchQuery = () => {
    setSearchQuery('');
  };

  const filteredData = data?.filter(
    (repo) =>
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleBeforeUnload = async () => {
    try {
      await submitEvidentlyMetric({ favoritesAddedInSession: repositoriesAdded });
      setRepositoriesAdded(0);
    } catch (error) {
      console.error('Failed to submit evidently metric', error);
    }
  };

  const handleVisibilityChange = async () => {
    if (document.hidden) {
      try {
        await submitEvidentlyMetric({ favoritesAddedInSession: repositoriesAdded });
        setRepositoriesAdded(0);
      } catch (error) {
        console.error('Failed to submit evidently metric', error);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [repositoriesAdded]);

  return (
    <>
      <div className="pt-4">
        <div className="items-center w-full justify-center flex flex-col space-y-4">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full items-center justify-center flex flex-col space-y-4"
          >
            <div className="w-full">
              <Input
                placeholder="Repository URL: [https://github.com/]?<Owner>/<Repository>"
                {...register('url', { required: true, pattern: Constants.GitHubRegex })}
                data-testid={`url-input`}
              />
              {errors.url && (
                <span className="text-red-500">
                  Please enter the URL in the format: https://github.com/[USER]/[REPOSITORY]
                </span>
              )}
            </div>
            <div className="w-full justify-center flex">
              <Button type="submit" disabled={!!errors.url || !isDirty || isSubmitting} data-testid={`add-button`}>
                Add Repository
              </Button>
            </div>
          </form>
          {showSearchBarIsActive && (
            <SearchBar
              recordSearchEvent={recordSearchEvent}
              setSearchQuery={setSearchQuery}
              searchQuery={searchQuery}
              addRepositoryToFavorites={addRepositoryToFavorites}
              clearSearchQuery={clearSearchQuery}
            />
          )}
          {filteredData &&
            filteredData.map((card, i) => (
              <div className="w-full" key={card.full_name}>
                <GithubCard
                  description={card.description}
                  language={card.language}
                  removeHandler={removeHandler}
                  stars={card.stars}
                  title={card.full_name}
                  updated={card.last_updated}
                  watchers={card.subscribers_count}
                  forks={card.forks}
                  createdAt={card.created_at}
                  openIssues={card.open_issues_count}
                  avatarUrl={card.avatar_url}
                  index={i}
                />
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
