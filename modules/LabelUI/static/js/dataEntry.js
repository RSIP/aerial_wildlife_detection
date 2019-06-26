/*
    Definition of a data entry, as shown on a grid on the screen.

    2019 Benjamin Kellenberger
 */

 class AbstractDataEntry {
     /*
        Abstract base class for data entries.
     */
    constructor(entryID, properties) {
        this.entryID = entryID;
        this.canvasID = entryID + '_canvas';
        this.fileName = properties['fileName'];

        this._setup_viewport();
        this._setup_markup();
        this._createImageEntry();
        this._parseLabels(properties);
    }

    _setup_viewport() {
        var self = this;
        if(window.dataType == 'images') {
            // create canvas
            this.canvas = $('<canvas id="'+this.canvasID+'" width="'+window.defaultImage_w+'" height="'+window.defaultImage_h+'"></canvas>');
            this.canvas.ready(function() {
                self.viewport.resetViewport();
            });
            this.canvas.css('cursor', 'crosshair');
            this.viewport = new ImageViewport(this.canvas);

        } else {
            // maps
            throw Error('Maps not yet implemented.');
        }
    }

    _addElement(element) {
        var key = element['annotationID'];
        if(element['type'] == 'annotation') {
            this.annotations[key] = element;
        } else if(element['type'] == 'prediction' && window.showPredictions) {
            this.predictions[key] = element;
        }
        this.viewport.addRenderElement(element.getRenderElement());
    }

    _updateElement(element) {
        var key = element['annotationID'];
        if(element['type'] == 'annotation') {
            this.annotations[key] = element;
        } else if(element['type'] == 'prediction') {
            this.predictions[key] = element;
        }
        this.viewport.updateRenderElement(
            this.viewport.indexOfRenderElement(element.getRenderElement()),
            element.getRenderElement()
        );
    }

    _removeElement(element) {
        this.viewport.removeRenderElement(element.getRenderElement());
        if(element['type'] == 'annotation') {
            delete this.annotations[element['annotationID']];
        } else if(element['type'] == 'prediction') {
            delete this.predictions[element['annotationID']];
        }
    }

    getAnnotationType() {
        throw Error('Not implemented.');
    }

    getAnnotationControls() {
        throw Error('Not implemented.');
    }

    _parseLabels(properties) {
        /*
            Iterates through properties object's entries "predictions" and "annotations"
            and creates new primitive instances each.
            Might automatically convert predictions and carry them over to the annotations
            if applicable and specified in the project settings.
        */
        this.predictions = {};
        this.annotations = {};

        if(window.showPredictions || window.carryOverPredictions && properties.hasOwnProperty('predictions')) {
            if(window.showPredictions) {
                // add predictions as static, immutable objects
                for(var key in properties['predictions']) {
                    var prediction = new Annotation(key, properties['predictions'][key], 'prediction');
                    this._addElement(prediction);
                }
            }

            if(window.carryOverPredictions) {
                // predictions need to be added to 'annotations' object; check if conversion
                // required and convert accordingly. Also set annotation to "changed", since we
                // assume the user to have verified the prediction.
                if(window.annotationType == 'labels') {
                    // need image-wide labels
                    if(window.predictionType == 'points' || window.predictionType == 'boundingBoxes') {
                        // check carry-over rule
                        if(window.carryOverRule == 'maxConfidence') {
                            // select arg max
                            var maxConf = -1;
                            var argMax = null;
                            for(var key in properties['predictions']) {
                                var predConf = properties['predictions'][key]['confidence'];
                                if(predConf > maxConf) {
                                    maxConf = predConf;
                                    argMax = key;
                                }
                            }
                            if(argMax != null) {
                                // construct new classification entry
                                var id = properties['predictions'][key]['id'];
                                var label = properties['predictions'][key]['label'];
                                var anno = new Annotation(window.getCurrentDateString(), {'id':id, 'label':label, 'confidence':maxConf}, 'annotation');
                                anno.setProperty('changed', true);
                                this._addElement(anno);
                            }
                        } else if(window.carryOverRule == 'mode') {
                            var counts = {};
                            for(var key in properties['predictions']) {
                                var prediction = new Annotation(window.getCurrentDateString(), properties['predictions'][key], 'prediction');
                                if(!(counts.hasOwnProperty(prediction.label))) {
                                    counts[label] = 0;
                                }
                                counts[label] += 1;
                            }
                            // find mode
                            var count = -1;
                            var argMax = null;
                            for(var key in counts) {
                                if(counts[key] > count) {
                                    count = counts[key];
                                    argMax = key;
                                }
                            }
                            // add new label annotation
                            if(argMax != null) {
                                var anno = new Annotation(window.getCurrentDateString(), {'label':argMax}, 'annotation');
                                anno.setProperty('changed', true);
                                this._addElement(anno);
                            }
                        }
                    }
                } else if(window.annotationType == 'points' && window.predictionType == 'boundingBoxes') {
                    // remove width and height
                    for(var key in properties['predictions']) {
                        var props = properties['predictions'][key];
                        delete props['width'];
                        delete props['height'];
                        var anno = new Annotation(window.getCurrentDateString(), props, 'annotation');
                        this._addElement(anno);
                    }
                } else if(window.annotationType == 'boundingBoxes' && window.predictionType == 'points') {
                    // add default width and height
                    for(var key in properties['predictions']) {
                        var props = properties['predictions'][key];
                        props['width'] = window.defaultBoxSize_w;
                        props['height'] = window.defaultBoxSize_h;
                        var anno = new Annotation(window.getCurrentDateString(), props, 'annotation');
                        anno.setProperty('changed', true);
                        this._addElement(anno);
                    }
                } else if(window.annotationType == window.predictionType) {
                    // no conversion required
                    for(var key in properties['predictions']) {
                        var anno = new Annotation(window.getCurrentDateString(), properties['predictions'][key], 'annotation');
                        anno.setProperty('changed', true);
                        this._addElement(anno);
                    }
                }

            }
        }

        if(properties.hasOwnProperty('annotations')) {
            for(var key in properties['annotations']) {
                //TODO: make more failsafe?
                var annotation = new Annotation(key, properties['annotations'][key], 'annotation');
                // Only add annotation if it is of the correct type.
                // if(annotation.getAnnotationType() == this.getAnnotationType()) {     //TODO: disabled for debugging purposes
                this._addElement(annotation);
                // }
            }
        }
    }

    _createImageEntry() {
        this.imageEntry = new ImageElement(this.entryID + '_image', this.viewport, this.getImageURI());
        this.viewport.addRenderElement(this.imageEntry);
    }

    _setup_markup() {
        var colSize = Math.round(12 / window.numImages_x);  // for bootstrap
        this.markup = $('<div class="entry box-shadow col-sm-' + colSize + '"></div>');
        this.markup.append(this.canvas);
        var self = this;
    }

    getImageURI() {
        return window.dataServerURI + this.fileName + '?' + Date.now();
    }

    getProperties(minimal, onlyUserAnnotations) {
        var props = { 'id': this.entryID };
        props['annotations'] = [];
        for(var key in this.annotations) {
            if(!onlyUserAnnotations || this.annotations[key].getChanged())
                props['annotations'].push(this.annotations[key].getProperties(minimal));
        }
        if(!minimal) {
            props['fileName'] = this.fileName;
            props['predictions'] = {};
            if(!onlyUserAnnotations) {
                for(var key in this.predictions) {
                    props['predictions'][key] = this.predictions[key].getProperties(minimal);
                }
            }
        }
        return props;
    }

    render() {
        this.viewport.render();
    }
 }




 class ClassificationEntry extends AbstractDataEntry {
     /*
        Implementation for image classification.
        Expected keys in 'properties' input:
        - entryID: identifier for the data entry
        - fileName: name of the image file to retrieve from data server
        - predictedLabel: optional, array of label ID strings for model predictions
        - predictedConfidence: optional, float for model prediction confidence

        If predictedLabel is provided, a thin border tinted according to the
        arg max (i.e., the predicted label) is drawn around the image.

        As soon as the user clicks into the image, a thick border is drawn,
        colored w.r.t. the user-selected class. A second click removes the user
        label again.
     */
    constructor(entryID, properties) {
        super(entryID, properties);

        if(this.labelInstance == null) {
            // add a default, blank instance if nothing has been predicted or annotated yet
            var label = (window.enableEmptyClass ? window.labelClassHandler.getActiveClassID() : null);
            this._addElement(new Annotation(window.getCurrentDateString(), {'label':label}, 'annotation'));
        }

        this._setup_markup();
    }

    getAnnotationType() {
        return 'label';
    }

    getAnnotationControls() {
        return null;
    }

    _addElement(element) {
        // allow only one label for classification entry
        if(element['type'] == 'annotation') {
            if(Object.keys(this.annotations).length > 0) {
                // replace current annotation
                var key = Object.keys(this.annotations)[0];
                this.viewport.removeRenderElement(this.annotations[key]);
                delete this.annotations[key];
            }

            // add new annotation from existing
            key = element['annotationID'];
            var anno = new Annotation(key, {'label':element['label']}, element['type']);
            this.annotations[key] = anno;
            this.viewport.addRenderElement(anno.getRenderElement());
            this.labelInstance = anno;
            
        } else if(element['type'] == 'prediction' && window.showPredictions) {
            this.predictions[key] = element;
            this.viewport.addRenderElement(element.getRenderElement());
        }
    }

    _setup_markup() {
        var self = this;
        super._setup_markup();
        $(this.canvas).css('cursor', 'pointer');

        this.hoverTextElement = new HoverTextElement(this.entryID + '_hoverText', null, null, 'validArea', 5);
        this.viewport.addRenderElement(this.hoverTextElement);

        // click handler
        this.markup.click(function(event) {
            self.toggleUserLabel(event.altKey);
        });

        // tooltip for label change
        this.markup.mousemove(function(event) {
            var pos = self.viewport.getRelativeCoordinates(event, 'validArea');
            self.hoverTextElement.position = pos;
            if(event.altKey) {
                self.hoverTextElement.setProperty('text', 'mark as unlabeled');
            }
            if(self.labelInstance == null) {
                self.hoverTextElement.setProperty('text', 'set label to "' + window.labelClassHandler.getActiveClassName() + '"');
            } else if(self.labelInstance.label != window.labelClassHandler.getActiveClassID()) {
                self.hoverTextElement.setProperty('text', 'change label to "' + window.labelClassHandler.getActiveClassName() + '"');
            } else {
                self.hoverTextElement.setProperty('text', null);
            }
            self.render();
        });
        this.markup.mouseout(function(event) {
            self.hoverTextElement.setProperty('text', null);
            self.render();
        });
    }

    toggleUserLabel(forceRemove) {
        /*
            Toggles the classification label as follows:
            - if the annotation has no label, it is set to the user-specified class
            - if it has the same label as specified, the label is removed if the background
              class is enabled
            - if it has a different label than specified, the label is changed
            - if forceRemove is true, the label is removed (if background class is enabled)
        */
        if(forceRemove && window.enableEmptyClass) {
            this.labelInstance.setProperty('label', null);

        } else {
            var activeLabel = window.labelClassHandler.getActiveClassID();
            if(this.labelInstance == null) {
                // add new annotation
                var anno = new Annotation(window.getCurrentDateString(), {'label':activeLabel}, 'annotation');
                this._addElement(anno);

            } else {
                if(this.labelInstance.label == activeLabel && window.enableEmptyClass) {
                    // same label; disable
                    this.labelInstance.setProperty('label', null);

                } else {
                    // different label; update
                    this.labelInstance.setProperty('label', activeLabel);
                }
            }
        }
        this.render();
    }
 }




