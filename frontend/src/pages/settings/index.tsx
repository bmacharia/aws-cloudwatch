import { Card, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { Experiment, FeatureToggle, Launch } from '@/lib/types';
import { getEntityId } from '@/lib/utils';
import { getExperiments, getFeatureToggles, getLaunches, toggleFeature } from '@/services/api';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [entityId, setEntityId] = useState('');

  useEffect(() => {
    async function fetchEntityId() {
      const id = await getEntityId();
      setEntityId(id);
    }
    fetchEntityId();
  }, []);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(entityId);
    toast({
      title: 'Copied to clipboard',
      description: 'Entity ID has been copied to your clipboard.',
      variant: 'default',
    });
  };

  const { data: featureToggles } = useQuery<FeatureToggle[]>('featureToggles', getFeatureToggles);
  const toggleFeatureMutation = useMutation(toggleFeature, {
    onMutate: async ({ name, value }) => {
      await queryClient.cancelQueries('featureToggles');

      const previousFeatureToggles = queryClient.getQueryData<FeatureToggle[]>('featureToggles');

      if (previousFeatureToggles) {
        queryClient.setQueryData<FeatureToggle[]>(
          'featureToggles',
          previousFeatureToggles.map((featureToggle) => {
            if (featureToggle.name === name) {
              return { ...featureToggle, value };
            }
            return featureToggle;
          })
        );
      }

      return { previousFeatureToggles };
    },
    onSuccess: () => {
      toast({
        title: 'Success ✅',
        description: `Feature Flag was changed`,
        variant: 'default',
      });
    },
    onError: (err, variables, context) => {
      console.log('Error happened', err, variables, context);
      toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      });

      if (context?.previousFeatureToggles) {
        queryClient.invalidateQueries('featureToggles');
        queryClient.refetchQueries('featureToggles');
        queryClient.setQueryData('featureToggles', context.previousFeatureToggles);
      }
    },
  });
  const { data: experiments } = useQuery<Experiment[]>('experiments', getExperiments);
  const { data: launches } = useQuery<Launch[]>('launches', getLaunches);

  const handleVariationClick = (name: string, variation: string) => {
    console.log('Variation changed', name, variation);
    toggleFeatureMutation.mutate({ name, value: variation });
  };

  return (
    <>
      <div className="flex flex-col items-center px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold mt-4 mb-2">Feature Flags</h1>
        <p className="text-gray-600">You can change your feature flags here.</p>
        <p className="text-red-600 text-sm opacity-75">
          🚧 Changing certain feature flags (i.e. generate_traffic flag) can generate traffic and incur costs.
        </p>

        {featureToggles?.map(({ name: toggle, value, variations }, index) => (
          <div key={toggle} className="w-full sm:w-3/4 lg:w-1/2 mx-auto mt-4">
            <Card className="flex justify-between items-center p-4 bg-white shadow rounded-lg mb-4">
              <div className="flex flex-grow flex-col">
                <CardTitle className="text-lg font-semibold text-gray-900">{toggle}</CardTitle>
              </div>
              <div className="flex items-center space-x-2 w-28">
                <div className="flex"></div>
                <RadioGroup key={toggle} onValueChange={(newVariation) => handleVariationClick(toggle, newVariation)}>
                  {variations.map((variation, i) => (
                    <div className="flex items-center space-x-2" key={i}>
                      <RadioGroupItem value={variation} id={variation} checked={value.toString() === variation} />
                      <Label htmlFor="option-one">{variation}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </Card>
            {index !== featureToggles.length - 1 && <div className="mb-4" />}
          </div>
        ))}

        <Toaster />
      </div>
      {experiments && experiments.length > 0 && (
        <div className="flex flex-col items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold mt-4 mb-2">Experiments 🧪</h1>
          {experiments.map(({ name, description, status }, index) => (
            <Card key={index} className="w-full sm:w-3/4 lg:w-1/2 mx-auto mt-4 bg-white shadow rounded-lg mb-4">
              <div className="p-4">
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {name} <span className="text-sm text-gray-500">({status})</span>
                </CardTitle>
                {description && <p className="text-gray-600">{description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {launches && launches.length > 0 && (
        <div className="flex flex-col items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold mt-4 mb-2">Launches 🚀</h1>
          {launches.map(({ name, description, status }, index) => (
            <Card key={index} className="w-full sm:w-3/4 lg:w-1/2 mx-auto mt-4 bg-white shadow rounded-lg mb-4">
              <div className="p-4">
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {name} <span className="text-sm text-gray-500">({status})</span>
                </CardTitle>
                {description && <p className="text-gray-600">{description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="flex flex-col items-center mt-4 px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold">Entity ID</h2>
        <p className="text-gray-600">Unique identifier for CloudWatch Evidently.</p>
        <p className="text-gray-400 mb-2">Click on it for copying it to your clipboard.</p>
        <div
          className="cursor-pointer p-2 bg-gray-100 rounded-lg shadow-md hover:bg-gray-200 transition"
          onClick={handleCopyToClipboard}
        >
          <p className="text-gray-800 break-all">{entityId}</p>
        </div>
      </div>
    </>
  );
}