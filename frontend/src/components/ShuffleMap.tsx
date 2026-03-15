import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShuffleTransfer } from '../types/shuffle_otb_types';
import { api } from '../services/api';

// Fix for default Leaflet icon paths in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ShuffleMapProps {
  transfers: ShuffleTransfer[];
}

// Component to handle auto-zooming
function BoundsFitter({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [bounds, map]);
  return null;
}

export default function ShuffleMap({ transfers }: ShuffleMapProps) {
  const [storeCoords, setStoreCoords] = useState<Record<string, {lat: number, lng: number}>>({});

  useEffect(() => {
    api.getStoreCoordinates()
      .then(setStoreCoords)
      .catch(console.error);
  }, []);

  // Extract unique branches from transfers to plot markers
  const branchMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    transfers.forEach(t => {
      // Use real coordinates if available, otherwise skip plotting for that branch
      if (!map.has(t.from_branch) && storeCoords[t.from_branch]) {
        map.set(t.from_branch, [storeCoords[t.from_branch].lat, storeCoords[t.from_branch].lng]);
      }
      if (!map.has(t.to_branch) && storeCoords[t.to_branch]) {
        map.set(t.to_branch, [storeCoords[t.to_branch].lat, storeCoords[t.to_branch].lng]);
      }
    });
    return map;
  }, [transfers, storeCoords]);

  // Center map dynamically based on markers, default to Chennai
  const center: [number, number] = branchMap.size > 0 
    ? Array.from(branchMap.values())[0] 
    : [13.0827, 80.2707];

  // Calculate bounds to automatically fit all markers
  const bounds = useMemo(() => {
    if (branchMap.size === 0) return null;
    const lats: number[] = [];
    const lngs: number[] = [];
    Array.from(branchMap.values()).forEach(coord => {
      lats.push(coord[0]);
      lngs.push(coord[1]);
    });
    
    // Check if we have valid coordinates
    if (lats.length === 0 || lngs.length === 0) return null;
    
    return L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
  }, [branchMap]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 z-0 relative">
      <MapContainer 
        center={center} 
        zoom={branchMap.size > 0 ? 8 : 6} 
        style={{ height: '100%', width: '100%', background: '#e5e7eb' }}
        scrollWheelZoom={false}
      >
        <BoundsFitter bounds={bounds} />
        
        {/* Light theme OpenStreetMap tiles via CartoDB Positron */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Render Markers for each unique branch */}
        {Array.from(branchMap.entries()).map(([branchName, coords]) => (
          <Marker key={branchName} position={coords}>
            <Popup className="custom-popup">
              <div className="text-neutral-900 font-semibold">{branchName}</div>
            </Popup>
          </Marker>
        ))}

        {/* Render Polylines for each transfer */}
        {transfers.map((t, idx) => {
          const fromCoord = branchMap.get(t.from_branch);
          const toCoord = branchMap.get(t.to_branch);
          
          if (!fromCoord || !toCoord) return null;

          return (
            <Polyline 
              key={`transfer-${idx}`}
              positions={[fromCoord, toCoord]}
              color={"#10b981"} // Green for all standard transfers
              weight={3}
              opacity={0.7}
              dashArray="5, 10"
            >
              <Popup>
                <div className="text-neutral-900 font-medium">
                  <div><span className="text-neutral-500 text-xs">From:</span> {t.from_branch}</div>
                  <div><span className="text-neutral-500 text-xs">To:</span> {t.to_branch}</div>
                  <div className="mt-1 font-bold text-emerald-600">Transfer: {t.quantity} units</div>
                </div>
              </Popup>
            </Polyline>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[400] glass-card p-3 bg-black/80 backdrop-blur-md">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Shuffle Routes</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 border-b-2 border-emerald-500 border-dashed"></div>
            <span className="text-xs text-neutral-200">Recommended Transfer</span>
          </div>
        </div>
      </div>
    </div>
  );
}