const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./db');
const {
  daysUntil,
  isValidDate,
  isValidTime,
  isPositiveInteger,
  isNonNegativeInteger,
  generateId,
  parseCSV,
  toCSV,
  formatDate,
  isDateInRange,
  isDateBefore,
  isDateAfter,
  getDayOfWeek
} = require('./utils');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

function addTransaction(medicineId, medicineName, type, quantity, note = '') {
  const transaction = {
    id: generateId(),
    medicineId,
    medicineName,
    type,
    quantity,
    note,
    createdAt: new Date().toISOString()
  };
  db.get('transactions').push(transaction).write();
  return transaction;
}

function getLastTransaction(medicineId) {
  return db.get('transactions')
    .filter({ medicineId })
    .sortBy('createdAt')
    .last()
    .value();
}

app.get('/api/statistics', (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const usageCount = db.get('transactions')
    .filter(t => t.type === 'take' && t.createdAt >= thirtyDaysAgo)
    .size()
    .value();

  const medicines = db.get('medicines').value();
  const expiringSoon = medicines
    .filter(m => {
      const days = daysUntil(m.expiryDate);
      return days >= 0 && days <= 30;
    })
    .map(m => ({
      id: m.id,
      name: m.name,
      batchNo: m.batchNo,
      expiryDate: m.expiryDate,
      daysLeft: daysUntil(m.expiryDate),
      quantity: m.quantity
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const expiredCount = medicines.filter(m => daysUntil(m.expiryDate) < 0).length;
  const lowStockCount = medicines.filter(m => m.quantity <= 5 && m.quantity > 0).length;
  const totalMedicines = medicines.length;

  res.json({
    usageCountLast30Days: usageCount,
    expiringSoon,
    expiredCount,
    lowStockCount,
    totalMedicines
  });
});

app.get('/api/medicines', (req, res) => {
  const { filter, location } = req.query;
  let medicines = db.get('medicines').value();

  if (filter === 'expiring') {
    medicines = medicines.filter(m => {
      const days = daysUntil(m.expiryDate);
      return days >= 0 && days <= 30;
    });
  } else if (filter === 'expired') {
    medicines = medicines.filter(m => daysUntil(m.expiryDate) < 0);
  } else if (filter === 'lowstock') {
    medicines = medicines.filter(m => m.quantity <= 5 && m.quantity > 0);
  } else if (filter === 'outofstock') {
    medicines = medicines.filter(m => m.quantity <= 0);
  }

  if (location) {
    medicines = medicines.filter(m => m.location === location);
  }

  const result = medicines.map(m => ({
    ...m,
    daysLeft: daysUntil(m.expiryDate),
    isExpired: daysUntil(m.expiryDate) < 0,
    lastTransaction: getLastTransaction(m.id)
  }));

  res.json(result);
});

app.get('/api/medicines/locations', (req, res) => {
  const locations = [...new Set(db.get('medicines').map(m => m.location).filter(Boolean).value())];
  res.json(locations);
});

app.get('/api/medicines/:id', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }
  res.json({
    ...medicine,
    daysLeft: daysUntil(medicine.expiryDate),
    isExpired: daysUntil(medicine.expiryDate) < 0,
    lastTransaction: getLastTransaction(medicine.id)
  });
});

app.post('/api/medicines', (req, res) => {
  const { name, batchNo, quantity, expiryDate, location, note } = req.body;

  if (!name || !batchNo || quantity === undefined || !expiryDate) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const qty = parseInt(quantity, 10);
  if (!isNonNegativeInteger(qty)) {
    return res.status(400).json({ error: '数量必须是非负整数' });
  }

  if (!isValidDate(expiryDate)) {
    return res.status(400).json({ error: '有效期格式无效' });
  }

  const existing = db.get('medicines').find({ batchNo }).value();
  if (existing) {
    return res.status(400).json({ error: '批号已存在' });
  }

  const medicine = {
    id: generateId(),
    name,
    batchNo,
    quantity: qty,
    expiryDate,
    location: location || '',
    note: note || '',
    createdAt: new Date().toISOString()
  };

  db.get('medicines').push(medicine).write();

  if (qty > 0) {
    addTransaction(medicine.id, medicine.name, 'stock', qty, '初始入库');
  }

  res.status(201).json(medicine);
});

app.put('/api/medicines/:id', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  const { name, expiryDate, location, note } = req.body;

  if (expiryDate !== undefined && !isValidDate(expiryDate)) {
    return res.status(400).json({ error: '有效期格式无效' });
  }

  if (name !== undefined) medicine.name = name;
  if (expiryDate !== undefined) medicine.expiryDate = expiryDate;
  if (location !== undefined) medicine.location = location;
  if (note !== undefined) medicine.note = note;

  db.get('medicines').find({ id: req.params.id }).assign(medicine).write();
  res.json(medicine);
});

