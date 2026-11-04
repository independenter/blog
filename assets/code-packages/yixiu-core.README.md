# YiXiu 密码学工具集 - 核心代码包

## 包含内容

- `YiXiu.Core/` - 核心算法库（SM2/SM3/SM4/RSA/PQC）
- `YiXiu.Gui/` - WPF 现代化界面
- `YiXiu.Cli/` - CLI 命令行工具
- `CertificateParser/` - 证书解析工具
- `KeyConverter/` - 密钥格式转换
- `RadixConverter/` - 进制转换工具

## 技术栈

- C# / .NET 8
- WPF (Windows Presentation Foundation)
- System.CommandLine (CLI)

## 构建步骤

```bash
# GUI 版本
dotnet build YiXiu.Gui/YiXiu.Gui.csproj

# CLI 版本
dotnet build YiXiu.Cli/YiXiu.Cli.csproj

# 发布跨平台
dotnet publish -c Release -r win-x64
dotnet publish -c Release -r linux-x64
dotnet publish -c Release -r osx-x64
```

## 脱敏说明

已移除测试证书、内部密钥、工作路径配置。
