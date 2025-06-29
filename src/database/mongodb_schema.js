
db.createCollection("earthquake_records", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["event_info", "station_info", "recording_info", "processing_info", "acceleration_data", "data_metadata", "calculated_parameters", "metadata"],
      properties: {
        event_info: {
          bsonType: "object",
          required: ["event_name", "event_id", "event_date", "event_time", "event_datetime", "latitude", "longitude", "depth_km", "hypocenter_reference", "magnitude_w", "magnitude_w_reference", "magnitude_l", "magnitude_l_reference", "focal_mechanism"],
          properties: {
            event_name: { bsonType: "string" },
            event_id: { bsonType: "int" },
            event_date: { bsonType: "string", description: "YYYY-MM-DD" },
            event_time: { bsonType: "string", description: "HH:MM:SS" },
            event_datetime: { bsonType: "date" },
            latitude: { bsonType: "double" },
            longitude: { bsonType: "double" },
            depth_km: { bsonType: "double" },
            hypocenter_reference: { bsonType: "string" },
            magnitude_w: { bsonType: "double" },
            magnitude_w_reference: { bsonType: "string" },
            magnitude_l: { bsonType: "double" },
            magnitude_l_reference: { bsonType: "string" },
            focal_mechanism: { bsonType: "string" }
          }
        },
        station_info: {
          bsonType: "object",
          required: ["network", "station_code", "station_name", "latitude", "longitude", "elevation_m", "location", "sensor_depth_m", "vs30_ms", "site_classification_ec8", "morphologic_classification", "epicentral_distance_km", "earthquake_backazimuth_degree"],
          properties: {
            network: { bsonType: "string" },
            station_code: { bsonType: "string" },
            station_name: { bsonType: "string" },
            latitude: { bsonType: "double" },
            longitude: { bsonType: "double" },
            elevation_m: { bsonType: "double" },
            location: { bsonType: "string" },
            sensor_depth_m: { bsonType: "double" },
            vs30_ms: { bsonType: "double" },
            site_classification_ec8: { bsonType: "string" },
            morphologic_classification: { bsonType: "string" },
            epicentral_distance_km: { bsonType: "double" },
            earthquake_backazimuth_degree: { bsonType: "double" }
          }
        },
        recording_info: {
          bsonType: "object",
          required: ["date_time_first_sample", "date_time_first_sample_precision", "sampling_interval_s", "ndata", "duration_s", "units", "instrument", "instrument_analog_digital", "instrumental_frequency_hz", "instrumental_damping", "full_scale_g", "n_bit_digital_converter"],
          properties: {
            date_time_first_sample: { bsonType: "date" },
            date_time_first_sample_precision: { bsonType: "string" },
            sampling_interval_s: { bsonType: "double" },
            ndata: { bsonType: "int" },
            duration_s: { bsonType: "double" },
            units: { bsonType: "string" },
            instrument: { bsonType: "string" },
            instrument_analog_digital: { bsonType: "string" },
            instrumental_frequency_hz: { bsonType: "double" },
            instrumental_damping: { bsonType: "double" },
            full_scale_g: { bsonType: "double" },
            n_bit_digital_converter: { bsonType: "int" }
          }
        },
        processing_info: {
          bsonType: "object",
          required: ["baseline_correction", "filter_type", "filter_order", "low_cut_frequency_hz", "high_cut_frequency_hz", "late_normal_triggered", "processing"],
          properties: {
            baseline_correction: { bsonType: "string" },
            filter_type: { bsonType: "string" },
            filter_order: { bsonType: "int" },
            low_cut_frequency_hz: { bsonType: "double" },
            high_cut_frequency_hz: { bsonType: "double" },
            late_normal_triggered: { bsonType: "string" },
            processing: { bsonType: "string" }
          }
        },
        acceleration_data: {
          bsonType: "object",
          required: ["east_west", "north_south", "up_down"],
          properties: {
            east_west: {
              bsonType: "object",
              required: ["filename", "stream", "data", "pga_cm_s2", "time_pga_s", "upload_date"],
              properties: {
                filename: { bsonType: "string" },
                stream: { bsonType: "string" },
                data: { bsonType: "array", items: { bsonType: "double" } },
                pga_cm_s2: { bsonType: "double" },
                time_pga_s: { bsonType: "double" },
                upload_date: { bsonType: "date" }
              }
            },
            north_south: {
              bsonType: "object",
              required: ["filename", "stream", "data", "pga_cm_s2", "time_pga_s", "upload_date"],
              properties: {
                filename: { bsonType: "string" },
                stream: { bsonType: "string" },
                data: { bsonType: "array", items: { bsonType: "double" } },
                pga_cm_s2: { bsonType: "double" },
                time_pga_s: { bsonType: "double" },
                upload_date: { bsonType: "date" }
              }
            },
            up_down: {
              bsonType: "object",
              required: ["filename", "stream", "data", "pga_cm_s2", "time_pga_s", "upload_date"],
              properties: {
                filename: { bsonType: "string" },
                stream: { bsonType: "string" },
                data: { bsonType: "array", items: { bsonType: "double" } },
                pga_cm_s2: { bsonType: "double" },
                time_pga_s: { bsonType: "double" },
                upload_date: { bsonType: "date" }
              }
            }
          }
        },
        data_metadata: {
          bsonType: "object",
          required: ["database_version", "header_format", "data_type", "data_timestamp", "data_license", "data_citation", "data_creator", "original_data_mediator_citation", "original_data_mediator", "original_data_creator_citation", "original_data_creator", "user_fields"],
          properties: {
            database_version: { bsonType: "string" },
            header_format: { bsonType: "string" },
            data_type: { bsonType: "string" },
            data_timestamp: { bsonType: "date" },
            data_license: { bsonType: "string" },
            data_citation: { bsonType: "string" },
            data_creator: { bsonType: "string" },
            original_data_mediator_citation: { bsonType: "string" },
            original_data_mediator: { bsonType: "string" },
            original_data_creator_citation: { bsonType: "string" },
            original_data_creator: { bsonType: "string" },
            user_fields: {
              bsonType: "object",
              required: ["user1", "user2", "user3", "user4", "user5"],
              properties: {
                user1: { bsonType: "string" },
                user2: { bsonType: "string" },
                user3: { bsonType: "string" },
                user4: { bsonType: "string" },
                user5: { bsonType: "string" }
              }
            }
          }
        },
        calculated_parameters: {
          bsonType: "object",
          required: ["bracketed_duration", "arias_intensity", "site_frequency", "response_spectra"],
          properties: {
            bracketed_duration: { bsonType: "double" },
            arias_intensity: { bsonType: "double" },
            site_frequency: { bsonType: "double" },
            response_spectra: {
              bsonType: "object",
              required: ["periods", "psa", "psv", "sd"],
              properties: {
                periods: { bsonType: "array", items: { bsonType: "double" } },
                psa: { bsonType: "array", items: { bsonType: "double" } },
                psv: { bsonType: "array", items: { bsonType: "double" } },
                sd: { bsonType: "array", items: { bsonType: "double" } }
              }
            }
          }
        },
        metadata: {
          bsonType: "object",
          required: ["created_date", "last_modified", "data_source", "processed", "files_count", "complete_record"],
          properties: {
            created_date: { bsonType: "date" },
            last_modified: { bsonType: "date" },
            data_source: { bsonType: "string" },
            processed: { bsonType: "bool" },
            files_count: { bsonType: "int" },
            complete_record: { bsonType: "bool" }
          }
        }
      }
    }
  },
  validationLevel: "strict"
});
