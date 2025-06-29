// dataPreprocessor.js
/**
 * Comprehensive data preprocessing module for earthquake acceleration data
 * Handles data quality checks, outlier detection, missing value interpolation,
 * and data validation before storing in database
 */

class DataPreprocessor {
    constructor(options = {}) {
      this.config = {
        // Acceleration limits in cm/s² (gal)
        maxAcceleration: options.maxAcceleration || 3000, // ~3g
        minAcceleration: options.minAcceleration || -3000,
        
        // Outlier detection thresholds
        outlierThreshold: options.outlierThreshold || 3, // Standard deviations
        maxOutlierPercentage: options.maxOutlierPercentage || 0.05, // 5%
        
        // Missing data handling
        maxGapSize: options.maxGapSize || 10, // Maximum consecutive missing points to interpolate
        
        // Data quality thresholds
        minDataPoints: options.minDataPoints || 100,
        maxZeroPercentage: options.maxZeroPercentage || 0.3, // 30%
        
        // Baseline correction
        baselineWindow: options.baselineWindow || 100, // Points for baseline calculation
        
        // Sampling rate validation
        expectedSamplingRates: options.expectedSamplingRates || [0.005, 0.01, 0.02, 0.05], // Common rates
        
        logging: options.logging !== false
      };
    }
  
    /**
     * Main preprocessing pipeline
     */
    async preprocessEarthquakeData(rawData) {
      this.log('🔄 Starting data preprocessing pipeline...');
      
      const results = {
        originalData: rawData,
        processedData: null,
        qualityReport: {},
        preprocessing: {
          steps: [],
          warnings: [],
          errors: []
        }
      };
  
      try {
        // Step 1: Basic validation
        const validationResult = this.validateBasicData(rawData);
        results.preprocessing.steps.push('Basic validation');
        
        if (!validationResult.isValid) {
          results.preprocessing.errors.push(...validationResult.errors);
          return results;
        }
  
        // Step 2: Detect and handle missing values
        const missingDataResult = this.handleMissingData(rawData);
        results.preprocessing.steps.push('Missing data handling');
        results.preprocessing.warnings.push(...missingDataResult.warnings);
  
        // Step 3: Outlier detection and correction
        const outlierResult = this.detectAndCorrectOutliers(missingDataResult.data);
        results.preprocessing.steps.push('Outlier detection and correction');
        results.preprocessing.warnings.push(...outlierResult.warnings);
  
        // Step 4: Baseline correction
        const baselineResult = this.correctBaseline(outlierResult.data);
        results.preprocessing.steps.push('Baseline correction');
  
        // Step 5: Data quality assessment
        const qualityResult = this.assessDataQuality(baselineResult.data);
        results.qualityReport = qualityResult;
        results.preprocessing.steps.push('Quality assessment');
  
        // Step 6: Sampling rate validation
        const samplingResult = this.validateSamplingRate(rawData);
        results.preprocessing.steps.push('Sampling rate validation');
        results.preprocessing.warnings.push(...samplingResult.warnings);
  
        // Step 7: Final data validation
        const finalValidation = this.validateProcessedData(baselineResult.data);
        results.preprocessing.steps.push('Final validation');
  
        if (finalValidation.isValid) {
          results.processedData = baselineResult.data;
          this.log('✅ Preprocessing completed successfully');
        } else {
          results.preprocessing.errors.push(...finalValidation.errors);
          this.log('❌ Preprocessing failed final validation');
        }
  
      } catch (error) {
        results.preprocessing.errors.push(`Preprocessing pipeline error: ${error.message}`);
        this.log(`❌ Preprocessing error: ${error.message}`);
      }
  
      return results;
    }
  
    /**
     * Basic data validation
     */
    validateBasicData(data) {
      const errors = [];
      
      // Check if data exists and has required fields
      if (!data || !data.data) {
        errors.push('No data object provided');
        return { isValid: false, errors };
      }
  
      const { time, ns_acceleration, ew_acceleration, ud_acceleration } = data.data;
  
      // Check if arrays exist
      if (!Array.isArray(time)) errors.push('Time array missing or invalid');
      if (!Array.isArray(ns_acceleration)) errors.push('NS acceleration array missing or invalid');
      if (!Array.isArray(ew_acceleration)) errors.push('EW acceleration array missing or invalid');
      if (!Array.isArray(ud_acceleration)) errors.push('UD acceleration array missing or invalid');
  
      if (errors.length > 0) {
        return { isValid: false, errors };
      }
  
      // Check array lengths match
      const lengths = [time.length, ns_acceleration.length, ew_acceleration.length, ud_acceleration.length];
      const uniqueLengths = [...new Set(lengths)];
      
      if (uniqueLengths.length > 1) {
        errors.push(`Array length mismatch: ${lengths.join(', ')}`);
      }
  
      // Check minimum data points
      if (time.length < this.config.minDataPoints) {
        errors.push(`Insufficient data points: ${time.length} < ${this.config.minDataPoints}`);
      }
  
      return { isValid: errors.length === 0, errors };
    }
  
