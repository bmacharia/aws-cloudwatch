import { AppEnvironmentConfig } from '@/config';
import { AlerterConstruct } from '@/lib/stacks/cloudwatch/constructs/alerter-construct/alerter-construct';
import { IAspect } from 'aws-cdk-lib';
import { Alarm, AlarmProps } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct, IConstruct } from 'constructs';

// This aspect is responsible for adding an alarm action to every alarm
export class MonitoringAlarmAction implements IAspect {
  constructor(private envName: AppEnvironmentConfig['name']) {}

  public visit(node: IConstruct): void {
    if (node instanceof MonitoringAlarm) {
      const action = new SnsAction(
        Topic.fromTopicArn(
          node,
          'TopicAction',
          AlerterConstruct.getTopicArn({
            envName: this.envName,
            env: {
              account: node.stack.account,
              region: node.stack.region,
            },
          })
        )
      );
      node.addAlarmAction(action);
    }
  }
}

export class MonitoringAlarm extends Alarm {
  constructor(scope: Construct, id: string, props: AlarmProps) {
    super(scope, id, props);
  }
}
