import { Repository } from '@/lib/types';
import { debounce } from '@/lib/utils';
import { searchRepositories } from '@/services/api';
import { useCallback, useState } from 'react';
import { useQuery } from 'react-query';

interface Props {
  searchQuery: string;
  setSearchQuery: (searchQuery: string) => void;
  recordSearchEvent: (searchQuery: string) => void;
  addRepositoryToFavorites: (repository: Repository) => void;
  clearSearchQuery: () => void;
}

const SearchBar = ({
  recordSearchEvent,
  setSearchQuery,
  searchQuery,
  addRepositoryToFavorites,
  clearSearchQuery,
}: Props) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const remoteSearchRepositories = useCallback(
    debounce((query: string) => {
      if (!query || query === '') return;
      console.info(`Searching for ${query}`);
      setDropdownVisible(true);
      refetch();
    }, 500),
    []
  );

  const {
    data: searchResults,
    refetch,
    isFetching,
    remove,
  } = useQuery<Repository[]>(['searchRepositories', searchQuery], () => searchRepositories(searchQuery), {
    enabled: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    recordSearchEvent(query);
    remoteSearchRepositories(query);
  };

  const handleBlur = () => {
    setDropdownVisible(false);
    remove();
  };

  const handleRepositoryClick = (repository: Repository) => {
    addRepositoryToFavorites(repository);
    clearSearchQuery();
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder="Search repositories..."
        value={searchQuery}
        data-testid="search-input"
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-full p-2 border border-gray-300 rounded-md"
      />
      {isFetching && (
        <div className="absolute top-2 right-2">
          <svg
            className="animate-spin h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}
      {dropdownVisible && searchResults && (
        <ul className="absolute left-0 right-0 mt-2 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
          {searchResults.map((result) => (
            <li
              key={result.full_name}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
              onMouseDown={() => handleRepositoryClick(result)}
            >
              {result.avatar_url && (
                <img src={result.avatar_url} alt={`${result.full_name} avatar`} className="w-8 h-8 mr-2 rounded-full" />
              )}
              <span>{result.full_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
