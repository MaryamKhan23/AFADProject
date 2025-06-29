    % Step 1: Let user select the file
[file, path] = uigetfile('*.asc', 'Select the Earthquake Data File');
if isequal(file, 0)
    disp('File selection cancelled.');
    return;
end
filename = fullfile(path, file);

% Step 2: Open file
fid = fopen(filename, 'r');
if fid == -1
    error('Unable to open the file.');
end
disp('File opened successfully.');

% Step 3: Auto-scan to find where numeric data begins
line = fgetl(fid);
data_lines = {};
while ischar(line)
    nums = sscanf(line, '%f');
    if ~isempty(nums)
        data_lines{end+1} = line; %#ok<AGROW>
    elseif ~isempty(data_lines)
        break;  % Stop on first non-numeric line after data started
    end
    line = fgetl(fid);
end
fclose(fid);

% Step 4: Convert to numeric array
acc = cell2mat(cellfun(@(x) sscanf(x, '%f'), data_lines, 'UniformOutput', false));

% Step 5: User input for corner frequency
userInput = inputdlg('Enter corner frequency for high-pass filter (Hz):', ...
                     'Corner Frequency Input', [1 50], {'0.05'});

if isempty(userInput)
    disp('No input provided. Using default corner frequency: 0.05 Hz');
    cornerfreq = 0.05;
else
    cornerfreq = str2double(userInput{1});
    if isnan(cornerfreq) || cornerfreq <= 0
        disp('Invalid input. Using default corner frequency: 0.05 Hz');
        cornerfreq = 0.05;
    end
end

% Step 6: Preprocessing
dt = 0.01;  % Sampling interval
fs = 1 / dt;  % Sampling frequency
preprocessacc = preprocessboore(acc, fs, cornerfreq, 2);
preprocesstime = (0:length(preprocessacc)-1) * dt;

% Step 7: Time vector for raw data (used only for initial comparison)
time = (0:length(acc)-1) * dt;

% Step 8: Velocity and Displacement
velocity = cumtrapz(time, acc);
displacement = cumtrapz(time, velocity);

preprocessvelocity = cumtrapz(preprocesstime, preprocessacc);
preprocessdisplacement = cumtrapz(preprocesstime, preprocessvelocity);

% Step 9: PGA, PGV, PGD
PGA = max(abs(acc));
PGV = max(abs(velocity));
PGD = max(abs(displacement));

PGA_pre = max(abs(preprocessacc));
PGV_pre = max(abs(preprocessvelocity));
PGD_pre = max(abs(preprocessdisplacement));

% Step 10: Plotting with Annotations
figure;

% Acceleration Plot
subplot(3,1,1);
plot(time, acc, 'b', preprocesstime, preprocessacc, 'r', 'LineWidth', 1.2);
title('Time vs Acceleration');
xlabel('Time (s)'); ylabel('Acceleration (cm/s^2)');
legend('Raw', 'Preprocessed'); grid on;
text(0.02, 0.95, sprintf('Raw PGA: %.2f cm/s^2\nPreproc PGA: %.2f cm/s^2', PGA, PGA_pre), ...
    'Units', 'normalized', 'VerticalAlignment', 'top', 'FontSize', 10, 'BackgroundColor', 'w');

% Velocity Plot
subplot(3,1,2);
plot(time, velocity, 'b', preprocesstime, preprocessvelocity, 'r', 'LineWidth', 1.2);
title('Time vs Velocity');
xlabel('Time (s)'); ylabel('Velocity (cm/s)');
legend('Raw', 'Preprocessed'); grid on;
text(0.02, 0.95, sprintf('Raw PGV: %.2f cm/s\nPreproc PGV: %.2f cm/s', PGV, PGV_pre), ...
    'Units', 'normalized', 'VerticalAlignment', 'top', 'FontSize', 10, 'BackgroundColor', 'w');

% Displacement Plot
subplot(3,1,3);
plot(time, displacement, 'b', preprocesstime, preprocessdisplacement, 'r', 'LineWidth', 1.2);
title('Time vs Displacement');
xlabel('Time (s)'); ylabel('Displacement (cm)');
legend('Raw', 'Preprocessed'); grid on;
text(0.02, 0.95, sprintf('Raw PGD: %.2f cm\nPreproc PGD: %.2f cm', PGD, PGD_pre), ...
    'Units', 'normalized', 'VerticalAlignment', 'top', 'FontSize', 10, 'BackgroundColor', 'w');

