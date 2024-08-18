import { AwsRum } from 'aws-rum-web';
import { createContext } from 'react';

type Context = {
  awsRum: AwsRum | undefined;
};

const AppContext = createContext<Context | null>(null);

export default AppContext;
