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
    const result = PlumbingEngine.drainageSizing({ fixtureUnits: 10 });
    expect(result.passes).toBe(true);
    expect(result.message).toContain('"');
  });
});

// ─── Vent Sizing ─────────────────────────────────────────────────────

describe('Vent Sizing Calculator', () => {
  test('returns a vent pipe size', () => {
    const result = PlumbingEngine.ventSizing({ fixtureUnits: 10, ventLength: 30 });
    expect(result.passes).toBe(true);
    expect(result.message).toContain('"');
  });
});

// ─── Water Heater ────────────────────────────────────────────────────

describe('Water Heater Calculator', () => {
  test('estimates first-hour rating', () => {
    const result = PlumbingEngine.waterHeater({ tankGallons: 50, tempRise: 70, inputBtu: 40000, efficiency: 0.8 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'First hour')?.value)).toBeGreaterThan(0);
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
  test('recommends a meter size', () => {
    const result = PlumbingEngine.waterMeterSizing({ fixtureUnits: 20 });
    expect(result.ok).toBe(true);
    expect(result.fields.find((f) => f.label === 'Meter size')?.value).toBeDefined();
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
  test('recommends minimum tank volume', () => {
    const result = PlumbingEngine.septicTank({ bedrooms: 3 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Min tank')?.value.replace(/,/g, ''))).toBeGreaterThanOrEqual(1000);
  });
});

// ─── Grease Interceptor ──────────────────────────────────────────────

describe('Grease Interceptor Calculator', () => {
  test('sizes from fixture units', () => {
    const result = PlumbingEngine.greaseInterceptor({ fixtureUnits: 10 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Capacity')?.value)).toBeGreaterThan(0);
  });

  test('sizes from GPM', () => {
    const result = PlumbingEngine.greaseInterceptor({ gpm: 20 });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Capacity')?.value)).toBeGreaterThan(0);
  });
});

// ─── Backflow Pressure ───────────────────────────────────────────────

describe('Backflow Pressure Calculator', () => {
  test('estimates RPZ pressure loss', () => {
    const result = PlumbingEngine.backflowPressure({ gpm: 15, type: 'RPZ' });
    expect(result.ok).toBe(true);
    expect(Number(result.fields.find((f) => f.label === 'Pressure loss')?.value)).toBeGreaterThan(0);
  });

  test('estimates DCV pressure loss', () => {
    const result = PlumbingEngine.backflowPressure({ gpm: 15, type: 'DCV' });
    expect(result.ok).toBe(true);
  });
});
