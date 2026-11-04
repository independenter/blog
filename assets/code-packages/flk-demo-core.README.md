# 国密加密演示平台 - 核心代码包

## 包含内容

- `crypto-service/` - SM2/SM3/SM4 算法服务封装
- `certificate-manager/` - 证书全生命周期管理
- `ai-assistant/` - Spring AI 集成的密码助手
- `electron-app/` - Electron 桌面应用壳
- `web-frontend/` - Vue 3 前端界面

## 技术栈

- Java 21
- Spring Boot 4.1
- Spring AI
- Vue 3 + TypeScript
- Electron

## 构建步骤

```bash
# 后端
cd crypto-service
./gradlew build

# 前端
cd web-frontend
npm install
npm run build

# Electron
cd electron-app
npm install
npm run dist
```

## 脱敏说明

已移除所有内部 IP 地址、客户信息、生产环境配置。
