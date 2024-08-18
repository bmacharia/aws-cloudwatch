import { Tracer } from '@aws-lambda-powertools/tracer';
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../utils/logger';
import { RepositoryEntity } from './model/repository.entity';

export class DynamoDbAdapter {
  private readonly region = process.env.AWS_REGION;
  private readonly client: DynamoDBClient;
  tableName: string;

  constructor(tracer: Tracer, tableName: string) {
    this.client = tracer.captureAWSv3Client(new DynamoDBClient({ region: this.region }));
    this.tableName = tableName;
  }

  // ---------------------------------------------------------------------
  // REPOSITORIES --------------------------------------------------------

  addRepository = async (repository: RepositoryEntity): Promise<void> => {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(repository),
    });

    logger.info('Adding repository to DynamoDB', { repository });

    try {
      await this.client.send(command);
    } catch (error) {
      logger.error('Error adding repository to DynamoDB:', { error });
      throw error;
    }
  };

  removeRepository = async (fullName: string): Promise<void> => {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ full_name: fullName }),
    });

    logger.info('Removing repository from DynamoDB', { fullName });

    try {
      await this.client.send(command);
    } catch (error) {
      logger.error('Error removing repository from DynamoDB:', { error });
      throw error;
    }
  };

  getRepository = async (fullName: string): Promise<RepositoryEntity | undefined> => {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ full_name: fullName }),
    });

    logger.info('Retrieving repository from DynamoDB', { fullName });

    try {
      const response = await this.client.send(command);
      const item = response.Item;

      if (!item) {
        return undefined;
      }

      return unmarshall(item) as RepositoryEntity;
    } catch (error) {
      logger.error('Error retrieving repository from DynamoDB:', { error });
      throw error;
    }
  };

  getRepositories = async (): Promise<RepositoryEntity[]> => {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    logger.info('Retrieving repositories from DynamoDB', { command });

    try {
      const response = await this.client.send(command);
      const items = response.Items || [];

      return items.map((item) => unmarshall(item) as RepositoryEntity);
    } catch (error) {
      logger.error('Error retrieving repositories from DynamoDB:', { error });
      throw error;
    }
  };

  // ---------------------------------------------------------------------
  // CONNECTIONS ---------------------------------------------------------

  saveConnection = async (connection_id: string): Promise<void> => {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        connection_id,
        // expires automatically in 1 hour
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    try {
      await this.client.send(command);
    } catch (error) {
      logger.error('Error saving connection to DynamoDB:', { error });
      throw error;
    }
  };

  deleteConnection = async (connection_id: string): Promise<void> => {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ connection_id }),
    });

    try {
      await this.client.send(command);
    } catch (error) {
      logger.error('Error deleting connection from DynamoDB:', { error });
      throw error;
    }
  };
}