class PointAnnotationEntry extends AbstractDataEntry {
    /*
        Implementation for point annotations (note: just image coordinates,
        no bounding boxes).
     */
    constructor(entryID, properties) {
        super(entryID, properties);
        this._setup_markup();
    }

    getAnnotationType() {
        return 'point';
    }

    getAnnotationControls() {
        return null;
    }

    _setup_markup() {
        var self = this;
        super._setup_markup();

        this.hoverTextElement = new HoverTextElement(this.entryID + '_hoverText', null, null, 'validArea', 5);
        this.viewport.addRenderElement(this.hoverTextElement);

        // interaction handlers
        this.canvas.mousemove(function(event) {
            self._canvas_mousein(event);
        });
        this.canvas.keydown(function(event) {
            //TODO: make hover text change when delete key is held down
            self._canvas_mousein(event);
        });
        this.canvas.mouseleave(function(event) {
            self._canvas_mouseout(event);
        });
        this.canvas.mouseup(function(event) {
            self._canvas_mouseup(event);
        });
    }


    /* canvas interaction functionalities */
    _getClosestPoint(coordinates) {
        /*
            Returns the point whose coordinates form the closest Euclidean
            distance to the provided coordinates, if within a default
            tolerance threshold. Otherwise returns null.
        */
        //TODO: tolerance is not converted to 0-1 canvas scale...
        var minDist = 1e9;
        var argMin = null;
        for(var key in this.predictions) {
            if(this.predictions[key].getRenderElement().hasOwnProperty('x')) {
                var dist = this.predictions[key].getRenderElement().euclideanDistance(coordinates);
                if((dist < minDist) && (dist <= window.annotationProximityTolerance)) {
                    minDist = dist;
                    argMin = this.predictions[key];
                }
            }
        }
        for(var key in this.annotations) {
            if(this.annotations[key].getRenderElement().hasOwnProperty('x')) {
                var dist = this.annotations[key].getRenderElement().euclideanDistance(coordinates);
                if((dist < minDist) && (dist <= window.annotationProximityTolerance)) {
                    minDist = dist;
                    argMin = this.annotations[key];
                }
            }
        }
        return argMin;
    }

