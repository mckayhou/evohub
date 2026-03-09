/**
 * LLMRouter v2.5 - 生产级模型路由
 * 配置驱动 + 熔断 + 预算控制 + 结构化指标
 */

const axios = require('axios');
const redis = require('../utils/redisClient');
const logger = require('../utils/logger');
const { z } = require('zod');

// 配置驱动（支持无限扩展模型）
const MODEL_CONFIG = {
  'qwen3-coder-plus': {
    baseUrl: process.env.BAILIAN_BASE_URL || 'https://coding.dashscope.aliyuncs.com/v1',
    apiKey: process.env.BAILIAN_CODING_API_KEY,
    costPerM: 0.8,
    priority: 1,
    maxTokens: 950
  },
  'qwen3.5-plus': {
    baseUrl: process.env.BAILIAN_BASE_URL || 'https://coding.dashscope.aliyuncs.com/v1',
    apiKey: process.env.BAILIAN_CODING_API_KEY,
    costPerM: 1.2,
    priority: 2,
    maxTokens: 1200
  }
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;

class LLMRouter {
  constructor() {
    this.axiosInstances = {};
    this.circuitState = {};
    this.initAxiosInstances();
    this.startHealthCheck();
  }

  initAxiosInstances() {
    Object.keys(MODEL_CONFIG).forEach(model => {
      this.axiosInstances[model] = axios.create({
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }

  startHealthCheck() {
    setInterval(() => this.checkAllHealth(), 30000);
  }

  async checkAllHealth() {
    for (const model of Object.keys(MODEL_CONFIG)) {
      await this.getHealth(model);
    }
  }

  async getHealth(model) {
    const key = `llm:health:${model}`;
    const cached = await redis.get(key);
    if (cached) return parseFloat(cached);

    const state = this.circuitState[model] || { failCount: 0, isOpen: false };
    const health = state.isOpen ? 0.3 : (state.failCount < CIRCUIT_BREAKER_THRESHOLD ? 1.0 : 0.4);
    await redis.set(key, health, 'EX', 60);
    return health;
  }

  async selectModel(estimatedTokens, nodeCredit = Infinity, historicalConsistency = 0.8) {
    const estimatedCost = (estimatedTokens / 1e6) * MODEL_CONFIG[process.env.PRIMARY_MODEL].costPerM;

    if (nodeCredit < estimatedCost * 1.2) {
      logger.warn(`预算不足 ${estimatedCost.toFixed(5)} USD，强制降级`);
      return 'qwen3.5-plus';
    }

    const candidates = Object.keys(MODEL_CONFIG).sort((a, b) => 
      MODEL_CONFIG[a].priority - MODEL_CONFIG[b].priority
    );

    for (const model of candidates) {
      if (await this.getHealth(model) > 0.6) return model;
    }
    return process.env.FALLBACK_MODEL || 'qwen3.5-plus';
  }

  async call(prompt, options = {}) {
    let model = options.model || process.env.PRIMARY_MODEL;
    const estimatedTokens = (prompt.length / 4) * 2.5;

    if (!MODEL_CONFIG[model]) model = process.env.PRIMARY_MODEL;

    const state = this.circuitState[model] || { failCount: 0, isOpen: false };
    if (state.isOpen && Date.now() - state.lastFail < CIRCUIT_BREAKER_RESET_MS) {
      throw new Error(`模型 ${model} 已熔断`);
    }

    const instance = this.axiosInstances[model];
    const cfg = MODEL_CONFIG[model];

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await instance.post(`${cfg.baseUrl}/chat/completions`, {
          model,
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.3,
          max_tokens: options.max_tokens || cfg.maxTokens,
          response_format: { type: "json_object" }
        }, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` }
        });

        const schema = z.object({
          choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
          usage: z.object({ total_tokens: z.number() }).optional()
        });
        schema.parse(resp.data);

        this.circuitState[model] = { failCount: 0, isOpen: false };

        logger.metric('llm_call_success', { 
          model, 
          latency_ms: Date.now() - (options.startTime || Date.now()), 
          tokens: resp.data.usage?.total_tokens 
        });

        return resp.data;
      } catch (err) {
        this.circuitState[model] = this.circuitState[model] || { failCount: 0 };
        this.circuitState[model].failCount++;
        this.circuitState[model].lastFail = Date.now();
        if (this.circuitState[model].failCount >= CIRCUIT_BREAKER_THRESHOLD) {
          this.circuitState[model].isOpen = true;
          logger.error(`模型 ${model} 已熔断`);
        }

        logger.warn(`LLM ${model} 第 ${attempt} 次失败`, err.message);
        if (attempt === 3) throw err;

        await new Promise(r => setTimeout(r, 300 * attempt + Math.random() * 100));
      }
    }
  }
}

// Export class for testability and instance control
module.exports = LLMRouter;

// Default singleton instance for convenience
module.exports.defaultInstance = new LLMRouter();
