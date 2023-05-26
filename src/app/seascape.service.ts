import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, of, from, delay } from 'rxjs';
import { concatMap, map, scan, switchMap, tap  } from 'rxjs/operators';
import  groupBy  from 'lodash-es/groupBy';
import  mapValues  from 'lodash-es/mapValues';
import  values  from 'lodash-es/values';
import * as Cesium from 'cesium';

import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

import { interpolate } from './interpolate';
import { modelOf } from './modelOf';



///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
export interface VesselData {
  mmsi: number;
  tstamp: number;
  port: number;
  nav: number;
  lat: number;
  lon: number;
  cog: number;
  sog: number;
  rot: number;
  head: number;
  port_code: string;
  dest: string | null;
  eta: string | null;
  draught: number | null;
  flag: string | null;
  imo: number | null;
  vessel_name: string;
  callsign: string;
  vessel_type: number;
  vesseltype_desc: string;
  vesseltype_icon: number;
  dimBow: number;
  dimPort: number;
  dimStern: number;
  dimStarboard: number;

  track?: VesselData[];
}


export interface VesselTrack {
  tracking: {
    tstamp: number;
    seascape: VesselData[];
  }[];

  vessels: VesselData[];
}
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
@Injectable({
  providedIn: 'root'
})
export class SeascapeService {
  private readonly apiUrl = 'https://api.navalport.com/nais/seascape/';
  private readonly apiTrack = 'https://api.navalport.com/nais/tracking/';
  
  constructor(private http: HttpClient) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('assets/draco/');
    loader.setDRACOLoader(draco);      
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  tracking ( viewer: Cesium.Viewer, port_code: string): Observable<any> {
    const toTime = (t: Cesium.JulianDate) => Math.trunc(Cesium.JulianDate.toDate(t).getTime()/1000);

    const qs = {
      ts: toTime ( viewer.clock.startTime ),
      tf: toTime ( viewer.clock.stopTime ),
      dt: 120,
    };


    const cast = (obj: any): any => {
      for (let key in obj) {
        if (typeof obj[key] === 'object') {
            cast(obj[key]);
        } else if (!isNaN(obj[key])) {
            obj[key] = Number(obj[key]);
        }
      }

      return obj;
    }


    const reformat = (data: VesselTrack) => {
      const fleet = groupBy(data.tracking.map(t => t.seascape).flat(), 'mmsi');
      return values(mapValues(fleet, (track, mmsi) => {
        const vessel: VesselData = data.vessels.find(v => v.mmsi.toString() === mmsi)!;
        return { ...vessel, track };
      }));      
    };

    const animate = (viewer: Cesium.Viewer, data: VesselData[]): void => {
      data.forEach ( vessel => {
        console.log(vessel);
        const model = viewer.entities.add( this.vessel(vessel) );

        // add trackings
        const posTrack = new Cesium.SampledPositionProperty();
        const oriTrack = new Cesium.SampledProperty(Cesium.Quaternion);

        vessel.track!.forEach( (p: VesselData) => {
          const head = (p.head || p.cog || 0.0);
          const ais = Cesium.Cartesian3.fromElements(-p.dimStern, -p.dimPort, -(p.draught || 10.0) );
          const t = Cesium.JulianDate.fromDate( new Date(p.tstamp * 1000) );
          const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0.0);
          // Cesium.Cartesian3.add(pos, ais, pos);

          const dir = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(head), 0, 0)
          const ori = Cesium.Transforms.headingPitchRollQuaternion(pos,dir);

          posTrack.addSample(t, pos);
          oriTrack.addSample(t, ori);
        });

        model.position    = posTrack;
        model.orientation = oriTrack;
      });
    };

    const uri = `${this.apiTrack}${port_code}`;
    return of(qs).pipe(
      switchMap(qs => this.http.get<VesselTrack>(uri, { params: qs })),
      map(data => cast(data)),
      map(data => reformat(data)),
      tap(data => animate(viewer, data)), 
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  seascape(viewer: Cesium.Viewer, port_code: string, mdt: number, steps: number): Observable<void> {
    const url = `${this.apiUrl}${port_code}`;
    const dT = mdt * 1000;
    const dt = dT / steps;

    return timer(0, dT)
        .pipe(
            map(() => ({ 
              ts: Cesium.JulianDate.toDate ( viewer.clock.startTime ).getTime() / 1000,
              tf: Cesium.JulianDate.toDate ( viewer.clock.stopTime ).getTime() / 1000,
              dt: 120,
            })),
            tap(clock => { console.log(clock);  }),
            // Fetch Data
            switchMap(() => this.http.get<VesselData[]>(url)),
            // Store last two data sets
            scan((acc: VesselData[][], curr: VesselData[]) => [acc[1], curr], []),
            // interpolate 
            concatMap(([prev, curr]) => from(Array(steps).fill(0).map((_, i) =>  interpolate(prev, curr, i / (steps - 1))))),
            // add a delay between each step
            concatMap(data => of(data).pipe(delay(dt))), 
            // render
            map(data => data.forEach(p => this.render(viewer, p))),
        );
  }

 

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  private render ( viewer: Cesium.Viewer, p: VesselData ): void {
    const id = p.mmsi.toString();
  
    // if the ship is not in the ships array, create it
    let vessel = viewer.entities.getById(id); 
    if ( !vessel ) {
      vessel = viewer.entities.add( this.vessel(p) );
    } 

    const draft = (p.draught || 7.0);
    const head = (p.head || p.cog || 0.0);
  
    const ref = Cesium.Cartesian3.fromElements(p.dimStern, p.dimPort, -draft);
    // Create a quaternion to rotate model according to the vessel's heading
    const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0.0);
    Cesium.Cartesian3.add(pos, ref, pos);
    
    const rot = Cesium.HeadingPitchRoll.fromDegrees(90.0 - head, 0.0, 0.0);
    const ori = Cesium.Transforms.headingPitchRollQuaternion(pos, rot); 
  
    vessel['position'] = new Cesium.ConstantPositionProperty(pos);
    vessel['orientation'] = new Cesium.ConstantProperty(ori);
  }


  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  private vessel(p: VesselData): Cesium.Entity {
    const label = new Cesium.LabelGraphics({
      text: p.vessel_name,
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -9)
    });
  
    return new Cesium.Entity({
      id: p.mmsi.toString(),
      name: p.vessel_name,
      label,
      model: {
        uri: modelOf(p),
        scale: (p.dimBow + p.dimStern)
        // minimumPixelSize: 128,
        // maximumScale: 1, 
        // distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20000),
      }
    });
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  pier ( viewer: Cesium.Viewer, port_code: string, lon: number, lat: number  ): void {
    const label = new Cesium.LabelGraphics({
      text: port_code,
      font: '16px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, 25)
    });
  
    const model = new Cesium.Entity({
      id: port_code,
      name: port_code,
      label,
      model: {
        scale: 2.0,
        uri: `assets/models/${port_code}-2.glb`,
      }
    });

    model.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(lon,lat, 0.0));
    viewer.entities.add(model);
  }
}
