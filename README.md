# 整体架构
项目是 Next.js 16 App Router + React 19 + Ant Design + Supabase，核心分成 5 层：

## 页面路由层（Server Component）
负责鉴权、查数据、拼装页面壳
例如首页 app/page.tsx
入库 app/inbound/page.tsx
出库 app/outbound/page.tsx
库存 app/inventory/page.tsx
## 交互展示层（Client Component）
负责表单、筛选、表格、统计卡片、移动端适配
首页 app/home-client.tsx
入库 app/inbound/inbound-client.tsx
出库 app/outbound/outbound-client.tsx
库存 app/inventory/inventory-client.tsx
## 写操作层（Server Actions）
入库写入 create_stock_in RPC
出库写入 create_stock_out RPC
并统一 revalidatePath 刷新四个页面
文件：
app/inbound/actions.ts
app/outbound/actions.ts
## 领域服务层（库存查询/权限/校验）
权限与仓库范围：loadInventoryAccess
查询仓库/产品/流水/库存视图
表单参数校验（UUID、日期、数量）
文件：
src/lib/inventory/queries.ts
src/lib/inventory/validators.ts
src/lib/inventory/types.ts
## 基础设施层（会话与 Supabase）
HMAC 签名 cookie 会话
Server 端 Supabase client（基于 cookie）
文件：
src/lib/auth/session.ts
src/lib/auth/access.ts
src/lib/supabase/server.ts

统一数据流（核心）
现在四个页面都围绕同一公式：

当前库存 = 累计入库(IN) - 累计出库(OUT)

入库页面提交 -> create_stock_in
出库页面提交 -> create_stock_out（数据库函数里有库存不足拦截）
Dashboard 和库存页都从 v_current_inventory 读数据
最新出入库记录从 v_stock_movements 读数据
这意味着业务层已经和客户要求完全一致：按“流水”记账，而不是直接改“余额”。

## 各页面功能

### 登录页 /login
表单登录，登录成功写签名 session cookie
支持 next 回跳
文件：
app/login/page.tsx
app/login/login-form.tsx
app/login/actions.ts
### 主面板 /
统一总览页（已和三页逻辑一致）
显示：
产品数、库存总量、低库存、缺货
库存快照表（可搜索/按仓库筛选）
最新入库、最新出库两张表
文件：
app/page.tsx
app/home-client.tsx
### 入库页 /inbound
表单字段：产品、仓库、数量、业务日期、备注
提交后写入 IN 流水
下方展示最近入库记录
非管理员只能操作自己仓库
文件：
app/inbound/page.tsx
app/inbound/inbound-client.tsx
app/inbound/actions.ts
### 出库页 /outbound
表单同入库
提交时调用 create_stock_out
数据库层会原子校验库存，不够就报错
下方展示最近出库记录
文件：
app/outbound/page.tsx
app/outbound/outbound-client.tsx
app/outbound/actions.ts
### 库存页 /inventory
展示当前库存汇总（不是流水）
统计卡片 + 可搜索 + 管理员仓库筛选
文件：
app/inventory/page.tsx
app/inventory/inventory-client.tsx
## 数据库架构（核心表/视图/函数）
已经通过迁移脚本定义：

仓库表：warehouses
用户表增强：app_users 增加 warehouse_id
产品表增强：products 增加 warehouse_id、safe_stock 等
流水表：stock_movements（IN/OUT）
视图：
v_current_inventory（库存余额）
v_stock_movements（流水展示）
函数：
create_stock_in(...)
create_stock_out(...)（带锁和库存不足校验）
脚本文件：
sql/2026-04-01_inventory_ledger_migration.sql

## 权限与安全

会话：签名 cookie，防篡改
页面保护：
中间件做一层路由拦截 proxy.ts
每个页面和 Action 再做服务端鉴权（双保险）
权限规则：
Admin 可操作所有仓库
非 Admin 只能读写自己 warehouse_id 范围

## UI 与移动端适配

统一页面壳和导航
搜索框/筛选器在小屏自适应换行
表格小屏 small 模式 + 横向滚动
按钮在手机端全宽（入库/出库）
统一组件：
src/components/wms-shell.tsx
src/components/wms-nav.tsx

> 补充
当前状态里的两个历史遗留点
老的产品 CRUD 逻辑还在：
app/products/actions.ts
老的 dashboard-client.tsx 也还在，但首页已不再依赖它：
app/dashboard-client.tsx