app.delete('/api/medicines/:id', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }
  db.get('medicines').remove({ id: req.params.id }).write();
  db.get('transactions').remove({ medicineId: req.params.id }).write();
  res.json({ message: '已删除' });
});

app.post('/api/medicines/:id/stock', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  const { quantity, note } = req.body;
  const qty = parseInt(quantity, 10);
  if (!isPositiveInteger(qty)) {
    return res.status(400).json({ error: '入库数量必须是正整数' });
  }

  medicine.quantity += qty;
  db.get('medicines').find({ id: req.params.id }).assign({ quantity: medicine.quantity }).write();
  const tx = addTransaction(medicine.id, medicine.name, 'stock', qty, note || '');
  res.json({ medicine, transaction: tx });
});

app.post('/api/medicines/:id/take', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  const { quantity, note } = req.body;
  const qty = parseInt(quantity, 10);
  if (!isPositiveInteger(qty)) {
    return res.status(400).json({ error: '取用数量必须是正整数' });
  }

  if (medicine.quantity < qty) {
    return res.status(400).json({ error: `库存不足，当前库存 ${medicine.quantity}` });
  }

  if (medicine.quantity <= 0) {
    return res.status(400).json({ error: '库存不足，无法取用' });
  }

  medicine.quantity -= qty;
  db.get('medicines').find({ id: req.params.id }).assign({ quantity: medicine.quantity }).write();
  const tx = addTransaction(medicine.id, medicine.name, 'take', qty, note || '');
  res.json({ medicine, transaction: tx });
});

app.post('/api/medicines/:id/discard', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  const { quantity, note } = req.body;
  const qty = parseInt(quantity, 10);
  if (!isPositiveInteger(qty)) {
    return res.status(400).json({ error: '报废数量必须是正整数' });
  }

  if (medicine.quantity < qty) {
    return res.status(400).json({ error: `库存不足，当前库存 ${medicine.quantity}` });
  }

  medicine.quantity -= qty;
  db.get('medicines').find({ id: req.params.id }).assign({ quantity: medicine.quantity }).write();
  const tx = addTransaction(medicine.id, medicine.name, 'discard', qty, note || '');
  res.json({ medicine, transaction: tx });
});

app.get('/api/transactions', (req, res) => {
  const { medicineId, type, limit } = req.query;
  let txs = db.get('transactions').sortBy(t => -new Date(t.createdAt).getTime()).value();

  if (medicineId) {
    txs = txs.filter(t => t.medicineId === medicineId);
  }
  if (type) {
    txs = txs.filter(t => t.type === type);
  }
  if (limit) {
    txs = txs.slice(0, parseInt(limit, 10));
  }

  res.json(txs);
});

app.post('/api/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const text = req.file.buffer.toString('utf-8');
  let rows;
  try {
    rows = parseCSV(text);
  } catch (e) {
    return res.status(400).json({ error: 'CSV 解析失败' });
  }

  const requiredHeaders = ['name', 'batchNo', 'quantity', 'expiryDate'];
  const headers = rows.length > 0 ? Object.keys(rows[0].data) : [];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return res.status(400).json({ error: `缺少必要列: ${missingHeaders.join(', ')}` });
  }

  const existingBatchNos = new Set(db.get('medicines').map(m => m.batchNo).value());
  const seenBatchNos = new Set();

  const toAdd = [];
  const skipped = [];
  const errors = [];

  rows.forEach(({ line, data }) => {
    const rowErrors = [];

    if (!data.name) rowErrors.push('药品名称不能为空');
    if (!data.batchNo) rowErrors.push('批号不能为空');
    if (!data.expiryDate) rowErrors.push('有效期不能为空');
    if (data.quantity === undefined || data.quantity === '') rowErrors.push('数量不能为空');

    if (data.expiryDate && !isValidDate(data.expiryDate)) {
      rowErrors.push(`有效期格式无效: ${data.expiryDate}`);
    }

    let qty = null;
    if (data.quantity !== undefined && data.quantity !== '') {
      qty = parseInt(data.quantity, 10);
      if (!isNonNegativeInteger(qty)) {
        rowErrors.push(`数量必须是非负整数: ${data.quantity}`);
      }
    }

    if (data.batchNo) {
      if (existingBatchNos.has(data.batchNo)) {
        skipped.push({
          line,
          reason: `批号已存在: ${data.batchNo}`,
          data
        });
        return;
      }
      if (seenBatchNos.has(data.batchNo)) {
        errors.push({
          line,
          reason: `CSV 内重复批号: ${data.batchNo}`,
          data
        });
        return;
      }
      seenBatchNos.add(data.batchNo);
    }

    if (rowErrors.length > 0) {
      errors.push({
        line,
        reason: rowErrors.join('; '),
        data
      });
      return;
    }

    toAdd.push({
      line,
      data: {
        name: data.name,
        batchNo: data.batchNo,
        quantity: qty,
        expiryDate: data.expiryDate,
        location: data.location || '',
        note: data.note || ''
      }
    });
  });

  res.json({
    total: rows.length,
    toAdd: toAdd.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { toAdd, skipped, errors }
  });
});

