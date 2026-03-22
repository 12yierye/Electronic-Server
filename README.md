# Electronic 服务器端

## 简介

这是 Electronic 应用程序的服务器端，提供用户认证、文件管理等后端服务。

## 功能特性

- 用户登录和注册
- 文件上传、下载和删除
- 用户文件列表管理
- RESTful API 接口

## 技术栈

- Node.js
- Express.js
- JSON 文件存储（开发阶段）
- CORS 支持

## 安装依赖

```bash
npm install
```

## 运行服务器

### 方法一：直接运行（推荐）

```bash
npm start
```

### 方法二：使用启动脚本

```bash
npm run dev
```

## 默认配置

- 端口: 3000 (可通过设置 PORT 环境变量修改)
- 监听地址: 0.0.0.0 (支持外部访问)
- 默认用户: 
  - 用户名: admin
  - 密码: 123

## API 接口

### 认证相关

- `POST /login` - 用户登录
- `POST /register` - 用户注册
- `GET /users` - 获取所有用户

### 文件管理

- `GET /user/files` - 获取用户文件列表
- `POST /user/files` - 更新用户文件列表
- `POST /user/upload` - 上传文件
- `GET /user/download/:username/:filename` - 下载文件
- `DELETE /user/file/:username/:filename` - 删除文件

## 数据存储

服务器使用以下文件和目录存储数据：

- `users.json` - 用户数据
- `user_files/` - 用户文件数据库目录
- `uploaded_files/` - 用户上传文件存储目录

## 开发说明

此服务器为开发环境设计，使用 JSON 文件和本地文件系统存储数据。在生产环境中，应替换为真正的数据库系统。