% Step 11: Display in Command Window
fprintf('--- Raw Data ---\n');
fprintf('PGA: %.2f cm/s^2\n', PGA);
fprintf('PGV: %.2f cm/s\n', PGV);
fprintf('PGD: %.2f cm\n\n', PGD);

fprintf('--- Preprocessed Data ---\n');
fprintf('PGA: %.2f cm/s^2\n', PGA_pre);
fprintf('PGV: %.2f cm/s\n', PGV_pre);
fprintf('PGD: %.2f cm\n', PGD_pre);

% ========== FUNCTION ==========
function filtered = preprocessboore(data, fs, corner_freq, ~)
    % Step 1: Detrend to remove linear trend
    data = detrend(data);

    % Step 2: FFT of signal
    N = length(data);
    fft_data = fft(data);

    % Step 3: Frequency vector
    f = (0:N-1) * fs / N;

    % Step 4: High-pass filter in frequency domain
    hp_filter = ones(size(f));
    hp_filter(f < corner_freq) = 0;

    % Step 5: Symmetrize the filter
    if mod(N, 2) == 0
        hp_filter(N/2+2:end) = fliplr(hp_filter(2:N/2));
    else
        hp_filter((N+1)/2+1:end) = fliplr(hp_filter(2:(N-1)/2+1));
    end

    % Step 6: Apply filter
    fft_filtered = fft_data .* hp_filter;

    % Step 7: Inverse FFT
    filtered = real(ifft(fft_filtered));
end

% Step 12: Fourier Transform (Updated to Match Step 14)

% Use preprocessed signal
signal = preprocessacc;
time = preprocesstime;
dt = time(2) - time(1);      % Sampling interval
Fs = 1 / dt;                 % Sampling frequency
L = length(signal);          % Signal length

% Perform FFT
Y = fft(signal);

% Compute single-sided amplitude spectrum
P2 = abs(Y / L);              % Two-sided spectrum
P1 = P2(1:floor(L/2)+1);      % Single-sided
P1(2:end-1) = 2 * P1(2:end-1);
f = Fs * (0:floor(L/2)) / L;  % Frequency vector

% Plot Amplitude Spectrum (Clean version)
figure;
plot(f, P1, 'b', 'LineWidth', 1.5);
title('Fourier Amplitude Spectrum (Single-Sided)');
xlabel('Frequency (Hz)');
ylabel('Amplitude');
grid on;

% (Optional) Plot Phase Spectrum (comment out if not useful)
% phase = angle(Y(1:floor(L/2)+1));
% figure;
% plot(f, phase, 'r', 'LineWidth', 1.2);
% title('Phase Spectrum');
% xlabel('Frequency (Hz)');
% ylabel('Phase (radians)');
% grid on;

% Step 13: Bracketed Duration (using 5% of PGA_pre as threshold)

threshold_pre = 0.05 * PGA_pre;
above_thresh_pre = find(abs(preprocessacc) >= threshold_pre);

if isempty(above_thresh_pre)
    bd_start_pre = NaN;
    bd_end_pre = NaN;
    bracket_duration_pre = 0;
else
    bd_start_pre = preprocesstime(above_thresh_pre(1));
    bd_end_pre = preprocesstime(above_thresh_pre(end));
    bracket_duration_pre = bd_end_pre - bd_start_pre;
end

% Plot bracketed duration on preprocessed acceleration plot
figure('Name', 'Bracketed Duration – Preprocessed Acceleration');
plot(preprocesstime, preprocessacc, 'r'); hold on;
xline(bd_start_pre, '--g', 'Start');
xline(bd_end_pre, '--r', 'End');
title('Preprocessed Acceleration with Bracketed Duration');
xlabel('Time (s)'); ylabel('Acceleration (cm/s^2)');
legend('Preprocessed Acc', 'Start Time', 'End Time');
grid on;

% Display in Command Window
fprintf('\n--- Bracketed Duration ---\n');
fprintf('Preprocessed: %.2f seconds (from %.2f s to %.2f s)\n', ...
    bracket_duration_pre, bd_start_pre, bd_end_pre);

% Step 14: Site Frequency (Preprocessed Only)

N_pre = length(preprocessacc);
f_pre = (0:N_pre-1) * fs / N_pre;
fft_pre = fft(preprocessacc);
amp_pre = abs(fft_pre);
amp_pre = amp_pre(1:floor(N_pre/2));
f_pre = f_pre(1:floor(N_pre/2));