app.post('/api/import/confirm', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const text = req.file.buffer.toString('utf-8');
  let rows;
  try {
    rows = parseCSV(text);
  } catch (e) {
    return res.status(400).json({ error: 'CSV 解析失败' });
  }

  const existingBatchNos = new Set(db.get('medicines').map(m => m.batchNo).value());
  const seenBatchNos = new Set();
  const toAdd = [];
  const errors = [];
  const skipped = [];

  for (const { line, data } of rows) {
    const rowErrors = [];

    if (!data.name) rowErrors.push('药品名称不能为空');
    if (!data.batchNo) rowErrors.push('批号不能为空');
    if (!data.expiryDate) rowErrors.push('有效期不能为空');
    if (data.quantity === undefined || data.quantity === '') rowErrors.push('数量不能为空');

    if (data.expiryDate && !isValidDate(data.expiryDate)) {
      rowErrors.push(`有效期格式无效: ${data.expiryDate}`);
    }

    let qty = null;
    if (data.quantity !== undefined && data.quantity !== '') {
      qty = parseInt(data.quantity, 10);
      if (!isNonNegativeInteger(qty)) {
        rowErrors.push(`数量必须是非负整数: ${data.quantity}`);
      }
    }

    if (data.batchNo) {
      if (existingBatchNos.has(data.batchNo)) {
        skipped.push({
          line,
          reason: `批号已存在: ${data.batchNo}`,
          data
        });
        continue;
      }
      if (seenBatchNos.has(data.batchNo)) {
        errors.push({
          line,
          reason: `CSV 内重复批号: ${data.batchNo}`,
          data
        });
        continue;
      }
      seenBatchNos.add(data.batchNo);
    }

    if (rowErrors.length > 0) {
      errors.push({
        line,
        reason: rowErrors.join('; '),
        data
      });
      continue;
    }

    toAdd.push({
      line,
      data: {
        name: data.name,
        batchNo: data.batchNo,
        quantity: qty,
        expiryDate: data.expiryDate,
        location: data.location || '',
        note: data.note || ''
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: `导入文件存在 ${errors.length} 条错误记录，已拒绝整份文件。请修正后重新导入。`,
      details: { errors, skipped }
    });
  }

  const added = [];
  for (const { data } of toAdd) {
    const medicine = {
      id: generateId(),
      name: data.name,
      batchNo: data.batchNo,
      quantity: data.quantity,
      expiryDate: data.expiryDate,
      location: data.location || '',
      note: data.note || '',
      createdAt: new Date().toISOString()
    };
    db.get('medicines').push(medicine).write();
    added.push(medicine);

    if (data.quantity > 0) {
      addTransaction(medicine.id, medicine.name, 'stock', data.quantity, '批量导入入库');
    }
  }

  res.json({ added: added.length, skipped: skipped.length, medicines: added });
});

