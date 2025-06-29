/**
 * array_utils.js - MATLAB-like Array Utilities for Earthquake Data Processing
 * 
 * This module provides MATLAB-compatible array manipulation functions
 * for signal processing operations in the earthquake data analysis pipeline.
 */

/**
 * Generate linearly spaced values (MATLAB linspace equivalent)
 * @param {number} start - Starting value
 * @param {number} stop - Ending value
 * @param {number} num - Number of points (default: 50)
 * @returns {Array<number>} Array of linearly spaced values
 */
function linspace(start, stop, num = 50) {
  if (num <= 0) return [];
  if (num === 1) return [start];
  
  const step = (stop - start) / (num - 1);
  return Array.from({ length: num }, (_, i) => start + i * step);
}

/**
 * Generate logarithmically spaced values (MATLAB logspace equivalent)
 * @param {number} start - Starting exponent (10^start)
 * @param {number} stop - Ending exponent (10^stop)
 * @param {number} num - Number of points (default: 50)
 * @returns {Array<number>} Array of logarithmically spaced values
 */
function logspace(start, stop, num = 50) {
  const linear = linspace(start, stop, num);
  return linear.map(x => Math.pow(10, x));
}

/**
 * Generate array of zeros (MATLAB zeros equivalent)
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns (optional, defaults to rows)
 * @returns {Array} Array of zeros
 */
function zeros(rows, cols = null) {
  if (cols === null) {
    return new Array(rows).fill(0);
  }
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/**
 * Generate array of ones (MATLAB ones equivalent)
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns (optional, defaults to rows)
 * @returns {Array} Array of ones
 */
function ones(rows, cols = null) {
  if (cols === null) {
    return new Array(rows).fill(1);
  }
  return Array.from({ length: rows }, () => new Array(cols).fill(1));
}

/**
 * Find indices of non-zero elements (MATLAB find equivalent)
 * @param {Array<number>} arr - Input array
 * @param {Function} condition - Optional condition function
 * @returns {Array<number>} Array of indices
 */
function find(arr, condition = null) {
  const indices = [];
  for (let i = 0; i < arr.length; i++) {
    if (condition ? condition(arr[i], i) : arr[i] !== 0) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Find maximum value and its index (MATLAB max equivalent)
 * @param {Array<number>} arr - Input array
 * @returns {Object} {value: number, index: number}
 */
function max(arr) {
  if (arr.length === 0) return { value: NaN, index: -1 };
  
  let maxVal = arr[0];
  let maxIdx = 0;
  
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) {
      maxVal = arr[i];
      maxIdx = i;
    }
  }
  
  return { value: maxVal, index: maxIdx };
}

/**
 * Find minimum value and its index (MATLAB min equivalent)
 * @param {Array<number>} arr - Input array
 * @returns {Object} {value: number, index: number}
 */
function min(arr) {
  if (arr.length === 0) return { value: NaN, index: -1 };
  
  let minVal = arr[0];
  let minIdx = 0;
  
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minVal) {
      minVal = arr[i];
      minIdx = i;
    }
  }
  
  return { value: minVal, index: minIdx };
}

/**
 * Calculate mean of array (MATLAB mean equivalent)
 * @param {Array<number>} arr - Input array
 * @returns {number} Mean value
 */
function mean(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation (MATLAB std equivalent)
 * @param {Array<number>} arr - Input array
 * @param {boolean} sample - Use sample standard deviation (default: true)
 * @returns {number} Standard deviation
 */
function std(arr, sample = true) {
  if (arr.length === 0) return NaN;
  if (arr.length === 1) return sample ? NaN : 0;
  
  const avg = mean(arr);
  const sumSquares = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0);
  const divisor = sample ? arr.length - 1 : arr.length;
  
  return Math.sqrt(sumSquares / divisor);
}

/**
 * Remove linear trend from data (MATLAB detrend equivalent)
 * @param {Array<number>} data - Input data
 * @param {string} type - 'linear' or 'constant' (default: 'linear')
 * @returns {Array<number>} Detrended data
 */
function detrend(data, type = 'linear') {
  if (data.length === 0) return [];
  
  const n = data.length;
  const result = [...data];
  
  if (type === 'constant') {
    // Remove mean
    const avg = mean(data);
    return result.map(val => val - avg);
  }
  
  if (type === 'linear') {
    // Remove linear trend using least squares
    const x = Array.from({ length: n }, (_, i) => i);
    const xMean = mean(x);
    const yMean = mean(data);
    
    // Calculate slope
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (data[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    
    // Remove linear trend
    return result.map((val, i) => val - (slope * i + intercept));
  }
  
  return result;
}

/**
 * Trapezoidal numerical integration (MATLAB trapz equivalent)
 * @param {Array<number>} x - X values (time)
 * @param {Array<number>} y - Y values (data)
 * @returns {number} Integrated value
 */
function trapz(x, y) {
  if (x.length !== y.length || x.length < 2) {
    throw new Error('trapz: x and y must have same length and at least 2 points');
  }
  
  let integral = 0;
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i-1];
    const avgY = (y[i] + y[i-1]) / 2;
    integral += dx * avgY;
  }
  
  return integral;
}

