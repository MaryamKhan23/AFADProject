import requests
import json
<<<<<<< Updated upstream

class EarthquakeAPI:
    def __init__(self, base_url="http://localhost:3001/api"):
        self.base_url = base_url
    
    def process_earthquake(self, file_path):
        """Process earthquake file using Node.js backend"""
        response = requests.post(f"{self.base_url}/process/earthquake", 
                               json={"filePath": file_path})
        return response.json()
    
    def get_results(self, event_id, station_id):
        """Get processing results from database"""
        response = requests.get(f"{self.base_url}/results/{event_id}/{station_id}")
        return response.json()
    
    def run_matlab_analysis(self, record_id):
        """Run MATLAB analysis on processed data"""
        response = requests.post(f"{self.base_url}/analysis/matlab",
                               json={"recordId": record_id})
        return response.json()
    
    def get_analysis_results(self, record_id):
        """Get MATLAB analysis results"""
        response = requests.get(f"{self.base_url}/analysis/{record_id}")
        return response.json()

# Global API client instance
api = EarthquakeAPI()
=======
from typing import Dict, List, Optional, Any
import numpy as np

class AFADAPIClient:
    """
    Client for communicating with Node.js backend API
    """
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """
        Make HTTP request to API
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=data)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.ConnectionError:
            print(f"⚠️ Cannot connect to API server at {self.base_url}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ API request failed: {e}")
            return None
        except json.JSONDecodeError:
            print("❌ Invalid JSON response from API")
            return None
    
    def health_check(self) -> bool:
        """
        Check if API server is running
        """
        result = self._make_request('GET', '/health')
        return result is not None and result.get('status') == 'ok'
    
    def get_available_events(self) -> List[str]:
        """
        Get list of available event IDs
        """
        result = self._make_request('GET', '/api/events')
        if result and 'events' in result:
            return result['events']
        return []
    
    def get_event_data(self, event_id: str) -> Optional[Dict]:
        """
        Get event metadata
        """
        return self._make_request('GET', f'/api/events/{event_id}')
    
    def get_signal_data(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Get processed signal data from API
        """
        params = {
            'direction': direction
        }
        if station_code:
            params['station'] = station_code
        
        endpoint = f'/api/events/{event_id}/signal'
        return self._make_request('GET', endpoint, params)
    
    def process_fourier_analysis(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Request Fourier analysis from API
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/fourier', data)
    
    def process_response_spectrum(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Request response spectrum analysis
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/response-spectrum', data)
    
    def calculate_pga_pgv_pgd(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Calculate Peak Ground Acceleration, Velocity, Displacement
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/pga-pgv-pgd', data)
    
    def calculate_arias_intensity(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Calculate Arias Intensity
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/arias-intensity', data)
    
    def get_bracketed_duration(self, event_id: str, station_code: str = None, direction: str = 'N', threshold: float = 0.05) -> Optional[Dict]:
        """
        Calculate bracketed duration
        """
        data = {
            'event_id': event_id,
            'direction': direction,
            'threshold': threshold
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/bracketed-duration', data)
    
    def get_site_frequency(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Estimate site frequency
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/site-frequency', data)
    
    def detect_wave_arrivals(self, event_id: str, station_code: str = None, direction: str = 'N') -> Optional[Dict]:
        """
        Detect P and S wave arrivals
        """
        data = {
            'event_id': event_id,
            'direction': direction
        }
        if station_code:
            data['station_code'] = station_code
        
        return self._make_request('POST', '/api/analysis/wave-arrivals', data)

# Global API client instance
api_client = AFADAPIClient()

# Fallback decorator for API calls
def with_fallback(fallback_func):
    """
    Decorator to provide fallback functionality when API is not available
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                # Try API first
                result = func(*args, **kwargs)
                if result is not None:
                    return result
            except Exception as e:
                print(f"API call failed, using fallback: {e}")
            
            # Use fallback
            return fallback_func(*args, **kwargs)
        return wrapper
    return decorator
>>>>>>> Stashed changes
