/**
 * GDI Scorer - 多维度 LLM 评审系统
 * GEP-A2A Protocol v1.0.0
 * 
 * GDI = Gene Delivery Index (0-100)
 * - 35% Quality (LLM 评审)
 * - 65% 规则计算 (Completeness + Uniqueness + Reusability + Provenance)
 */

const axios = require('axios');

// Quality 评审 Prompt (35%)
const QUALITY_PROMPT = `You are an expert evaluator for AI agent evolution assets (Gene+Capsule bundles).

Evaluate the following asset on 6 dimensions (each 0-100):

1. CLARITY (0-100): Is the problem statement clear? Is the solution well-explained?
2. CORRECTNESS (0-100): Is the technical approach sound? Are there obvious errors?
3. COMPLETENESS (0-100): Does it cover edge cases? Is the implementation complete?
4. REUSABILITY (0-100): Can other agents easily adapt this? Is it generalizable?
5. INNOVATION (0-100): Is this novel? Does it represent a genuine insight?
6. DOCUMENTATION (0-100): Are there clear examples, tests, or usage instructions?

Gene (Problem Context):
{{gene}}

Capsule (Solution):
{{capsule}}

Respond ONLY with a valid JSON object in this exact format:
{
  "scores": {
    "clarity": <0-100>,
    "correctness": <0-100>,
    "completeness": <0-100>,
    "reusability": <0-100>,
    "innovation": <0-100>,
    "documentation": <0-100>
  },
  "overall_quality": <0-100>,
  "reasoning": "Brief explanation of the scoring rationale",
  "suggestions": ["suggestion1", "suggestion2"]
}

Rules:
- Be critical but fair. Most assets should score 50-80.
- Only truly exceptional assets (production-ready, well-tested, novel) should score 90+.
- Assets with obvious errors or unclear explanations should score below 50.
- Output ONLY the JSON, no markdown, no explanation outside the JSON.`;

// GDI 计算权重
const WEIGHTS = {
  quality: 0.35,      // LLM 评审
  completeness: 0.15, // 完整性检查
  uniqueness: 0.15,   // 唯一性
  reusability: 0.20,  // 可复用性
  provenance: 0.15    // 来源可信度
};

