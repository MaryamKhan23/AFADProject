from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QPushButton, QFrame, QScrollArea, QSizePolicy, QHBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPixmap
import os

class EventDetailsPage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window

        try:
            with open("style.qss", "r") as file:
                self.setStyleSheet(file.read())
        except Exception as e:
            print(f"Style load failed: {e}")

        self.init_ui()

    def init_ui(self):
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)

        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(40, 40, 40, 40)
        content_layout.setSpacing(28)

        # ✅ Logo header
        header_layout = QHBoxLayout()
        logo_label = QLabel()
        logo_path = os.path.abspath("quakesense_logo.png")
        pixmap = QPixmap(logo_path).scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(pixmap)
        logo_label.setFixedSize(120, 120)
        logo_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        header_layout.addWidget(logo_label)
        header_layout.addStretch()
        content_layout.addLayout(header_layout)

        scroll_area.setWidget(content_widget)

        self.container = QFrame()
        self.container.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Maximum)
        self.layout = QVBoxLayout(self.container)
        self.layout.setSpacing(24)

        # 📘 General Info Box
        self.general_box = self.create_info_box("📘 General Information", [
            "📅 Date: -",
            "⏰ Time: -",
            "📍 Location: -",
            "🌍 Magnitude / Depth: -",
            "🏛️ Province / District: -"
        ])
        self.general_box.setMinimumHeight(240)
        self.general_box.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.layout.addWidget(self.general_box)

        # 🧩 Features Title
        self.features_title = QLabel("🧩 Features")
        self.features_title.setObjectName("titleLabel")
        self.features_title.setStyleSheet("margin-top: 12px;")
        self.layout.addWidget(self.features_title)

        # Feature List
        features = [
            ("1. Peak Ground Acceleration, Peak Ground Velocity, Peak Ground Displacement",
             "PGA: Maximum ground acceleration during the earthquake.\nPGV: Highest speed of ground motion.\nPGD: Maximum ground shift from the original position."),
            ("2. Fourier Transform of Earthquake Signals (Fourier Amplitude Spectra and Phase)",
             "Fourier Transform: Converts the signal to frequency domain.\nAmplitude Spectrum: Strength of each frequency.\nPhase Spectrum: Timing of those frequencies."),
            ("3. Bracketed Duration",
             "Time between first and last exceedance of a threshold (e.g., 0.05g). Reflects shaking duration."),
            ("4. Site Frequency",
             "Natural vibration frequency of the soil. Used to assess resonance risks with buildings."),
            ("5. Arias Intensity",
             "Total energy of ground motion. Helps evaluate potential for structural damage."),
            ("6. Response Spectra",
             "Shows how different structures (with various natural periods) would respond to the earthquake."),
            ("7. P wave, S wave Annotation",
             "Marks arrival times of fast P-waves and slower S-waves. Important for timing and location analysis.")
        ]

        for index, (title, tip) in enumerate(features):
            label = QLabel(title)
            label.setToolTip(tip)
            label.setCursor(Qt.PointingHandCursor)
            label.setObjectName("featureLabel")
            label.mousePressEvent = lambda e, idx=index: self.open_graph(idx)
            label.setMinimumHeight(50)  # ✅ Aynı yükseklik
            label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)  # ✅ Aynı genişlik
            self.layout.addWidget(label)

        # Back Button
        self.back_btn = QPushButton("← Back to Event Selection")
        self.back_btn.clicked.connect(lambda: self.main_window.go_to_page(1))
        self.back_btn.setObjectName("backButton")
        self.layout.addWidget(self.back_btn)

        # 📎 Footer
        footer = QLabel("© 2025 QuakeSense | Developed at Kadir Has University")
        footer.setObjectName("footerLabel")
        footer.setAlignment(Qt.AlignCenter)
        self.layout.addWidget(footer)

        content_layout.addWidget(self.container)
        page_layout = QVBoxLayout(self)
        page_layout.addWidget(scroll_area)

    def open_graph(self, index):
        self.main_window.page3.display_feature_graph(index)
        self.main_window.go_to_page(3)

    def create_info_box(self, title, items):
        frame = QFrame()
        layout = QVBoxLayout()
        layout.setSpacing(10)

        header = QLabel(f"<b>{title}</b>")
        header.setWordWrap(True)
        header.setObjectName("infoHeader")
        layout.addWidget(header)

        for item in items:
            lbl = QLabel(item)
            lbl.setWordWrap(True)
            lbl.setObjectName("infoItem")
            layout.addWidget(lbl)

        frame.setLayout(layout)
        frame.setObjectName("infoBox")
        frame.setMinimumHeight(240)  # ✅ Feature kutularıyla hizalı
        return frame

    def display_event_details(self, row):
        try:
            if isinstance(row, str):
                return
            if hasattr(row, 'to_dict'):
                row = row.to_dict()
            self.general_box.layout().itemAt(1).widget().setText(f"📅 Date: {row.get('Date', '-')}")
            self.general_box.layout().itemAt(2).widget().setText(f"⏰ Time: {row.get('Time', '-')}")
            self.general_box.layout().itemAt(3).widget().setText(f"📍 Location: {row.get('Latitude', '-')}°N, {row.get('Longitude', '-')}°E")
            self.general_box.layout().itemAt(4).widget().setText(f"🌍 Magnitude / Depth: {row.get('Magnitude', '-')} | {row.get('Depth', '-')} km")
            self.general_box.layout().itemAt(5).widget().setText(f"🏛️ Province / District: {row.get('Province', '-')} / {row.get('District', '-')}")
        except Exception as e:
            error_label = QLabel(f"⚠️ Error displaying event: {str(e)}")
            error_label.setObjectName("errorLabel")
            self.layout.insertWidget(0, error_label)
