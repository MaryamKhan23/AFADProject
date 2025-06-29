// parseAscToMongo.js with preprocessing integration
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const DataPreprocessor = require('./dataPreprocessor'); // Import the preprocessing module

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Initialize preprocessor with custom configuration
const preprocessor = new DataPreprocessor({
  maxAcceleration: 3000,    // 3g in cm/s²
  outlierThreshold: 3,      // 3 standard deviations
  maxOutlierPercentage: 0.05, // 5% max outliers
  maxGapSize: 10,          // Max 10 consecutive missing points to interpolate
  minDataPoints: 100,      // Minimum required data points
  logging: true            // Enable preprocessing logs
});

/**
 * Enhanced earthquake data processing with preprocessing
 */
async function processEarthquakeFilesWithPreprocessing(fileBasePath) {
  const directions = ['E', 'N', 'U'];
  const parsedFiles = {};
  const allData = {
    time: null,
    ns_acceleration: [],
    ew_acceleration: [],
    ud_acceleration: []
  };

  let maxLength = 0;
  let commonSamplingInterval = null;

  // Parse all available files (same as original)
  for (const dir of directions) {
    const filePath = `${fileBasePath}_${dir}.asc`;
    if (fs.existsSync(filePath)) {
      console.log(`📂 Processing ${dir} direction file...`);
      try {
        parsedFiles[dir] = parseAscFile(filePath);
        maxLength = Math.max(maxLength, parsedFiles[dir].accelerationData.length);

        if (commonSamplingInterval === null) {
          commonSamplingInterval = parsedFiles[dir].samplingInterval;
        }

        console.log(`✅ ${dir} direction: ${parsedFiles[dir].accelerationData.length} data points`);
      } catch (error) {
        console.error(`❌ Error processing ${dir} direction:`, error.message);
      }
    } else {
      console.warn(`⚠️ File not found: ${filePath}`);
    }
  }

  if (Object.keys(parsedFiles).length === 0) {
    throw new Error('No valid ASC files found');
  }

  // Generate time array and assign data (same as original)
  allData.time = generateTimeArray(commonSamplingInterval || 0.01, maxLength);

  Object.entries(parsedFiles).forEach(([dir, fileData]) => {
    const data = fileData.accelerationData;
    const paddedData = [...data];
    while (paddedData.length < maxLength) {
      paddedData.push(0);
    }

    switch (dir) {
      case 'E': allData.ew_acceleration = paddedData; break;
      case 'N': allData.ns_acceleration = paddedData; break;
      case 'U': allData.ud_acceleration = paddedData; break;
    }
  });

  // Fill missing directions with zeros
  if (allData.ns_acceleration.length === 0) {
    allData.ns_acceleration = new Array(maxLength).fill(0);
    console.warn('⚠️ No N-S data found, filled with zeros');
  }
  if (allData.ew_acceleration.length === 0) {
    allData.ew_acceleration = new Array(maxLength).fill(0);
    console.warn('⚠️ No E-W data found, filled with zeros');
  }
  if (allData.ud_acceleration.length === 0) {
    allData.ud_acceleration = new Array(maxLength).fill(0);
    console.warn('⚠️ No U-D data found, filled with zeros');
  }

  const firstFile = Object.values(parsedFiles)[0];

  // **NEW: Apply preprocessing to the raw data**
  console.log('🔄 Starting data preprocessing...');

  const rawDataForPreprocessing = {
    header: firstFile.header,
    data: allData,
    samplingInterval: commonSamplingInterval,
    epicentralDistance: firstFile.epicentralDistance,
    processedFiles: Object.keys(parsedFiles)
  };

  const preprocessingResult = await preprocessor.preprocessEarthquakeData(rawDataForPreprocessing);

  // Check preprocessing results
  if (preprocessingResult.preprocessing.errors.length > 0) {
    console.error('❌ Preprocessing errors:');
    preprocessingResult.preprocessing.errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Data preprocessing failed');
  }

  if (preprocessingResult.preprocessing.warnings.length > 0) {
    console.warn('⚠️ Preprocessing warnings:');
    preprocessingResult.preprocessing.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  console.log('✅ Preprocessing completed successfully');
  console.log(`📊 Data quality: ${preprocessingResult.qualityReport.overall} (${preprocessingResult.qualityReport.averageScore.toFixed(1)}/100)`);

  // Return preprocessed data
  return {
    header: firstFile.header,
    data: preprocessingResult.processedData.data, // Use preprocessed data
    samplingInterval: commonSamplingInterval,
    epicentralDistance: firstFile.epicentralDistance,
    processedFiles: Object.keys(parsedFiles),

    // Add preprocessing metadata
    preprocessing: {
      applied: true,
      steps: preprocessingResult.preprocessing.steps,
      warnings: preprocessingResult.preprocessing.warnings,
      qualityReport: preprocessingResult.qualityReport,
      originalDataStats: {
        totalPoints: maxLength,
        nonZeroPoints: {
          ns: allData.ns_acceleration.filter(x => x !== 0).length,
          ew: allData.ew_acceleration.filter(x => x !== 0).length,
          ud: allData.ud_acceleration.filter(x => x !== 0).length
        }
      }
    }
  };
}

/**
 * Enhanced database insertion with preprocessing metadata
 */

async function insertEarthquakeDataWithPreprocessing(parsedData) {
  const db = client.db('earthquake_data');

  // ✅ Generate a more reliable event_id
  const date = parsedData.header['EVENT_DATE_YYYYMMDD'] || '';
  const time = parsedData.header['EVENT_TIME_HHMMSS'] || '';
  const lat = parsedData.header['EVENT_LATITUDE_DEGREE'] || '';
  const lon = parsedData.header['EVENT_LONGITUDE_DEGREE'] || '';

  const generatedEventId = `${date}_${time}_${lat}_${lon}`; // example: 20240512_034510_38.2_27.5

  // 1. Insert/Update Earthquake Document
  const earthquakeDoc = {
    event_id: generatedEventId,
    date_time: `${date}T${time}`,
    latitude: parseFloat(lat) || 0,
    longitude: parseFloat(lon) || 0,
    depth: parseFloat(parsedData.header['EVENT_DEPTH_KM']) || 0,
    magnitude: parseFloat(parsedData.header['MAGNITUDE_W'] || parsedData.header['MAGNITUDE_L']) || 0,
    location: parsedData.header['EVENT_NAME'] || '',
    processed: true,
    source: 'AFAD',
    download_date: new Date()
  };

  const earthquakeCollection = db.collection('earthquakes');
  const earthquakeResult = await earthquakeCollection.updateOne(
    { event_id: generatedEventId },
    { $set: earthquakeDoc },
    { upsert: true }
  );

  // 2. Insert/Update Station Document
  const stationDoc = {
    station_id: parsedData.header['STATION_CODE'] || '',
    event_id: generatedEventId,
    name: parsedData.header['STATION_NAME'] || '',
    latitude: parseFloat(parsedData.header['STATION_LATITUDE_DEGREE']) || 0,
    longitude: parseFloat(parsedData.header['STATION_LONGITUDE_DEGREE']) || 0,
    geology: parsedData.header['SITE_CLASSIFICATION_EC8'] || '',
    site_class: parsedData.header['MORPHOLOGIC_CLASSIFICATION'] || '',
    distance_to_epicenter: parsedData.epicentralDistance,
    instrument_type: parsedData.header['INSTRUMENT'] || '',
    sampling_rate: parsedData.samplingInterval ? 1.0 / parsedData.samplingInterval : 0
  };

  const stationCollection = db.collection('stations');
  const stationResult = await stationCollection.updateOne(
    { station_id: stationDoc.station_id, event_id: generatedEventId },
    { $set: stationDoc },
    { upsert: true }
  );

  // 3. Insert Acceleration Record Document
  const recordDoc = {
    station_id: stationDoc.station_id,
    event_id: generatedEventId,
    data: {
      time: parsedData.data.time,
      ns_acceleration: parsedData.data.ns_acceleration,
      ew_acceleration: parsedData.data.ew_acceleration,
      ud_acceleration: parsedData.data.ud_acceleration
    },
    header_info: parsedData.header,
    processing_info: {
      baseline_correction: parsedData.header['BASELINE_CORRECTION'] === 'YES',
      filtering: {
        filter_type: parsedData.header['FILTER_TYPE'] || '',
        lowcut: parseFloat(parsedData.header['LOW_CUT_FREQUENCY_HZ']) || 0,
        highcut: parseFloat(parsedData.header['HIGH_CUT_FREQUENCY_HZ']) || 0
      },
      processing_date: new Date(),
      files_processed: parsedData.processedFiles || [],
      sampling_interval: parsedData.samplingInterval,
      total_data_points: parsedData.data.time.length,
      preprocessing: parsedData.preprocessing || null
    },
    data_quality: parsedData.preprocessing ? {
      overall_score: parsedData.preprocessing.qualityReport.averageScore,
      overall_rating: parsedData.preprocessing.qualityReport.overall,
      individual_scores: parsedData.preprocessing.qualityReport.scores,
      quality_issues: parsedData.preprocessing.qualityReport.issues,
      preprocessing_warnings: parsedData.preprocessing.warnings
    } : null
  };

  const recordCollection = db.collection('acceleration_records');
  const recordResult = await recordCollection.updateOne(
    { station_id: stationDoc.station_id, event_id: generatedEventId },
    { $set: recordDoc },
    { upsert: true }
  );

  console.log('✅ Enhanced data stored with preprocessing metadata');

  return {
    earthquake: earthquakeResult,
    station: stationResult,
    record: recordResult,
    dataQuality: parsedData.preprocessing?.qualityReport || null
  };
}


/**
 * Enhanced verification with quality information
 */
async function verifyStoredDataWithQuality(eventId, stationId) {
  const db = client.db('earthquake_data');
  const recordCollection = db.collection('acceleration_records');

  const record = await recordCollection.findOne({
    event_id: eventId,
    station_id: stationId
  });

  if (record) {
    console.log('🔍 Verification - Enhanced record found:');
    console.log(`   Time points: ${record.data.time ? record.data.time.length : 0}`);
    console.log(`   NS acceleration: ${record.data.ns_acceleration ? record.data.ns_acceleration.length : 0}`);
    console.log(`   EW acceleration: ${record.data.ew_acceleration ? record.data.ew_acceleration.length : 0}`);
    console.log(`   UD acceleration: ${record.data.ud_acceleration ? record.data.ud_acceleration.length : 0}`);

    if (record.data_quality) {
      console.log('📊 Data Quality Information:');
      console.log(`   Overall Score: ${record.data_quality.overall_score.toFixed(1)}/100`);
      console.log(`   Overall Rating: ${record.data_quality.overall_rating}`);
      console.log(`   Individual Scores: NS=${record.data_quality.individual_scores?.ns_acceleration?.toFixed(1) || 'N/A'}, EW=${record.data_quality.individual_scores?.ew_acceleration?.toFixed(1) || 'N/A'}, UD=${record.data_quality.individual_scores?.ud_acceleration?.toFixed(1) || 'N/A'}`);

      if (record.data_quality.quality_issues && record.data_quality.quality_issues.length > 0) {
        console.log('   Quality Issues:');
        record.data_quality.quality_issues.forEach(issue => console.log(`     - ${issue}`));
      }

      if (record.data_quality.preprocessing_warnings && record.data_quality.preprocessing_warnings.length > 0) {
        console.log('   Preprocessing Warnings:');
        record.data_quality.preprocessing_warnings.forEach(warning => console.log(`     - ${warning}`));
      }
    }

    if (record.processing_info?.preprocessing) {
      console.log('🔧 Preprocessing Applied:');
      console.log(`   Steps: ${record.processing_info.preprocessing.steps.join(', ')}`);
    }

    // Sample first few values
    if (record.data.ns_acceleration && record.data.ns_acceleration.length > 0) {
      console.log(`   NS sample values: [${record.data.ns_acceleration.slice(0, 5).join(', ')}...]`);
    }
    if (record.data.ew_acceleration && record.data.ew_acceleration.length > 0) {
      console.log(`   EW sample values: [${record.data.ew_acceleration.slice(0, 5).join(', ')}...]`);
    }
    if (record.data.ud_acceleration && record.data.ud_acceleration.length > 0) {
      console.log(`   UD sample values: [${record.data.ud_acceleration.slice(0, 5).join(', ')}...]`);
    }
  } else {
    console.log('❌ No record found in database');
  }
}

/**
 * Enhanced main import function with preprocessing
 */
async function importAscFilesWithPreprocessing(basePath) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    console.log('📊 Processing earthquake files with preprocessing...');
    const parsedData = await processEarthquakeFilesWithPreprocessing(basePath);

    console.log('💾 Inserting preprocessed data into MongoDB...');
    const results = await insertEarthquakeDataWithPreprocessing(parsedData);

    console.log('🔍 Verifying stored data with quality metrics...');
    await verifyStoredDataWithQuality(
      earthquakeDoc.event_id, // use the same event ID you generated
      parsedData.header['STATION_CODE']
    );

    console.log('✅ Enhanced import completed successfully!');
    console.log('📈 Results Summary:');
    console.log(`   Earthquake processed: ${(results.earthquake.upsertedCount || 0) + (results.earthquake.modifiedCount || 0) > 0 ? 'Yes' : 'Updated'}`);
    console.log(`   Station processed: ${(results.station.upsertedCount || 0) + (results.station.modifiedCount || 0) > 0 ? 'Yes' : 'Updated'}`);
    console.log(`   Record processed: ${(results.record.upsertedCount || 0) + (results.record.modifiedCount || 0) > 0 ? 'Yes' : 'Updated'}`);
    console.log(`   Total data points stored: ${parsedData.data.time.length}`);
    console.log(`   Files processed: ${parsedData.processedFiles.join(', ')}`);

    if (results.dataQuality) {
      console.log(`   Data quality: ${results.dataQuality.overall} (${results.dataQuality.averageScore.toFixed(1)}/100)`);
      console.log(`   Preprocessing steps applied: ${parsedData.preprocessing.steps.length}`);
    }

  } catch (err) {
    console.error('❌ Enhanced import error:', err);
    if (err.errInfo && err.errInfo.details) {
      console.error('📋 Validation details:', JSON.stringify(err.errInfo.details, null, 2));
    }
    console.error('Stack trace:', err.stack);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

/**
 * Batch processing function for multiple earthquake files
 */
async function batchProcessWithPreprocessing(baseDirectory) {
  console.log('🔄 Starting batch processing with preprocessing...');

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB for batch processing');

    const files = fs.readdirSync(baseDirectory).filter(file => file.endsWith('.asc'));
    const uniqueBasePaths = new Set();

    // Extract unique base paths (without direction suffix)
    files.forEach(file => {
      const match = file.match(/^(.+)_[ENU]\.asc$/);
      if (match) {
        uniqueBasePaths.add(path.join(baseDirectory, match[1]));
      }
    });

    console.log(`📊 Found ${uniqueBasePaths.size} unique earthquake events to process`);

    let successCount = 0;
    let errorCount = 0;
    const processingResults = [];

    for (const basePath of uniqueBasePaths) {
      try {
        console.log(`\n🔄 Processing: ${path.basename(basePath)}`);

        const parsedData = await processEarthquakeFilesWithPreprocessing(basePath);
        const results = await insertEarthquakeDataWithPreprocessing(parsedData);

        processingResults.push({
          basePath: path.basename(basePath),
          eventId: parsedData.header['EVENT_ID'],
          stationId: parsedData.header['STATION_CODE'],
          success: true,
          dataQuality: results.dataQuality,
          dataPoints: parsedData.data.time.length,
          preprocessingSteps: parsedData.preprocessing.steps.length,
          warnings: parsedData.preprocessing.warnings.length
        });

        successCount++;
        console.log(`✅ Successfully processed: ${path.basename(basePath)}`);

      } catch (error) {
        console.error(`❌ Failed to process ${path.basename(basePath)}:`, error.message);
        processingResults.push({
          basePath: path.basename(basePath),
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    // Print batch processing summary
    console.log('\n📊 Batch Processing Summary:');
    console.log(`   Total events: ${uniqueBasePaths.size}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${errorCount}`);

    if (successCount > 0) {
      const avgDataPoints = processingResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.dataPoints, 0) / successCount;

      const qualityDistribution = processingResults
        .filter(r => r.success && r.dataQuality)
        .reduce((acc, r) => {
          acc[r.dataQuality.overall] = (acc[r.dataQuality.overall] || 0) + 1;
          return acc;
        }, {});

      console.log(`   Average data points per event: ${avgDataPoints.toFixed(0)}`);
      console.log('   Quality distribution:', qualityDistribution);
    }

    return processingResults;

  } catch (err) {
    console.error('❌ Batch processing error:', err);
    throw err;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB after batch processing.');
  }
}

// =================== NEW: Process multiple folders ===================
async function batchProcessMultipleFolders(folders) {
  for (const folder of folders) {
    console.log(`\n📂 Starting batch processing for folder: ${folder}`);
    try {
      await batchProcessWithPreprocessing(folder);
    } catch (err) {
      console.error(`❌ Error processing folder ${folder}:`, err.message);
    }
  }
}

/**
 * Parse ASC file header and extract key-value pairs
 */
function parseHeader(headerLines) {
  const header = {};

  headerLines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes(':')) {
      const colonIndex = trimmedLine.indexOf(':');
      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();
      header[key] = value;
    }
  });

  return header;
}

