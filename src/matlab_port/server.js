// server.js - Main integration server for PyQt5 GUI + Node.js backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const multer = require('multer');
const bodyParser = require('body-parser');
const matlabRoutes = require('./src/api/matlab_routes');
const fs = require('fs');
const path = require('path');

// Import your existing MATLAB processing
const { MatlabProcessor, SignalProcessor } = require('../../scripts/processWithMatlab');
const { parseAscToMongo } = require('../../scripts/parseAscToMongo');


const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use('/api', matlabRoutes);

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(asc|txt)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only .asc and .txt files are allowed!'));
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// MongoDB connection
let db;
let mongoClient;  // Add this line

MongoClient.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/earthquake_data')
  .then(client => {
    console.log('✅ Connected to MongoDB');
    mongoClient = client;  // Save the client here
    db = client.db('earthquake_data');
  })
  .catch(error => console.error('❌ MongoDB connection error:', error));


// ==================== GUI API ENDPOINTS ====================

// 1. Get all earthquakes for event selection page
app.get('/api/earthquakes', async (req, res) => {
  try {
    const { magnitude_min, magnitude_max, date_start, date_end, depth_min, depth_max } = req.query;
    
    let query = {};
    
    // Build query based on filters
    if (magnitude_min || magnitude_max) {
      query.magnitude = {};
      if (magnitude_min) query.magnitude.$gte = parseFloat(magnitude_min);
      if (magnitude_max) query.magnitude.$lte = parseFloat(magnitude_max);
    }
    
    if (date_start || date_end) {
      query.event_date = {};
      if (date_start) query.event_date.$gte = new Date(date_start);
      if (date_end) query.event_date.$lte = new Date(date_end);
    }
    
    if (depth_min || depth_max) {
      query.depth = {};
      if (depth_min) query.depth.$gte = parseFloat(depth_min);
      if (depth_max) query.depth.$lte = parseFloat(depth_max);
    }

    const earthquakes = await db.collection('earthquakes').find(query)
      .sort({ event_date: -1 })
      .limit(1000)
      .toArray();

    res.json({
      success: true,
      count: earthquakes.length,
      earthquakes: earthquakes.map(eq => ({
        event_id: eq.event_id,
        magnitude: eq.magnitude,
        depth: eq.depth,
        location: eq.location,
        event_date: eq.event_date,
        latitude: eq.latitude,
        longitude: eq.longitude,
        station_count: eq.stations ? eq.stations.length : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching earthquakes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get earthquake details by event_id
app.get('/api/earthquakes/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const earthquake = await db.collection('earthquakes').findOne({ event_id: eventId });
    if (!earthquake) {
      return res.status(404).json({ success: false, error: 'Earthquake not found' });
    }

    // Get associated stations and records
    const records = await db.collection('acceleration_records')
      .find({ event_id: eventId })
      .toArray();

    const stations = await db.collection('stations')
      .find({ station_id: { $in: records.map(r => r.station_id) } })
      .toArray();

    res.json({
      success: true,
      earthquake: {
        ...earthquake,
        records: records.map(r => ({
          record_id: r._id,
          station_id: r.station_id,
          has_matlab_analysis: !!r.matlab_analysis,
          processed_date: r.last_matlab_processing
        })),
        stations: stations
      }
    });
  } catch (error) {
    console.error('Error fetching earthquake details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get station data for graphs
app.get('/api/stations/:stationId/records/:recordId/data', async (req, res) => {
  try {
    const { stationId, recordId } = req.params;
    const { processed = 'true' } = req.query;

    const record = await db.collection('acceleration_records')
      .findOne({ _id: recordId, station_id: stationId });

    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    let responseData = {
      success: true,
      record_id: record._id,
      station_id: record.station_id,
      event_id: record.event_id,
      raw_data: {
        ns_acceleration: record.data.ns_acceleration,
        ew_acceleration: record.data.ew_acceleration,
        ud_acceleration: record.data.ud_acceleration,
        time: record.data.time || generateTimeVector(record.data.ns_acceleration, 0.01)
      }
    };

    // Include processed data if available and requested
    if (processed === 'true' && record.matlab_analysis) {
      responseData.processed_data = record.matlab_analysis.matlabAnalysis;
      responseData.summary = record.matlab_analysis.summary;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching station data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Process earthquake data (trigger MATLAB analysis)
app.post('/api/process/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const options = req.body || {};

    console.log(`🔄 Processing record: ${recordId}`);
    
    const processor = new MatlabProcessor(process.env.MONGO_URI);
    const result = await processor.processEarthquakeData(recordId, options);

    res.json({
      success: true,
      message: 'Processing completed successfully',
      result: {
        record_id: result.recordId,
        processing_date: result.processingDate,
        summary: result.summary,
        directions_processed: result.summary.directions
      }
    });
  } catch (error) {
    console.error('Error processing record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Upload and parse AFAD files
app.post('/api/upload/afad', upload.single('afadFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    console.log(`📁 Processing uploaded file: ${req.file.originalname}`);

    // Parse ASC file to MongoDB
    const parseResult = await parseAscToMongo(filePath);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'File uploaded and processed successfully',
      result: parseResult
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (req.file) fs.unlinkSync(req.file.path); // Cleanup on error
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Search earthquakes with advanced filters
app.post('/api/search/earthquakes', async (req, res) => {
  try {
    const { 
      text_search, 
      magnitude_range, 
      date_range, 
      depth_range, 
      location_bounds,
      has_processed_data 
    } = req.body;

    let query = {};
    let aggregation = [{ $match: query }];

    // Text search
    if (text_search) {
      query.$or = [
        { location: { $regex: text_search, $options: 'i' } },
        { event_id: { $regex: text_search, $options: 'i' } }
      ];
    }

    // Magnitude range
    if (magnitude_range) {
      query.magnitude = {
        $gte: magnitude_range.min || 0,
        $lte: magnitude_range.max || 10
      };
    }

    // Date range
    if (date_range) {
      query.event_date = {
        $gte: new Date(date_range.start),
        $lte: new Date(date_range.end)
      };
    }

    // Depth range
    if (depth_range) {
      query.depth = {
        $gte: depth_range.min || 0,
        $lte: depth_range.max || 1000
      };
    }

    // Location bounds (for map filtering)
    if (location_bounds) {
      query.latitude = {
        $gte: location_bounds.south,
        $lte: location_bounds.north
      };
      query.longitude = {
        $gte: location_bounds.west,
        $lte: location_bounds.east
      };
    }

    // Join with records to check for processed data
    if (has_processed_data !== undefined) {
      aggregation.push({
        $lookup: {
          from: 'acceleration_records',
          localField: 'event_id',
          foreignField: 'event_id',
          as: 'records'
        }
      });

      if (has_processed_data) {
        aggregation.push({
          $match: { 'records.matlab_analysis': { $exists: true } }
        });
      } else {
        aggregation.push({
          $match: { 'records.matlab_analysis': { $exists: false } }
        });
      }
    }

    aggregation.push(
      { $sort: { event_date: -1 } },
      { $limit: 500 }
    );

    const earthquakes = await db.collection('earthquakes').aggregate(aggregation).toArray();

    res.json({
      success: true,
      count: earthquakes.length,
      earthquakes: earthquakes
    });
  } catch (error) {
    console.error('Error searching earthquakes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get processing statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const stats = await Promise.all([
      db.collection('earthquakes').countDocuments(),
      db.collection('acceleration_records').countDocuments(),
      db.collection('acceleration_records').countDocuments({ matlab_analysis: { $exists: true } }),
      db.collection('stations').countDocuments()
    ]);

    res.json({
      success: true,
      statistics: {
        total_earthquakes: stats[0],
        total_records: stats[1],
        processed_records: stats[2],
        total_stations: stats[3],
        processing_percentage: stats[1] > 0 ? ((stats[2] / stats[1]) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Batch processing endpoint
app.post('/api/batch/process', async (req, res) => {
  try {
    const { event_ids, processing_options } = req.body;
    
    console.log(`🚀 Starting batch processing for ${event_ids?.length || 'all'} events`);
    
    let query = {};
    if (event_ids && event_ids.length > 0) {
      query.event_id = { $in: event_ids };
    }

    const processor = new MatlabProcessor(process.env.MONGO_URI);
    const results = await processor.batchProcessRecords(query, processing_options);

    res.json({
      success: true,
      message: 'Batch processing completed',
      results: {
        total_processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results
      }
    });
  } catch (error) {
    console.error('Error in batch processing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Export data endpoint
app.get('/api/export/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { format = 'json' } = req.query;

    const record = await db.collection('acceleration_records')
      .findOne({ _id: recordId });

    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (format === 'csv') {
      // Generate CSV
      const csvData = generateCSV(record);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="earthquake_${recordId}.csv"`);
      res.send(csvData);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="earthquake_${recordId}.json"`);
      res.json({
        success: true,
        data: record
      });
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function generateTimeVector(accelerationData, dt = 0.01) {
  return Array.from({ length: accelerationData.length }, (_, i) => i * dt);
}

function generateCSV(record) {
  const headers = ['Time', 'NS_Acceleration', 'EW_Acceleration', 'UD_Acceleration'];
  const time = record.data.time || generateTimeVector(record.data.ns_acceleration);
  
  let csv = headers.join(',') + '\n';
  
  for (let i = 0; i < time.length; i++) {
    const row = [
      time[i],
      record.data.ns_acceleration[i] || 0,
      record.data.ew_acceleration[i] || 0,
      record.data.ud_acceleration[i] || 0
    ];
    csv += row.join(',') + '\n';
  }
  
  return csv;
}

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log(`🚀 Earthquake GUI Integration Server running on port ${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`🔗 MongoDB connection: ${process.env.MONGO_URI || 'mongodb://localhost:27017'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully...');
  process.exit(0);
});

module.exports = app;