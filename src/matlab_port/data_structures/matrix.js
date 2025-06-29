/**
 * matrix.js - MATLAB-like Matrix Operations for Earthquake Data Processing
 * 
 * This module provides MATLAB-equivalent matrix operations for JavaScript,
 * specifically designed for seismic signal processing and analysis.
 * 
 * Features:
 * - Matrix creation and manipulation
 * - Linear algebra operations
 * - Statistical functions
 * - Signal processing utilities
 * - MATLAB-compatible function naming
 */

class Matrix {
  /**
   * Create a new Matrix
   * @param {Array|number} data - 2D array or number of rows
   * @param {number} cols - number of columns (if data is number)
   * @param {*} fillValue - value to fill matrix with
   */
  constructor(data, cols = null, fillValue = 0) {
    if (typeof data === 'number') {
      // Create matrix with dimensions
      this.rows = data;
      this.cols = cols || data;
      this.data = Array(this.rows).fill().map(() => Array(this.cols).fill(fillValue));
    } else if (Array.isArray(data)) {
      if (Array.isArray(data[0])) {
        // 2D array
        this.data = data.map(row => [...row]);
        this.rows = data.length;
        this.cols = data[0].length;
      } else {
        // 1D array - convert to column vector
        this.data = data.map(val => [val]);
        this.rows = data.length;
        this.cols = 1;
      }
    } else {
      throw new Error('Invalid matrix data');
    }
  }

  /**
   * Get matrix element
   * @param {number} row - row index (0-based)
   * @param {number} col - column index (0-based)
   */
  get(row, col = 0) {
    if (row >= this.rows || col >= this.cols || row < 0 || col < 0) {
      throw new Error(`Index out of bounds: (${row}, ${col})`);
    }
    return this.data[row][col];
  }

  /**
   * Set matrix element
   * @param {number} row - row index
   * @param {number} col - column index
   * @param {number} value - value to set
   */
  set(row, col, value) {
    if (arguments.length === 2) {
      // Single argument case - treat as column vector
      value = col;
      col = 0;
    }
    if (row >= this.rows || col >= this.cols || row < 0 || col < 0) {
      throw new Error(`Index out of bounds: (${row}, ${col})`);
    }
    this.data[row][col] = value;
  }

  /**
   * Get matrix size
   * @returns {Array} [rows, cols]
   */
  size() {
    return [this.rows, this.cols];
  }

  /**
   * Get matrix length (total elements)
   * @returns {number}
   */
  length() {
    return this.rows * this.cols;
  }