    _canvas_mousein(event) {
        var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
        this.hoverTextElement.setProperty('text', null);
        this.hoverTextElement.setProperty('position', coords);

        // check if another point is close-by and show message
        var closest = this._getClosestPoint(coords);
        if(closest != null) {
            // point found
            if(event.altKey) {
                this.hoverTextElement.setProperty('text', 'remove point');
            } else if(closest['label'] != window.labelClassHandler.getActiveClassID()) {
                this.hoverTextElement.setProperty('text', 'change to "' + window.labelClassHandler.getActiveClassName() + '"');
            }
        }
        this.render();
    }

    _canvas_mouseout(event) {
        // clear hover text
        this.hoverTextElement.setProperty('text', null);
        this.render();
    }

    _canvas_mouseup(event) {
        var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
        console.log(coords)
        // check if another point is close-by
        var closest = this._getClosestPoint(coords);
        if(closest != null) {
            // point found; alter or delete it
            if(event.altKey) {
                // remove point
                //TODO: undo history?
                this._removeElement(closest);
            } else if(closest['label'] != window.labelClassHandler.getActiveClassID()) {
                // change label of closest point
                closest.setProperty('label', window.labelClassHandler.getActiveClassID());
            }
            // this._updateElement(closest);
        } else if(!event.altKey) {
            // no point in proximity; add new
            var key = this['entryID'] + '_' + coords[0] + '_' + coords[1];
            var props = {
                'x': coords[0],
                'y': coords[1],
                'label': window.labelClassHandler.getActiveClassID()
            };
            var annotation = new Annotation(key, props, 'annotation');
            this._addElement(annotation);
        }
        this.render();
    }
}




