"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSpecsApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
class ProductSpecsApiStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.ProductSpecsApiStack = ProductSpecsApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFJekQsTUFBYSxvQkFBcUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNqRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDRDQUE0QztRQUM1QyxNQUFNLFlBQVksR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQzFFLFNBQVMsRUFBRSxpQkFBaUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ3hDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILHVDQUF1QztRQUN2QyxNQUFNLG1CQUFtQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BaUU1QixDQUFDO1lBQ0YsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxZQUFZLENBQUMsU0FBUzthQUNuQztZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7U0FDaEIsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBQ3ZDLFlBQVksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUVoRCw2Q0FBNkM7UUFDN0MsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzdFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpRjVCLENBQUM7WUFDRixXQUFXLEVBQUU7Z0JBQ1gsVUFBVSxFQUFFLFlBQVksQ0FBQyxTQUFTO2FBQ25DO1lBQ0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztTQUNoQixDQUFDLENBQUM7UUFFSCxrREFBa0Q7UUFDbEQsWUFBWSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRWxELGNBQWM7UUFDZCxNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzFELFdBQVcsRUFBRSxxQkFBcUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzlDLFdBQVcsRUFBRSwwQ0FBMEM7WUFDdkQsMkJBQTJCLEVBQUU7Z0JBQzNCLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUM7YUFDaEQ7U0FDRixDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRXJGLGFBQWE7UUFDYixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRCxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBRWxELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDeEQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUVyRCxzQkFBc0I7UUFDdEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxvQkFBb0IsQ0FBQyxZQUFZO1lBQ3hDLFdBQVcsRUFBRSwwQ0FBMEM7U0FDeEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaE9ELG9EQWdPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIFByb2R1Y3RTcGVjc0FwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgdGFibGUgZm9yIHByb2R1Y3Qgc3BlY2lmaWNhdGlvbnNcbiAgICBjb25zdCBwcm9kdWN0VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Byb2R1Y3RTcGVjaWZpY2F0aW9uc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgcHJvZHVjdC1zcGVjcy0ke0RhdGUubm93KCl9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAncHJvZHVjdElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBnZXR0aW5nIHByb2R1Y3RzXG4gICAgY29uc3QgZ2V0UHJvZHVjdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFByb2R1Y3RzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCB7IER5bmFtb0RCQ2xpZW50IH0gPSByZXF1aXJlKCdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInKTtcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBTY2FuQ29tbWFuZCwgR2V0Q29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyk7XG5cbiAgICAgICAgY29uc3QgY2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbiAgICAgICAgY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGNsaWVudCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0V2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ0dFVCwgT1BUSU9OUydcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcGF0aFBhcmFtZXRlcnMgfSA9IGV2ZW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAocGF0aFBhcmFtZXRlcnMgJiYgcGF0aFBhcmFtZXRlcnMucHJvZHVjdElkKSB7XG4gICAgICAgICAgICAgIC8vIEdldCBzcGVjaWZpYyBwcm9kdWN0XG4gICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgR2V0Q29tbWFuZCh7XG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UQUJMRV9OQU1FLFxuICAgICAgICAgICAgICAgIEtleTogeyBwcm9kdWN0SWQ6IHBhdGhQYXJhbWV0ZXJzLnByb2R1Y3RJZCB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBpZiAoIXJlc3VsdC5JdGVtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUHJvZHVjdCBub3QgZm91bmQnIH0pXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXN1bHQuSXRlbSlcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEdldCBhbGwgcHJvZHVjdHNcbiAgICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UQUJMRV9OQU1FXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcHJvZHVjdHM6IHJlc3VsdC5JdGVtcyB8fCBbXSB9KVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogcHJvZHVjdFRhYmxlLnRhYmxlTmFtZVxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NlxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnMgdG8gTGFtYmRhXG4gICAgcHJvZHVjdFRhYmxlLmdyYW50UmVhZERhdGEoZ2V0UHJvZHVjdHNGdW5jdGlvbik7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHBvcHVsYXRpbmcgc2FtcGxlIGRhdGFcbiAgICBjb25zdCBwb3B1bGF0ZURhdGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1BvcHVsYXRlRGF0YUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUHV0Q29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyk7XG5cbiAgICAgICAgY29uc3QgY2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbiAgICAgICAgY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGNsaWVudCk7XG5cbiAgICAgICAgY29uc3Qgc2FtcGxlUHJvZHVjdHMgPSBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcHJvZHVjdElkOiAncHJvZC0wMDEnLFxuICAgICAgICAgICAgbmFtZTogJ1dpcmVsZXNzIEJsdWV0b290aCBIZWFkcGhvbmVzJyxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnRWxlY3Ryb25pY3MnLFxuICAgICAgICAgICAgYnJhbmQ6ICdUZWNoU291bmQnLFxuICAgICAgICAgICAgc3BlY2lmaWNhdGlvbnM6IHtcbiAgICAgICAgICAgICAgY29sb3I6ICdCbGFjaycsXG4gICAgICAgICAgICAgIGJhdHRlcnlMaWZlOiAnMjAgaG91cnMnLFxuICAgICAgICAgICAgICBjb25uZWN0aXZpdHk6IFsnQmx1ZXRvb3RoIDUuMCcsICczLjVtbSBqYWNrJ10sXG4gICAgICAgICAgICAgIHdlaWdodDogJzI1MGcnLFxuICAgICAgICAgICAgICBmZWF0dXJlczogWydOb2lzZSBDYW5jZWxsYXRpb24nLCAnUXVpY2sgQ2hhcmdlJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwcm9kdWN0SWQ6ICdwcm9kLTAwMicsXG4gICAgICAgICAgICBuYW1lOiAnU21hcnQgRml0bmVzcyBXYXRjaCcsXG4gICAgICAgICAgICBjYXRlZ29yeTogJ1dlYXJhYmxlcycsXG4gICAgICAgICAgICBicmFuZDogJ0ZpdFRlY2gnLFxuICAgICAgICAgICAgc3BlY2lmaWNhdGlvbnM6IHtcbiAgICAgICAgICAgICAgZGlzcGxheVNpemU6ICcxLjQgaW5jaCcsXG4gICAgICAgICAgICAgIGJhdHRlcnlMaWZlOiAnNyBkYXlzJyxcbiAgICAgICAgICAgICAgd2F0ZXJSZXNpc3RhbmNlOiAnSVA2OCcsXG4gICAgICAgICAgICAgIHNlbnNvcnM6IFsnSGVhcnQgUmF0ZScsICdHUFMnLCAnQWNjZWxlcm9tZXRlciddLFxuICAgICAgICAgICAgICBjb21wYXRpYmlsaXR5OiBbJ2lPUycsICdBbmRyb2lkJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwcm9kdWN0SWQ6ICdwcm9kLTAwMycsXG4gICAgICAgICAgICBuYW1lOiAnT3JnYW5pYyBDb2ZmZWUgQmVhbnMnLFxuICAgICAgICAgICAgY2F0ZWdvcnk6ICdGb29kICYgQmV2ZXJhZ2UnLFxuICAgICAgICAgICAgYnJhbmQ6ICdCcmV3TWFzdGVyJyxcbiAgICAgICAgICAgIHNwZWNpZmljYXRpb25zOiB7XG4gICAgICAgICAgICAgIG9yaWdpbjogJ0NvbG9tYmlhJyxcbiAgICAgICAgICAgICAgcm9hc3RMZXZlbDogJ01lZGl1bScsXG4gICAgICAgICAgICAgIHdlaWdodDogJzFrZycsXG4gICAgICAgICAgICAgIG9yZ2FuaWM6IHRydWUsXG4gICAgICAgICAgICAgIGZsYXZvck5vdGVzOiBbJ0Nob2NvbGF0ZScsICdDYXJhbWVsJywgJ0NpdHJ1cyddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgIH1cbiAgICAgICAgXTtcblxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUG9wdWxhdGluZyBzYW1wbGUgZGF0YS4uLicpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2Ygc2FtcGxlUHJvZHVjdHMpIHtcbiAgICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBQdXRDb21tYW5kKHtcbiAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlRBQkxFX05BTUUsXG4gICAgICAgICAgICAgICAgSXRlbTogcHJvZHVjdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcXGBBZGRlZCBwcm9kdWN0OiBcXCR7cHJvZHVjdC5wcm9kdWN0SWR9XFxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdTYW1wbGUgZGF0YSBwb3B1bGF0ZWQgc3VjY2Vzc2Z1bGx5JyB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcG9wdWxhdGluZyBkYXRhOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0ZhaWxlZCB0byBwb3B1bGF0ZSBkYXRhJyB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHByb2R1Y3RUYWJsZS50YWJsZU5hbWVcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTZcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIHRvIHBvcHVsYXRlIGZ1bmN0aW9uXG4gICAgcHJvZHVjdFRhYmxlLmdyYW50V3JpdGVEYXRhKHBvcHVsYXRlRGF0YUZ1bmN0aW9uKTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUHJvZHVjdFNwZWNzQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGBwcm9kdWN0LXNwZWNzLWFwaS0ke0RhdGUubm93KCl9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciBhY2Nlc3NpbmcgcHJvZHVjdCBzcGVjaWZpY2F0aW9ucycsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgaW50ZWdyYXRpb25cbiAgICBjb25zdCBnZXRQcm9kdWN0c0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbik7XG5cbiAgICAvLyBBUEkgcm91dGVzXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncHJvZHVjdHMnKTtcbiAgICBwcm9kdWN0cy5hZGRNZXRob2QoJ0dFVCcsIGdldFByb2R1Y3RzSW50ZWdyYXRpb24pO1xuXG4gICAgY29uc3QgcHJvZHVjdEJ5SWQgPSBwcm9kdWN0cy5hZGRSZXNvdXJjZSgne3Byb2R1Y3RJZH0nKTtcbiAgICBwcm9kdWN0QnlJZC5hZGRNZXRob2QoJ0dFVCcsIGdldFByb2R1Y3RzSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gT3V0cHV0IEFQSSBlbmRwb2ludFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBlbmRwb2ludCBVUkwnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUG9wdWxhdGVEYXRhRnVuY3Rpb25OYW1lJywge1xuICAgICAgdmFsdWU6IHBvcHVsYXRlRGF0YUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRnVuY3Rpb24gbmFtZSBmb3IgcG9wdWxhdGluZyBzYW1wbGUgZGF0YSdcbiAgICB9KTtcbiAgfVxufVxuIl19