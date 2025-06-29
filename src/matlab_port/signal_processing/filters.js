/**
 * Signal Filtering Functions
 * JavaScript port of MATLAB filtering algorithms for earthquake data processing
 */

/**
 * High-pass filter using frequency domain approach (Boore method)
 * @param {number[]} data - Input signal data
 * @param {number} fs - Sampling frequency (Hz)
 * @param {number} cornerFreq - Corner frequency for high-pass filter (Hz)
 * @param {number} order - Filter order (unused in this implementation, kept for compatibility)
 * @returns {number[]} - Filtered signal
 */
function preprocessBoore(data, fs, cornerFreq, order = 2) {
    if (!data || data.length === 0) {
        throw new Error('Input data is empty or invalid');
    }
    
    if (fs <= 0 || cornerFreq <= 0) {
        throw new Error('Sampling frequency and corner frequency must be positive');
    }

    // Step 1: Detrend to remove linear trend
    const detrendedData = detrend(data);
    
    // Step 2: FFT of signal
    const N = detrendedData.length;
    const fftData = fft(detrendedData);
    
    // Step 3: Frequency vector
    const f = Array.from({ length: N }, (_, i) => i * fs / N);
    
    // Step 4: Create high-pass filter
    const hpFilter = f.map(freq => freq < cornerFreq ? 0 : 1);
    
    // Step 5: Symmetrize the filter for real-valued input
    if (N % 2 === 0) {
        // Even length
        for (let i = Math.floor(N/2) + 1; i < N; i++) {
            hpFilter[i] = hpFilter[N - i];
        }
    } else {
        // Odd length
        for (let i = Math.floor((N+1)/2); i < N; i++) {
            hpFilter[i] = hpFilter[N - i];
        }
    }
    
    // Step 6: Apply filter in frequency domain
    const fftFiltered = fftData.map((val, i) => ({
        real: val.real * hpFilter[i],
        imag: val.imag * hpFilter[i]
    }));
    
    // Step 7: Inverse FFT
    const filtered = ifft(fftFiltered);
    
    // Return only real part (imaginary should be ~0 for real input)
    return filtered.map(val => val.real);
}

/**
 * Butterworth high-pass filter implementation
 * @param {number[]} data - Input signal
 * @param {number} fs - Sampling frequency
 * @param {number} cutoffFreq - Cutoff frequency
 * @param {number} order - Filter order
 * @returns {number[]} - Filtered signal
 */
function butterworthHighPass(data, fs, cutoffFreq, order = 4) {
    // Normalize frequency (0 to 1, where 1 is Nyquist frequency)
    const nyquist = fs / 2;
    const normalizedCutoff = cutoffFreq / nyquist;
    
    if (normalizedCutoff >= 1) {
        throw new Error('Cutoff frequency must be less than Nyquist frequency');
    }
    
    // Design Butterworth filter coefficients
    const { b, a } = designButterworthHP(normalizedCutoff, order);
    
    // Apply filter using direct form II transposed structure
    return filtfilt(b, a, data);
}

/**
 * Zero-phase digital filtering (equivalent to MATLAB's filtfilt)
 * @param {number[]} b - Numerator coefficients
 * @param {number[]} a - Denominator coefficients  
 * @param {number[]} x - Input signal
 * @returns {number[]} - Filtered signal
 */
function filtfilt(b, a, x) {
    // Forward filtering
    let y = filter(b, a, x);
    
    // Reverse the signal
    y = y.reverse();
    
    // Filter again (backward)
    y = filter(b, a, y);
    
    // Reverse back to original order
    return y.reverse();
}

/**
 * Digital filter implementation (direct form II)
 * @param {number[]} b - Numerator coefficients
 * @param {number[]} a - Denominator coefficients
 * @param {number[]} x - Input signal
 * @returns {number[]} - Filtered signal
 */
