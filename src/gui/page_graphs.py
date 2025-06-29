from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QPushButton, QTextEdit, QHBoxLayout
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
import matplotlib.pyplot as plt
import numpy as np
import mplcursors
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPixmap
import os


class GraphsPage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window

        self.layout = QVBoxLayout()
        self.setLayout(self.layout)

        try:
            with open("style.qss", "r") as file:
                self.setStyleSheet(file.read())
        except Exception as e:
            print(f"Style load failed: {e}")

        # ✅ LOGO ekle (sol üstte 120x120)
        logo_layout = QHBoxLayout()
        logo_label = QLabel()
        logo_path = os.path.abspath("quakesense_logo.png")
        pixmap = QPixmap(logo_path).scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(pixmap)
        logo_label.setFixedSize(120, 120)
        logo_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        logo_layout.addWidget(logo_label)
        logo_layout.addStretch()
        self.layout.addLayout(logo_layout)

        self.title = QLabel("Graph Display")
        self.title.setObjectName("titleLabel")
        self.layout.addWidget(self.title)

        self.description_box = QTextEdit()
        self.description_box.setReadOnly(True)
        self.description_box.setObjectName("descriptionBox")
        self.description_box.setMinimumHeight(220)
        self.layout.addWidget(self.description_box)

        self.figure = plt.Figure(figsize=(10, 5))
        self.canvas = FigureCanvas(self.figure)
        self.layout.addWidget(self.canvas)

        self.station_button = QPushButton("→ Go to Station Analysis")
        self.station_button.setObjectName("stationButton")
        self.station_button.clicked.connect(self.go_to_station_page)
        self.layout.addWidget(self.station_button)

        self.back_button = QPushButton("← Back to Features")
        self.back_button.setObjectName("backButton")
        self.back_button.clicked.connect(lambda: self.main_window.go_to_page(2))
        self.layout.addWidget(self.back_button)

        footer = QLabel("© 2025 QuakeSense | Developed at Kadir Has University")
        footer.setObjectName("footerLabel")
        footer.setAlignment(Qt.AlignCenter)
        self.layout.addWidget(footer)

    def display_feature_graph(self, index):
        try:
            with open("descriptions.txt", "r", encoding="utf-8") as f:
                raw = f.read().strip()
            sections = [s.strip() for s in raw.split("###") if s.strip()]
            parsed = {i: (s.split("\n")[0], "\n".join(s.split("\n")[1:])) for i, s in enumerate(sections)}
        except Exception as e:
            print("Failed to load descriptions:", e)
            parsed = {}

        if index in parsed:
            self.title.setText(parsed[index][0])
            self.description_box.setText(parsed[index][1])

        self.figure.clf()
        ax = self.figure.add_subplot(111)

        time = np.linspace(0, 60, 6000)
        data = np.sin(2 * np.pi * 1.5 * time) * np.exp(-0.05 * time)
        cursor = None

        if index == 0:
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            try:
                raw_data = []
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                val = float(line)
                                raw_data.append(val)
                            except ValueError:
                                continue
                raw_signal = np.array(raw_data[:10500])
                if raw_signal.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            t = np.linspace(0, 105, len(raw_signal))
            preprocessed_signal = raw_signal * np.exp(-0.02 * t)

            raw_vel = np.cumsum(raw_signal) * 0.01
            pre_vel = np.cumsum(preprocessed_signal) * 0.01
            raw_disp = np.cumsum(raw_vel) * 0.01
            pre_disp = np.cumsum(pre_vel) * 0.01

            ax1 = self.figure.add_subplot(311)
            ax2 = self.figure.add_subplot(312, sharex=ax1)
            ax3 = self.figure.add_subplot(313, sharex=ax1)

            # FONT ayarı değişkeni (tek yerde kontrol et)
            label_fs = 8
            tick_fs = 7
            legend_fs = 7
            title_fs = 9

            # ✅ ACCELERATION
            ax1.plot(t, raw_signal, label="Raw", color="blue", linewidth=1)
            ax1.plot(t, preprocessed_signal, label="Preprocessed", color="red", linewidth=1)
            ax1.set_ylabel("Acceleration", fontsize=label_fs)
            ax1.set_title("Time vs Acceleration", fontsize=title_fs, pad=6)
            ax1.tick_params(axis='both', labelsize=tick_fs)
            ax1.legend(fontsize=legend_fs, loc="upper right")
            ax1.grid(True)
            ax1.annotate("cm/s²", xy=(-0.08, 0.5), xycoords='axes fraction', rotation=90, fontsize=6, va='center')

            # ✅ VELOCITY
            ax2.plot(t, raw_vel, label="Raw", color="blue", linewidth=1)
            ax2.plot(t, pre_vel, label="Preprocessed", color="red", linewidth=1)
            ax2.set_ylabel("Velocity", fontsize=label_fs)
            ax2.set_title("Time vs Velocity", fontsize=title_fs, pad=6)
            ax2.tick_params(axis='both', labelsize=tick_fs)
            ax2.legend(fontsize=legend_fs, loc="upper right")
            ax2.grid(True)
            ax2.annotate("cm/s", xy=(-0.08, 0.5), xycoords='axes fraction', rotation=90, fontsize=6, va='center')

            # ✅ DISPLACEMENT
            ax3.plot(t, raw_disp, label="Raw", color="blue", linewidth=1)
            ax3.plot(t, pre_disp, label="Preprocessed", color="red", linewidth=1)
            ax3.set_xlabel("Time (s)", fontsize=label_fs)
            ax3.set_ylabel("Displacement", fontsize=label_fs)
            ax3.set_title("Time vs Displacement", fontsize=title_fs, pad=6)
            ax3.tick_params(axis='both', labelsize=tick_fs)
            ax3.legend(fontsize=legend_fs, loc="upper right")
            ax3.grid(True)
            ax3.annotate("cm", xy=(-0.08, 0.5), xycoords='axes fraction', rotation=90, fontsize=6, va='center')

            # ✅ Genel boşluk ve hizalama
            self.figure.subplots_adjust(hspace=0.55, left=0.13, right=0.97, top=0.93, bottom=0.1)

            # Hover
            cursor = mplcursors.cursor(
                [ax1.lines[0], ax1.lines[1], ax2.lines[0], ax2.lines[1], ax3.lines[0], ax3.lines[1]],
                hover=True
            )
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))








        elif index == 1:
            # 🔁 MATLAB'ten gelen gerçek sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        try:
                            value = float(line.strip())
                            data.append(value)
                        except:
                            continue
                signal = np.array(data[:10000])  # İlk 10000 örnek
            except Exception as e:
                ax.text(0.5, 0.5, f"Failed to load .asc data:\n{e}", ha='center', va='center')
                self.canvas.draw()
                return

            # 📈 Fourier dönüşümü
            n = len(signal)
            sampling_rate = 200  # Eğer emin değilsen MATLAB kodundan kontrol et
            freq = np.fft.rfftfreq(n, d=1 / sampling_rate)
            fft_vals = np.abs(np.fft.rfft(signal)) / n
            fft_vals *= 2  # Tek taraflı spektrum ölçekleme

            # 🎨 Grafik çizimi
            line, = ax.plot(freq, fft_vals, color='black', linewidth=1.4)
            ax.set_title("Fourier Amplitude Spectrum", fontsize=14)
            ax.set_xlabel("Frequency (Hz)", fontsize=12)
            ax.set_ylabel("Amplitude", fontsize=12)
            ax.set_xlim(0, 50)
            ax.set_ylim(0, 1.5)
            ax.set_xticks(np.arange(0, 55, 5))
            ax.set_yticks(np.arange(0, 1.6, 0.5))
            ax.grid(True, linestyle='--', linewidth=0.5)

            cursor = mplcursors.cursor(line, hover=True)






        elif index == 2:
            # 🔁 MATLAB'ten gelen sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                value = float(line)
                                data.append(value)
                            except:
                                continue
                data = np.array(data[:10500])
                if data.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            # ⏱ Zaman vektörü oluştur
            time = np.linspace(0, 105, len(data))

            # ⚙️ Eşik değer kontrolü
            threshold = 0.05
            exceed = np.where(np.abs(data) > threshold)[0]

            # 🔠 Yazı boyutları
            label_fs = 9
            tick_fs = 8
            legend_fs = 8
            title_fs = 10

            # 🎨 Grafik çizimi
            if len(exceed) > 0:
                start, end = time[exceed[0]], time[exceed[-1]]
                ax.axvline(start, color="green", linestyle="--", label="Start", linewidth=1)
                ax.axvline(end, color="red", linestyle="--", label="End", linewidth=1)
                line, = ax.plot(time, data, color="black", linewidth=1)
                ax.set_title(f"Bracketed Duration: {end - start:.2f} s", fontsize=title_fs, pad=6)
            else:
                line, = ax.plot(time, data, color="black", linewidth=1)
                ax.set_title("No threshold exceedance", fontsize=title_fs, pad=6)

            ax.set_xlabel("Time (s)", fontsize=label_fs)
            ax.set_ylabel("Amplitude", fontsize=label_fs)
            ax.tick_params(axis='both', labelsize=tick_fs)
            ax.legend(fontsize=legend_fs)
            ax.grid(True, linestyle='--', linewidth=0.5)
            self.figure.subplots_adjust(left=0.1, right=0.98, top=0.9, bottom=0.12)

            cursor = mplcursors.cursor(line, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))


        elif index == 3:
            # 🔁 MATLAB'ten gelen sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                value = float(line)
                                data.append(value)
                            except:
                                continue
                data = np.array(data[:10500])
                if data.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            # 📈 Site frekansını hesapla
            fft_vals = np.abs(np.fft.rfft(data))
            freq = np.fft.rfftfreq(len(data), d=0.01)
            peak_freq = freq[np.argmax(fft_vals)]

            # 🎨 Grafik çizimi
            line, = ax.plot(freq, fft_vals, color="black", linewidth=1)
            ax.axvline(peak_freq, color="purple", linestyle="--", linewidth=1, label=f"Site Frequency: {peak_freq:.2f} Hz")

            # 🔠 Yazı boyutları
            label_fs = 9
            tick_fs = 8
            legend_fs = 8
            title_fs = 10

            ax.set_title("Site Frequency Estimate", fontsize=title_fs, pad=6)
            ax.set_xlabel("Frequency (Hz)", fontsize=label_fs)
            ax.set_ylabel("Amplitude", fontsize=label_fs)
            ax.tick_params(axis='both', labelsize=tick_fs)
            ax.legend(fontsize=legend_fs, loc="upper right")
            ax.grid(True, linestyle='--', linewidth=0.5)
            self.figure.subplots_adjust(left=0.1, right=0.98, top=0.9, bottom=0.12)

            cursor = mplcursors.cursor(line, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))


        elif index == 4:
            # 🔁 MATLAB'ten gelen sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                value = float(line)
                                data.append(value)
                            except:
                                continue
                data = np.array(data[:10500])
                if data.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            # ⏱ Zaman vektörü oluştur
            time = np.linspace(0, 105, len(data))

            # ⚙️ Arias Intensity hesapla
            ai = np.cumsum(data ** 2) * 0.01

            # 🔠 Yazı boyutları
            label_fs = 9
            tick_fs = 8
            title_fs = 10

            # 🎨 Grafik çizimi
            line, = ax.plot(time, ai, color="darkred", linewidth=1.4)
            ax.set_title("Arias Intensity", fontsize=title_fs, pad=6)
            ax.set_xlabel("Time (s)", fontsize=label_fs)
            ax.set_ylabel("Cumulative Energy", fontsize=label_fs)
            ax.tick_params(axis='both', labelsize=tick_fs)
            ax.grid(True, linestyle="--", linewidth=0.5)
            self.figure.subplots_adjust(left=0.1, right=0.98, top=0.9, bottom=0.12)

            cursor = mplcursors.cursor(line, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))


        elif index == 5:
            # 🔁 MATLAB'ten gelen sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                value = float(line)
                                data.append(value)
                            except:
                                continue
                data = np.array(data[:10500])
                if data.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            # 💡 Response Spectrum (simülasyon)
            periods = np.linspace(0.01, 4, 200)
            damping = 0.05  # 5% damping
            peak_acc = np.max(np.abs(data))
            response = np.exp(-damping * periods) * peak_acc  # Basit modelleme

            # ✏️ Font boyutları
            label_fs = 9
            tick_fs = 8
            title_fs = 10

            # 📈 Grafik çizimi
            line, = ax.plot(periods, response, color="darkblue", linewidth=1.4)
            ax.set_title("Response Spectrum", fontsize=title_fs, pad=6)
            ax.set_xlabel("Period (s)", fontsize=label_fs)
            ax.set_ylabel("Spectral Acceleration", fontsize=label_fs)
            ax.tick_params(axis='both', labelsize=tick_fs)
            ax.grid(True, linestyle="--", linewidth=0.5)
            self.figure.subplots_adjust(left=0.1, right=0.98, top=0.9, bottom=0.12)

            cursor = mplcursors.cursor(line, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))


        elif index == 6:
            # 🔁 MATLAB'ten gelen sinyali oku (.asc formatı)
            asc_path = os.path.abspath("20250413144302_0509_ap_RawAcc_E.asc")
            data = []
            try:
                with open(asc_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("EVENT_NAME"):
                            try:
                                value = float(line)
                                data.append(value)
                            except:
                                continue
                signal = np.array(data[:10500])
                if signal.size == 0:
                    raise ValueError("No valid numeric data found.")
            except Exception as e:
                ax.text(0.5, 0.5, f"Error loading .asc data:\n{e}", ha='center', va='center', fontsize=10)
                self.canvas.draw()
                return

            # ⏱ Zaman vektörü
            t = np.linspace(0, 105, len(signal))

            # ✏️ Font ayarları
            label_fs = 9
            tick_fs = 8
            title_fs = 10
            legend_fs = 8

            # 📈 Ana çizim
            line, = ax.plot(t, signal, color="darkblue", linewidth=1)
            ax.axvline(10, color="blue", linestyle="--", linewidth=1.2, label="P-wave")
            ax.axvline(18, color="orange", linestyle="--", linewidth=1.2, label="S-wave")

            ax.set_title("P and S Wave Annotation", fontsize=title_fs, pad=6)
            ax.set_xlabel("Time (s)", fontsize=label_fs)
            ax.set_ylabel("Acceleration", fontsize=label_fs)
            ax.tick_params(axis='both', labelsize=tick_fs)
            ax.legend(fontsize=legend_fs, loc="upper right")
            ax.grid(True, linestyle="--", linewidth=0.5)
            self.figure.subplots_adjust(left=0.1, right=0.97, top=0.9, bottom=0.12)

            cursor = mplcursors.cursor(line, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_fontsize(8))


        else:
            ax.text(0.5, 0.5, "Invalid Feature Index", ha="center", va="center")

        if cursor:
            cursor.connect("add", lambda sel: sel.annotation.set_text(f"time={sel.target[0]:.2f}\nvalue={sel.target[1]:.2f}"))

        self.canvas.draw()
    def go_to_station_page(self):
        try:
            event_id = self.main_window.selected_event_row["EventID"]
            print("🔁 Aktarilan event_id:", event_id)
            self.main_window.page4.set_event_id(event_id)
            self.main_window.go_to_page(4)
        except Exception as e:
            print("❌ Event ID could not take-ERROR:", e)

