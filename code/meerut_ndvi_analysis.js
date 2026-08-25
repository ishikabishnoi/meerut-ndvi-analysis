// Satellite-Based Vegetation Health Monitoring of Meerut Using Landsat 8/9 and NDVI

// 1. Define the Meerut study area.
var meerut = ee.Geometry.Rectangle([77.55, 28.80, 77.90, 29.15]);

// 2. Load Landsat 8 and Landsat 9 Level-2 surface reflectance data.
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'));

// 3. Remove clouds and convert Landsat bands to surface reflectance.
function maskAndScale(image) {
    var qa = image.select('QA_PIXEL');

    var cloudMask = qa.bitwiseAnd(1 << 3).eq(0)
        .and(qa.bitwiseAnd(1 << 4).eq(0))
        .and(qa.bitwiseAnd(1 << 1).eq(0));

    return image
        .updateMask(cloudMask)
        .select(['SR_B4', 'SR_B5'], ['red', 'nir'])
        .multiply(0.0000275)
        .add(-0.2)
        .copyProperties(image, ['system:time_start']);
}

// 4. Create one NDVI image for March-April of a selected year.
function getNDVI(year) {
    var startDate = ee.Date.fromYMD(year, 3, 1);
    var endDate = ee.Date.fromYMD(year, 5, 1);

    var image = landsat
        .filterBounds(meerut)
        .filterDate(startDate, endDate)
        .map(maskAndScale)
        .median();

    return image
        .normalizedDifference(['nir', 'red'])
        .rename('NDVI')
        .clip(meerut)
        .set('year', year)
        .set('system:time_start', startDate.millis());
}

// 5. Create NDVI maps for 2017, 2021, and 2026.
var ndvi2017 = getNDVI(2017);
var ndvi2021 = getNDVI(2021);
var ndvi2026 = getNDVI(2026);

// 6. Display results.
var ndviPalette = {
    min: -0.2,
    max: 0.8,
    palette: ['brown', 'yellow', 'lightgreen', 'darkgreen']
};

Map.centerObject(meerut, 10);
Map.addLayer(meerut, { color: 'black' }, 'Meerut Study Area');
Map.addLayer(ndvi2017, ndviPalette, 'NDVI - 2017');
Map.addLayer(ndvi2021, ndviPalette, 'NDVI - 2021', false);
Map.addLayer(ndvi2026, ndviPalette, 'NDVI - 2026', false);

// 7. Create a chart of average NDVI for each year.
var ndviCollection = ee.ImageCollection.fromImages([
    ndvi2017, ndvi2021, ndvi2026
]);

var chart = ui.Chart.image.series({
    imageCollection: ndviCollection,
    region: meerut,
    reducer: ee.Reducer.mean(),
    scale: 30,
    xProperty: 'system:time_start'
})
    .setOptions({
        title: 'Average NDVI in Meerut: 2017, 2021, and 2026',
        hAxis: { title: 'Year' },
        vAxis: { title: 'Average NDVI' },
        lineWidth: 3,
        pointSize: 7,
        colors: ['2E7D32']
    });

print(chart);


// 8. Print exact average NDVI values for the report.
var mean2017 = ndvi2017.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: meerut,
    scale: 30,
    maxPixels: 1e9
}).get('NDVI');

var mean2021 = ndvi2021.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: meerut,
    scale: 30,
    maxPixels: 1e9
}).get('NDVI');

var mean2026 = ndvi2026.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: meerut,
    scale: 30,
    maxPixels: 1e9
}).get('NDVI');

print('Mean NDVI - 2017:', mean2017);
print('Mean NDVI - 2021:', mean2021);
print('Mean NDVI - 2026:', mean2026);


// 9. Export NDVI maps and summary data to Google Drive.
var summaryTable = ee.FeatureCollection([
    ee.Feature(null, { year: 2017, mean_ndvi: mean2017 }),
    ee.Feature(null, { year: 2021, mean_ndvi: mean2021 }),
    ee.Feature(null, { year: 2026, mean_ndvi: mean2026 })
]);

Export.table.toDrive({
    collection: summaryTable,
    description: 'Meerut_NDVI_Summary',
    folder: 'Meerut_NDVI_Project',
    fileNamePrefix: 'meerut_ndvi_summary',
    fileFormat: 'CSV'
});

