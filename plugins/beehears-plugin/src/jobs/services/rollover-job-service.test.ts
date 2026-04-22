/**
 * 转结逻辑单元测试
 *
 * 测试四个核心场景，验证 carry-first 消费语义下的 nextCarry / carryAmount / quotaAfter 计算正确性。
 *
 * carry-first 规则：
 *   先扣 carry，再扣日配额
 *   场景1：used <= carry  → carry 剩余继承，日配额未动，无新增转入
 *   场景2：used >  carry  → carry 耗尽，日配额被消耗，日配额剩余转入
 *   场景3：used = 0       → carry 完整保留，日配额不叠加
 *   场景4：used >= carry + daily_quota → 全部耗尽，次日 carry = 0
 *
 * 运行方式：
 *   npx tsx src/jobs/services/rollover-job-service.test.ts
 */

import assert from 'node:assert/strict';
import { RolloverJobService } from './rollover-job-service.js';
import type {
  EnabledRolloverSubscriptionRow,
  InsertRolloverHistoryParams,
  RolloverJobServiceDependencies,
} from '../types/job-contract.js';
import type {
  RolloverHistoryRecord,
  SqlExecutor,
  Sub2ApiSubscription,
  SubscriptionExtensionRecord,
} from '../../api/types/subscription-contract.js';

// ─────────────────────────────────────────────
// 测试辅助工具
// ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
// Mock 工厂
// ─────────────────────────────────────────────

type CapturedHistory = InsertRolloverHistoryParams;
type CapturedCarry = { balanceCarry: number };
type CapturedBonus = { subscriptionId: number; bonusUsd: number };

function makeSubscription(daily_quota: number): Sub2ApiSubscription {
  return {
    id: 1,
    user_id: 10,
    plan_name: 'test-sub',
    platform: 'test',
    daily_quota,
    expires_at: '2099-12-31T00:00:00Z',
    current_used: 0,
  };
}

