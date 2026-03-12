import { describe, it, expect } from 'vitest';
import { classifyBehaviorParams } from './classify-params.js';

describe('classifyBehaviorParams', () => {
  it('should classify all params as body when no path and no Header types', () => {
    const params = [
      { name: 'name', type: 'string', isOptional: false },
      { name: 'age', type: 'number', isOptional: true },
    ];

    const result = classifyBehaviorParams(params);

    expect(result.path).toHaveLength(0);
    expect(result.header).toHaveLength(0);
    expect(result.body).toHaveLength(2);
    expect(result.body[0].name).toBe('name');
    expect(result.body[1].name).toBe('age');
  });

  it('should classify params matching :paramName in path as path params', () => {
    const params = [
      { name: 'orderId', type: 'number', isOptional: false },
      { name: 'details', type: 'any', isOptional: false },
    ];

    const result = classifyBehaviorParams(params, '/orders/:orderId/ship');

    expect(result.path).toHaveLength(1);
    expect(result.path[0].name).toBe('orderId');
    expect(result.path[0].source).toBe('path');
    expect(result.body).toHaveLength(1);
    expect(result.body[0].name).toBe('details');
  });

  it('should classify Header<T> params as header params with innerType', () => {
    const params = [
      { name: 'authorization', type: 'Header<string>', isOptional: false },
      { name: 'details', type: 'any', isOptional: false },
    ];

    const result = classifyBehaviorParams(params);

    expect(result.header).toHaveLength(1);
    expect(result.header[0].name).toBe('authorization');
    expect(result.header[0].source).toBe('header');
    expect(result.header[0].innerType).toBe('string');
    expect(result.header[0].headerName).toBe('authorization');
    expect(result.body).toHaveLength(1);
  });

  it('should kebab-case multi-word header names', () => {
    const params = [
      { name: 'apiKey', type: 'Header<string>', isOptional: false },
    ];

    const result = classifyBehaviorParams(params);

    expect(result.header[0].headerName).toBe('api-key');
  });

  it('should classify mixed path, header, and body params correctly', () => {
    const params = [
      { name: 'orderId', type: 'number', isOptional: false },
      { name: 'authorization', type: 'Header<string>', isOptional: false },
      { name: 'shipmentDetails', type: 'ShipmentDetails', isOptional: false },
    ];

    const result = classifyBehaviorParams(params, '/orders/:orderId/ship');

    expect(result.path).toHaveLength(1);
    expect(result.header).toHaveLength(1);
    expect(result.body).toHaveLength(1);
    expect(result.all).toHaveLength(3);
    // Preserves original order
    expect(result.all[0].source).toBe('path');
    expect(result.all[1].source).toBe('header');
    expect(result.all[2].source).toBe('body');
  });

  it('should handle multiple path params', () => {
    const params = [
      { name: 'orgId', type: 'string', isOptional: false },
      { name: 'userId', type: 'string', isOptional: false },
      { name: 'data', type: 'any', isOptional: false },
    ];

    const result = classifyBehaviorParams(params, '/orgs/:orgId/users/:userId');

    expect(result.path).toHaveLength(2);
    expect(result.body).toHaveLength(1);
  });

  it('should return empty arrays when no params', () => {
    const result = classifyBehaviorParams([]);

    expect(result.all).toHaveLength(0);
    expect(result.path).toHaveLength(0);
    expect(result.header).toHaveLength(0);
    expect(result.body).toHaveLength(0);
  });

  it('should strip /api prefix from path before matching', () => {
    const params = [
      { name: 'id', type: 'number', isOptional: false },
    ];

    const result = classifyBehaviorParams(params, '/api/items/:id');

    expect(result.path).toHaveLength(1);
    expect(result.path[0].name).toBe('id');
  });
});
