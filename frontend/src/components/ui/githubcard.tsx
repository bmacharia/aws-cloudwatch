import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CircleIcon,
  StarIcon,
  Cross1Icon,
  CommitIcon,
  ExclamationTriangleIcon,
  EyeOpenIcon,
} from '@radix-ui/react-icons';
import Image from 'next/image';

export type GithubCardProps = {
  title: string;
  description: string;
  language: string;
  stars: number;
  updated: string;
  index: number;
  watchers: number;
  forks: number;
  createdAt: string;
  openIssues: number;
  avatarUrl?: string;
  removeHandler: (fullName: string) => void;
};

export const GithubCard = ({
  title,
  description,
  language,
  stars,
  updated,
  index,
  watchers,
  forks,
  createdAt,
  openIssues,
  avatarUrl,
  removeHandler,
}: GithubCardProps) => {
  const date = new Date(updated);
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  const formatNumber = (num: number) => {
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString();
  };

  return (
    <Card className="min-w-0 relative">
      <CardHeader className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-center gap-4 relative">
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt={`${title} avatar`}
            className="h-10 w-10"
            data-testid={`avatar-image-${index}`}
            height={10}
            width={10}
          />
        )}
        <div className="space-y-1">
          <CardTitle>
            <Link
              href={`/repositories/${encodeURIComponent(title)}`}
              data-testid={`card-label-${index}`}
              className="text-blue-500 hover:text-blue-600"
            >
              {title}
            </Link>
          </CardTitle>
          <CardDescription className="text-gray-700 break-words">{description}</CardDescription>
        </div>
        <Button
          variant="secondary"
          className="absolute top-2 right-4 px-3 py-1 text-xs sm:text-sm bg-gray-200 hover:bg-gray-300"
          onClick={() => removeHandler(title)}
          data-testid={`remove-button-${index}`}
        >
          <Cross1Icon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 text-sm text-gray-600 overflow-auto">
          <div className="flex items-center">
            <CircleIcon className="mr-1 h-3 w-3 fill-sky-400 text-sky-400" />
            {language}
          </div>
          {stars > 0 && (
            <div className="flex items-center">
              <StarIcon className="mr-1 h-3 w-3 text-yellow-400" />
              {formatNumber(stars)}
            </div>
          )}
          {forks > 0 && (
            <div className="flex items-center">
              <CommitIcon className="mr-1 h-3 w-3 text-gray-400" />
              {formatNumber(forks)}
            </div>
          )}
          {openIssues > 0 && (
            <div className="flex items-center">
              <ExclamationTriangleIcon className="mr-1 h-3 w-3 text-red-400" />
              {formatNumber(openIssues)}
            </div>
          )}
          {watchers > 0 && (
            <div className="flex items-center">
              <EyeOpenIcon className="mr-1 h-3 w-3 text-green-400" />
              {formatNumber(watchers)}
            </div>
          )}
          <div className="whitespace-nowrap">
            Updated {month} {year}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
