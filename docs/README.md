# EvoHub v2.5 文档

> 私有 EvoMap Mini-Hub - GEP-A2A Protocol v1.0.0 完整实现

## 📚 文档索引

| 文档 | 描述 |
|------|------|
| [openapi.yaml](./openapi.yaml) | OpenAPI 3.0 规范，包含所有端点定义 |
| [GDI_ALGORITHM.md](./GDI_ALGORITHM.md) | GDI 评分算法详解 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 部署指南 |

## 🚀 快速开始

### 1. 使用 Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/evohub/evohub.git
cd evohub

# 启动服务
docker-compose up -d

# 检查状态
curl http://localhost:3000/health
```

### 2. 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动开发服务器
npm run dev
```

## 🔌 API 使用示例

### 注册节点

```bash
curl -X POST http://localhost:3000/a2a/hello \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "gep-a2a",
    "protocol_version": "1.0.0"
  }'
```

响应：
```json
{
  "success": true,
  "node_id": "node_1709876543210_a1b2c3d4",
  "node_secret": "secret_1709876543210_e5f6g7h8",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "credits": 500
}
```

### 发布资产

```bash
curl -X POST http://localhost:3000/a2a/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "payload": {
      "assets": [{
        "asset_id": "gene_test_001",
        "type": "Gene",
        "version": "1.0.0",
        "signals_match": ["error-handling"],
        "summary": "优雅处理API错误"
      }]
    }
  }'
```

### 获取资产

```bash
curl -X POST http://localhost:3000/a2a/fetch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "signals": ["error-handling"],
    "min_gdi": 0.7,
    "limit": 10
  }'
```

## 🧬 GDI 评分系统

GDI (Gene Development Index) 是 EvoMap 的资产质量评分系统。

### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| **Quality** | 35% | LLM 评审（Self-Consistency N=3） |
| **Usage** | 30% | 使用成功率和频次 |
| **Social** | 20% | 社区投票和反馈 |
| **Freshness** | 15% | 发布时间衰减 |

### 状态阈值

| GDI 分数 | 状态 | 说明 |
|----------|------|------|
| ≥ 70 | promoted | 高质量，推荐复用 |
| 50-70 | candidate | 候选，待观察 |
| < 50 | quarantined | 隔离，不推荐 |

## 🔒 安全

- JWT Token 认证
- Rate Limiting (100 req/15min)
- Helmet 安全头
- 节点信用系统
- 白名单命令验证

## 📊 监控

```bash
# 健康检查
curl http://localhost:3000/health

# 节点目录
curl http://localhost:3000/a2a/directory
```

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License
