import numpy as np
import pandas as pd
import os
from typing import Optional, Dict, List, Tuple
from file_utils import (
    get_event_files_by_direction, 
    find_file_for_station_direction,
    get_station_codes_for_event,
    discover_event_files
)
from config import MAX_SAMPLES, SAMPLING_RATE

class AFADDataLoader:
    def __init__(self):
        self.events_cache = {}
        self.stations_cache = {}
    
    def load_asc_file(self, filepath: str, max_samples: int = MAX_SAMPLES) -> Optional[np.ndarray]:
        """
        Load and parse .asc file containing earthquake data
        """
        if not os.path.exists(filepath):
            print(f"❌ File not found: {filepath}")
            return None
        
        try:
            data = []
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith(('EVENT_NAME', 'STATION', '#')):
                        try:
                            value = float(line)
                            data.append(value)
                        except ValueError:
                            continue
            
            if not data:
                print(f"⚠️ No valid numeric data found in {filepath}")
                return None
            
            # Limit samples if needed
            if max_samples and len(data) > max_samples:
                data = data[:max_samples]
            
            return np.array(data)
            
        except Exception as e:
            print(f"❌ Error loading {filepath}: {e}")
            return None
    
    def get_event_signal(self, event_id: str, direction: str = 'N', station_code: str = None) -> Optional[np.ndarray]:
        """
        Get earthquake signal for specific event and direction
        If station_code is provided, get data for that specific station
        Otherwise, get first available station
        """
        if station_code:
            filepath = find_file_for_station_direction(event_id, station_code, direction)
            if filepath:
                return self.load_asc_file(filepath)
        else:
            # Get first available file for this direction
            files = get_event_files_by_direction(event_id, direction)
            if files:
                return self.load_asc_file(files[0])
        
        return None
    
    def get_event_metadata(self, event_id: str) -> Dict:
        """
        Extract metadata from event ID and files
        """
        if not event_id:
            return {}
        
        # Parse event ID (format: YYYYMMDD_HHMMSS)
        try:
            if '_' in event_id:
                date_part, time_part = event_id.split('_')
                date = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"
                time = f"{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}"
            else:
                date = f"{event_id[:4]}-{event_id[4:6]}-{event_id[6:8]}"
                time = "Unknown"
        except:
            date = "Unknown"
            time = "Unknown"
        
        # Get available stations
        stations = get_station_codes_for_event(event_id)
        
        return {
            'EventID': event_id,
            'Date': date,
            'Time': time,
            'Province': 'Turkey',  # Default
            'District': 'Unknown',
            'Latitude': 39.0,  # Default Turkey center
            'Longitude': 35.0,
            'Magnitude': 'Unknown',
            'Depth': 'Unknown',
            'StationCount': len(stations),
            'Stations': stations
        }
    
    def get_all_events_dataframe(self) -> pd.DataFrame:
        """
        Generate events DataFrame from afad_downloads data
        """
        events = discover_event_files()
        events_list = []
        
        for event_id in events.keys():
            metadata = self.get_event_metadata(event_id)
            events_list.append(metadata)
        
        return pd.DataFrame(events_list)
    
    def get_stations_dataframe(self, event_id: str) -> pd.DataFrame:
        """
        Generate stations DataFrame for a specific event
        """
        stations = get_station_codes_for_event(event_id)
        stations_list = []
        
        for i, station_code in enumerate(stations):
            # Try to get a sample file to extract any metadata
            sample_file = find_file_for_station_direction(event_id, station_code, 'N')
            
            station_data = {
                'EventID': event_id,
                'Code': station_code,
                'Latitude': 39.0 + (i * 0.1),  # Mock coordinates
                'Longitude': 35.0 + (i * 0.1),
                'Province': 'Turkey',
                'District': f'District_{i+1}',
                'Litology': 'Unknown',
                'Vs30': 300,  # Default
                'Morphology': 'Unknown',
                'PGA_NS': 0.0,
                'PGA_EW': 0.0,
                'PGA_UD': 0.0
            }
            
            # Calculate PGA values if files exist
            for direction, pga_key in [('N', 'PGA_NS'), ('E', 'PGA_EW'), ('U', 'PGA_UD')]:
                signal = self.get_event_signal(event_id, direction, station_code)
                if signal is not None:
                    pga = np.max(np.abs(signal))
                    station_data[pga_key] = round(pga, 4)
            
            stations_list.append(station_data)
        
        return pd.DataFrame(stations_list)
    
    def get_time_vector(self, signal_length: int, sampling_rate: int = SAMPLING_RATE) -> np.ndarray:
        """
        Generate time vector for signal
        """
        dt = 1.0 / sampling_rate
        return np.arange(0, signal_length * dt, dt)[:signal_length]
    
    def validate_event_exists(self, event_id: str) -> bool:
        """
        Check if event exists in data
        """
        events = discover_event_files()
        return event_id in events

# Global instance
data_loader = AFADDataLoader()