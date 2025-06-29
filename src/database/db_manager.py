#db_manager.py
from pymongo import MongoClient
import logging
from typing import Dict, List, Optional, Any
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DatabaseManager:
    """
    Manages database connections and operations for earthquake data using MongoDB Atlas.
    """
    
    def __init__(self, connection_string: Optional[str] = None):
        """
        Initialize the database manager with a MongoDB connection.
        
        Args:
            connection_string: MongoDB Atlas connection string. If None, uses MONGODB_URI from environment.
        """
        self.logger = logging.getLogger(__name__)
        
        # Get connection string from environment variable if not provided
        if connection_string is None:
            connection_string = os.getenv("MONGODB_URI")
            if not connection_string:
                raise ValueError("MongoDB connection string not provided and MONGODB_URI environment variable not set")
        
        try:
            self.client = MongoClient(connection_string)
            self.db = self.client["earthquake_data"]
            self.earthquake_collection = self.db["earthquakes"]
            self.station_collection = self.db["stations"]
            self.records_collection = self.db["acceleration_records"]
            self.logger.info("Successfully connected to MongoDB Atlas")
        except Exception as e:
            self.logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    
    def insert_earthquake(self, earthquake_data: Dict[str, Any]) -> str:
        """
        Insert earthquake data into the database.
        
        Args:
            earthquake_data: Dictionary containing earthquake information
            
        Returns:
            The ID of the inserted document
        """
        try:
            result = self.earthquake_collection.insert_one(earthquake_data)
            self.logger.info(f"Inserted earthquake with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            self.logger.error(f"Error inserting earthquake data: {str(e)}")
            raise
    
    def insert_station(self, station_data: Dict[str, Any]) -> str:
        """
        Insert station data into the database.
        
        Args:
            station_data: Dictionary containing station information
            
        Returns:
            The ID of the inserted document
        """
        try:
            result = self.station_collection.insert_one(station_data)
            self.logger.info(f"Inserted station with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            self.logger.error(f"Error inserting station data: {str(e)}")
            raise
    
    def insert_acceleration_record(self, record_data: Dict[str, Any]) -> str:
        """
        Insert acceleration record data into the database.
        
        Args:
            record_data: Dictionary containing acceleration record data
            
        Returns:
            The ID of the inserted document
        """
        try:
            result = self.records_collection.insert_one(record_data)
            self.logger.info(f"Inserted acceleration record with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            self.logger.error(f"Error inserting acceleration record: {str(e)}")
            raise
    
    def find_earthquakes(self, query: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
        """
        Search for earthquakes matching the query.
        
        Args:
            query: Dictionary with search parameters
            limit: Maximum number of results to return
            
        Returns:
            List of matching earthquake documents
        """
        try:
            cursor = self.earthquake_collection.find(query).limit(limit)
            return list(cursor)
        except Exception as e:
            self.logger.error(f"Error searching earthquakes: {str(e)}")
            raise
    
    def find_earthquake_by_id(self, earthquake_id: str) -> Optional[Dict[str, Any]]:
        """
        Find an earthquake by its ID.
        
        Args:
            earthquake_id: The ID of the earthquake
            
        Returns:
            The earthquake document or None if not found
        """
        from bson.objectid import ObjectId
        try:
            return self.earthquake_collection.find_one({"_id": ObjectId(earthquake_id)})
        except Exception as e:
            self.logger.error(f"Error finding earthquake by ID: {str(e)}")
            raise
    
    def find_stations_by_earthquake(self, earthquake_id: str) -> List[Dict[str, Any]]:
        """
        Find all stations that recorded a specific earthquake.
        
        Args:
            earthquake_id: The ID of the earthquake
            
        Returns:
            List of station documents
        """
        try:
            return list(self.station_collection.find({"earthquake_id": earthquake_id}))
        except Exception as e:
            self.logger.error(f"Error finding stations for earthquake: {str(e)}")
            raise
    
    def find_acceleration_records(self, station_id: str, earthquake_id: str) -> Optional[Dict[str, Any]]:
        """
        Find acceleration records for a specific station and earthquake.
        
        Args:
            station_id: The ID of the station
            earthquake_id: The ID of the earthquake
            
        Returns:
            The acceleration record document or None if not found
        """
        try:
            return self.records_collection.find_one({
                "station_id": station_id,
                "earthquake_id": earthquake_id
            })
        except Exception as e:
            self.logger.error(f"Error finding acceleration records: {str(e)}")
            raise
    
    def search_earthquakes_by_parameters(self, 
                                         min_magnitude: Optional[float] = None,
                                         max_magnitude: Optional[float] = None,
                                         start_date: Optional[str] = None,
                                         end_date: Optional[str] = None,
                                         region: Optional[str] = None,
                                         depth_min: Optional[float] = None,
                                         depth_max: Optional[float] = None,
                                         limit: int = 100) -> List[Dict[str, Any]]:
        """
        Search for earthquakes based on various parameters.
        
        Args:
            min_magnitude: Minimum magnitude
            max_magnitude: Maximum magnitude
            start_date: Start date (format: YYYY-MM-DD)
            end_date: End date (format: YYYY-MM-DD)
            region: Region name
            depth_min: Minimum depth
            depth_max: Maximum depth
            limit: Maximum results to return
            
        Returns:
            List of matching earthquake documents
        """
        query = {}
        
        # Add magnitude constraints if provided
        if min_magnitude is not None or max_magnitude is not None:
            query["magnitude"] = {}
            if min_magnitude is not None:
                query["magnitude"]["$gte"] = min_magnitude
            if max_magnitude is not None:
                query["magnitude"]["$lte"] = max_magnitude
        
        # Add date constraints if provided
        if start_date is not None or end_date is not None:
            query["date"] = {}
            if start_date is not None:
                query["date"]["$gte"] = start_date
            if end_date is not None:
                query["date"]["$lte"] = end_date
        
        # Add region constraint if provided
        if region is not None:
            query["region"] = region
            
        # Add depth constraints if provided
        if depth_min is not None or depth_max is not None:
            query["depth"] = {}
            if depth_min is not None:
                query["depth"]["$gte"] = depth_min
            if depth_max is not None:
                query["depth"]["$lte"] = depth_max
        
        return self.find_earthquakes(query, limit)
    
    def close(self):
        """Close the MongoDB connection."""
        if hasattr(self, 'client'):
            self.client.close()
            self.logger.info("MongoDB connection closed")