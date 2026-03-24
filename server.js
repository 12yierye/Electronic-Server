const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 设置终端中文输出支持
process.stdout.setEncoding('utf8');

const app = express();
// 使用环境变量设置端口，如果没有设置则默认为3000
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 用户数据文件路径
const usersFilePath = path.join(__dirname, 'users.json');
// 用户文件数据库目录
const userFilesDir = path.join(__dirname, 'user_files');
// 用户上传文件存储目录
const uploadedFilesDir = path.join(__dirname, 'uploaded_files');

// 聊天消息存储目录
const chatMessagesDir = path.join(__dirname, 'chat_messages');

// 待发送文件存储目录（离线文件）
const pendingFilesDir = path.join(__dirname, 'pending_files');

// 待发送文件元数据存储
const pendingFilesMetaPath = path.join(__dirname, 'pending_files_meta.json');

// 在线用户集合
const onlineUsers = new Set();

// 初始化待发送文件目录
function initializePendingFilesDir() {
  if (!fs.existsSync(pendingFilesDir)) {
    fs.mkdirSync(pendingFilesDir, { recursive: true });
  }
}

// 读取待发送文件元数据
function readPendingFilesMeta() {
  try {
    if (!fs.existsSync(pendingFilesMetaPath)) {
      return [];
    }
    const data = fs.readFileSync(pendingFilesMetaPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取待发送文件元数据错误:', error.message);
    return [];
  }
}

// 写入待发送文件元数据
function writePendingFilesMeta(files) {
  try {
    fs.writeFileSync(pendingFilesMetaPath, JSON.stringify(files, null, 2));
  } catch (error) {
    console.error('写入待发送文件元数据错误:', error.message);
  }
}

// 清理过期文件（超过7天）
function cleanExpiredPendingFiles() {
  const now = new Date();
  const pendingFiles = readPendingFilesMeta();
  const validFiles = [];
  const expiredFileIds = [];

  for (const file of pendingFiles) {
    const expireAt = new Date(file.expireAt);
    if (expireAt < now) {
      // 文件已过期，删除物理文件
      expiredFileIds.push(file.id);
      const filePath = path.join(pendingFilesDir, file.id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`已清理过期文件: ${file.filename}`);
      }
    } else {
      validFiles.push(file);
    }
  }

  // 更新元数据
  writePendingFilesMeta(validFiles);
  console.log(`文件清理完成，删除了 ${expiredFileIds.length} 个过期文件`);
}

// 初始化聊天消息目录
function initializeChatMessagesDir() {
  if (!fs.existsSync(chatMessagesDir)) {
    fs.mkdirSync(chatMessagesDir);
  }
}

// 获取聊天消息文件路径
function getChatMessagesPath(sender, receiver) {
  // 确保发送者和接收者的顺序一致，以便双方都能访问同一份聊天记录
  const participants = [sender, receiver].sort();
  return path.join(chatMessagesDir, `${participants[0]}_${participants[1]}.json`);
}

// 读取聊天消息
function readChatMessages(sender, receiver) {
  try {
    const chatPath = getChatMessagesPath(sender, receiver);
    if (!fs.existsSync(chatPath)) {
      return [];
    }
    const data = fs.readFileSync(chatPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取聊天消息错误:`, error.message);
    return [];
  }
}

// 保存聊天消息
function writeChatMessages(sender, receiver, messages) {
  try {
    const chatPath = getChatMessagesPath(sender, receiver);
    fs.writeFileSync(chatPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error(`保存聊天消息错误:`, error.message);
  }
}

// 初始化聊天消息目录
initializeChatMessagesDir();

// 初始化用户数据文件
function initializeUsersFile() {
  let users = []
  if (fs.existsSync(usersFilePath)) {
    try {
      users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))
    } catch (e) {
      users = []
    }
  }

  // 确保 admin 用户存在
  const hasAdmin = users.some(u => u.username === 'admin')
  if (!hasAdmin) {
    users.push({
      username: 'admin',
      password: 'admin',
      nickname: '管理员',
      avatar: '',
      createdAt: Date.now()
    })
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2))
    console.log('[初始化] 默认用户 admin 已创建')
  }
}

// 初始化用户文件数据库目录
function initializeUserFilesDir() {
  if (!fs.existsSync(userFilesDir)) {
    fs.mkdirSync(userFilesDir);
  }
}

// 初始化上传文件存储目录
function initializeUploadedFilesDir() {
  if (!fs.existsSync(uploadedFilesDir)) {
    fs.mkdirSync(uploadedFilesDir);
  }
}

// 读取用户数据
function readUsersFromFile() {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取用户数据文件错误:', error.message);
    return [];
  }
}

// 写入用户数据
function writeUsersToFile(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('写入用户数据文件错误:', error.message);
  }
}

// 获取用户文件数据库路径
function getUserFilesPath(username) {
  return path.join(userFilesDir, `${username}.json`);
}

// 获取用户上传文件存储路径
function getUserUploadedFilesPath(username) {
  const userDir = path.join(uploadedFilesDir, username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

// 初始化用户文件数据库
function initializeUserFiles(username) {
  const userFilesPath = getUserFilesPath(username);
  if (!fs.existsSync(userFilesPath)) {
    fs.writeFileSync(userFilesPath, JSON.stringify([]));
  }
}

// 读取用户文件数据库
function readUserFiles(username) {
  try {
    const userFilesPath = getUserFilesPath(username);
    if (!fs.existsSync(userFilesPath)) {
      initializeUserFiles(username);
    }
    const data = fs.readFileSync(userFilesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取用户 ${username} 文件数据库错误:`, error.message);
    return [];
  }
}

// 写入用户文件数据库
function writeUserFiles(username, files) {
  try {
    const userFilesPath = getUserFilesPath(username);
    fs.writeFileSync(userFilesPath, JSON.stringify(files, null, 2));
  } catch (error) {
    console.error(`写入用户 ${username} 文件数据库错误:`, error.message);
  }
}

