var labels = {
  // punemployed: 'Unemployment',
  // homeownership: 'Homeownership',
  // prentocc: 'Renter-occupied',
  // ownmedval: 'Median Value',
  medhhinc: 'Median Income Map',
  medgrossrent: 'Rent Burden Map',
}

var middles = {
  medhhinc: 53601,
  medgrossrent: 30,
}

var formats = {
  medhhinc: function(d) { return '$' + d3.format(',.')(d) }, // currency
  medgrossrent: function(d) { return d + '%' }, // percentage
}

var descriptions = {
  medhhinc: "The <b>median household income</b> in Boston between 2009 and 2013 was <b>$53,601</b>. <span id='color-0'>Green</span> tracts have higher median household incomes. <span id='color-1'>Purple</span> tracts have lower median household incomes.",
  medgrossrent: "A <em>rent-burdened household</em> spends more than 30% of their household income on rent. This map shows <b>median gross rent as a percentage of household income (GRAPI)</b>. Darker tracts have a higher median GRAPI.",
}

function colorScale(selected, min, mid, max) {
  if (selected == 'medhhinc') {
    return d3.scale.linear()
      .domain([min, mid, max])
      .range(colorRanges['medhhinc'])
  } else if (selected == 'medgrossrent') {
    return d3.scale.linear()
      .domain([min, mid, max])
      .range(colorRanges[selected])
  }
}

var colorRanges = {
  medhhinc: [
    '#7b3294',
    '#ffffbf',
    '#008837',
  ],
  medgrossrent: [
    '#2c7bb6',
    '#ffffbf',
    '#d7191c',
  ],
}

// Show the about modal
$('#about-modal').modal('show').addClass('fade');

// Initialize the map
var theMap = L.map('map', { zoomControl: false, attributionControl: false }).setView([42.3201, -71.0789], 12);
new L.Control.Zoom({ position: 'bottomright' }).addTo(theMap);

// Initialize the tile layer and add it to the map.
var tiles = L.tileLayer('http://{s}.tile.stamen.com/terrain-lines/{z}/{x}/{y}.{ext}', {
	attribution: "Map tiles by <a href='http://stamen.com'>Stamen Design</a>, <a href='http://creativecommons.org/licenses/by/3.0'>CC BY 3.0</a> &mdash; Map data &copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
	subdomains: 'abcd',
	minZoom: 0,
	maxZoom: 20,
	ext: 'png'
}).addTo(theMap);

L.control.attribution({
  position: 'bottomleft',
  prefix: "<a href='http://leafletjs.com' title='A JS library for interactive maps'>Leaflet</a>"
}).addTo(theMap);

// Load the data
d3.json('data/boston-neighborhoods.json', neighborhoodsLoaded);
d3.csv('data/boston-data.csv', parse, censusLoaded);

// Draw neighborhoods
function neighborhoodsLoaded(err, data) {
  function onEachFeature(feature, layer) {
    var center = layer.getBounds().getCenter();

    L.marker([center.lat, center.lng], {
        icon: L.divIcon({
            className: 'text-labels',
            html: feature.properties.Name
        }),
        zIndexOffset: 1000
    }).addTo(theMap);
  }

  L.geoJson(data, {
    style: { color: 'none', fillColor: 'none', },
    onEachFeature: onEachFeature,
  }).addTo(theMap);
}

// Keep a map of tracts that will be used
// to look up values for the leaflet overlay
var tractsById = d3.map()

// Parse the rows of the CSV, coerce strings to nums
function parse(row) {
  function each(d) {
    if (d == '-0') {
      return null;
    } else if (d == '50.0+') {
      return 50;
    } else {
      return +d;
    }
  }

  var parsedRow = {
    // prentocc: +row['prentocc'],
    tract: +row['GEO.id2'],
    // punemployed: +row['punemploy'],
    // homeownership: +row['homeownership'],
    medhhinc: each(row['medhhinc']),
    medgrossrent: each(row['medgrossrent']),
  }

  tractsById.set(row['GEO.id2'], parsedRow);

  return parsedRow;
}

function censusLoaded(err, rows) {
  // Populate the data dropdown
  var optionsList = _.without(Object.keys(rows[0]), 'tract'),
      select = d3.select('#info-opts'),
      $select = $('#info-opts');

  select
    .selectAll('option')
    .data(optionsList).enter()
    .append('option')
    .attr('value', function(d) {return d})
    .each(function(d) {
      var option = d3.select(this).attr('value')
      if (option == 'medhhinc') {
        d3.select(this).property('selected')
      }
    })
    .text(function(d) {return labels[d]});

  // Refresh select options
  $select.selectpicker('refresh');

  var currentLayer;

  // Draw a new map and key. Kicks off everything.
  function changeData(e) {
    var selected = $(this).find('option:selected').val(),
        sorted = parseRows(rows, selected),
        min = d3.min(sorted, function(d) { return d.value }),
        mid = middles[selected],
        max = d3.max(sorted, function (d) { return d.value }),
        width = 240;

    // Update Info Panel
    $('.navbar-brand').html(labels[selected]);
    $('#info-desc').html(descriptions[selected]);
    $('#color-0').css('color', colorRanges[selected][2]);
    $('#color-1').css('color', colorRanges[selected][0]);

    // Axes
    var color = colorScale(selected, min, mid, max)
    var x = d3.scale.linear()
      .domain([min, max])
      .range([0, width])

    drawKey(selected, min, mid, max, color, x);

    if (currentLayer) {
      theMap.removeLayer(currentLayer);
      currentLayer = drawMapLayer(selected, color, x);
    } else {
      currentLayer = drawMapLayer(selected, color, x);
    }
  }

  // Change map type an init the map
  $select.on('change', changeData)
  $select.change();
}

