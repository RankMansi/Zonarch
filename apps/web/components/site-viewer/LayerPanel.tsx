'use client';

export type LayerToggleKey =
  | 'city_buildings'
  | 'lot_boundary'
  | 'envelope_uap'
  | 'envelope_base'
  | 'sky_exposure_plane';

export interface LayerVisibility {
  city_buildings: boolean;
  lot_boundary: boolean;
  envelope_uap: boolean;
  envelope_base: boolean;
  sky_exposure_plane: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  city_buildings: true,
  lot_boundary: true,
  envelope_uap: true,
  envelope_base: false,
  sky_exposure_plane: false,
};

const LAYER_ITEMS: Array<{
  key: LayerToggleKey;
  label: string;
  hint?: string;
}> = [
  { key: 'city_buildings', label: 'City buildings', hint: 'OpenFreeMap OSM 3D context' },
  { key: 'lot_boundary', label: 'Lot boundary', hint: 'NYC Zoning API tax lot' },
  { key: 'envelope_uap', label: 'Proposed envelope', hint: 'UAP FAR volume (green)' },
  { key: 'envelope_base', label: 'Base FAR vs UAP', hint: 'Brown = base FAR only' },
  { key: 'sky_exposure_plane', label: 'Sky exposure plane', hint: 'Reference height slab' },
];

const LEGEND = [
  { color: '#6b4423', label: 'Your tax lot' },
  { color: '#c8bcb0', label: 'City buildings (OSM)' },
  { color: '#2e7d32', label: 'UAP envelope' },
  { color: '#8b5a2b', label: 'Base FAR envelope' },
  { color: '#c8956c', label: 'Sky exposure plane' },
];

interface LayerPanelProps {
  visibility: LayerVisibility;
  onChange: (key: LayerToggleKey, value: boolean) => void;
}

export default function LayerPanel({ visibility, onChange }: LayerPanelProps) {
  return (
    <aside className="site-viewer-layers w-full md:w-[280px] shrink-0 border-l border-[#d4c4b0]/70 bg-[#f5efe6]/95 backdrop-blur-sm overflow-y-auto">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="type-label text-[10px] text-[#8b5a2b] uppercase tracking-wider mb-2">
            Layers
          </h2>
          <ul className="space-y-2">
            {LAYER_ITEMS.map((item) => (
              <li key={item.key}>
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={visibility[item.key]}
                    onChange={(e) => onChange(item.key, e.target.checked)}
                    className="mt-0.5 accent-[#6b4423]"
                  />
                  <span>
                    <span className="text-sm text-[#2c1810] group-hover:text-[#6b4423]">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="block text-[10px] text-[#8b5a2b]/80">{item.hint}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[#d4c4b0]/50 pt-3">
          <p className="type-label text-[10px] text-[#8b5a2b] uppercase tracking-wider mb-2">
            Legend
          </p>
          <ul className="space-y-1.5">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs text-[#4a3728]">
                <span
                  className="w-3 h-3 rounded-sm shrink-0 border border-black/10"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
