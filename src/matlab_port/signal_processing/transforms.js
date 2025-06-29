/**
 * Signal Transform Functions
 * JavaScript port of MATLAB transform algorithms for earthquake data processing
 */

const { fft, ifft } = require('./filters');

/**
 * Compute Fourier Transform and return amplitude and phase spectra
 * @param {number[]} signal - Input time series
 * @param {number} samplingRate - Sampling rate (Hz)
 * @returns {Object} - {frequencies, amplitudes, phases, singleSided}
 */
function fourierTransform(signal, samplingRate) {
    if (!signal || signal.length === 0) {
        throw new Error('Input signal is empty');
    }
    
    const N = signal.length;
    const dt = 1 / samplingRate;
    
    // Perform FFT
    const fftResult = fft(signal);
    
    // Compute frequency vector
    const frequencies = Array.from({ length: N }, (_, i) => i * samplingRate / N);
    
    // Compute two-sided amplitude spectrum
    const amplitudesTwoSided = fftResult.map(val => 
        Math.sqrt(val.real * val.real + val.imag * val.imag) / N
    );
    
    // Compute single-sided amplitude spectrum
    const halfLength = Math.floor(N / 2) + 1;
    const amplitudesSingleSided = amplitudesTwoSided.slice(0, halfLength);
    
    // Double the amplitudes (except DC and Nyquist)
    for (let i = 1; i < amplitudesSingleSided.length - 1; i++) {
        amplitudesSingleSided[i] *= 2;
    }
    
    // Compute phase spectrum
    const phases = fftResult.slice(0, halfLength).map(val => 
        Math.atan2(val.imag, val.real)
    );
    
    // Single-sided frequency vector
    const frequenciesSingleSided = frequencies.slice(0, halfLength);
    
    return {
        frequencies: frequenciesSingleSided,
        amplitudes: amplitudesSingleSided,
        phases: phases,
        twoSided: {
            frequencies: frequencies,
            amplitudes: amplitudesTwoSided
        }
    };
}

/**
 * Integrate acceleration to get velocity using trapezoidal rule
 * @param {number[]} time - Time array
 * @param {number[]} acceleration - Acceleration array
 * @returns {number[]} - Velocity array
 */
function integrateAcceleration(time, acceleration) {
    if (time.length !== acceleration.length) {
        throw new Error('Time and acceleration arrays must have the same length');
    }
    
    const velocity = new Array(acceleration.length);
    velocity[0] = 0; // Initial velocity is zero
    
    for (let i = 1; i < acceleration.length; i++) {
        const dt = time[i] - time[i - 1];
        velocity[i] = velocity[i - 1] + 0.5 * (acceleration[i] + acceleration[i - 1]) * dt;
    }
    
    return velocity;
}

/**
 * Integrate velocity to get displacement using trapezoidal rule
 * @param {number[]} time - Time array  
 * @param {number[]} velocity - Velocity array
 * @returns {number[]} - Displacement array
 */
function integrateVelocity(time, velocity) {
    if (time.length !== velocity.length) {
        throw new Error('Time and velocity arrays must have the same length');
    }
    
    const displacement = new Array(velocity.length);
    displacement[0] = 0; // Initial displacement is zero
    
    for (let i = 1; i < velocity.length; i++) {
        const dt = time[i] - time[i - 1];
        displacement[i] = displacement[i - 1] + 0.5 * (velocity[i] + velocity[i - 1]) * dt;
    }
    
    return displacement;
}

/**
 * Cumulative trapezoidal integration (MATLAB cumtrapz equivalent)
 * @param {number[]} x - Independent variable array (time)
 * @param {number[]} y - Dependent variable array (signal to integrate)
 * @returns {number[]} - Cumulative integral
 */
function cumtrapz(x, y) {
    if (x.length !== y.length) {
        throw new Error('Input arrays must have the same length');
    }
    
    const result = new Array(x.length);
    result[0] = 0;
    
    for (let i = 1; i < x.length; i++) {
        const dx = x[i] - x[i - 1];
        result[i] = result[i - 1] + 0.5 * (y[i] + y[i - 1]) * dx;
    }
    
    return result;
}

/**
 * Simple trapezoidal integration (MATLAB trapz equivalent)
 * @param {number[]} x - Independent variable array
 * @param {number[]} y - Dependent variable array
 * @returns {number} - Integral value
 */
function trapz(x, y) {
    if (x.length !== y.length) {
        throw new Error('Input arrays must have the same length');
    }
    
    let integral = 0;
    for (let i = 1; i < x.length; i++) {
        const dx = x[i] - x[i - 1];
        integral += 0.5 * (y[i] + y[i - 1]) * dx;
    }
    
    return integral;
}

