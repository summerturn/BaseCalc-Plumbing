// BaseCalc Plumbing calculation engine. Pure functions, no UI deps.

// ─── Types ───────────────────────────────────────────────────────────

export interface CalculationResult {
  value: number;
  unit: string;
  passes: boolean;
  limit?: number;
  message: string;
  details: string[];
}

export interface MetricField {
  label: string;
  value: string;
  unit?: string;
  emphasis?: boolean;
}

export interface MetricResult {
  ok: boolean;
  message: string;
  fields: MetricField[];
  details: string[];
}

export type PipeMaterial = 'copper' | 'cpvc' | 'pvc';
export type BackflowType = 'PVB' | 'DCV' | 'RPZ';

// ─── Validation Helpers ──────────────────────────────────────────────

function validatePositive(value: number, name: string): string | null {
  if (isNaN(value) || value <= 0) return `${name} must be a positive number`;
  return null;
}

function validateNonNegative(value: number, name: string): string | null {
  if (isNaN(value) || value < 0) return `${name} must be a non-negative number`;
  return null;
}

function validateRange(value: number, min: number, max: number, name: string): string | null {
  if (isNaN(value)) return `${name} must be a valid number`;
  if (value < min) return `${name} must be at least ${min}`;
  if (value > max) return `${name} must not exceed ${max}`;
  return null;
}

