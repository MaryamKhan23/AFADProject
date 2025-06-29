/**
 * Integrated Earthquake Data Processor
 * JavaScript port of MATLAB earthquake analysis with MongoDB integration
 * 
 * Features:
 * - Complete MATLAB algorithm port (filtering, response spectra, etc.)
 * - Seamless integration with existing parseAscToMongo.js
 * - MongoDB storage with analysis results
 * - Batch processing capabilities
 * - Interactive analysis pipeline
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const readline = require('readline');

// Import existing modules
const { parseAscFile, processEarthquakeFilesWithPreprocessing } = require('./scripts/parseAscToMongo');

class EarthquakeAnalyzer {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = new MongoClient(mongoUri);
    this.db = null;
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db('earthquake_data');
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  /**
   * MATLAB Port: Preprocessing with Boore Filter
   */
  preprocessBoore(data, fs, cornerFreq) {
    // Step 1: Detrend (remove linear trend)
    const detrended = this.detrend(data);
    
    // Step 2: FFT
    const N = detrended.length;
    const fftData = this.fft(detrended);
    
    // Step 3-4: High-pass filter in frequency domain
    const f = Array.from({length: N}, (_, i) => i * fs / N);
    const hpFilter = f.map(freq => freq >= cornerFreq ? 1 : 0);
    
    // Step 5: Symmetrize filter
    if (N % 2 === 0) {
      for (let i = Math.floor(N/2) + 1; i < N; i++) {
        hpFilter[i] = hpFilter[N - i];
      }
    } else {
      for (let i = Math.floor((N+1)/2); i < N; i++) {
        hpFilter[i] = hpFilter[N - i];
      }
    }
    
    // Step 6-7: Apply filter and inverse FFT
    const filteredFFT = fftData.map((val, i) => ({
      real: val.real * hpFilter[i],
      imag: val.imag * hpFilter[i]
    }));
    
    return this.ifft(filteredFFT).map(c => c.real);
  }

  /**
   * Calculate velocity and displacement from acceleration
   */
  integrateSignal(signal, dt) {
    const velocity = this.cumtrapz(signal, dt);
    const displacement = this.cumtrapz(velocity, dt);
    return { velocity, displacement };
  }

  /**
   * Calculate Peak Ground Motion parameters
   */
  calculatePGM(acceleration, velocity, displacement) {
    return {
      PGA: Math.max(...acceleration.map(Math.abs)),
      PGV: Math.max(...velocity.map(Math.abs)),
      PGD: Math.max(...displacement.map(Math.abs))
    };
  }

  /**
   * MATLAB Port: Fourier Transform Analysis
   */
  fourierAnalysis(signal, fs) {
    const L = signal.length;
    const Y = this.fft(signal);
    
    // Single-sided amplitude spectrum
    const P2 = Y.map(c => Math.sqrt(c.real*c.real + c.imag*c.imag) / L);
    const P1 = P2.slice(0, Math.floor(L/2) + 1);
    
    // Adjust amplitudes
    for (let i = 1; i < P1.length - 1; i++) {
      P1[i] *= 2;
    }
    
    const f = Array.from({length: P1.length}, (_, i) => fs * i / L);
    
    return { frequencies: f, amplitudes: P1, phases: Y.map(c => Math.atan2(c.imag, c.real)) };
  }

  /**
   * Calculate Bracketed Duration (5% threshold)
   */
  calculateBracketedDuration(acceleration, time, threshold = 0.05) {
    const PGA = Math.max(...acceleration.map(Math.abs));
    const thresholdValue = threshold * PGA;
    
    const aboveThreshold = acceleration.map((acc, i) => 
      Math.abs(acc) >= thresholdValue ? i : -1
    ).filter(i => i !== -1);
    
    if (aboveThreshold.length === 0) {
      return { duration: 0, startTime: NaN, endTime: NaN };
    }
    
    const startTime = time[aboveThreshold[0]];
    const endTime = time[aboveThreshold[aboveThreshold.length - 1]];
    
    return {
      duration: endTime - startTime,
      startTime,
      endTime
    };
  }

  /**
   * Calculate Site Frequency (dominant frequency)
   */
  calculateSiteFrequency(acceleration, fs) {
    const fourierResult = this.fourierAnalysis(acceleration, fs);
    const maxIndex = fourierResult.amplitudes.indexOf(Math.max(...fourierResult.amplitudes));
    return fourierResult.frequencies[maxIndex];
  }

  /**
   * Calculate Arias Intensity
   */
  calculateAriasIntensity(acceleration, time) {
    const g = 9.81; // m/s²
    const accelerationMs2 = acceleration.map(acc => acc / 100); // Convert cm/s² to m/s²
    
    const integrand = accelerationMs2.map(acc => acc * acc);
    const integral = this.trapz(time, integrand);
    
    return (Math.PI / (2 * g)) * integral;
  }

  /**
   * MATLAB Port: Response Spectra Calculation using Newmark-Beta
   */
  calculateResponseSpectra(acceleration, dt, dampingRatio = 0.05, periods = null) {
    if (!periods) {
      periods = Array.from({length: 500}, (_, i) => 0.01 + i * 0.02); // 0.01s to 10s
    }
    
    const frequencies = periods.map(T => 1 / T);
    const n = acceleration.length;
    
    // Newmark-beta constants
    const beta = 0.25;
    const gamma = 0.5;
    const a0 = 1 / (beta * dt * dt);
    const a1 = gamma / (beta * dt);
    const a2 = 1 / (beta * dt);
    const a3 = 1 / (2 * beta) - 1;
    const a4 = gamma / beta - 1;
    const a5 = dt * (gamma / (2 * beta) - 1);
    
    const PSA = [];
    const PSV = [];
    const SD = [];
    
    for (const freq of frequencies) {
      const omega = 2 * Math.PI * freq;
      const m = 1; // Unit mass
      const k = m * omega * omega;
      const c = 2 * dampingRatio * m * omega;
      
      const keff = k + a0 * m + a1 * c;
      
      if (keff === 0 || !isFinite(keff)) {
        PSA.push(0);
        PSV.push(0);
        SD.push(0);
        continue;
      }
      
      // Initialize arrays
      const u = new Array(n).fill(0);  // Displacement
      const v = new Array(n).fill(0);  // Velocity
      const acc = new Array(n).fill(0); // Relative acceleration
      
      // Time integration
      for (let j = 1; j < n; j++) {
        const dp = -m * (acceleration[j] - acceleration[j-1]);
        const rhs = dp + 
          m * (a0 * u[j-1] + a2 * v[j-1] + a3 * acc[j-1]) +
          c * (a1 * u[j-1] + a4 * v[j-1] + a5 * acc[j-1]);
        
        const du = rhs / keff;
        const dv = a1 * du - a1 * u[j-1] + a4 * v[j-1] + a5 * acc[j-1];
        const da = a0 * du - a0 * u[j-1] - a2 * v[j-1] - a3 * acc[j-1];
        
        u[j] = du;
        v[j] = dv;
        acc[j] = da;
      }
      
      // Peak responses
      SD.push(Math.max(...u.map(Math.abs)));
      PSV.push(Math.max(...v.map(Math.abs)));
      PSA.push(Math.max(...acc.map(Math.abs)));
    }
    
    return { periods, PSA, PSV, SD };
  }

  /**
   * Complete Analysis Pipeline (MATLAB equivalent)
   */
  async analyzeEarthquakeData(basePath, cornerFreq = 0.05) {
    console.log('🔄 Starting comprehensive earthquake analysis...');
    
    // Step 1: Load and preprocess data (using existing function)
    const parsedData = await processEarthquakeFilesWithPreprocessing(basePath);
    
    // Step 2: Extract acceleration data
    const dt = parsedData.samplingInterval;
    const fs = 1 / dt;
    const time = parsedData.data.time;
    
    // Analyze each component
    const components = ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'];
    const analysisResults = {};
    
    for (const component of components) {
      console.log(`📊 Analyzing ${component}...`);
      
      const rawAcc = parsedData.data[component];
      if (!rawAcc || rawAcc.every(val => val === 0)) {
        console.warn(`⚠️ No data for ${component}, skipping...`);
        continue;
      }
      
      // Preprocessing with Boore filter
      const preprocessedAcc = this.preprocessBoore(rawAcc, fs, cornerFreq);
      
      // Integration
      const { velocity, displacement } = this.integrateSignal(preprocessedAcc, dt);
      
      // Peak Ground Motion
      const pgm = this.calculatePGM(preprocessedAcc, velocity, displacement);
      
      // Fourier Analysis
      const fourier = this.fourierAnalysis(preprocessedAcc, fs);
      
      // Bracketed Duration
      const bracketedDuration = this.calculateBracketedDuration(preprocessedAcc, time);
      
      // Site Frequency
      const siteFrequency = this.calculateSiteFrequency(preprocessedAcc, fs);
      
      // Arias Intensity
      const ariasIntensity = this.calculateAriasIntensity(preprocessedAcc, time);
      
      // Response Spectra
      const responseSpectra = this.calculateResponseSpectra(preprocessedAcc, dt);
      
      analysisResults[component] = {
        rawData: rawAcc,
        preprocessedData: preprocessedAcc,
        velocity,
        displacement,
        pgm,
        fourier,
        bracketedDuration,
        siteFrequency,
        ariasIntensity,
        responseSpectra,
        processingParameters: {
          cornerFrequency: cornerFreq,
          samplingRate: fs,
          dampingRatio: 0.05
        }
      };
    }
    
    // Compile comprehensive results
    const comprehensiveResults = {
      metadata: {
        eventId: parsedData.header['EVENT_ID'],
        stationId: parsedData.header['STATION_CODE'],
        processingDate: new Date(),
        samplingInterval: dt,
        totalDataPoints: time.length
      },
      components: analysisResults,
      summary: this.generateSummary(analysisResults)
    };
    
    console.log('✅ Analysis completed');
    return comprehensiveResults;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(analysisResults) {
    const summary = {
      maxPGA: 0,
      maxPGV: 0,
      maxPGD: 0,
      dominantFrequency: 0,
      totalAriasIntensity: 0,
      longestBracketedDuration: 0
    };
    
    Object.values(analysisResults).forEach(result => {
      if (result.pgm) {
        summary.maxPGA = Math.max(summary.maxPGA, result.pgm.PGA);
        summary.maxPGV = Math.max(summary.maxPGV, result.pgm.PGV);
        summary.maxPGD = Math.max(summary.maxPGD, result.pgm.PGD);
      }
      if (result.siteFrequency) {
        summary.dominantFrequency = Math.max(summary.dominantFrequency, result.siteFrequency);
      }
      if (result.ariasIntensity) {
        summary.totalAriasIntensity += result.ariasIntensity;
      }
      if (result.bracketedDuration && result.bracketedDuration.duration) {
        summary.longestBracketedDuration = Math.max(summary.longestBracketedDuration, result.bracketedDuration.duration);
      }
    });
    
    return summary;
  }

  /**
   * Store analysis results in MongoDB
   */
  async storeAnalysisResults(analysisResults) {
    const collection = this.db.collection('earthquake_analysis');
    
    const document = {
      ...analysisResults,
      createdAt: new Date(),
      version: '1.0'
    };
    
    const result = await collection.updateOne(
      { 
        'metadata.eventId': analysisResults.metadata.eventId,
        'metadata.stationId': analysisResults.metadata.stationId
      },
      { $set: document },
      { upsert: true }
    );
    
    console.log('💾 Analysis results stored in MongoDB');
    return result;
  }

  /**
   * Interactive Analysis Interface
   */
  async interactiveAnalysis() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    
    try {
      console.log('🎛️  Interactive Earthquake Analysis Tool');
      console.log('=====================================');
      
      const basePath = await question('Enter earthquake file base path: ');
      const cornerFreqInput = await question('Enter corner frequency [0.05]: ');
      const cornerFreq = parseFloat(cornerFreqInput) || 0.05;
      
      console.log('\n🔄 Starting analysis...');
      const results = await this.analyzeEarthquakeData(basePath, cornerFreq);
      
      console.log('\n📊 Analysis Summary:');
      console.log(`   Event ID: ${results.metadata.eventId}`);
      console.log(`   Station ID: ${results.metadata.stationId}`);
      console.log(`   Max PGA: ${results.summary.maxPGA.toFixed(2)} cm/s²`);
      console.log(`   Max PGV: ${results.summary.maxPGV.toFixed(2)} cm/s`);
      console.log(`   Max PGD: ${results.summary.maxPGD.toFixed(2)} cm`);
      console.log(`   Dominant Frequency: ${results.summary.dominantFrequency.toFixed(2)} Hz`);
      console.log(`   Total Arias Intensity: ${(results.summary.totalAriasIntensity * 100).toFixed(2)} cm²/s`);
      console.log(`   Longest Bracketed Duration: ${results.summary.longestBracketedDuration.toFixed(2)} s`);
      
      const saveToDb = await question('\nSave results to database? (y/n): ');
      if (saveToDb.toLowerCase() === 'y') {
        await this.storeAnalysisResults(results);
      }
      
      const exportResults = await question('Export results to JSON? (y/n): ');
      if (exportResults.toLowerCase() === 'y') {
        const filename = `analysis_${results.metadata.eventId}_${results.metadata.stationId}.json`;
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        console.log(`📄 Results exported to ${filename}`);
      }
      
    } finally {
      rl.close();
    }
  }

  /**
   * Batch Analysis
   */
  async batchAnalysis(directory, cornerFreq = 0.05) {
    console.log('🔄 Starting batch analysis...');
    
    const files = fs.readdirSync(directory).filter(file => file.endsWith('.asc'));
    const uniqueBasePaths = new Set();
    
    files.forEach(file => {
      const match = file.match(/^(.+)_[ENU]\.asc$/);
      if (match) {
        uniqueBasePaths.add(path.join(directory, match[1]));
      }
    });
    
    console.log(`📊 Found ${uniqueBasePaths.size} earthquake events to analyze`);
    
    const results = [];
    let processed = 0;
    
    for (const basePath of uniqueBasePaths) {
      try {
        console.log(`\n🔄 Processing ${++processed}/${uniqueBasePaths.size}: ${path.basename(basePath)}`);
        
        const analysisResults = await this.analyzeEarthquakeData(basePath, cornerFreq);
        await this.storeAnalysisResults(analysisResults);
        
        results.push({
          basePath: path.basename(basePath),
          eventId: analysisResults.metadata.eventId,
          stationId: analysisResults.metadata.stationId,
          summary: analysisResults.summary,
          success: true
        });
        
        console.log(`✅ Completed: ${path.basename(basePath)}`);
        
      } catch (error) {
        console.error(`❌ Failed ${path.basename(basePath)}:`, error.message);
        results.push({
          basePath: path.basename(basePath),
          success: false,
          error: error.message
        });
      }
    }
    
    // Generate batch summary
    const successful = results.filter(r => r.success);
    console.log('\n📊 Batch Analysis Summary:');
    console.log(`   Total processed: ${results.length}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${results.length - successful.length}`);
    
    if (successful.length > 0) {
      const avgPGA = successful.reduce((sum, r) => sum + r.summary.maxPGA, 0) / successful.length;
      console.log(`   Average Max PGA: ${avgPGA.toFixed(2)} cm/s²`);
    }
    
    return results;
  }

  // =================== UTILITY FUNCTIONS ===================
  
  /**
   * Linear detrending
   */
  detrend(data) {
    const n = data.length;
    const x = Array.from({length: n}, (_, i) => i);
    
    // Calculate linear trend using least squares
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return data.map((val, i) => val - (slope * i + intercept));
  }

  /**
   * Trapezoidal integration
   */
  trapz(x, y) {
    let integral = 0;
    for (let i = 1; i < x.length; i++) {
      integral += (x[i] - x[i-1]) * (y[i] + y[i-1]) / 2;
    }
    return integral;
  }

  /**
   * Cumulative trapezoidal integration
   */
  cumtrapz(y, dx) {
    const result = [0];
    for (let i = 1; i < y.length; i++) {
      result[i] = result[i-1] + dx * (y[i] + y[i-1]) / 2;
    }
    return result;
  }

  /**
   * Simple FFT implementation (for small arrays, consider using a library for production)
   */
  fft(signal) {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({real: x, imag: 0}));
    
    // Ensure power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const paddedSignal = [...signal];
    while (paddedSignal.length < nextPow2) {
      paddedSignal.push(0);
    }
    
    return this.fftRecursive(paddedSignal.map(x => ({real: x, imag: 0})));
  }

  fftRecursive(x) {
    const N = x.length;
    if (N <= 1) return x;
    
    const even = this.fftRecursive(x.filter((_, i) => i % 2 === 0));
    const odd = this.fftRecursive(x.filter((_, i) => i % 2 === 1));
    
    const T = [];
    for (let k = 0; k < N/2; k++) {
      const t = {
        real: Math.cos(-2 * Math.PI * k / N) * odd[k].real - Math.sin(-2 * Math.PI * k / N) * odd[k].imag,
        imag: Math.sin(-2 * Math.PI * k / N) * odd[k].real + Math.cos(-2 * Math.PI * k / N) * odd[k].imag
      };
      T[k] = t;
    }
    
    const result = [];
    for (let k = 0; k < N/2; k++) {
      result[k] = {
        real: even[k].real + T[k].real,
        imag: even[k].imag + T[k].imag
      };
      result[k + N/2] = {
        real: even[k].real - T[k].real,
        imag: even[k].imag - T[k].imag
      };
    }
    
    return result;
  }

  /**
   * Inverse FFT
   */
  ifft(X) {
    // Conjugate
    const conjugated = X.map(x => ({real: x.real, imag: -x.imag}));
    
    // FFT
    const result = this.fftRecursive(conjugated);
    
    // Conjugate and normalize
    return result.map(x => ({
      real: x.real / X.length,
      imag: -x.imag / X.length
    }));
  }
}