class GDIScorer {
  constructor() {
    this.llmBaseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    this.llmApiKey = process.env.LLM_API_KEY;
    this.llmModel = process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  /**
   * 计算 GDI 总分
   */
  async score(gene, capsule, metadata = {}) {
    try {
      // 1. Quality Score (35%) - LLM 评审
      const qualityResult = await this.scoreQuality(gene, capsule);
      const qualityScore = qualityResult.overall;

      // 2. Completeness Score (15%) - 规则计算
      const completenessScore = this.scoreCompleteness(gene, capsule);

      // 3. Uniqueness Score (15%) - 规则计算
      const uniquenessScore = await this.scoreUniqueness(gene, capsule);

      // 4. Reusability Score (20%) - 规则计算
      const reusabilityScore = this.scoreReusability(gene, capsule, metadata);

      // 5. Provenance Score (15%) - 规则计算
      const provenanceScore = this.scoreProvenance(metadata);

      // 计算加权总分
      const finalScore = Math.round(
        qualityScore * WEIGHTS.quality +
        completenessScore * WEIGHTS.completeness +
        uniquenessScore * WEIGHTS.uniqueness +
        reusabilityScore * WEIGHTS.reusability +
        provenanceScore * WEIGHTS.provenance
      );

      return {
        score: Math.min(100, Math.max(0, finalScore)),
        breakdown: {
          quality: {
            weight: WEIGHTS.quality,
            score: qualityScore,
            weighted: Math.round(qualityScore * WEIGHTS.quality),
            details: qualityResult.details
          },
          completeness: {
            weight: WEIGHTS.completeness,
            score: completenessScore,
            weighted: Math.round(completenessScore * WEIGHTS.completeness)
          },
          uniqueness: {
            weight: WEIGHTS.uniqueness,
            score: uniquenessScore,
            weighted: Math.round(uniquenessScore * WEIGHTS.uniqueness)
          },
          reusability: {
            weight: WEIGHTS.reusability,
            score: reusabilityScore,
            weighted: Math.round(reusabilityScore * WEIGHTS.reusability)
          },
          provenance: {
            weight: WEIGHTS.provenance,
            score: provenanceScore,
            weighted: Math.round(provenanceScore * WEIGHTS.provenance)
          }
        },
        suggestions: qualityResult.suggestions || []
      };
    } catch (err) {
      console.error('GDI scoring error:', err);
      // Fallback: return medium score with warning
      return {
        score: 50,
        breakdown: {
          error: 'Scoring failed, using fallback',
          quality: { score: 50, weighted: 18 },
          completeness: { score: 50, weighted: 8 },
          uniqueness: { score: 50, weighted: 8 },
          reusability: { score: 50, weighted: 10 },
          provenance: { score: 50, weighted: 8 }
        },
        suggestions: ['Please retry scoring']
      };
    }
  }

  /**
   * Quality Score - LLM 评审 (35%)
   */
  async scoreQuality(gene, capsule) {
    if (!this.llmApiKey) {
      console.warn('⚠️ No LLM API key, using fallback quality scoring');
      return {
        overall: 60,
        details: { clarity: 60, correctness: 60, completeness: 60, reusability: 60, innovation: 60, documentation: 60 },
        suggestions: ['Configure LLM_API_KEY for better quality scoring']
      };
    }

    try {
      const prompt = QUALITY_PROMPT
        .replace('{{gene}}', JSON.stringify(gene, null, 2))
        .replace('{{capsule}}', JSON.stringify(capsule, null, 2));

      const response = await axios.post(
        `${this.llmBaseUrl}/chat/completions`,
        {
          model: this.llmModel,
          messages: [
            { role: 'system', content: 'You are an expert evaluator for AI agent evolution assets.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.llmApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0].message.content;
      const result = JSON.parse(content);

      // Calculate overall quality score
      const scores = result.scores || {};
      const overall = result.overall_quality || Math.round(
        (scores.clarity + scores.correctness + scores.completeness + 
         scores.reusability + scores.innovation + scores.documentation) / 6
      );

      return {
        overall: Math.min(100, Math.max(0, overall)),
        details: scores,
        reasoning: result.reasoning,
        suggestions: result.suggestions || []
      };
    } catch (err) {
      console.error('LLM quality scoring error:', err.message);
      // Fallback
      return {
        overall: 55,
        details: { clarity: 55, correctness: 55, completeness: 55, reusability: 55, innovation: 55, documentation: 55 },
        suggestions: ['LLM scoring failed, using fallback']
      };
    }
  }

  /**
   * Completeness Score (15%)
   * 检查 Gene 和 Capsule 的完整性
   */
  scoreCompleteness(gene, capsule) {
    let score = 50; // Base score
    
    // Gene checks
    if (gene) {
      if (gene.problem) score += 10;
      if (gene.signals && gene.signals.length > 0) score += 10;
      if (gene.context) score += 5;
    }
    
    // Capsule checks
    if (capsule) {
      if (capsule.solution) score += 10;
      if (capsule.code || capsule.implementation) score += 10;
      if (capsule.tests || capsule.validation) score += 5;
    }
    
    return Math.min(100, score);
  }

  /**
   * Uniqueness Score (15%)
   * 检查与现有资产的相似度
   */
  async scoreUniqueness(gene, capsule) {
    // TODO: Implement similarity check against existing assets
    // For now, return neutral score
    return 70;
  }

  /**
   * Reusability Score (20%)
   * 评估可复用性
   */
  scoreReusability(gene, capsule, metadata) {
    let score = 50; // Base score
    
    // Check for documentation
    if (metadata) {
      if (metadata.examples) score += 15;
      if (metadata.usage) score += 15;
      if (metadata.tags && metadata.tags.length > 0) score += 10;
    }
    
    // Check capsule structure
    if (capsule) {
      if (capsule.parameters || capsule.config) score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Provenance Score (15%)
   * 评估来源可信度
   */
  scoreProvenance(metadata) {
    let score = 50; // Base score
    
    if (metadata) {
      // Verified author
      if (metadata.author) score += 20;
      // Has version info
      if (metadata.version) score += 15;
      // Has source/reference
      if (metadata.source || metadata.reference) score += 15;
    }
    
    return Math.min(100, score);
  }
}

module.exports = new GDIScorer();
