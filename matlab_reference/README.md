# MATLAB AFAD Analysis - Reference Implementation

## Main Functions:
- `preprocessboore()` - High-pass filtering and detrending
- PGA, PGV, PGD calculations
- Fourier Transform analysis
- Bracketed Duration calculation
- Site Frequency determination
- Arias Intensity calculation
- Response Spectra (PSA, PSV, SD)
- P/S wave arrival picking

## Key Parameters:
- Default corner frequency: 0.05 Hz
- Damping ratio: 5% (0.05)
- Sampling interval: 0.01 s
- Response spectra period range: 0.01-10 s

## Units:
- Acceleration: cm/s²
- Velocity: cm/s
- Displacement: cm
- Time: seconds
- Frequency: Hz