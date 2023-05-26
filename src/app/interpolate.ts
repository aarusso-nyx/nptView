import { VesselData } from "./seascape.service";    
import { map, union } from 'lodash';

function lerp(start: number, end: number, t: number, isAngle: boolean = false): (number | null) {
    if ( start === null && end === null ) {
        return null;
    } if ( start === null || t >= 1.0 ) {
        return end;
    } else if ( end === null || t <= 0.0) {
        return start;        
    }
    
    if ( isAngle ) {
        if ( end - start > 180 ) {
            start += 360;
        } else if ( end - start < -180 ) {
            end += 360;
        }
    }

    const clamp = (v: number, mod: number = 360): number => (v + mod) % mod;
    const val = (1 - t) * start + t * end;
    return isAngle ? clamp(val) : val;
  }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function interpolate(prevScape: VesselData[], currScape: VesselData[], t: number): VesselData[] {
    if (!prevScape || prevScape.length === 0 || t >= 1.0) {
      return currScape;
    } else if (t <= 0.0) {
      return prevScape;
    } else {
      return union( map(prevScape, 'mmsi'), map(currScape, 'mmsi') )
            .map( (v: number) => {
                const prev = prevScape.find( (p: VesselData) => p.mmsi === v );
                const curr = currScape.find( (c: VesselData) => c.mmsi === v );
                
                if ( !prev ) return curr;
                if ( !curr ) return prev;
                
                return { ...curr,
                    tstamp: Math.round( lerp(prev.tstamp, curr.tstamp, t) || 0 ),
                    lat: lerp(prev.lat, curr.lat, t),
                    lon: lerp(prev.lon, curr.lon, t),
                    cog: lerp(prev.cog, curr.cog, t, true),
                    sog: lerp(prev.sog, curr.sog, t),
                    rot: lerp(prev.rot, curr.rot, t),
                    head: lerp(prev.head, curr.head, t, true),
                } as VesselData;
            })
            .filter((v: VesselData | undefined): v is VesselData => v !== undefined);
    }
}
