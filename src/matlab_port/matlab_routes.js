const express = require('express');
const router = express.Router();
const {
  processSingleRecord,
  batchProcessRecords,
  exportResults
} = require('../../scripts/processWithMatlab');

// POST /api/process/:recordId
router.post('/process/:recordId', async (req, res) => {
  try {
    const result = await processSingleRecord(req.params.recordId, req.body.options || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process/batch
router.post('/process/batch', async (req, res) => {
  try {
    const result = await batchProcessRecords(req.body.query || {}, req.body.options || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/:recordId
router.get('/export/:recordId', async (req, res) => {
  try {
    const outputPath = `exports/${req.params.recordId}_analysis.json`;
    await exportResults(req.params.recordId, outputPath);
    res.download(outputPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
