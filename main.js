var app = (function () {
  var config = {
        topics: [
          {
            noun: 'raccoon',
            // icon: '',
          },
          {
            noun: 'graffiti',
            singularOnly: true,
          },
          {
            noun: 'pothole',
          },
          {
            noun: 'music',
            singularOnly: true,
          },
          {
            noun: 'dumpster',
          },
          {
            noun: 'food truck',
          },
        ],
        apiUrl: 'http://192.168.103.143:6080/arcgis/rest/services/GSG/GIS311_365DAYS/MapServer/0',
      },
      views = {},
      state = {
        // markers: [],
      },
      map,
      markerLayerGroup;

  return {
    init: function () {
      // initialize views
      this.initViews();

      // initialize map
      this.initMap();

      // listen for hash change event
      window.onhashchange = this.hashChanged.bind(this);

      // trigger on hash change once, in case there's a param
      this.hashChanged();

      // listen for search form submit
      document.querySelector('#search-form')
              .addEventListener('submit', function (e) {
                var val = e.target[0].value;
                window.location.hash = '#/?search=' + val;
              });
    },

    initViews: function () {
      // topic panel
      views.topicPanel = new Vue({
        el: '#topic-panel',
        data: {
          topics: config.topics,
        },
        methods: {
          titleCase: function (str) {
            return str.replace(/\b\S/g, function(t) { return t.toUpperCase() });
          },
          pluralize: function (singular) {
            return singular + 's';
          },
          labelForTopic: function (topic) {
            var noun = topic.noun,
                label = this.titleCase(noun);
            if (!topic.singularOnly) {
              label = this.pluralize(label);
            }
            return label
          },
        },
      });

      // action label
      views.actionLabel = new Vue({
        el: '#action-label',
        data: {
          action: '',
        },
        // computed: {
        //   actionLabel: function () {
        //     var label = this.action;
        //     if (label.length > 0) {
        //       label += '...';
        //     }
        //     return label;
        //   },
        // },
      });
    },

    initMap: function () {
      // create map
      map = L.map('map').setView([39.952388, -75.1658127], 15);

      // add basemap
      L.esri.tiledMapLayer({
        url: '//tiles.arcgis.com/tiles/fLeGjb7u4uXqeF9q/arcgis/rest/services/CityBasemap_Slash/MapServer',
        maxZoom: 22,
      }).addTo(map);

      // create marker layer group
      // markerLayerGroup = L.layerGroup().addTo(map);
      markerLayerGroup = L.featureGroup().addTo(map);
    },

    // util for getting search params
    // https://stackoverflow.com/a/901144/676001
    getParameterByName: function (name, url) {
      if (!url) url = window.location.href;
      name = name.replace(/[\[\]]/g, "\\$&");
      var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
      if (!results) return null;
      if (!results[2]) return '';
      return decodeURIComponent(results[2].replace(/\+/g, " "));
    },

    hashChanged: function () {
      var input = this.getParameterByName('search');
      this.search(input);
    },

    search: function (input) {
      console.log('** search: ' + input + ' **');

      // return if there's no search input
      if (!input || input.length === 0) return;

      views.actionLabel.action = 'Searching...';

      var inputUpper = input.toUpperCase(),
          where = "upper(description) like '% " + inputUpper + "%'";

      // console.log('where', where);

      // build query
      var query = L.esri.query({
        url: config.apiUrl,
      });
      query.where(where);
      query.orderBy('requested_datetime');
      // query.limit(100);
      query.run(this.didGetResults.bind(this));
    },

    didGetResults: function (err, featureCollection, response) {
      console.log('did get results', err, featureCollection, response);

      if (err) {
        console.error(err);
        return;
      }

      // filter out features with no coords
      var features = (featureCollection.features || []);
      features = features.filter(function (feature) {
                    return !!feature.geometry.coordinates;
                  });

      // add to map
      this.addFeaturesToMap(features);

      views.actionLabel.action = features.length + ' results.';
    },

    addFeaturesToMap: function (features) {
      // console.log('add features to map', features);

      // clear out old markers
      markerLayerGroup.clearLayers();

      features.forEach(function (feature) {
        var geom = feature.geometry,
            lngLat = geom.coordinates;

        // skip null geoms
        if (!lngLat) return;

        var lng = lngLat[0],
            lat = lngLat[1],
            latLng = [lat, lng];

        var marker = L.marker(latLng);

        // bind popup
        var props = feature.properties,
            id = props.SERVICE_REQUEST_ID,
            date = moment(props.REQUESTED_DATETIME).format('YYYY-MM-DD'),
            service = props.SERVICE_NAME,
            address = props.ADDRESS,
            status = props.STATUS,
            agency = props.AGENCY_RESPONSIBLE,
            subject = props.SUBJECT,
            description = props.DESCRIPTION,
            mediaUrl = props.MEDIA_URL,
            popupContent = '\
              <table role="grid">\
                <tbody>\
                  <tr>\
                    <th scope="row">ID</th>\
                    <td>' + id + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Date</th>\
                    <td>' + date + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Address</th>\
                    <td>' + address + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Service</th>\
                    <td>' + service + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Agency</th>\
                    <td>' + agency + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Status</th>\
                    <td>' + status + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Subject</th>\
                    <td>' + subject + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Description</th>\
                    <td>' + description + '</td>\
                  </tr>\
                  <tr>\
                    <th scope="row">Photo</th>\
                    <td>' + (mediaUrl ? '<a href="' + mediaUrl + '" target="_blank" class="external">Click here</a>' : 'n/a') + '</td>\
                  </tr>\
                </tbody>\
              </table>\
            ';

        marker.bindPopup(popupContent);

        markerLayerGroup.addLayer(marker);

        // zoom to all markers
        // console.log('marker layer group', markerLayerGroup);
        map.fitBounds(markerLayerGroup.getBounds());
      });
    },
  };
})();

app.init();