  /**
   * Convert to 1D array (column-major order like MATLAB)
   * @returns {Array}
   */
  toArray() {
    const result = [];
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        result.push(this.data[row][col]);
      }
    }
    return result;
  }

  /**
   * Convert to 1D array (row-major order)
   * @returns {Array}
   */
  toRowArray() {
    return this.data.flat();
  }

  /**
   * Matrix transpose (equivalent to MATLAB ')
   * @returns {Matrix}
   */
  transpose() {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[j][i] = this.data[i][j];
      }
    }
    return result;
  }

  /**
   * Matrix addition
   * @param {Matrix|number} other
   * @returns {Matrix}
   */
  add(other) {
    if (typeof other === 'number') {
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j] + other;
        }
      }
      return result;
    } else if (other instanceof Matrix) {
      if (this.rows !== other.rows || this.cols !== other.cols) {
        throw new Error('Matrix dimensions must match for addition');
      }
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j] + other.data[i][j];
        }
      }
      return result;
    }
    throw new Error('Invalid operand for addition');
  }

  /**
   * Matrix subtraction
   * @param {Matrix|number} other
   * @returns {Matrix}
   */
  subtract(other) {
    if (typeof other === 'number') {
      return this.add(-other);
    } else if (other instanceof Matrix) {
      return this.add(other.multiply(-1));
    }
    throw new Error('Invalid operand for subtraction');
  }

  /**
   * Element-wise multiplication (equivalent to MATLAB .*)
   * @param {Matrix|number} other
   * @returns {Matrix}
   */
  multiply(other) {
    if (typeof other === 'number') {
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j] * other;
        }
      }
      return result;
    } else if (other instanceof Matrix) {
      if (this.rows !== other.rows || this.cols !== other.cols) {
        throw new Error('Matrix dimensions must match for element-wise multiplication');
      }
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j] * other.data[i][j];
        }
      }
      return result;
    }
    throw new Error('Invalid operand for multiplication');
  }

  /**
   * Matrix multiplication (equivalent to MATLAB *)
   * @param {Matrix} other
   * @returns {Matrix}
   */
  matmul(other) {
    if (!(other instanceof Matrix)) {
      throw new Error('Matrix multiplication requires Matrix operand');
    }
    if (this.cols !== other.rows) {
      throw new Error(`Matrix dimensions incompatible: ${this.rows}x${this.cols} * ${other.rows}x${other.cols}`);
    }
    
    const result = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }

  /**
   * Element-wise division
   * @param {Matrix|number} other
   * @returns {Matrix}
   */
  divide(other) {
    if (typeof other === 'number') {
      return this.multiply(1 / other);
    } else if (other instanceof Matrix) {
      if (this.rows !== other.rows || this.cols !== other.cols) {
        throw new Error('Matrix dimensions must match for element-wise division');
      }
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j] / other.data[i][j];
        }
      }
      return result;
    }
    throw new Error('Invalid operand for division');
  }

  /**
   * Element-wise power (equivalent to MATLAB .^)
   * @param {number} power
   * @returns {Matrix}
   */
  power(power) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = Math.pow(this.data[i][j], power);
      }
    }
    return result;
  }

  /**
   * Apply function to each element
   * @param {Function} func
   * @returns {Matrix}
   */
  apply(func) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = func(this.data[i][j]);
      }
    }
    return result;
  }

  /**
   * Sum of all elements or along dimension
   * @param {number} dim - 0 for column sum, 1 for row sum, undefined for all
   * @returns {Matrix|number}
   */
  sum(dim) {
    if (dim === undefined) {
      // Sum all elements
      let total = 0;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          total += this.data[i][j];
        }
      }
      return total;
    } else if (dim === 0) {
      // Sum along columns (result is row vector)
      const result = new Matrix(1, this.cols);
      for (let j = 0; j < this.cols; j++) {
        let sum = 0;
        for (let i = 0; i < this.rows; i++) {
          sum += this.data[i][j];
        }
        result.data[0][j] = sum;
      }
      return result;
    } else if (dim === 1) {
      // Sum along rows (result is column vector)
      const result = new Matrix(this.rows, 1);
      for (let i = 0; i < this.rows; i++) {
        let sum = 0;
        for (let j = 0; j < this.cols; j++) {
          sum += this.data[i][j];
        }
        result.data[i][0] = sum;
      }
      return result;
    }
    throw new Error('Invalid dimension for sum');
  }

  /**
   * Maximum value and/or index
   * @param {number} dim - dimension along which to find max
   * @returns {number|Matrix|Object}
   */
  max(dim) {
    if (dim === undefined) {
      // Global maximum
      let max = -Infinity;
      let maxRow = 0, maxCol = 0;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (this.data[i][j] > max) {
            max = this.data[i][j];
            maxRow = i;
            maxCol = j;
          }
        }
      }
      return { value: max, row: maxRow, col: maxCol };
    } else if (dim === 0) {
      // Max along columns
      const result = new Matrix(1, this.cols);
      for (let j = 0; j < this.cols; j++) {
        let max = -Infinity;
        for (let i = 0; i < this.rows; i++) {
          if (this.data[i][j] > max) {
            max = this.data[i][j];
          }
        }
        result.data[0][j] = max;
      }
      return result;
    } else if (dim === 1) {
      // Max along rows
      const result = new Matrix(this.rows, 1);
      for (let i = 0; i < this.rows; i++) {
        let max = -Infinity;
        for (let j = 0; j < this.cols; j++) {
          if (this.data[i][j] > max) {
            max = this.data[i][j];
          }
        }
        result.data[i][0] = max;
      }
      return result;
    }
    throw new Error('Invalid dimension for max');
  }

  /**
   * Minimum value and/or index
   * @param {number} dim - dimension along which to find min
   * @returns {number|Matrix|Object}
   */
  min(dim) {
    if (dim === undefined) {
      // Global minimum
      let min = Infinity;
      let minRow = 0, minCol = 0;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (this.data[i][j] < min) {
            min = this.data[i][j];
            minRow = i;
            minCol = j;
          }
        }
      }
      return { value: min, row: minRow, col: minCol };
    }
    // Similar implementation as max() but for minimum
    // ... (implementation similar to max but with < comparison)
  }

  /**
   * Mean along dimension
   * @param {number} dim - 0 for column mean, 1 for row mean, undefined for all
   * @returns {Matrix|number}
   */
  mean(dim) {
    if (dim === undefined) {
      return this.sum() / this.length();
    } else if (dim === 0) {
      return this.sum(0).divide(this.rows);
    } else if (dim === 1) {
      return this.sum(1).divide(this.cols);
    }
    throw new Error('Invalid dimension for mean');
  }

  /**
   * Standard deviation
   * @param {number} dim - dimension
   * @returns {Matrix|number}
   */
  std(dim) {
    if (dim === undefined) {
      const meanVal = this.mean();
      let sumSquares = 0;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          sumSquares += Math.pow(this.data[i][j] - meanVal, 2);
        }
      }
      return Math.sqrt(sumSquares / (this.length() - 1));
    }
    // Implementation for dimensional std...
  }

  /**
   * Absolute value of each element
   * @returns {Matrix}
   */
  abs() {
    return this.apply(Math.abs);
  }

  /**
   * Square root of each element
   * @returns {Matrix}
   */
  sqrt() {
    return this.apply(Math.sqrt);
  }

  /**
   * Extract submatrix
   * @param {Array} rowRange - [start, end] or array of indices
   * @param {Array} colRange - [start, end] or array of indices
   * @returns {Matrix}
   */
  submatrix(rowRange, colRange = [0, this.cols - 1]) {
    let rowIndices, colIndices;
    
    if (Array.isArray(rowRange) && rowRange.length === 2 && typeof rowRange[0] === 'number') {
      // Range format [start, end]
      rowIndices = Array.from({ length: rowRange[1] - rowRange[0] + 1 }, (_, i) => i + rowRange[0]);
    } else {
      // Array of indices
      rowIndices = rowRange;
    }
    
    if (Array.isArray(colRange) && colRange.length === 2 && typeof colRange[0] === 'number') {
      colIndices = Array.from({ length: colRange[1] - colRange[0] + 1 }, (_, i) => i + colRange[0]);
    } else {
      colIndices = colRange;
    }

    const result = new Matrix(rowIndices.length, colIndices.length);
    for (let i = 0; i < rowIndices.length; i++) {
      for (let j = 0; j < colIndices.length; j++) {
        result.data[i][j] = this.data[rowIndices[i]][colIndices[j]];
      }
    }
    return result;
  }

  /**
   * Concatenate matrices
   * @param {Matrix} other
   * @param {number} dim - 0 for vertical, 1 for horizontal
   * @returns {Matrix}
   */
  concat(other, dim = 0) {
    if (!(other instanceof Matrix)) {
      throw new Error('Can only concatenate with another Matrix');
    }

    if (dim === 0) {
      // Vertical concatenation
      if (this.cols !== other.cols) {
        throw new Error('Matrices must have same number of columns for vertical concatenation');
      }
      const result = new Matrix(this.rows + other.rows, this.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j];
        }
      }
      for (let i = 0; i < other.rows; i++) {
        for (let j = 0; j < other.cols; j++) {
          result.data[this.rows + i][j] = other.data[i][j];
        }
      }
      return result;
    } else if (dim === 1) {
      // Horizontal concatenation
      if (this.rows !== other.rows) {
        throw new Error('Matrices must have same number of rows for horizontal concatenation');
      }
      const result = new Matrix(this.rows, this.cols + other.cols);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          result.data[i][j] = this.data[i][j];
        }
        for (let j = 0; j < other.cols; j++) {
          result.data[i][this.cols + j] = other.data[i][j];
        }
      }
      return result;
    }
    throw new Error('Invalid dimension for concatenation');
  }

  /**
   * Find indices where condition is true
   * @param {Function} condition - function that returns boolean
   * @returns {Array} array of {row, col} objects
   */
  find(condition) {
    const indices = [];
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (condition(this.data[i][j])) {
          indices.push({ row: i, col: j, value: this.data[i][j] });
        }
      }
    }
    return indices;
  }

  /**
   * Remove linear trend (detrend)
   * @param {number} dim - 0 for column-wise, 1 for row-wise
   * @returns {Matrix}
   */
  detrend(dim = 0) {
    if (dim === 0 && this.cols === 1) {
      // Column vector - remove linear trend
      const n = this.rows;
      const x = Array.from({ length: n }, (_, i) => i);
      const y = this.data.map(row => row[0]);
      
      // Calculate linear regression coefficients
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Remove trend
      const result = new Matrix(this.rows, 1);
      for (let i = 0; i < n; i++) {
        const trend = slope * i + intercept;
        result.data[i][0] = y[i] - trend;
      }
      return result;
    }
    throw new Error('Detrend currently only supports column vectors');
  }

  /**
   * Display matrix (for debugging)
   * @param {number} precision - decimal places
   * @returns {string}
   */
  toString(precision = 4) {
    let str = '';
    for (let i = 0; i < this.rows; i++) {
      str += '[';
      for (let j = 0; j < this.cols; j++) {
        str += this.data[i][j].toFixed(precision);
        if (j < this.cols - 1) str += ', ';
      }
      str += ']\n';
    }
    return str;
  }

  /**
   * Create a copy of the matrix
   * @returns {Matrix}
   */
  clone() {
    return new Matrix(this.data);
  }
}