/**
 * Cumulative trapezoidal integration (MATLAB cumtrapz equivalent)
 * @param {Array<number>} x - X values (time)
 * @param {Array<number>} y - Y values (data)
 * @returns {Array<number>} Cumulative integral array
 */
function cumtrapz(x, y) {
  if (x.length !== y.length || x.length < 2) {
    throw new Error('cumtrapz: x and y must have same length and at least 2 points');
  }
  
  const result = [0]; // Start with zero
  
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i-1];
    const avgY = (y[i] + y[i-1]) / 2;
    result.push(result[i-1] + dx * avgY);
  }
  
  return result;
}

/**
 * Absolute value of array elements (MATLAB abs equivalent)
 * @param {Array<number>} arr - Input array
 * @returns {Array<number>} Array of absolute values
 */
function abs(arr) {
  return arr.map(val => Math.abs(val));
}

/**
 * Element-wise array operations
 */
const elementwise = {
  /**
   * Element-wise addition
   * @param {Array<number>} a - First array
   * @param {Array<number>} b - Second array or scalar
   * @returns {Array<number>} Result array
   */
  add: (a, b) => {
    if (typeof b === 'number') {
      return a.map(val => val + b);
    }
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length for element-wise operations');
    }
    return a.map((val, i) => val + b[i]);
  },

  /**
   * Element-wise subtraction
   * @param {Array<number>} a - First array
   * @param {Array<number>} b - Second array or scalar
   * @returns {Array<number>} Result array
   */
  subtract: (a, b) => {
    if (typeof b === 'number') {
      return a.map(val => val - b);
    }
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length for element-wise operations');
    }
    return a.map((val, i) => val - b[i]);
  },

  /**
   * Element-wise multiplication
   * @param {Array<number>} a - First array
   * @param {Array<number>} b - Second array or scalar
   * @returns {Array<number>} Result array
   */
  multiply: (a, b) => {
    if (typeof b === 'number') {
      return a.map(val => val * b);
    }
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length for element-wise operations');
    }
    return a.map((val, i) => val * b[i]);
  },

  /**
   * Element-wise division
   * @param {Array<number>} a - First array
   * @param {Array<number>} b - Second array or scalar
   * @returns {Array<number>} Result array
   */
  divide: (a, b) => {
    if (typeof b === 'number') {
      return a.map(val => val / b);
    }
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length for element-wise operations');
    }
    return a.map((val, i) => val / b[i]);
  },

  /**
   * Element-wise power
   * @param {Array<number>} a - Base array
   * @param {number|Array<number>} b - Exponent (scalar or array)
   * @returns {Array<number>} Result array
   */
  power: (a, b) => {
    if (typeof b === 'number') {
      return a.map(val => Math.pow(val, b));
    }
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length for element-wise operations');
    }
    return a.map((val, i) => Math.pow(val, b[i]));
  }
};

/**
 * Reshape array (MATLAB reshape equivalent)
 * @param {Array} arr - Input array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @returns {Array<Array>} Reshaped 2D array
 */
function reshape(arr, rows, cols) {
  if (arr.length !== rows * cols) {
    throw new Error(`Cannot reshape array of length ${arr.length} to ${rows}x${cols}`);
  }
  
  const result = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push(arr[i * cols + j]);
    }
    result.push(row);
  }
  
  return result;
}

/**
 * Flatten 2D array to 1D (opposite of reshape)
 * @param {Array<Array>} arr - Input 2D array
 * @returns {Array} Flattened 1D array
 */
function flatten(arr) {
  return arr.reduce((flat, row) => flat.concat(row), []);
}

/**
 * Transpose matrix (MATLAB transpose equivalent)
 * @param {Array<Array>} matrix - Input matrix
 * @returns {Array<Array>} Transposed matrix
 */
function transpose(matrix) {
  if (matrix.length === 0) return [];
  
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = [];
  
  for (let j = 0; j < cols; j++) {
    const row = [];
    for (let i = 0; i < rows; i++) {
      row.push(matrix[i][j]);
    }
    result.push(row);
  }
  
  return result;
}

/**
 * Flip array left to right (MATLAB fliplr equivalent)
 * @param {Array} arr - Input array
 * @returns {Array} Flipped array
 */
function fliplr(arr) {
  return [...arr].reverse();
}

/**
 * Check if array is empty (MATLAB isempty equivalent)
 * @param {Array} arr - Input array
 * @returns {boolean} True if empty
 */
function isempty(arr) {
  return arr.length === 0;
}

