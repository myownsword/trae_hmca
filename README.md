# 家庭药箱管理系统 (HMCA)

Home Medicine Cabinet Administration — 基于 React + Vite + Express + lowdb 的家庭药箱管理应用。

---

## 功能特性

### 药品管理
- ✅ 录入药品信息：名称、批号、数量、有效期、存放位置、服用备注
- ✅ 编辑、删除药品
- ✅ 批号唯一性校验

### 库存操作
- ✅ 入库：增加库存，自动记录流水
- ✅ 取用：减少库存，自动校验库存是否充足
- ✅ 报废：处理过期或损坏药品，记录流水
- ✅ 库存不足（≤0）时自动禁止取用

### 筛选查询
- ✅ 按状态筛选：全部 / 即将过期（30天内）/ 已过期 / 库存不足（≤5）/ 缺货
- ✅ 按存放位置筛选

### 流水记录
- ✅ 所有入库、取用、报废操作自动形成流水
- ✅ 记录操作时间、数量、备注
- ✅ 服务重启后数据不丢失（持久化到 JSON 文件）

### 首页仪表盘
- ✅ 近 30 天取用次数统计
- ✅ 即将过期药品列表（显示剩余天数，按紧急程度分色）
- ✅ 药品总数、库存不足、已过期数量卡片

### CSV 导入导出
- ✅ **导入预览**：展示将新增、跳过、报错的行数及详细原因
- ✅ 导入校验：日期格式、数量非负整数、重复批号检测
- ✅ 导入确认：仅导入校验通过的数据
- ✅ **导出**：包含当前库存、最近一次操作类型/数量/时间/备注

### 过期药品处理
- ✅ 独立的过期药品处理入口
- ✅ 一键报废所有库存（自动记录流水）
- ✅ 单个或批量处理过期药品

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite 5 | 构建工具与 UI 框架 |
| 后端 | Express 4 | REST API 服务 |
| 数据库 | lowdb 1.x | JSON 文件持久化存储 |
| 文件上传 | Multer | CSV 文件解析 |
| 跨域 | CORS | 前后端通信 |

---

## 目录结构

```
hmca/
├── backend/                  # Express 后端服务
│   ├── package.json          # 后端依赖配置
│   ├── server.js             # 主服务入口（所有 API 路由）
│   ├── db.js                 # lowdb 数据库初始化
│   ├── utils.js              # 工具函数（日期、CSV 解析等）
│   └── data.json             # 数据存储文件（运行后自动生成）
│
├── frontend/                 # React + Vite 前端应用
│   ├── package.json          # 前端依赖配置
│   ├── vite.config.js        # Vite 配置（含 API 代理）
│   ├── index.html            # HTML 入口
│   └── src/
│       ├── main.jsx          # React 应用入口
│       ├── App.jsx           # 主组件（导航 + 视图切换）
│       ├── api.js            # 后端 API 封装
│       ├── styles.css        # 全局样式
│       └── components/
│           ├── Dashboard.jsx          # 首页仪表盘
│           ├── MedicineList.jsx       # 药品列表（含筛选）
│           ├── MedicineForm.jsx       # 新增/编辑药品表单
│           ├── TransactionList.jsx    # 流水记录
│           ├── ImportExport.jsx       # CSV 导入导出
│           └── ExpiredMedicines.jsx   # 过期药品处理
│
└── README.md                 # 本文档
```

---

## 快速开始

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装与启动

#### 1. 启动后端服务（端口 3003）

```bash
cd backend
npm install
npm start
```

后端服务启动后访问：http://localhost:3003

#### 2. 启动前端服务（端口 5173）

新开一个终端窗口：

```bash
cd frontend
npm install
npm run dev
```

前端服务启动后访问：http://localhost:5173

> 前端已配置 `/api` 代理到 `http://localhost:3003`，无需手动处理跨域。

---

## 启动与验证指南

### 1. 后端启动验证

启动后端服务后，执行以下命令验证 API 正常：

```bash
# 验证统计接口
curl http://localhost:3003/api/statistics

# 验证药品列表接口
curl http://localhost:3003/api/medicines

# 验证流水记录接口
curl http://localhost:3003/api/transactions
```

预期返回：空数组或包含测试数据的 JSON 响应，HTTP 状态码 200。

### 2. 前端启动验证

启动前端服务后，在浏览器访问 http://localhost:5173，应看到：
- 页面标题显示「家庭药箱管理系统」
- 顶部导航栏包含「首页、药品管理、流水记录、过期处理、导入导出」
- 首页显示统计卡片和即将过期药品列表

### 3. 核心功能验证流程

#### 验证 1：新增药品与入库
1. 点击「药品管理」→「新增药品」
2. 填写：名称=阿莫西林、批号=AMX-TEST-001、数量=20、有效期=2026-12-31、位置=客厅药箱
3. 提交后，药品列表应显示该药品，库存为 20
4. 点击「流水记录」，应看到一条「初始入库」记录

