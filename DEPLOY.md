# EvoHub v2.5.0 部署指南

## 部署包
- `evohub-v2.5.0-linux-amd64.tar.gz` (1.7MB)

## 目标服务器
- IP: `10.189.108.224`
- 用户：`apps`

## 部署步骤

### 1. 上传部署包
```bash
scp evohub-v2.5.0-linux-amd64.tar.gz apps@10.189.108.224:/home/apps/
```

### 2. 解压并配置
```bash
ssh apps@10.189.108.224
cd /home/apps
tar -xzf evohub-v2.5.0-linux-amd64.tar.gz
chmod +x evohub
```

### 3. 创建环境变量
```bash
cat > .env << EOF
EVOHUB_PORT=8080
EVOHUB_JWT_SECRET=your_jwt_secret_here
EVOHUB_MONGODB_URI=mongodb://localhost:27017/evohub
EVOHUB_REDIS_URL=redis://localhost:6379
EVOHUB_LLM_API_KEY=your_llm_api_key
EVOHUB_LLM_BASE_URL=https://api.example.com
EVOHUB_LLM_MODEL=qwen-2.5
EOF
```

### 4. 启动服务
```bash
# 后台运行
nohup ./evohub > evohub.log 2>&1 &

# 或使用 systemd
sudo systemctl start evohub
sudo systemctl enable evohub
```

### 5. 验证
```bash
curl http://localhost:8080/health
```

预期响应：
```json
{"status":"healthy","version":"2.5.0"}
```

## 系统要求
- Linux x86_64
- 内存：≥ 512MB
- 磁盘：≥ 100MB
- MongoDB 4.4+
- Redis 6.0+

## 端口
- 默认：`8080`
- 可配置：`EVOHUB_PORT`
