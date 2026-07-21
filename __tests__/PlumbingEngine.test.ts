import { PlumbingEngine } from '../src/engine/PlumbingEngine';

// ─── Pipe Velocity ───────────────────────────────────────────────────

describe('Pipe Velocity Calculator', () => {
  test('calculates velocity from GPM and pipe size', () => {
    const result = PlumbingEngine.pipeVelocity({ gpm: 10, pipeSize: '3/4"' });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Velocity')?.value)).toBeGreaterThan(0);
  });

  test('rejects non-positive GPM', () => {
    const result = PlumbingEngine.pipeVelocity({ gpm: 0, pipeSize: '3/4"' });
    expect(result.ok).toBe(false);
  });

  test('rejects unknown pipe size', () => {
    const result = PlumbingEngine.pipeVelocity({ gpm: 10, pipeSize: '99"' });
    expect(result.ok).toBe(false);
  });
});

// ─── Flow Rate ───────────────────────────────────────────────────────

describe('Flow Rate Calculator', () => {
  test('calculates GPM from velocity and pipe size', () => {
    const result = PlumbingEngine.flowRate({ velocity: 5, pipeSize: '3/4"' });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Flow')?.value)).toBeGreaterThan(0);
  });
});

// ─── Pipe Sizing ─────────────────────────────────────────────────────

describe('Pipe Sizing Calculator', () => {
  test('selects a standard pipe size', () => {
    const result = PlumbingEngine.pipeSizing({ gpm: 10, maxVelocity: 8 });
    expect(result.passes).toBe(true);
    expect(result.value).toBeGreaterThan(0);
  });

  test('fails validation for zero inputs', () => {
    const result = PlumbingEngine.pipeSizing({ gpm: 0, maxVelocity: 8 });
    expect(result.passes).toBe(false);
  });
});

// ─── Pressure Drop ───────────────────────────────────────────────────

describe('Pressure Drop Calculator', () => {
  test('calculates Hazen-Williams pressure drop', () => {
    const result = PlumbingEngine.pressureDrop({ gpm: 10, pipeSize: '3/4"', length: 100, material: 'copper' });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Pressure drop')?.value)).toBeGreaterThan(0);
  });

  test('supports CPVC material', () => {
    const result = PlumbingEngine.pressureDrop({ gpm: 10, pipeSize: '1"', length: 50, material: 'cpvc' });
    expect(result.ok).toBe(true);
  });
});

// ─── Drainage Sizing ─────────────────────────────────────────────────

describe('Drainage Sizing Calculator', () => {
  test('returns a drainage pipe size', () => {
    const result = PlumbingEngine.drainageSizing({
      fixtureUnits: 10,
      slope: '1/4',
      includesWaterCloset: true,
    });
    expect(result.passes).toBe(true);
    expect(result.value).toBe(3);
    expect(result.message).toContain('3"');
  });

  test('fails closed outside the modeled drainage table', () => {
    const result = PlumbingEngine.drainageSizing({
      fixtureUnits: 100000,
      slope: '1/8',
      includesWaterCloset: true,
    });
    expect(result.passes).toBe(false);
    expect(result.message).toContain('Unsupported');
  });
});

// ─── Vent Sizing ─────────────────────────────────────────────────────

describe('Vent Sizing Calculator', () => {
  test('returns a vent pipe size', () => {
    const result = PlumbingEngine.ventSizing({ drainSize: '3"', ventLength: 30 });
    expect(result.passes).toBe(true);
    expect(result.value).toBe(1.5);
    expect(result.message).toContain('1-1/2"');
  });

  test('parses mixed-number drain sizes as nominal dimensions', () => {
    const result = PlumbingEngine.ventSizing({ drainSize: '2-1/2"', ventLength: 30 });
    expect(result.passes).toBe(true);
    expect(result.value).toBe(1.25);
  });
});

// ─── Water Heater ────────────────────────────────────────────────────