#### 验证 2：取用操作
1. 在药品列表中点击「取用」
2. 输入数量=5，提交
3. 库存应变为 15
4. 流水记录新增一条「取用」记录

#### 验证 3：库存不足校验
1. 尝试取用 100 个（超过当前库存）
2. 系统应提示「库存不足」，操作被拒绝
3. 库存保持 15 不变

#### 验证 4：CSV 导入校验
准备一个测试 CSV 文件 `test.csv`：
```
name,batchNo,quantity,expiryDate,location,note
感冒灵,GL-TEST-001,10,2026-12-31,客厅药箱,冲服
无效日期药,INV-DATE,5,not-a-date,卧室,
二月三十号药,FEB-30,10,2026-02-30,急救包,
```

1. 进入「导入导出」页面
2. 上传该 CSV 文件，点击「预览导入」
3. 验证：
   - 报错 = 2 条（not-a-date 和 2026-02-30 都是无效日期）
   - 将新增 = 1 条（感冒灵）
   - 「确认导入」按钮应被禁用，并有红色错误提示
   - 即使强行调用导入，后端也会拒绝整份文件

**原子性验证**：CSV 存在任何错误时，导入将被整份拒绝，不会有部分数据被写入。

#### 验证 5：数据持久化
1. 记录当前药品数量和流水数量
2. 重启后端服务（Ctrl+C 后重新 `npm start`）
3. 刷新前端页面，所有数据应保持不变

### 4. CSV 导入校验规则

| 校验项 | 规则 | 示例错误 | 处理方式 |
|--------|------|----------|----------|
| 必填列 | name、batchNo、quantity、expiryDate 不能为空 | 缺少 name 列 | 进入 errors |
| 日期格式 | 必须为 YYYY-MM-DD 且是真实日历日期 | 2026-02-30、not-a-date、2026/12/31 | 进入 errors |
| 数量格式 | 必须是非负整数 | abc、-5、3.14 | 进入 errors |
| 重复批号（与库内） | 批号不能与现有药品重复 | 上传已存在的 AMX-TEST-001 | 进入 skipped |
| 重复批号（CSV 内） | 同一 CSV 内批号不能重复 | CSV 内两行相同批号 | 进入 errors |

> **重要**：只要存在任意一条 errors 记录，整份文件将被拒绝导入，库存和流水保持不变。skipped 记录不影响导入，但不会被写入。

---

## API 接口文档

### 统计接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics` | 获取首页统计数据 |

响应示例：
```json
{
  "usageCountLast30Days": 12,
  "expiringSoon": [
    { "id": "...", "name": "阿莫西林", "batchNo": "AMX202401", "expiryDate": "2025-07-15", "daysLeft": 25, "quantity": 10 }
  ],
  "expiredCount": 2,
  "lowStockCount": 3,
  "totalMedicines": 15
}
```

### 药品接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/medicines` | 获取药品列表，支持 `filter` 和 `location` 查询参数 |
| GET | `/api/medicines/:id` | 获取单个药品详情 |
| GET | `/api/medicines/locations` | 获取所有存放位置列表 |
| POST | `/api/medicines` | 新增药品 |
| PUT | `/api/medicines/:id` | 更新药品信息 |
| DELETE | `/api/medicines/:id` | 删除药品（同步删除关联流水） |

#### 筛选参数 `filter`
- `expiring`：即将过期（30 天内且未过期）
- `expired`：已过期
- `lowstock`：库存不足（0 < 数量 ≤ 5）
- `outofstock`：缺货（数量 ≤ 0）

#### 新增药品请求体
```json
{
  "name": "阿莫西林胶囊",
  "batchNo": "AMX20240101",
  "quantity": 20,
  "expiryDate": "2026-12-31",
  "location": "客厅药箱",
  "note": "每日3次，每次2粒，饭后服用"
}
```

### 库存操作接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/medicines/:id/stock` | 入库 |
| POST | `/api/medicines/:id/take` | 取用（库存不足返回 400） |
| POST | `/api/medicines/:id/discard` | 报废 |
| POST | `/api/expired/:id/discard` | 过期药品一键报废全部库存 |

请求体：
```json
{
  "quantity": 5,
  "note": "备注信息"
}
```

### 流水接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/transactions` | 获取流水记录，支持 `medicineId`、`type`、`limit` 参数 |

流水类型 `type`：
- `stock`：入库
- `take`：取用
- `discard`：报废

### CSV 导入导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/preview` | 导入预览，返回新增/跳过/报错行数及详情 |
| POST | `/api/import/confirm` | 确认导入，仅写入校验通过的数据 |
| GET | `/api/export` | 导出当前所有药品数据为 CSV |

#### CSV 文件格式（UTF-8，首行为表头）

