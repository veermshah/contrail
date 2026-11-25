import type { StyleProp, ViewStyle } from 'react-native';

import type { LivePosition } from '@/lib/types';

export type MapRoute = {
  id: string;
  from: { latitude: number; longitude: number; code?: string };
  to: { latitude: number; longitude: number; code?: string };
  highlight?: boolean;
};

export type MapPlane = Pick<LivePosition, 'lat' | 'lon' | 'trackDeg'> & { id: string; label?: string };

export type FlightMapProps = {
  routes: MapRoute[];
  planes?: MapPlane[];
  center?: { latitude: number; longitude: number; radiusDeg: number };
  style?: StyleProp<ViewStyle>;
  onPlanePress?: (id: string) => void;
};