[~, idx_pre] = max(amp_pre);
site_freq_pre = f_pre(idx_pre);

% Print to Command Window
fprintf('\n--- Site Frequency ---\n');
fprintf('Preprocessed Site Frequency: %.2f Hz\n', site_freq_pre);

% Optional: Plot Fourier Amplitude Spectrum and Mark Site Frequency
figure('Name', 'Site Frequency – Preprocessed');
plot(f_pre, amp_pre, 'r', 'LineWidth', 1.2); hold on;
xline(site_freq_pre, '--k', sprintf('Peak: %.2f Hz', site_freq_pre));
title('Site Frequency (Fourier Amplitude Spectrum)');
xlabel('Frequency (Hz)');
ylabel('Amplitude');
legend('Preprocessed', 'Site Frequency Peak');
grid on;
xlim([0 20]);

% Step 15: Arias Intensity Calculation (Preprocessed Only)

g = 9.81;  % Gravitational acceleration in m/s²

% Convert accelerometer data from cm/s² to m/s²
preprocessacc_mps2 = preprocessacc / 100;

% Arias Intensity Calculation
arias_intensity_pre = (pi / (2 * g)) * trapz(preprocesstime, preprocessacc_mps2.^2);
cumulative_AI_pre = (pi / (2 * g)) * cumtrapz(preprocesstime, preprocessacc_mps2.^2);

% Plot Cumulative Arias Intensity
figure('Name', 'Cumulative Arias Intensity');
plot(preprocesstime, cumulative_AI_pre * 100, 'r', 'LineWidth', 1.5);  % Convert to cm²/s
title('Cumulative Arias Intensity (Preprocessed)');
xlabel('Time (s)');
ylabel('Arias Intensity (cm²/s)');
legend('Preprocessed');
grid on;

% Display in Command Window
fprintf('\n--- Arias Intensity ---\n');
fprintf('Arias Intensity (Preprocessed): %.2f cm²/s\n', arias_intensity_pre * 100);

% Step 16: Response Spectra (SD, PSV, PSA) using SDOF Oscillator

% Input parameters
acc_signal = preprocessacc;      % Preprocessed acceleration (m/s^2)
t = preprocesstime;
dt = t(2) - t(1);                % Time step (s)
zeta = 0.05;                     % Damping ratio (5%)

% Define period and frequency range (avoid T=0)
periods = 0.01:0.02:10;          % Periods from 0.01s to 10s
freqs = 1 ./ periods;           % Corresponding frequencies (Hz)

% Initialize response arrays
PSA = zeros(size(freqs));
PSV = zeros(size(freqs));
SD  = zeros(size(freqs));

% Newmark-beta constants
beta = 1/4; gamma = 1/2;
a0 = 1/(beta*dt^2);
a1 = gamma/(beta*dt);
a2 = 1/(beta*dt);
a3 = 1/(2*beta) - 1;
a4 = gamma/beta - 1;
a5 = dt*(gamma/(2*beta) - 1);

n = length(acc_signal);

% Loop over frequencies
for i = 1:length(freqs)
    f = freqs(i);
    omega = 2 * pi * f;
    m = 1;                         % Unit mass
    k = m * omega^2;              % Stiffness
    c = 2 * zeta * m * omega;     % Damping coefficient

    % Newmark-beta initialization
    u = zeros(n,1);     % Displacement
    v = zeros(n,1);     % Velocity
    acc = zeros(n,1);   % Relative acceleration

    keff = k + a0*m + a1*c;

    % Skip if keff is invalid
    if isinf(keff) || isnan(keff) || keff == 0
        continue
    end

    % Time integration loop
    for j = 2:n
        dp = -m * (acc_signal(j) - acc_signal(j-1));
        rhs = dp + m*(a0*u(j-1) + a2*v(j-1) + a3*acc(j-1)) + ...
                   c*(a1*u(j-1) + a4*v(j-1) + a5*acc(j-1));
        du = rhs / keff;
        dv = a4*(du - u(j-1)) + a1*v(j-1) + a5*acc(j-1);
        da = a0*(du - u(j-1)) - a2*v(j-1) - a3*acc(j-1);
        u(j) = du;
        v(j) = dv;
        acc(j) = da;
    end

    % Save peak responses
    SD(i)  = max(abs(u));
    PSV(i) = max(abs(v));
    PSA(i) = max(abs(acc));
end

