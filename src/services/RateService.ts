import { RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';

export type RateSlotType = 'morning' | 'afternoon' | 'night' | 'full_day';
export type RateRuleType = 'fixed_add' | 'percent_add' | 'fixed_override' | 'discount_fixed' | 'discount_percent';

export interface HallRateRuleInput {
  name: string;
  rule_type: RateRuleType;
  value: number;
  starts_on?: string | null;
  ends_on?: string | null;
  weekdays?: number[] | null;
  slot_types?: RateSlotType[] | null;
  priority?: number;
  is_active?: boolean;
  visibility?: 'internal' | 'customer_quote' | 'official';
  notes?: string | null;
}

export interface RatePreviewInput {
  hall_id: number;
  event_date: string;
  slot_type: RateSlotType;
  package_id?: number | null;
}

export interface RatePreview {
  hall_id: number;
  event_date: string;
  slot_type: RateSlotType;
  base_hall_rate: number;
  hall_rate: number;
  package_amount: number;
  total_amount: number;
  breakdown: Array<{
    label: string;
    amount: number;
    type: 'base' | 'rule' | 'package' | 'total';
    rule_type?: RateRuleType;
  }>;
  applied_rules: Array<{
    id: number;
    name: string;
    rule_type: RateRuleType;
    value: number;
    amount: number;
  }>;
}

const SLOT_TYPES: RateSlotType[] = ['morning', 'afternoon', 'night', 'full_day'];
const RULE_TYPES: RateRuleType[] = ['fixed_add', 'percent_add', 'fixed_override', 'discount_fixed', 'discount_percent'];

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toDateOnly = (value: string | Date): string => {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }
  return value.slice(0, 10);
};

const csvToNumbers = (value?: string | null): number[] =>
  (value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);

const csvToSlots = (value?: string | null): RateSlotType[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim() as RateSlotType)
    .filter((item) => SLOT_TYPES.includes(item));

const normalizeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export class RateService {
  async getHallRateSetup(hallId: number) {
    const tenantId = getTenantId();
    const hall = await this.getHall(tenantId, hallId);
    const [slotRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, slot_type, rate_amount, is_active
       FROM hall_slot_prices
       WHERE tenant_id = ? AND hall_id = ?
       ORDER BY FIELD(slot_type, 'morning', 'afternoon', 'night', 'full_day')`,
      [tenantId, hallId]
    );
    const [ruleRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, rule_type, value, DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on,
              DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on, weekdays, slot_types,
              priority, is_active, visibility, notes
       FROM hall_rate_rules
       WHERE tenant_id = ? AND hall_id = ?
       ORDER BY is_active DESC, priority ASC, id DESC`,
      [tenantId, hallId]
    );

    const explicit = new Map(slotRows.map((row: any) => [row.slot_type, row]));
    const slot_prices = SLOT_TYPES.map((slotType) => {
      const row = explicit.get(slotType) as any;
      return {
        id: row?.id || null,
        slot_type: slotType,
        rate_amount: row ? normalizeNumber(row.rate_amount) : normalizeNumber(hall.base_price),
        is_active: row ? Boolean(row.is_active) : true,
        inherited_from_base: !row,
      };
    });

    return {
      hall: {
        id: hall.id,
        name: hall.name,
        base_price: normalizeNumber(hall.base_price),
      },
      slot_prices,
      rules: ruleRows.map((row: any) => ({
        ...row,
        value: normalizeNumber(row.value),
        priority: Number(row.priority || 100),
        is_active: Boolean(row.is_active),
        weekdays: csvToNumbers(row.weekdays),
        slot_types: csvToSlots(row.slot_types),
      })),
    };
  }

  async upsertSlotPrices(hallId: number, prices: Array<{ slot_type: RateSlotType; rate_amount: number; is_active?: boolean }>) {
    const tenantId = getTenantId();
    await this.getHall(tenantId, hallId);

    for (const price of prices) {
      if (!SLOT_TYPES.includes(price.slot_type)) {
        throw new Error('Invalid slot type');
      }
      if (!Number.isFinite(Number(price.rate_amount)) || Number(price.rate_amount) < 0) {
        throw new Error('Rate amount must be zero or more');
      }
      await pool.execute(
        `INSERT INTO hall_slot_prices (tenant_id, hall_id, slot_type, rate_amount, is_active)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rate_amount = VALUES(rate_amount), is_active = VALUES(is_active), updated_at = NOW()`,
        [tenantId, hallId, price.slot_type, Number(price.rate_amount), price.is_active === false ? 0 : 1]
      );
    }

    return this.getHallRateSetup(hallId);
  }

  async createRule(hallId: number, input: HallRateRuleInput) {
    const tenantId = getTenantId();
    await this.getHall(tenantId, hallId);
    const rule = this.normalizeRuleInput(input);

    const [result] = await pool.execute<any>(
      `INSERT INTO hall_rate_rules
       (tenant_id, hall_id, name, rule_type, value, starts_on, ends_on, weekdays, slot_types, priority, is_active, visibility, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        hallId,
        rule.name,
        rule.rule_type,
        rule.value,
        rule.starts_on,
        rule.ends_on,
        rule.weekdays,
        rule.slot_types,
        rule.priority,
        rule.is_active,
        rule.visibility,
        rule.notes,
      ]
    );

    return result.insertId;
  }

  async updateRule(hallId: number, ruleId: number, input: HallRateRuleInput) {
    const tenantId = getTenantId();
    await this.getHall(tenantId, hallId);
    const rule = this.normalizeRuleInput(input);

    const [result] = await pool.execute<any>(
      `UPDATE hall_rate_rules
       SET name = ?, rule_type = ?, value = ?, starts_on = ?, ends_on = ?,
           weekdays = ?, slot_types = ?, priority = ?, is_active = ?, visibility = ?, notes = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ? AND hall_id = ?`,
      [
        rule.name,
        rule.rule_type,
        rule.value,
        rule.starts_on,
        rule.ends_on,
        rule.weekdays,
        rule.slot_types,
        rule.priority,
        rule.is_active,
        rule.visibility,
        rule.notes,
        ruleId,
        tenantId,
        hallId,
      ]
    );

    if (result.affectedRows !== 1) {
      throw new Error('Rate rule not found');
    }
  }

  async deleteRule(hallId: number, ruleId: number) {
    const tenantId = getTenantId();
    const [result] = await pool.execute<any>(
      'DELETE FROM hall_rate_rules WHERE id = ? AND tenant_id = ? AND hall_id = ?',
      [ruleId, tenantId, hallId]
    );
    if (result.affectedRows !== 1) {
      throw new Error('Rate rule not found');
    }
  }

  async preview(input: RatePreviewInput): Promise<RatePreview> {
    const tenantId = getTenantId();
    const eventDate = toDateOnly(input.event_date);
    const hall = await this.getHall(tenantId, input.hall_id);
    if (!SLOT_TYPES.includes(input.slot_type)) {
      throw new Error('Invalid slot type');
    }

    const baseHallRate = await this.getSlotBaseRate(tenantId, input.hall_id, input.slot_type, normalizeNumber(hall.base_price));
    const rules = await this.getMatchingRules(tenantId, input.hall_id, eventDate, input.slot_type);
    const breakdown: RatePreview['breakdown'] = [
      {
        label: 'Base hall rate',
        amount: baseHallRate,
        type: 'base',
      },
    ];
    const applied_rules: RatePreview['applied_rules'] = [];
    let hallRate = baseHallRate;

    for (const rule of rules) {
      const before = hallRate;
      let delta = 0;
      if (rule.rule_type === 'fixed_override') {
        hallRate = normalizeNumber(rule.value);
        delta = hallRate - before;
      } else if (rule.rule_type === 'fixed_add') {
        delta = normalizeNumber(rule.value);
        hallRate += delta;
      } else if (rule.rule_type === 'percent_add') {
        delta = roundMoney((hallRate * normalizeNumber(rule.value)) / 100);
        hallRate += delta;
      } else if (rule.rule_type === 'discount_fixed') {
        delta = -normalizeNumber(rule.value);
        hallRate += delta;
      } else if (rule.rule_type === 'discount_percent') {
        delta = -roundMoney((hallRate * normalizeNumber(rule.value)) / 100);
        hallRate += delta;
      }
      hallRate = Math.max(0, roundMoney(hallRate));
      breakdown.push({
        label: rule.name,
        amount: delta,
        type: 'rule',
        rule_type: rule.rule_type,
      });
      applied_rules.push({
        id: Number(rule.id),
        name: rule.name,
        rule_type: rule.rule_type,
        value: normalizeNumber(rule.value),
        amount: delta,
      });
    }

    const packageAmount = input.package_id
      ? await this.getPackageAmount(tenantId, Number(input.package_id), input.hall_id)
      : 0;
    if (packageAmount > 0) {
      breakdown.push({ label: 'Optional package', amount: packageAmount, type: 'package' });
    }

    const totalAmount = roundMoney(hallRate + packageAmount);
    breakdown.push({ label: 'Estimated booking total', amount: totalAmount, type: 'total' });

    return {
      hall_id: input.hall_id,
      event_date: eventDate,
      slot_type: input.slot_type,
      base_hall_rate: roundMoney(baseHallRate),
      hall_rate: roundMoney(hallRate),
      package_amount: roundMoney(packageAmount),
      total_amount: totalAmount,
      breakdown,
      applied_rules,
    };
  }

  private async getHall(tenantId: number, hallId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, base_price, status FROM halls WHERE id = ? AND tenant_id = ? LIMIT 1',
      [hallId, tenantId]
    );
    if (!rows.length) {
      throw new Error('Hall not found');
    }
    return rows[0] as any;
  }

  private async getSlotBaseRate(tenantId: number, hallId: number, slotType: RateSlotType, fallback: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rate_amount
       FROM hall_slot_prices
       WHERE tenant_id = ? AND hall_id = ? AND slot_type = ? AND is_active = TRUE
       LIMIT 1`,
      [tenantId, hallId, slotType]
    );
    return rows.length ? normalizeNumber(rows[0].rate_amount) : fallback;
  }

  private async getMatchingRules(tenantId: number, hallId: number, eventDate: string, slotType: RateSlotType) {
    const date = new Date(`${eventDate}T00:00:00`);
    const weekday = date.getDay();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, rule_type, value, weekdays, slot_types
       FROM hall_rate_rules
       WHERE tenant_id = ?
         AND hall_id = ?
         AND is_active = TRUE
         AND (starts_on IS NULL OR starts_on <= ?)
         AND (ends_on IS NULL OR ends_on >= ?)
       ORDER BY priority ASC, id ASC`,
      [tenantId, hallId, eventDate, eventDate]
    );

    return rows.filter((row: any) => {
      const weekdays = csvToNumbers(row.weekdays);
      const slots = csvToSlots(row.slot_types);
      const weekdayMatches = weekdays.length === 0 || weekdays.includes(weekday);
      const slotMatches = slots.length === 0 || slots.includes(slotType);
      return weekdayMatches && slotMatches;
    }) as any[];
  }

  private async getPackageAmount(tenantId: number, packageId: number, hallId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT base_price, hall_id, status
       FROM packages
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [packageId, tenantId]
    );
    const pkg = rows[0] as any;
    if (!pkg) {
      throw new Error('Package not found');
    }
    if (pkg.status !== 'active') {
      throw new Error('Package is not available');
    }
    if (pkg.hall_id && Number(pkg.hall_id) !== Number(hallId)) {
      throw new Error('Selected package is not available for this hall');
    }
    return normalizeNumber(pkg.base_price);
  }

  private normalizeRuleInput(input: HallRateRuleInput) {
    const name = String(input.name || '').trim();
    const ruleType = input.rule_type;
    const value = Number(input.value);
    if (!name) throw new Error('Rule name is required');
    if (!RULE_TYPES.includes(ruleType)) throw new Error('Invalid rate rule type');
    if (!Number.isFinite(value) || value < 0) throw new Error('Rule value must be zero or more');
    if ((ruleType === 'percent_add' || ruleType === 'discount_percent') && value > 100) {
      throw new Error('Percentage rules cannot exceed 100');
    }

    const startsOn = input.starts_on ? toDateOnly(input.starts_on) : null;
    const endsOn = input.ends_on ? toDateOnly(input.ends_on) : null;
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new Error('Rule end date must be after start date');
    }

    const weekdays = Array.isArray(input.weekdays)
      ? input.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
    const slotTypes = Array.isArray(input.slot_types)
      ? input.slot_types.filter((slotType) => SLOT_TYPES.includes(slotType))
      : [];

    return {
      name,
      rule_type: ruleType,
      value,
      starts_on: startsOn,
      ends_on: endsOn,
      weekdays: weekdays.length ? weekdays.join(',') : null,
      slot_types: slotTypes.length ? slotTypes.join(',') : null,
      priority: Number.isInteger(input.priority) ? Number(input.priority) : 100,
      is_active: input.is_active === false ? 0 : 1,
      visibility: input.visibility || 'internal',
      notes: input.notes?.trim() || null,
    };
  }

  private slotLabel(slotType: RateSlotType) {
    if (slotType === 'full_day') return 'Full day';
    return slotType.charAt(0).toUpperCase() + slotType.slice(1);
  }
}

export default new RateService();