function drawKey(selected, min, mid, max, color, x) {
  var percent = d3.format('.0%'),
      height = 10

  // Select the SVG for the key
  var key = d3.select('#selected-tract-key')
    .datum({ min: min, mid: mid, max: max})
    .style('width', '100%')
    .attr('height', height)


  // Append the linearGradient to the svg defs
  var defs = d3.select('#selected-tract-key-defs')
    .datum({ min: min, mid: mid, max: max })

  // Update gradient partition colors
  d3.select('#gradient1-stop1')
    .datum({ min: min })
    .attr('stop-color', function(d) { return color(d.min) })

  d3.select('#gradient1-stop2')
    .datum({ mid: mid })
    .attr('stop-color', function(d) { return color(d.mid) })

  d3.select('#gradient2-stop1')
    .datum({ mid: mid })
    .attr('stop-color', function(d) { return color(d.mid) })

  d3.select('#gradient2-stop2')
    .datum({ max: max })
    .attr('stop-color', function(d) { return color(d.max) })

  // Update gradient partition sizes
  key.select('#gradient1-bar')
    .datum({mid: mid})
    .attr('transform', 'translate(0, 5)')
    .attr('width', function(d) { return x(d.mid) })
    .attr('height', height)

  key.select('#gradient2-bar')
    .datum({mid: mid})
    .attr('transform', function(d) { return 'translate('+x(mid)+',5)' })
    .attr('width', function(d) { return x(max) - x(mid) })
    .attr('height', height)

  var axis = d3.svg.axis()
    .scale(x)
    .tickFormat(formats[selected])
    .tickValues([min, mid, max])

  key
    .append('g').attr('class', 'axis')

  key.selectAll('.axis')
    .attr('transform', 'translate(0,'+(height)+')')
    .call(axis)

  key
    .datum({mid: mid}) // Not used, just need to append line once
    .append('line')
      .attr('id', 'selected-tract-value-line')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
}

function parseRows(rows, selected) {
  return _(rows)
    .map(function(row) {
      return {
        tract: row.tract,
        value: row[selected],
      }
    })
    .sortBy('value')
    .reverse()
    .value();
}

/*============================================================================*/
/* LEAFLET MAP                                                                */
/*============================================================================*/
function drawMapLayer(selected, color, x) {
  // Plot Census Tracts
  // ==================
  // + Create a base layer and attach event handlers
  // + Load the census tract TopoJSON with the base layer

  // Keep track of the last tract that was clicked
  // so we can reset the style
  var lastTract;

  var baseLayer = L.geoJson(null, {
    style: function(feature) {
      function fill(id) {
        var tract = tractsById.get(id);

        if (tract && tract[selected]) {
          return color(tract[selected]);
        } else {
          return 'none';
        }
      }

      return {
        fillColor: fill(feature.properties.GEOID10),
        weight: 0,
        fillOpacity: .65
      };
    },

    onEachFeature: function(feature, layer) {
      function focus(e) {
        // Highlight tract on map
        e.target.setStyle({ weight: 3, color: 'black'})

        // Update selected tract panel
        $panel = $('#selected-tract'),
        $panelValue = $('#selected-tract-value');

        // Unhide the selected tract panel
        $panel.toggleClass('invisible')

        // Position the panel below the event
        $panel.css({
          position: 'absolute',
          left: e.containerPoint.x - 30,
          top: e.containerPoint.y + 100
        })

        // Update the selected tract panel with the tract value
        var value = tractsById.get(feature.properties.GEOID10)[selected];
        // $panelValue.text(formats[selected](value) +' '+ labels[selected])
        $panelValue.text(formats[selected](value))

        showValOnKey(value);
      }

      function showValOnKey(value) {
        // Update the key
        d3.select('#selected-tract-value-line')
          .attr('x1', x(value))
          .attr('y1', 0)
          .attr('x2', x(value))
          .attr('y2', 15)
      }

      // Event handlers for the layer
      function mouseover(e) {
        focus(e)

        if (!L.Browser.ie && !L.Browser.opera) {
          e.target.bringToFront();
        }
      }

      function mouseout(e) {
        focus(e)

        baseLayer.resetStyle(e.target);
      }

      function click(e) {
        var value = tractsById.get(feature.properties.GEOID10)[selected];
        showValOnKey(value);

        e.target.setStyle({ weight: 3, color: 'black'})

        if (lastTract) {
          baseLayer.resetStyle(lastTract)
          lastTract = e.target;
        } else {
          lastTract = e.target;
        }

        if (!L.Browser.ie && !L.Browser.opera) {
          e.target.bringToFront();
        }
      }

      // Attach the event handlers to each tract
      var value = tractsById.get(feature.properties.GEOID10)[selected]
      if (value) {
        layer.on({
          mouseover: mouseover,
          mouseout: mouseout,
          click: click,
        });
      }
    },
  })

  // Load TopoJSON and add to map
  return omnivore.topojson('data/tracts2010topo.json', {}, baseLayer).addTo(theMap)
}

