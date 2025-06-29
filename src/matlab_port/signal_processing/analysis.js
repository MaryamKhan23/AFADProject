/**
 * analysis.js - Earthquake Signal Analysis Functions
 * JavaScript port of MATLAB earthquake analysis algorithms
 * 
 * This module provides comprehensive earthquake signal analysis including:
 * - Peak Ground Motion calculations (PGA, PGV, PGD)
 * - Bracketed Duration
 * - Site Frequency Analysis
 * - Arias Intensity
 * - Response Spectra (SDOF)
 * - Fourier Transform Analysis
 */

const { fft, ifft } = require('../transforms');
const { detrend, trapz, cumtrapz } = require('../utils');
const { Matrix } = require('../data_structures/matrix');

class EarthquakeAnalyzer {
  constructor(options = {}) {
    this.options = {
      samplingRate: 100, // Hz (default)
      dampingRatio: 0.05, // 5% damping for response spectra
      gravityConstant: 9.81, // m/s²
      ...options
    };
  }

  /**
   * Calculate Peak Ground Motion values (PGA, PGV, PGD)
   * @param {Array} acceleration - Acceleration time series (cm/s²)
   * @param {Array} time - Time array (s)
   * @returns {Object} Peak ground motion values
   */
  calculatePeakGroundMotion(acceleration, time) {
    if (!Array.isArray(acceleration) || !Array.isArray(time)) {
      throw new Error('Acceleration and time must be arrays');
    }

    if (acceleration.length !== time.length) {
      throw new Error('Acceleration and time arrays must have same length');
    }

    const dt = time.length > 1 ? time[1] - time[0] : 0.01;

    // Calculate velocity and displacement using trapezoidal integration
    const velocity = cumtrapz(time, acceleration);
    const displacement = cumtrapz(time, velocity);

    // Calculate peak values
    const PGA = Math.max(...acceleration.map(Math.abs));
    const PGV = Math.max(...velocity.map(Math.abs));
    const PGD = Math.max(...displacement.map(Math.abs));

    return {
      PGA,
      PGV,
      PGD,
      velocity,
      displacement,
      units: {
        PGA: 'cm/s²',
        PGV: 'cm/s',
        PGD: 'cm'
      }
    };
  }

  /**
   * Calculate Bracketed Duration (time between first and last exceedance of threshold)
   * @param {Array} acceleration - Acceleration time series
   * @param {Array} time - Time array
   * @param {number} threshold - Threshold value (default: 5% of PGA)
   * @returns {Object} Bracketed duration information
   */
  calculateBracketedDuration(acceleration, time, threshold = null) {
    const PGA = Math.max(...acceleration.map(Math.abs));
    const thresh = threshold || (0.05 * PGA);

    const aboveThreshold = acceleration.map((acc, i) => ({
      index: i,
      time: time[i],
      above: Math.abs(acc) >= thresh
    })).filter(item => item.above);

    if (aboveThreshold.length === 0) {
      return {
        duration: 0,
        startTime: null,
        endTime: null,
        threshold: thresh,
        exceedances: 0
      };
    }

    const startTime = aboveThreshold[0].time;
    const endTime = aboveThreshold[aboveThreshold.length - 1].time;
    const duration = endTime - startTime;

    return {
      duration,
      startTime,
      endTime,
      threshold: thresh,
      exceedances: aboveThreshold.length,
      units: 's'
    };
  }

  /**
   * Calculate Site Frequency (dominant frequency from Fourier spectrum)
   * @param {Array} acceleration - Acceleration time series
   * @param {number} samplingRate - Sampling rate (Hz)
   * @returns {Object} Site frequency analysis results
   */
  calculateSiteFrequency(acceleration, samplingRate) {
    const N = acceleration.length;
    const fs = samplingRate || this.options.samplingRate;

    // Perform FFT
    const fftResult = fft(acceleration);
    const amplitude = fftResult.map(complex => Math.sqrt(complex.re * complex.re + complex.im * complex.im));

    // Create frequency vector (single-sided)
    const frequencies = [];
    const singleSidedAmplitude = [];
    
    for (let i = 0; i < Math.floor(N / 2); i++) {
      frequencies.push(i * fs / N);
      singleSidedAmplitude.push(amplitude[i]);
    }

    // Find dominant frequency
    let maxAmplitudeIndex = 0;
    let maxAmplitude = singleSidedAmplitude[0];
    
    for (let i = 1; i < singleSidedAmplitude.length; i++) {
      if (singleSidedAmplitude[i] > maxAmplitude) {
        maxAmplitude = singleSidedAmplitude[i];
        maxAmplitudeIndex = i;
      }
    }

    const dominantFrequency = frequencies[maxAmplitudeIndex];

    return {
      dominantFrequency,
      maxAmplitude,
      frequencies,
      amplitudes: singleSidedAmplitude,
      units: {
        frequency: 'Hz',
        amplitude: 'cm/s²'
      }
    };
  }

