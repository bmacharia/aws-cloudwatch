import { MonitoringAlarm } from '@/lib/aspects/monitoring-alarm';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { AttributeType, BillingMode, ITable, Operation, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class TablesStack extends Stack {
  repositoryTable: ITable;
  connectionTable: ITable;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Repositories table
    this.repositoryTable = new Table(this, 'RepositoriesTable', {
      partitionKey: { name: 'full_name', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      // This removes unused resources if you remove the CloudFormation Stack. NOT recommended for actual production projects.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Connections table with TTL
    this.connectionTable = new Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connection_id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at',
      // This removes unused resources if you remove the CloudFormation Stack. NOT recommended for actual production projects.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Alarms
    new MonitoringAlarm(this, 'RepositoriesTableAlarm', {
      metric: this.repositoryTable.metricThrottledRequestsForOperations({
        operations: [Operation.PUT_ITEM, Operation.BATCH_WRITE_ITEM, Operation.QUERY],
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    new MonitoringAlarm(this, 'ConnectionsTableAlarm', {
      metric: this.connectionTable.metricThrottledRequestsForOperations({
        operations: [Operation.PUT_ITEM, Operation.BATCH_WRITE_ITEM, Operation.QUERY],
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }
}
