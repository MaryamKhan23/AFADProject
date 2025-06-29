
// Enhanced processWithMatlab.js - Complete MATLAB functionality port
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

/**
 * Signal Processing Module - Core MATLAB functionality ported to JavaScript
 */
class SignalProcessor {
  constructor() {
    this.defaultCornerFreq = 0.05; // Hz
    this.defaultDampingRatio = 0.05; // 5%
    this.gravitationalAccel = 9.81; // m/s²
  }

  /**
   * Detrend signal - remove linear trend (MATLAB detrend equivalent)
   */
  detrend(data) {
    const n = data.length;
    if (n < 2) return [...data];

    // Calculate linear trend using least squares
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * data[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Remove trend
    return data.map((yi, i) => yi - (slope * i + intercept));
  }

  /**
   * FFT implementation using Cooley-Tukey algorithm
   */
  fft(signal) {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({real: x, imag: 0}));

    // Pad to power of 2 if necessary
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = [...signal];
    while (padded.length < nextPow2) {
      padded.push(0);
    }

    return this._fftRecursive(padded.map(x => ({real: x, imag: 0})));
  }

  _fftRecursive(x) {
    const N = x.length;
    if (N <= 1) return x;

    // Divide
    const even = x.filter((_, i) => i % 2 === 0);
    const odd = x.filter((_, i) => i % 2 === 1);

    // Conquer
    const evenFFT = this._fftRecursive(even);
    const oddFFT = this._fftRecursive(odd);

    // Combine
    const combined = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const twiddle = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };

      const oddTerm = this._complexMultiply(twiddle, oddFFT[k]);
      
