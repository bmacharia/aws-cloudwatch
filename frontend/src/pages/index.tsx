import RepositoryList from '@/components/cloudwatch-components/repository-list';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { Constants } from '@/lib/constants';
import { useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const WS_URL = Constants.WebsocketUrl;

type MessageEvent = {
  repoName: string;
};

export default function Home() {
  const { toast } = useToast();
  const { lastJsonMessage, readyState } = useWebSocket<MessageEvent>(WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  useEffect(() => {
    console.log('Connection state changed');
    if (readyState === ReadyState.OPEN) {
      console.log('Connection is open');
    }
  }, [readyState]);

  useEffect(() => {
    console.log(`Got a new message: ${lastJsonMessage}`);
    if (lastJsonMessage) {
      toast({
        title: 'Repository was updated',
        description: `The following repository was updated: ${lastJsonMessage.repoName}`,
      });
    }
  }, [lastJsonMessage, toast]);

  return (
    <>
      <RepositoryList />
      <Toaster />
    </>
  );
}