```
name,batchNo,quantity,expiryDate,location,note
阿莫西林胶囊,AMX20240101,20,2026-12-31,客厅药箱,每日3次每次2粒
布洛芬片,IBU20240201,30,2025-06-30,卧室抽屉,发烧时服用
```

#### 导入预览响应示例
```json
{
  "total": 5,
  "toAdd": 3,
  "skipped": 1,
  "errors": 1,
  "details": {
    "toAdd": [
      { "line": 2, "data": { "name": "阿莫西林", "batchNo": "...", ... } }
    ],
    "skipped": [
      { "line": 3, "reason": "批号已存在: AMX20240101", "data": { ... } }
    ],
    "errors": [
      { "line": 4, "reason": "有效期格式无效: 2025/13/40; 数量必须是非负整数: abc", "data": { ... } }
    ]
  }
}
```

#### 导入校验规则
1. **必填列**：`name`、`batchNo`、`quantity`、`expiryDate` 不能为空
2. **日期格式**：`expiryDate` 必须是 **严格 YYYY-MM-DD 格式的真实日历日期（如 `2026-02-30`、`not-a-date`、`2026/12/31` 都会被拒绝）
3. **数量格式**：`quantity` 必须是非负整数
4. **重复批号**：与现有数据或 CSV 内重复的批号会被跳过或报错

> **安全策略**：只要 CSV 中存在任意一条 errors 记录，**整份文件将被拒绝导入**，不会有部分数据被写入，库存和流水保持不变。skipped 记录（如与库内重复批号）不影响导入，但不会被写入。

---

## 使用指南

### 1. 添加药品
1. 进入「药品管理」页面
2. 点击「新增药品」按钮
3. 填写药品信息（名称、批号、数量、有效期为必填项）
4. 提交后自动记录初始入库流水

### 2. 日常操作
- **入库**：在药品列表点击「入库」，输入数量和备注
- **取用**：点击「取用」，输入数量（库存不足时按钮禁用）
- **报废**：点击「报废」，输入数量和原因

### 3. 筛选药品
使用顶部筛选栏可按以下条件筛选：
- 药品状态：全部 / 即将过期 / 已过期 / 库存不足 / 缺货
- 存放位置：下拉选择已录入的位置

### 4. 导入药品
1. 进入「导入导出」页面
2. 点击或拖拽 CSV 文件到上传区域
3. 查看导入预览（新增 / 跳过 / 报错的行数及详情）
4. 确认无误后点击「确认导入」

### 5. 导出数据
在「导入导出」页面点击「导出 CSV」，下载的文件包含：
- 药品基本信息（名称、批号、库存、有效期、位置、备注）
- 距离过期天数
- 最近一次操作（类型、数量、时间、备注）

### 6. 处理过期药品
1. 进入「过期处理」页面，查看所有已过期药品
2. 可单独点击「报废全部」处理单个药品
3. 或点击「一键处理所有过期药品」批量报废

---

## 数据持久化

所有数据存储在 `backend/data.json` 文件中，结构如下：

```json
{
  "medicines": [
    {
      "id": "...",
      "name": "阿莫西林胶囊",
      "batchNo": "AMX20240101",
      "quantity": 20,
      "expiryDate": "2026-12-31",
      "location": "客厅药箱",
      "note": "每日3次，每次2粒",
      "createdAt": "2025-06-20T10:00:00.000Z"
    }
  ],
  "transactions": [
    {
      "id": "...",
      "medicineId": "...",
      "medicineName": "阿莫西林胶囊",
      "type": "stock",
      "quantity": 20,
      "note": "初始入库",
      "createdAt": "2025-06-20T10:00:00.000Z"
    }
  ]
}
```

> 如需备份数据，直接复制 `data.json` 文件即可。如需重置数据，删除该文件后重启后端服务。

---

## 常见问题

### Q: 后端启动后如何确认服务正常？
访问 http://localhost:3001/api/statistics ，应返回 JSON 数据（即使是空数据）。

### Q: 前端页面显示空白或报错？
- 确认后端服务已启动（端口 3001）
- 打开浏览器开发者工具查看控制台和网络请求
- 确认 Vite 开发服务器正常运行

### Q: CSV 导入乱码？
请确保 CSV 文件使用 **UTF-8** 编码保存。导出功能已自动添加 UTF-8 BOM，Excel 打开不会乱码。

### Q: 如何修改端口？
- 后端：修改 `backend/server.js` 末尾的 `PORT` 变量
- 前端：修改 `frontend/vite.config.js` 中的 `server.port` 和 `proxy.target`

### Q: 数据可以迁移吗？
可以，直接复制 `backend/data.json` 文件到新环境即可。

---

## 开发说明

### 前端开发
```bash
cd frontend
npm run dev      # 开发模式（热更新）
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

### 后端开发
```bash
cd backend
npm start        # 启动服务
```

修改代码后需手动重启后端服务（可使用 nodemon 实现热重载）。

---

## 许可证

MIT