  /**
   * Calculate Arias Intensity
   * @param {Array} acceleration - Acceleration time series (cm/s²)
   * @param {Array} time - Time array (s)
   * @returns {Object} Arias intensity results
   */
  calculateAriasIntensity(acceleration, time) {
    const g = this.options.gravityConstant;

    // Convert acceleration from cm/s² to m/s²
    const accMeters = acceleration.map(acc => acc / 100);

    // Calculate Arias Intensity: AI = (π/2g) * ∫(a²)dt
    const accelerationSquared = accMeters.map(acc => acc * acc);
    const integral = trapz(time, accelerationSquared);
    const ariasIntensity = (Math.PI / (2 * g)) * integral;

    // Calculate cumulative Arias Intensity
    const cumulativeAI = cumtrapz(time, accelerationSquared).map(val => (Math.PI / (2 * g)) * val);

    return {
      ariasIntensity: ariasIntensity * 100, // Convert back to cm²/s
      cumulativeAI: cumulativeAI.map(val => val * 100), // Convert back to cm²/s
      time,
      units: 'cm²/s'
    };
  }

  /**
   * Calculate Response Spectra using SDOF oscillator (Newmark-beta method)
   * @param {Array} acceleration - Ground acceleration time series (cm/s²)
   * @param {Array} time - Time array (s)
   * @param {Array} periods - Array of structural periods (s)
   * @param {number} damping - Damping ratio (default: 0.05)
   * @returns {Object} Response spectra (PSA, PSV, SD)
   */
  calculateResponseSpectra(acceleration, time, periods = null, damping = null) {
    const zeta = damping || this.options.dampingRatio;
    const dt = time.length > 1 ? time[1] - time[0] : 0.01;
    
    // Default period array if not provided
    if (!periods) {
      periods = [];
      for (let T = 0.01; T <= 10; T += 0.02) {
        periods.push(T);
      }
    }

    const frequencies = periods.map(T => 1 / T);
    const PSA = new Array(periods.length).fill(0);
    const PSV = new Array(periods.length).fill(0);
    const SD = new Array(periods.length).fill(0);

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

    // Loop over each period
    for (let i = 0; i < periods.length; i++) {
      const T = periods[i];
      const omega = 2 * Math.PI / T;
      const m = 1; // Unit mass
      const k = m * omega * omega; // Stiffness
      const c = 2 * zeta * m * omega; // Damping coefficient

      // Initialize response arrays
      const u = new Array(n).fill(0); // Displacement
      const v = new Array(n).fill(0); // Velocity
      const acc = new Array(n).fill(0); // Relative acceleration

      const keff = k + a0 * m + a1 * c;

      // Skip if effective stiffness is invalid
      if (!isFinite(keff) || keff <= 0) {
        continue;
      }

      // Time integration using Newmark-beta method
      for (let j = 1; j < n; j++) {
        const dp = -m * (acceleration[j] - acceleration[j - 1]);
        const rhs = dp + m * (a0 * u[j - 1] + a2 * v[j - 1] + a3 * acc[j - 1]) +
                    c * (a1 * u[j - 1] + a4 * v[j - 1] + a5 * acc[j - 1]);
        
        const du = rhs / keff;
        const dv = a1 * (du - u[j - 1]) - a4 * v[j - 1] - a5 * acc[j - 1];
        const da = a0 * (du - u[j - 1]) - a2 * v[j - 1] - a3 * acc[j - 1];
        
        u[j] = du;
        v[j] = dv;
        acc[j] = da;
      }

      // Calculate peak responses
      SD[i] = Math.max(...u.map(Math.abs));
      PSV[i] = Math.max(...v.map(Math.abs));
      PSA[i] = Math.max(...acc.map(Math.abs));
    }

    return {
      periods,
      frequencies,
      SD,    // Spectral Displacement (m)
      PSV,   // Pseudo Spectral Velocity (m/s)
      PSA,   // Pseudo Spectral Acceleration (m/s²)
      damping: zeta,
      units: {
        periods: 's',
        frequencies: 'Hz',
        SD: 'm',
        PSV: 'm/s',
        PSA: 'm/s²'
      }
    };
  }

