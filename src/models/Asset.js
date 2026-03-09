/**
 * EvoHub Asset Model - MongoDB Schema
 * Gene / Capsule / EvolutionEvent 完整定义
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Gene Schema（进化基因）
const GeneSchema = new Schema({
  // 信号匹配条件
  signals: [{
    type: String,
    required: true,
    trim: true
  }],
  
  // 匹配模式
  match_mode: {
    type: String,
    enum: ['all', 'any', 'exact'],
    default: 'all'
  },
  
  // 置信度阈值
  confidence_threshold: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  },
  
  // 优先级
  priority: {
    type: Number,
    min: 1,
    max: 100,
    default: 50
  },
  
  // 元数据
  metadata: {
    author: String,
    version: { type: String, default: '1.0.0' },
    tags: [String],
    category: String,
    description: String
  }
}, { _id: false });

// Capsule Schema（执行胶囊）
const CapsuleSchema = new Schema({
  // 执行命令
  commands: [{
    type: String,
    required: true,
    trim: true
  }],
  
  // 执行器类型
  executor: {
    type: String,
    enum: ['shell', 'node', 'python', 'docker', 'api'],
    default: 'shell'
  },
  
  // 前置条件
  preconditions: [{
    type: String,
    trim: true
  }],
  
  // 后置验证
  postconditions: [{
    type: String,
    trim: true
  }],
  
  // 约束条件
  constraints: {
    timeout: { type: Number, default: 180000 }, // 180s
    max_memory: { type: Number, default: 512 }, // MB
    max_cpu: { type: Number, default: 50 }, // %
    allow_network: { type: Boolean, default: false },
    allowed_commands: [String]
  },
  
  // 回滚命令
  rollback: [{
    type: String,
    trim: true
  }],
  
  // 环境要求
  env_requirements: {
    node_version: String,
    dependencies: [String],
    env_vars: Schema.Types.Mixed
  }
}, { _id: false });

// GDI 评分详情
const GDIBreakdownSchema = new Schema({
  quality: {
    score: { type: Number, min: 0, max: 1, default: 0 },
    dimension_scores: {
      structure: { type: Number, min: 0, max: 1 },
      clarity: { type: Number, min: 0, max: 1 },
      specificity: { type: Number, min: 0, max: 1 },
      strategy: { type: Number, min: 0, max: 1 },
      validation: { type: Number, min: 0, max: 1 },
      safety: { type: Number, min: 0, max: 1 }
    }
  },
  usage: {
    score: { type: Number, min: 0, max: 1, default: 0 },
    success_rate: { type: Number, min: 0, max: 1 },
    fetch_count: { type: Number, default: 0 }
  },
  social: {
    score: { type: Number, min: 0, max: 1, default: 0 },
    vote_score: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 }
  },
  freshness: {
    score: { type: Number, min: 0, max: 1, default: 1 },
    published_at: Date,
    last_used_at: Date
  }
}, { _id: false });

// 进化事件 Schema
const EvolutionEventSchema = new Schema({
  event_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  event_type: {
    type: String,
    enum: ['mutation', 'crossover', 'selection', 'extinction', 'promotion', 'quarantine'],
    required: true
  },
  
  // 关联资产
  asset_id: {
    type: String,
    required: true,
    index: true
  },
  
  // 父代资产（用于 crossover）
  parent_assets: [String],
  
  // 子代资产（用于 mutation）
  child_assets: [String],
  
  // 触发节点
  node_id: {
    type: String,
    required: true,
    index: true
  },
  
  // 事件详情
  details: {
    mutation_type: String,
    crossover_parents: [String],
    selection_criteria: String,
    extinction_reason: String,
    old_status: String,
    new_status: String
  },
  
  // 事件结果
  result: {
    success: Boolean,
    gdi_delta: Number,
    credits_delta: Number
  },
  
  // 时间戳
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 主 Asset Schema
const AssetSchema = new Schema({
  // 资产标识
  assetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 发布者节点
  nodeId: {
    type: String,
    required: true,
    index: true
  },
  
  // 核心数据
  gene: {
    type: GeneSchema,
    required: true
  },
  
  capsule: {
    type: CapsuleSchema,
    required: true
  },
  
  // 内容哈希（用于去重）
  contentHash: {
    type: String,
    required: true,
    index: true
  },
  
  // 元数据
  metadata: {
    title: String,
    description: String,
    category: String,
    tags: [String],
    author: String,
    version: { type: String, default: '1.0.0' },
    license: { type: String, default: 'MIT' },
    source_url: String,
    documentation: String
  },
  
  // GDI 评分
  gdi: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
    index: true
  },
  
  // GDI 详细分解
  gdiBreakdown: {
    type: GDIBreakdownSchema,
    default: () => ({})
  },
  
  // 自一致性评分
  consistencyScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  
  // 置信度级别
  confidenceLevel: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'low'
  },
  
  // 资产状态
  status: {
    type: String,
    enum: ['pending', 'candidate', 'promoted', 'quarantined', 'revoked', 'archived'],
    default: 'pending',
    index: true
  },
  
  // 推荐建议
  recommendation: {
    type: String,
    enum: ['promote', 'quarantine', 'revoke'],
    default: 'quarantine'
  },
  
  // 推荐理由
  recommendationReason: String,
  
  // 使用统计
  usageStats: {
    fetchCount: { type: Number, default: 0 },
    successReports: { type: Number, default: 0 },
    failureReports: { type: Number, default: 0 },
    totalReports: { type: Number, default: 0 },
    lastUsedAt: Date,
    avgExecutionTime: { type: Number, default: 0 } // ms
  },
  
  // 社交统计
  socialStats: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    voteScore: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // 撤销信息
  revokedAt: Date,
  revokeReason: String,
  revokedBy: String,
  
  // 审核信息
  reviewedAt: Date,
  reviewedBy: String,
  reviewNotes: String
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

// 复合索引
AssetSchema.index({ status: 1, gdi: -1 }); // 按状态和 GDI 排序
AssetSchema.index({ 'gene.signals': 1, status: 1 }); // 按信号和状态查询
AssetSchema.index({ 'metadata.category': 1, gdi: -1 }); // 按类别和 GDI 排序
AssetSchema.index({ nodeId: 1, createdAt: -1 }); // 查询用户的资产
AssetSchema.index({ contentHash: 1 }, { unique: true }); // 内容去重

// 实例方法

/**
 * 更新 GDI 评分
 */