// =================== MAIN EXECUTION ===================

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const analyzer = new EarthquakeAnalyzer(mongoUri);
  
  try {
    await analyzer.connect();
    
    const args = process.argv.slice(2);
    const mode = args[0];
    
    switch (mode) {
      case 'interactive':
        await analyzer.interactiveAnalysis();
        break;
        
      case 'single':
        if (args[1]) {
          const cornerFreq = parseFloat(args[2]) || 0.05;
          const results = await analyzer.analyzeEarthquakeData(args[1], cornerFreq);
          await analyzer.storeAnalysisResults(results);
          console.log('✅ Single file analysis completed');
        } else {
          console.error('Usage: node integrated_processor.js single <basePath> [cornerFreq]');
        }
        break;
        
      case 'batch':
        if (args[1]) {
          const cornerFreq = parseFloat(args[2]) || 0.05;
          await analyzer.batchAnalysis(args[1], cornerFreq);
          console.log('✅ Batch analysis completed');
        } else {
          console.error('Usage: node integrated_processor.js batch <directory> [cornerFreq]');
        }
        break;
        
      default:
        console.log('🎛️  Earthquake Data Analysis Tool');
        console.log('==================================');
        console.log('Usage:');
        console.log('  Interactive mode: node integrated_processor.js interactive');
        console.log('  Single analysis:  node integrated_processor.js single <basePath> [cornerFreq]');
        console.log('  Batch analysis:   node integrated_processor.js batch <directory> [cornerFreq]');
        console.log('');
        console.log('Examples:');
        console.log('  node integrated_processor.js interactive');
        console.log('  node integrated_processor.js single ./data/earthquake_001 0.05');
        console.log('  node integrated_processor.js batch ./afad_downloads/data/ 0.1');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await analyzer.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { EarthquakeAnalyzer };