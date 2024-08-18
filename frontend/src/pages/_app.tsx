import AppFooter from '@/components/cloudwatch-components/app-footer';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import AppContext from '@/lib/app-context';
import { bootstrapRum } from '@/lib/rum';
import { getFeatureToggles } from '@/services/api';
import '@/styles/globals.css';
import { AwsRum } from 'aws-rum-web';
import type { AppProps } from 'next/app';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const [awsRum, setAwsRum] = useState<AwsRum | undefined>();

  const router = useRouter();

  useEffect(() => {
    queryClient.prefetchQuery('featureToggles', getFeatureToggles);
  }, []);

  useEffect(() => setAwsRum(bootstrapRum()), []);

  useEffect(() => {
    const { asPath, push, pathname } = router;

    if (asPath.split('?')[0] != pathname.split('?')[0] && !pathname.includes('[')) {
      // Work around for next export breaking SPA routing on first hit
      console.log('Browser route ' + asPath + ' did not match nextjs router route ' + pathname);
      push(asPath);
    }
  }, [router]);

  return (
    <AppContext.Provider value={{ awsRum }}>
      <QueryClientProvider client={queryClient}>
        <div className="bg-gray-800 fixed top-0 inset-x-0 z-10">
          <div className="mx-auto max-w-7xl px-2">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <a
                  className="hover:opacity-75 transition-opacity duration-300"
                  href="https://cloudwatchbook.com"
                  target="_blank"
                >
                  <Image src="/owl.png" alt="Logo" className="h-8 w-8 rounded-full mr-4" width={32} height={32} />
                </a>

                <NavigationMenu>
                  <NavigationMenuList className="flex space-x-4">
                    <NavigationMenuItem>
                      <NavigationMenuLink
                        href="/"
                        className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Repositories
                      </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem>
                      <NavigationMenuLink
                        href="/settings"
                        className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Settings
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-16 px-2 md:px-4">
          <div className="mx-auto w-full xl:w-1/2 md:w-2/3">
            <Component {...pageProps} />
            <AppFooter />
          </div>
        </div>
      </QueryClientProvider>
    </AppContext.Provider>
  );
}