// =================== STATIC METHODS AND UTILITY FUNCTIONS ===================

/**
 * Create identity matrix (equivalent to MATLAB eye())
 * @param {number} n - size of identity matrix
 * @returns {Matrix}
 */
Matrix.eye = function(n) {
  const result = new Matrix(n, n, 0);
  for (let i = 0; i < n; i++) {
    result.data[i][i] = 1;
  }
  return result;
};

/**
 * Create matrix of zeros (equivalent to MATLAB zeros())
 * @param {number} rows
 * @param {number} cols
 * @returns {Matrix}
 */
Matrix.zeros = function(rows, cols = rows) {
  return new Matrix(rows, cols, 0);
};

/**
 * Create matrix of ones (equivalent to MATLAB ones())
 * @param {number} rows
 * @param {number} cols
 * @returns {Matrix}
 */
Matrix.ones = function(rows, cols = rows) {
  return new Matrix(rows, cols, 1);
};

/**
 * Create random matrix (equivalent to MATLAB rand())
 * @param {number} rows
 * @param {number} cols
 * @returns {Matrix}
 */
Matrix.rand = function(rows, cols = rows) {
  const result = new Matrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result.data[i][j] = Math.random();
    }
  }
  return result;
};

/**
 * Create linearly spaced vector (equivalent to MATLAB linspace())
 * @param {number} start
 * @param {number} end
 * @param {number} n - number of points
 * @returns {Matrix}
 */