/**
 * Check if value is NaN (MATLAB isnan equivalent)
 * @param {number|Array<number>} val - Input value or array
 * @returns {boolean|Array<boolean>} True if NaN
 */
function isnan(val) {
  if (Array.isArray(val)) {
    return val.map(v => Number.isNaN(v));
  }
  return Number.isNaN(val);
}

/**
 * Check if value is infinite (MATLAB isinf equivalent)
 * @param {number|Array<number>} val - Input value or array
 * @returns {boolean|Array<boolean>} True if infinite
 */
function isinf(val) {
  if (Array.isArray(val)) {
    return val.map(v => !Number.isFinite(v) && !Number.isNaN(v));
  }
  return !Number.isFinite(val) && !Number.isNaN(val);
}

/**
 * Length of array (MATLAB length equivalent)
 * @param {Array} arr - Input array
 * @returns {number} Length of array
 */
function length(arr) {
  return arr.length;
}

/**
 * Size of array (MATLAB size equivalent)
 * @param {Array} arr - Input array
 * @returns {Array<number>} Dimensions of array
 */
function size(arr) {
  if (!Array.isArray(arr)) return [1, 1];
  if (arr.length === 0) return [0, 0];
  
  // Check if 2D array
  if (Array.isArray(arr[0])) {
    return [arr.length, arr[0].length];
  }
  
  return [arr.length, 1];
}

/**
 * Array indexing utilities for MATLAB-like behavior
 */
const indexing = {
  /**
   * Get elements at specified indices
   * @param {Array} arr - Input array
   * @param {Array<number>} indices - Indices to extract
   * @returns {Array} Selected elements
   */
  get: (arr, indices) => {
    return indices.map(idx => arr[idx]);
  },

  /**
   * Set elements at specified indices
   * @param {Array} arr - Input array
   * @param {Array<number>} indices - Indices to set
   * @param {number|Array<number>} values - Values to set
   * @returns {Array} Modified array
   */
  set: (arr, indices, values) => {
    const result = [...arr];
    if (typeof values === 'number') {
      indices.forEach(idx => {
        if (idx >= 0 && idx < result.length) {
          result[idx] = values;
        }
      });
    } else {
      indices.forEach((idx, i) => {
        if (idx >= 0 && idx < result.length && i < values.length) {
          result[idx] = values[i];
        }
      });
    }
    return result;
  },

  /**
   * MATLAB-style colon operator equivalent
   * @param {number} start - Start index
   * @param {number} step - Step size (default: 1)
   * @param {number} end - End index
   * @returns {Array<number>} Array of indices
   */
  colon: (start, step = 1, end = null) => {
    if (end === null) {
      end = step;
      step = 1;
    }
    
    const result = [];
    if (step > 0) {
      for (let i = start; i <= end; i += step) {
        result.push(i);
      }
    } else {
      for (let i = start; i >= end; i += step) {
        result.push(i);
      }
    }
    return result;
  }
};

/**
 * Statistical functions for arrays
 */
const stats = {
  /**
   * Calculate variance
   * @param {Array<number>} arr - Input array
   * @param {boolean} sample - Use sample variance (default: true)
   * @returns {number} Variance
   */
  var: (arr, sample = true) => {
    const stdVal = std(arr, sample);
    return stdVal * stdVal;
  },

  /**
   * Calculate median
   * @param {Array<number>} arr - Input array
   * @returns {number} Median value
   */
  median: (arr) => {
    if (arr.length === 0) return NaN;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  },

  /**
   * Calculate mode (most frequent value)
   * @param {Array<number>} arr - Input array
   * @returns {number} Mode value
   */
  mode: (arr) => {
    if (arr.length === 0) return NaN;
    
    const freq = {};
    let maxFreq = 0;
    let mode = arr[0];
    
    arr.forEach(val => {
      freq[val] = (freq[val] || 0) + 1;
      if (freq[val] > maxFreq) {
        maxFreq = freq[val];
        mode = val;
      }
    });
    
    return mode;
  },

  /**
   * Calculate range (max - min)
   * @param {Array<number>} arr - Input array
   * @returns {number} Range value
   */
  range: (arr) => {
    if (arr.length === 0) return NaN;
    const minVal = min(arr).value;
    const maxVal = max(arr).value;
    return maxVal - minVal;
  }
};

// Export all functions
module.exports = {
  // Basic array generation
  linspace,
  logspace,
  zeros,
  ones,
  
  // Array searching and analysis
  find,
  max,
  min,
  mean,
  std,
  
  // Signal processing utilities
  detrend,
  trapz,
  cumtrapz,
  abs,
  
  // Element-wise operations
  elementwise,
  
  // Array manipulation
  reshape,
  flatten,
  transpose,
  fliplr,
  
  // Array properties
  isempty,
  isnan,
  isinf,
  length,
  size,
  
  // Indexing utilities
  indexing,
  
  // Statistical functions
  stats
};