AssetSchema.methods.updateGDI = function(gdiData) {
  this.gdi = gdiData.gdi_score || gdiData.score || 0;
  this.gdiBreakdown = {
    quality: { score: gdiData.breakdown?.quality || 0 },
    usage: { score: gdiData.breakdown?.usage || 0 },
    social: { score: gdiData.breakdown?.social || 0 },
    freshness: { score: gdiData.breakdown?.freshness || 1 }
  };
  this.consistencyScore = gdiData.consistency_score || 0;
  this.confidenceLevel = gdiData.confidence_level || 'low';
  this.recommendation = gdiData.recommendation || 'quarantine';
  this.recommendationReason = gdiData.reason || '';
  
  // 自动状态更新
  if (this.gdi >= 0.70) {
    this.status = 'promoted';
  } else if (this.gdi >= 0.50) {
    this.status = 'candidate';
  } else {
    this.status = 'quarantined';
  }
  
  return this.save();
};

/**
 * 记录使用
 */
AssetSchema.methods.recordUsage = function(success = true, executionTime = 0) {
  this.usageStats.fetchCount += 1;
  this.usageStats.totalReports += 1;
  this.usageStats.lastUsedAt = new Date();
  
  if (success) {
    this.usageStats.successReports += 1;
  } else {
    this.usageStats.failureReports += 1;
  }
  
  // 更新平均执行时间
  const oldAvg = this.usageStats.avgExecutionTime;
  const count = this.usageStats.totalReports;
  this.usageStats.avgExecutionTime = (oldAvg * (count - 1) + executionTime) / count;
  
  return this.save();
};

/**
 * 投票
 */
AssetSchema.methods.vote = function(isUpvote = true) {
  if (isUpvote) {
    this.socialStats.upvotes += 1;
  } else {
    this.socialStats.downvotes += 1;
  }
  
  // 计算投票分数 (-5 到 +5)
  const total = this.socialStats.upvotes + this.socialStats.downvotes;
  if (total > 0) {
    const ratio = this.socialStats.upvotes / total;
    this.socialStats.voteScore = (ratio * 10) - 5;
  }
  
  return this.save();
};

/**
 * 撤销资产
 */
AssetSchema.methods.revoke = function(reason, revokedBy) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokeReason = reason;
  this.revokedBy = revokedBy;
  return this.save();
};

// 静态方法

/**
 * 按 GDI 获取资产
 */
AssetSchema.statics.findByGDI = function(minGDI = 0, limit = 10, category = null) {
  const query = { 
    status: 'promoted',
    gdi: { $gte: minGDI }
  };
  
  if (category) {
    query['metadata.category'] = category;
  }
  
  return this.find(query)
    .sort({ gdi: -1, createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

/**
 * 按信号匹配资产
 */
AssetSchema.statics.findBySignals = function(signals, limit = 10) {
  return this.find({
    status: 'promoted',
    'gene.signals': { $in: signals }
  })
    .sort({ gdi: -1 })
    .limit(limit)
    .select('-__v');
};

/**
 * 获取热门资产
 */
AssetSchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'promoted' })
    .sort({ 'usageStats.fetchCount': -1 })
    .limit(limit)
    .select('-__v');
};

/**
 * 获取待审核资产
 */
AssetSchema.statics.findPending = function(limit = 50) {
  return this.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select('-__v');
};

// 创建模型
const Asset = mongoose.model('Asset', AssetSchema);
const EvolutionEvent = mongoose.model('EvolutionEvent', EvolutionEventSchema);

module.exports = {
  Asset,
  EvolutionEvent,
  GeneSchema,
  CapsuleSchema,
  GDIBreakdownSchema
};
