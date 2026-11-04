# Bouncy Castle 深度学习 - 核心代码包

## 包含内容

- `bc-sm2/` - SM2 算法纯函数实现（密钥生成、签名验签）
- `bc-sm3/` - SM3 杂凑算法实现与执行追踪
- `bc-sm4/` - SM4 分组密码实现（ECB/CBC/GCM）
- `bc-rsa/` - RSA 算法实现与对比分析
- `bc-pqc/` - 后量子密码（ML-DSA, ML-KEM）
- `trace-framework/` - 执行追踪框架
- `visualizer/` - HTML 可视化展示模块

## 技术栈

- Java 21
- Bouncy Castle 1.78
- JUnit 5

## 构建步骤

```bash
./gradlew build

# 运行测试
./gradlew test

# 生成可视化报告
./gradlew generateReport
```

## 学习说明

本项目用于密码学算法深度学习，每个算法都有详细的执行追踪和可视化说明，适合教学和研究使用。

## 脱敏说明

已移除内部测试数据、学习路径配置、教学环境信息。
