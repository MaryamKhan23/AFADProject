/**
 * Signal Processing Utilities for Earthquake Data Analysis
 * JavaScript port of MATLAB utilities for AFAD project
 */

/**
 * Remove linear trend from data (equivalent to MATLAB's detrend)
 * @param {number[]} data - Input signal array
 * @returns {number[]} Detrended data
 */
function detrend(data) {
    const n = data.length;
    if (n < 2) return [...data];
    
    // Linear regression to find trend
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Remove trend
    return data.map((yi, i) => yi - (slope * i + intercept));
  }
  
  /**
   * Numerical integration using trapezoidal rule (equivalent to MATLAB's trapz)
   * @param {number[]} x - X values (time array)
   * @param {number[]} y - Y values (signal array)
   * @returns {number} Integrated value
   */
  function trapz(x, y) {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('trapz: x and y must have same length and at least 2 elements');
    }
    
    let integral = 0;
    for (let i = 1; i < x.length; i++) {
      const dx = x[i] - x[i - 1];
      const avgY = (y[i] + y[i - 1]) / 2;
      integral += dx * avgY;
    }
    
    return integral;
  }
  
  /**
   * Cumulative trapezoidal integration (equivalent to MATLAB's cumtrapz)
   * @param {number[]} x - X values (time array)
   * @param {number[]} y - Y values (signal array)
   * @returns {number[]} Cumulative integral array
   */
  function cumtrapz(x, y) {
    if (x.length !== y.length) {
      throw new Error('cumtrapz: x and y must have same length');
    }
    
    const result = new Array(x.length);
    result[0] = 0;
    
    for (let i = 1; i < x.length; i++) {
      const dx = x[i] - x[i - 1];
      const avgY = (y[i] + y[i - 1]) / 2;
      result[i] = result[i - 1] + dx * avgY;
    }
    
    return result;
  }
  
  /**
   * Fast Fourier Transform using Cooley-Tukey algorithm
   * @param {number[]|Complex[]} signal - Input signal (real or complex)
   * @returns {Complex[]} FFT result
   */
  function fft(signal) {
    const n = signal.length;
    
    // Convert to complex if needed
    const x = signal.map(val => 
      typeof val === 'number' ? { real: val, imag: 0 } : val
    );
    
    // Base case
    if (n <= 1) return x;
    
    // Ensure length is power of 2 (pad with zeros if needed)
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    if (n !== nextPow2) {
      while (x.length < nextPow2) {
        x.push({ real: 0, imag: 0 });
      }
    }
    
    return fftRecursive(x);
  }
  
  /**
   * Recursive FFT implementation
   * @private
   */
  function fftRecursive(x) {
    const n = x.length;
    if (n <= 1) return x;
    
    // Divide
    const even = [];
    const odd = [];
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) even.push(x[i]);
      else odd.push(x[i]);
    }
    
    // Conquer
    const evenFFT = fftRecursive(even);
    const oddFFT = fftRecursive(odd);
    
    // Combine
    const result = new Array(n);
    for (let k = 0; k < n / 2; k++) {
      const angle = -2 * Math.PI * k / n;
      const twiddle = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };
      
      const temp = complexMultiply(twiddle, oddFFT[k]);
      
      result[k] = complexAdd(evenFFT[k], temp);
      result[k + n / 2] = complexSubtract(evenFFT[k], temp);
    }
    
    return result;
  }
  
  /**
   * Inverse Fast Fourier Transform
   * @param {Complex[]} spectrum - Input spectrum
   * @returns {Complex[]} IFFT result
   */
  function ifft(spectrum) {
    // Conjugate input
    const conjugated = spectrum.map(c => ({ real: c.real, imag: -c.imag }));
    
    // Forward FFT
    const result = fft(conjugated);
    
    // Conjugate and normalize
    const n = result.length;
    return result.map(c => ({
      real: c.real / n,
      imag: -c.imag / n
    }));
  }
  
  /**
   * Complex number operations
   */
  function complexAdd(a, b) {
    return { real: a.real + b.real, imag: a.imag + b.imag };
  }
  
  function complexSubtract(a, b) {
    return { real: a.real - b.real, imag: a.imag - b.imag };
  }
  
  function complexMultiply(a, b) {
    return {
      real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real
    };
  }
  
  function complexAbs(c) {
    return Math.sqrt(c.real * c.real + c.imag * c.imag);
  }
  
  function complexAngle(c) {
    return Math.atan2(c.imag, c.real);
  }
  
  /**
   * Find indices where condition is true (equivalent to MATLAB's find)
   * @param {number[]} array - Input array
   * @param {function} condition - Condition function
   * @returns {number[]} Array of indices
   */
  function find(array, condition) {
    const indices = [];
    for (let i = 0; i < array.length; i++) {
      if (condition(array[i], i)) {
        indices.push(i);
      }
    }
    return indices;
  }
  
  /**
   * Linear interpolation for missing data points
   * @param {number[]} x - X coordinates
   * @param {number[]} y - Y coordinates  
   * @param {number[]} xi - X coordinates for interpolation
   * @returns {number[]} Interpolated Y values
   */
  function interp1(x, y, xi) {
    if (x.length !== y.length) {
      throw new Error('interp1: x and y must have same length');
    }
    
    return xi.map(xVal => {
      // Find surrounding points
      let i = 0;
      while (i < x.length - 1 && x[i + 1] < xVal) i++;
      
      // Handle edge cases
      if (xVal <= x[0]) return y[0];
      if (xVal >= x[x.length - 1]) return y[y.length - 1];
      
      // Linear interpolation
      const x0 = x[i], x1 = x[i + 1];
      const y0 = y[i], y1 = y[i + 1];
      const t = (xVal - x0) / (x1 - x0);
      
      return y0 + t * (y1 - y0);
    });
  }
  
  /**
   * Generate time array (equivalent to creating time vector in MATLAB)
   * @param {number} dt - Sampling interval
   * @param {number} length - Array length
   * @returns {number[]} Time array
   */
  function generateTimeArray(dt, length) {
    return Array.from({ length }, (_, i) => i * dt);
  }
  
  /**
   * Calculate absolute maximum value in array
   * @param {number[]} array - Input array
   * @returns {number} Maximum absolute value
   */
  function maxAbs(array) {
    return Math.max(...array.map(Math.abs));
  }
  
  /**
   * High-pass filter implementation in frequency domain
   * @param {number[]} data - Input signal
   * @param {number} fs - Sampling frequency
   * @param {number} cornerFreq - Corner frequency for high-pass filter
   * @returns {number[]} Filtered signal
   */
  function highPassFilter(data, fs, cornerFreq) {
    // Detrend first
    const detrendedData = detrend(data);
    
    // FFT
    const fftData = fft(detrendedData);
    const n = fftData.length;
    
    // Frequency vector
    const frequencies = Array.from({ length: n }, (_, i) => i * fs / n);
    
    // Create high-pass filter
    const hpFilter = frequencies.map(f => f >= cornerFreq ? 1 : 0);
    
    // Make filter symmetric for real signals
    if (n % 2 === 0) {
      for (let i = n / 2 + 1; i < n; i++) {
        hpFilter[i] = hpFilter[n - i];
      }
    } else {
      for (let i = Math.floor(n / 2) + 1; i < n; i++) {
        hpFilter[i] = hpFilter[n - i];
      }
    }
    
    // Apply filter
    const filteredFFT = fftData.map((c, i) => ({
      real: c.real * hpFilter[i],
      imag: c.imag * hpFilter[i]
    }));
    
    // IFFT
    const ifftResult = ifft(filteredFFT);
    
    // Return real part
    return ifftResult.map(c => c.real);
  }
  
  /**
   * Statistical functions
   */
  function mean(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }
  
  function std(array) {
    const avg = mean(array);
    const variance = array.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (array.length - 1);
    return Math.sqrt(variance);
  }
  
  /**
   * Newmark-Beta integration for SDOF response
   * @param {Object} params - Integration parameters
   * @returns {Object} Response arrays {displacement, velocity, acceleration}
   */
  function newmarkBeta(params) {
    const {
      acceleration,    // Ground acceleration array
      dt,             // Time step
      omega,          // Natural frequency
      zeta,           // Damping ratio
      beta = 1/4,     // Newmark beta parameter
      gamma = 1/2     // Newmark gamma parameter
    } = params;
    
    const n = acceleration.length;
    const m = 1;  // Unit mass
    const k = m * omega * omega;
    const c = 2 * zeta * m * omega;
    
    // Newmark constants
    const a0 = 1 / (beta * dt * dt);
    const a1 = gamma / (beta * dt);
    const a2 = 1 / (beta * dt);
    const a3 = 1 / (2 * beta) - 1;
    const a4 = gamma / beta - 1;
    const a5 = dt * (gamma / (2 * beta) - 1);
    
    const keff = k + a0 * m + a1 * c;
    
    // Initialize arrays
    const u = new Array(n).fill(0);    // Displacement
    const v = new Array(n).fill(0);    // Velocity
    const acc = new Array(n).fill(0);  // Relative acceleration
    
    // Time integration
    for (let i = 1; i < n; i++) {
      const dp = -m * (acceleration[i] - acceleration[i-1]);
      const rhs = dp + 
                  m * (a0 * u[i-1] + a2 * v[i-1] + a3 * acc[i-1]) +
                  c * (a1 * u[i-1] + a4 * v[i-1] + a5 * acc[i-1]);
      
      const du = rhs / keff;
      const dv = a1 * (du - u[i-1]) - a4 * v[i-1] - a5 * acc[i-1];
      const da = a0 * (du - u[i-1]) - a2 * v[i-1] - a3 * acc[i-1];
      
      u[i] = du;
      v[i] = dv;
      acc[i] = da;
    }
    
    return { displacement: u, velocity: v, acceleration: acc };
  }
  
  module.exports = {
    // Basic utilities
    detrend,
    trapz,
    cumtrapz,
    generateTimeArray,
    maxAbs,
    find,
    interp1,
    
    // Statistical functions
    mean,
    std,
    
    // FFT functions
    fft,
    ifft,
    complexAdd,
    complexSubtract,
    complexMultiply,
    complexAbs,
    complexAngle,
    
    // Signal processing
    highPassFilter,
    newmarkBeta
  };