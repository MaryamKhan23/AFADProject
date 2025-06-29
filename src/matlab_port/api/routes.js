const express = require('express');
const APIHandlers = require('./handlers');

class APIRoutes {
    constructor() {
        this.router = express.Router();
        this.handlers = new APIHandlers();
        this.setupRoutes();
    }

    setupRoutes() {
        // Health check
        this.router.get('/health', this.handlers.healthCheck.bind(this.handlers));

        // Event-related routes
        this.router.get('/events', this.handlers.getEvents.bind(this.handlers));
        this.router.get('/events/:eventId', this.handlers.getEventData.bind(this.handlers));
        this.router.get('/events/:eventId/stations', this.handlers.getEventStations.bind(this.handlers));

        // Station data routes
        this.router.get('/stations/:eventId/:stationCode/:direction', 
            this.handlers.getStationData.bind(this.handlers));

        // Signal processing routes
        this.router.post('/analysis/process', 
            this.handlers.processSignalAnalysis.bind(this.handlers));

        // Batch processing routes
        this.router.post('/analysis/batch', this.batchAnalysis.bind(this));

        // Data validation routes
        this.router.get('/validate/:eventId', this.validateEventData.bind(this));

        // File management routes
        this.router.get('/files/:eventId', this.getEventFiles.bind(this));
        this.router.get('/files/:eventId/:stationCode', this.getStationFiles.bind(this));
    }

    // Additional route handlers
    async batchAnalysis(req, res) {
        try {
            const { eventId, analysisTypes, stationCodes } = req.body;
            
            if (!eventId || !analysisTypes || !Array.isArray(analysisTypes)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required parameters: eventId, analysisTypes'
                });
            }

            const results = {};
            const stations = stationCodes || await this.getAvailableStations(eventId);

            for (const stationCode of stations) {
                results[stationCode] = {};
                
                // Process each direction (E, N, U)
                for (const direction of ['E', 'N', 'U']) {
                    try {
                        const stationResults = {};
                        
                        for (const analysisType of analysisTypes) {
                            const analysisResult = await this.handlers.processSignalAnalysis({
                                body: { eventId, stationCode, direction, analysisType }
                            }, { json: (data) => data });
                            
                            if (analysisResult.success) {
                                stationResults[analysisType] = analysisResult.result;
                            }
                        }
                        
                        results[stationCode][direction] = stationResults;
                        
                    } catch (directionError) {
                        console.warn(`Skipping ${stationCode}_${direction}:`, directionError.message);
                        results[stationCode][direction] = { error: directionError.message };
                    }
                }
            }

            res.json({
                success: true,
                eventId,
                analysisTypes,
                results
            });

        } catch (error) {
            console.error('Batch analysis error:', error);
            res.status(500).json({
                success: false,
                error: 'Batch analysis failed',
                details: error.message
            });
        }
    }

    async validateEventData(req, res) {
        try {
            const { eventId } = req.params;
            const validation = {
                eventId,
                valid: true,
                stations: {},
                summary: {
                    totalStations: 0,
                    validStations: 0,
                    missingDirections: [],
                    corruptedFiles: []
                }
            };

            const eventData = await this.handlers.getEventData({ params: { eventId } }, {
                json: (data) => data,
                status: () => ({ json: (data) => data })
            });

            if (!eventData.success) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
            }

            for (const station of eventData.stations) {
                const stationCode = station.stationCode;
                validation.stations[stationCode] = {
                    valid: true,
                    directions: station.directions,
                    missingDirections: [],
                    issues: []
                };

                // Check for all three directions
                const expectedDirections = ['E', 'N', 'U'];
                for (const dir of expectedDirections) {
                    if (!station.directions.includes(dir)) {
                        validation.stations[stationCode].missingDirections.push(dir);
                        validation.summary.missingDirections.push(`${stationCode}_${dir}`);
                    }
                }

                // Validate data quality
                for (const direction of station.directions) {
                    const fileData = station.files[direction];
                    if (!fileData || !fileData.data || fileData.data.length === 0) {
                        validation.stations[stationCode].issues.push(`Empty data in ${direction}`);
                        validation.summary.corruptedFiles.push(`${stationCode}_${direction}`);
                    }
                }

                if (validation.stations[stationCode].missingDirections.length > 0 || 
                    validation.stations[stationCode].issues.length > 0) {
                    validation.stations[stationCode].valid = false;
                    validation.valid = false;
                } else {
                    validation.summary.validStations++;
                }

                validation.summary.totalStations++;
            }

            res.json({
                success: true,
                validation
            });

        } catch (error) {
            console.error('Validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Validation failed',
                details: error.message
            });
        }
    }

    async getEventFiles(req, res) {
        try {
            const { eventId } = req.params;
            const fs = require('fs').promises;
            const path = require('path');
            
            const dataDir = path.join(__dirname, '../../../afad_downloads/data');
            const files = await fs.readdir(dataDir);
            
            const eventFiles = files
                .filter(file => file.startsWith(eventId) && file.endsWith('.asc'))
                .map(file => {
                    const parts = file.split('_');
                    return {
                        filename: file,
                        eventId: `${parts[0]}_${parts[1]}`,
                        stationCode: parts[2],
                        direction: parts[3].replace('.asc', ''),
                        path: path.join(dataDir, file)
                    };
                });

            res.json({
                success: true,
                eventId,
                files: eventFiles,
                count: eventFiles.length
            });

        } catch (error) {
            console.error('Error getting event files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get event files',
                details: error.message
            });
        }
    }

    async getStationFiles(req, res) {
        try {
            const { eventId, stationCode } = req.params;
            const fs = require('fs').promises;
            const path = require('path');
            
            const dataDir = path.join(__dirname, '../../../afad_downloads/data');
            const files = await fs.readdir(dataDir);
            
            const stationFiles = files
                .filter(file => 
                    file.startsWith(eventId) && 
                    file.includes(`_${stationCode}_`) && 
                    file.endsWith('.asc')
                )
                .map(file => {
                    const parts = file.split('_');
                    return {
                        filename: file,
                        direction: parts[3].replace('.asc', ''),
                        path: path.join(dataDir, file)
                    };
                });

            res.json({
                success: true,
                eventId,
                stationCode,
                files: stationFiles,
                directions: stationFiles.map(f => f.direction)
            });

        } catch (error) {
            console.error('Error getting station files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get station files',
                details: error.message
            });
        }
    }

    async getAvailableStations(eventId) {
        const fs = require('fs').promises;
        const path = require('path');
        
        const dataDir = path.join(__dirname, '../../../afad_downloads/data');
        const files = await fs.readdir(dataDir);
        
        const stations = new Set();
        
        for (const file of files) {
            if (file.startsWith(eventId) && file.endsWith('.asc')) {
                const parts = file.split('_');
                if (parts.length >= 3) {
                    stations.add(parts[2]);
                }
            }
        }
        
        return Array.from(stations);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = APIRoutes;