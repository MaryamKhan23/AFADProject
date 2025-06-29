
import folium
import pandas as pd

def generate_station_map(event_id, station_csv='stations.csv', output_html='station_map.html'):
    df = pd.read_csv(station_csv)
    print("📌 Gelen event_id:", event_id)

    df['EventID'] = df['EventID'].astype(str).str.strip()
    event_id = str(event_id).strip()

    filtered = df[df['EventID'] == event_id]
    print("✅ Filtrelenen istasyon sayısı:", len(filtered))

    if filtered.empty:
        print("❌ Uyuşan istasyon bulunamadı.")
        return

    center_lat = filtered.iloc[0]['Latitude']
    center_lon = filtered.iloc[0]['Longitude']
    m = folium.Map(location=[center_lat, center_lon], zoom_start=7)

    for _, row in filtered.iterrows():
        popup_text = (
            f"<b>Station Code:</b> {row['Code']}<br>"
            f"<b>Location:</b> {row['Latitude']}°N, {row['Longitude']}°E<br>"
            f"<b>Province/District:</b> {row['Province']}, {row['District']}"
        )
        folium.Marker(
            location=[row['Latitude'], row['Longitude']],
            popup=popup_text,
            icon=folium.Icon(color='blue', icon='info-sign')
        ).add_to(m)

    m.save(output_html)
    print(f"💾 Harita başarıyla kaydedildi: {output_html}")
