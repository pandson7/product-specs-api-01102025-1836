import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ProductSpecsApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for product specifications
    const productTable = new dynamodb.Table(this, 'ProductSpecificationsTable', {
      tableName: `product-specs-${Date.now()}`,
      partitionKey: {
        name: 'productId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Lambda function for getting products
    const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
          };

          try {
            const { pathParameters } = event;
            
            if (pathParameters && pathParameters.productId) {
              // Get specific product
              const command = new GetCommand({
                TableName: process.env.TABLE_NAME,
                Key: { productId: pathParameters.productId }
              });
              
              const result = await docClient.send(command);
              
              if (!result.Item) {
                return {
                  statusCode: 404,
                  headers,
                  body: JSON.stringify({ error: 'Product not found' })
                };
              }
              
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.Item)
              };
            } else {
              // Get all products
              const command = new ScanCommand({
                TableName: process.env.TABLE_NAME
              });
              
              const result = await docClient.send(command);
              
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ products: result.Items || [] })
              };
            }
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Internal server error' })
            };
          }
        };
      `),
      environment: {
        TABLE_NAME: productTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    // Grant DynamoDB permissions to Lambda
    productTable.grantReadData(getProductsFunction);

    // Lambda function for populating sample data
    const populateDataFunction = new lambda.Function(this, 'PopulateDataFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        const sampleProducts = [
          {
            productId: 'prod-001',
            name: 'Wireless Bluetooth Headphones',
            category: 'Electronics',
            brand: 'TechSound',
            specifications: {
              color: 'Black',
              batteryLife: '20 hours',
              connectivity: ['Bluetooth 5.0', '3.5mm jack'],
              weight: '250g',
              features: ['Noise Cancellation', 'Quick Charge']
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            productId: 'prod-002',
            name: 'Smart Fitness Watch',
            category: 'Wearables',
            brand: 'FitTech',
            specifications: {
              displaySize: '1.4 inch',
              batteryLife: '7 days',
              waterResistance: 'IP68',
              sensors: ['Heart Rate', 'GPS', 'Accelerometer'],
              compatibility: ['iOS', 'Android']
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            productId: 'prod-003',
            name: 'Organic Coffee Beans',
            category: 'Food & Beverage',
            brand: 'BrewMaster',
            specifications: {
              origin: 'Colombia',
              roastLevel: 'Medium',
              weight: '1kg',
              organic: true,
              flavorNotes: ['Chocolate', 'Caramel', 'Citrus']
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];

        exports.handler = async (event) => {
          console.log('Populating sample data...');
          
          try {
            for (const product of sampleProducts) {
              const command = new PutCommand({
                TableName: process.env.TABLE_NAME,
                Item: product
              });
              
              await docClient.send(command);
              console.log(\`Added product: \${product.productId}\`);
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({ message: 'Sample data populated successfully' })
            };
          } catch (error) {
            console.error('Error populating data:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to populate data' })
            };
          }
        };
      `),
      environment: {
        TABLE_NAME: productTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    // Grant DynamoDB permissions to populate function
    productTable.grantWriteData(populateDataFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'ProductSpecsApi', {
      restApiName: `product-specs-api-${Date.now()}`,
      description: 'API for accessing product specifications',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    // API Gateway integration
    const getProductsIntegration = new apigateway.LambdaIntegration(getProductsFunction);

    // API routes
    const products = api.root.addResource('products');
    products.addMethod('GET', getProductsIntegration);

    const productById = products.addResource('{productId}');
    productById.addMethod('GET', getProductsIntegration);

    // Output API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL'
    });

    new cdk.CfnOutput(this, 'PopulateDataFunctionName', {
      value: populateDataFunction.functionName,
      description: 'Function name for populating sample data'
    });
  }
}