function makeExtension(balance_carry: number): SubscriptionExtensionRecord {
  return {
    id: 1,
    user_id: 10,
    sub2api_subscription_id: 1,
    balance_carry,
    reset_count_30d: 0,
    reset_window_start: new Date().toISOString(),
    reset_count_weekly: 0,
    reset_week_start: new Date().toISOString(),
    extra_days_deducted: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeDeps(opts: {
  carryOpen: number;
  daily_quota: number;
  yesterdayUsed: number;
}): {
  deps: RolloverJobServiceDependencies;
  capturedHistory: CapturedHistory[];
  capturedCarry: CapturedCarry[];
  capturedBonus: CapturedBonus[];
} {
  const capturedHistory: CapturedHistory[] = [];
  const capturedCarry: CapturedCarry[] = [];
  const capturedBonus: CapturedBonus[] = [];

  const enabledRow: EnabledRolloverSubscriptionRow = {
    user_id: 10,
    sub2api_subscription_id: 1,
  };

  const noopExecutor = {} as SqlExecutor;

  const deps: RolloverJobServiceDependencies = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    databaseClient: {
      query: async () => ({ rows: [], rowCount: 0 }),
      transaction: async (fn) => fn(noopExecutor),
    },
    sub2apiJobClient: {
      getServiceToken: () => 'svc-token',
      getRolloverSnapshotToken: () => 'snap-token',
      listSubscriptionsForJobs: async () => [makeSubscription(opts.daily_quota)],
      getUsageRolloverSnapshot: async () => new Map([[1, opts.yesterdayUsed]]),
    },
    rolloverJobRepo: {
      listEnabledSubscriptions: async () => [enabledRow],
      existsRolloverForDate: async () => false,
      replaceBalanceCarry: async (_tx, _uid, _sid, balanceCarry) => {
        capturedCarry.push({ balanceCarry });
        return makeExtension(balanceCarry);
      },
      insertHistory: async (_tx, params) => {
        capturedHistory.push({ ...params });
        return {
          rolled_at: new Date().toISOString(),
          quota_before: params.quotaBefore,
          carry_amount: params.carryAmount,
          quota_after: params.quotaAfter,
          bonus_injected: params.bonusInjected,
        } as RolloverHistoryRecord;
      },
      updateDailyBonusUsd: async (_tx, params) => {
        capturedBonus.push({ subscriptionId: params.subscriptionId, bonusUsd: params.bonusUsd });
      },
    },
    subscriptionExtensionRepo: {
      findOrCreateForUpdate: async () => makeExtension(opts.carryOpen),
    },
  };

  return { deps, capturedHistory, capturedCarry, capturedBonus };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

console.log('\n转结逻辑计算 (carry-first)\n');

// 场景 A：用量 < carry，carry 未耗尽，日配额未动
await test('场景A：used(30) < carry(35)，次日 carry = carry 剩余 5，无新增转入', async () => {
  const { deps, capturedHistory, capturedCarry, capturedBonus } = makeDeps({
    carryOpen: 35,
    daily_quota: 100,
    yesterdayUsed: 30,
  });
  const svc = new RolloverJobService(deps);
  const summary = await svc.run(new Date('2026-04-20T00:05:00+08:00'));

  assert.equal(summary.successCount, 1, 'successCount 应为 1');

  const carry = capturedCarry[0];
  assert.equal(carry.balanceCarry, 5, 'nextCarry 应为 5（carry 剩余）');

  const history = capturedHistory[0];
  assert.equal(history.quotaBefore, 35, 'quotaBefore 应为 carryOpen=35');
  assert.equal(history.carryAmount, 0,  'carryAmount 应为 0（日配额未动）');
  assert.equal(history.quotaAfter,  105, 'quotaAfter 应为 100+5=105');
  assert.equal(history.bonusInjected, 5, 'bonusInjected 应为 5');
  assert.equal(capturedBonus[0].bonusUsd, 5, 'bonus 应注入 5');
});

// 场景 B：用量 > carry，carry 耗尽，日配额被消耗
await test('场景B：used(50) > carry(35)，次日 carry = 日配额剩余 85', async () => {
  const { deps, capturedHistory, capturedCarry } = makeDeps({
    carryOpen: 35,
    daily_quota: 100,
    yesterdayUsed: 50,
  });
  const svc = new RolloverJobService(deps);
  await svc.run(new Date('2026-04-20T00:05:00+08:00'));

  const carry = capturedCarry[0];
  assert.equal(carry.balanceCarry, 85, 'nextCarry 应为 85（日配额剩余）');

  const history = capturedHistory[0];
  assert.equal(history.quotaBefore,  35, 'quotaBefore 应为 carryOpen=35');
  assert.equal(history.carryAmount,  85, 'carryAmount 应为 85（日配额转入）');
  assert.equal(history.quotaAfter,  185, 'quotaAfter 应为 100+85=185');
  assert.equal(history.bonusInjected, 85, 'bonusInjected 应为 85');
});

// 场景 C：用量 = 0，carry 完整保留，日配额不叠加
await test('场景C：used=0，carry(35) 完整保留，日配额不叠加', async () => {
  const { deps, capturedHistory, capturedCarry } = makeDeps({
    carryOpen: 35,
    daily_quota: 100,
    yesterdayUsed: 0,
  });
  const svc = new RolloverJobService(deps);
  await svc.run(new Date('2026-04-20T00:05:00+08:00'));

  const carry = capturedCarry[0];
  assert.equal(carry.balanceCarry, 35, 'nextCarry 应为 35（carry 完整保留）');

  const history = capturedHistory[0];
  assert.equal(history.quotaBefore,  35, 'quotaBefore 应为 35');
  assert.equal(history.carryAmount,   0, 'carryAmount 应为 0（日配额未动）');
  assert.equal(history.quotaAfter,  135, 'quotaAfter 应为 100+35=135');
  assert.equal(history.bonusInjected, 35, 'bonusInjected 应为 35');
});

// 场景 D：用量耗尽全部（carry + daily_quota），次日 carry = 0
await test('场景D：used(135) >= carry(35)+daily_quota(100)，次日 carry = 0', async () => {
  const { deps, capturedHistory, capturedCarry } = makeDeps({
    carryOpen: 35,
    daily_quota: 100,
    yesterdayUsed: 135,
  });
  const svc = new RolloverJobService(deps);
  await svc.run(new Date('2026-04-20T00:05:00+08:00'));

  const carry = capturedCarry[0];
  assert.equal(carry.balanceCarry, 0, 'nextCarry 应为 0（全部耗尽）');

  const history = capturedHistory[0];
  assert.equal(history.quotaBefore, 35, 'quotaBefore 应为 35');
  assert.equal(history.carryAmount,  0, 'carryAmount 应为 0（日配额也耗尽）');
  assert.equal(history.quotaAfter,  100, 'quotaAfter 应为 100+0=100');
  assert.equal(history.bonusInjected, 0, 'bonusInjected 应为 0');
});

// ─────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────

console.log(`\n${passed + failed} 个测试，${passed} 通过，${failed} 失败\n`);
if (failed > 0) process.exit(1);
