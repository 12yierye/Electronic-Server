// 设置终端中文输出支持
process.stdout.setEncoding('utf8');

// Windows环境下切换代码页至UTF-8
if (process.platform === "win32") {
  const { execSync } = require('child_process');
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch (error) {
    console.log('无法设置代码页为UTF-8');
  }
}

const path = require('path');

// 启动服务器
const server = require('./server.js');

console.log('Electronic 服务器启动脚本');
console.log('========================');
console.log('服务器正在启动中...');