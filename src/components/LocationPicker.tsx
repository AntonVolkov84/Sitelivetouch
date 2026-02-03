import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import ngeo from "ngeohash";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, hash: string) => void;
  initialPos?: [number, number];
}
const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234];
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function LocationPicker({ onLocationSelect, initialPos }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(initialPos || DEFAULT_CENTER);
  useEffect(() => {
    if (initialPos && (initialPos[0] !== position[0] || initialPos[1] !== position[1])) {
      setPosition(initialPos);
    }
  }, [initialPos]);
  function LocationMarker() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        const newPos: [number, number] = [lat, lng];
        setPosition(newPos);
        const hash = ngeo.encode(lat, lng, 9);
        onLocationSelect(lat, lng, hash);
      },
    });

    return <Marker position={position} />;
  }

  return (
    <div style={{ height: "300px", width: "100%", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
      <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* ВАЖНО: Добавляем компонент управления камерой сюда! */}
        <ChangeView center={position} />
        <LocationMarker />
      </MapContainer>
    </div>
  );
}
