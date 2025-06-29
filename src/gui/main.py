# main.py — QStackedWidget version with WelcomePage

import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QStackedWidget
from page_welcome import WelcomePage  # 🆕 Eklendi
from page_event_select import EventSelectPage
from page_event_details import EventDetailsPage
from page_graphs import GraphsPage
from page_station_graphs import StationAnalysisPage

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("QuakeSense-Earthquake Analysis Tool")
        self.setGeometry(100, 100, 1200, 700)
        self.selected_event = None
        self.selected_event_row = None



        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)

        # 🆕 Sayfalar
        self.page0 = WelcomePage(self)  # Hoş Geldiniz Sayfası
        self.page1 = EventSelectPage(self)
        self.page2 = EventDetailsPage(self)
        self.page3 = GraphsPage(self)
        self.page4 = StationAnalysisPage(self)

        # 🆕 Stack'e sırayla ekle
        self.stack.addWidget(self.page0)
        self.stack.addWidget(self.page1)
        self.stack.addWidget(self.page2)
        self.stack.addWidget(self.page3)
        self.stack.addWidget(self.page4)

        self.stack.setCurrentIndex(0)  # Başlangıç sayfası = WelcomePage

    def go_to_page(self, index):
        self.stack.setCurrentIndex(index)

if __name__ == "__main__":
    app = QApplication(sys.argv)

    # Load style file if exists
    try:
        with open("style.qss", "r") as f:
            app.setStyleSheet(f.read())
    except Exception as e:
        print(f"Style load failed: {e}")

    window = MainWindow()
    window.show()
    sys.exit(app.exec_())