# AlgTool 算法工具 - 核心代码包

## 包含内容

- `qt6-gui/` - Qt6 界面（算法选择、参数配置、结果展示）
- `gmssl-backend/` - GmSSL 后端集成
- `openssl-backend/` - OpenSSL 后端集成
- `pqc-module/` - 后量子密码模块（ML-DSA, ML-KEM）
- `certificate-envelope/` - 证书信封功能

## 技术栈

- C++ 17
- Qt 6
- GmSSL 3.0
- OpenSSL 3.x

## 构建步骤

```bash
mkdir build && cd build
qmake ../algtool.pro
make
```

## 脱敏说明

已移除测试密钥、内部算法配置、教学环境路径。
