# MATLAB to JavaScript Function Mapping

| MATLAB Function | Purpose | JS Equivalent | Status |
|----------------|---------|---------------|--------|
| `preprocessboore()` | High-pass filter + detrend | `preprocessBoore()` | ✅ Ported |
| `fft()` | Fast Fourier Transform | `fft.js` library | ✅ Available |
| `cumtrapz()` | Cumulative trapezoidal integration | `cumtrapz()` | ✅ Ported |
| `detrend()` | Remove linear trend | `detrend()` | ✅ Ported |
| `trapz()` | Trapezoidal integration | `trapz()` | ✅ Ported |
| `ginput()` | Interactive point selection | Web-based picker | 🔄 Modified |
| `max()`, `abs()` | Math operations | Native JS | ✅ Available |

## Custom Functions Needed:
- Newmark-Beta integration for response spectra
- Bracketed duration calculation
- Arias intensity calculation
- Site frequency peak detection