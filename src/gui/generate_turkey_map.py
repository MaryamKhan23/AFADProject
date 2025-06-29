import folium
import pandas as pd

def generate_station_map(event_id, station_csv='stations.csv', output_html='station_map.html'):
    df = pd.read_csv(station_csv)
    df = df[df['EventID'].astype(str) == str(event_id)]

    if df.empty:
        print("No stations found for event:", event_id)
        return

    center_lat = df.iloc[0]['Latitude']
    center_lon = df.iloc[0]['Longitude']
    m = folium.Map(location=[center_lat, center_lon], zoom_start=7)

    for _, row in df.iterrows():
        popup = (
            f"<b>Station Code:</b> {row['Code']}<br>"
            f"<b>Location:</b> {row['Latitude']}°N, {row['Longitude']}°E<br>"
            f"<b>Province/District:</b> {row['Province']}, {row['District']}"
        )
        folium.Marker(
            location=[row['Latitude'], row['Longitude']],
            popup=popup,
            icon=folium.Icon(color='blue', icon='info-sign')
        ).add_to(m)

    m.save(output_html)