class BoundingBoxAnnotationEntry extends AbstractDataEntry {
    /*
        Implementation for bounding box annotations.
     */
    constructor(entryID, properties) {
        super(entryID, properties);
        this._setup_markup();
    }

    getAnnotationType() {
        return 'boundingBox';
    }

    getAnnotationControls() {
        //TODO
        return $('<div class="annotationControls">' +
                '<button onclick=>Add box</button>' +
                '</div>');
    }

    _setup_markup() {
        var self = this;
        super._setup_markup();
        this.canvas.css('cursor', 'pointer');

        this.hoverTextElement = new HoverTextElement(this.entryID + '_hoverText', null, null, 'canvas', 5);
        this.viewport.addRenderElement(this.hoverTextElement);

        // interaction handlers
        this.viewport.addCallback(this.entryID, 'mousedown', function(event) {
            self._canvas_mousedown(event);
        });
        this.viewport.addCallback(this.entryID, 'mousemove', function(event) {
            self._canvas_mousemove(event);
        });
        this.viewport.addCallback(this.entryID, 'mouseup', function(event) {
            self._canvas_mouseup(event);
        });
        this.viewport.addCallback(this.entryID, 'mouseleave', function(event) {
            self._canvas_mouseleave(event);
        });
    }

    _toggleActive(event) {
        /*
            Sets boxes active or inactive as follows:
            - if a box encompasses the event's coordinates:
                - and is not active: it is turned active
                - and is active: nothing happens
                Any other box that is active _and_ contains the point stays active.
                Other boxes that are active and do not contain the point get deactivated,
                unless the shift key is held down.
            - if no box contains the coordinates, every single one is deactivated.
        */
        var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
        var minDist = 1e9;
        var argMin = null;
        for(var key in this.annotations) {
            var bbox = this.annotations[key].getRenderElement();
            if(bbox.containsPoint(coords)) {
                var dist = bbox.euclideanDistance(coords);
                if(dist < minDist) {
                    minDist = dist;
                    argMin = key;
                }
                if(!(event.shiftKey && this.annotations[key].isActive())) {
                    // deactivate
                    this.annotations[key].setActive(false, this.viewport);
                }
            } else if(!event.shiftKey) {
                // bbox outside and no shift key; deactivate
                this.annotations[key].setActive(false, this.viewport);
            }
        }

        // handle closest
        if(argMin == null) {
            // deactivate all
            for(var key in this.annotations) {
                this.annotations[key].setActive(false, this.viewport);
            }
        } else {
            // set closest one active
            this.annotations[argMin].setActive(true, this.viewport);
        }
    }

