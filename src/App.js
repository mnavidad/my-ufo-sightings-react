import React, { useEffect, useRef } from 'react';
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Home from "@arcgis/core/widgets/Home";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Point from "@arcgis/core/geometry/Point";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import * as locator from "@arcgis/core/rest/locator";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import './App.css';
import Image from "./alien.png";

function App() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    const map = new Map({
      basemap: "streets-navigation-vector"
    });

    const view = new MapView({
      container: mapRef.current,
      map: map,
      center: [-100.33, 43.69],
      zoom: 4
    });

    viewRef.current = view;

    const homeWidget = new Home({
      view: view
    });

    view.ui.add(homeWidget, "top-left");

    /* const popupTemplate = {
      title: "UFO Sighting",
      outFields: ["SUMMARY", "STATE", "CITY", "DESCRIPTION", "DATE_TIME"],
      content: function(ufoLayer) {
        const summary = ufoLayer.graphic.attributes.SUMMARY;
        const state = ufoLayer.graphic.attributes.STATE;
        const city = ufoLayer.graphic.attributes.CITY || "";
        const description = ufoLayer.graphic.attributes.DESCRIPTIO;
        const dateTime = ufoLayer.graphic.attributes.DATE_TIME;

        return `
          <div>
            <h3>Summary: ${summary}</h3>
            <h3>State: ${state}</h3>
            ${city ? `<h3>City: ${city}</h3>` : ''}
            <h3>Description: ${description}</h3>
            <h3>Date: ${new Date(dateTime).toDateString()}</h3>
          </div>
        `;
      }
    }; */

    //-------------------------------------------------------------------------- new better popup formatted with esri arcade
    const popupTemplate = {
      title: "{CITY}, {STATE}",
      outFields: ["*"],
      content: [
        {
          type: "text",
          text: `
            <style>
              .popup-content {font-family: Arial, sans-serif; padding: 10px;}
              .popup-header {font-size: 18px; font-weight: bold; color: #3366cc; margin-bottom: 10px;}
              .popup-detail {margin-bottom: 5px;}
              .popup-label {font-weight: bold; color: #666;}
            </style>
            <div class="popup-content">
              <div class="popup-header">{SUMMARY}</div>
              <div class="popup-detail"><span class="popup-label">Date:</span> {
                Text(Date($feature['DATE_TIME']), 'DD MMM YYYY')
              }</div>
              <div class="popup-detail"><span class="popup-label">Time:</span> {
                Text(Date($feature['DATE_TIME']), 'HH:mm')
              }</div>
              <div class="popup-detail"><span class="popup-label">Duration:</span> {DURATION}</div>
              <div class="popup-detail"><span class="popup-label">Description:</span> {DESCRIPTIO}</div>
            </div>
          `
        },
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "STATS",
              label: "Statistics",
              visible: true
            },
            {
              fieldName: "REPORT_LIN",
              label: "Report Link",
              visible: true
            }
          ]
        }
      ]
    };
    //---------------------------------------------------------------------------

    const alienSymbol = new PictureMarkerSymbol({
      url: Image, // Replace with the actual path to your alien icon image
      width: "24px",
      height: "24px"
    });

    const ufoRenderer = new SimpleRenderer({
      symbol: alienSymbol
    });

    const ufoLayer = new FeatureLayer({
      url: "https://services6.arcgis.com/XC8RCfadrDoUDrun/arcgis/rest/services/EncuentrosDeOvniVer3/FeatureServer",
      outFields: ["*"],
      popupTemplate: popupTemplate,
      renderer: ufoRenderer
    });

    map.add(ufoLayer);

    view.on("click", function(event) {
      const screenPoint = {
        x: event.x,
        y: event.y
      };

      view.hitTest(screenPoint).then(function(response) {
        const results = response.results;

        const filteredResults = results.filter(function(result) {
          return result.graphic.layer === ufoLayer;
        });

        if (filteredResults.length) {
          let graphic = filteredResults[0].graphic;

          if (graphic) {
            const summary = graphic.attributes.SUMMARY;
            const state = graphic.attributes.STATE;
            const city = graphic.attributes.CITY || "";
            const description = graphic.attributes.DESCRIPTIO;
            const dateTime = graphic.attributes.DATE_TIME;

            const popupContent = `
              <div>
                <h3>Summary: ${summary}</h3>
                <h3>State: ${state}</h3>
                <h3>City: ${city}</h3>
                <h3>Description: ${description}</h3>
                <h3>Date: ${new Date(dateTime).toDateString()}</h3>
              </div>
            `;

            view.popup.open({
              title: "UFO Sighting",
              location: event.mapPoint,
              content: popupContent
            });
          }
        }
      }).catch(function(error) {
        console.error("Error during hitTest:", error);
      });
    });

    return () => {
      if (view) {
        view.destroy();
      }
    };
  }, []);

  const handleSearch = () => {
    const cityName = document.getElementById("cityInput").value;
    const locatorUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
    
    if (cityName) {
      locator.addressToLocations(locatorUrl, {
        address: { "SingleLine": cityName },
        maxLocations: 1
      }).then(function(results) {
        if (results.length) {
          const cityLocation = results[0].location;
          const cityPoint = new Point({
            x: cityLocation.x,
            y: cityLocation.y,
            spatialReference: { wkid: 102100, latestWkid: 3857 }
          });

          viewRef.current.goTo({ center: [cityPoint.x, cityPoint.y], zoom: 10 });

          const ufoLayer = viewRef.current.map.layers.getItemAt(0);
          const query = ufoLayer.createQuery();
          query.returnGeometry = true;
          query.outFields = ["*"];

          ufoLayer.queryFeatures(query).then(function(response) {
            const features = response.features;

            if (features.length) {
              const nearestFeature = findNearestFeature(features, cityPoint);

              if (nearestFeature) {
                const nearestPoint = nearestFeature.geometry.type === "point" ? nearestFeature.geometry : nearestFeature.geometry.extent.center;
                const distance = geometryEngine.distance(cityPoint, nearestPoint, "kilometers");

                viewRef.current.popup.open({
                  title: `Nearest UFO Sighting`,
                  content: `Location: ${nearestFeature.attributes.CITY}<br>
                            State: ${nearestFeature.attributes.STATE}<br>
                            Summary: ${nearestFeature.attributes.DESCRIPTIO}<br>
                            Date: ${new Date(nearestFeature.attributes.DATE_TIME).toDateString()}<br>
                            Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
                  location: nearestFeature.geometry
                });
              } else {
                viewRef.current.popup.open({
                  title: "No Sightings Found",
                  content: "No UFO sightings found within the specified distance.",
                  location: cityPoint
                });
              }
            } else {
              viewRef.current.popup.open({
                title: "No Sightings Found",
                content: "No UFO sightings found within the specified distance.",
                location: cityPoint
              });
            }
          });
        } else {
          alert("City not found.");
        }
      });
    } else {
      alert("Please enter a city name.");
    }
  };

  function findNearestFeature(features, cityPoint) {
    let nearestFeature = null;
    let minDistance = Infinity;

    features.forEach(function(feature, index) {
      const featureGeometry = feature.geometry;

      if (featureGeometry) {
        let featurePoint;

        if (featureGeometry.type === "point") {
          featurePoint = featureGeometry;
        } else {
          featurePoint = featureGeometry.extent.center;
        }

        const cityPointProjected = webMercatorUtils.project(cityPoint, featurePoint.spatialReference);

        const distance = geometryEngine.distance(cityPointProjected, featurePoint, "kilometers");

        if (distance < minDistance) {
          minDistance = distance;
          nearestFeature = feature;
        }
      }
    });

    return nearestFeature;
  }

  return (
    <div className="app-container">
      <div id="viewDiv" ref={mapRef}>
        <div className="search-overlay">
          <input id="cityInput" type="text" placeholder="Enter city name" />
          <button id="searchButton" onClick={handleSearch}>Search</button>
        </div>
      </div>
    </div>
  );
}

export default App;