describe('Water Heater Calculator', () => {
  test('estimates first-hour rating', () => {
    const result = PlumbingEngine.waterHeater({ tankGallons: 50, tempRise: 70, inputBtu: 40000, efficiency: 0.8 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Recovery')?.value)).toBeCloseTo(54.9, 1);
    expect(Number(result.fields.find((f) => f.label === 'First hour')?.value)).toBe(90);
  });

  test('validates efficiency range', () => {
    const result = PlumbingEngine.waterHeater({ tankGallons: 50, tempRise: 70, inputBtu: 40000, efficiency: 0 });
    expect(result.ok).toBe(false);
  });
});

// ─── Gas Pipe Sizing ─────────────────────────────────────────────────

describe('Gas Pipe Sizing Calculator', () => {
  test('recommends a gas pipe size', () => {
    const result = PlumbingEngine.gasPipeSizing({ btuPerHour: 100000, length: 30 });
    expect(result.ok).toBe(true);
    expect(result.fields.find((f) => f.label === 'Gas pipe')?.value).toBeDefined();
  });
});

// ─── Pump Head ───────────────────────────────────────────────────────

describe('Pump Head Calculator', () => {
  test('calculates total dynamic head', () => {
    const result = PlumbingEngine.pumpHead({ staticLift: 20, frictionPsi: 5, pressurePsi: 20 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'TDH')?.value)).toBeGreaterThan(0);
  });
});

// ─── Pipe Volume ─────────────────────────────────────────────────────

describe('Pipe Volume Calculator', () => {
  test('calculates gallons in pipe', () => {
    const result = PlumbingEngine.pipeVolume({ pipeSize: '3/4"', length: 100 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Volume')?.value)).toBeGreaterThan(0);
  });
});

// ─── Water Pressure ──────────────────────────────────────────────────

describe('Water Pressure Calculator', () => {
  test('converts head to psi', () => {
    const result = PlumbingEngine.waterPressure({ head: 23.1 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Pressure')?.value)).toBeCloseTo(10, 0);
  });

  test('converts psi to head', () => {
    const result = PlumbingEngine.waterPressure({ psi: 10 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Head')?.value)).toBeCloseTo(23.1, 0);
  });

  test('requires one value', () => {
    const result = PlumbingEngine.waterPressure({});
    expect(result.ok).toBe(false);
  });
});

// ─── Pipe Expansion ──────────────────────────────────────────────────

describe('Pipe Expansion Calculator', () => {
  test('calculates copper expansion', () => {
    const result = PlumbingEngine.pipeExpansion({ pipeSize: '3/4"', length: 50, deltaT: 40, material: 'copper' });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Expansion')?.value)).toBeGreaterThan(0);
  });

  test('calculates CPVC expansion', () => {
    const result = PlumbingEngine.pipeExpansion({ pipeSize: '1"', length: 50, deltaT: 40, material: 'cpvc' });
    expect(result.ok).toBe(true);
  });
});

// ─── Fixture Units ───────────────────────────────────────────────────

describe('Fixture Units Calculator', () => {
  test('totals fixture units and suggests drain size', () => {
    const result = PlumbingEngine.fixtureUnits({ toilet: 2, lavatory: 2, shower: 1 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Fixture units')?.value)).toBeGreaterThan(0);
  });

  test('requires at least one fixture', () => {
    const result = PlumbingEngine.fixtureUnits({});
    expect(result.ok).toBe(false);
  });
});

// ─── Water Meter Sizing ──────────────────────────────────────────────

describe('Water Meter Sizing Calculator', () => {
  test('fails closed without utility and pressure inputs', () => {
    const result = PlumbingEngine.waterMeterSizing({ fixtureUnits: 20 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unsupported');
    expect(result.details.join(' ')).toContain('utility meter table');
  });
});

// ─── Irrigation Flow ─────────────────────────────────────────────────

describe('Irrigation Flow Calculator', () => {
  test('calculates zone GPM', () => {
    const result = PlumbingEngine.irrigationFlow({ heads: 4, gpmPerHead: 2 });
    expect(result.ok).toBe(true);
    expect(result.fields.find((f) => f.label === 'Zone GPM')?.value).toBe('8.0');
  });
});

// ─── Septic Tank ─────────────────────────────────────────────────────

describe('Septic Tank Calculator', () => {
  test('returns a planning volume without claiming a permit minimum', () => {
    const result = PlumbingEngine.septicTank({ bedrooms: 3 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Planning volume')?.value.replace(/,/g, ''))).toBeGreaterThanOrEqual(1000);
    expect(result.details.join(' ')).toContain('not a permit minimum');
  });
});

// ─── Grease Interceptor ──────────────────────────────────────────────

describe('Grease Interceptor Calculator', () => {
  test('fails closed when only fixture units are known', () => {
    const result = PlumbingEngine.greaseInterceptor({ fixtureUnits: 10 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unsupported');
  });

  test('fails closed when only flow is known', () => {
    const result = PlumbingEngine.greaseInterceptor({ gpm: 20 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unsupported');
  });
});

// ─── Backflow Pressure ───────────────────────────────────────────────

describe('Backflow Pressure Calculator', () => {
  test('requires a manufacturer pressure-loss curve for RPZ', () => {
    const result = PlumbingEngine.backflowPressure({ gpm: 15, type: 'RPZ' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unsupported');
    expect(result.details.join(' ')).toContain('manufacturer');
  });

  test('requires a manufacturer pressure-loss curve for DCV', () => {
    const result = PlumbingEngine.backflowPressure({ gpm: 15, type: 'DCV' });
    expect(result.ok).toBe(false);
  });

  test('rejects malformed runtime payloads without throwing', () => {
    const result = PlumbingEngine.backflowPressure(null as never);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('object');
  });
});
