const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./db');
const {
  daysUntil,
  isValidDate,
  isPositiveInteger,
  isNonNegativeInteger,
  generateId,
  parseCSV,
  toCSV
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

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`家庭药箱管理后端服务已启动: http://localhost:${PORT}`);
});