Export.image.toDrive({
    image: ndvi2017,
    description: 'Meerut_NDVI_2017',
    folder: 'Meerut_NDVI_Project',
    fileNamePrefix: 'meerut_ndvi_2017',
    region: meerut,
    scale: 30,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
});

Export.image.toDrive({
    image: ndvi2021,
    description: 'Meerut_NDVI_2021',
    folder: 'Meerut_NDVI_Project',
    fileNamePrefix: 'meerut_ndvi_2021',
    region: meerut,
    scale: 30,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
});

Export.image.toDrive({
    image: ndvi2026,
    description: 'Meerut_NDVI_2026',
    folder: 'Meerut_NDVI_Project',
    fileNamePrefix: 'meerut_ndvi_2026',
    region: meerut,
    scale: 30,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
});


// 10. Build an annual NDVI time series from 2017 to 2026.
var years = ee.List.sequence(2017, 2026);

var annualNDVI = ee.ImageCollection.fromImages(
    years.map(function (year) {
        year = ee.Number(year).toInt();

        return getNDVI(year)
            .set('year', year)
            .set('system:time_start', ee.Date.fromYMD(year, 3, 1).millis());
    })
);

// 11. Create a 10-year average NDVI chart.
var annualChart = ui.Chart.image.series({
    imageCollection: annualNDVI,
    region: meerut,
    reducer: ee.Reducer.mean(),
    scale: 30,
    xProperty: 'system:time_start'
})
    .setOptions({
        title: 'Annual Average NDVI in Meerut Study Area: 2017-2026',
        hAxis: {
            title: 'Year',
            format: 'yyyy',
            gridlines: { count: 10 }
        },
        vAxis: { title: 'Average NDVI' },
        lineWidth: 3,
        pointSize: 5,
        colors: ['1565C0']
    });

print('Annual NDVI Trend: 2017-2026', annualChart);


// 12. Map NDVI change between 2017 and 2026.
var ndviChange = ndvi2026.subtract(ndvi2017).rename('NDVI_Change');

var changePalette = {
    min: -0.2,
    max: 0.2,
    palette: ['B2182B', 'F7F7F7', '1B7837']
};

Map.addLayer(
    ndviChange,
    changePalette,
    'NDVI Change: 2026 minus 2017'
);

// 13. Calculate area under NDVI decrease, stability, and increase classes.
var decreaseMask = ndviChange.lt(-0.05);
var stableMask = ndviChange.gte(-0.05).and(ndviChange.lte(0.05));
var increaseMask = ndviChange.gt(0.05);

var pixelAreaKm2 = ee.Image.pixelArea()
    .divide(1e6)
    .rename('area_km2');

function getAreaKm2(mask) {
    return pixelAreaKm2
        .updateMask(mask)
        .reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: meerut,
            scale: 30,
            maxPixels: 1e10
        })
        .get('area_km2');
}

var areaDecrease = getAreaKm2(decreaseMask);
var areaStable = getAreaKm2(stableMask);
var areaIncrease = getAreaKm2(increaseMask);

print('Area with NDVI decrease (km²):', areaDecrease);
print('Area with stable NDVI (km²):', areaStable);
print('Area with NDVI increase (km²):', areaIncrease);

// 14. Create a presentation-ready vegetation change classification map.
var changeClasses = ee.Image(2)
    .where(ndviChange.lt(-0.05), 1)
    .where(ndviChange.gt(0.05), 3)
    .updateMask(ndviChange.mask())
    .clip(meerut)
    .rename('Change_Class');

Map.addLayer(changeClasses, {
    min: 1,
    max: 3,
    palette: ['D73027', 'FEE08B', '1A9850']
}, 'Vegetation Change Classes: 2017-2026');

// Add a legend.
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px'
    }
});

legend.add(ui.Label({
    value: 'NDVI Change: 2017-2026',
    style: {
        fontWeight: 'bold',
        fontSize: '14px',
        margin: '0 0 6px 0'
    }
}));

function addLegendRow(color, label) {
    var colorBox = ui.Label({
        style: {
            backgroundColor: '#' + color,
            padding: '8px',
            margin: '0 0 4px 0'
        }
    });

    var description = ui.Label({
        value: label,
        style: { margin: '0 0 4px 6px' }
    });

    legend.add(ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
    }));
}

addLegendRow('D73027', 'NDVI decrease below -0.05');
addLegendRow('FEE08B', 'Stable NDVI');
addLegendRow('1A9850', 'NDVI increase above +0.05');

Map.add(legend);