    /**
     * Handle missing data through interpolation
     */
    handleMissingData(data) {
      const warnings = [];
      const processedData = JSON.parse(JSON.stringify(data)); // Deep copy
  
      ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'].forEach(direction => {
        const arr = processedData.data[direction];
        let missingCount = 0;
        let interpolatedCount = 0;
  
        // Find missing values (null, undefined, NaN)
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] === null || arr[i] === undefined || isNaN(arr[i])) {
            missingCount++;
            
            // Try to interpolate if gap is small enough
            const interpolatedValue = this.interpolateValue(arr, i);
            if (interpolatedValue !== null) {
              arr[i] = interpolatedValue;
              interpolatedCount++;
            } else {
              // Use mean if interpolation fails
              arr[i] = this.calculateMean(arr.filter(v => v !== null && !isNaN(v)));
            }
          }
        }
  
        if (missingCount > 0) {
          warnings.push(`${direction}: ${missingCount} missing values found, ${interpolatedCount} interpolated`);
        }
      });
  
      return { data: processedData, warnings };
    }
  
    /**
     * Interpolate missing value based on surrounding points
     */
    interpolateValue(arr, index) {
      const maxGap = this.config.maxGapSize;
      
      // Find valid points before and after
      let beforeIndex = -1;
      let afterIndex = -1;
      
      // Look backward
      for (let i = index - 1; i >= Math.max(0, index - maxGap); i--) {
        if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) {
          beforeIndex = i;
          break;
        }
      }
      
      // Look forward
      for (let i = index + 1; i <= Math.min(arr.length - 1, index + maxGap); i++) {
        if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) {
          afterIndex = i;
          break;
        }
      }
      
      // Linear interpolation if both points found
      if (beforeIndex !== -1 && afterIndex !== -1) {
        const weight = (index - beforeIndex) / (afterIndex - beforeIndex);
        return arr[beforeIndex] + weight * (arr[afterIndex] - arr[beforeIndex]);
      }
      
      // Use nearest valid value if only one side available
      if (beforeIndex !== -1) return arr[beforeIndex];
      if (afterIndex !== -1) return arr[afterIndex];
      
      return null; // Could not interpolate
    }
  
    /**
     * Detect and correct outliers using statistical methods
     */
    detectAndCorrectOutliers(data) {
      const warnings = [];
      const processedData = JSON.parse(JSON.stringify(data));
  
      ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'].forEach(direction => {
        const arr = processedData.data[direction];
        const stats = this.calculateStatistics(arr);
        const threshold = this.config.outlierThreshold * stats.stdDev;
        
        let outlierCount = 0;
        const outlierIndices = [];
  
        // Detect outliers (values beyond threshold from mean)
        for (let i = 0; i < arr.length; i++) {
          if (Math.abs(arr[i] - stats.mean) > threshold || 
              arr[i] > this.config.maxAcceleration || 
              arr[i] < this.config.minAcceleration) {
            outlierIndices.push(i);
            outlierCount++;
          }
        }
  
        // Check if too many outliers
        const outlierPercentage = outlierCount / arr.length;
        if (outlierPercentage > this.config.maxOutlierPercentage) {
          warnings.push(`${direction}: High outlier percentage (${(outlierPercentage * 100).toFixed(2)}%)`);
        }
  
        // Correct outliers using median filtering
        outlierIndices.forEach(index => {
          const correctedValue = this.medianFilter(arr, index, 5);
          arr[index] = correctedValue;
        });
  
        if (outlierCount > 0) {
          warnings.push(`${direction}: ${outlierCount} outliers detected and corrected`);
        }
      });
  
      return { data: processedData, warnings };
    }
  
    /**
     * Apply median filter to correct outlier
     */
    medianFilter(arr, index, windowSize = 5) {
      const halfWindow = Math.floor(windowSize / 2);
      const start = Math.max(0, index - halfWindow);
      const end = Math.min(arr.length - 1, index + halfWindow);
      
      const window = [];
      for (let i = start; i <= end; i++) {
        if (i !== index) window.push(arr[i]);
      }
      
      window.sort((a, b) => a - b);
      return window[Math.floor(window.length / 2)];
    }
  
    /**
     * Baseline correction to remove DC offset
     */
    correctBaseline(data) {
      const processedData = JSON.parse(JSON.stringify(data));
  
      ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'].forEach(direction => {
        const arr = processedData.data[direction];
        
        // Calculate baseline from first portion of data (assumed to be pre-event)
        const baselinePoints = Math.min(this.config.baselineWindow, Math.floor(arr.length * 0.1));
        const baseline = this.calculateMean(arr.slice(0, baselinePoints));
        
        // Remove baseline from all data points
        for (let i = 0; i < arr.length; i++) {
          arr[i] -= baseline;
        }
      });
  
      return { data: processedData };
    }
  
    /**
     * Assess overall data quality
     */
    assessDataQuality(data) {
      const quality = {
        overall: 'good',
        scores: {},
        issues: []
      };
  
      ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'].forEach(direction => {
        const arr = data.data[direction];
        const stats = this.calculateStatistics(arr);
        
        // Calculate quality metrics
        const zeroPercentage = arr.filter(v => v === 0).length / arr.length;
        const dynamicRange = stats.max - stats.min;
        const snr = this.estimateSignalToNoiseRatio(arr);
        
        let score = 100;
        
        // Penalize high zero percentage
        if (zeroPercentage > this.config.maxZeroPercentage) {
          score -= (zeroPercentage - this.config.maxZeroPercentage) * 100;
          quality.issues.push(`${direction}: High zero percentage (${(zeroPercentage * 100).toFixed(1)}%)`);
        }
        
        // Penalize low dynamic range
        if (dynamicRange < 10) { // Less than 10 gal range
          score -= 20;
          quality.issues.push(`${direction}: Low dynamic range (${dynamicRange.toFixed(2)})`);
        }
        
        // Penalize low SNR
        if (snr < 3) {
          score -= 30;
          quality.issues.push(`${direction}: Low signal-to-noise ratio (${snr.toFixed(2)})`);
        }
        
        quality.scores[direction] = Math.max(0, Math.min(100, score));
      });
  
      // Overall quality assessment
      const avgScore = Object.values(quality.scores).reduce((a, b) => a + b, 0) / 3;
      
      if (avgScore >= 80) quality.overall = 'excellent';
      else if (avgScore >= 60) quality.overall = 'good';
      else if (avgScore >= 40) quality.overall = 'fair';
      else quality.overall = 'poor';
  
      quality.averageScore = avgScore;
  
      return quality;
    }
  
    /**
     * Validate sampling rate consistency
     */
    validateSamplingRate(data) {
      const warnings = [];
      const timeArray = data.data.time;
      
      if (timeArray.length < 2) {
        warnings.push('Insufficient time points to validate sampling rate');
        return { warnings };
      }
  
      // Calculate actual sampling intervals
      const intervals = [];
      for (let i = 1; i < Math.min(100, timeArray.length); i++) {
        intervals.push(timeArray[i] - timeArray[i-1]);
      }
  
      const avgInterval = this.calculateMean(intervals);
      const intervalStdDev = this.calculateStandardDeviation(intervals);
      
      // Check if sampling rate is consistent
      if (intervalStdDev > avgInterval * 0.01) { // More than 1% variation
        warnings.push(`Inconsistent sampling rate: avg=${avgInterval.toFixed(4)}s, stddev=${intervalStdDev.toFixed(6)}s`);
      }
  
      // Check if sampling rate is expected
      const isExpectedRate = this.config.expectedSamplingRates.some(rate => 
        Math.abs(rate - avgInterval) < rate * 0.05 // Within 5%
      );
  
      if (!isExpectedRate) {
        warnings.push(`Unusual sampling rate: ${avgInterval.toFixed(4)}s (${(1/avgInterval).toFixed(1)} Hz)`);
      }
  
      return { warnings, samplingInterval: avgInterval };
    }
  
    /**
     * Final validation of processed data
     */
    validateProcessedData(data) {
      const errors = [];
  
      ['ns_acceleration', 'ew_acceleration', 'ud_acceleration'].forEach(direction => {
        const arr = data.data[direction];
        
        // Check for remaining invalid values
        const invalidCount = arr.filter(v => v === null || v === undefined || isNaN(v)).length;
        if (invalidCount > 0) {
          errors.push(`${direction}: ${invalidCount} invalid values remain after preprocessing`);
        }
  
        // Check for extreme values
        const stats = this.calculateStatistics(arr);
        if (Math.abs(stats.max) > this.config.maxAcceleration * 1.5 || 
            Math.abs(stats.min) > this.config.maxAcceleration * 1.5) {
          errors.push(`${direction}: Extreme values detected (max: ${stats.max}, min: ${stats.min})`);
        }
      });
  
      return { isValid: errors.length === 0, errors };
    }
  
    // Utility functions
    calculateStatistics(arr) {
      const validValues = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
      const mean = this.calculateMean(validValues);
      const stdDev = this.calculateStandardDeviation(validValues);
      
      return {
        mean,
        stdDev,
        min: Math.min(...validValues),
        max: Math.max(...validValues),
        count: validValues.length
      };
    }
  
    calculateMean(arr) {
      return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }
  
    calculateStandardDeviation(arr) {
      const mean = this.calculateMean(arr);
      const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
      return Math.sqrt(this.calculateMean(squaredDiffs));
    }
  
    estimateSignalToNoiseRatio(arr) {
      // Simple SNR estimation using signal power vs noise power
      // This is a basic implementation - could be improved with frequency domain analysis
      const stats = this.calculateStatistics(arr);
      const signalPower = stats.stdDev * stats.stdDev;
      
      // Estimate noise from first 10% of data (assumed to be pre-event)
      const noiseWindow = arr.slice(0, Math.floor(arr.length * 0.1));
      const noiseStats = this.calculateStatistics(noiseWindow);
      const noisePower = noiseStats.stdDev * noiseStats.stdDev;
      
      return noisePower > 0 ? signalPower / noisePower : 100; // High SNR if no noise detected
    }
  
    log(message) {
      if (this.config.logging) {
        console.log(message);
      }
    }
  }
  
  module.exports = DataPreprocessor;