from PyQt5.QtWidgets import QWidget, QVBoxLayout, QLabel, QLineEdit, QPushButton, QSpacerItem, QSizePolicy, QFrame, QListWidget, QListWidgetItem, QHBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPixmap
import os
import pandas as pd

class EventSelectPage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.init_ui()

    def init_ui(self):
        page_layout = QVBoxLayout()
        page_layout.setContentsMargins(80, 80, 80, 80)
        page_layout.setSpacing(20)
        page_layout.setAlignment(Qt.AlignTop)

        # ✅ Logo Header
        header_layout = QHBoxLayout()
        logo_label = QLabel()
        logo_path = os.path.abspath("quakesense_logo.png")
        pixmap = QPixmap(logo_path).scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(pixmap)
        logo_label.setFixedSize(120, 120)
        logo_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        header_layout.addWidget(logo_label)
        header_layout.addStretch()
        page_layout.addLayout(header_layout)

        # Kart
        card = QFrame()
        card.setObjectName("cardFrame")
        card.setMinimumHeight(500)
        card.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.layout = QVBoxLayout(card)
        self.layout.setSpacing(20)
        self.layout.setAlignment(Qt.AlignTop)

        self.title_label = QLabel("🌍 Earthquake Event Selection")
        self.title_label.setAlignment(Qt.AlignCenter)
        self.title_label.setObjectName("titleLabel")
        self.layout.addWidget(self.title_label)

        desc = QLabel("Select or enter an Event ID below to view details.")
        desc.setAlignment(Qt.AlignCenter)
        desc.setObjectName("descLabel")
        self.layout.addWidget(desc)

        self.event_id_input = QLineEdit()
        self.event_id_input.setPlaceholderText("e.g. 19990817_01")
        self.event_id_input.setFixedHeight(36)
        self.event_id_input.setObjectName("eventInput")
        self.event_id_input.textEdited.connect(self.hide_id_list)
        self.event_id_input.mousePressEvent = self.show_event_id_list
        self.layout.addWidget(self.event_id_input)

        # Load test IDs dynamically from CSV
        self.test_ids = self.load_event_ids()

        self.id_list_widget = QListWidget()
        self.id_list_widget.setObjectName("eventList")
        self.id_list_widget.setVisible(False)
        for eid in self.test_ids:
            item = QListWidgetItem(eid)
            self.id_list_widget.addItem(item)
        self.id_list_widget.itemClicked.connect(self.select_event_id)
        self.layout.addWidget(self.id_list_widget)

        self.back_button = QPushButton("← Back to Welcome")
        self.back_button.setFixedHeight(36)
        self.back_button.setObjectName("backButton")
        self.back_button.clicked.connect(lambda: self.main_window.go_to_page(0))
        self.layout.addWidget(self.back_button)

        self.next_button = QPushButton("Continue →")
        self.next_button.setFixedHeight(36)
        self.next_button.setObjectName("nextButton")
        self.next_button.clicked.connect(self.go_to_next_page)
        self.layout.addWidget(self.next_button)

        self.layout.addSpacerItem(QSpacerItem(20, 100, QSizePolicy.Minimum, QSizePolicy.Expanding))
        page_layout.addWidget(card)

        # ✅ Footer
        footer = QLabel("© 2025 QuakeSense | Developed at Kadir Has University")
        footer.setObjectName("footerLabel")
        footer.setAlignment(Qt.AlignCenter)
        page_layout.addWidget(footer)

        self.setLayout(page_layout)

    def load_event_ids(self):
        try:
            df = pd.read_csv("events.csv", encoding="utf-8")
            df['EventID'] = df['EventID'].astype(str).str.strip()
            return df['EventID'].dropna().tolist()
        except Exception as e:
            print(f"[ERROR] Failed to load Event IDs: {e}")
            return []

    def show_event_id_list(self, event):
        self.id_list_widget.setVisible(True)
        QLineEdit.mousePressEvent(self.event_id_input, event)

    def hide_id_list(self):
        self.id_list_widget.setVisible(False)

    def select_event_id(self, item):
        self.event_id_input.setText(item.text())
        self.id_list_widget.setVisible(False)
        self.go_to_next_page()

    def go_to_next_page(self):
        event_id = self.event_id_input.text().strip()
        if event_id:
            try:
                df = pd.read_csv("events.csv", encoding="utf-8")
                df['EventID'] = df['EventID'].astype(str).str.strip()
                row = df[df['EventID'] == event_id]
                if not row.empty:
                    self.main_window.selected_event_id = event_id
                    self.main_window.selected_event_row = row.iloc[0]
                    self.main_window.page2.display_event_details(self.main_window.selected_event_row)
                    self.main_window.go_to_page(2)
                else:
                    print(f"[WARN] Event ID '{event_id}' not found in CSV.")
            except Exception as e:
                print(f"[ERROR] Cannot load events.csv: {e}")
