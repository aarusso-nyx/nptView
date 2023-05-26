import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SeascapeService } from './seascape.service';

import * as Cesium from 'cesium';

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
@Component({
  selector: 'app-root',
  template: `<div id="scene" style="width: 100vw; height: 100vh;"></div>`,
})
export class AppComponent implements OnInit, OnDestroy {
  private viewer!: Cesium.Viewer;
  private sub!: Subscription;

  constructor(private sea: SeascapeService) {}
  
  async ngOnInit() {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1OTIyYTQ3MC02ZGIwLTRiZDAtYTM4ZC1iZDgwZmU0MGFiYWYiLCJpZCI6MTMwODYzLCJpYXQiOjE2Nzk5NjkyODl9.q5ok-1uRLDLzo8aDzhHOLg279nipu-htFZJiyqqJqLQ'
  
    // Initialize the Cesium viewer
    this.viewer = new Cesium.Viewer('scene', {
      terrainProvider: await Cesium.createWorldTerrainAsync(),
      imageryProvider: await Cesium.createWorldImageryAsync(),
      sceneMode: Cesium.SceneMode.SCENE3D,
      shouldAnimate: true,
      projectionPicker: true,
      baseLayerPicker: true,
      
      // requestRenderMode: true,
    });

    this.viewer.scene.globe.enableLighting = true;
    this.viewer.scene.globe.showWaterEffect = true;

    this.viewer.homeButton.viewModel.command.beforeExecute.addEventListener((commandInfo) => {
      commandInfo.cancel = true;
      this.goHome();
    });

    // Clock settings
    let now = Cesium.JulianDate.now();

    // Calculate dates for 24 hours ago and 12 hours ago
    let start = Cesium.JulianDate.addHours(now, -24, new Cesium.JulianDate());
    let mid = Cesium.JulianDate.addHours(now, -12, new Cesium.JulianDate());
    
    // Set the clock settings
    this.viewer.clock.startTime = start.clone();
    this.viewer.clock.stopTime = now.clone();
    this.viewer.clock.currentTime = mid.clone();
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // Loop at the end
    this.viewer.clock.multiplier = 1;
    this.viewer.clock.shouldAnimate = true;
    
    // Set timeline to simulation bounds
    this.viewer.timeline.zoomTo(start, now);

    // Set camera to home view
    this.goHome();

    // Add the seascape layer
    this.sea.pier(this.viewer, 'BRBTB', -56.38056, -1.46012);

    // Subscribe to the seascape service
    this.sub = this.sea.tracking (this.viewer, 'BRBTB')
      .subscribe();
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  // Clean up logic will be added in the next steps
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
  goHome() {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-56.38056, -1.46012, 5000),
    });
  }
}
