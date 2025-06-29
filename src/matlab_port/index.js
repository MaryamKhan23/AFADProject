/**
 * MATLAB Port - Main Entry Point
 * Provides MATLAB-like functionality for JavaScript/Node.js
 * 
 * Usage:
 *   const matlab = require('./src/matlab_port');
 *   const result = matlab.fft([1, 2, 3, 4]);
 */

const { Matrix } = require('ml-matrix');
const math = require('mathjs');
const FFT = require('fft-js');
const _ = require('lodash');

// Import sub-modules
const SignalProcessing = require('./signal_processing');
const DataStructures = require('./data_structures');
const Statistics = require('./statistics');
const Filters = require('./filters');

class MatlabPort {
    constructor() {
        this.version = '1.0.0';
        this.precision = 1e-10; // Default numerical precision
    }

    // ====================================================================
    // CORE MATHEMATICAL OPERATIONS
    // ====================================================================

    /**
     * Create a matrix from 2D array (similar to MATLAB matrix creation)
     * @param {Array|Array[]} data - Input data
     * @returns {Matrix} Matrix object
     */
    matrix(data) {
        if (Array.isArray(data) && Array.isArray(data[0])) {
            return new Matrix(data);
        } else if (Array.isArray(data)) {
            return new Matrix([data]); // Row vector
        }
        throw new Error('Invalid input for matrix creation');
    }

    /**
     * Create zeros matrix (equivalent to MATLAB zeros())
     * @param {number} rows - Number of rows
     * @param {number} cols - Number of columns (optional, defaults to rows)
     * @returns {Matrix} Matrix of zeros
     */
    zeros(rows, cols = rows) {
        return Matrix.zeros(rows, cols);
    }

    /**
     * Create ones matrix (equivalent to MATLAB ones())
     * @param {number} rows - Number of rows
     * @param {number} cols - Number of columns (optional, defaults to rows)
     * @returns {Matrix} Matrix of ones
     */
    ones(rows, cols = rows) {
        return Matrix.ones(rows, cols);
    }

    /**
     * Create identity matrix (equivalent to MATLAB eye())
     * @param {number} size - Size of identity matrix
     * @returns {Matrix} Identity matrix
     */
    eye(size) {
        return Matrix.eye(size);
    }

    /**
     * Linear space generation (equivalent to MATLAB linspace())
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} num - Number of points (default: 100)
     * @returns {Array} Array of linearly spaced values
     */
    linspace(start, end, num = 100) {
        const step = (end - start) / (num - 1);
        return Array.from({ length: num }, (_, i) => start + i * step);
    }

    /**
     * Logarithmic space generation (equivalent to MATLAB logspace())
     * @param {number} start - Start exponent (10^start)
     * @param {number} end - End exponent (10^end)
     * @param {number} num - Number of points (default: 50)
     * @returns {Array} Array of logarithmically spaced values
     */
    logspace(start, end, num = 50) {
        const logStart = Math.log10(start);
        const logEnd = Math.log10(end);
        const logStep = (logEnd - logStart) / (num - 1);
        return Array.from({ length: num }, (_, i) => Math.pow(10, logStart + i * logStep));
    }

    // ====================================================================
    // SIGNAL PROCESSING FUNCTIONS
    // ====================================================================

    /**
     * Fast Fourier Transform (equivalent to MATLAB fft())
     * @param {Array} signal - Input signal
     * @returns {Array} FFT result as complex numbers
     */
    fft(signal) {
        try {
            const fftResult = FFT.fft(signal);
            return fftResult.map(complex => ({
                real: complex[0],
                imag: complex[1],
                magnitude: Math.sqrt(complex[0] * complex[0] + complex[1] * complex[1]),
                phase: Math.atan2(complex[1], complex[0])
            }));
        } catch (error) {
            throw new Error(`FFT calculation failed: ${error.message}`);
        }
    }

