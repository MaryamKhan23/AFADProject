const fs = require('fs').promises;
const path = require('path');

class APIHandlers {
    constructor() {
        this.afadDataPath = path.join(__dirname, '../../../afad_downloads/data');
    }

    // Get list of available events from afad_downloads
    async getEvents(req, res) {
        try {
            const dataDir = this.afadDataPath;
            const files = await fs.readdir(dataDir);
            
            // Group files by event ID (files follow pattern: YYYYMMDD_HHMMSS_STATIONCODE_DIRECTION.asc)
            const eventMap = new Map();
            
            for (const file of files) {
                if (file.endsWith('.asc')) {
                    const parts = file.split('_');
                    if (parts.length >= 4) {
                        const eventId = `${parts[0]}_${parts[1]}`;
                        const stationCode = parts[2];
                        const direction = parts[3].replace('.asc', '');
                        
                        if (!eventMap.has(eventId)) {
                            eventMap.set(eventId, {
                                eventId,
                                date: this.formatDate(parts[0]),
                                time: this.formatTime(parts[1]),
                                stations: new Set(),
                                files: []
                            });
                        }
                        
                        const event = eventMap.get(eventId);
                        event.stations.add(stationCode);
                        event.files.push({
                            filename: file,
                            station: stationCode,
                            direction: direction,
                            path: path.join(dataDir, file)
                        });
                    }
                }
            }
            
            // Convert to array and add metadata
            const events = Array.from(eventMap.values()).map(event => ({
                ...event,
                stations: Array.from(event.stations),
                stationCount: event.stations.length
            }));
            
            res.json({
                success: true,
                events: events.sort((a, b) => b.eventId.localeCompare(a.eventId))
            });
            
        } catch (error) {
            console.error('Error getting events:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load events',
                details: error.message
            });
        }
    }

    // Get specific event data with all station files
    async getEventData(req, res) {
        try {
            const { eventId } = req.params;
            const dataDir = this.afadDataPath;
            const files = await fs.readdir(dataDir);
            
            const eventFiles = files.filter(file => 
                file.startsWith(eventId) && file.endsWith('.asc')
            );
            
            if (eventFiles.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
            }
            
            const stationData = {};
            
            for (const file of eventFiles) {
                const parts = file.split('_');
                const stationCode = parts[2];
                const direction = parts[3].replace('.asc', '');
                
                if (!stationData[stationCode]) {
                    stationData[stationCode] = {
                        stationCode,
                        files: {},
                        directions: []
                    };
                }
                
                const filePath = path.join(dataDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = this.parseAscFile(content);
                
                stationData[stationCode].files[direction] = {
                    filename: file,
                    data: data,
                    path: filePath
                };
                stationData[stationCode].directions.push(direction);
            }
            
            res.json({
                success: true,
                eventId,
                stations: Object.values(stationData)
            });
            
        } catch (error) {
            console.error('Error getting event data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load event data',
                details: error.message
            });
        }
    }

    // Get station data for a specific event and station
    async getStationData(req, res) {
        try {
            const { eventId, stationCode, direction } = req.params;
            const filename = `${eventId}_${stationCode}_${direction}.asc`;
            const filePath = path.join(this.afadDataPath, filename);
            
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const data = this.parseAscFile(content);
                
                res.json({
                    success: true,
                    eventId,
                    stationCode,
                    direction,
                    data: data,
                    filename
                });
                
            } catch (fileError) {
                res.status(404).json({
                    success: false,
                    error: 'Station data file not found',
                    filename
                });
            }
            
        } catch (error) {
            console.error('Error getting station data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load station data',
                details: error.message
            });
        }
    }

    // Process signal analysis for a station
    async processSignalAnalysis(req, res) {
        try {
            const { eventId, stationCode, direction, analysisType } = req.body;
            
            // Get the raw data
            const filename = `${eventId}_${stationCode}_${direction}.asc`;
            const filePath = path.join(this.afadDataPath, filename);
            const content = await fs.readFile(filePath, 'utf-8');
            const rawData = this.parseAscFile(content);
            
            // Import signal processing modules
            const { SignalProcessor } = require('../signal_processing/analysis');
            const processor = new SignalProcessor();
            
            let result;
            
            switch (analysisType) {
                case 'pga_pgv_pgd':
                    result = processor.calculatePeakGroundMotion(rawData);
                    break;
                case 'fourier':
                    result = processor.fourierTransform(rawData);
                    break;
                case 'bracketed_duration':
                    result = processor.bracketedDuration(rawData, 0.05);
                    break;
                case 'site_frequency':
                    result = processor.siteFrequency(rawData);
                    break;
                case 'arias_intensity':
                    result = processor.ariasIntensity(rawData);
                    break;
                case 'response_spectrum':
                    result = processor.responseSpectrum(rawData);
                    break;
                case 'wave_annotation':
                    result = processor.waveAnnotation(rawData);
                    break;
                default:
                    throw new Error(`Unknown analysis type: ${analysisType}`);
            }
            
            res.json({
                success: true,
                analysisType,
                eventId,
                stationCode,
                direction,
                result
            });
            
        } catch (error) {
            console.error('Error processing signal analysis:', error);
            res.status(500).json({
                success: false,
                error: 'Signal processing failed',
                details: error.message
            });
        }
    }

    // Get available stations for an event
    async getEventStations(req, res) {
        try {
            const { eventId } = req.params;
            const dataDir = this.afadDataPath;
            const files = await fs.readdir(dataDir);
            
            const stationSet = new Set();
            const stationData = {};
            
            for (const file of files) {
                if (file.startsWith(eventId) && file.endsWith('.asc')) {
                    const parts = file.split('_');
                    const stationCode = parts[2];
                    const direction = parts[3].replace('.asc', '');
                    
                    stationSet.add(stationCode);
                    
                    if (!stationData[stationCode]) {
                        stationData[stationCode] = {
                            code: stationCode,
                            directions: [],
                            files: []
                        };
                    }
                    
                    stationData[stationCode].directions.push(direction);
                    stationData[stationCode].files.push(file);
                }
            }
            
            res.json({
                success: true,
                eventId,
                stations: Object.values(stationData),
                stationCodes: Array.from(stationSet).sort()
            });
            
        } catch (error) {
            console.error('Error getting event stations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load station data',
                details: error.message
            });
        }
    }

    // Utility functions
    parseAscFile(content) {
        const lines = content.split('\n');
        const data = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('EVENT_NAME') && !isNaN(parseFloat(trimmed))) {
                data.push(parseFloat(trimmed));
            }
        }
        
        return data;
    }

    formatDate(dateStr) {
        // Convert YYYYMMDD to YYYY-MM-DD
        if (dateStr.length === 8) {
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        return dateStr;
    }

    formatTime(timeStr) {
        // Convert HHMMSS to HH:MM:SS
        if (timeStr.length === 6) {
            return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
        }
        return timeStr;
    }

    // Health check endpoint
    async healthCheck(req, res) {
        try {
            const dataDir = this.afadDataPath;
            const stats = await fs.stat(dataDir);
            const files = await fs.readdir(dataDir);
            const ascFiles = files.filter(f => f.endsWith('.asc'));
            
            res.json({
                success: true,
                status: 'healthy',
                dataDirectory: dataDir,
                totalFiles: files.length,
                ascFiles: ascFiles.length,
                lastModified: stats.mtime
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

module.exports = APIHandlers;