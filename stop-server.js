#!/usr/bin/env node

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

// 获取当前操作系统平台
const platform = os.platform();

console.log('正在停止 Electronic 服务器...');

// 根据不同平台执行不同的停止命令
if (platform === 'win32') {
  // Windows 系统
  exec('taskkill /F /IM node.exe', (error, stdout, stderr) => {
    if (error) {
      if (error.message.includes('not found') || error.message.includes('找不到')) {
        console.log('服务未运行或已停止');
      } else {
        console.error(`停止服务时出错: ${error.message}`);
      }
      return;
    }
    
    if (stderr && !stderr.includes('SUCCESS')) {
      console.error(`停止服务时出错: ${stderr}`);
      return;
    }
    
    console.log('服务已成功停止');
  });
} else {
  // Unix-like 系统 (Linux/Mac)
  exec('lsof -t -i:3000', (error, stdout, stderr) => {
    if (error) {
      console.log('服务未运行或已停止');
      return;
    }
    
    if (stdout) {
      const pids = stdout.trim().split('\n').filter(pid => pid);
      if (pids.length > 0) {
        exec(`kill -9 ${pids.join(' ')}`, (killError, killStdout, killStderr) => {
          if (killError) {
            console.error(`停止服务时出错: ${killError.message}`);
            return;
          }
          
          console.log(`服务已成功停止 (PID: ${pids.join(', ')})`);
        });
      } else {
        console.log('服务未运行或已停止');
      }
    } else {
      console.log('服务未运行或已停止');
    }
  });
}