    /**
     * Inverse Fast Fourier Transform (equivalent to MATLAB ifft())
     * @param {Array} fftData - FFT data (complex numbers)
     * @returns {Array} Time domain signal
     */
    ifft(fftData) {
        try {
            // Convert back to FFT-js format
            const complexArray = fftData.map(c => [c.real || c[0], c.imag || c[1]]);
            const ifftResult = FFT.ifft(complexArray);
            return ifftResult.map(complex => complex[0]); // Return real part
        } catch (error) {
            throw new Error(`IFFT calculation failed: ${error.message}`);
        }
    }

    /**
     * Power Spectral Density estimation
     * @param {Array} signal - Input signal
     * @param {number} fs - Sampling frequency
     * @returns {Object} PSD data with frequencies and power values
     */
    psd(signal, fs = 1) {
        const fftResult = this.fft(signal);
        const N = signal.length;
        const frequencies = Array.from({ length: Math.floor(N/2) }, (_, i) => i * fs / N);
        const power = fftResult.slice(0, Math.floor(N/2)).map(c => c.magnitude * c.magnitude / N);
        
        return {
            frequencies: frequencies,
            power: power,
            totalPower: power.reduce((sum, p) => sum + p, 0)
        };
    }

    // ====================================================================
    // FILTERING FUNCTIONS
    // ====================================================================

    /**
     * Simple moving average filter
     * @param {Array} signal - Input signal
     * @param {number} windowSize - Size of moving average window
     * @returns {Array} Filtered signal
     */
    movingAverage(signal, windowSize) {
        const result = [];
        for (let i = 0; i < signal.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(signal.length, i + Math.floor(windowSize / 2) + 1);
            const sum = signal.slice(start, end).reduce((a, b) => a + b, 0);
            result.push(sum / (end - start));
        }
        return result;
    }

    /**
     * Low-pass Butterworth filter (simplified implementation)
     * @param {Array} signal - Input signal
     * @param {number} cutoff - Cutoff frequency (normalized 0-1)
     * @param {number} order - Filter order (default: 2)
     * @returns {Array} Filtered signal
     */
    lowpass(signal, cutoff, order = 2) {
        // Simplified IIR filter implementation
        const alpha = cutoff;
        let y = signal[0];
        const result = [y];
        
        for (let i = 1; i < signal.length; i++) {
            y = alpha * signal[i] + (1 - alpha) * y;
            result.push(y);
        }
        
        return result;
    }

    // ====================================================================
    // STATISTICAL FUNCTIONS
    // ====================================================================

    /**
     * Calculate mean (equivalent to MATLAB mean())
     * @param {Array} data - Input data
     * @returns {number} Mean value
     */
    mean(data) {
        return data.reduce((sum, val) => sum + val, 0) / data.length;
    }

