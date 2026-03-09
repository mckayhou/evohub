#!/bin/bash
#
# EvoHub v2.5 - One-Click Installer
# Usage: curl -sSL https://raw.githubusercontent.com/evohub/evohub/main/install.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/evohub/evohub.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/evohub}"
VERSION="2.5.0"

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "检查系统环境..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    
    # Check Docker
    if ! command_exists docker; then
        log_error "Docker 未安装"
        echo "请安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose 未安装"
        echo "请安装 Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check ports
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warn "端口 3000 已被占用"
        read -p "是否继续? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "环境检查通过"
}

# Download EvoHub
download_evohub() {
    log_info "下载 EvoHub v${VERSION}..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "目录 $INSTALL_DIR 已存在"
        read -p "是否覆盖? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_info "使用现有目录"
            return
        fi
    fi
    
    # Clone repository
    if command_exists git; then
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    else
        # Fallback: download zip
        log_info "使用 ZIP 下载..."
        curl -L "${REPO_URL%.git}/archive/refs/heads/main.zip" -o /tmp/evohub.zip
        unzip -q /tmp/evohub.zip -d /tmp/
        mv /tmp/evohub-main "$INSTALL_DIR"
        rm /tmp/evohub.zip
    fi
    
    cd "$INSTALL_DIR"
    log_success "下载完成"
}

# Configure environment
configure_env() {
    log_info "配置环境..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    # Create .env file
    cat > .env <<EOF
# EvoHub Configuration
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://mongo:27017/evohub
REDIS_URI=redis://redis:6379

# Security
JWT_SECRET=${JWT_SECRET}

# LLM Configuration (optional)
# LLM_API_KEY=your_api_key_here
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_MODEL=gpt-4o-mini

# GDI Settings
SELF_CONSISTENCY_N=3

# Rewards
INITIAL_CREDITS=500
PUBLISH_CREDIT_REWARD=100
VALIDATION_CREDIT_REWARD=20
EOF
    
    log_success "环境配置完成"
}

# Start services
start_services() {
    log_info "启动 EvoHub 服务..."
    
    # Pull images
    docker-compose pull
    
    # Build and start
    docker-compose up -d --build
    
    # Wait for services
    log_info "等待服务启动..."
    sleep 10
    
    # Health check
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            log_success "EvoHub 服务已启动"
            return 0
        fi
        
        retries=$((retries + 1))
        echo -n "."
        sleep 2
    done
    
    log_error "服务启动超时"
    echo "请检查日志: docker-compose logs"
    return 1
}

# Display success message
show_success() {
    echo
    echo "========================================"
    echo -e "${GREEN}🎉 EvoHub v${VERSION} 安装成功!${NC}"
    echo "========================================"
    echo
    echo "📡 API 地址: http://localhost:3000"
    echo "🌐 Web 面板: http://localhost:3001"
    echo "📁 安装目录: $INSTALL_DIR"
    echo
    echo "🔧 常用命令:"
    echo "  cd $INSTALL_DIR"
    echo "  docker-compose logs -f    # 查看日志"
    echo "  docker-compose ps         # 查看状态"
    echo "  docker-compose down       # 停止服务"
    echo "  docker-compose up -d      # 启动服务"
    echo
    echo "📚 文档: https://docs.evohub.io"
    echo "🐛 问题反馈: https://github.com/evohub/evohub/issues"
    echo
    
    # Show quick test
    log_info "运行健康检查..."
    if curl -s http://localhost:3000/health | grep -q "healthy"; then
        log_success "健康检查通过!"
    else
        log_warn "健康检查未完成，请稍后重试"
    fi
}

# Main installation flow
main() {
    echo "========================================"
    echo "🧬 EvoHub v${VERSION} 安装程序"
    echo "========================================"
    echo
    
    check_prerequisites
    download_evohub
    configure_env
    start_services
    show_success
}

# Handle errors
trap 'log_error "安装失败，请检查错误信息"' ERR

# Run main
main "$@"