  /**
   * Enhanced Fourier Transform Analysis with phase spectrum
   * @param {Array} signal - Input signal
   * @param {number} samplingRate - Sampling rate (Hz)
   * @returns {Object} Fourier analysis results
   */
  calculateFourierSpectrum(signal, samplingRate) {
    const fs = samplingRate || this.options.samplingRate;
    const N = signal.length;

    // Perform FFT
    const fftResult = fft(signal);
    
    // Calculate single-sided amplitude spectrum
    const amplitudes = [];
    const phases = [];
    const frequencies = [];

    for (let i = 0; i < Math.floor(N / 2) + 1; i++) {
      const re = fftResult[i].re;
      const im = fftResult[i].im;
      
      let amplitude = Math.sqrt(re * re + im * im) / N;
      if (i > 0 && i < Math.floor(N / 2)) {
        amplitude *= 2; // Single-sided scaling
      }
      
      const phase = Math.atan2(im, re);
      
      amplitudes.push(amplitude);
      phases.push(phase);
      frequencies.push(i * fs / N);
    }

    return {
      frequencies,
      amplitudes,
      phases,
      samplingRate: fs,
      signalLength: N,
      units: {
        frequency: 'Hz',
        amplitude: 'cm/s²',
        phase: 'radians'
      }
    };
  }

  /**
   * Comprehensive earthquake analysis - combines all analysis functions
   * @param {Object} data - Earthquake data object
   * @param {Object} options - Analysis options
   * @returns {Object} Complete analysis results
   */
  performCompleteAnalysis(data, options = {}) {
    const {
      acceleration,
      time,
      samplingRate = this.options.samplingRate,
      calculateSpectra = true,
      spectraPeriods = null,
      bracketedThreshold = null
    } = { ...data, ...options };

    if (!Array.isArray(acceleration) || !Array.isArray(time)) {
      throw new Error('Acceleration and time data must be provided as arrays');
    }

    const results = {
      metadata: {
        dataPoints: acceleration.length,
        duration: time[time.length - 1] - time[0],
        samplingRate,
        analysisDate: new Date().toISOString()
      }
    };

    try {
      // 1. Peak Ground Motion
      console.log('Calculating Peak Ground Motion...');
      results.peakGroundMotion = this.calculatePeakGroundMotion(acceleration, time);

      // 2. Bracketed Duration
      console.log('Calculating Bracketed Duration...');
      results.bracketedDuration = this.calculateBracketedDuration(
        acceleration, 
        time, 
        bracketedThreshold
      );

      // 3. Site Frequency
      console.log('Calculating Site Frequency...');
      results.siteFrequency = this.calculateSiteFrequency(acceleration, samplingRate);

      // 4. Arias Intensity
      console.log('Calculating Arias Intensity...');
      results.ariasIntensity = this.calculateAriasIntensity(acceleration, time);

      // 5. Fourier Spectrum
      console.log('Calculating Fourier Spectrum...');
      results.fourierSpectrum = this.calculateFourierSpectrum(acceleration, samplingRate);

      // 6. Response Spectra (optional, computationally expensive)
      if (calculateSpectra) {
        console.log('Calculating Response Spectra...');
        results.responseSpectra = this.calculateResponseSpectra(
          acceleration, 
          time, 
          spectraPeriods
        );
      }

      results.success = true;
      results.errors = [];

    } catch (error) {
      console.error('Analysis error:', error);
      results.success = false;
      results.errors = [error.message];
    }

    return results;
  }