/**
 * Parse acceleration data from ASC file
 */
function parseAccelerationData(dataLines) {
  const accelerationData = [];

  dataLines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const values = trimmedLine.split(/\s+/);
      values.forEach(val => {
        const num = parseFloat(val);
        if (!isNaN(num)) accelerationData.push(num);
      });
    }
  });

  return accelerationData;
}

/**
 * Generate time array based on sampling interval and number of data points
 */
function generateTimeArray(samplingInterval, nData) {
  return Array.from({ length: nData }, (_, i) => i * samplingInterval);
}

/**
 * Determine direction from filename
 */
function getDirectionFromFilename(filename) {
  if (filename.includes('_E.asc')) return 'E';
  if (filename.includes('_N.asc')) return 'N';
  if (filename.includes('_U.asc')) return 'U';
  return 'UNKNOWN';
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse a single ASC file and return structured data
 */
function parseAscFile(filePath) {
  console.log('📂 Reading file:', filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  // Find header end - look for consistent patterns
  let headerEndIndex = -1;
  let emptyLineCount = 0;

  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i].trim();

    // Count consecutive empty lines
    if (line === '') {
      emptyLineCount++;
      if (emptyLineCount >= 1 && i > 5) {
        headerEndIndex = i + 1;
        break;
      }
    } else {
      emptyLineCount = 0;
      // If we find a line that looks like numeric data after line 5
      if (i > 5 && !line.includes(':') && !line.startsWith('#')) {
        const testValues = line.split(/\s+/);
        const numericCount = testValues.filter(val => !isNaN(parseFloat(val))).length;
        if (numericCount > 0 && numericCount === testValues.length) {
          headerEndIndex = i;
          break;
        }
      }
    }
  }

  if (headerEndIndex === -1) {
    // Fallback: assume header ends at line 20 or first numeric-only line
    headerEndIndex = 20;
    console.warn(`⚠️ Could not auto-detect header end, using line ${headerEndIndex}`);
  }

  const headerLines = lines.slice(0, headerEndIndex);
  const dataLines = lines.slice(headerEndIndex).filter(line => line.trim() !== '');

  console.log(`📊 Header lines: ${headerLines.length}, Data lines: ${dataLines.length}`);

  const header = parseHeader(headerLines);
  console.log('📊 Parsed header keys:', Object.keys(header).join(', '));

  const accelerationData = parseAccelerationData(dataLines);
  console.log('📊 Acceleration data points:', accelerationData.length);

  // Validate we have data
  if (accelerationData.length === 0) {
    console.error('❌ No acceleration data found in file:', filePath);
    console.log('Sample data lines:', dataLines.slice(0, 5));
    throw new Error('No acceleration data found');
  }

  const samplingInterval = parseFloat(header['SAMPLING_INTERVAL_S']) || 0.01;
  const nData = parseInt(header['NDATA']) || accelerationData.length;

  // If data length mismatch, warn but continue
  if (accelerationData.length !== nData) {
    console.warn(`⚠️ Warning: NDATA (${nData}) does not match actual data length (${accelerationData.length})`);
  }

  const direction = getDirectionFromFilename(path.basename(filePath));
  const timeArray = generateTimeArray(samplingInterval, accelerationData.length);

  const eventLat = parseFloat(header['EVENT_LATITUDE_DEGREE']) || 0;
  const eventLon = parseFloat(header['EVENT_LONGITUDE_DEGREE']) || 0;
  const stationLat = parseFloat(header['STATION_LATITUDE_DEGREE']) || 0;
  const stationLon = parseFloat(header['STATION_LONGITUDE_DEGREE']) || 0;
  const epicentralDistance = calculateDistance(eventLat, eventLon, stationLat, stationLon);

  return {
    header,
    accelerationData,
    timeArray,
    direction,
    samplingInterval,
    nData: accelerationData.length, // Use actual data length
    epicentralDistance,
    filePath
  };
}

// =================== USAGE EXAMPLES ===================

// Command line usage
if (require.main === module) {
  const basePath = process.argv[2];
  const batchMode = process.argv.includes('--batch');

  if (batchMode) {
    // Dynamically read all folders inside afad_downloads
    const downloadsPath = path.join(__dirname, '../afad_downloads');
    let foldersToProcess = [];

    try {
      foldersToProcess = fs.readdirSync(downloadsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(downloadsPath, dirent.name));
    } catch (err) {
      console.error('❌ Failed to read afad_downloads directory:', err);
      process.exit(1);
    }

    if (foldersToProcess.length === 0) {
      console.log('⚠️ No folders found inside afad_downloads to process.');
      process.exit(0);
    }

    console.log('🚀 Starting batch processing for multiple folders:', foldersToProcess);
    batchProcessMultipleFolders(foldersToProcess).then(() => {
      console.log('✅ Finished processing all folders.');
      process.exit(0);
    }).catch(err => {
      console.error('❌ Batch processing encountered an error:', err);
      process.exit(1);
    });

  } else {
    if (!basePath) {
      console.log('Usage:');
      console.log('  Single file: node parseAscToMongo.js /path/to/earthquake_base');
      console.log('  Batch mode:  node parseAscToMongo.js --batch');
      process.exit(1);
    }

    console.log('🚀 Starting single file processing with preprocessing...');
    importAscFilesWithPreprocessing(basePath);
  }
}