// 初始化用户数据文件和文件数据库目录
initializeUsersFile();
initializeUserFilesDir();
initializeUploadedFilesDir();
initializePendingFilesDir();

// 启动时清理过期文件
cleanExpiredPendingFiles();

// 登录接口
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readUsersFromFile();
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名或密码不能为空'
      });
    }
    
    // 查找用户
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      // 初始化用户文件数据库
      initializeUserFiles(username);

      // 将用户添加到在线列表
      onlineUsers.add(username);
      console.log(`用户 ${username} 登录上线，当前在线: ${Array.from(onlineUsers).join(', ')}`);

      // 登录成功（不再返回文件列表）
      const { password, ...userWithoutPassword } = user;
      return res.json({
        success: true,
        message: '登录成功',
        user: userWithoutPassword,
        pendingFiles: [] // 前端可以查询待接收文件
        // 移除了 files 字段，不再在登录时返回文件列表
      });
    } else {
      // 登录失败
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
  } catch (error) {
    console.error('登录错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 注册接口
app.post('/register', (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    let users = readUsersFromFile();
    
    // 验证输入
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: '用户名、密码和邮箱不能为空'
      });
    }
    
    // 检查用户名是否已存在
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }
    
    // 检查同一邮箱注册的账号数量
    const usersWithSameEmail = users.filter(u => u.email === email);
    if (usersWithSameEmail.length >= 2) {
      return res.status(400).json({
        success: false,
        message: '每个邮箱最多只能注册两个账号'
      });
    }

    // 创建新用户（不再区分角色）
    const newUser = {
      id: users.length + 1,
      username,
      password,
      email,
      name: username,
      role: 'teacher', // 统一为教师角色
      starredUsers: [], // 星标用户列表
      friends: [] // 好友列表
    };
    
    users.push(newUser);
    writeUsersToFile(users);
    
    // 初始化用户文件数据库
    initializeUserFiles(username);
    
    // 初始化用户上传文件目录
    getUserUploadedFilesPath(username);
    
    // 注册成功
    return res.json({
      success: true,
      message: '注册成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取所有用户接口
app.get('/users', (req, res) => {
  try {
    const users = readUsersFromFile();
    
    // 返回所有用户信息（不包含密码）
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    return res.json({
      success: true,
      users: usersWithoutPassword
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 搜索用户接口
app.get('/users/search', (req, res) => {
  try {
    const { query } = req.query;
    const users = readUsersFromFile();
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: '查询参数不能为空'
      });
    }
    
    // 搜索匹配的用户（用户名或邮箱）
    const matchedUsers = users.filter(user => 
      user.username.toLowerCase().includes(query.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
    ).map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    return res.json({
      success: true,
      users: matchedUsers
    });
  } catch (error) {
    console.error('搜索用户错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 添加好友接口
app.post('/users/friends/add', (req, res) => {
  try {
    const { currentUser, friendUsername } = req.body;
    let users = readUsersFromFile();
    
    // 查找当前用户和目标用户
    const userIndex = users.findIndex(u => u.username === currentUser);
    const friend = users.find(u => u.username === friendUsername);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '当前用户不存在'
      });
    }
    
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: '目标用户不存在'
      });
    }
    
    // 检查是否已经是好友
    if (users[userIndex].friends.includes(friendUsername)) {
      return res.status(400).json({
        success: false,
        message: '该用户已经是您的好友'
      });
    }
    
    // 添加好友
    users[userIndex].friends.push(friendUsername);
    writeUsersToFile(users);
    
    return res.json({
      success: true,
      message: '添加好友成功'
    });
  } catch (error) {
    console.error('添加好友错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 移除好友接口
app.post('/users/friends/remove', (req, res) => {
  try {
    const { currentUser, friendUsername } = req.body;
    let users = readUsersFromFile();
    
    // 查找当前用户
    const userIndex = users.findIndex(u => u.username === currentUser);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '当前用户不存在'
      });
    }
    
    // 检查是否是好友
    const isFriend = users[userIndex].friends.includes(friendUsername);
    
    if (!isFriend) {
      return res.status(400).json({
        success: false,
        message: '该用户不是您的好友'
      });
    }
    
    // 移除好友
    users[userIndex].friends = users[userIndex].friends.filter(f => f !== friendUsername);
    writeUsersToFile(users);
    
    return res.json({
      success: true,
      message: '移除好友成功'
    });
  } catch (error) {
    console.error('移除好友错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取好友列表接口
app.get('/users/friends', (req, res) => {
  try {
    const { username } = req.query;
    const users = readUsersFromFile();
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 获取好友详细信息
    const userFriends = user.friends || []
    const friends = users.filter(u => userFriends.includes(u.username))
      .map(friend => {
        const { password, ...userWithoutPassword } = friend;
        return userWithoutPassword;
      });
    
    return res.json({
      success: true,
      friends: friends
    });
  } catch (error) {
    console.error('获取好友列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 星标用户接口
app.post('/users/star', (req, res) => {
  try {
    const { currentUser, starredUsername } = req.body;
    let users = readUsersFromFile();
    
    // 查找当前用户
    const userIndex = users.findIndex(u => u.username === currentUser);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '当前用户不存在'
      });
    }
    
    // 检查是否已经星标
    const isStarred = users[userIndex].starredUsers.includes(starredUsername);
    
    if (isStarred) {
      // 取消星标
      users[userIndex].starredUsers = users[userIndex].starredUsers.filter(u => u !== starredUsername);
    } else {
      // 添加星标
      users[userIndex].starredUsers.push(starredUsername);
    }
    
    writeUsersToFile(users);
    
    return res.json({
      success: true,
      message: isStarred ? '取消星标成功' : '星标成功',
      starred: !isStarred
    });
  } catch (error) {
    console.error('星标用户错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取星标用户列表接口
app.get('/users/starred', (req, res) => {
  try {
    const { username } = req.query;
    const users = readUsersFromFile();
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 获取星标用户详细信息
    const starredUsers = users.filter(u => user.starredUsers.includes(u.username))
      .map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    
    return res.json({
      success: true,
      starredUsers: starredUsers
    });
  } catch (error) {
    console.error('获取星标用户列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取用户文件列表接口
app.get('/user/files', (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const userFiles = readUserFiles(username);
    
    return res.json({
      success: true,
      files: userFiles
    });
  } catch (error) {
    console.error('获取用户文件列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新用户文件列表接口
app.post('/user/files', (req, res) => {
  try {
    const { username, files } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    if (!Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        message: '文件列表格式错误'
      });
    }
    
    writeUserFiles(username, files);
    
    return res.json({
      success: true,
      message: '文件列表更新成功'
    });
  } catch (error) {
    console.error('更新用户文件列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 上传文件接口
app.post('/user/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const { username, filename } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '文件名不能为空'
      });
    }
    
    // 获取用户上传目录
    const userUploadDir = getUserUploadedFilesPath(username);
    const filePath = path.join(userUploadDir, filename);
    
    // 写入文件
    fs.writeFileSync(filePath, req.body);
    
    return res.json({
      success: true,
      message: '文件上传成功'
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 下载文件接口
app.get('/user/download/:username/:filename', (req, res) => {
  try {
    const { username, filename } = req.params;
    
    // 获取用户上传目录
    const userUploadDir = getUserUploadedFilesPath(username);
    const filePath = path.join(userUploadDir, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // 发送文件
    res.sendFile(filePath);
  } catch (error) {
    console.error('文件下载错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});


// 删除文件接口
app.delete('/user/file/:username/:filename', (req, res) => {
  try {
    const { username, filename } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '文件名不能为空'
      });
    }
    
    // 获取用户上传目录
    const userUploadDir = getUserUploadedFilesPath(username);
    const filePath = path.join(userUploadDir, filename);
    
    // 删除上传的文件（如果存在）
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 删除本地已下载的文件副本（如果存在）
    const downloadedFilesDir = path.join(__dirname, 'downloaded_files', username, filename);
    if (fs.existsSync(downloadedFilesDir)) {
      fs.unlinkSync(downloadedFilesDir);
    }
    
    // 从用户文件数据库中移除
    const userFiles = readUserFiles(username);
    const updatedFiles = userFiles.filter(file => file.name !== filename);
    writeUserFiles(username, updatedFiles);
    
    return res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    console.error('文件删除错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});


// 根路径返回简单信息
app.get('/', (req, res) => {
  res.send(`
    <h1>Electronic 服务器</h1>
    <p>服务器正在运行中...</p>
    <p>API 端点:</p>
    <ul>
      <li>POST /login - 用户登录</li>
      <li>POST /register - 用户注册</li>
      <li>GET /users - 获取所有用户</li>
      <li>GET /user/files - 获取用户文件列表</li>
      <li>POST /user/files - 更新用户文件列表</li>
      <li>POST /user/upload - 上传文件</li>
      <li>GET /user/download/:username/:filename - 下载文件</li>
      <li>DELETE /user/file/:username/:filename - 删除文件</li>
    </ul>
  `);
});

// 确保服务器关闭时清理PID文件
process.on('SIGINT', () => {
  try {
    fs.unlinkSync(pidFile);
  } catch (err) {
    // 忽略错误
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    fs.unlinkSync(pidFile);
  } catch (err) {
    // 忽略错误
  }
  process.exit(0);
});

// ========== 内网聊天功能 ==========

// 内网在线用户集合
const lanOnlineUsers = new Set();

// 内网消息存储目录
const lanChatMessagesDir = path.join(__dirname, 'lan_chat_messages');

// 初始化内网聊天消息目录
function initializeLanChatMessagesDir() {
  if (!fs.existsSync(lanChatMessagesDir)) {
    fs.mkdirSync(lanChatMessagesDir, { recursive: true });
  }
}

// 获取内网聊天消息文件路径
function getLanChatMessagesPath(user1, user2) {
  const participants = [user1, user2].sort();
  return path.join(lanChatMessagesDir, `${participants[0]}_${participants[1]}.json`);
}

// 读取内网聊天消息
function readLanChatMessages(user1, user2) {
  try {
    const chatPath = getLanChatMessagesPath(user1, user2);
    if (!fs.existsSync(chatPath)) {
      return [];
    }
    const data = fs.readFileSync(chatPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取内网聊天消息错误:`, error.message);
    return [];
  }
}

// 保存内网聊天消息
function writeLanChatMessages(user1, user2, messages) {
  try {
    const chatPath = getLanChatMessagesPath(user1, user2);
    fs.writeFileSync(chatPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error(`保存内网聊天消息错误:`, error.message);
  }
}

// 初始化内网聊天消息目录
initializeLanChatMessagesDir();

// 用户登录内网
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readUsersFromFile();
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名或密码不能为空'
      });
    }
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      lanOnlineUsers.add(username);
      console.log(`[内网] 用户 ${username} 登录上线，当前在线: ${Array.from(lanOnlineUsers).join(', ')}`);
      
      const { password, ...userWithoutPassword } = user;
      return res.json({
        success: true,
        message: '登录成功',
        user: userWithoutPassword
      });
    } else {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
  } catch (error) {
    console.error('[内网] 登录错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 用户退出内网
app.post('/api/logout', (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    lanOnlineUsers.delete(username);
    console.log(`[内网] 用户 ${username} 下线，当前在线: ${Array.from(lanOnlineUsers).join(', ')}`);
    
    return res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    console.error('[内网] 退出错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取内网用户列表（所有注册用户，无需好友）
app.get('/api/friends', (req, res) => {
  try {
    // 返回所有注册用户作为内网用户（无需好友验证）
    const users = readUsersFromFile();
    
    // 标记在线状态，排除自己
    const currentUser = req.query.username || '';
    const userList = users
      .filter(user => user.username !== currentUser)
      .map(user => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          online: lanOnlineUsers.has(user.username)
        };
      });
    
    return res.json({
      success: true,
      friends: userList
    });
  } catch (error) {
    console.error('[内网] 获取用户列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取内网聊天消息
app.get('/api/messages', (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: '发送者和接收者不能为空'
      });
    }
    
    const messages = readLanChatMessages(from, to);
    
    return res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('[内网] 获取消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 发送内网消息
app.post('/api/messages', (req, res) => {
  try {
    const { from, to, message, type } = req.body;
    
    if (!from || !to || !message) {
      return res.status(400).json({
        success: false,
        message: '发送者、接收者和消息内容不能为空'
      });
    }
    
    // 创建消息对象
    const chatMessage = {
      id: Date.now(),
      from: from,
      to: to,
      message: message,
      type: type || 'text',
      timestamp: new Date().toISOString()
    };
    
    // 读取现有消息
    const messages = readLanChatMessages(from, to);
    
    // 添加新消息
    messages.push(chatMessage);
    
    // 保存消息
    writeLanChatMessages(from, to, messages);
    
    console.log(`[内网消息] ${from} -> ${to}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    return res.json({
      success: true,
      message: '消息发送成功',
      data: chatMessage
    });
  } catch (error) {
    console.error('[内网] 发送消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取内网在线状态
app.get('/api/online', (req, res) => {
  try {
    return res.json({
      success: true,
      onlineUsers: Array.from(lanOnlineUsers)
    });
  } catch (error) {
    console.error('[内网] 获取在线用户错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// ========== 内网群聊功能 ==========

// 内网群聊存储目录
const lanGroupsDir = path.join(__dirname, 'lan_groups');

// 内网群聊消息目录
const lanGroupMessagesDir = path.join(__dirname, 'lan_group_messages');

// 初始化群聊目录
function initializeLanGroupsDir() {
  if (!fs.existsSync(lanGroupsDir)) {
    fs.mkdirSync(lanGroupsDir, { recursive: true });
  }
  if (!fs.existsSync(lanGroupMessagesDir)) {
    fs.mkdirSync(lanGroupMessagesDir, { recursive: true });
  }
}

// 读取群聊列表
function readGroups() {
  try {
    const groupsPath = path.join(lanGroupsDir, 'groups.json');
    if (!fs.existsSync(groupsPath)) {
      return [];
    }
    const data = fs.readFileSync(groupsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取群聊列表错误:', error.message);
    return [];
  }
}

// 保存群聊列表
function writeGroups(groups) {
  try {
    const groupsPath = path.join(lanGroupsDir, 'groups.json');
    fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
  } catch (error) {
    console.error('保存群聊列表错误:', error.message);
  }
}

// 获取群聊消息文件路径
function getGroupMessagesPath(groupId) {
  return path.join(lanGroupMessagesDir, `${groupId}.json`);
}

// 读取群聊消息
function readGroupMessages(groupId) {
  try {
    const msgPath = getGroupMessagesPath(groupId);
    if (!fs.existsSync(msgPath)) {
      return [];
    }
    const data = fs.readFileSync(msgPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取群聊消息错误:', error.message);
    return [];
  }
}

// 保存群聊消息
function writeGroupMessages(groupId, messages) {
  try {
    const msgPath = getGroupMessagesPath(groupId);
    fs.writeFileSync(msgPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('保存群聊消息错误:', error.message);
  }
}

// 初始化群聊目录
initializeLanGroupsDir();

// 创建群聊
app.post('/api/groups', (req, res) => {
  try {
    const { name, creator, members } = req.body;
    
    if (!name || !creator) {
      return res.status(400).json({
        success: false,
        message: '群名称和创建者不能为空'
      });
    }
    
    const groups = readGroups();
    
    // 生成群ID
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 群成员默认包含创建者
    const groupMembers = Array.isArray(members) 
      ? [...new Set([creator, ...members])] 
      : [creator];
    
    const newGroup = {
      id: groupId,
      name: name,
      creator: creator,
      members: groupMembers,
      createdAt: new Date().toISOString()
    };
    
    groups.push(newGroup);
    writeGroups(groups);
    
    console.log(`[内网群聊] 用户 ${creator} 创建了群聊 "${name}"，群ID: ${groupId}，成员: ${groupMembers.join(', ')}`);
    
    return res.json({
      success: true,
      message: '群聊创建成功',
      group: newGroup
    });
  } catch (error) {
    console.error('[内网] 创建群聊错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取群聊列表（用户加入的群）
app.get('/api/groups', (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const groups = readGroups();
    
    // 筛选用户所在的群
    const userGroups = groups.filter(group => 
      group.members.includes(username)
    );
    
    return res.json({
      success: true,
      groups: userGroups
    });
  } catch (error) {
    console.error('[内网] 获取群聊列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取群聊消息
app.get('/api/group-messages', (req, res) => {
  try {
    const { groupId } = req.query;
    
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: '群ID不能为空'
      });
    }
    
    const messages = readGroupMessages(groupId);
    
    return res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('[内网] 获取群消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 发送群聊消息
app.post('/api/group-messages', (req, res) => {
  try {
    const { groupId, from, message, type } = req.body;
    
    if (!groupId || !from || !message) {
      return res.status(400).json({
        success: false,
        message: '群ID、发送者和消息内容不能为空'
      });
    }
    
    // 验证群是否存在
    const groups = readGroups();
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: '群聊不存在'
      });
    }
    
    // 验证发送者是否是群成员
    if (!group.members.includes(from)) {
      return res.status(403).json({
        success: false,
        message: '您不是该群成员'
      });
    }
    
    // 创建消息对象
    const chatMessage = {
      id: Date.now(),
      groupId: groupId,
      from: from,
      message: message,
      type: type || 'text',
      timestamp: new Date().toISOString()
    };
    
    // 读取现有消息并添加
    const messages = readGroupMessages(groupId);
    messages.push(chatMessage);
    writeGroupMessages(groupId, messages);
    
    console.log(`[内网群消息] 群 "${group.name}" (${groupId}): ${from}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    return res.json({
      success: true,
      message: '消息发送成功',
      data: chatMessage
    });
  } catch (error) {
    console.error('[内网] 发送群消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 加入群聊
app.post('/api/groups/join', (req, res) => {
  try {
    const { groupId, username } = req.body;
    
    if (!groupId || !username) {
      return res.status(400).json({
        success: false,
        message: '群ID和用户名不能为空'
      });
    }
    
    const groups = readGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '群聊不存在'
      });
    }
    
    if (groups[groupIndex].members.includes(username)) {
      return res.status(400).json({
        success: false,
        message: '您已经是群成员'
      });
    }
    
    groups[groupIndex].members.push(username);
    writeGroups(groups);
    
    console.log(`[内网群聊] 用户 ${username} 加入了群聊 "${groups[groupIndex].name}"`);
    
    return res.json({
      success: true,
      message: '加入群聊成功',
      group: groups[groupIndex]
    });
  } catch (error) {
    console.error('[内网] 加入群聊错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 退出群聊
app.post('/api/groups/leave', (req, res) => {
  try {
    const { groupId, username } = req.body;
    
    if (!groupId || !username) {
      return res.status(400).json({
        success: false,
        message: '群ID和用户名不能为空'
      });
    }
    
    const groups = readGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '群聊不存在'
      });
    }
    
    // 群主不能退群，只能解散
    if (groups[groupIndex].creator === username) {
      return res.status(400).json({
        success: false,
        message: '群主不能退群，请选择解散群聊'
      });
    }
    
    groups[groupIndex].members = groups[groupIndex].members.filter(m => m !== username);
    writeGroups(groups);
    
    console.log(`[内网群聊] 用户 ${username} 退出了群聊 "${groups[groupIndex].name}"`);
    
    return res.json({
      success: true,
      message: '退出群聊成功'
    });
  } catch (error) {
    console.error('[内网] 退出群聊错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 解散群聊
app.delete('/api/groups/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const groups = readGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '群聊不存在'
      });
    }
    
    if (groups[groupIndex].creator !== username) {
      return res.status(403).json({
        success: false,
        message: '只有群主才能解散群聊'
      });
    }
    
    // 删除群聊
    const deletedGroupName = groups[groupIndex].name;
    groups.splice(groupIndex, 1);
    writeGroups(groups);
    
    // 删除群聊消息
    const msgPath = getGroupMessagesPath(groupId);
    if (fs.existsSync(msgPath)) {
      fs.unlinkSync(msgPath);
    }
    
    console.log(`[内网群聊] 群聊 "${deletedGroupName}" (${groupId}) 已被群主 ${username} 解散`);
    
    return res.json({
      success: true,
      message: '群聊已解散'
    });
  } catch (error) {
    console.error('[内网] 解散群聊错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 健康检查接口（用于内网连接测试）
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '内网聊天服务正常运行',
    version: '1.0.0',
    lanUsers: Array.from(lanOnlineUsers).length,
    lanGroups: readGroups().length
  });
});

// ========== 启动服务器 ==========

// 启动服务器，监听在0.0.0.0地址上以支持外部访问
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('       电子聊天系统服务端已启动');
  console.log('========================================');
  console.log('');
  console.log(`服务器端口: ${PORT}`);
  console.log(`服务器地址: http://0.0.0.0:${PORT}`);
  console.log(`本地访问:   http://localhost:${PORT}`);
  console.log('');
  console.log('--- 公网功能接口 ---');
  console.log(`注册:      POST http://localhost:${PORT}/register`);
  console.log(`登录:      POST http://localhost:${PORT}/login`);
  console.log(`用户列表:  GET  http://localhost:${PORT}/users`);
  console.log(`发送消息:  POST http://localhost:${PORT}/chat/send`);
  console.log(`获取消息:  GET  http://localhost:${PORT}/chat/messages`);
  console.log(`文件上传:  POST http://localhost:${PORT}/user/upload`);
  console.log(`文件下载:  GET  http://localhost:${PORT}/user/download/:username/:filename`);
  console.log('');
  console.log('--- 内网聊天功能接口 ---');
  console.log(`内网登录:     POST http://localhost:${PORT}/api/login`);
  console.log(`内网登出:     POST http://localhost:${PORT}/api/logout`);
  console.log(`内网用户:     GET  http://localhost:${PORT}/api/friends`);
  console.log(`内网消息:     GET  http://localhost:${PORT}/api/messages`);
  console.log(`发送内网消息: POST http://localhost:${PORT}/api/messages`);
  console.log(`在线状态:     GET  http://localhost:${PORT}/api/online`);
  console.log(`创建群聊:     POST http://localhost:${PORT}/api/groups`);
  console.log(`群聊列表:     GET  http://localhost:${PORT}/api/groups`);
  console.log(`群聊消息:     GET  http://localhost:${PORT}/api/group-messages`);
  console.log(`发送群消息:   POST http://localhost:${PORT}/api/group-messages`);
  console.log(`加入群聊:     POST http://localhost:${PORT}/api/groups/join`);
  console.log(`退出群聊:     POST http://localhost:${PORT}/api/groups/leave`);
  console.log(`解散群聊:     DEL http://localhost:${PORT}/api/groups/:groupId`);
  console.log('');
  console.log('--- 使用说明 ---');
  console.log('1. 公网模式：需加好友后才能聊天，消息存储在 chat_messages 目录');
  console.log('2. 内网模式：所有用户可自由聊天，可创建群聊，消息存储在 lan_chat_messages 目录');
  console.log('3. 客户端需在设置中启用"内网聊天"并配置内网服务器IP');
  console.log('4. 内网模式下，用户列表自动显示所有注册用户（无需添加好友）');
  console.log('');
  console.log('========================================');
  console.log('');
});

// 发送消息接口
app.post('/chat/send', (req, res) => {
  try {
    const { sender, receiver, message } = req.body;
    
    if (!sender || !receiver || !message) {
      return res.status(400).json({
        success: false,
        message: '发送者、接收者和消息内容不能为空'
      });
    }
    
    // 检查用户是否存在
    const users = readUsersFromFile();
    const senderExists = users.find(u => u.username === sender);
    const receiverExists = users.find(u => u.username === receiver);
    
    if (!senderExists) {
      return res.status(404).json({
        success: false,
        message: '发送者不存在'
      });
    }
    
    if (!receiverExists) {
      return res.status(404).json({
        success: false,
        message: '接收者不存在'
      });
    }
    
    // 创建消息对象
    const chatMessage = {
      id: Date.now(), // 使用时间戳作为唯一ID
      sender: sender,
      receiver: receiver,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // 读取现有消息
    const messages = readChatMessages(sender, receiver);
    
    // 添加新消息
    messages.push(chatMessage);
    
    // 保存消息
    writeChatMessages(sender, receiver, messages);
    
    return res.json({
      success: true,
      message: '消息发送成功',
      data: chatMessage
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取消息接口
app.get('/chat/messages', (req, res) => {
  try {
    const { sender, receiver } = req.query;
    
    if (!sender || !receiver) {
      return res.status(400).json({
        success: false,
        message: '发送者和接收者不能为空'
      });
    }
    
    // 获取聊天消息
    const messages = readChatMessages(sender, receiver);
    
    return res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('获取消息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 添加发送文件接口
app.post('/files/send', async (req, res) => {
  try {
    const { sender, receiver, filename } = req.body;
    
    if (!sender || !receiver || !filename) {
      return res.status(400).json({
        success: false,
        message: '发送者、接收者和文件名不能为空'
      });
    }
    
    // 检查用户是否存在
    const users = readUsersFromFile();
    const senderUser = users.find(u => u.username === sender);
    const receiverUser = users.find(u => u.username === receiver);
    
    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: '发送者不存在'
      });
    }
    
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: '接收者不存在'
      });
    }
    
    // 所有用户都可以发送文件给任何人（不再区分角色）

    // 获取发送者的文件信息
    const senderFiles = readUserFiles(sender);
    const fileToSend = senderFiles.find(f => f.name === filename);
    
    if (!fileToSend) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
    
    // 将文件添加到接收者的文件数据库
    const receiverFiles = readUserFiles(receiver);
    const existingFile = receiverFiles.find(f => f.name === filename);
    
    if (!existingFile) {
      receiverFiles.push(fileToSend);
      writeUserFiles(receiver, receiverFiles);
    }
    
    return res.json({
      success: true,
      message: '文件发送成功'
    });
  } catch (error) {
    console.error('发送文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 好友申请存储路径
const friendRequestsDir = path.join(__dirname, 'friend_requests');

// 初始化好友申请目录
function initializeFriendRequestsDir() {
  if (!fs.existsSync(friendRequestsDir)) {
    fs.mkdirSync(friendRequestsDir);
  }
}

// 获取好友申请文件路径
function getFriendRequestsPath(username) {
  return path.join(friendRequestsDir, `${username}.json`);
}

// 读取用户的好友申请
function readFriendRequests(username) {
  try {
    const requestsPath = getFriendRequestsPath(username);
    if (!fs.existsSync(requestsPath)) {
      return [];
    }
    const data = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取用户 ${username} 的好友申请错误:`, error.message);
    return [];
  }
}

// 写入用户的好友申请
function writeFriendRequests(username, requests) {
  try {
    const requestsPath = getFriendRequestsPath(username);
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error(`写入用户 ${username} 的好友申请错误:`, error.message);
  }
}

// 初始化好友申请目录
initializeFriendRequestsDir();

// 发送好友申请接口
app.post('/friends/requests/send', (req, res) => {
  try {
    const { sender, receiver } = req.body;
    const users = readUsersFromFile();
    
    if (!sender || !receiver) {
      return res.status(400).json({
        success: false,
        message: '发送者和接收者不能为空'
      });
    }
    
    // 检查用户是否存在
    const senderUser = users.find(u => u.username === sender);
    const receiverUser = users.find(u => u.username === receiver);
    
    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: '发送者不存在'
      });
    }
    
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: '接收者不存在'
      });
    }
    
    // 检查是否已经是好友
    if (senderUser.friends.includes(receiver)) {
      return res.status(400).json({
        success: false,
        message: '该用户已经是您的好友'
      });
    }
    
    // 检查是否已经发送过好友申请
    const receiverRequests = readFriendRequests(receiver);
    const existingRequest = receiverRequests.find(req => 
      req.sender === sender && req.status === 'pending');
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: '您已经向该用户发送过好友申请'
      });
    }
    
    // 创建好友申请
    const newRequest = {
      id: Date.now(),
      sender: sender,
      receiver: receiver,
      status: 'pending', // pending, accepted, rejected
      timestamp: new Date().toISOString()
    };
    
    // 保存到接收者的申请列表
    receiverRequests.push(newRequest);
    writeFriendRequests(receiver, receiverRequests);
    
    return res.json({
      success: true,
      message: '好友申请发送成功'
    });
  } catch (error) {
    console.error('发送好友申请错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取好友申请列表接口
app.get('/friends/requests', (req, res) => {
  try {
    const { username, type } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    let requests = [];
    
    if (type === 'sent') {
      // 获取用户发送的申请（需要检查所有用户）
      const users = readUsersFromFile();
      for (const user of users) {
        const userRequests = readFriendRequests(user.username);
        const sentRequests = userRequests.filter(req => 
          req.sender === username && req.status === 'pending');
        requests = requests.concat(sentRequests);
      }
    } else if (type === 'received') {
      // 获取用户收到的申请
      requests = readFriendRequests(username);
    } else {
      // 获取所有相关的申请
      const users = readUsersFromFile();
      for (const user of users) {
        const userRequests = readFriendRequests(user.username);
        const relatedRequests = userRequests.filter(req => 
          req.sender === username || req.receiver === username);
        requests = requests.concat(relatedRequests);
      }
      
      // 添加直接收到的申请
      const receivedRequests = readFriendRequests(username);
      requests = requests.concat(receivedRequests);
      
      // 去重
      const uniqueRequests = [];
      const requestIds = new Set();
      requests.forEach(req => {
        if (!requestIds.has(req.id)) {
          uniqueRequests.push(req);
          requestIds.add(req.id);
        }
      });
      requests = uniqueRequests;
    }
    
    return res.json({
      success: true,
      requests: requests
    });
  } catch (error) {
    console.error('获取好友申请列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 处理好友申请接口
app.post('/friends/requests/handle', (req, res) => {
  try {
    const { requestId, action } = req.body;
    const users = readUsersFromFile();
    
    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        message: '申请ID和操作不能为空'
      });
    }
    
    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({
        success: false,
        message: '操作必须是 accept 或 reject'
      });
    }
    
    // 查找申请
    let requestFound = false;
    let requestDetails = null;
    
    for (const user of users) {
      const requests = readFriendRequests(user.username);
      const requestIndex = requests.findIndex(req => req.id == requestId);
      
      if (requestIndex !== -1) {
        requestFound = true;
        requestDetails = requests[requestIndex];
        
        // 更新申请状态
        requests[requestIndex].status = action === 'accept' ? 'accepted' : 'rejected';
        writeFriendRequests(user.username, requests);
        break;
      }
    }
    
    if (!requestFound || !requestDetails) {
      return res.status(404).json({
        success: false,
        message: '好友申请不存在'
      });
    }
    
    // 如果接受申请，则添加好友关系
    if (action === 'accept') {
      // 添加双向好友关系
      const senderIndex = users.findIndex(u => u.username === requestDetails.sender);
      const receiverIndex = users.findIndex(u => u.username === requestDetails.receiver);
      
      if (senderIndex !== -1 && receiverIndex !== -1) {
        // 确保不会重复添加
        if (!users[senderIndex].friends.includes(requestDetails.receiver)) {
          users[senderIndex].friends.push(requestDetails.receiver);
        }
        
        if (!users[receiverIndex].friends.includes(requestDetails.sender)) {
          users[receiverIndex].friends.push(requestDetails.sender);
        }
        
        writeUsersToFile(users);
      }
    }
    
    return res.json({
      success: true,
      message: action === 'accept' ? '好友申请已接受' : '好友申请已拒绝'
    });
  } catch (error) {
    console.error('处理好友申请错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 退出登录验证接口
app.post('/logout', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readUsersFromFile();

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名或密码不能为空'
      });
    }

    // 查找用户
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      // 从在线列表中移除
      onlineUsers.delete(username);
      console.log(`用户 ${username} 退出登录，当前在线: ${Array.from(onlineUsers).join(', ')}`);

      return res.json({
        success: true,
        message: '验证成功',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } else {
      // 验证失败
      return res.status(401).json({
        success: false,
        message: '密码错误'
      });
    }
  } catch (error) {
    console.error('退出登录验证错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 专门的注销接口（从在线列表中移除）
app.post('/user/logout', (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    // 从在线列表中移除
    onlineUsers.delete(username);
    console.log(`用户 ${username} 注销下线，当前在线: ${Array.from(onlineUsers).join(', ')}`);

    return res.json({
      success: true,
      message: '注销成功'
    });
  } catch (error) {
    console.error('注销错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 用户在线状态管理
// 登录时添加用户到在线列表
app.post('/user/online', (req, res) => {
  try {
    const { username, action } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    if (action === 'login') {
      onlineUsers.add(username);
      console.log(`用户 ${username} 上线，当前在线: ${Array.from(onlineUsers).join(', ')}`);
    } else if (action === 'logout') {
      onlineUsers.delete(username);
      console.log(`用户 ${username} 下线，当前在线: ${Array.from(onlineUsers).join(', ')}`);
    }

    return res.json({
      success: true,
      online: onlineUsers.has(username)
    });
  } catch (error) {
    console.error('用户在线状态错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 检查用户是否在线
app.get('/user/online', (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    const isOnline = onlineUsers.has(username);

    return res.json({
      success: true,
      online: isOnline
    });
  } catch (error) {
    console.error('检查用户在线状态错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取所有在线用户
app.get('/users/online', (req, res) => {
  try {
    return res.json({
      success: true,
      onlineUsers: Array.from(onlineUsers)
    });
  } catch (error) {
    console.error('获取在线用户列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 暂存文件接口（准备发送给离线用户）
app.post('/file/store', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const { sender, receiver, filename, expireAt } = req.body;

    // 如果是表单提交方式，尝试解析
    let actualSender = sender;
    let actualReceiver = receiver;
    let actualFilename = filename;
    let actualExpireAt = expireAt;

    // 检查是否是JSON格式
    if (typeof sender === 'string' && sender.includes('{')) {
      try {
        const parsed = JSON.parse(sender);
        actualSender = parsed.sender;
        actualReceiver = parsed.receiver;
        actualFilename = parsed.filename;
        actualExpireAt = parsed.expireAt;
      } catch (e) {
        // 使用原始值
      }
    }

    if (!actualSender || !actualReceiver || !actualFilename) {
      return res.status(400).json({
        success: false,
        message: '发送者、接收者和文件名不能为空'
      });
    }

    // 生成唯一文件ID
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 确定过期时间（默认7天）
    const expirationTime = actualExpireAt
      ? new Date(actualExpireAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 保存文件到待发送目录
    const filePath = path.join(pendingFilesDir, fileId);
    fs.writeFileSync(filePath, req.body);

    // 保存元数据
    const pendingFiles = readPendingFilesMeta();
    const fileMeta = {
      id: fileId,
      sender: actualSender,
      receiver: actualReceiver,
      filename: actualFilename,
      size: req.body.length,
      expireAt: expirationTime.toISOString(),
      createdAt: new Date().toISOString()
    };
    pendingFiles.push(fileMeta);
    writePendingFilesMeta(pendingFiles);

    // 检查接收者是否在线
    const receiverOnline = onlineUsers.has(actualReceiver);

    return res.json({
      success: true,
      message: receiverOnline ? '接收者在线，文件已就绪' : '文件已暂存，接收者上线后自动发送',
      fileId: fileId,
      receiverOnline: receiverOnline,
      pending: !receiverOnline
    });
  } catch (error) {
    console.error('暂存文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误: ' + error.message
    });
  }
});

// 获取待发送文件列表
app.get('/file/pending', (req, res) => {
  try {
    const { receiver } = req.query;

    if (!receiver) {
      return res.status(400).json({
        success: false,
        message: '接收者用户名不能为空'
      });
    }

    const pendingFiles = readPendingFilesMeta();
    const userPendingFiles = pendingFiles.filter(f => f.receiver === receiver);

    // 返回文件信息（不包含文件内容）
    const filesInfo = userPendingFiles.map(f => ({
      id: f.id,
      sender: f.sender,
      filename: f.filename,
      size: f.size,
      createdAt: f.createdAt,
      expireAt: f.expireAt
    }));

    return res.json({
      success: true,
      files: filesInfo
    });
  } catch (error) {
    console.error('获取待发送文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 下载待发送文件
app.get('/file/download/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;

    const pendingFiles = readPendingFilesMeta();
    const fileMeta = pendingFiles.find(f => f.id === fileId);

    if (!fileMeta) {
      return res.status(404).json({
        success: false,
        message: '文件不存在或已过期'
      });
    }

    const filePath = path.join(pendingFilesDir, fileId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMeta.filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // 发送文件
    res.sendFile(filePath);
  } catch (error) {
    console.error('下载待发送文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 确认文件已送达，删除服务器上的暂存文件
app.delete('/file/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;

    const pendingFiles = readPendingFilesMeta();
    const fileIndex = pendingFiles.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 删除物理文件
    const filePath = path.join(pendingFilesDir, fileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 从元数据中移除
    pendingFiles.splice(fileIndex, 1);
    writePendingFilesMeta(pendingFiles);

    return res.json({
      success: true,
      message: '文件已送达，服务器文件已删除'
    });
  } catch (error) {
    console.error('删除待发送文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取文件状态
app.get('/file/status', (req, res) => {
  try {
    const { filename, receiver } = req.query;

    if (!filename || !receiver) {
      return res.status(400).json({
        success: false,
        message: '文件名和接收者不能为空'
      });
    }

    const pendingFiles = readPendingFilesMeta();
    const fileMeta = pendingFiles.find(f => f.filename === filename && f.receiver === receiver);

    if (fileMeta) {
      return res.json({
        success: true,
        status: 'pending',
        expireAt: fileMeta.expireAt,
        sender: fileMeta.sender
      });
    }

    return res.json({
      success: true,
      status: 'none'
    });
  } catch (error) {
    console.error('获取文件状态错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 凭证存储文件路径
const credentialsPath = path.join(__dirname, 'credentials.json');

// 读取凭证
function readCredentials() {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return [];
    }
    const data = fs.readFileSync(credentialsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取凭证错误:', error.message);
    return [];
  }
}

// 写入凭证
function writeCredentials(credentials) {
  try {
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  } catch (error) {
    console.error('写入凭证错误:', error.message);
  }
}

// 验证凭证接口
app.post('/credential/verify', (req, res) => {
  try {
    const { username, token } = req.body;

    if (!username || !token) {
      return res.status(400).json({
        success: false,
        message: '用户名和凭证不能为空'
      });
    }

    const credentials = readCredentials();
    const credential = credentials.find(c => c.username === username && c.token === token);

    if (!credential) {
      return res.json({
        success: false,
        message: '凭证无效'
      });
    }

    // 检查凭证是否过期（30天）
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - credential.createdAt > thirtyDays) {
      // 删除过期凭证
      const updatedCredentials = credentials.filter(c => c.username !== username || c.token !== token);
      writeCredentials(updatedCredentials);
      return res.json({
        success: false,
        message: '凭证已过期'
      });
    }

    return res.json({
      success: true,
      message: '凭证有效'
    });
  } catch (error) {
    console.error('验证凭证错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 创建凭证（登录时调用）
app.post('/credential/create', (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    // 生成随机凭证
    const token = `${username}:${Date.now()}:${Math.random().toString(36).substr(2)}`;

    const credentials = readCredentials();

    // 删除该用户的旧凭证
    const filteredCredentials = credentials.filter(c => c.username !== username);

    // 添加新凭证
    filteredCredentials.push({
      username,
      token,
      createdAt: Date.now()
    });

    writeCredentials(filteredCredentials);

    return res.json({
      success: true,
      token
    });
  } catch (error) {
    console.error('创建凭证错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 根据用户名获取用户信息
app.get('/user/:username', (req, res) => {
  try {
    const { username } = req.params;
    const users = readUsersFromFile();

    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const { password, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = app;