function fmt(n: number, d: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── Pipe Data ───────────────────────────────────────────────────────

// Nominal pipe sizes with approximate internal diameters (inches).
export interface PipeSize {
  nominal: string;
  id: number; // inches
}

export const PIPE_SIZES: PipeSize[] = [
  { nominal: '1/2"', id: 0.622 },
  { nominal: '3/4"', id: 0.824 },
  { nominal: '1"', id: 1.049 },
  { nominal: '1-1/4"', id: 1.380 },
  { nominal: '1-1/2"', id: 1.610 },
  { nominal: '2"', id: 2.067 },
  { nominal: '2-1/2"', id: 2.469 },
  { nominal: '3"', id: 3.068 },
  { nominal: '4"', id: 4.026 },
  { nominal: '6"', id: 6.065 },
];

const GPM_TO_CFS = 1 / 449; // 1 cfs ≈ 449 gpm

function pipeArea(idInches: number): number {
  return Math.PI * Math.pow(idInches / 2, 2) / 144; // ft²
}

function findPipeSize(minArea: number): PipeSize {
  for (const size of PIPE_SIZES) {
    if (pipeArea(size.id) >= minArea) return size;
  }
  return PIPE_SIZES[PIPE_SIZES.length - 1];
}

function nominalToPipeSize(nominal: string): PipeSize | undefined {
  return PIPE_SIZES.find((p) => p.nominal === nominal);
}

// Hazen-Williams C factors.
const C_FACTOR: Record<PipeMaterial, number> = {
  copper: 140,
  cpvc: 150,
  pvc: 150,
};

// Hazen-Williams: psi per ft = 4.52 * Q^1.852 / (C^1.852 * D^4.8704)
function hazenWilliamsPsiPerFt(gpm: number, idInches: number, c: number): number {
  return (4.52 * Math.pow(gpm, 1.852)) / (Math.pow(c, 1.852) * Math.pow(idInches, 4.8704));
}

// ─── Drainage / Vent Tables ──────────────────────────────────────────

// IPC Table 710.1(1) simplified fixture-unit to drain diameter.
const DRAINAGE_TABLE: { maxFu: number; size: string }[] = [
  { maxFu: 1, size: '1-1/4"' },
  { maxFu: 3, size: '1-1/2"' },
  { maxFu: 8, size: '2"' },
  { maxFu: 24, size: '2-1/2"' },
  { maxFu: 42, size: '3"' },
  { maxFu: 216, size: '4"' },
  { maxFu: 480, size: '5"' },
  { maxFu: 1000, size: '6"' },
];

function drainageSize(fu: number): string {
  for (const row of DRAINAGE_TABLE) {
    if (fu <= row.maxFu) return row.size;
  }
  return DRAINAGE_TABLE[DRAINAGE_TABLE.length - 1].size;
}

// Simplified vent sizing (IPC vent tables, conservative).
const VENT_TABLE: { maxFu: number; maxLen: number; size: string }[] = [
  { maxFu: 1, maxLen: 45, size: '1-1/4"' },
  { maxFu: 8, maxLen: 30, size: '1-1/2"' },
  { maxFu: 24, maxLen: 50, size: '2"' },
  { maxFu: 48, maxLen: 30, size: '2"' },
  { maxFu: 84, maxLen: 20, size: '2-1/2"' },
  { maxFu: 216, maxLen: 100, size: '3"' },
  { maxFu: 480, maxLen: 100, size: '4"' },
];

function ventSize(fu: number, length: number): string {
  for (const row of VENT_TABLE) {
    if (fu <= row.maxFu && length <= row.maxLen) return row.size;
  }
  return VENT_TABLE[VENT_TABLE.length - 1].size;
}

// ─── Fixture Units ───────────────────────────────────────────────────

export interface FixtureCounts {
  toilet?: number;
  lavatory?: number;
  bathtub?: number;
  shower?: number;
  kitchenSink?: number;
  dishwasher?: number;
  washingMachine?: number;
  urinal?: number;
}

const FIXTURE_UNITS: Record<keyof FixtureCounts, number> = {
  toilet: 3,
  lavatory: 1,
  bathtub: 2,
  shower: 2,
  kitchenSink: 1.5,
  dishwasher: 1.5,
  washingMachine: 3,
  urinal: 4,
};

// ─── Gas Pipe Tables ─────────────────────────────────────────────────

// Approximate cubic-feet-per-hour capacity for Schedule 40 iron pipe by length.
// Based on common low-pressure gas sizing tables.
const GAS_TABLE: { size: string; capacities: { len: number; cfh: number }[] }[] = [
  {
    size: '1/2"',
    capacities: [
      { len: 10, cfh: 132 },
      { len: 20, cfh: 90 },
      { len: 30, cfh: 72 },
      { len: 40, cfh: 63 },
      { len: 50, cfh: 56 },
      { len: 60, cfh: 50 },
    ],
  },
  {
    size: '3/4"',
    capacities: [
      { len: 10, cfh: 278 },
      { len: 20, cfh: 190 },
      { len: 30, cfh: 152 },
      { len: 40, cfh: 133 },
      { len: 50, cfh: 118 },
      { len: 60, cfh: 107 },
    ],
  },
  {
    size: '1"',
    capacities: [
      { len: 10, cfh: 520 },
      { len: 20, cfh: 350 },
      { len: 30, cfh: 282 },
      { len: 40, cfh: 245 },
      { len: 50, cfh: 220 },
      { len: 60, cfh: 199 },
    ],
  },
  {
    size: '1-1/4"',
    capacities: [
      { len: 10, cfh: 1050 },
      { len: 20, cfh: 730 },
      { len: 30, cfh: 590 },
      { len: 40, cfh: 500 },
      { len: 50, cfh: 440 },
      { len: 60, cfh: 400 },
    ],
  },
  {
    size: '1-1/2"',
    capacities: [
      { len: 10, cfh: 1575 },
      { len: 20, cfh: 1100 },
      { len: 30, cfh: 890 },
      { len: 40, cfh: 760 },
      { len: 50, cfh: 670 },
      { len: 60, cfh: 610 },
    ],
  },
  {
    size: '2"',
    capacities: [
      { len: 10, cfh: 3050 },
      { len: 20, cfh: 2100 },
      { len: 30, cfh: 1680 },
      { len: 40, cfh: 1460 },
      { len: 50, cfh: 1300 },
      { len: 60, cfh: 1180 },
    ],
  },
];

function gasCapacityFor(size: string, length: number): number {
  const row = GAS_TABLE.find((r) => r.size === size);
  if (!row) return 0;
  // Interpolate between bracketing lengths.
  for (let i = 0; i < row.capacities.length - 1; i++) {
    const a = row.capacities[i];
    const b = row.capacities[i + 1];
    if (length >= a.len && length <= b.len) {
      const t = (length - a.len) / (b.len - a.len);
      return a.cfh + (b.cfh - a.cfh) * t;
    }
  }
  if (length <= row.capacities[0].len) return row.capacities[0].cfh;
  return row.capacities[row.capacities.length - 1].cfh;
}

function gasPipeSize(btuPerHour: number, length: number): string {
  const cfh = btuPerHour / 1000; // rough: 1 CFH ≈ 1,000 BTU/hr
  for (const row of GAS_TABLE) {
    if (gasCapacityFor(row.size, length) >= cfh) return row.size;
  }
  return GAS_TABLE[GAS_TABLE.length - 1].size;
}

// ─── Water Meter Tables ──────────────────────────────────────────────

function waterMeterSize(fu: number): string {
  if (fu <= 20) return '5/8"';
  if (fu <= 30) return '3/4"';
  if (fu <= 50) return '1"';
  if (fu <= 100) return '1-1/2"';
  return '2"';
}

// ─── Backflow Pressure Loss ──────────────────────────────────────────

function backflowLoss(gpm: number, type: BackflowType): number {
  // Approximate pressure loss (psi) at a given flow.
  const base: Record<BackflowType, { k: number; offset: number }> = {
    PVB: { k: 0.0006, offset: 2.5 },
    DCV: { k: 0.0003, offset: 1.0 },
    RPZ: { k: 0.0012, offset: 5.0 },
  };
  return base[type].offset + base[type].k * Math.pow(gpm, 1.85);
}

// ─── Thermal Expansion ───────────────────────────────────────────────

const EXPANSION_COEFFICIENT: Record<PipeMaterial, number> = {
  copper: 9.4e-6,
  cpvc: 3.0e-5,
  pvc: 3.0e-5,
};

// ─── Calculator Engine ───────────────────────────────────────────────

export const PlumbingEngine = {
  pipeVelocity(inputs: { gpm: number; pipeSize: string }): MetricResult {
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
    ].filter(Boolean) as string[];
    const pipe = nominalToPipeSize(inputs.pipeSize);
    if (!pipe) errs.push(`Unknown pipe size: ${inputs.pipeSize}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const area = pipeArea(pipe!.id);
    const velocity = inputs.gpm / (449 * area);
    const limit = 8;
    const passes = velocity <= limit;

    return {
      ok: true,
      message: passes
        ? `${fmt(velocity, 1)} ft/s velocity in ${pipe!.nominal} pipe`
        : `${fmt(velocity, 1)} ft/s exceeds ${limit} ft/s typical limit. Increase pipe size.`,
      fields: [
        { label: 'Velocity', value: fmt(velocity, 1), unit: 'ft/s', emphasis: true },
        { label: 'Flow', value: fmt(inputs.gpm, 1), unit: 'GPM' },
        { label: 'Pipe size', value: pipe!.nominal },
        { label: 'Area', value: fmt(area, 4), unit: 'ft²' },
      ],
      details: [
        `Area = π × (${pipe!.id}"/2)² ÷ 144 = ${fmt(area, 4)} ft²`,
        `Velocity = ${fmt(inputs.gpm, 1)} GPM ÷ (449 × ${fmt(area, 4)}) = ${fmt(velocity, 1)} ft/s`,
        `Typical max velocity for water distribution ≈ ${limit} ft/s`,
      ],
    };
  },

  flowRate(inputs: { velocity: number; pipeSize: string }): MetricResult {
    const errs = [
      validatePositive(inputs.velocity, 'Velocity'),
    ].filter(Boolean) as string[];
    const pipe = nominalToPipeSize(inputs.pipeSize);
    if (!pipe) errs.push(`Unknown pipe size: ${inputs.pipeSize}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const area = pipeArea(pipe!.id);
    const gpm = inputs.velocity * 449 * area;

    return {
      ok: true,
      message: `${fmt(gpm, 1)} GPM in ${pipe!.nominal} pipe at ${fmt(inputs.velocity, 1)} ft/s`,
      fields: [
        { label: 'Flow', value: fmt(gpm, 1), unit: 'GPM', emphasis: true },
        { label: 'Velocity', value: fmt(inputs.velocity, 1), unit: 'ft/s' },
        { label: 'Pipe size', value: pipe!.nominal },
      ],
      details: [
        `Area = ${fmt(area, 4)} ft²`,
        `GPM = ${fmt(inputs.velocity, 1)} ft/s × 449 × ${fmt(area, 4)} = ${fmt(gpm, 1)} GPM`,
      ],
    };
  },

  pipeSizing(inputs: { gpm: number; maxVelocity: number }): CalculationResult {
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
      validatePositive(inputs.maxVelocity, 'Maximum velocity'),
    ].filter(Boolean) as string[];
    if (errs.length) return { value: 0, unit: '"', passes: false, message: errs.join('; '), details: [] };

    const minArea = inputs.gpm / (449 * inputs.maxVelocity);
    const size = findPipeSize(minArea);
    const actualVelocity = inputs.gpm / (449 * pipeArea(size.id));
    const passes = actualVelocity <= inputs.maxVelocity;

    return {
      value: size.id,
      unit: '" Ø',
      passes,
      limit: inputs.maxVelocity,
      message: passes
        ? `Minimum pipe size: ${size.nominal} (≈ ${fmt(actualVelocity, 1)} ft/s)`
        : `Could not find a standard pipe size under ${inputs.maxVelocity} ft/s.`,
      details: [
        `Required area = ${fmt(minArea, 4)} ft²`,
        `Selected ${size.nominal} (ID ${fmt(size.id, 3)}")`,
        `Actual velocity ≈ ${fmt(actualVelocity, 1)} ft/s`,
      ],
    };
  },

  pressureDrop(inputs: { gpm: number; pipeSize: string; length: number; material?: PipeMaterial }): MetricResult {
    const material = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    const pipe = nominalToPipeSize(inputs.pipeSize);
    if (!pipe) errs.push(`Unknown pipe size: ${inputs.pipeSize}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const c = C_FACTOR[material];
    const psiPerFt = hazenWilliamsPsiPerFt(inputs.gpm, pipe!.id, c);
    const total = psiPerFt * inputs.length;
    const velocity = inputs.gpm / (449 * pipeArea(pipe!.id));

    return {
      ok: true,
      message: `${fmt(total, 2)} psi total drop (${fmt(psiPerFt, 4)} psi/ft)`,
      fields: [
        { label: 'Pressure drop', value: fmt(total, 2), unit: 'psi', emphasis: true },
        { label: 'Per foot', value: fmt(psiPerFt, 4), unit: 'psi/ft' },
        { label: 'Velocity', value: fmt(velocity, 1), unit: 'ft/s' },
      ],
      details: [
        `Pipe: ${pipe!.nominal} ${material} (C=${c})`,
        `Hazen-Williams psi/ft = 4.52 × ${fmt(inputs.gpm, 1)}^1.852 ÷ (${c}^1.852 × ${fmt(pipe!.id, 3)}^4.8704)`,
        `Total drop = ${fmt(psiPerFt, 4)} × ${fmt(inputs.length, 0)} ft = ${fmt(total, 2)} psi`,
      ],
    };
  },

  drainageSizing(inputs: { fixtureUnits: number }): CalculationResult {
    const err = validatePositive(inputs.fixtureUnits, 'Fixture units');
    if (err) return { value: 0, unit: '"', passes: false, message: err, details: [] };

    const size = drainageSize(inputs.fixtureUnits);
    const limit = DRAINAGE_TABLE.find((r) => r.size === size)?.maxFu ?? 0;

    return {
      value: parseFloat(size.replace(/[^0-9.]/g, '')),
      unit: '"',
      passes: true,
      limit,
      message: `Minimum drainage pipe: ${size}`,
      details: [
        `Total fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
        `IPC simplified sizing → ${size}`,
        `Verify against local amendments and IPC Table 710.1(1).`,
      ],
    };
  },

  ventSizing(inputs: { fixtureUnits: number; ventLength: number }): CalculationResult {
    const errs = [
      validatePositive(inputs.fixtureUnits, 'Fixture units'),
      validatePositive(inputs.ventLength, 'Vent length'),
    ].filter(Boolean) as string[];
    if (errs.length) return { value: 0, unit: '"', passes: false, message: errs.join('; '), details: [] };

    const size = ventSize(inputs.fixtureUnits, inputs.ventLength);

    return {
      value: parseFloat(size.replace(/[^0-9.]/g, '')),
      unit: '"',
      passes: true,
      message: `Minimum vent: ${size}`,
      details: [
        `Fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
        `Developed vent length = ${fmt(inputs.ventLength, 0)} ft`,
        `Simplified IPC vent sizing → ${size}`,
      ],
    };
  },

  waterHeater(inputs: {
    tankGallons: number;
    tempRise: number;
    inputBtu: number;
    efficiency: number;
  }): MetricResult {
    const errs = [
      validatePositive(inputs.tankGallons, 'Tank size'),
      validatePositive(inputs.tempRise, 'Temperature rise'),
      validatePositive(inputs.inputBtu, 'Input BTU/hr'),
      validateRange(inputs.efficiency, 0.1, 1, 'Efficiency'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    // Recovery GPH = (input BTU/hr × eff) ÷ (8.33 × 60 × ΔT)
    const recoveryGph = (inputs.inputBtu * inputs.efficiency) / (8.33 * 60 * inputs.tempRise);
    // First-hour rating: 70% of tank + recovery.
    const firstHour = inputs.tankGallons * 0.7 + recoveryGph;

    return {
      ok: true,
      message: `First-hour rating ≈ ${fmt(firstHour, 0)} gal`,
      fields: [
        { label: 'First hour', value: fmt(firstHour, 0), unit: 'gal', emphasis: true },
        { label: 'Recovery', value: fmt(recoveryGph, 1), unit: 'GPH', emphasis: true },
        { label: 'Tank', value: fmt(inputs.tankGallons, 0), unit: 'gal' },
      ],
      details: [
        `Recovery GPH = (${fmt(inputs.inputBtu, 0)} × ${fmt(inputs.efficiency, 2)}) ÷ (8.33 × 60 × ${fmt(inputs.tempRise, 0)})`,
        `First-hour rating = 0.7 × ${fmt(inputs.tankGallons, 0)} + ${fmt(recoveryGph, 1)} = ${fmt(firstHour, 0)} gal`,
      ],
    };
  },

  gasPipeSizing(inputs: { btuPerHour: number; length: number }): MetricResult {
    const errs = [
      validatePositive(inputs.btuPerHour, 'BTU/hr'),
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const size = gasPipeSize(inputs.btuPerHour, inputs.length);
    const capacity = gasCapacityFor(size, inputs.length) * 1000;

    return {
      ok: true,
      message: `Minimum gas pipe: ${size}`,
      fields: [
        { label: 'Gas pipe', value: size, emphasis: true },
        { label: 'Load', value: fmt(inputs.btuPerHour, 0), unit: 'BTU/hr' },
        { label: 'Capacity', value: fmt(capacity, 0), unit: 'BTU/hr' },
      ],
      details: [
        `Load = ${fmt(inputs.btuPerHour, 0)} BTU/hr`,
        `Length = ${fmt(inputs.length, 0)} ft`,
        `Estimated capacity at ${fmt(inputs.length, 0)} ft ≈ ${fmt(capacity, 0)} BTU/hr`,
        'Verify with NFPA 54 / local gas tables and actual gas specific gravity.',
      ],
    };
  },

  pumpHead(inputs: { staticLift: number; frictionPsi: number; pressurePsi: number }): MetricResult {
    const errs = [
      validateNonNegative(inputs.staticLift, 'Static lift'),
      validateNonNegative(inputs.frictionPsi, 'Friction pressure'),
      validateNonNegative(inputs.pressurePsi, 'Pressure requirement'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const frictionFt = inputs.frictionPsi * 2.31;
    const pressureFt = inputs.pressurePsi * 2.31;
    const tdh = inputs.staticLift + frictionFt + pressureFt;

    return {
      ok: true,
      message: `Total dynamic head ≈ ${fmt(tdh, 1)} ft`,
      fields: [
        { label: 'TDH', value: fmt(tdh, 1), unit: 'ft', emphasis: true },
        { label: 'Static lift', value: fmt(inputs.staticLift, 1), unit: 'ft' },
        { label: 'Friction', value: fmt(frictionFt, 1), unit: 'ft' },
        { label: 'Pressure', value: fmt(pressureFt, 1), unit: 'ft' },
      ],
      details: [
        `Friction head = ${fmt(inputs.frictionPsi, 2)} psi × 2.31 = ${fmt(frictionFt, 1)} ft`,
        `Pressure head = ${fmt(inputs.pressurePsi, 2)} psi × 2.31 = ${fmt(pressureFt, 1)} ft`,
        `TDH = ${fmt(inputs.staticLift, 1)} + ${fmt(frictionFt, 1)} + ${fmt(pressureFt, 1)} = ${fmt(tdh, 1)} ft`,
      ],
    };
  },

  pipeVolume(inputs: { pipeSize: string; length: number }): MetricResult {
    const errs = [
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    const pipe = nominalToPipeSize(inputs.pipeSize);
    if (!pipe) errs.push(`Unknown pipe size: ${inputs.pipeSize}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const gallons = Math.PI * Math.pow(pipe!.id / 2, 2) * inputs.length * 7.48 / 144;

    return {
      ok: true,
      message: `${fmt(gallons, 1)} gallons in ${fmt(inputs.length, 0)} ft of ${pipe!.nominal} pipe`,
      fields: [
        { label: 'Volume', value: fmt(gallons, 1), unit: 'gal', emphasis: true },
        { label: 'Length', value: fmt(inputs.length, 0), unit: 'ft' },
        { label: 'Pipe size', value: pipe!.nominal },
      ],
      details: [
        `Area = π × (${pipe!.id}"/2)² = ${fmt(Math.PI * Math.pow(pipe!.id / 2, 2), 3)} in²`,
        `Volume = area × length × 7.48 gal/ft³ ÷ 144 = ${fmt(gallons, 1)} gal`,
      ],
    };
  },

  waterPressure(inputs: { head?: number; psi?: number }): MetricResult {
    const hasHead = typeof inputs.head === 'number' && isFinite(inputs.head);
    const hasPsi = typeof inputs.psi === 'number' && isFinite(inputs.psi);

    if (!hasHead && !hasPsi) {
      return { ok: false, message: 'Enter head (ft) or pressure (psi) to convert.', fields: [], details: [] };
    }

    if (hasHead) {
      const psi = inputs.head! / 2.31;
      return {
        ok: true,
        message: `${fmt(inputs.head!, 1)} ft = ${fmt(psi, 1)} psi`,
        fields: [
          { label: 'Head', value: fmt(inputs.head!, 1), unit: 'ft', emphasis: true },
          { label: 'Pressure', value: fmt(psi, 1), unit: 'psi', emphasis: true },
        ],
        details: ['1 psi ≈ 2.31 ft of water head'],
      };
    }

    const head = inputs.psi! * 2.31;
    return {
      ok: true,
      message: `${fmt(inputs.psi!, 1)} psi = ${fmt(head, 1)} ft`,
      fields: [
        { label: 'Pressure', value: fmt(inputs.psi!, 1), unit: 'psi', emphasis: true },
        { label: 'Head', value: fmt(head, 1), unit: 'ft', emphasis: true },
      ],
        details: ['1 psi ≈ 2.31 ft of water head'],
    };
  },

  pipeExpansion(inputs: { pipeSize: string; length: number; deltaT: number; material?: PipeMaterial }): MetricResult {
    const material = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    const pipe = nominalToPipeSize(inputs.pipeSize);
    if (!pipe) errs.push(`Unknown pipe size: ${inputs.pipeSize}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const alpha = EXPANSION_COEFFICIENT[material];
    const deltaL = alpha * inputs.length * 12 * inputs.deltaT;

    return {
      ok: true,
      message: `Expansion ≈ ${fmt(deltaL, 2)} in`,
      fields: [
        { label: 'Expansion', value: fmt(deltaL, 2), unit: 'in', emphasis: true },
        { label: 'Pipe', value: pipe!.nominal },
        { label: 'ΔT', value: fmt(inputs.deltaT, 0), unit: '°F' },
      ],
      details: [
        `Material: ${material} (α ≈ ${alpha} in/in·°F)`,
        `ΔL = α × ${fmt(inputs.length, 0)} ft × 12 × ${fmt(inputs.deltaT, 0)}°F = ${fmt(deltaL, 2)} in`,
        'Provide expansion loops or offsets for long runs.',
      ],
    };
  },

  fixtureUnits(inputs: FixtureCounts): MetricResult {
    const counts = { ...inputs };
    let total = 0;
    const details: string[] = [];
    for (const key of Object.keys(FIXTURE_UNITS) as (keyof FixtureCounts)[]) {
      const count = counts[key] ?? 0;
      if (count > 0) {
        const fu = count * FIXTURE_UNITS[key];
        total += fu;
        details.push(`${key}: ${count} × ${FIXTURE_UNITS[key]} = ${fu}`);
      }
    }

    if (total <= 0) {
      return { ok: false, message: 'Enter at least one fixture count.', fields: [], details: [] };
    }

    return {
      ok: true,
      message: `Total fixture units = ${fmt(total, 1)}`,
      fields: [
        { label: 'Fixture units', value: fmt(total, 1), emphasis: true },
        { label: 'Drain size', value: drainageSize(total), emphasis: true },
      ],
      details,
    };
  },

  waterMeterSizing(inputs: { fixtureUnits: number }): MetricResult {
    const err = validatePositive(inputs.fixtureUnits, 'Fixture units');
    if (err) return { ok: false, message: err, fields: [], details: [] };

    const size = waterMeterSize(inputs.fixtureUnits);

    return {
      ok: true,
      message: `Recommended meter: ${size}`,
      fields: [
        { label: 'Meter size', value: size, emphasis: true },
        { label: 'Fixture units', value: fmt(inputs.fixtureUnits, 1) },
      ],
      details: [
        `Fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
        'Size per typical utility meter tables. Verify with local water authority.',
      ],
    };
  },

  irrigationFlow(inputs: { heads: number; gpmPerHead: number }): MetricResult {
    const errs = [
      validatePositive(inputs.heads, 'Heads'),
      validatePositive(inputs.gpmPerHead, 'GPM per head'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const total = inputs.heads * inputs.gpmPerHead;
    return {
      ok: true,
      message: `Zone flow ≈ ${fmt(total, 1)} GPM`,
      fields: [
        { label: 'Zone GPM', value: fmt(total, 1), unit: 'GPM', emphasis: true },
        { label: 'Heads', value: fmt(inputs.heads, 0) },
        { label: 'Per head', value: fmt(inputs.gpmPerHead, 1), unit: 'GPM' },
      ],
      details: [`Total = ${fmt(inputs.heads, 0)} × ${fmt(inputs.gpmPerHead, 1)} = ${fmt(total, 1)} GPM`],
    };
  },

  septicTank(inputs: { bedrooms: number; dailyFlowPerBedroom?: number }): MetricResult {
    const err = validatePositive(inputs.bedrooms, 'Bedrooms');
    if (err) return { ok: false, message: err, fields: [], details: [] };

    const dailyFlow = inputs.dailyFlowPerBedroom ?? 150;
    const totalFlow = inputs.bedrooms * dailyFlow;
    let minGallons = 1000;
    if (inputs.bedrooms >= 4) minGallons = 1500;
    if (inputs.bedrooms >= 6) minGallons = 2000;
    const recommended = Math.max(minGallons, totalFlow * 2);

    return {
      ok: true,
      message: `Minimum septic tank ≈ ${fmt(recommended, 0)} gal`,
      fields: [
        { label: 'Min tank', value: fmt(recommended, 0), unit: 'gal', emphasis: true },
        { label: 'Daily flow', value: fmt(totalFlow, 0), unit: 'GPD' },
      ],
      details: [
        `Daily flow = ${inputs.bedrooms} bedrooms × ${dailyFlow} GPD = ${fmt(totalFlow, 0)} GPD`,
        `Typical minimum = ${fmt(minGallons, 0)} gal`,
        'Verify with local health department sizing rules.',
      ],
    };
  },

  greaseInterceptor(inputs: { fixtureUnits?: number; gpm?: number }): MetricResult {
    const hasFu = typeof inputs.fixtureUnits === 'number' && isFinite(inputs.fixtureUnits);
    const hasGpm = typeof inputs.gpm === 'number' && isFinite(inputs.gpm);
    if (!hasFu && !hasGpm) {
      return { ok: false, message: 'Enter fixture units or GPM to size interceptor.', fields: [], details: [] };
    }

    const gpm = hasGpm ? inputs.gpm! : (inputs.fixtureUnits! * 3);
    // Grease interceptor capacity in pounds: 2 × GPM (common rule-of-thumb).
    const pounds = gpm * 2;
    const gallons = gpm * 15;

    return {
      ok: true,
      message: `Interceptor ≈ ${fmt(pounds, 0)} lb / ${fmt(gallons, 0)} gal`,
      fields: [
        { label: 'Capacity', value: fmt(pounds, 0), unit: 'lb', emphasis: true },
        { label: 'Flow', value: fmt(gpm, 1), unit: 'GPM' },
      ],
      details: [
        `Flow = ${fmt(gpm, 1)} GPM`,
        `Estimated grease capacity = ${fmt(pounds, 0)} lb`,
        'Verify with local plumbing code and PDI sizing.',
      ],
    };
  },

  backflowPressure(inputs: { gpm: number; type: BackflowType }): MetricResult {
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const loss = backflowLoss(inputs.gpm, inputs.type);

    return {
      ok: true,
      message: `Pressure loss ≈ ${fmt(loss, 2)} psi`,
      fields: [
        { label: 'Pressure loss', value: fmt(loss, 2), unit: 'psi', emphasis: true },
        { label: 'Device', value: inputs.type },
        { label: 'Flow', value: fmt(inputs.gpm, 1), unit: 'GPM' },
      ],
      details: [
        `Device: ${inputs.type}`,
        `Flow: ${fmt(inputs.gpm, 1)} GPM`,
        'Use manufacturer curves for critical designs.',
      ],
    };
  },
};