  /**
   * Batch analysis for multiple earthquake records
   * @param {Array} earthquakeRecords - Array of earthquake data objects
   * @param {Object} options - Analysis options
   * @returns {Array} Array of analysis results
   */
  async performBatchAnalysis(earthquakeRecords, options = {}) {
    const results = [];
    const {
      parallel = false,
      maxConcurrent = 4,
      progressCallback = null
    } = options;

    if (parallel && earthquakeRecords.length > 1) {
      console.log(`Starting parallel batch analysis of ${earthquakeRecords.length} records...`);
      
      // Process in chunks to avoid memory issues
      const chunks = [];
      for (let i = 0; i < earthquakeRecords.length; i += maxConcurrent) {
        chunks.push(earthquakeRecords.slice(i, i + maxConcurrent));
      }

      let completed = 0;
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(record => 
          Promise.resolve(this.performCompleteAnalysis(record, options))
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
        
        completed += chunk.length;
        if (progressCallback) {
          progressCallback(completed, earthquakeRecords.length);
        }
      }
    } else {
      // Sequential processing
      console.log(`Starting sequential batch analysis of ${earthquakeRecords.length} records...`);
      
      for (let i = 0; i < earthquakeRecords.length; i++) {
        const result = this.performCompleteAnalysis(earthquakeRecords[i], options);
        results.push(result);
        
        if (progressCallback) {
          progressCallback(i + 1, earthquakeRecords.length);
        }
      }
    }

    return results;
  }

  /**
   * Generate analysis summary statistics
   * @param {Array} analysisResults - Array of analysis results
   * @returns {Object} Summary statistics
   */
  generateSummaryStatistics(analysisResults) {
    const validResults = analysisResults.filter(result => result.success);
    
    if (validResults.length === 0) {
      return { error: 'No valid analysis results found' };
    }

    const summary = {
      totalRecords: analysisResults.length,
      successfulAnalyses: validResults.length,
      failedAnalyses: analysisResults.length - validResults.length,
      statistics: {}
    };

    // Calculate statistics for each parameter
    const parameters = [
      { key: 'peakGroundMotion.PGA', name: 'PGA', unit: 'cm/s²' },
      { key: 'peakGroundMotion.PGV', name: 'PGV', unit: 'cm/s' },
      { key: 'peakGroundMotion.PGD', name: 'PGD', unit: 'cm' },
      { key: 'bracketedDuration.duration', name: 'Bracketed Duration', unit: 's' },
      { key: 'siteFrequency.dominantFrequency', name: 'Site Frequency', unit: 'Hz' },
      { key: 'ariasIntensity.ariasIntensity', name: 'Arias Intensity', unit: 'cm²/s' }
    ];

    parameters.forEach(param => {
      const values = validResults.map(result => {
        const keys = param.key.split('.');
        let value = result;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      }).filter(v => v !== undefined && v !== null && !isNaN(v));

      if (values.length > 0) {
        values.sort((a, b) => a - b);
        
        summary.statistics[param.name] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((sum, v) => sum + v, 0) / values.length,
          median: values[Math.floor(values.length / 2)],
          p5: values[Math.floor(values.length * 0.05)],
          p95: values[Math.floor(values.length * 0.95)],
          stdDev: Math.sqrt(values.reduce((sum, v) => {
            const mean = values.reduce((s, val) => s + val, 0) / values.length;
            return sum + Math.pow(v - mean, 2);
          }, 0) / values.length),
          unit: param.unit
        };
      }
    });