/**
 * Power Spectral Density calculation
 * @param {number[]} signal - Input signal
 * @param {number} samplingRate - Sampling rate
 * @param {number} windowSize - Window size for Welch's method (optional)
 * @returns {Object} - {frequencies, psd}
 */
function powerSpectralDensity(signal, samplingRate, windowSize = null) {
    windowSize = windowSize || signal.length;
    
    const fftResult = fourierTransform(signal, samplingRate);
    
    // Calculate PSD from amplitude spectrum
    const psd = fftResult.amplitudes.map(amp => amp * amp);
    
    return {
        frequencies: fftResult.frequencies,
        psd: psd
    };
}

/**
 * Find dominant frequency in signal
 * @param {number[]} signal - Input signal
 * @param {number} samplingRate - Sampling rate
 * @returns {Object} - {frequency, amplitude, index}
 */
function findDominantFrequency(signal, samplingRate) {
    const fftResult = fourierTransform(signal, samplingRate);
    
    // Find peak in amplitude spectrum (excluding DC component)
    let maxAmplitude = 0;
    let maxIndex = 1; // Start from 1 to skip DC
    
    for (let i = 1; i < fftResult.amplitudes.length; i++) {
        if (fftResult.amplitudes[i] > maxAmplitude) {
            maxAmplitude = fftResult.amplitudes[i];
            maxIndex = i;
        }
    }
    
    return {
        frequency: fftResult.frequencies[maxIndex],
        amplitude: maxAmplitude,
        index: maxIndex
    };
}

/**
 * Window functions for signal processing
 */
const windowFunctions = {
    /**
     * Hanning window
     * @param {number} N - Window length
     * @returns {number[]} - Window coefficients
     */
    hanning: function(N) {
        return Array.from({ length: N }, (_, n) => 
            0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1)))
        );
    },
    
    /**
     * Hamming window
     * @param {number} N - Window length
     * @returns {number[]} - Window coefficients
     */
    hamming: function(N) {
        return Array.from({ length: N }, (_, n) => 
            0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1))
        );
    },
    
    /**
     * Blackman window
     * @param {number} N - Window length
     * @returns {number[]} - Window coefficients
     */
    blackman: function(N) {
        return Array.from({ length: N }, (_, n) => {
            const x = 2 * Math.PI * n / (N - 1);
            return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
        });
    }
};

/**
 * Apply window function to signal
 * @param {number[]} signal - Input signal
 * @param {string} windowType - Type of window ('hanning', 'hamming', 'blackman')
 * @returns {number[]} - Windowed signal
 */
function applyWindow(signal, windowType = 'hanning') {
    if (!windowFunctions[windowType]) {
        throw new Error(`Unknown window type: ${windowType}`);
    }
    
    const window = windowFunctions[windowType](signal.length);
    return signal.map((val, i) => val * window[i]);
}

/**
 * Zero-padding for FFT optimization
 * @param {number[]} signal - Input signal
 * @param {number} targetLength - Desired length (should be power of 2)
 * @returns {number[]} - Zero-padded signal
 */
function zeroPad(signal, targetLength) {
    if (targetLength <= signal.length) {
        return signal.slice(); // Return copy if no padding needed
    }
    
    const padded = new Array(targetLength).fill(0);
    for (let i = 0; i < signal.length; i++) {
        padded[i] = signal[i];
    }
    
    return padded;
}

/**
 * Find next power of 2 for FFT optimization
 * @param {number} n - Input number
 * @returns {number} - Next power of 2
 */
function nextPowerOf2(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Cross-correlation between two signals
 * @param {number[]} x - First signal
 * @param {number[]} y - Second signal
 * @returns {number[]} - Cross-correlation sequence
 */
function xcorr(x, y) {
    const N = x.length;
    const M = y.length;
    const maxLen = Math.max(N, M);
    const totalLen = 2 * maxLen - 1;
    
    // Zero-pad both signals
    const xPadded = zeroPad(x, totalLen);
    const yPadded = zeroPad(y, totalLen);
    
    // FFT-based correlation
    const X = fft(xPadded);
    const Y = fft(yPadded);
    
    // Multiply X with conjugate of Y
    const product = X.map((xVal, i) => ({
        real: xVal.real * Y[i].real + xVal.imag * Y[i].imag,
        imag: xVal.imag * Y[i].real - xVal.real * Y[i].imag
    }));
    
    // IFFT to get correlation
    const correlation = ifft(product);
    
    return correlation.map(val => val.real);
}

module.exports = {
    fourierTransform,
    integrateAcceleration,
    integrateVelocity,
    cumtrapz,
    trapz,
    powerSpectralDensity,
    findDominantFrequency,
    windowFunctions,
    applyWindow,
    zeroPad,
    nextPowerOf2,
    xcorr
};