    /**
     * Calculate standard deviation (equivalent to MATLAB std())
     * @param {Array} data - Input data
     * @param {number} ddof - Delta degrees of freedom (0 for population, 1 for sample)
     * @returns {number} Standard deviation
     */
    std(data, ddof = 0) {
        const mean = this.mean(data);
        const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - ddof);
        return Math.sqrt(variance);
    }

    /**
     * Find maximum value and index (equivalent to MATLAB max())
     * @param {Array} data - Input data
     * @returns {Object} {value, index}
     */
    max(data) {
        let maxVal = -Infinity;
        let maxIndex = -1;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] > maxVal) {
                maxVal = data[i];
                maxIndex = i;
            }
        }
        
        return { value: maxVal, index: maxIndex };
    }

    /**
     * Find minimum value and index (equivalent to MATLAB min())
     * @param {Array} data - Input data
     * @returns {Object} {value, index}
     */
    min(data) {
        let minVal = Infinity;
        let minIndex = -1;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] < minVal) {
                minVal = data[i];
                minIndex = i;
            }
        }
        
        return { value: minVal, index: minIndex };
    }

    // ====================================================================
    // UTILITY FUNCTIONS
    // ====================================================================

    /**
     * Reshape array into matrix form (equivalent to MATLAB reshape())
     * @param {Array} data - Input data
     * @param {number} rows - Number of rows
     * @param {number} cols - Number of columns
     * @returns {Array[]} Reshaped 2D array
     */
    reshape(data, rows, cols) {
        if (data.length !== rows * cols) {
            throw new Error('Data length must equal rows * cols');
        }
        
        const result = [];
        for (let i = 0; i < rows; i++) {
            result.push(data.slice(i * cols, (i + 1) * cols));
        }
        return result;
    }

    /**
     * Element-wise multiplication (equivalent to MATLAB .*)
     * @param {Array} a - First array
     * @param {Array} b - Second array
     * @returns {Array} Element-wise product
     */
    multiply(a, b) {
        if (a.length !== b.length) {
            throw new Error('Arrays must have same length');
        }
        return a.map((val, i) => val * b[i]);
    }

    /**
     * Element-wise division (equivalent to MATLAB ./)
     * @param {Array} a - Numerator array
     * @param {Array} b - Denominator array
     * @returns {Array} Element-wise quotient
     */
    divide(a, b) {
        if (a.length !== b.length) {
            throw new Error('Arrays must have same length');
        }
        return a.map((val, i) => val / b[i]);
    }

    /**
     * Concatenate arrays (equivalent to MATLAB [a b])
     * @param {Array} arrays - Arrays to concatenate
     * @returns {Array} Concatenated array
     */
    concat(...arrays) {
        return [].concat(...arrays);
    }

    // ====================================================================
    // DATA CONVERSION UTILITIES
    // ====================================================================

    /**
     * Convert MongoDB data to MATLAB-compatible format
     * @param {Object} mongoData - Data from MongoDB
     * @returns {Object} Processed data ready for MATLAB algorithms
     */
    fromMongoDB(mongoData) {
        const processed = {
            timestamp: new Date(mongoData.timestamp),
            data: [],
            metadata: mongoData.metadata || {}
        };

        // Handle different data formats
        if (Array.isArray(mongoData.values)) {
            processed.data = mongoData.values.map(Number);
        } else if (mongoData.channels) {
            processed.data = Object.values(mongoData.channels).map(channel => 
                Array.isArray(channel) ? channel.map(Number) : [Number(channel)]
            );
        }

        return processed;
    }

    /**
     * Convert processed results back to MongoDB format
     * @param {Object} results - Processing results
     * @param {Object} originalData - Original data for reference
     * @returns {Object} Data formatted for MongoDB storage
     */
    toMongoDB(results, originalData = {}) {
        return {
            originalId: originalData._id,
            timestamp: new Date(),
            processedData: results,
            algorithm: 'matlab_port',
            version: this.version,
            processingTime: results.processingTime || null
        };
    }

    // ====================================================================
    // BATCH PROCESSING
    // ====================================================================

    /**
     * Process multiple signals in batch
     * @param {Array} signals - Array of signals to process
     * @param {Function} processor - Processing function
     * @param {Object} options - Processing options
     * @returns {Array} Array of processed results
     */
    batchProcess(signals, processor, options = {}) {
        const results = [];
        const startTime = Date.now();

        for (let i = 0; i < signals.length; i++) {
            try {
                const result = processor(signals[i], options);
                results.push({
                    index: i,
                    success: true,
                    data: result,
                    processingTime: Date.now() - startTime
                });
            } catch (error) {
                results.push({
                    index: i,
                    success: false,
                    error: error.message,
                    processingTime: Date.now() - startTime
                });
            }

            // Progress callback
            if (options.onProgress && typeof options.onProgress === 'function') {
                options.onProgress((i + 1) / signals.length * 100);
            }
        }

        return results;
    }
}

// Create singleton instance
const matlabPort = new MatlabPort();

// Export both the class and instance
module.exports = matlabPort;
module.exports.MatlabPort = MatlabPort;

// Export sub-modules for direct access
module.exports.SignalProcessing = SignalProcessing;
module.exports.DataStructures = DataStructures;
module.exports.Statistics = Statistics;
module.exports.Filters = Filters;