    _canvas_mouseout(event) {
        // clear hover text
        this.hoverTextElement.setProperty('text', null);
        this.render();
    }

    _createAnnotation(event) {
        var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
        var props = {
            'x': coords[0],
            'y': coords[1],
            'width': 0,
            'height': 0,
            'label': window.labelClassHandler.getActiveClassID()
        };
        var anno = new Annotation(window.getCurrentDateString(), props, 'annotation');
        this._addElement(anno);
        anno.getRenderElement().registerAsCallback(this.viewport);
        anno.getRenderElement().setActive(true, this.viewport);
        // manually fire mousedown event on annotation
        anno.getRenderElement()._mousedown_event(event, this.viewport);
    }

    _deleteActiveAnnotations(event) {
        var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
        var minDist = 1e9;
        var argMin = null;
        for(var key in this.annotations) {
            var bbox = this.annotations[key].getRenderElement();
            if(bbox.containsPoint(coords)) {
                if(this.annotations[key].isActive()) {
                    this.annotations[key].getRenderElement().deregisterAsCallback(this.viewport);
                    this._removeElement(this.annotations[key]);
                    return;
                }
                var dist = bbox.euclideanDistance(coords);
                if(dist < minDist) {
                    minDist = dist;
                    argMin = key;
                }
            }
        }

        if(argMin != null) {
            // no active annotation found, but clicked within another one; delete it
            this._removeElement(this.annotations[argMin]);
        }
    }

    _drawCrosshairLines(coords, visible) {
        if(this.crosshairLines == null && visible) {
            // create
            var vertLine = new LineElement(this.entryID + '_crosshairX', coords[0], 0, coords[0], window.defaultImage_h,
                                window.styles.crosshairLines.strokeColor,
                                window.styles.crosshairLines.lineWidth,
                                window.styles.crosshairLines.lineDash,
                                1);
            var horzLine = new LineElement(this.entryID + '_crosshairY', 0, coords[1], window.defaultImage_w, coords[1],
                                window.styles.crosshairLines.strokeColor,
                                window.styles.crosshairLines.lineWidth,
                                window.styles.crosshairLines.lineDash,
                                1);
            this.crosshairLines = new ElementGroup(this.entryID + '_crosshairLines', [vertLine, horzLine], 1);
            this.viewport.addRenderElement(this.crosshairLines);

        } else {
            if(visible) {
                // update
                this.crosshairLines.elements[0].setProperty('startX', coords[0]);
                this.crosshairLines.elements[0].setProperty('endX', coords[0]);
                this.crosshairLines.elements[1].setProperty('startY', coords[1]);
                this.crosshairLines.elements[1].setProperty('endY', coords[1]);
            } else {
                // remove
                this.viewport.removeRenderElement(this.crosshairLines);
                this.crosshairLines = null;
            }
        }
    }