Matrix.linspace = function(start, end, n = 100) {
  const result = new Matrix(n, 1);
  const step = (end - start) / (n - 1);
  for (let i = 0; i < n; i++) {
    result.data[i][0] = start + i * step;
  }
  return result;
};

/**
 * Create vector from array (equivalent to creating column vector in MATLAB)
 * @param {Array} arr
 * @returns {Matrix}
 */
Matrix.fromArray = function(arr) {
  return new Matrix(arr);
};

/**
 * Create matrix from 2D array
 * @param {Array} arr2d
 * @returns {Matrix}
 */
Matrix.from2DArray = function(arr2d) {
  return new Matrix(arr2d);
};

// =================== SIGNAL PROCESSING UTILITIES ===================

/**
 * Cumulative trapezoidal integration (equivalent to MATLAB cumtrapz())
 * @param {Matrix} x - x values (optional, defaults to unit spacing)
 * @param {Matrix} y - y values
 * @returns {Matrix}
 */
Matrix.cumtrapz = function(x, y = null) {
  if (y === null) {
    // Single argument case - y is the data, x is unit spaced
    y = x;
    x = Matrix.linspace(0, y.rows - 1, y.rows);
  }

  if (x.rows !== y.rows) {
    throw new Error('x and y must have same length');
  }

  const result = new Matrix(y.rows, 1);
  result.data[0][0] = 0; // First value is always 0

  for (let i = 1; i < y.rows; i++) {
    const dx = x.get(i) - x.get(i - 1);
    const avgY = (y.get(i) + y.get(i - 1)) / 2;
    result.data[i][0] = result.data[i - 1][0] + dx * avgY;
  }

  return result;
};

/**
 * Trapezoidal integration (equivalent to MATLAB trapz())
 * @param {Matrix} x - x values (optional)
 * @param {Matrix} y - y values
 * @returns {number}
 */
Matrix.trapz = function(x, y = null) {
  if (y === null) {
    y = x;
    x = Matrix.linspace(0, y.rows - 1, y.rows);
  }

  if (x.rows !== y.rows) {
    throw new Error('x and y must have same length');
  }

  let integral = 0;
  for (let i = 1; i < y.rows; i++) {
    const dx = x.get(i) - x.get(i - 1);
    const avgY = (y.get(i) + y.get(i - 1)) / 2;
    integral += dx * avgY;
  }

  return integral;
};

// Export the Matrix class and utility functions
module.exports = {
  Matrix,
  
  // Convenience functions that mirror MATLAB syntax
  zeros: Matrix.zeros,
  ones: Matrix.ones,
  eye: Matrix.eye,
  rand: Matrix.rand,
  linspace: Matrix.linspace,
  cumtrapz: Matrix.cumtrapz,
  trapz: Matrix.trapz,
  
  // Helper functions for earthquake data processing
  fromArray: Matrix.fromArray,
  from2DArray: Matrix.from2DArray
};