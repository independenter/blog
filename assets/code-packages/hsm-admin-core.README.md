# HSM 管理系统 - 核心代码包

## 包含内容

- `hsm-backend/` - Spring Boot 后端（设备管理、监控、审计）
- `hsm-frontend/` - Vue 3 前端（仪表盘、设备列表、密钥管理）
- `device-discovery/` - UDP 广播 + mDNS 设备自动发现
- `performance-monitor/` - CPU/内存/温度/磁盘指标采集
- `key-shamir/` - Shamir 秘密共享密钥分量管理

## 技术栈

- Java 21
- Spring Boot 3.x
- MyBatis Plus
- Vue 3 + TypeScript
- Ant Design Vue

## 构建步骤

```bash
# 后端
cd hsm-backend
./mvnw clean package

# 前端
cd hsm-frontend
npm install
npm run build
```

## 脱敏说明

已移除内部 HSM 设备 IP、管理员账号、生产环境配置、客户名称。