      combined[k] = this._complexAdd(evenFFT[k], oddTerm);
      combined[k + N / 2] = this._complexSubtract(evenFFT[k], oddTerm);
    }

    return combined;
  }

  /**
   * Inverse FFT
   */
  ifft(X) {
    const N = X.length;
    // Complex conjugate
    const conjugated = X.map(x => ({real: x.real, imag: -x.imag}));
    
    // Forward FFT
    const result = this._fftRecursive(conjugated);
    
    // Scale and conjugate again
    return result.map(x => ({
      real: x.real / N,
      imag: -x.imag / N
    }));
  }

  _complexMultiply(a, b) {
    return {
      real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real
    };
  }

  _complexAdd(a, b) {
    return {real: a.real + b.real, imag: a.imag + b.imag};
  }

  _complexSubtract(a, b) {
    return {real: a.real - b.real, imag: a.imag - b.imag};
  }

  /**
   * High-pass filter using frequency domain approach (MATLAB equivalent)
   */
  highPassFilter(data, fs, cornerFreq) {
    console.log(`🔄 Applying high-pass filter (${cornerFreq} Hz)...`);
    
    // Step 1: Detrend
    const detrended = this.detrend(data);
    
    // Step 2: FFT
    const fftData = this.fft(detrended);
    const N = fftData.length;
    
    // Step 3: Create frequency vector
    const frequencies = Array.from({length: N}, (_, i) => i * fs / N);
    
    // Step 4: Create high-pass filter
    const filter = frequencies.map(f => f >= cornerFreq ? 1 : 0);
    
    // Step 5: Symmetrize filter for real signals
    for (let i = Math.floor(N/2) + 1; i < N; i++) {
      filter[i] = filter[N - i];
    }
    
    // Step 6: Apply filter
    const filtered = fftData.map((val, i) => ({
      real: val.real * filter[i],
      imag: val.imag * filter[i]
    }));
    
    // Step 7: IFFT
    const result = this.ifft(filtered);
    
    return result.map(x => x.real).slice(0, data.length);
  }

  /**
   * Trapezoidal integration (MATLAB cumtrapz equivalent)
   */
  cumtrapz(time, data) {
    if (time.length !== data.length) {
      throw new Error('Time and data arrays must have same length');
    }
    
    const integrated = [0];
    for (let i = 1; i < data.length; i++) {
      const dt = time[i] - time[i-1];
      const area = 0.5 * (data[i] + data[i-1]) * dt;
      integrated[i] = integrated[i-1] + area;
    }
    
    return integrated;
  }

  /**
   * Calculate PGA, PGV, PGD
   */
  calculatePeakValues(acceleration, velocity, displacement) {
    return {
      PGA: Math.max(...acceleration.map(Math.abs)),
      PGV: Math.max(...velocity.map(Math.abs)),
      PGD: Math.max(...displacement.map(Math.abs))
    };
  }

  /**
   * Calculate bracketed duration
   */
  calculateBracketedDuration(time, acceleration, threshold) {
    const aboveThreshold = acceleration.map((acc, i) => 
      Math.abs(acc) >= threshold ? i : -1
    ).filter(i => i !== -1);

    if (aboveThreshold.length === 0) {
      return {
        duration: 0,
        startTime: NaN,
        endTime: NaN,
        startIndex: -1,
        endIndex: -1
      };
    }

    const startIndex = aboveThreshold[0];
    const endIndex = aboveThreshold[aboveThreshold.length - 1];
    
    return {
      duration: time[endIndex] - time[startIndex],
      startTime: time[startIndex],
      endTime: time[endIndex],
      startIndex,
      endIndex
    };
  }

  /**
   * Find site frequency (dominant frequency)
   */
  findSiteFrequency(acceleration, fs) {
    const fftResult = this.fft(acceleration);
    const N = fftResult.length;
    const frequencies = Array.from({length: Math.floor(N/2)}, (_, i) => i * fs / N);
    const magnitudes = fftResult.slice(0, Math.floor(N/2)).map(x => 
      Math.sqrt(x.real * x.real + x.imag * x.imag)
    );

    const maxIndex = magnitudes.indexOf(Math.max(...magnitudes));
    return {
      frequency: frequencies[maxIndex],
      magnitude: magnitudes[maxIndex],
      frequencies,
      magnitudes
    };
  }

  /**
   * Calculate Arias Intensity
   */
  calculateAriasIntensity(time, acceleration) {
    // Convert from cm/s² to m/s²
    const accMps2 = acceleration.map(a => a / 100);
    
    // Calculate cumulative and total Arias Intensity
    const accSquared = accMps2.map(a => a * a);
    const cumulative = this.cumtrapz(time, accSquared).map(val => 
      (Math.PI / (2 * this.gravitationalAccel)) * val
    );
    
    const total = cumulative[cumulative.length - 1];
    
    return {
      total: total * 100, // Convert back to cm²/s
      cumulative: cumulative.map(val => val * 100),
      totalMeterUnits: total
    };
  }

  /**
   * Response Spectrum Calculation using Newmark-Beta Integration
   */
  calculateResponseSpectrum(acceleration, time, dampingRatio = 0.05) {
    console.log('🔄 Calculating response spectrum...');
    
    const dt = time[1] - time[0];
    const periods = [];
    const frequencies = [];
    
    // Generate period range
    for (let T = 0.01; T <= 10; T += 0.02) {
      periods.push(T);
      frequencies.push(1 / T);
    }

    const PSA = [];
    const PSV = [];
    const SD = [];

    // Newmark-beta constants
    const beta = 0.25;
    const gamma = 0.5;
    const a0 = 1 / (beta * dt * dt);
    const a1 = gamma / (beta * dt);
    const a2 = 1 / (beta * dt);
    const a3 = 1 / (2 * beta) - 1;
    const a4 = gamma / beta - 1;
    const a5 = dt * (gamma / (2 * beta) - 1);

    for (let i = 0; i < frequencies.length; i++) {
      const f = frequencies[i];
      const omega = 2 * Math.PI * f;
      const m = 1; // Unit mass
      const k = m * omega * omega;
      const c = 2 * dampingRatio * m * omega;

      // Initialize arrays
      const u = new Array(acceleration.length).fill(0);
      const v = new Array(acceleration.length).fill(0);
      const a = new Array(acceleration.length).fill(0);

      const keff = k + a0 * m + a1 * c;

      if (keff === 0 || !isFinite(keff)) {
        PSA.push(0);
        PSV.push(0);
        SD.push(0);
        continue;
      }

      // Time integration
      for (let j = 1; j < acceleration.length; j++) {
        const dp = -m * (acceleration[j] - acceleration[j-1]);
        const rhs = dp + 
                   m * (a0 * u[j-1] + a2 * v[j-1] + a3 * a[j-1]) +
                   c * (a1 * u[j-1] + a4 * v[j-1] + a5 * a[j-1]);
        
        const du = rhs / keff;
        const dv = a1 * du - a4 * u[j-1] - a2 * v[j-1] - a5 * a[j-1];
        const da = a0 * du - a0 * u[j-1] - a2 * v[j-1] - a3 * a[j-1];
        
        u[j] = du;
        v[j] = dv;
        a[j] = da;
      }

      // Store peak responses
      SD.push(Math.max(...u.map(Math.abs)));
      PSV.push(Math.max(...v.map(Math.abs)));
      PSA.push(Math.max(...a.map(Math.abs)));
    }

    return {
      periods,
      frequencies,
      SD,
      PSV,
      PSA,
      dampingRatio
    };
  }
}

/**
 * Main MATLAB Integration Class
 */
