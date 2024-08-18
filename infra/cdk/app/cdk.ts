#!/usr/bin/env node
import { Stage } from '@/lib/stages/stage';
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { ApplyTags } from '@/lib/aspects/apply-tags/apply-tags';
import { devEnvironment } from '../config';

const app = new cdk.App();

const dev = new Stage(app, 'dev', devEnvironment);

cdk.Aspects.of(dev).add(new ApplyTags({ ...devEnvironment.defaultTags }));