app.get('/api/export', (req, res) => {
  const medicines = db.get('medicines').value();
  const rows = medicines.map(m => {
    const lastTx = getLastTransaction(m.id);
    return {
      name: m.name,
      batchNo: m.batchNo,
      quantity: m.quantity,
      expiryDate: m.expiryDate,
      location: m.location,
      note: m.note,
      daysLeft: daysUntil(m.expiryDate),
      lastOperationType: lastTx ? (lastTx.type === 'stock' ? '入库' : lastTx.type === 'take' ? '取用' : '报废') : '',
      lastOperationQuantity: lastTx ? lastTx.quantity : '',
      lastOperationDate: lastTx ? lastTx.createdAt : '',
      lastOperationNote: lastTx ? lastTx.note : ''
    };
  });

  const headers = [
    'name', 'batchNo', 'quantity', 'expiryDate', 'location', 'note',
    'daysLeft', 'lastOperationType', 'lastOperationQuantity', 'lastOperationDate', 'lastOperationNote'
  ];
  const csv = toCSV(headers, rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="medicines.csv"');
  res.send('\uFEFF' + csv);
});

app.post('/api/expired/:id/discard', (req, res) => {
  const medicine = db.get('medicines').find({ id: req.params.id }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  const days = daysUntil(medicine.expiryDate);
  if (days >= 0) {
    return res.status(400).json({ error: '该药品尚未过期' });
  }

  if (medicine.quantity <= 0) {
    return res.status(400).json({ error: '该药品库存为零' });
  }

  const qty = medicine.quantity;
  medicine.quantity = 0;
  db.get('medicines').find({ id: req.params.id }).assign({ quantity: 0 }).write();
  const tx = addTransaction(medicine.id, medicine.name, 'discard', qty, req.body.note || '过期药品处理');

  res.json({ medicine, transaction: tx });
});

function addPlanLog(planId, medicineId, medicineName, batchNo, memberName, scheduledDate, scheduledTime, action, quantity, note = '') {
  const log = {
    id: generateId(),
    planId,
    medicineId,
    medicineName,
    batchNo,
    memberName,
    scheduledDate,
    scheduledTime,
    action,
    quantity,
    note,
    createdAt: new Date().toISOString()
  };
  db.get('planLogs').push(log).write();
  return log;
}

function shouldPlanRunOnDate(plan, dateStr) {
  if (plan.status !== 'active') return false;
  if (!isDateInRange(dateStr, plan.startDate, plan.endDate)) return false;
  const dayOfWeek = getDayOfWeek(dateStr);
  return plan.frequencyDays.includes(dayOfWeek);
}

function generatePlanScheduleItems(plan, dateStr) {
  if (!shouldPlanRunOnDate(plan, dateStr)) return [];
  return plan.reminderTimes.map(time => ({
    planId: plan.id,
    medicineId: plan.medicineId,
    medicineName: plan.medicineName,
    batchNo: plan.batchNo,
    memberName: plan.memberName,
    dosagePerTime: plan.dosagePerTime,
    scheduledDate: dateStr,
    scheduledTime: time,
    note: plan.note
  }));
}

function isPlanItemCompleted(planId, scheduledDate, scheduledTime) {
  return db.get('planLogs')
    .find({ planId, scheduledDate, scheduledTime })
    .value() !== undefined;
}

function validatePlanRequest(body, isUpdate = false) {
  const errors = [];
  const {
    medicineId, memberName, dosagePerTime, frequency,
    frequencyDays, startDate, endDate, reminderTimes
  } = body;

  if (!isUpdate || medicineId !== undefined) {
    if (!medicineId) errors.push('药品ID不能为空');
  }

  if (!isUpdate || memberName !== undefined) {
    if (!memberName || !memberName.trim()) errors.push('成员姓名不能为空');
  }

  if (!isUpdate || dosagePerTime !== undefined) {
    const dosage = parseInt(dosagePerTime, 10);
    if (!isPositiveInteger(dosage)) errors.push('每次用量必须是正整数');
  }

  if (!isUpdate || frequency !== undefined) {
    if (!['daily', 'weekly'].includes(frequency)) errors.push('频次必须是 daily 或 weekly');
  }

  if (!isUpdate || frequencyDays !== undefined) {
    if (!Array.isArray(frequencyDays) || frequencyDays.length === 0) {
      errors.push('频次日期不能为空');
    } else {
      const validDays = [0, 1, 2, 3, 4, 5, 6];
      const allValid = frequencyDays.every(d => validDays.includes(d));
      if (!allValid) errors.push('频次日期包含无效值');
    }
  }

  if (!isUpdate || startDate !== undefined) {
    if (!startDate || !isValidDate(startDate)) errors.push('开始日期格式无效');
  }

  if (!isUpdate || endDate !== undefined) {
    if (!endDate || !isValidDate(endDate)) errors.push('结束日期格式无效');
  }

  if ((!isUpdate || startDate !== undefined || endDate !== undefined) &&
      body.startDate && body.endDate) {
    if (isDateAfter(body.startDate, body.endDate)) {
      errors.push('开始日期不能晚于结束日期');
    }
  }

  if (!isUpdate || reminderTimes !== undefined) {
    if (!Array.isArray(reminderTimes) || reminderTimes.length === 0) {
      errors.push('提醒时间不能为空');
    } else {
      const allValid = reminderTimes.every(t => isValidTime(t));
      if (!allValid) errors.push('提醒时间格式无效，应为 HH:MM 格式');
    }
  }

  return errors;
}

app.post('/api/plans', (req, res) => {
  const errors = validatePlanRequest(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const {
    medicineId, memberName, dosagePerTime, frequency,
    frequencyDays, startDate, endDate, reminderTimes, note
  } = req.body;

  const medicine = db.get('medicines').find({ id: medicineId }).value();
  if (!medicine) {
    return res.status(404).json({ error: '药品不存在' });
  }

  if (daysUntil(medicine.expiryDate) < 0) {
    return res.status(400).json({ error: '该药品已过期，无法创建用药计划' });
  }

  if (isDateAfter(startDate, medicine.expiryDate)) {
    return res.status(400).json({ error: '计划开始日期晚于药品有效期' });
  }

  if (isDateAfter(endDate, medicine.expiryDate)) {
    return res.status(400).json({ error: '计划结束日期晚于药品有效期' });
  }

  const today = formatDate(new Date());
  if (isDateBefore(endDate, today)) {
    return res.status(400).json({ error: '计划结束日期早于今天' });
  }

  const plan = {
    id: generateId(),
    medicineId: medicine.id,
    medicineName: medicine.name,
    batchNo: medicine.batchNo,
    memberName: memberName.trim(),
    dosagePerTime: parseInt(dosagePerTime, 10),
    frequency,
    frequencyDays: [...frequencyDays].sort((a, b) => a - b),
    startDate,
    endDate,
    reminderTimes: [...reminderTimes].sort(),
    note: note || '',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.get('medicationPlans').push(plan).write();
  res.status(201).json(plan);
});

app.get('/api/plans', (req, res) => {
  const { status, medicineId } = req.query;
  let plans = db.get('medicationPlans').value();

  if (status) {
    plans = plans.filter(p => p.status === status);
  }
  if (medicineId) {
    plans = plans.filter(p => p.medicineId === medicineId);
  }

  const result = plans.map(plan => {
    const medicine = db.get('medicines').find({ id: plan.medicineId }).value();
    const isExpired = medicine ? daysUntil(medicine.expiryDate) < 0 : false;
    const daysLeft = medicine ? daysUntil(medicine.expiryDate) : null;
    return {
      ...plan,
      currentQuantity: medicine ? medicine.quantity : 0,
      isExpired,
      daysLeft
    };
  });

  res.json(result);
});

app.get('/api/plans/today', (req, res) => {
  const today = formatDate(new Date());
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const plans = db.get('medicationPlans')
    .filter({ status: 'active' })
    .value();

  const todayItems = [];
  const overdueItems = [];

  plans.forEach(plan => {
    const medicine = db.get('medicines').find({ id: plan.medicineId }).value();
    if (!medicine) return;

    const isExpired = daysUntil(medicine.expiryDate) < 0;

    for (let d = 0; d <= 7; d++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - d);
      const dateStr = formatDate(checkDate);

      if (!shouldPlanRunOnDate(plan, dateStr)) continue;

      plan.reminderTimes.forEach(time => {
        if (isPlanItemCompleted(plan.id, dateStr, time)) return;

        const item = {
          planId: plan.id,
          medicineId: plan.medicineId,
          medicineName: plan.medicineName,
          batchNo: plan.batchNo,
          memberName: plan.memberName,
          dosagePerTime: plan.dosagePerTime,
          scheduledDate: dateStr,
          scheduledTime: time,
          note: plan.note,
          currentQuantity: medicine.quantity,
          isExpired,
          isToday: dateStr === today,
          isOverdue: dateStr < today || (dateStr === today && time < currentTime)
        };

        if (dateStr === today) {
          todayItems.push(item);
        } else if (dateStr < today) {
          overdueItems.push(item);
        }
      });
    }
  });

  todayItems.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  overdueItems.sort((a, b) => {
    const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
    if (dateCompare !== 0) return dateCompare;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });

  res.json({
    today: todayItems,
    overdue: overdueItems
  });
});

app.get('/api/plans/:id', (req, res) => {
  const plan = db.get('medicationPlans').find({ id: req.params.id }).value();
  if (!plan) {
    return res.status(404).json({ error: '用药计划不存在' });
  }

  const medicine = db.get('medicines').find({ id: plan.medicineId }).value();
  const isExpired = medicine ? daysUntil(medicine.expiryDate) < 0 : false;
  const daysLeft = medicine ? daysUntil(medicine.expiryDate) : null;

  res.json({
    ...plan,
    currentQuantity: medicine ? medicine.quantity : 0,
    isExpired,
    daysLeft
  });
});

app.post('/api/plans/:id/execute', (req, res) => {
  const plan = db.get('medicationPlans').find({ id: req.params.id }).value();
  if (!plan) {
    return res.status(404).json({ error: '用药计划不存在' });
  }

  if (plan.status !== 'active') {
    return res.status(400).json({ error: '该计划已停用，无法执行' });
  }

  const { action, scheduledDate, scheduledTime, note } = req.body;

  if (!['taken', 'skipped'].includes(action)) {
    return res.status(400).json({ error: '操作类型必须是 taken 或 skipped' });
  }

  if (!scheduledDate || !isValidDate(scheduledDate)) {
    return res.status(400).json({ error: '计划日期格式无效' });
  }

  if (!scheduledTime || !isValidTime(scheduledTime)) {
    return res.status(400).json({ error: '计划时间格式无效' });
  }

  if (!shouldPlanRunOnDate(plan, scheduledDate)) {
    return res.status(400).json({ error: '该日期不在计划执行范围内' });
  }

  if (!plan.reminderTimes.includes(scheduledTime)) {
    return res.status(400).json({ error: '该时间不在计划提醒时间内' });
  }

  if (isPlanItemCompleted(plan.id, scheduledDate, scheduledTime)) {
    return res.status(400).json({ error: '该计划项已执行过' });
  }

  const medicine = db.get('medicines').find({ id: plan.medicineId }).value();
  if (!medicine) {
    return res.status(404).json({ error: '关联药品不存在' });
  }

  if (daysUntil(medicine.expiryDate) < 0) {
    return res.status(400).json({ error: '该药品已过期，请先处理过期药品' });
  }

  if (action === 'taken') {
    if (medicine.quantity < plan.dosagePerTime) {
      return res.status(400).json({
        error: `库存不足，当前库存 ${medicine.quantity}，需要 ${plan.dosagePerTime}`
      });
    }
    if (medicine.quantity <= 0) {
      return res.status(400).json({ error: '库存为零，无法执行服用' });
    }

    medicine.quantity -= plan.dosagePerTime;
    db.get('medicines').find({ id: plan.medicineId }).assign({ quantity: medicine.quantity }).write();
    const tx = addTransaction(medicine.id, medicine.name, 'take', plan.dosagePerTime,
      `用药计划执行 - ${plan.memberName}${note ? ' - ' + note : ''}`);
    const log = addPlanLog(plan.id, medicine.id, medicine.name, plan.batchNo,
      plan.memberName, scheduledDate, scheduledTime, 'taken', plan.dosagePerTime, note || '');

    res.json({
      success: true,
      medicine,
      transaction: tx,
      log
    });
  } else {
    const log = addPlanLog(plan.id, medicine.id, medicine.name, plan.batchNo,
      plan.memberName, scheduledDate, scheduledTime, 'skipped', 0, note || '');

    res.json({
      success: true,
      log
    });
  }
});

app.put('/api/plans/:id/disable', (req, res) => {
  const plan = db.get('medicationPlans').find({ id: req.params.id }).value();
  if (!plan) {
    return res.status(404).json({ error: '用药计划不存在' });
  }

  if (plan.status === 'disabled') {
    return res.status(400).json({ error: '该计划已停用' });
  }

  plan.status = 'disabled';
  plan.disabledAt = new Date().toISOString();
  plan.disableReason = req.body.note || '手动停用';

  db.get('medicationPlans').find({ id: req.params.id }).assign(plan).write();
  res.json(plan);
});

app.get('/api/plans/:id/logs', (req, res) => {
  const plan = db.get('medicationPlans').find({ id: req.params.id }).value();
  if (!plan) {
    return res.status(404).json({ error: '用药计划不存在' });
  }

  const logs = db.get('planLogs')
    .filter({ planId: req.params.id })
    .sortBy(l => -new Date(l.createdAt).getTime())
    .value();

  res.json(logs);
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`家庭药箱管理后端服务已启动: http://localhost:${PORT}`);
});