    return summary;
  }

  /**
   * Export analysis results to various formats
   * @param {Object|Array} analysisResults - Analysis results
   * @param {string} format - Export format ('json', 'csv', 'summary')
   * @returns {string} Formatted output
   */
  exportResults(analysisResults, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(analysisResults, null, 2);
      
      case 'csv':
        return this._exportToCsv(analysisResults);
      
      case 'summary':
        if (Array.isArray(analysisResults)) {
          return this._formatSummary(this.generateSummaryStatistics(analysisResults));
        } else {
          return this._formatSingleResult(analysisResults);
        }
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private method to export results to CSV format
   */
  _exportToCsv(results) {
    if (!Array.isArray(results)) {
      results = [results];
    }

    const validResults = results.filter(r => r.success);
    if (validResults.length === 0) {
      return 'No valid results to export';
    }

    const headers = [
      'Record_ID', 'PGA_cm_s2', 'PGV_cm_s', 'PGD_cm',
      'Bracketed_Duration_s', 'Site_Frequency_Hz', 'Arias_Intensity_cm2_s',
      'Max_PSA_m_s2', 'Max_PSV_m_s', 'Max_SD_m'
    ];

    const rows = validResults.map((result, index) => [
      index + 1,
      result.peakGroundMotion?.PGA?.toFixed(2) || 'N/A',
      result.peakGroundMotion?.PGV?.toFixed(2) || 'N/A',
      result.peakGroundMotion?.PGD?.toFixed(2) || 'N/A',
      result.bracketedDuration?.duration?.toFixed(2) || 'N/A',
      result.siteFrequency?.dominantFrequency?.toFixed(2) || 'N/A',
      result.ariasIntensity?.ariasIntensity?.toFixed(2) || 'N/A',
      result.responseSpectra ? Math.max(...result.responseSpectra.PSA).toFixed(3) : 'N/A',
      result.responseSpectra ? Math.max(...result.responseSpectra.PSV).toFixed(3) : 'N/A',
      result.responseSpectra ? Math.max(...result.responseSpectra.SD).toFixed(4) : 'N/A'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Private method to format summary statistics
   */
  _formatSummary(summary) {
    let output = `Earthquake Analysis Summary\n`;
    output += `${'='.repeat(50)}\n`;
    output += `Total Records: ${summary.totalRecords}\n`;
    output += `Successful Analyses: ${summary.successfulAnalyses}\n`;
    output += `Failed Analyses: ${summary.failedAnalyses}\n\n`;

    Object.entries(summary.statistics).forEach(([param, stats]) => {
      output += `${param} (${stats.unit}):\n`;
      output += `  Count: ${stats.count}\n`;
      output += `  Mean: ${stats.mean.toFixed(3)}\n`;
      output += `  Median: ${stats.median.toFixed(3)}\n`;
      output += `  Min: ${stats.min.toFixed(3)}\n`;
      output += `  Max: ${stats.max.toFixed(3)}\n`;
      output += `  Std Dev: ${stats.stdDev.toFixed(3)}\n`;
      output += `  5th Percentile: ${stats.p5.toFixed(3)}\n`;
      output += `  95th Percentile: ${stats.p95.toFixed(3)}\n\n`;
    });

    return output;
  }

  /**
   * Private method to format single result
   */
  _formatSingleResult(result) {
    if (!result.success) {
      return `Analysis failed: ${result.errors?.join(', ') || 'Unknown error'}`;
    }

    let output = `Earthquake Analysis Results\n`;
    output += `${'='.repeat(40)}\n`;
    output += `Analysis Date: ${result.metadata?.analysisDate}\n`;
    output += `Data Points: ${result.metadata?.dataPoints}\n`;
    output += `Duration: ${result.metadata?.duration?.toFixed(2)} s\n\n`;

    if (result.peakGroundMotion) {
      output += `Peak Ground Motion:\n`;
      output += `  PGA: ${result.peakGroundMotion.PGA.toFixed(2)} cm/s²\n`;
      output += `  PGV: ${result.peakGroundMotion.PGV.toFixed(2)} cm/s\n`;
      output += `  PGD: ${result.peakGroundMotion.PGD.toFixed(2)} cm\n\n`;
    }

    if (result.bracketedDuration) {
      output += `Bracketed Duration: ${result.bracketedDuration.duration.toFixed(2)} s\n\n`;
    }

    if (result.siteFrequency) {
      output += `Site Frequency: ${result.siteFrequency.dominantFrequency.toFixed(2)} Hz\n\n`;
    }

    if (result.ariasIntensity) {
      output += `Arias Intensity: ${result.ariasIntensity.ariasIntensity.toFixed(2)} cm²/s\n\n`;
    }

    if (result.responseSpectra) {
      output += `Response Spectra (5% damping):\n`;
      output += `  Max PSA: ${Math.max(...result.responseSpectra.PSA).toFixed(3)} m/s²\n`;
      output += `  Max PSV: ${Math.max(...result.responseSpectra.PSV).toFixed(3)} m/s\n`;
      output += `  Max SD: ${Math.max(...result.responseSpectra.SD).toFixed(4)} m\n`;
    }

    return output;
  }
}

module.exports = {
  EarthquakeAnalyzer,
  
  // Export individual functions for direct use
  calculatePeakGroundMotion: (acc, time) => new EarthquakeAnalyzer().calculatePeakGroundMotion(acc, time),
  calculateBracketedDuration: (acc, time, thresh) => new EarthquakeAnalyzer().calculateBracketedDuration(acc, time, thresh),
  calculateSiteFrequency: (acc, fs) => new EarthquakeAnalyzer().calculateSiteFrequency(acc, fs),
  calculateAriasIntensity: (acc, time) => new EarthquakeAnalyzer().calculateAriasIntensity(acc, time),
  calculateResponseSpectra: (acc, time, periods, damping) => new EarthquakeAnalyzer().calculateResponseSpectra(acc, time, periods, damping),
  calculateFourierSpectrum: (signal, fs) => new EarthquakeAnalyzer().calculateFourierSpectrum(signal, fs)
};