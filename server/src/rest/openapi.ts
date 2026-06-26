/**
 * OpenAPI 3.1 document for the integration gateway (SRS §10.4). Hand-authored to stay decoupled
 * from a generator; expand alongside new endpoints. Served at GET /api/v1/openapi.json.
 */
export function openapiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'VMS Integration API',
      version: '1.0.0',
      description: 'External integration endpoints for the Visitor Management System.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
    security: [{ apiKey: [] }],
    paths: {
      '/visitors/on-site': {
        get: {
          summary: 'List visitors currently on-site',
          responses: {
            '200': {
              description: 'Current on-site visitors',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      count: { type: 'integer' },
                      visitors: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid API key' },
          },
        },
      },
      '/access-events': {
        post: {
          summary: 'Submit a door-access event',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['event'],
                  properties: {
                    event: { type: 'string' },
                    badgeNumber: { type: 'string' },
                    visitId: { type: 'string', format: 'uuid' },
                    at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Accepted' },
            '400': { description: 'Invalid payload' },
          },
        },
      },
    },
  };
}
