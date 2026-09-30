# 贡献指北

怎么贡献开源项目，这里就不再多说了，网上教程一堆。  

## 脚本
- npm run lint  
在提交前检查代码是否符合 Eslint 规则。
- npm run build  
构建项目。
- npm run serve   
启动项目。

## 约定
### 语言

请尽量使用 TS，而不是纯 JS。

提交消息、议题、拉取请求等交流语言最好使用中文（中文不好使用母语也行）。

### 文档

TS 代码中的函数都需要填写文档。

### 提交消息

遵循 `<类型>(<影响范围>): <描述>` 的形式。

### AI 披露

如果你使用 AI 生成你的贡献，请在拉取请求正文中显示标注。

### 提交签名

最好[对你的提交签名](https://docs.github.com/zh/authentication/managing-commit-signature-verification/about-commit-signature-verification)。

## 注意
[.vscode/launch.json](.vscode/launch.json) 这个文件需要和 [.idea/runConfigurations/*.xml](.idea/runConfigurations) 同步，不要只修改一边。

在添加或修改 npm 脚本时记得更新文档和前面提到的运行配置。

在做并发请求前请注意，不要一次性并发一大堆请求。