class MatlabProcessor {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = new MongoClient(mongoUri);
    this.signalProcessor = new SignalProcessor();
  }

  /**
   * Process earthquake data with full MATLAB analysis suite
   */
  async processEarthquakeData(recordId, options = {}) {
    try {
      console.log('🔌 Connecting to MongoDB...');
      await this.client.connect();
      
      const db = this.client.db('earthquake_data');
      const collection = db.collection('acceleration_records');
      
      // Fetch data
      console.log(`📊 Fetching earthquake record: ${recordId}`);
      const record = await collection.findOne({ _id: recordId });
      
      if (!record) {
        throw new Error(`Record not found: ${recordId}`);
      }

      console.log('🔄 Starting MATLAB-equivalent processing...');
      
      // Extract configuration
      const config = {
        cornerFreq: options.cornerFreq || 0.05,
        dampingRatio: options.dampingRatio || 0.05,
        bracketThreshold: options.bracketThreshold || 0.05,
        ...options
      };

      // Get sampling info
      const dt = record.processing_info?.sampling_interval || 0.01;
      const fs = 1 / dt;
      
      // Process each direction
      const results = {};
      const directions = ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'];
      
      for (const direction of directions) {
        const acceleration = record.data[direction];
        if (!acceleration || acceleration.length === 0) {
          console.warn(`⚠️ No data found for ${direction}`);
          continue;
        }

        console.log(`🔄 Processing ${direction}...`);
        
        // Step 1: Preprocessing (High-pass filter)
        const filteredAcc = this.signalProcessor.highPassFilter(
          acceleration, fs, config.cornerFreq
        );
        
        // Step 2: Generate time vector
        const time = Array.from({length: filteredAcc.length}, (_, i) => i * dt);
        
        // Step 3: Integration to get velocity and displacement
        const velocity = this.signalProcessor.cumtrapz(time, filteredAcc);
        const displacement = this.signalProcessor.cumtrapz(time, velocity);
        
        // Step 4: Calculate peak values
        const peakValues = this.signalProcessor.calculatePeakValues(
          filteredAcc, velocity, displacement
        );
        
        // Step 5: Bracketed duration
        const bracketThreshold = config.bracketThreshold * peakValues.PGA;
        const bracketedDuration = this.signalProcessor.calculateBracketedDuration(
          time, filteredAcc, bracketThreshold
        );
        
        // Step 6: Site frequency analysis
        const siteFreq = this.signalProcessor.findSiteFrequency(filteredAcc, fs);
        
        // Step 7: Arias Intensity
        const ariasIntensity = this.signalProcessor.calculateAriasIntensity(
          time, filteredAcc
        );
        
        // Step 8: Response Spectrum
        const responseSpectrum = this.signalProcessor.calculateResponseSpectrum(
          filteredAcc, time, config.dampingRatio
        );

        // Store results
        results[direction] = {
          // Raw data
          rawAcceleration: acceleration,
          processedAcceleration: filteredAcc,
          velocity,
          displacement,
          time,
          
          // Peak values
          peakValues,
          
          // Duration analysis
          bracketedDuration,
          
          // Frequency analysis
          siteFrequency: siteFreq,
          
          // Intensity measures
          ariasIntensity,
          
          // Response spectrum
          responseSpectrum,
          
          // Processing metadata
          processingConfig: config,
          samplingRate: fs,
          dataLength: filteredAcc.length
        };
        
        console.log(`✅ ${direction} processing complete`);
        console.log(`   PGA: ${peakValues.PGA.toFixed(2)} cm/s²`);
        console.log(`   Bracketed Duration: ${bracketedDuration.duration.toFixed(2)} s`);
        console.log(`   Site Frequency: ${siteFreq.frequency.toFixed(2)} Hz`);
        console.log(`   Arias Intensity: ${ariasIntensity.total.toFixed(2)} cm²/s`);
      }

      // Step 9: Save enhanced results to database
      const analysisResults = {
        recordId: record._id,
        eventId: record.event_id,
        stationId: record.station_id,
        processingDate: new Date(),
        matlabAnalysis: results,
        processingConfig: config,
        summary: this._generateSummary(results)
      };

      // Update record with MATLAB analysis
      await collection.updateOne(
        { _id: record._id },
        { 
          $set: { 
            matlab_analysis: analysisResults,
            analysis_complete: true,
            last_matlab_processing: new Date()
          }
        }
      );

      console.log('✅ MATLAB processing completed and saved to database');
      
      return analysisResults;

    } catch (error) {
      console.error('❌ MATLAB processing error:', error);
      throw error;
    } finally {
      await this.client.close();
    }
  }

  /**
   * Batch process multiple records
   */
  async batchProcessRecords(query = {}, options = {}) {
    try {
      await this.client.connect();
      const db = this.client.db('earthquake_data');
      const collection = db.collection('acceleration_records');
      
      // Find records to process
      const records = await collection.find({
        ...query,
        matlab_analysis: { $exists: false } // Only unprocessed records
      }).toArray();

      console.log(`📊 Found ${records.length} records to process`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          console.log(`\n🔄 Processing record: ${record._id}`);
          const result = await this.processEarthquakeData(record._id, options);
          results.push({ recordId: record._id, success: true, result });
          successCount++;
          
        } catch (error) {
          console.error(`❌ Failed to process ${record._id}:`, error.message);
          results.push({ recordId: record._id, success: false, error: error.message });
          errorCount++;
        }
      }

      console.log(`\n📊 Batch processing complete:`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Failed: ${errorCount}`);
      console.log(`   Total: ${records.length}`);

      return results;

    } finally {
      await this.client.close();
    }
  }

  /**
   * Generate processing summary
   */
  _generateSummary(results) {
    const summary = {
      directions: Object.keys(results),
      maxPGA: 0,
      maxPGV: 0,
      maxPGD: 0,
      avgSiteFrequency: 0,
      totalAriasIntensity: 0
    };

    let validDirections = 0;
    
    for (const [direction, data] of Object.entries(results)) {
      const peaks = data.peakValues;
      summary.maxPGA = Math.max(summary.maxPGA, peaks.PGA);
      summary.maxPGV = Math.max(summary.maxPGV, peaks.PGV);
      summary.maxPGD = Math.max(summary.maxPGD, peaks.PGD);
      summary.avgSiteFrequency += data.siteFrequency.frequency;
      summary.totalAriasIntensity += data.ariasIntensity.total;
      validDirections++;
    }

    if (validDirections > 0) {
      summary.avgSiteFrequency /= validDirections;
    }

    return summary;
  }

  /**
   * Export results to file (similar to MATLAB output)
   */
  async exportResults(recordId, outputPath) {
    try {
      await this.client.connect();
      const db = this.client.db('earthquake_data');
      const collection = db.collection('acceleration_records');
      
      const record = await collection.findOne({ _id: recordId });
      if (!record || !record.matlab_analysis) {
        throw new Error('No MATLAB analysis found for this record');
      }

      const output = {
        metadata: {
          recordId: record._id,
          eventId: record.event_id,
          stationId: record.station_id,
          processingDate: record.matlab_analysis.processingDate
        },
        results: record.matlab_analysis.matlabAnalysis,
        summary: record.matlab_analysis.summary
      };

      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`✅ Results exported to: ${outputPath}`);
      
    } finally {
      await this.client.close();
    }
  }
}

// Usage functions
async function processSingleRecord(recordId, options = {}) {
  const processor = new MatlabProcessor(process.env.MONGO_URI);
  return await processor.processEarthquakeData(recordId, options);
}

async function batchProcessRecords(query = {}, options = {}) {
  const processor = new MatlabProcessor(process.env.MONGO_URI);
  return await processor.batchProcessRecords(query, options);
}

async function exportResults(recordId, outputPath) {
  const processor = new MatlabProcessor(process.env.MONGO_URI);
  return await processor.exportResults(recordId, outputPath);
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case 'process':
      if (!arg1) {
        console.log('Usage: node processWithMatlab.js process <recordId>');
        process.exit(1);
      }
      processSingleRecord(arg1)
        .then(result => {
          console.log('✅ Processing completed');
          console.log('Summary:', result.summary);
        })
        .catch(err => {
          console.error('❌ Processing failed:', err.message);
          process.exit(1);
        });
      break;

    case 'batch':
      console.log('🚀 Starting batch processing...');
      batchProcessRecords()
        .then(results => {
          console.log('✅ Batch processing completed');
        })
        .catch(err => {
          console.error('❌ Batch processing failed:', err.message);
          process.exit(1);
        });
      break;

    case 'export':
      if (!arg1 || !arg2) {
        console.log('Usage: node processWithMatlab.js export <recordId> <outputPath>');
        process.exit(1);
      }
      exportResults(arg1, arg2)
        .then(() => {
          console.log('✅ Export completed');
        })
        .catch(err => {
          console.error('❌ Export failed:', err.message);
          process.exit(1);
        });
      break;

    default:
      console.log('Available commands:');
      console.log('  process <recordId>     - Process single record');
      console.log('  batch                  - Process all unprocessed records');
      console.log('  export <recordId> <path> - Export results to file');
      break;
  }
}

// Export for use in other modules
module.exports = {
  MatlabProcessor,
  SignalProcessor,
  processSingleRecord,
  batchProcessRecords,
  exportResults
};
