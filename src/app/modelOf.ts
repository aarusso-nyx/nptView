import { VesselData } from './seascape.service';

export function modelOf ( p: VesselData ): string {
  const model = () => {
    if ( p.vessel_type < 20 ) return 'vessel';
    else if ( p.vessel_type < 30 ) return 'tug';
    else if ( p.vessel_type < 40 ) return 'vessel';
    else if ( p.vessel_type < 50 ) return 'boat';
    else if ( p.vessel_type < 60 ) return 'fixed/tug-0';
    else if ( p.vessel_type < 70 ) return 'passenger';
    else if ( p.vessel_type < 80 ) return 'bulk';
    else if ( p.vessel_type < 90 ) return 'tanker';
    else return 'vessel';
  }

  return `assets/models/${model()}.glb`;
}



