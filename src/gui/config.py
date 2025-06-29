import os

# Project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# AFAD data paths
AFAD_DOWNLOADS_PATH = os.path.join(PROJECT_ROOT, "afad_downloads", "data")

# File patterns for different directions
DIRECTION_PATTERNS = {
    'E': '_E.asc',
    'N': '_N.asc', 
    'U': '_U.asc'
}

# Default direction for analysis
DEFAULT_DIRECTION = 'N'

# GUI paths
GUI_PATH = os.path.join(PROJECT_ROOT, "src", "gui")
ASSETS_PATH = GUI_PATH

# Output paths
OUTPUT_HTML_PATH = os.path.join(GUI_PATH, "station_map.html")
TURKEY_MAP_PATH = os.path.join(GUI_PATH, "turkey_earthquake_map.html")

# Data processing settings
SAMPLING_RATE = 200  # Hz
MAX_SAMPLES = 10500