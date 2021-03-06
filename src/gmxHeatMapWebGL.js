/*
 (c) 2014, Sergey Alekseev salekseev@scanex.ru
 Leaflet.HeatMapWebGL, plugin for Gemixer layers.
*/
L.HeatMapWebGL = L.Class.extend({

    options: {
        pane: 'markerPane',
        size: 25,
        intensity: 0.1,
        gradientTexture: false,
        alphaRange: 0.2
    },

    setData: function (data) {
        this.data = data;
    },

    setIntensity: function (val) {
        this.options.intensity = val;
        this.redraw();
    },

    initialize: function (map, options) {
        this.data = [];
        L.setOptions(this, options);
    },

    redraw: function () {
        if (this._map && !this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        map.getPanes()[this.options.pane].appendChild(this._canvas);

        map.on('moveend', this.redraw, this);
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._redraw();
    },

    onRemove: function (map) {
        map.getPanes()[this.options.pane].removeChild(this._canvas);

        map.off('moveend', this.redraw, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        if (!this._canvas.parentNode) {
            map.getPanes()[this.options.pane].appendChild(this._canvas);
        }
        map.addLayer(this);
        return this;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            pixelBoundsMin = this._map.getPixelBounds().min;

        var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
        if (pixelBoundsMin.y < 0) offset.y += pixelBoundsMin.multiplyBy(-scale).y;

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        var options = this.options;
        this.WebGLHeatMap = createWebGLHeatmap({ 
            canvas: canvas, 
            gradientTexture: options.gradientTexture, 
            alphaRange: [0, options.alphaRange]
        });
    },

    _updateBbox: function (zoom) {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
            ww = L.gmxUtil.tileSizes[1],
            ww2 = 2 * ww,
            m1 = L.Projection.Mercator.project(southWest),
            m2 = L.Projection.Mercator.project(northEast),
            w = (m2.x - m1.x) / 2,
            center = (m1.x + m2.x) / 2;
        center %= ww2;
        if (center > ww) center -= ww2;
        else if (center < -ww) center += ww2;

        this.mInPixel = 256 / L.gmxUtil.tileSizes[zoom];
        
        this._ctxShift = [(w - center) * this.mInPixel, m2.y * this.mInPixel];
    },

    _redraw: function () {
        var _map = this._map,
            size = _map.getSize(),
            _canvas = this._canvas,
            mapTop = _map._getTopLeftPoint(),
            topLeft = _map.containerPointToLayerPoint([0, mapTop.y < 0 ? -mapTop.y : 0]);

        L.DomUtil.setPosition(_canvas, topLeft);
        _canvas.width = size.x; _canvas.height = size.y;
        this.WebGLHeatMap.adjustSize();

        var heatmap = this.WebGLHeatMap;
        heatmap.clear();
        if (this.data) {
            this._updateBbox(this._map._zoom);
            var dataLen = this.data.length,
                valScale = this._map._zoom * 1,
                options = this.options,
                ctxShift = this._ctxShift,
                mInPixel = this.mInPixel;
            
            for (var i = 0; i < dataLen; i++) {
                var it = this.data[i].properties,
                    val = 'sizeFunc' in options ? options.sizeFunc(it) : options.size,
                    intensity = 'sizeIntensity' in options ? options.sizeIntensity(it) : options.intensity,
                    geo = it[it.length - 1],
                    coord = geo.coordinates;

                heatmap.addPoint(
                    Math.floor(coord[0] * mInPixel + ctxShift[0]),
                    Math.floor(ctxShift[1] - coord[1] * mInPixel),
                    val,
                    intensity
                );
            }
            heatmap.update();
            heatmap.display();
        }
        this._frame = null;
    }
});

L.heatMapWebGL = function (map, options) {
    return new L.HeatMapWebGL(map, options);
};
