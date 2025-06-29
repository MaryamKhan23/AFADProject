from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QPushButton
from PyQt5.QtCore import Qt, QUrl
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtGui import QPixmap
import os

class WelcomePage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.init_ui()

    def init_ui(self):
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(100, 40, 100, 60)
        outer_layout.setSpacing(0)

        # 🟦 LOGO (BÜYÜK VE ŞEFFAF)
        logo_label = QLabel()
        logo_path = os.path.abspath("quakesense_logo.png")
        pixmap = QPixmap(logo_path).scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(pixmap)
        logo_label.setAlignment(Qt.AlignCenter)
        logo_label.setStyleSheet("background: transparent; margin-bottom: 6px;")

        # 🟦 BAŞLIK
        title = QLabel("👋 Welcome to QuakeSense")
        title.setObjectName("titleLabel")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 26px; font-weight: bold; background: transparent;")

        outer_layout.addWidget(logo_label)
        outer_layout.addWidget(title)

        # 📋 AÇIKLAMA
        desc = QLabel("""<b>This application helps you analyze earthquake records using event IDs from the Turkish AFAD database.</b><br><br>
• View peak ground motion parameters<br>
• Explore Fourier spectra, response, duration and station data<br>
• Get graphs & interpretations<br><br>
Below is a dynamic earthquake activity map of Turkey.
""")
        desc.setWordWrap(True)
        desc.setAlignment(Qt.AlignTop)
        desc.setObjectName("descLabel")
        outer_layout.addWidget(desc)

        # 🗺️ HARİTA
        map_view = QWebEngineView()
        html_path = os.path.abspath("turkey_earthquake_map.html")
        map_view.setUrl(QUrl.fromLocalFile(html_path))
        map_view.setMinimumHeight(400)
        outer_layout.addWidget(map_view)

        # 🔘 BAŞLAT BUTONU
        start_button = QPushButton("→ Get Started")
        start_button.setObjectName("nextButton")
        start_button.clicked.connect(lambda: self.main_window.go_to_page(1))
        outer_layout.addWidget(start_button)

        # 🔻 FOOTER
        outer_layout.addStretch()
        footer = QLabel("© 2025 QuakeSense | Developed at Kadir Has University")
        footer.setObjectName("footerLabel")
        footer.setAlignment(Qt.AlignCenter)
        outer_layout.addWidget(footer)

        self.setLayout(outer_layout)