    _canvas_mousedown(event) {
        this.mouseDrag = true;

        // check functionality
        if(window.interfaceControls.action == window.interfaceControls.actions.ADD_ANNOTATION) {
            // set all currently active boxes inactive
            for(var key in this.annotations) {
                this.annotations[key].setActive(false, this.viewport);
            }

            // start creating a new bounding box
            this._createAnnotation(event);
        }
        this.render();
    }

    _canvas_mousemove(event) {
        var coords = this.viewport.getRelativeCoordinates(event, 'canvas');

        // update crosshair lines
        this._drawCrosshairLines(coords, window.interfaceControls.action==window.interfaceControls.actions.ADD_ANNOTATION);

        // update hover text
        var hoverText = null;
        switch(window.interfaceControls.action) {
            case window.interfaceControls.actions.ADD_ANNOTATION:
                hoverText = 'add new \"' + window.labelClassHandler.getActiveClassName() + '"';
                break;
            case window.interfaceControls.actions.REMOVE_ANNOTATIONS:
                var numActive = 0;
                for(var key in this.annotations) {
                    if(this.annotations[key].isActive()) numActive++;
                }
                if(numActive>0) {
                    hoverText = 'Remove ' + numActive + ' annotation';
                    if(numActive>1) hoverText += 's';
                }
                break;
            case window.interfaceControls.actions.DO_NOTHING:
                //TODO: buggy
                for(var key in this.annotations) {
                    if(this.annotations[key].isActive() && 
                        this.annotations[key].label != window.labelClassHandler.getActiveClassID()) {
                        hoverText = 'Change label to "' + window.labelClassHandler.getActiveClassName() + '"';
                        break;
                    }
                }
                break;
        }
        this.hoverTextElement.setProperty('position', coords);
        this.hoverTextElement.setProperty('text', hoverText);

        this.render();
    }

    _canvas_mouseup(event) {
        // this.mouseDrag = false;

        // check functionality
        if(window.interfaceControls.action == window.interfaceControls.actions.ADD_ANNOTATION) {
            // new annotation completed
            //TODO: may fire before other rectangle's events, making them unwantedly active while finishing new rect
            window.interfaceControls.action = window.interfaceControls.actions.DO_NOTHING;

        } else if(window.interfaceControls.action == window.interfaceControls.actions.REMOVE_ANNOTATIONS) {
            this._deleteActiveAnnotations(event);
            window.interfaceControls.action = window.interfaceControls.actions.DO_NOTHING;

        } else if(window.interfaceControls.action == window.interfaceControls.actions.EDIT_ANNOTATION) {
            // reset action
            window.interfaceControls.action = window.interfaceControls.actions.DO_NOTHING;

        } else if(window.interfaceControls.action == window.interfaceControls.actions.DO_NOTHING) {
            // update annotations to current label (if active)
            var coords = this.viewport.getRelativeCoordinates(event, 'validArea');
            for(var key in this.annotations) {
                if(this.annotations[key].isActive()) {
                    if(event.shiftKey || this.annotations[key].getRenderElement().containsPoint(coords)) {
                        this.annotations[key].setProperty('label', window.labelClassHandler.getActiveClassID());
                    }
                }
            }

            // activate or deactivate
            this._toggleActive(event);
        }

        this.render();
    }

    _canvas_mouseleave(event) {
        this.hoverTextElement.setProperty('text', null);
        this._drawCrosshairLines(null, false);
        this.render();
    }
}