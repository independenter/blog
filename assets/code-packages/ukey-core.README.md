# Ukey 智能密码钥匙 - 核心代码包

## 包含内容

- `skf-adapter/` - SKF API 统一适配层（支持 21 家厂商）
- `qt6-gui/` - Qt6 现代化界面
- `certificate-manager/` - 证书导入导出管理
- `signature-tool/` - 数字签名验证工具
- `ukey-site/` - 在线演示网站

## 技术栈

- C++ 17
- Qt 6
- Python (脚本)
- JavaScript (UkeySite)

## 构建步骤

```bash
# Qt6 GUI
mkdir build && cd build
qmake ../ukey-gui.pro
make

# SKF Adapter
cd skf-adapter
cmake -B build
cmake --build build
```

## 脱敏说明

已移除厂商库路径、内部测试证书、客户环境配置。