% Remove Inf/NaN values for plotting
valid_idx = ~isinf(PSA) & ~isnan(PSA) & ~isinf(PSV) & ~isnan(PSV) & ~isinf(SD) & ~isnan(SD);
periods_valid = periods(valid_idx);

% Plot Response Spectra
figure;

subplot(3,1,1);
plot(periods_valid, PSA(valid_idx), 'r', 'LineWidth', 1.5);
title('Response Spectrum - Spectral Acceleration (PSA)');
xlabel('Period (s)');
ylabel('Acceleration (m/s^2)');
grid on;

subplot(3,1,2);
plot(periods_valid, PSV(valid_idx), 'g', 'LineWidth', 1.5);
title('Response Spectrum - Spectral Velocity (PSV)');
xlabel('Period (s)');
ylabel('Velocity (m/s)');
grid on;

subplot(3,1,3);
plot(periods_valid, SD(valid_idx), 'b', 'LineWidth', 1.5);
title('Response Spectrum - Spectral Displacement (SD)');
xlabel('Period (s)');
ylabel('Displacement (m)');
grid on;

% Display peak values
fprintf('--- Response Spectrum (Preprocessed) ---\n');
fprintf('Max PSA: %.2f m/s²\n', max(PSA(valid_idx)));
fprintf('Max PSV: %.3f m/s\n', max(PSV(valid_idx)));
fprintf('Max SD : %.4f m\n', max(SD(valid_idx)));


% Step 17: Annotate P-wave and S-wave (Simplified - Manual Selection)

% Plot preprocessed acceleration for user to select points
figure;
plot(preprocesstime, preprocessacc, 'k', 'LineWidth', 1.2);
title('Click to Select P-wave and S-wave Arrival Times');
xlabel('Time (s)');
ylabel('Acceleration (m/s²)');
grid on;

% Let the user select two points: first P-wave, then S-wave
disp('Please click on the plot to select the P-wave arrival time...');
[p_x, ~] = ginput(1);
disp('Now click on the plot to select the S-wave arrival time...');
[s_x, ~] = ginput(1);

% Find closest time indices
[~, p_index] = min(abs(preprocesstime - p_x));
[~, s_index] = min(abs(preprocesstime - s_x));
p_time = preprocesstime(p_index);
s_time = preprocesstime(s_index);

% Annotated Plot with Selected Points
hold on;
xline(p_time, 'b--', 'LineWidth', 1.5);
xline(s_time, 'r--', 'LineWidth', 1.5);
plot(p_time, preprocessacc(p_index), 'bo', 'MarkerFaceColor', 'b');
plot(s_time, preprocessacc(s_index), 'ro', 'MarkerFaceColor', 'r');
text(p_time, preprocessacc(p_index), ' P-wave', 'Color', 'b', 'FontSize', 10, 'HorizontalAlignment', 'left');
text(s_time, preprocessacc(s_index), ' S-wave', 'Color', 'r', 'FontSize', 10, 'HorizontalAlignment', 'left');
legend('Preprocessed Acceleration', 'P-wave', 'S-wave');

% Zoomed-in view (optional)
figure;
t_start = max(0, p_time - 2);
t_end = min(preprocesstime(end), s_time + 2);
zoom_indices = preprocesstime >= t_start & preprocesstime <= t_end;

plot(preprocesstime(zoom_indices), preprocessacc(zoom_indices), 'k', 'LineWidth', 1.2);
hold on;
xline(p_time, 'b--', 'LineWidth', 1.5);
xline(s_time, 'r--', 'LineWidth', 1.5);
plot(p_time, preprocessacc(p_index), 'bo', 'MarkerFaceColor', 'b');
plot(s_time, preprocessacc(s_index), 'ro', 'MarkerFaceColor', 'r');
text(p_time, preprocessacc(p_index), ' P', 'Color', 'b', 'FontSize', 10, 'HorizontalAlignment', 'left');
text(s_time, preprocessacc(s_index), ' S', 'Color', 'r', 'FontSize', 10, 'HorizontalAlignment', 'left');
title('Zoomed-In View: Manually Selected P and S Wave Arrivals');
xlabel('Time (s)');
ylabel('Acceleration (m/s²)');
grid on;

% Print results to Command Window
fprintf('\n--- P and S Wave Manual Annotation ---\n');
fprintf('Selected P-wave arrival time: %.2f s\n', p_time);
fprintf('Selected S-wave arrival time: %.2f s\n', s_time);

