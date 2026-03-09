/**
 * GDI Service v2.5 - Self-Consistency + 加权聚合
 * 百炼 Coding Plan 国内模型专用
 */

const llmRouter = require('../core/LLMRouter');
const redis = require('../utils/redisClient');
const logger = require('../utils/logger');
const { z } = require('zod');

const SELF_CONSISTENCY_N = parseInt(process.env.SELF_CONSISTENCY_N || '3');

const QUALITY_PROMPT_V2_1 = `
你是 EvoMap 官方 GDI 评审官（Intrinsic Quality 维度，权重 35%）。

【核心指令】
请使用 Self-Consistency 思维：先独立思考 3 次不同路径，再综合得出最一致、最可靠的评分。

【评审维度 & 严格 Rubric】
1. 结构完整性 (25%)：完全符合 GEP v1.0.0？Gene+Capsule 成对？asset_id 正确？信封完整？
2. 语义清晰度 (20%)：summary、validate commands 是否精确、无歧义、可直接复制执行？
3. 信号特异性 (20%)：signals_match 是否精准（而非泛化）？
4. 策略质量 (15%)：preconditions/constraints/code_diff 是否优雅、高效、可复用？
5. 验证强度 (10%)：outcome、confidence、blast_radius、env_fingerprint 是否真实、多环境、可复现？
6. 安全性 (10%)：无危险命令？仅白名单（node/npm/npx）？180s 超时保护？

【评分规则】
- 必须使用 Chain-of-Thought：先逐维度思考，再给出分数。
- 最终 quality_score = 加权平均（保留 3 位小数）。
- recommendation 只能是 "promote" / "quarantine" / "revoke"。

【输出要求】
必须是纯 JSON（不要任何额外文字、markdown、解释）：
{
  "quality_score": 0.923,
  "dimension_scores": {
    "structure": 0.98,
    "clarity": 0.95,
    "specificity": 0.92,
    "strategy": 0.88,
    "validation": 0.90,
    "safety": 1.00
  },
  "recommendation": "promote",
  "reason": "结构完整、信号精准、验证充分、安全性完美"
}

现在开始评审以下 bundle：
`;

const QualitySchema = z.object({
  quality_score: z.number().min(0).max(1),
  dimension_scores: z.record(z.string(), z.number()),
  recommendation: z.enum(['promote', 'quarantine', 'revoke']),
  reason: z.string()
});

