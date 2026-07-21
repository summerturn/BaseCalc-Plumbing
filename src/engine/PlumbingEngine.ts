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
export type DrainSlope = '1/8' | '1/4' | '1/2';

// ─── Validation Helpers ──────────────────────────────────────────────

function validatePositive(value: number, name: string): string | null {
  if (!Number.isFinite(value) || value <= 0) return `${name} must be a positive finite number`;
  return null;
}

function validateNonNegative(value: number, name: string): string | null {
  if (!Number.isFinite(value) || value < 0) return `${name} must be a non-negative finite number`;
  return null;
}

function validateRange(value: number, min: number, max: number, name: string): string | null {
  if (!Number.isFinite(value)) return `${name} must be a finite number`;
  if (value < min) return `${name} must be at least ${min}`;
  if (value > max) return `${name} must not exceed ${max}`;
  return null;
}

function validateWholeNumber(value: number, min: number, max: number, name: string): string | null {
  const rangeError = validateRange(value, min, max, name);
  if (rangeError) return rangeError;
  if (!Number.isInteger(value)) return `${name} must be a whole number`;
  return null;
}

function validateFiniteResult(values: number[], name: string): string | null {
  return values.every(Number.isFinite) ? null : `${name} is outside the supported numeric range`;
}

function isInputRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidMetricInputs(name: string): MetricResult {
  return { ok: false, message: `${name} inputs must be provided as an object`, fields: [], details: [] };
}

function invalidCalculationInputs(name: string): CalculationResult {
  return {
    value: 0,
    unit: 'in nominal',
    passes: false,
    message: `${name} inputs must be provided as an object`,
    details: [],
  };
}

