# BeeHears Plugin 部署指南

## 前置条件

- 远程服务器已运行 Sub2API（sub2api、postgres、redis 容器均 healthy）
- 插件代码已同步到服务器 `plugins/beehears-plugin/` 目录

## 环境变量配置

在 `/opt/sub2api-deploy/.env` 中添加：

```bash
# [必须] Sub2API 管理员 API Token
# 用于插件调用 Sub2API 管理接口（reset-quota、订阅同步等）
# 获取方式：登录 Sub2API 管理后台 → 系统设置 → API Token
SUB2API_ADMIN_TOKEN=your-admin-token-here

# [必须] 自动转结昨日结算账本专用 token
# 只用于调用 /api/v1/admin/subscriptions/usage-rollover-snapshot
SUB2API_JOB_ROLLOVER_TOKEN=your-rollover-job-token

# [可选] 允许看到“全站订阅”统计卡片的用户 ID（逗号分隔）
# 注意：生产容器读取的是 /opt/sub2api-deploy/.env，不是 plugins/beehears-plugin/.env
ADMIN_USER_IDS=1
```

> **注意**：如果不配置 `SUB2API_ADMIN_TOKEN`，插件可以启动但定时任务（cron jobs）不会注册；如果不配置 `SUB2API_JOB_ROLLOVER_TOKEN`，自动转结会被显式 block，不会继续读取昨日结算账本。

## 部署步骤

```bash
cd /opt/sub2api-deploy

# 1. 只启动插件，不影响其他服务
docker compose up -d --no-deps beehears-plugin

# 2. 查看构建和启动日志
docker compose logs -f beehears-plugin

# 3. 确认健康状态
docker compose ps
curl -f http://127.0.0.1:3001/health
```

## Caddy 反代配置

插件默认绑定 `127.0.0.1:3001`，需要通过 Caddy 对外暴露。在 Caddyfile 中添加：

```
plugin.beehears.com {
    reverse_proxy 127.0.0.1:3001
}
```

## 回滚

```bash
docker compose stop beehears-plugin
docker compose rm -f beehears-plugin
```

不影响 sub2api、postgres、redis。