async function calculateIntrinsicQuality(assetsBundle, assetId) {
  const cacheKey = `gdi:quality:${assetId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    logger.debug(`Quality Self-Consistency 缓存命中 ${assetId}`);
    return JSON.parse(cached);
  }

  const fullPrompt = QUALITY_PROMPT_V2_1 + JSON.stringify(assetsBundle, null, 2);
  const estimatedTokens = (fullPrompt.length / 4) * 2.5;

  const selectedModel = await llmRouter.selectModel(estimatedTokens, Infinity, 0.8);

  const results = await Promise.allSettled(
    Array.from({ length: SELF_CONSISTENCY_N }, (_, i) => 
      callLLMSample(fullPrompt, selectedModel, i + 1)
    )
  );

  const validResults = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (validResults.length === 0) {
    return fallbackResult();
  }

  const aggregated = aggregateSelfConsistency(validResults);
  await redis.set(cacheKey, JSON.stringify(aggregated), 'EX', 7 * 24 * 3600);

  logger.info(`Self-Consistency 完成 ${assetId} | N=${SELF_CONSISTENCY_N} | consistency=${aggregated.consistency_score.toFixed(2)} | confidence=${aggregated.confidence_level}`);
  return aggregated;
}

async function callLLMSample(prompt, model, sampleId) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await llmRouter.call(prompt, { model, startTime: Date.now() });
      const raw = JSON.parse(resp.choices[0].message.content);
      const parsed = QualitySchema.parse(raw);
      parsed.tokenUsed = resp.usage?.total_tokens || 0;
      return parsed;
    } catch (e) {
      logger.warn(`Sample ${sampleId} 第 ${attempt} 次失败`, e.message);
      if (attempt === 2) return null;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

function aggregateSelfConsistency(results) {
  const validResults = results.filter(r => r && typeof r.quality_score === 'number');
  if (validResults.length === 0) {
    return fallbackResult();
  }

  const sortedQuality = validResults.map(r => r.quality_score).sort((a, b) => a - b);
  const trimCount = Math.floor(sortedQuality.length * 0.2);
  const trimmed = sortedQuality.slice(trimCount, sortedQuality.length - trimCount);
  const quality_score = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;

  const voteMap = {};
  let totalWeight = 0;
  validResults.forEach(r => {
    const weight = r.quality_score;
    voteMap[r.recommendation] = (voteMap[r.recommendation] || 0) + weight;
    totalWeight += weight;
  });
  const recommendation = Object.entries(voteMap).reduce((a, b) => b[1] > a[1] ? b : a)[0];

  const voteProportions = Object.values(voteMap).map(v => v / totalWeight);
  const entropy = calculateShannonEntropy(voteProportions);
  const normalizedEntropy = entropy / Math.log2(voteProportions.length || 1);
  const stdDev = calculateStdDev(validResults.map(r => r.quality_score));
  const normalizedStd = Math.min(stdDev / 0.3, 1);
  const agreementRatio = voteMap[recommendation] / totalWeight;

  const consistency_score = 
    (1 - normalizedEntropy) * 0.5 +
    (1 - normalizedStd) * 0.3 +
    agreementRatio * 0.2;

  const confidence_level = consistency_score > 0.85 ? 'high' 
                         : consistency_score > 0.65 ? 'medium' : 'low';

  const dimension_scores = {};
  const allDims = Object.keys(validResults[0].dimension_scores || {});
  allDims.forEach(dim => {
    dimension_scores[dim] = validResults.reduce((sum, r) => sum + (r.dimension_scores?.[dim] || 0), 0) / validResults.length;
  });

  return {
    quality_score: Number(quality_score.toFixed(3)),
    dimension_scores,
    recommendation,
    reason: validResults[0].reason || 'Self-Consistency 加权聚合结果',
    consistency_score: Number(consistency_score.toFixed(3)),
    confidence_level,
    sample_count: validResults.length,
    total_samples: results.length
  };
}

function calculateShannonEntropy(proportions) {
  return -proportions.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
}

function calculateStdDev(numbers) {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

function fallbackResult() {
  return {
    quality_score: 0.60,
    dimension_scores: {},
    recommendation: 'quarantine',
    reason: 'Self-Consistency 全部失败，回退默认值',
    consistency_score: 0,
    confidence_level: 'low'
  };
}

function calculateUsageScore(asset) {
  const successRate = asset.total_reports > 0 ? asset.success_reports / asset.total_reports : 0.5;
  return successRate * 0.6 + Math.min(asset.fetch_count / 1000, 1) * 0.4;
}

function calculateSocialScore(asset) {
  return Math.max(0, Math.min(1, (asset.vote_score + 5) / 10));
}

function calculateFreshnessScore(publishedAt) {
  const days = (Date.now() - new Date(publishedAt)) / 86400000;
  return Math.max(0.1, Math.exp(-days / 30));
}

// Rules-based scoring (65% of GDI v2.5)
const RULES_WEIGHT = 0.65;
const QUALITY_WEIGHT = 0.35;

// Rule definitions with weights
const RULES = {
  // Structure rules (25% of rules)
  structure: {
    weight: 0.25,
    checks: [
      { name: 'has_asset_id', check: (a) => !!a.asset_id && a.asset_id.length > 10, score: 0.3 },
      { name: 'valid_type', check: (a) => ['Gene', 'Capsule', 'EvolutionEvent'].includes(a.type), score: 0.3 },
      { name: 'has_version', check: (a) => !!a.version && /^\d+\.\d+\.\d+/.test(a.version), score: 0.2 },
      { name: 'has_signals', check: (a) => Array.isArray(a.signals_match) && a.signals_match.length > 0, score: 0.2 }
    ]
  },
  // Safety rules (25% of rules)
  safety: {
    weight: 0.25,
    checks: [
      { name: 'no_dangerous_commands', check: (a) => {
        const dangerous = ['rm -rf /', 'dd if=', 'mkfs', ':(){ :|:& };:'];
        const code = (a.code_diff || '') + (a.validate_commands?.join(' ') || '');
        return !dangerous.some(d => code.includes(d));
      }, score: 0.4 },
      { name: 'whitelist_commands', check: (a) => {
        const whitelist = ['npm', 'node', 'npx', 'yarn', 'pnpm', 'git', 'docker'];
        const commands = a.validate_commands || [];
        return commands.every(cmd => whitelist.some(w => cmd.startsWith(w)));
      }, score: 0.3 },
      { name: 'timeout_protection', check: (a) => {
        const constraints = a.constraints || {};
        return constraints.timeout && constraints.timeout <= 180000;
      }, score: 0.3 }
    ]
  },
  // Quality rules (20% of rules)
  quality: {
    weight: 0.20,
    checks: [
      { name: 'has_summary', check: (a) => !!a.summary && a.summary.length >= 20, score: 0.3 },
      { name: 'has_code_diff', check: (a) => !!a.code_diff && a.code_diff.length >= 50, score: 0.4 },
      { name: 'has_validate_commands', check: (a) => Array.isArray(a.validate_commands) && a.validate_commands.length > 0, score: 0.3 }
    ]
  },
  // Completeness rules (15% of rules)
  completeness: {
    weight: 0.15,
    checks: [
      { name: 'has_preconditions', check: (a) => Array.isArray(a.preconditions) && a.preconditions.length > 0, score: 0.4 },
      { name: 'has_constraints', check: (a) => !!a.constraints && Object.keys(a.constraints).length > 0, score: 0.3 },
      { name: 'detailed_signals', check: (a) => a.signals_match?.every(s => s.length >= 3), score: 0.3 }
    ]
  },
  // Best practices (15% of rules)
  best_practices: {
    weight: 0.15,
    checks: [
      { name: 'semantic_versioning', check: (a) => /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(a.version), score: 0.4 },
      { name: 'id_format', check: (a) => /^[a-z][a-z0-9_]*$/.test(a.asset_id.split('_')[0]), score: 0.3 },
      { name: 'code_comments', check: (a) => (a.code_diff || '').includes('//') || (a.code_diff || '').includes('/*'), score: 0.3 }
    ]
  }
};

function calculateRulesScore(asset) {
  let totalScore = 0;
  let totalWeight = 0;
  const ruleBreakdown = {};

  for (const [category, config] of Object.entries(RULES)) {
    let categoryScore = 0;
    let categoryMax = 0;
    const categoryChecks = {};

    for (const rule of config.checks) {
      const passed = rule.check(asset);
      const score = passed ? rule.score : 0;
      categoryScore += score;
      categoryMax += rule.score;
      categoryChecks[rule.name] = { passed, score, max: rule.score };
    }

    const normalizedScore = categoryMax > 0 ? categoryScore / categoryMax : 0;
    totalScore += normalizedScore * config.weight;
    totalWeight += config.weight;
    ruleBreakdown[category] = {
      score: Number(normalizedScore.toFixed(3)),
      weight: config.weight,
      checks: categoryChecks
    };
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  
  return {
    rules_score: Number(finalScore.toFixed(3)),
    breakdown: ruleBreakdown
  };
}

async function calculateGDI(asset) {
  // Calculate both scores in parallel
  const [q, r] = await Promise.all([
    calculateIntrinsicQuality([asset], asset.asset_id),
    calculateRulesScore(asset)
  ]);
  
  const u = calculateUsageScore(asset);
  const s = calculateSocialScore(asset);
  const f = calculateFreshnessScore(asset.published_at);

  // Combined score: Quality 35% + Rules 65%
  const combinedQuality = QUALITY_WEIGHT * q.quality_score + RULES_WEIGHT * r.rules_score;
  
  // Final GDI with Usage/Social/Freshness
  const gdi = 0.35 * combinedQuality + 0.30 * u + 0.20 * s + 0.15 * f;

  asset.quality_score = q.quality_score;
  asset.rules_score = r.rules_score;
  asset.combined_quality = combinedQuality;
  asset.usage_score = u;
  asset.social_score = s;
  asset.freshness_score = f;
  asset.gdi_score = Math.min(1, Math.max(0, gdi.toFixed(3)));
  asset.status = asset.gdi_score >= 0.70 ? 'promoted' 
                : asset.gdi_score >= 0.50 ? 'candidate' 
                : 'quarantined';
  asset.gdi_breakdown = {
    llm_quality: q.quality_score,
    rules_based: r.rules_score,
    combined_quality: combinedQuality,
    usage: u,
    social: s,
    freshness: f,
    rules_detail: r.breakdown
  };

  logger.info(`GDI v2.5 计算完成 ${asset.asset_id} → ${asset.gdi_score} [${asset.status}] | LLM:${q.quality_score.toFixed(2)} Rules:${r.rules_score.toFixed(2)}`);
  return {
    gdi_score: asset.gdi_score,
    breakdown: asset.gdi_breakdown,
    recommendation: q.recommendation,
    reason: q.reason,
    consistency_score: q.consistency_score,
    confidence_level: q.confidence_level
  };
}

module.exports = { calculateGDI, calculateIntrinsicQuality };