function fmt(n: number, d: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── Pipe Data ───────────────────────────────────────────────────────

export interface PipeSize {
  nominal: string;
  id: number; // inches
}

interface PipeMaterialSpec {
  label: string;
  hazenWilliamsC: number;
  sizes: readonly PipeSize[];
}

const COPPER_TYPE_L_SIZES: readonly PipeSize[] = [
  { nominal: '1/2"', id: 0.545 },
  { nominal: '3/4"', id: 0.785 },
  { nominal: '1"', id: 1.025 },
  { nominal: '1-1/4"', id: 1.265 },
  { nominal: '1-1/2"', id: 1.505 },
  { nominal: '2"', id: 1.985 },
  { nominal: '2-1/2"', id: 2.465 },
  { nominal: '3"', id: 2.945 },
  { nominal: '4"', id: 3.905 },
  { nominal: '6"', id: 5.845 },
];

const CPVC_CTS_SDR_11_SIZES: readonly PipeSize[] = [
  { nominal: '1/2"', id: 0.485 },
  { nominal: '3/4"', id: 0.713 },
  { nominal: '1"', id: 0.921 },
  { nominal: '1-1/4"', id: 1.125 },
  { nominal: '1-1/2"', id: 1.329 },
  { nominal: '2"', id: 1.739 },
];

const PVC_SCHEDULE_40_SIZES: readonly PipeSize[] = [
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

export const PIPE_MATERIAL_OPTIONS: readonly PipeMaterial[] = ['copper', 'cpvc', 'pvc'];

const PIPE_MATERIAL_SPECS: Record<PipeMaterial, PipeMaterialSpec> = {
  copper: { label: 'Copper Type L', hazenWilliamsC: 140, sizes: COPPER_TYPE_L_SIZES },
  cpvc: { label: 'CPVC CTS SDR 11', hazenWilliamsC: 150, sizes: CPVC_CTS_SDR_11_SIZES },
  pvc: { label: 'PVC Schedule 40', hazenWilliamsC: 150, sizes: PVC_SCHEDULE_40_SIZES },
};

// Kept as the default-size export for existing consumers. Hydraulic callers
// should use pipeSizesForMaterial() when material is user-selectable.
export const PIPE_SIZES = COPPER_TYPE_L_SIZES;

const GPM_TO_CFS = 1 / 449; // 1 cfs ≈ 449 gpm

function pipeArea(idInches: number): number {
  return Math.PI * Math.pow(idInches / 2, 2) / 144; // ft²
}

function isPipeMaterial(value: unknown): value is PipeMaterial {
  return typeof value === 'string' && PIPE_MATERIAL_OPTIONS.includes(value as PipeMaterial);
}

export function pipeSizesForMaterial(material: PipeMaterial): readonly PipeSize[] {
  return PIPE_MATERIAL_SPECS[material].sizes;
}

export function pipeMaterialLabel(material: PipeMaterial): string {
  return PIPE_MATERIAL_SPECS[material].label;
}

function findPipeSize(minArea: number, material: PipeMaterial): PipeSize | undefined {
  return pipeSizesForMaterial(material).find((size) => pipeArea(size.id) >= minArea);
}

function nominalToPipeSize(nominal: unknown, material: PipeMaterial): PipeSize | undefined {
  return pipeSizesForMaterial(material).find((pipe) => pipe.nominal === nominal);
}

export function nominalSizeToInches(nominal: unknown): number | undefined {
  if (typeof nominal !== 'string') return undefined;
  const value = nominal.trim().replace(/"/g, '');
  const mixed = value.match(/^(\d+)(?:-|\s+)(\d+)\/(\d+)$/);
  if (mixed) {
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (numerator <= 0 || denominator <= 0 || numerator >= denominator) return undefined;
    return Number(mixed[1]) + numerator / denominator;
  }

  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (numerator <= 0 || denominator <= 0) return undefined;
    return numerator / denominator;
  }

  if (!/^\d+(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// Hazen-Williams: psi per ft = 4.52 * Q^1.852 / (C^1.852 * D^4.8704)
function hazenWilliamsPsiPerFt(gpm: number, idInches: number, c: number): number {
  return (4.52 * Math.pow(gpm, 1.852)) / (Math.pow(c, 1.852) * Math.pow(idInches, 4.8704));
}

// ─── Drainage / Vent Tables ──────────────────────────────────────────

// 2021 IPC Table 710.1(1), building drains and sewers. A missing capacity
// means that slope/diameter combination is not supported by the table.
export const DRAIN_SLOPE_OPTIONS: DrainSlope[] = ['1/8', '1/4', '1/2'];
export const DRAIN_PIPE_SIZES = ['1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '5"', '6"'];

type DrainageRow = {
  size: string;
  capacity: Partial<Record<DrainSlope, number>>;
};

const DRAINAGE_TABLE: DrainageRow[] = [
  { size: '1-1/4"', capacity: { '1/4': 1, '1/2': 1 } },
  { size: '1-1/2"', capacity: { '1/4': 3, '1/2': 3 } },
  { size: '2"', capacity: { '1/4': 21, '1/2': 26 } },
  { size: '2-1/2"', capacity: { '1/4': 24, '1/2': 31 } },
  { size: '3"', capacity: { '1/8': 36, '1/4': 42, '1/2': 50 } },
  { size: '4"', capacity: { '1/8': 180, '1/4': 216, '1/2': 250 } },
  { size: '5"', capacity: { '1/8': 390, '1/4': 480, '1/2': 575 } },
  { size: '6"', capacity: { '1/8': 700, '1/4': 840, '1/2': 1000 } },
];

function drainageRow(fixtureUnits: number, slope: DrainSlope, includesWaterCloset: boolean): DrainageRow | undefined {
  return DRAINAGE_TABLE.find((row) => {
    const nominal = nominalSizeToInches(row.size);
    const capacity = row.capacity[slope];
    if (nominal === undefined || capacity === undefined) return false;
    if (includesWaterCloset && nominal < 3) return false;
    return fixtureUnits <= capacity;
  });
}

const VENT_PIPE_SIZES = ['1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '5"', '6"'];

function roundedVentSize(minimumInches: number): string | undefined {
  return VENT_PIPE_SIZES.find((size) => {
    const nominal = nominalSizeToInches(size);
    return nominal !== undefined && nominal >= minimumInches;
  });
}

function nextVentSize(size: string): string | undefined {
  const index = VENT_PIPE_SIZES.indexOf(size);
  return index >= 0 ? VENT_PIPE_SIZES[index + 1] : undefined;
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
  urinalStandard?: number;
  urinalLowFlow?: number;
}

const FIXTURE_UNITS: Record<keyof FixtureCounts, number> = {
  toilet: 3,
  lavatory: 1,
  bathtub: 2,
  shower: 2,
  kitchenSink: 2,
  dishwasher: 2,
  washingMachine: 2,
  urinalStandard: 4,
  urinalLowFlow: 2,
};

// ─── Gas Pipe Tables ─────────────────────────────────────────────────

// 2021 IFGC Table 402.4(1): natural gas, Schedule 40 metallic pipe, inlet
// pressure below 2 psi, 0.3 in. w.c. pressure drop, and 0.60 specific gravity.
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

function gasCapacityFor(size: string, length: number): number | undefined {
  const row = GAS_TABLE.find((r) => r.size === size);
  if (!row || length <= 0) return undefined;
  return row.capacities.find((entry) => length <= entry.len)?.cfh;
}

function gasPipeMatch(btuPerHour: number, length: number): { size: string; capacityBtuPerHour: number } | undefined {
  const cfh = btuPerHour / 1000; // rough: 1 CFH ≈ 1,000 BTU/hr
  for (const row of GAS_TABLE) {
    const capacityCfh = gasCapacityFor(row.size, length);
    if (capacityCfh !== undefined && capacityCfh >= cfh) {
      return { size: row.size, capacityBtuPerHour: capacityCfh * 1000 };
    }
  }
  return undefined;
}

// ─── Thermal Expansion ───────────────────────────────────────────────

const EXPANSION_COEFFICIENT: Record<PipeMaterial, number> = {
  copper: 9.4e-6,
  cpvc: 3.2e-5,
  pvc: 3.0e-5,
};

// ─── Calculator Engine ───────────────────────────────────────────────

export const PlumbingEngine = {
  pipeVelocity(inputs: { gpm: number; pipeSize: string; material?: PipeMaterial }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Pipe velocity');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    const spec = PIPE_MATERIAL_SPECS[material];
    const pipe = nominalToPipeSize(inputs.pipeSize, material);
    if (!pipe) errs.push(`Unsupported ${spec.label} size: ${String(inputs.pipeSize)}`);
    if (errs.length || !pipe) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const area = pipeArea(pipe.id);
    const velocity = inputs.gpm / (449 * area);
    const resultError = validateFiniteResult([area, velocity], 'Pipe velocity result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };
    const limit = 8;
    const passes = velocity <= limit;

    return {
      ok: true,
      message: passes
        ? `${fmt(velocity, 1)} ft/s velocity in ${pipe.nominal} ${spec.label}`
        : `${fmt(velocity, 1)} ft/s exceeds ${limit} ft/s typical limit. Increase pipe size.`,
      fields: [
        { label: 'Velocity', value: fmt(velocity, 1), unit: 'ft/s', emphasis: true },
        { label: 'Flow', value: fmt(inputs.gpm, 1), unit: 'GPM' },
        { label: 'Pipe size', value: `${pipe.nominal} ${spec.label}` },
        { label: 'Area', value: fmt(area, 4), unit: 'ft²' },
      ],
      details: [
        `${spec.label} ID = ${fmt(pipe.id, 3)} in`,
        `Area = π × (${pipe.id}"/2)² ÷ 144 = ${fmt(area, 4)} ft²`,
        `Velocity = ${fmt(inputs.gpm, 1)} GPM ÷ (449 × ${fmt(area, 4)}) = ${fmt(velocity, 1)} ft/s`,
        `Typical max velocity for water distribution ≈ ${limit} ft/s`,
      ],
    };
  },

  flowRate(inputs: { velocity: number; pipeSize: string; material?: PipeMaterial }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Flow rate');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.velocity, 'Velocity'),
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    const spec = PIPE_MATERIAL_SPECS[material];
    const pipe = nominalToPipeSize(inputs.pipeSize, material);
    if (!pipe) errs.push(`Unsupported ${spec.label} size: ${String(inputs.pipeSize)}`);
    if (errs.length || !pipe) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const area = pipeArea(pipe.id);
    const gpm = inputs.velocity * 449 * area;
    const resultError = validateFiniteResult([area, gpm], 'Flow rate result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

    return {
      ok: true,
      message: `${fmt(gpm, 1)} GPM in ${pipe.nominal} ${spec.label} at ${fmt(inputs.velocity, 1)} ft/s`,
      fields: [
        { label: 'Flow', value: fmt(gpm, 1), unit: 'GPM', emphasis: true },
        { label: 'Velocity', value: fmt(inputs.velocity, 1), unit: 'ft/s' },
        { label: 'Pipe size', value: `${pipe.nominal} ${spec.label}` },
      ],
      details: [
        `${spec.label} ID = ${fmt(pipe.id, 3)} in`,
        `Area = ${fmt(area, 4)} ft²`,
        `GPM = ${fmt(inputs.velocity, 1)} ft/s × 449 × ${fmt(area, 4)} = ${fmt(gpm, 1)} GPM`,
      ],
    };
  },

  pipeSizing(inputs: { gpm: number; maxVelocity: number; material?: PipeMaterial }): CalculationResult {
    if (!isInputRecord(inputs)) return invalidCalculationInputs('Pipe sizing');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
      validatePositive(inputs.maxVelocity, 'Maximum velocity'),
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    if (errs.length) return { value: 0, unit: '"', passes: false, message: errs.join('; '), details: [] };

    const spec = PIPE_MATERIAL_SPECS[material];
    const minArea = inputs.gpm / (449 * inputs.maxVelocity);
    const minAreaError = validateFiniteResult([minArea], 'Required pipe area');
    if (minAreaError) {
      return { value: 0, unit: 'in nominal', passes: false, message: minAreaError, details: [] };
    }
    const size = findPipeSize(minArea, material);
    if (!size) {
      const largestSize = spec.sizes[spec.sizes.length - 1]?.nominal ?? 'modeled';
      return {
        value: 0,
        unit: 'in nominal',
        passes: false,
        limit: inputs.maxVelocity,
        message: `Unsupported: required ${spec.label} size exceeds the ${largestSize} table limit.`,
        details: [
          `Required area = ${fmt(minArea, 4)} ft²`,
          'Use an engineered sizing method for a larger size or a different dimensional standard.',
        ],
      };
    }
    const actualVelocity = inputs.gpm / (449 * pipeArea(size.id));
    const velocityError = validateFiniteResult([actualVelocity], 'Selected-pipe velocity');
    if (velocityError) {
      return { value: 0, unit: 'in nominal', passes: false, message: velocityError, details: [] };
    }
    const nominal = nominalSizeToInches(size.nominal);
    if (nominal === undefined) {
      return { value: 0, unit: 'in nominal', passes: false, message: 'Unsupported nominal pipe size.', details: [] };
    }

    return {
      value: nominal,
      unit: 'in nominal',
      passes: true,
      limit: inputs.maxVelocity,
      message: `Minimum ${spec.label}: ${size.nominal} (≈ ${fmt(actualVelocity, 1)} ft/s)`,
      details: [
        `Required area = ${fmt(minArea, 4)} ft²`,
        `Selected ${size.nominal} ${spec.label} (ID ${fmt(size.id, 3)}")`,
        `Actual velocity ≈ ${fmt(actualVelocity, 1)} ft/s`,
      ],
    };
  },

  pressureDrop(inputs: { gpm: number; pipeSize: string; length: number; material?: PipeMaterial }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Pressure drop');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    const spec = PIPE_MATERIAL_SPECS[material];
    const pipe = nominalToPipeSize(inputs.pipeSize, material);
    if (!pipe) errs.push(`Unsupported ${spec.label} size: ${String(inputs.pipeSize)}`);
    if (errs.length || !pipe) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const c = spec.hazenWilliamsC;
    const psiPerFt = hazenWilliamsPsiPerFt(inputs.gpm, pipe.id, c);
    const total = psiPerFt * inputs.length;
    const velocity = inputs.gpm / (449 * pipeArea(pipe.id));
    const resultError = validateFiniteResult([psiPerFt, total, velocity], 'Pressure drop result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

    return {
      ok: true,
      message: `${fmt(total, 2)} psi total drop (${fmt(psiPerFt, 4)} psi/ft)`,
      fields: [
        { label: 'Pressure drop', value: fmt(total, 2), unit: 'psi', emphasis: true },
        { label: 'Per foot', value: fmt(psiPerFt, 4), unit: 'psi/ft' },
        { label: 'Velocity', value: fmt(velocity, 1), unit: 'ft/s' },
      ],
      details: [
        `Pipe: ${pipe.nominal} ${spec.label}, ID ${fmt(pipe.id, 3)} in (C=${c})`,
        `Hazen-Williams psi/ft = 4.52 × ${fmt(inputs.gpm, 1)}^1.852 ÷ (${c}^1.852 × ${fmt(pipe.id, 3)}^4.8704)`,
        `Total drop = ${fmt(psiPerFt, 4)} × ${fmt(inputs.length, 0)} ft = ${fmt(total, 2)} psi`,
      ],
    };
  },

  drainageSizing(inputs: {
    fixtureUnits: number;
    slope: DrainSlope;
    includesWaterCloset: boolean;
  }): CalculationResult {
    if (!isInputRecord(inputs)) return invalidCalculationInputs('Drainage sizing');
    const errs = [validatePositive(inputs.fixtureUnits, 'Fixture units')].filter(Boolean) as string[];
    if (!DRAIN_SLOPE_OPTIONS.includes(inputs.slope)) errs.push('Select a supported slope: 1/8, 1/4, or 1/2 inch per foot');
    if (typeof inputs.includesWaterCloset !== 'boolean') errs.push('Specify whether the drain serves a water closet');
    if (errs.length) return { value: 0, unit: 'in nominal', passes: false, message: errs.join('; '), details: [] };

    const row = drainageRow(inputs.fixtureUnits, inputs.slope, inputs.includesWaterCloset);
    if (!row) {
      return {
        value: 0,
        unit: 'in nominal',
        passes: false,
        message: 'Unsupported: load exceeds the 6" IPC table boundary for the selected slope.',
        details: [
          `Total drainage fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
          `Slope = ${inputs.slope} in/ft`,
          'Use the complete adopted-code table or an engineered design.',
        ],
      };
    }

    const nominal = nominalSizeToInches(row.size);
    const limit = row.capacity[inputs.slope];
    if (nominal === undefined || limit === undefined) {
      return { value: 0, unit: 'in nominal', passes: false, message: 'Unsupported IPC table combination.', details: [] };
    }

    return {
      value: nominal,
      unit: 'in nominal',
      passes: true,
      limit,
      message: `Minimum building drain: ${row.size}`,
      details: [
        `Total drainage fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
        `Slope = ${inputs.slope} in/ft`,
        `Selected table capacity = ${limit} DFU`,
        inputs.includesWaterCloset ? 'Applied 3" minimum for a drain serving a water closet.' : 'No water closet minimum applied.',
        '2021 IPC Table 710.1(1) basis; verify adopted-code amendments.',
      ],
    };
  },

  ventSizing(inputs: { drainSize: string; ventLength: number }): CalculationResult {
    if (!isInputRecord(inputs)) return invalidCalculationInputs('Vent sizing');
    const errs = [
      validatePositive(inputs.ventLength, 'Vent length'),
    ].filter(Boolean) as string[];
    const drainDiameter = nominalSizeToInches(inputs.drainSize);
    if (drainDiameter === undefined || !DRAIN_PIPE_SIZES.includes(inputs.drainSize)) {
      errs.push(`Unsupported drain size: ${inputs.drainSize}`);
    }
    if (errs.length) return { value: 0, unit: 'in nominal', passes: false, message: errs.join('; '), details: [] };

    const baseSize = roundedVentSize(Math.max(1.25, drainDiameter! / 2));
    const size = inputs.ventLength > 40 && baseSize ? nextVentSize(baseSize) : baseSize;
    if (!size) {
      return {
        value: 0,
        unit: 'in nominal',
        passes: false,
        message: 'Unsupported: required vent size exceeds the modeled nominal-size range.',
        details: ['Use the complete adopted-code vent table or an engineered design.'],
      };
    }

    const nominal = nominalSizeToInches(size);
    if (nominal === undefined) {
      return { value: 0, unit: 'in nominal', passes: false, message: 'Unsupported nominal vent size.', details: [] };
    }

    return {
      value: nominal,
      unit: 'in nominal',
      passes: true,
      limit: 40,
      message: `Minimum individual/branch vent: ${size}`,
      details: [
        `Drain served = ${inputs.drainSize}`,
        `Developed vent length = ${fmt(inputs.ventLength, 0)} ft`,
        `Base vent = at least one-half the drain diameter and not less than 1-1/4"`,
        inputs.ventLength > 40 ? 'Increased one nominal size because developed length exceeds 40 ft.' : 'No over-40-ft size increase required.',
        '2021 IPC Section 906.2 basis. Stack vents and vent stacks require Table 906.1 and are unsupported here.',
      ],
    };
  },

  waterHeater(inputs: {
    tankGallons: number;
    tempRise: number;
    inputBtu: number;
    efficiency: number;
  }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Water heater');
    const errs = [
      validatePositive(inputs.tankGallons, 'Tank size'),
      validatePositive(inputs.tempRise, 'Temperature rise'),
      validatePositive(inputs.inputBtu, 'Input BTU/hr'),
      validateRange(inputs.efficiency, 0.1, 1, 'Efficiency'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    // BTU/hr divided by BTU required per gallon gives gallons per hour.
    const recoveryGph = (inputs.inputBtu * inputs.efficiency) / (8.33 * inputs.tempRise);
    // First-hour rating: 70% of tank + recovery.
    const firstHour = inputs.tankGallons * 0.7 + recoveryGph;
    const resultError = validateFiniteResult([recoveryGph, firstHour], 'Water heater result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

    return {
      ok: true,
      message: `First-hour rating ≈ ${fmt(firstHour, 0)} gal`,
      fields: [
        { label: 'First hour', value: fmt(firstHour, 0), unit: 'gal', emphasis: true },
        { label: 'Recovery', value: fmt(recoveryGph, 1), unit: 'GPH', emphasis: true },
        { label: 'Tank', value: fmt(inputs.tankGallons, 0), unit: 'gal' },
      ],
      details: [
        `Recovery GPH = (${fmt(inputs.inputBtu, 0)} × ${fmt(inputs.efficiency, 2)}) ÷ (8.33 × ${fmt(inputs.tempRise, 0)})`,
        `First-hour rating = 0.7 × ${fmt(inputs.tankGallons, 0)} + ${fmt(recoveryGph, 1)} = ${fmt(firstHour, 0)} gal`,
      ],
    };
  },

  gasPipeSizing(inputs: { btuPerHour: number; length: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Gas pipe sizing');
    const errs = [
      validatePositive(inputs.btuPerHour, 'BTU/hr'),
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };
    if (inputs.length > 60) {
      return {
        ok: false,
        message: 'Unsupported: developed length exceeds the 60 ft gas table boundary.',
        fields: [],
        details: ['Use the adopted gas-code table for the full developed length and actual gas properties.'],
      };
    }

    const match = gasPipeMatch(inputs.btuPerHour, inputs.length);
    if (!match) {
      const largestCapacity = gasCapacityFor(GAS_TABLE[GAS_TABLE.length - 1].size, inputs.length);
      return {
        ok: false,
        message: 'Unsupported: load exceeds the largest pipe capacity in the gas table.',
        fields: [],
        details: [
          `Load = ${fmt(inputs.btuPerHour, 0)} BTU/hr`,
          largestCapacity === undefined
            ? 'No capacity is available for this developed length.'
            : `Largest modeled capacity = ${fmt(largestCapacity * 1000, 0)} BTU/hr`,
        ],
      };
    }

    return {
      ok: true,
      message: `Table 402.4(1) gas pipe: ${match.size}`,
      fields: [
        { label: 'Gas pipe', value: match.size, emphasis: true },
        { label: 'Load', value: fmt(inputs.btuPerHour, 0), unit: 'BTU/hr' },
        { label: 'Capacity', value: fmt(match.capacityBtuPerHour, 0), unit: 'BTU/hr' },
      ],
      details: [
        `Load = ${fmt(inputs.btuPerHour, 0)} BTU/hr`,
        `Length = ${fmt(inputs.length, 0)} ft`,
        `Conservative next-length table capacity ≈ ${fmt(match.capacityBtuPerHour, 0)} BTU/hr`,
        'Fixed table basis: natural gas, Schedule 40 metallic pipe, inlet below 2 psi, 0.3 in. w.c. pressure drop, and 0.60 specific gravity.',
        'BTU conversion assumes approximately 1,000 BTU/ft³. Length must follow the applicable longest-length or branch-length method.',
        'Use a different adopted-code table when any basis condition differs.',
      ],
    };
  },

  pumpHead(inputs: { staticLift: number; frictionPsi: number; pressurePsi: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Pump head');
    const errs = [
      validateNonNegative(inputs.staticLift, 'Static lift'),
      validateNonNegative(inputs.frictionPsi, 'Friction pressure'),
      validateNonNegative(inputs.pressurePsi, 'Pressure requirement'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const frictionFt = inputs.frictionPsi * 2.31;
    const pressureFt = inputs.pressurePsi * 2.31;
    const tdh = inputs.staticLift + frictionFt + pressureFt;
    const resultError = validateFiniteResult([frictionFt, pressureFt, tdh], 'Pump head result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

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

  pipeVolume(inputs: { pipeSize: string; length: number; material?: PipeMaterial }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Pipe volume');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.length, 'Length'),
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    const spec = PIPE_MATERIAL_SPECS[material];
    const pipe = nominalToPipeSize(inputs.pipeSize, material);
    if (!pipe) errs.push(`Unsupported ${spec.label} size: ${String(inputs.pipeSize)}`);
    if (errs.length || !pipe) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const gallons = Math.PI * Math.pow(pipe.id / 2, 2) * inputs.length * 7.48 / 144;
    const resultError = validateFiniteResult([gallons], 'Pipe volume result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

    return {
      ok: true,
      message: `${fmt(gallons, 1)} gallons in ${fmt(inputs.length, 0)} ft of ${pipe.nominal} ${spec.label}`,
      fields: [
        { label: 'Volume', value: fmt(gallons, 1), unit: 'gal', emphasis: true },
        { label: 'Length', value: fmt(inputs.length, 0), unit: 'ft' },
        { label: 'Pipe size', value: `${pipe.nominal} ${spec.label}` },
      ],
      details: [
        `${spec.label} ID = ${fmt(pipe.id, 3)} in`,
        `Area = π × (${pipe.id}"/2)² = ${fmt(Math.PI * Math.pow(pipe.id / 2, 2), 3)} in²`,
        `Volume = area × length × 7.48 gal/ft³ ÷ 144 = ${fmt(gallons, 1)} gal`,
      ],
    };
  },

  waterPressure(inputs: { head?: number; psi?: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Water pressure');
    const hasHead = typeof inputs.head === 'number';
    const hasPsi = typeof inputs.psi === 'number';

    if (!hasHead && !hasPsi) {
      return { ok: false, message: 'Enter head (ft) or pressure (psi) to convert.', fields: [], details: [] };
    }
    if (hasHead && hasPsi) {
      return { ok: false, message: 'Enter either head or pressure, not both.', fields: [], details: [] };
    }
    const value = hasHead ? inputs.head : inputs.psi;
    const error = validateNonNegative(value!, hasHead ? 'Head' : 'Pressure');
    if (error) return { ok: false, message: error, fields: [], details: [] };

    if (hasHead) {
      const psi = inputs.head! / 2.31;
      const resultError = validateFiniteResult([psi], 'Pressure conversion result');
      if (resultError) return { ok: false, message: resultError, fields: [], details: [] };
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
    const resultError = validateFiniteResult([head], 'Head conversion result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };
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
    if (!isInputRecord(inputs)) return invalidMetricInputs('Pipe expansion');
    const materialInput: unknown = inputs.material ?? 'copper';
    const errs = [
      validatePositive(inputs.length, 'Length'),
      Number.isFinite(inputs.deltaT) ? null : 'Temperature change must be a finite number',
    ].filter(Boolean) as string[];
    if (!isPipeMaterial(materialInput)) errs.push(`Unsupported material: ${String(materialInput)}`);
    const material = isPipeMaterial(materialInput) ? materialInput : 'copper';
    const pipe = nominalToPipeSize(inputs.pipeSize, material);
    if (!pipe) errs.push(`Unsupported ${pipeMaterialLabel(material)} size: ${String(inputs.pipeSize)}`);
    if (errs.length || !pipe) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const alpha = EXPANSION_COEFFICIENT[material];
    const deltaL = alpha * inputs.length * 12 * inputs.deltaT;
    const resultError = validateFiniteResult([deltaL], 'Pipe expansion result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };

    return {
      ok: true,
      message: `Expansion ≈ ${fmt(deltaL, 2)} in`,
      fields: [
        { label: 'Expansion', value: fmt(deltaL, 2), unit: 'in', emphasis: true },
        { label: 'Pipe', value: pipe.nominal },
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
    if (!isInputRecord(inputs)) return invalidMetricInputs('Fixture unit');
    let total = 0;
    const details: string[] = [];
    for (const key of Object.keys(FIXTURE_UNITS) as (keyof FixtureCounts)[]) {
      const rawCount: unknown = inputs[key];
      const count = rawCount === undefined ? 0 : typeof rawCount === 'number' ? rawCount : Number.NaN;
      const error = validateWholeNumber(count, 0, 1000, `${key} count`);
      if (error) return { ok: false, message: error, fields: [], details: [] };
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
      message: `Drainage fixture total = ${fmt(total, 1)} DFU`,
      fields: [
        { label: 'Fixture units', value: fmt(total, 1), emphasis: true },
      ],
      details: [
        ...details,
        '2021 IPC Table 709.1 selected fixture rows. Do not also count the same fixtures as a bathroom group.',
        'Use Drainage Sizing with slope and water-closet inputs for pipe size.',
      ],
    };
  },

  waterMeterSizing(inputs: { fixtureUnits: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Water meter sizing');
    const err = validatePositive(inputs.fixtureUnits, 'Fixture units');
    if (err) return { ok: false, message: err, fields: [], details: [] };
    return {
      ok: false,
      message: 'Unsupported: fixture units alone cannot determine a water meter size.',
      fields: [],
      details: [
        `Fixture units = ${fmt(inputs.fixtureUnits, 1)}`,
        'Required inputs include the serving utility meter table, available pressure, developed length, elevation, and design demand.',
      ],
    };
  },

  irrigationFlow(inputs: { heads: number; gpmPerHead: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Irrigation flow');
    const errs = [
      validateWholeNumber(inputs.heads, 1, 1000, 'Heads'),
      validatePositive(inputs.gpmPerHead, 'GPM per head'),
    ].filter(Boolean) as string[];
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    const total = inputs.heads * inputs.gpmPerHead;
    const resultError = validateFiniteResult([total], 'Irrigation flow result');
    if (resultError) return { ok: false, message: resultError, fields: [], details: [] };
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
    if (!isInputRecord(inputs)) return invalidMetricInputs('Septic tank');
    const dailyFlow = inputs.dailyFlowPerBedroom ?? 150;
    const errs = [
      validateWholeNumber(inputs.bedrooms, 1, 6, 'Bedrooms'),
      validateRange(dailyFlow, 50, 300, 'Flow per bedroom'),
    ].filter(Boolean) as string[];
    if (errs.length) {
      return {
        ok: false,
        message: errs.join('; '),
        fields: [],
        details: inputs.bedrooms > 6 ? ['Unsupported: local health-department sizing is required above six bedrooms.'] : [],
      };
    }

    const totalFlow = inputs.bedrooms * dailyFlow;
    let minGallons = 1000;
    if (inputs.bedrooms >= 4) minGallons = 1500;
    if (inputs.bedrooms >= 6) minGallons = 2000;
    const recommended = Math.max(minGallons, totalFlow * 2);

    return {
      ok: true,
      message: `Planning tank volume ≈ ${fmt(recommended, 0)} gal`,
      fields: [
        { label: 'Planning volume', value: fmt(recommended, 0), unit: 'gal', emphasis: true },
        { label: 'Daily flow', value: fmt(totalFlow, 0), unit: 'GPD' },
      ],
      details: [
        `Daily flow = ${inputs.bedrooms} bedrooms × ${dailyFlow} GPD = ${fmt(totalFlow, 0)} GPD`,
        `Generic planning floor = ${fmt(minGallons, 0)} gal`,
        'This is not a permit minimum. Select final tank capacity from the current state/local health-department rule and approved design.',
      ],
    };
  },

  greaseInterceptor(inputs: { fixtureUnits?: number; gpm?: number }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Grease interceptor');
    const hasFu = typeof inputs.fixtureUnits === 'number';
    const hasGpm = typeof inputs.gpm === 'number';
    if (!hasFu && !hasGpm) {
      return { ok: false, message: 'Enter fixture units or GPM to size interceptor.', fields: [], details: [] };
    }
    if (hasFu && hasGpm) {
      return { ok: false, message: 'Enter fixture units or GPM, not both.', fields: [], details: [] };
    }
    const inputValue = hasGpm ? inputs.gpm : inputs.fixtureUnits;
    const err = validatePositive(inputValue!, hasGpm ? 'Flow rate' : 'Fixture units');
    if (err) return { ok: false, message: err, fields: [], details: [] };
    return {
      ok: false,
      message: 'Unsupported: flow or fixture units alone cannot determine a compliant grease interceptor.',
      fields: [],
      details: [
        `${hasGpm ? 'Flow' : 'Fixture units'} = ${fmt(inputValue!, 1)}`,
        'Required inputs depend on the adopted sizing method and can include fixture dimensions, fill depth, drain time, storage period, and manufacturer rating.',
      ],
    };
  },

  backflowPressure(inputs: { gpm: number; type: BackflowType }): MetricResult {
    if (!isInputRecord(inputs)) return invalidMetricInputs('Backflow pressure');
    const errs = [
      validatePositive(inputs.gpm, 'Flow rate'),
    ].filter(Boolean) as string[];
    if (!(['PVB', 'DCV', 'RPZ'] as BackflowType[]).includes(inputs.type)) errs.push(`Unsupported device type: ${String(inputs.type)}`);
    if (errs.length) return { ok: false, message: errs.join('; '), fields: [], details: [] };

    return {
      ok: false,
      message: 'Unsupported: flow and device category alone cannot determine backflow pressure loss.',
      fields: [],
      details: [
        `Device type = ${inputs.type}`,
        `Flow = ${fmt(inputs.gpm, 1)} GPM`,
        'Required inputs include manufacturer, model, nominal size, and the certified pressure-loss curve for the selected assembly.',
      ],
    };
  },
};