function filter(b, a, x) {
    const y = new Array(x.length);
    const w = new Array(Math.max(b.length, a.length)).fill(0);
    
    // Normalize coefficients by a[0]
    const a0 = a[0];
    const bNorm = b.map(coeff => coeff / a0);
    const aNorm = a.map(coeff => coeff / a0);
    
    for (let n = 0; n < x.length; n++) {
        // Shift delay line
        for (let i = w.length - 1; i > 0; i--) {
            w[i] = w[i - 1];
        }
        
        // Input
        w[0] = x[n];
        
        // Feedback
        for (let i = 1; i < aNorm.length; i++) {
            if (i < w.length) {
                w[0] -= aNorm[i] * w[i];
            }
        }
        
        // Output
        y[n] = 0;
        for (let i = 0; i < bNorm.length && i < w.length; i++) {
            y[n] += bNorm[i] * w[i];
        }
    }
    
    return y;
}

/**
 * Design Butterworth high-pass filter coefficients
 * @param {number} normalizedCutoff - Normalized cutoff frequency (0-1)
 * @param {number} order - Filter order
 * @returns {Object} - {b: numerator, a: denominator} coefficients
 */
function designButterworthHP(normalizedCutoff, order) {
    // This is a simplified implementation
    // For production use, consider using a dedicated DSP library
    
    const wc = Math.tan(Math.PI * normalizedCutoff / 2);
    const k = Math.pow(wc, order);
    
    // For order 2 high-pass Butterworth filter
    if (order === 2) {
        const sqrt2 = Math.sqrt(2);
        const wc2 = wc * wc;
        
        const b = [1, -2, 1];
        const a = [1 + sqrt2 * wc + wc2, 2 * (wc2 - 1), 1 - sqrt2 * wc + wc2];
        
        // Normalize
        const norm = a[0];
        return {
            b: b.map(coeff => coeff / norm),
            a: a.map(coeff => coeff / norm)
        };
    }
    
    // For other orders, use a more general approach or throw error
    throw new Error(`Butterworth filter design for order ${order} not implemented`);
}

/**
 * Remove linear trend from data
 * @param {number[]} data - Input data array
 * @returns {number[]} - Detrended data
 */
function detrend(data) {
    if (!data || data.length === 0) return [];
    
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Calculate linear regression coefficients
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Remove linear trend
    return data.map((yi, i) => yi - (slope * i + intercept));
}

/**
 * Simple FFT implementation (Cooley-Tukey algorithm)
 * @param {number[]} x - Real input signal
 * @returns {Object[]} - Array of {real, imag} complex numbers
 */
function fft(x) {
    const N = x.length;
    if (N <= 1) return x.map(val => ({ real: val, imag: 0 }));
    
    // Convert to complex numbers if needed
    const X = x.map(val => typeof val === 'object' ? val : { real: val, imag: 0 });
    
    return fftRecursive(X);
}

/**
 * Recursive FFT implementation
 * @param {Object[]} X - Complex input array
 * @returns {Object[]} - Complex output array
 */
function fftRecursive(X) {
    const N = X.length;
    if (N <= 1) return X;
    
    // Divide
    const even = X.filter((_, i) => i % 2 === 0);
    const odd = X.filter((_, i) => i % 2 === 1);
    
    // Conquer
    const evenFFT = fftRecursive(even);
    const oddFFT = fftRecursive(odd);
    
    // Combine
    const combined = new Array(N);
    for (let k = 0; k < N / 2; k++) {
        const angle = -2 * Math.PI * k / N;
        const twiddle = {
            real: Math.cos(angle),
            imag: Math.sin(angle)
        };
        
        const t = complexMultiply(twiddle, oddFFT[k]);
        
        combined[k] = complexAdd(evenFFT[k], t);
        combined[k + N / 2] = complexSubtract(evenFFT[k], t);
    }
    
    return combined;
}

/**
 * Inverse FFT
 * @param {Object[]} X - Complex frequency domain data
 * @returns {Object[]} - Complex time domain data
 */
function ifft(X) {
    const N = X.length;
    
    // Conjugate input
    const Xconj = X.map(val => ({ real: val.real, imag: -val.imag }));
    
    // Perform FFT
    const result = fftRecursive(Xconj);
    
    // Conjugate and scale
    return result.map(val => ({
        real: val.real / N,
        imag: -val.imag / N
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

module.exports = {
    preprocessBoore,
    butterworthHighPass,
    filtfilt,
    filter,
    detrend,
    fft,
    ifft,
    
    // Utility functions
    complexAdd,
    complexSubtract,
    complexMultiply
};