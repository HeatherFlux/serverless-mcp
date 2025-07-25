import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  LambdaMcpHandler,
  McpServer,
  McpToolProvider,
  McpResourceProvider,
  McpPromptProvider,
  PromptUtils,
} from 'serverless-mcp';

// Create the Lambda MCP handler
export const handler = LambdaMcpHandler.create(
  {
    name: 'lambda-mcp-server',
    version: '1.0.0',
    transport: {
      cors: {
        origin: '*',
        credentials: false,
      },
      maxMessageSize: 5 * 1024 * 1024, // 5MB
      enableMetrics: true,
      enableLogs: true,
    },
    enableMetrics: true,
    enableLogs: true,
  },
  (server: McpServer) => {
    // Setup tools
    const toolProvider = new McpToolProvider();

    toolProvider.registerTool({
      name: 'aws-info',
      description: 'Get AWS Lambda function information',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        return {
          environment: process.env.AWS_EXECUTION_ENV || 'unknown',
          region: process.env.AWS_REGION || 'unknown',
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
          functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION || 'unknown',
          memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
          runtime: process.env.AWS_EXECUTION_ENV || 'unknown',
          timestamp: new Date().toISOString(),
        };
      },
    });

    toolProvider.registerTool({
      name: 'lambda-metrics',
      description: 'Get Lambda function metrics and limits',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const used = process.memoryUsage();
        return {
          memory: {
            rss: used.rss,
            heapTotal: used.heapTotal,
            heapUsed: used.heapUsed,
            external: used.external,
            arrayBuffers: used.arrayBuffers,
          },
          uptime: process.uptime(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          timestamp: new Date().toISOString(),
        };
      },
    });

    toolProvider.registerTool({
      name: 'environment',
      description: 'Get environment variables (filtered for security)',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { 
            type: 'string', 
            description: 'Filter pattern for environment variables',
            default: 'AWS_*',
          },
        },
        required: [],
      },
      handler: async (args) => {
        const filter = args.filter as string || 'AWS_*';
        const env: Record<string, string> = {};
        
        // Only show AWS-related environment variables for security
        for (const [key, value] of Object.entries(process.env)) {
          if (key.startsWith('AWS_') || key.startsWith('LAMBDA_')) {
            env[key] = value || '';
          }
        }
        
        return {
          environment: env,
          filter,
          count: Object.keys(env).length,
          timestamp: new Date().toISOString(),
        };
      },
    });

    server.setToolProvider(toolProvider);

    // Setup resources
    const resourceProvider = new McpResourceProvider();

    resourceProvider.registerResource({
      uri: 'lambda://function-info',
      name: 'Lambda Function Information',
      description: 'Detailed information about the current Lambda function',
      mimeType: 'application/json',
      handler: () => ({
        uri: 'lambda://function-info',
        mimeType: 'application/json',
        text: JSON.stringify({
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
          memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
          region: process.env.AWS_REGION,
          runtime: process.env.AWS_EXECUTION_ENV,
          logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
          logStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
          requestId: process.env._X_AMZN_TRACE_ID,
          timestamp: new Date().toISOString(),
        }, null, 2),
      }),
    });

    resourceProvider.registerResource({
      uri: 'lambda://runtime-stats',
      name: 'Lambda Runtime Statistics',
      description: 'Current runtime statistics and performance metrics',
      mimeType: 'application/json',
      handler: () => {
        const stats = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          versions: process.versions,
          platform: {
            arch: process.arch,
            platform: process.platform,
          },
          timestamp: new Date().toISOString(),
        };

        return {
          uri: 'lambda://runtime-stats',
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2),
        };
      },
    });

    server.setResourceProvider(resourceProvider);

    // Setup prompts
    const promptProvider = new McpPromptProvider();

    promptProvider.registerPrompt({
      name: 'lambda-analysis',
      description: 'Generate analysis prompt for Lambda function data',
      arguments: [
        { name: 'focus', description: 'Focus area for analysis', required: false },
      ],
      handler: async (args) => {
        const focus = args.focus as string || 'general';
        
        const prompts = {
          general: 'Analyze the Lambda function metrics and provide insights about performance and optimization opportunities.',
          memory: 'Focus on memory usage patterns and suggest optimizations for memory efficiency.',
          performance: 'Analyze performance metrics and identify potential bottlenecks or improvements.',
          cost: 'Evaluate the cost implications of current resource usage and suggest cost optimization strategies.',
        };

        const prompt = prompts[focus as keyof typeof prompts] || prompts.general;
        
        return [
          PromptUtils.createUserMessage(`${prompt} Use the available tools to gather current Lambda function data.`),
          PromptUtils.createAssistantMessage('I\'ll analyze the Lambda function data using the available tools and provide insights based on the current metrics.'),
        ];
      },
    });

    promptProvider.registerPrompt({
      name: 'troubleshooting',
      description: 'Generate troubleshooting guide for Lambda issues',
      arguments: [
        { name: 'issue', description: 'Specific issue to troubleshoot', required: false },
      ],
      handler: async (args) => {
        const issue = args.issue as string || 'general';
        
        return [
          PromptUtils.createUserMessage(`Help me troubleshoot Lambda function issues related to: ${issue}. Please gather function information and provide step-by-step troubleshooting guidance.`),
          PromptUtils.createAssistantMessage('I\'ll help you troubleshoot your Lambda function. Let me gather the current function information and provide targeted troubleshooting steps.'),
        ];
      },
    });

    server.setPromptProvider(promptProvider);
  },
);

// Export for testing
export { LambdaMcpHandler };