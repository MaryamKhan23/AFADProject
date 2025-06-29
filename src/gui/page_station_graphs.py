
from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QPushButton, QComboBox, QHBoxLayout
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtGui import QPixmap
import pandas as pd
import os
import time
from generate_station_map import generate_station_map


class StationAnalysisPage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.event_id = None
        self.init_ui()

    def init_ui(self):
        main_layout = QVBoxLayout(self)

        try:
            with open("style.qss", "r") as file:
                self.setStyleSheet(file.read())
        except Exception as e:
            print(f"Style load failed: {e}")

        logo_layout = QHBoxLayout()
        logo_label = QLabel()
        logo_path = os.path.abspath("quakesense_logo.png")
        pixmap = QPixmap(logo_path).scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(pixmap)
        logo_label.setFixedSize(120, 120)
        logo_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        logo_layout.addWidget(logo_label)
        logo_layout.addStretch()
        main_layout.addLayout(logo_layout)

        top_bar = QHBoxLayout()
        self.back_btn = QPushButton("← Back")
        self.back_btn.setObjectName("smallBackButton")
        self.back_btn.clicked.connect(lambda: self.main_window.go_to_page(3))
        top_bar.addWidget(self.back_btn)

        top_bar.addStretch()

        self.home_btn = QPushButton("⏮ Home")
        self.home_btn.setObjectName("smallHomeButton")
        self.home_btn.clicked.connect(lambda: self.main_window.go_to_page(1))
        top_bar.addWidget(self.home_btn)
        main_layout.addLayout(top_bar)

        title = QLabel("📡 Station-Based Analysis")
        title.setObjectName("titleLabel")
        main_layout.addWidget(title)

        self.station_label = QLabel("Select Station:")
        self.station_label.setObjectName("stationLabel")
        main_layout.addWidget(self.station_label)

        self.station_combo = QComboBox()
        self.station_combo.setObjectName("stationCombo")
        self.station_combo.currentIndexChanged.connect(self.display_station_info)
        main_layout.addWidget(self.station_combo)

        self.info_label = QLabel("Station information will be shown here.")
        self.info_label.setWordWrap(True)
        self.info_label.setObjectName("infoBox")
        main_layout.addWidget(self.info_label)

        self.map_view = QWebEngineView()
        self.map_view.setMinimumHeight(400)
        main_layout.addWidget(self.map_view)

        footer = QLabel("© 2025 QuakeSense | Developed at Kadir Has University")
        footer.setObjectName("footerLabel")
        footer.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(footer)

    def set_event_id(self, event_id):
        from PyQt5.QtCore import QUrl
        import time

        self.event_id = event_id
        html_path = os.path.abspath("station_map.html")
        if os.path.exists(html_path):
            try:
                os.remove(html_path)
            except Exception as e:
                print("Harita silinemedi:", e)

        generate_station_map(event_id)
        time.sleep(0.2)

        self.load_station_data(event_id=event_id)

        self.station_combo.blockSignals(True)
        self.station_combo.clear()

        if not self.station_df.empty:
            codes = self.station_df['Code'].astype(str).unique().tolist()
            codes = [c.strip() for c in codes if c.strip()]
            self.station_combo.addItems(codes)
            self.station_combo.blockSignals(False)
            self.station_combo.setCurrentIndex(0)
            self.display_station_info()
        else:
            self.info_label.setText("No station data found for this event.")
            self.map_view.setHtml("<h3>No map available</h3>")

        self.map_view.setUrl(QUrl.fromLocalFile(html_path))
        self.map_view.reload()

    def load_station_data(self, event_id=None, path='stations.csv'):
        try:
            self.station_df = pd.read_csv(path)
            self.station_df.dropna(subset=['Code'], inplace=True)

            if event_id:
                self.station_df = self.station_df[self.station_df['EventID'].astype(str) == str(event_id)]

        except Exception as e:
            self.info_label.setText(f"Error loading station data: {e}")
            self.station_df = pd.DataFrame()

    def display_station_info(self):
        if not hasattr(self, 'station_df'):
            return

        current_code = self.station_combo.currentText()
        row = self.station_df[self.station_df['Code'].astype(str) == current_code]
        if not row.empty:
            info = row.iloc[0]
            text = (
                f"<b>Station Code:</b> {info['Code']}<br>"
                f"<b>Location:</b> {info['Latitude']}°N, {info['Longitude']}°E<br>"
                f"<b>Province/District:</b> {info['Province']}, {info['District']}<br><br>"
                f"<b>Geological Info:</b><br>"
                f"• Lithology: {info['Litology']}<br>"
                f"• Vs30: {info['Vs30']} m/s<br>"
                f"• Morphology: {info['Morphology']}<br><br>"
                f"<b>Peak Ground Accelerations:</b><br>"
                f"• PGA_NS: {info['PGA_NS']} g<br>"
                f"• PGA_EW: {info['PGA_EW']} g<br>"
                f"• PGA_UD: {info['PGA_UD']} g"
            )
            self.info_label.setText(text)
            self.info_label.setTextFormat(1)
        else:
            self.info_label.setText("No data available for the selected station.")
