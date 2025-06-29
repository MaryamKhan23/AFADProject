// earthquakeAnalysis.js - Complete MATLAB functionality port with MongoDB integration
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Signal Processing Module - Complete MATLAB functionality
 */
class EarthquakeAnalyzer {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = new MongoClient(mongoUri);
    this.defaultCornerFreq = 0.05; // Hz
    this.defaultDampingRatio = 0.05; // 5%
    this.gravitationalAccel = 9.81; // m/s²
    this.dt = 0.01; // Default sampling interval
    this.fs = 100; // Default sampling frequency (1/dt)
  }

  /**
   * Main analysis function - equivalent to the full MATLAB script
   */
  async analyzeEarthquakeRecord(recordId, options = {}) {
    try {
      console.log('🔌 Connecting to MongoDB...');
      await this.client.connect();
      
      const db = this.client.db('earthquake_data');
      const collection = db.collection('acceleration_records');
      
      // Step 1: Fetch earthquake data from MongoDB (replaces file selection)
      console.log(`📊 Fetching earthquake record: ${recordId}`);
      const record = await collection.findOne({ _id: recordId });
      
      if (!record) {
        throw new Error(`Record not found: ${recordId}`);
      }

      console.log('✅ Data loaded successfully from MongoDB');

      // Extract acceleration data (assuming we're working with one direction for now)
      const direction = options.direction || 'ns_acceleration';
      const acc = record.data[direction];
      
      if (!acc || acc.length === 0) {
        throw new Error(`No acceleration data found for direction: ${direction}`);
      }

      // Step 2: Get sampling parameters
      this.dt = record.processing_info?.sampling_interval || 0.01;
      this.fs = 1 / this.dt;
      
      // Step 3: User input for corner frequency (from options or default)
      const cornerfreq = options.cornerFreq || this.defaultCornerFreq;
      console.log(`🔄 Using corner frequency: ${cornerfreq} Hz`);

      // Step 4: Preprocessing (high-pass filter)
      console.log('🔄 Applying preprocessing...');
      const preprocessacc = this.preprocessBoore(acc, this.fs, cornerfreq);
      const preprocesstime = Array.from({length: preprocessacc.length}, (_, i) => i * this.dt);

      // Step 5: Time vector for raw data
      const time = Array.from({length: acc.length}, (_, i) => i * this.dt);

      // Step 6: Velocity and Displacement calculation
      console.log('🔄 Calculating velocity and displacement...');
      const velocity = this.cumtrapz(time, acc);
      const displacement = this.cumtrapz(time, velocity);
      
      const preprocessvelocity = this.cumtrapz(preprocesstime, preprocessacc);
      const preprocessdisplacement = this.cumtrapz(preprocesstime, preprocessvelocity);

      // Step 7: PGA, PGV, PGD calculation
      const PGA = Math.max(...acc.map(Math.abs));
      const PGV = Math.max(...velocity.map(Math.abs));
      const PGD = Math.max(...displacement.map(Math.abs));
      
      const PGA_pre = Math.max(...preprocessacc.map(Math.abs));
      const PGV_pre = Math.max(...preprocessvelocity.map(Math.abs));
      const PGD_pre = Math.max(...preprocessdisplacement.map(Math.abs));

      console.log('📊 Peak Ground Motion Values:');
      console.log('--- Raw Data ---');
      console.log(`PGA: ${PGA.toFixed(2)} cm/s²`);
      console.log(`PGV: ${PGV.toFixed(2)} cm/s`);
      console.log(`PGD: ${PGD.toFixed(2)} cm`);
      console.log('--- Preprocessed Data ---');
      console.log(`PGA: ${PGA_pre.toFixed(2)} cm/s²`);
      console.log(`PGV: ${PGV_pre.toFixed(2)} cm/s`);
      console.log(`PGD: ${PGD_pre.toFixed(2)} cm`);

      // Step 8: Fourier Transform Analysis
      console.log('🔄 Performing Fourier analysis...');
      const fourierResults = this.performFourierAnalysis(preprocessacc, this.fs);

      // Step 9: Bracketed Duration (using 5% of PGA_pre as threshold)
      console.log('🔄 Calculating bracketed duration...');
      const bracketedDuration = this.calculateBracketedDuration(
        preprocesstime, preprocessacc, 0.05 * PGA_pre
      );

      console.log('--- Bracketed Duration ---');
      console.log(`Preprocessed: ${bracketedDuration.duration.toFixed(2)} seconds (from ${bracketedDuration.startTime.toFixed(2)} s to ${bracketedDuration.endTime.toFixed(2)} s)`);

      // Step 10: Site Frequency Analysis
      console.log('🔄 Calculating site frequency...');
      const siteFrequency = this.findSiteFrequency(preprocessacc, this.fs);
      
      console.log('--- Site Frequency ---');
      console.log(`Preprocessed Site Frequency: ${siteFrequency.frequency.toFixed(2)} Hz`);

      // Step 11: Arias Intensity Calculation
      console.log('🔄 Calculating Arias Intensity...');
      const ariasIntensity = this.calculateAriasIntensity(preprocesstime, preprocessacc);
      
      console.log('--- Arias Intensity ---');
      console.log(`Arias Intensity (Preprocessed): ${ariasIntensity.total.toFixed(2)} cm²/s`);

      // Step 12: Response Spectra Calculation
      console.log('🔄 Calculating Response Spectra...');
      const responseSpectrum = this.calculateResponseSpectrum(
        preprocessacc, preprocesstime, options.dampingRatio || 0.05
      );

      console.log('--- Response Spectrum (Preprocessed) ---');
      console.log(`Max PSA: ${Math.max(...responseSpectrum.PSA.filter(x => isFinite(x))).toFixed(2)} m/s²`);
      console.log(`Max PSV: ${Math.max(...responseSpectrum.PSV.filter(x => isFinite(x))).toFixed(3)} m/s`);
      console.log(`Max SD : ${Math.max(...responseSpectrum.SD.filter(x => isFinite(x))).toFixed(4)} m`);

      // Step 13: Compile all results
      const analysisResults = {
        recordId: record._id,
        eventId: record.event_id,
        stationId: record.station_id,
        direction: direction,
        processingDate: new Date(),
        
        // Raw data
        rawData: {
          acceleration: acc,
          velocity: velocity,
          displacement: displacement,
          time: time,
          PGA, PGV, PGD
        },
        
        // Preprocessed data
        preprocessedData: {
          acceleration: preprocessacc,
          velocity: preprocessvelocity,
          displacement: preprocessdisplacement,
          time: preprocesstime,
          PGA: PGA_pre,
          PGV: PGV_pre,
          PGD: PGD_pre
        },
        
        // Analysis results
        fourierAnalysis: fourierResults,
        bracketedDuration: bracketedDuration,
        siteFrequency: siteFrequency,
        ariasIntensity: ariasIntensity,
        responseSpectrum: responseSpectrum,
        
        // Processing parameters
        processingConfig: {
          cornerFreq: cornerfreq,
          dampingRatio: options.dampingRatio || 0.05,
          samplingRate: this.fs,
          samplingInterval: this.dt
        }
      };

      // Step 14: Save results back to MongoDB
      await collection.updateOne(
        { _id: record._id },
        { 
          $set: { 
            [`matlab_equivalent_analysis.${direction}`]: analysisResults,
            analysis_complete: true,
            last_processing: new Date()
          }
        }
      );

      console.log('✅ Analysis completed and saved to database');
      
      // Step 15: Generate plots data (for external plotting if needed)
      const plotsData = this.generatePlotsData(analysisResults);
      
      return {
        ...analysisResults,
        plotsData: plotsData
      };

    } catch (error) {
      console.error('❌ Analysis error:', error);
      throw error;
    } finally {
      await this.client.close();
    }
  }

  /**
   * Preprocessing function - equivalent to MATLAB preprocessboore
   */
  preprocessBoore(data, fs, cornerFreq) {
    // Step 1: Detrend to remove linear trend
    const detrended = this.detrend(data);
    
    // Step 2: FFT of signal
    const fftData = this.fft(detrended);
    const N = fftData.length;
    
    // Step 3: Frequency vector
    const f = Array.from({length: N}, (_, i) => i * fs / N);
    
    // Step 4: High-pass filter in frequency domain
    const hpFilter = f.map(freq => freq >= cornerFreq ? 1 : 0);
    
    // Step 5: Symmetrize the filter
    if (N % 2 === 0) {
      for (let i = Math.floor(N/2) + 1; i < N; i++) {
        hpFilter[i] = hpFilter[N - i];
      }
    } else {
      for (let i = Math.floor((N+1)/2); i < N; i++) {
        hpFilter[i] = hpFilter[N - i];
      }
    }
    
    // Step 6: Apply filter
    const fftFiltered = fftData.map((val, i) => ({
      real: val.real * hpFilter[i],
      imag: val.imag * hpFilter[i]
    }));
    
    // Step 7: Inverse FFT
    const filtered = this.ifft(fftFiltered);
    
    return filtered.map(x => x.real).slice(0, data.length);
  }

  /**
   * Detrend signal - remove linear trend
   */
  detrend(data) {
    const n = data.length;
    if (n < 2) return [...data];

    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * data[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return data.map((yi, i) => yi - (slope * i + intercept));
  }

  /**
   * FFT implementation
   */
  fft(signal) {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({real: x, imag: 0}));

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

    const even = x.filter((_, i) => i % 2 === 0);
    const odd = x.filter((_, i) => i % 2 === 1);

    const evenFFT = this._fftRecursive(even);
    const oddFFT = this._fftRecursive(odd);

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
    const conjugated = X.map(x => ({real: x.real, imag: -x.imag}));
    const result = this._fftRecursive(conjugated);
    
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
   * Trapezoidal integration - equivalent to MATLAB cumtrapz
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
   * Fourier Analysis - equivalent to MATLAB Steps 12
   */
  performFourierAnalysis(signal, fs) {
    const dt = 1 / fs;
    const L = signal.length;
    
    // Perform FFT
    const Y = this.fft(signal);
    
    // Compute single-sided amplitude spectrum
    const P2 = Y.map(val => Math.sqrt(val.real * val.real + val.imag * val.imag) / L);
    const P1 = P2.slice(0, Math.floor(L/2) + 1);
    
    // Double the amplitudes (except DC and Nyquist)
    for (let i = 1; i < P1.length - 1; i++) {
      P1[i] *= 2;
    }
    
    const f = Array.from({length: P1.length}, (_, i) => fs * i / L);
    
    return {
      frequencies: f,
      amplitudes: P1,
      phases: Y.slice(0, Math.floor(L/2) + 1).map(val => Math.atan2(val.imag, val.real))
    };
  }

  /**
   * Bracketed Duration calculation
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
   * Site Frequency calculation
   */
  findSiteFrequency(acceleration, fs) {
    const N = acceleration.length;
    const frequencies = Array.from({length: Math.floor(N/2)}, (_, i) => i * fs / N);
    const fftResult = this.fft(acceleration);
    const amplitudes = fftResult.slice(0, Math.floor(N/2)).map(x => 
      Math.sqrt(x.real * x.real + x.imag * x.imag)
    );

    const maxIndex = amplitudes.indexOf(Math.max(...amplitudes));
    return {
      frequency: frequencies[maxIndex],
      magnitude: amplitudes[maxIndex],
      frequencies,
      amplitudes
    };
  }

  /**
   * Arias Intensity calculation
   */
  calculateAriasIntensity(time, acceleration) {
    // Convert from cm/s² to m/s²
    const accMps2 = acceleration.map(a => a / 100);
    
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
   * Response Spectrum calculation using Newmark-Beta method
   */
  calculateResponseSpectrum(acceleration, time, dampingRatio = 0.05) {
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

    const n = acceleration.length;

    for (let i = 0; i < frequencies.length; i++) {
      const f = frequencies[i];
      const omega = 2 * Math.PI * f;
      const m = 1; // Unit mass
      const k = m * omega * omega;
      const c = 2 * dampingRatio * m * omega;

      const u = new Array(n).fill(0);
      const v = new Array(n).fill(0);
      const acc = new Array(n).fill(0);

      const keff = k + a0 * m + a1 * c;

      if (!isFinite(keff) || keff === 0) {
        PSA.push(0);
        PSV.push(0);
        SD.push(0);
        continue;
      }

      // Time integration loop
      for (let j = 1; j < n; j++) {
        const dp = -m * (acceleration[j] - acceleration[j-1]);
        const rhs = dp + 
                   m * (a0 * u[j-1] + a2 * v[j-1] + a3 * acc[j-1]) +
                   c * (a1 * u[j-1] + a4 * v[j-1] + a5 * acc[j-1]);
        
        const du = rhs / keff;
        const dv = a1 * du - a4 * u[j-1] - a2 * v[j-1] - a5 * acc[j-1];
        const da = a0 * du - a0 * u[j-1] - a2 * v[j-1] - a3 * acc[j-1];
        
        u[j] = du;
        v[j] = dv;
        acc[j] = da;
      }

      // Save peak responses
      SD.push(Math.max(...u.map(Math.abs)));
      PSV.push(Math.max(...v.map(Math.abs)));
      PSA.push(Math.max(...acc.map(Math.abs)));
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

  /**
   * Generate plots data for external visualization
   */
  generatePlotsData(results) {
    return {
      timeSeriesPlots: {
        raw: {
          time: results.rawData.time,
          acceleration: results.rawData.acceleration,
          velocity: results.rawData.velocity,
          displacement: results.rawData.displacement
        },
        preprocessed: {
          time: results.preprocessedData.time,
          acceleration: results.preprocessedData.acceleration,
          velocity: results.preprocessedData.velocity,
          displacement: results.preprocessedData.displacement
        }
      },
      fourierSpectrum: {
        frequencies: results.fourierAnalysis.frequencies,
        amplitudes: results.fourierAnalysis.amplitudes
      },
      responseSpectrum: {
        periods: results.responseSpectrum.periods,
        PSA: results.responseSpectrum.PSA,
        PSV: results.responseSpectrum.PSV,
        SD: results.responseSpectrum.SD
      },
      ariasIntensity: {
        time: results.preprocessedData.time,
        cumulative: results.ariasIntensity.cumulative
      },
      bracketedDuration: {
        time: results.preprocessedData.time,
        acceleration: results.preprocessedData.acceleration,
        startTime: results.bracketedDuration.startTime,
        endTime: results.bracketedDuration.endTime
      }
    };
  }

  /**
   * Export results to JSON file
   */
  async exportToFile(results, filename) {
    const outputPath = path.resolve(filename);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Results exported to: ${outputPath}`);
  }

  /**
   * Batch process multiple records
   */
  async batchAnalyze(query = {}, options = {}) {
    try {
      await this.client.connect();
      const db = this.client.db('earthquake_data');
      const collection = db.collection('acceleration_records');
      
      const records = await collection.find({
        ...query,
        matlab_equivalent_analysis: { $exists: false }
      }).toArray();

      console.log(`📊 Found ${records.length} records to analyze`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          console.log(`\n🔄 Analyzing record: ${record._id}`);
          const result = await this.analyzeEarthquakeRecord(record._id, options);
          results.push({ recordId: record._id, success: true, result });
          successCount++;
          
        } catch (error) {
          console.error(`❌ Failed to analyze ${record._id}:`, error.message);
          results.push({ recordId: record._id, success: false, error: error.message });
          errorCount++;
        }
      }

      console.log(`\n📊 Batch analysis complete:`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Failed: ${errorCount}`);
      console.log(`   Total: ${records.length}`);

      return results;

    } finally {
      await this.client.close();
    }
  }
}

// Usage functions
async function analyzeSingleRecord(recordId, options = {}) {
  const analyzer = new EarthquakeAnalyzer(process.env.MONGO_URI);
  return await analyzer.analyzeEarthquakeRecord(recordId, options);
}

async function batchAnalyzeRecords(query = {}, options = {}) {
  const analyzer = new EarthquakeAnalyzer(process.env.MONGO_URI);
  return await analyzer.batchAnalyze(query, options);
}

async function exportResults(recordId, filename, options = {}) {
  const analyzer = new EarthquakeAnalyzer(process.env.MONGO_URI);
  const results = await analyzer.analyzeEarthquakeRecord(recordId, options);
  await analyzer.exportToFile(results, filename);
  return results;
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case 'analyze':
      if (!arg1) {
        console.log('Usage: node earthquakeAnalysis.js analyze <recordId> [direction]');
        console.log('Example: node earthquakeAnalysis.js analyze "507f1f77bcf86cd799439011" ns_acceleration');
        process.exit(1);
      }
      const options = arg2 ? { direction: arg2 } : {};
      analyzeSingleRecord(arg1, options)
        .then(result => {
          console.log('✅ Analysis completed');
          console.log(`🎯 Direction: ${result.direction}`);
          console.log(`📊 PGA: ${result.preprocessedData.PGA.toFixed(2)} cm/s²`);
          console.log(`⏱️  Bracketed Duration: ${result.bracketedDuration.duration.toFixed(2)} s`);
          console.log(`🎵 Site Frequency: ${result.siteFrequency.frequency.toFixed(2)} Hz`);
        })
        .catch(err => {
          console.error('❌ Analysis failed:', err.message);
          process.exit(1);
        });
      break;

    case 'batch':
      console.log('🚀 Starting batch analysis...');
      batchAnalyzeRecords()
        .then(results => {
          console.log('✅ Batch analysis completed');
        })
        .catch(err => {
          console.error('❌ Batch analysis failed:', err.message);
          process.exit(1);
        });
      break;

    case 'export':
      if (!arg1 || !arg2) {
        console.log('Usage: node earthquakeAnalysis.js export <recordId> <filename>');
        console.log('Example: node earthquakeAnalysis.js export "507f1f77bcf86cd799439011" results.json');
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
      console.log('🌍 Earthquake Analysis Tool - MATLAB Equivalent');
      console.log('Available commands:');
      console.log('  analyze <recordId> [direction]  - Analyze single record');
      console.log('  batch                          - Analyze all unprocessed records');
      console.log('  export <recordId> <filename>   - Export results to JSON file');
      console.log('');
      console.log('Examples:');
      console.log('  node earthquakeAnalysis.js analyze "507f1f77bcf86cd799439011"');
      console.log('  node earthquakeAnalysis.js analyze "507f1f77bcf86cd799439011" ew_acceleration');
      console.log('  node earthquakeAnalysis.js batch');
      console.log('  node earthquakeAnalysis.js export "507f1f77bcf86cd799439011" my_results.json');
      break;
  }
}

// Export for use in other modules
module.exports = {
  EarthquakeAnalyzer,
  analyzeSingleRecord,
  batchAnalyzeRecords,
  exportResults
};