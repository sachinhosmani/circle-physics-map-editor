(function() {
  var svg;
  var shapes = [];
  var lastShapes = [];
  var background;
  var hollow, hollowRadius;
  var xAxis, yAxis;
  var graphSize = 2000;
  var divWidth = 700;
  var divHeight = 700;
  var phoneWidth = simulateScale(100 / 4.3 / 1.1);
  var phoneHeight = simulateScale(100 * 230 / 500 / 4.3 * 1.2);
  var coordinateBar = document.querySelector("#coordinates");
  var shapeToSAT = {};
  var exportChainShapes = [];
  var constrained = true;
  var editMode = false;
  var simulationMode = false;
  var showMarkingLines = false;
  var showPhoneMode = false;
  var curveMode = false;
  var gravity = -37;
  var forceX = 130;
  var oldScrollX = null, oldScrollY  = null;
  function exportScale(n) {
    return n / 30;
  }
  function simulateScale(val) {
    return val * 17;
  }
  function importScale(val) {
    return val * 30;
  }
  var defaultPhysicsValues = {
    circle: {
      friction: 0.2,
      restitution: 0,
      angularDamping: 2.2,
      density: 1.0
    },
    protagonist: {
      friction: 0.2,
      restitution: 0,
      angularDamping: 2.2,
      density: 1
    },
    hollow: {
      friction: 3,
      restitution: 0,
      density: 1.0
    },
    chain: {
      friction: 3,
      restitution: 0,
      density: 1.0
    }
  };
  var defaultColors = {
    static: "#563b1b",
    protagonist: "#936710",
    hollow: "#d89545",
    chain: "#563b1b",
    goal: "#d2bb69",
    background: "#563b1b",
    dynamic: "#434d42",
    point: "grey"
  };
  var UIManager = {
    points: [],
    markingCircle: null,
    markingPoints: [],
    markingLines: [],
    markingBoxes: [],
    displacedX: null,
    displacedY: null,
    STATE_IDLE: 1,
    STATE_START: 2,
    STATE_CIRCLE: 3,
    STATE_POLYGON: 4,
    STATE_CANCELLED: 5,
    STATE_CURVE: 6,
    state: 1,
    onMouseDown: function(x, y) {
      if (simulationMode) return;
      if (editMode) return;
      if (this.state === this.STATE_CANCELLED) {
        return;
      }
      if (this.state === this.STATE_IDLE) {
        this.state = this.STATE_START;
      }
      this.points.push(new SAT.Vector(x, y));
      var markingPoint = drawPoint(x, y);
      markingPoint._x = x;
      markingPoint._y = y;
      this.markingPoints.push(markingPoint);
    },
    onMouseUp: function(x, y) {
      if (simulationMode) return;
      if (this.state === this.STATE_CANCELLED) {
        this.cancelDraw();
        this.state = this.STATE_IDLE;
        return;
      }
      if (this.state === this.STATE_CIRCLE) {
        this.state = this.STATE_IDLE;
        this.markingCircle = null;
        this.points = [];
        this._clearMarkingPoints();
      } else if (this.state === this.STATE_START) {
        this.state = curveMode ? this.STATE_CURVE : this.STATE_POLYGON;
      }
      if (this.state === this.STATE_CURVE) {
        if (this.points.length === 4) {
          drawCurve(this.markingPoints);
          this.state = this.STATE_IDLE;
          this.markingCircle = null;
          this.markingPoints.length = 0;
          this.points = [];
        } else if (this.points.length > 4) {
          this.cancelDraw();
          this.state = this.STATE_IDLE;
        }
      }
    },
    onContextMenu: function(x, y) {
      if (simulationMode) return;
      if (editMode) return;
      if (this.points.length > 1) {
        this.state = this.STATE_IDLE;
        drawChainShape(this.markingPoints);
        this.points = [];
        this.markingPoints.length = 0;
        this.markingCircle = null;
      }
    },
    onMouseMove: function(x, y) {
      if (simulationMode) return;
      if (showMarkingLines) {
        this._clearMarkingLines();
        this._updateMarkingLines(x, y);
      }
      this._clearMarkingBoxes();
      if (!curveMode && (this.state === this.STATE_START || this.state === this.STATE_CIRCLE)) {
        this.state = this.STATE_CIRCLE;
        var r = this.points[0].clone().sub(new SAT.Vector(x, y)).len();
        this._updateMarkingBoxes(r);
        if (!this.markingCircle) {
          this.markingCircle = drawCircle(this.points[0].x, this.points[0].y, r);
        } else {
          updateRadius(this.markingCircle, r);
        }
      }
    },
    cancelDraw: function() {
      this.state = this.STATE_CANCELLED;
      this.points = [];
      this._clearMarkingPoints();
      this.markingCircle = null;
    },
    _clearMarkingPoints: function() {
      this.markingPoints.forEach(function(point) {
        point.shape.remove();
      });
      this.markingPoints.length = 0;
    },
    _clearMarkingLines: function() {
      this.markingLines.forEach(function(line) {
        line.shape.remove();
      });
      this.markingLines.length = 0;
    },
    _clearMarkingBoxes: function() {
      this.markingBoxes.forEach(function(line) {
        line.shape.remove();
      });
      this.markingBoxes.length = 0;
    },
    _updateMarkingLines: function(x, y) {
      var _x = x, _y = y;
      x = mapX(x);
      y = mapY(y);
      var that = this;
      shapes.forEach(function(shape) {
        if (shape.type === ShapeWrapper.TYPE_CIRCLE && (!that.markingCircle ||
          shape.id !== that.markingCircle.id)) {
          var SATShape = shapeToSAT[shape.id];
          if (Math.floor(SATShape.pos.y) === y) {
            var line = drawPolygon([[-graphSize / 2, _y], [graphSize / 2, _y]], true);
            line.shape.stroke({ color: "grey", width: 1 });
            that.markingLines.push(line);
          }
          if (Math.floor(SATShape.pos.x) === x) {
            var line = drawPolygon([[_x, -graphSize / 2], [_x, graphSize / 2]], true);
            line.shape.stroke({ color: "grey", width: 1 });
            that.markingLines.push(line);
          }
        }
      });
      exportChainShapes.forEach(function(shape) {
        if (!shape) {
          return;
        }
        for (var i = shape.length - 1; i >= 0; i--) {
          if (shape[i][1] === _y) {
            var line = drawPolygon([[-graphSize / 2, _y], [graphSize / 2, _y]], true);
            line.shape.stroke({ color: "grey", width: 1 });
            that.markingLines.push(line);
          }
          if (shape[i][0] === _x) {
            var line = drawPolygon([[_x, -graphSize / 2], [_x, graphSize / 2]], true);
            line.shape.stroke({ color: "grey", width: 1 });
            that.markingLines.push(line);
          }
        }
      });
      this.markingPoints.forEach(function(shape) {
        if (shape.y === _y) {
          var line = drawPolygon([[-graphSize / 2, _y], [graphSize / 2, _y]], true);
          line.shape.stroke({ color: "grey", width: 1 });
          that.markingLines.push(line);
        }
        if (shape.x === _x) {
          var line = drawPolygon([[_x, -graphSize / 2], [_x, graphSize / 2]], true);
          line.shape.stroke({ color: "grey", width: 1 });
          that.markingLines.push(line);
        }
      });
    },
    _updateMarkingBoxes: function(r) {
      var that = this;
      shapes.forEach(function(shape) {
        if (shape.type === ShapeWrapper.TYPE_CIRCLE && (!that.markingCircle ||
          shape.id !== that.markingCircle.id)) {
          var SATShape = shapeToSAT[shape.id];
          if (Math.abs(SATShape.r - r) <= 2) {
            that.markingCircle && updateRadius(that.markingCircle, r);
            var x = deMapX(SATShape.pos.x);
            var y = deMapY(SATShape.pos.y);
            var polygon = drawPolygon([
                [x - r, y - r],
                [x - r, y + r],
                [x + r, y + r],
                [x + r, y - r]
            ], true);
            polygon.shape.stroke({ color: "grey", width: 1 });
            that.markingBoxes.push(polygon);
          }
        }
      });
    }
  };
  function ShapeWrapper(shape, type) {
    this.shape = shape;
    this.type = type;
    this.id = ShapeWrapper.ID++;
    this.nature = ShapeWrapper.NATURE_STATIC;
  }
  ShapeWrapper.TYPE_CIRCLE = 1;
  ShapeWrapper.TYPE_POLYGON = 2;
  ShapeWrapper.TYPE_CURVE = 3;
  ShapeWrapper.NATURE_STATIC = 0;
  ShapeWrapper.NATURE_DYNAMIC = 1;
  ShapeWrapper.NATURE_PROTAGONIST = 2;
  ShapeWrapper.NATURE_GOAL = 3;
  ShapeWrapper.colorMap = {};
  ShapeWrapper.colorMap[ShapeWrapper.NATURE_STATIC] = "white";
  ShapeWrapper.colorMap[ShapeWrapper.NATURE_DYNAMIC] = "black";
  ShapeWrapper.colorMap[ShapeWrapper.NATURE_PROTAGONIST] = "green";
  ShapeWrapper.colorMap[ShapeWrapper.NATURE_GOAL] = "red";
  ShapeWrapper.ID = 0;
  function transformCoordinates(event) {
    var div = document.querySelector("#canvasDiv");
    var svg = document.querySelector("svg");
    return new SAT.Vector((event.pageX - svg.offsetLeft + div.scrollLeft - graphSize / 2),
      (graphSize / 2 - (event.pageY - svg.offsetTop + div.scrollTop)));
  }
  function transformCoordinates2(x, y) {
    var div = document.querySelector("#canvasDiv");
    var svg = document.querySelector("svg");
    return new SAT.Vector((x - svg.offsetLeft + div.scrollLeft - graphSize / 2),
      (graphSize / 2 - (y - svg.offsetTop + div.scrollTop)));
  }
  function createSVG() {
    svg = SVG('canvasDiv').size(graphSize, graphSize);
    document.querySelector("svg").addEventListener("mousemove", function(event) {
      var coords = transformCoordinates(event);
      coordinateBar.innerHTML = coords.x +
        ", " + coords.y;
    });
    background = strokeAndFill(svg.rect(graphSize, graphSize).
      move(0, 0), "background");
    drawAxes();
  }
  function drawAxes() {
    xAxis = svg.line(graphSize / 2, 0, graphSize / 2, graphSize).stroke({ width: 1 });
    yAxis = svg.line(0, graphSize / 2, graphSize, graphSize / 2).stroke({ width: 1 });
  }
  function clearAxes() {
    xAxis.remove();
    yAxis.remove();
  }
  function redrawAxes() {
    clearAxes();
    drawAxes();
  }
  function mapX(x) {
    return x + graphSize / 2;
  }
  function mapY(y) {
    return graphSize / 2 - y;
  }
  function deMapX(x) {
    return x - graphSize / 2;
  }
  function deMapY(y) {
    return graphSize / 2 - y;
  }
  function strokeAndFill(obj, type) {
    var color = defaultColors[type];
    if (type == "chain") {
      return obj.stroke({color: defaultColors[type], width: 2});
    }
    return obj.attr({fill: color});
  }
  function makeDraggable(wrapped) {
    wrapped.shape.draggable(function(x, y) {
      return !editMode && checkOverlaps(wrapped, x, y);
    });
    wrapped.shape.dragmove = function(delta, event) {
      redrawAxes();
      updateCode();
      if (wrapped._phoneBoundary) {
        var SATShape = shapeToSAT[wrapped.id];
        wrapped._phoneBoundary.move(SATShape.pos.x - phoneWidth / 2, SATShape.pos.y - phoneHeight / 2);
      }
      //UIManager.cancelDraw();
    };
  }
  function storeShape(shape) {
    shape.shape.mousedown(function() {
      if (!editMode) UIManager.cancelDraw();
      if (shape.type === ShapeWrapper.TYPE_CIRCLE && editMode === true) {
        UIManager.state = UIManager.STATE_CIRCLE;
        UIManager.markingCircle = shape;
        UIManager.points = [new SAT.Vector(deMapX(shapeToSAT[shape.id].pos.x), deMapY(shapeToSAT[shape.id].pos.y))];
      }
    });
    /*shape.shape.mouseup(function() {
      UIManager.cancelDraw();
    });*/
    shapes.push(shape);
    return shape;
  }
  function drawPoint(x, y) {
    var r = 8;
    var shape = new ShapeWrapper(strokeAndFill(svg.circle(2 * r).move(mapX(x - r), mapY(y + r)), "point"), ShapeWrapper.TYPE_CIRCLE);
    shape.x = x;
    shape.y = y;
    return shape;
  }
  function drawHollow(r) {
    hollow = strokeAndFill(svg.circle(2 * r).move(graphSize / 2 - r, graphSize / 2 - r), "hollow");
    redrawAxes();
    hollowRadius = r;
    updateCode();
  }
  function setHollowRadius(r) {
    if (!hollow) {
      return;
    }
    hollowRadius = r;
    hollow.radius(r);
    updateCode();
  }
  function updateRadius(circle, r) {
    circle.shape.radius(r);
    circle.r = r;
    shapeToSAT[circle.id].r = r;
    redrawAxes();
    updateCode();
  }
  function nextNature(shape, x, y) {
    if (shape.nature === ShapeWrapper.NATURE_PROTAGONIST) {
      shape._phoneBoundary.remove();
      shape._phoneBoundary = null;
    }
    shape.nature = (shape.nature + 1) % 4;
    if (shape.nature === ShapeWrapper.NATURE_PROTAGONIST) {
      shape._phoneBoundary = svg.rect(phoneWidth, phoneHeight).fill("none").stroke({ color: "green", width: 1 }).
        move(mapX(x) - phoneWidth / 2, mapY(y) - phoneHeight / 2);
    }
    switch (shape.nature) {
      case ShapeWrapper.NATURE_PROTAGONIST:
        shape.shape.attr({fill: defaultColors["protagonist"]});
        break;
      case ShapeWrapper.NATURE_GOAL:
        shape.shape.attr({fill: defaultColors["goal"]});
        break;
      case ShapeWrapper.NATURE_STATIC:
        shape.shape.attr({fill: defaultColors["static"]});
        break;
      case ShapeWrapper.NATURE_DYNAMIC:
        shape.shape.attr({fill: defaultColors["dynamic"]});
        break;
    }
    updateCode();
  }
  function drawCircle(x, y, r, dummy) {
    var circle = strokeAndFill(svg.circle(2 * r).move(mapX(x - r), mapY(y + r)), "static");
    redrawAxes();
    var shape = new ShapeWrapper(circle, ShapeWrapper.TYPE_CIRCLE);
    circle.mousedown(function() {
    });
    if (dummy) {
      return shape;
    }
    storeShape(shape);
    shapeToSAT[shape.id] = new SAT.Circle(new SAT.Vector(mapX(x), mapY(y)), r);
    shape.r = r;
    shape.shape.dblclick(function() {
      if (editMode === true) {
        removeShape(shape);
        lastShapes[shape.lastShapeIndex] = null;
        updateCode();
        UIManager.cancelDraw();
        return;
      }
      nextNature(shape, x, y);
    });
    makeDraggable(shape);
    lastShapes.push([shape]);
    shape.lastShapeIndex = lastShapes.length - 1;
    updateCode();
    return shape;
  }
  function drawRectangle(x, y, w, h, dummy) {
    var shape = drawPolygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], dummy);
    if (dummy) {
      return shape;
    }
    lastShapes.push([shape]);
    updateCode();
    return shape;
  }
  function drawPolygon(points, dummy) {
    if (points.length === 0) {
      return;
    }
    var pointsString = "";
    for (var i = 0; i < points.length - 1; i++) {
      pointsString += mapX(points[i][0]) + "," + mapY(points[i][1]) + " ";
    }
    pointsString += mapX(points[i][0]) + "," + mapY(points[i][1]);
    var polygon = strokeAndFill(svg.polygon(pointsString), "chain");
    var shape = new ShapeWrapper(polygon, ShapeWrapper.TYPE_POLYGON);
    redrawAxes();
    if (dummy) {
      return shape;
    }
    storeShape(shape);
    var tmpConstructor = function() {};
    tmpConstructor.prototype = SAT.Polygon.prototype;
    var cx = 0, cy = 0;
    points = points.reverse();
    points.forEach(function (point) {
      point[0] = mapX(point[0]);
      point[1] = mapY(point[1]);
      cx += point[0];
      cy += point[1];
    });
    cx /= points.length;
    cy /= points.length;
    var SATPoints = [new SAT.Vector(cx, cy), []];
    points.forEach(function (point) {
      SATPoints[1].push(new SAT.Vector(point[0] - cx, point[1] - cy));
    });
    var tmpShape = new tmpConstructor();
    SAT.Polygon.apply(tmpShape, SATPoints);
    shapeToSAT[shape.id] = tmpShape;
    return shape;
  }
  function drawChainShape(markingPoints, recurse, dummy) {
    if (markingPoints.length === 0) {
      return;
    }
    var lastShapesEntry = [];
    var points = [];
    markingPoints.forEach(function(point) {
      points.push([point._x, point._y]);
    });
    var pointA = points[0];
    for (var i = 1; i < points.length; i++) {
      var polygon = drawPolygon([pointA.slice(), points[i].slice()], dummy);
      !dummy && lastShapesEntry.push(polygon);
      pointA = points[i];
    }
    if (dummy) {
      return;
    }
    lastShapesEntry.isLine = true;
    lastShapes.push(lastShapesEntry);
    exportChainShapes.push(points.slice());
    var markingPointsCopy = markingPoints.slice();
    var lastShapesLastIndex = lastShapes.length - 1;
    var exportChainShapesLastIndex = exportChainShapes.length - 1;
    lastShapes[lastShapesLastIndex].push.apply(lastShapes[lastShapesLastIndex], markingPointsCopy);
    markingPointsCopy.forEach(function(point) {
      point._lastShapesLastIndex = lastShapesLastIndex;
      point._exportChainShapesLastIndex = exportChainShapesLastIndex;
    });
    updateCode();
    !recurse && markingPointsCopy.forEach(function(point) {
      point.shape.draggable(function(x, y) {
        lastShapes[point._lastShapesLastIndex].forEach(function(shape, index) {
          if (index < lastShapes[point._lastShapesLastIndex].length - markingPointsCopy.length) {
            removeShape(shape);
          }
        });
        lastShapes[point._lastShapesLastIndex] = null;
        exportChainShapes[point._exportChainShapesLastIndex] = null;
        point._x = deMapX(x);
        point._y = deMapY(y);
        drawChainShape(markingPointsCopy, true);
        updateCode();
        return true;
      });
      point.shape.mousedown(function() {
        UIManager.cancelDraw();
      });
    });
  }
  function drawChainShape2(points, dummy) {
    if (points.length === 0) {
      return;
    }
    var lastShapesEntry = [];
    var pointA = points[0];
    for (var i = 1; i < points.length; i++) {
      var polygon = drawPolygon([pointA.slice(), points[i].slice()], dummy);
      !dummy && lastShapesEntry.push(polygon);
      pointA = points[i];
    }
    if (dummy) {
      return;
    }
    lastShapesEntry.isLine = true;
    lastShapes.push(lastShapesEntry);
    exportChainShapes.push(points.slice());
    updateCode();
  }
  function drawCurve(markingPoints, recurse) {
    if (markingPoints.length !== 4) {
      return;
    }
    var points = [];
    markingPoints.forEach(function(point) {
      points.push([point._x, point._y]);
    });
    var pathString = "M " + mapX(points[0][0]) + " " + mapY(points[0][1]) + "C";
    for (var i = 1; i < 4; i++) {
      pathString += " " + mapX(points[i][0]) + " " + mapY(points[i][1]);
    }
    var curve = svg.path(pathString).fill("none").stroke({color: defaultColors.chain, width: 2});
    var curveLength = curve.node.getTotalLength();
    var chainPoints = [];
    var increment = 10 / curveLength;
    for (var i = 0; i <= 1.0; i += increment) {
      var point = curve.node.getPointAtLength(curveLength * i);
      chainPoints.push([deMapX(point.x), deMapY(point.y)]);
    }
    curve.remove();
    drawChainShape2(chainPoints);
    var markingPointsCopy = markingPoints.slice();
    var lastShapesLastIndex = lastShapes.length - 1;
    var exportChainShapesLastIndex = exportChainShapes.length - 1;
    lastShapes[lastShapesLastIndex].push.apply(lastShapes[lastShapesLastIndex], markingPointsCopy);
    markingPointsCopy.forEach(function(point) {
      point._lastShapesLastIndex = lastShapesLastIndex;
      point._exportChainShapesLastIndex = exportChainShapesLastIndex;
    });
    !recurse && markingPointsCopy.forEach(function(point) {
      point.shape.draggable(function(x, y) {
        lastShapes[point._lastShapesLastIndex].forEach(function(shape, index) {
          if (index < lastShapes[point._lastShapesLastIndex].length - 4) {
            removeShape(shape);
          }
        });
        lastShapes[point._lastShapesLastIndex] = null;
        exportChainShapes[point._exportChainShapesLastIndex] = null;
        point._x = deMapX(x);
        point._y = deMapY(y);
        drawCurve(markingPointsCopy, true);
        updateCode();
        return true;
      });
      point.shape.mousedown(function() {
        UIManager.cancelDraw();
      });
    });
  }
  function checkOverlaps(shape, x, y) {
    function checkOverlap(aShape) {
      var res = checkOverlaps.lambdas[shape.type][aShape.type](shapeToSAT[shape.id],
        shapeToSAT[aShape.id]);
      return res;
    }
    var distance = new SAT.Vector(graphSize / 2, graphSize / 2);
    distance.sub(new SAT.Vector(x + shape.r, y + shape.r));
    if (constrained && distance.len() >
      hollowRadius - shape.r) {
      return false;
    }
    var oldPos = shapeToSAT[shape.id].pos.clone();
    shapeToSAT[shape.id].pos.x = x + shape.r;
    shapeToSAT[shape.id].pos.y = y + shape.r;
    var result = false;
    var onPolygonPoint = false;
    shapes.forEach(function (aShape) {
      if (aShape.id === shape.id) {
        return;
      }
      if (checkOverlap(aShape)) {
        result = true;
      }
    });
    if (!constrained) {
      result = false;
    }
    if (result) {
      shapeToSAT[shape.id].pos.x = oldPos.x;
      shapeToSAT[shape.id].pos.y = oldPos.y;
    }
    return !result;
  }
  checkOverlaps.lambdas = {};
  checkOverlaps.lambdas[ShapeWrapper.TYPE_CIRCLE] = {};
  checkOverlaps.lambdas[ShapeWrapper.TYPE_POLYGON] = {};
  checkOverlaps.lambdas[ShapeWrapper.TYPE_CIRCLE][ShapeWrapper.TYPE_CIRCLE] = SAT.testCircleCircle;
  checkOverlaps.lambdas[ShapeWrapper.TYPE_CIRCLE][ShapeWrapper.TYPE_POLYGON] = SAT.testCirclePolygon;
  checkOverlaps.lambdas[ShapeWrapper.TYPE_POLYGON][ShapeWrapper.TYPE_CIRCLE] = SAT.testPolygonCircle;
  checkOverlaps.lambdas[ShapeWrapper.TYPE_POLYGON][ShapeWrapper.TYPE_POLYGON] = SAT.testPolygonPolygon;

  function removeShape(shape) {
    shape.shape.remove();
    if (shape._phoneBoundary) {
      shape._phoneBoundary.remove();
      shape._phoneBoundary = null;
    }
    delete shapeToSAT[shape.id];
    for (var i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].id === shape.id) {
        shapes.splice(i, 1);
        break;
      }
    }
  }
  function undo() {
    if (lastShapes.length === 0) {
      return;
    }
    if (!lastShapes[lastShapes.length - 1]) {
      lastShapes.pop();
      undo();
      return;
    }
    if (lastShapes[lastShapes.length - 1].isLine) {
      while (exportChainShapes.length > 0 && !exportChainShapes[exportChainShapes.length - 1]) {
        exportChainShapes.pop();
      }
      exportChainShapes.pop();
    }
    lastShapes[lastShapes.length - 1].forEach(function(shape) {
      removeShape(shape);
    });
    lastShapes.pop();
    updateCode();
  }
  function exportScene() {
    var scene = [];
    if (hollow) {
      scene.push({
        type: "hollow",
        radius: exportScale(hollowRadius),
        nature: "static",
        x: 0,
        y: 0
      });
    }
    shapes.forEach(function(shape) {
      if (shape.type === ShapeWrapper.TYPE_CIRCLE) {
        var SATShape = shapeToSAT[shape.id];
        var obj = {
          radius: exportScale(SATShape.r),
          x: exportScale(deMapX(SATShape.pos.x)),
          y: exportScale(deMapY(SATShape.pos.y))
        };
        switch(shape.nature) {
        case ShapeWrapper.NATURE_STATIC:
          obj.nature = "static";
          obj.type = "circle";
          break;
        case ShapeWrapper.NATURE_DYNAMIC:
          obj.nature = "dynamic";
          obj.type = "circle";
          break;
        case ShapeWrapper.NATURE_PROTAGONIST:
          obj.nature = "dynamic";
          obj.type = "protagonist";
          break;
        case ShapeWrapper.NATURE_GOAL:
          obj.nature = "static";
          obj.type = "goal";
          break;
        default:
          throw new Error("Invalid shape.nature");
        }
        scene.push(obj);
      }
    });
    exportChainShapes.forEach(function(chainShape) {
      if (!chainShape) {
        return;
      }
      scene.push({
        type: "chain",
        nature: "static",
        points: chainShape.map(function(point) {
          return [exportScale(point[0]), exportScale(point[1])]
        })
      });
    });
    return {
      scene: scene,
      physicsValues: defaultPhysicsValues,
      colors: defaultColors
    };
  }
  function destroyAll() {
    shapes.forEach(function(shape) {
      shape.shape.remove();
    });
    shapes.length = 0;
    shapeToSAT = {};
    hollow.remove();
    hollow = null;
    exportChainShapes.length = 0;
    lastShapes.length = 0;
  }
  function importScene(json) {
    if (simulationMode) {
      return;
    }
    destroyAll();
    var scene = json.scene;
    defaultPhysicsValues = json.physicsValues;
    defaultColors = json.colors;
    strokeAndFill(background, "background");
    for (var i = 0; i < scene.length; i++) {
      var obj = scene[i];
      switch (obj.type) {
        case "circle":
          var x = importScale(obj.x);
          var y = importScale(obj.y);
          var shape = drawCircle(x, y, importScale(obj.radius));
          if (obj.nature === "dynamic") {
            nextNature(shape, x, y);
          }
          break;
        case "protagonist":
          var x = importScale(obj.x);
          var y = importScale(obj.y);
          var shape = drawCircle(x, y, importScale(obj.radius));
          nextNature(shape, x, y);
          nextNature(shape, x, y);
          break;
        case "goal":
          var x = importScale(obj.x);
          var y = importScale(obj.y);
          var shape = drawCircle(x, y, importScale(obj.radius));
          nextNature(shape, x, y);
          nextNature(shape, x, y);
          nextNature(shape, x, y);
          break;
        case "hollow":
          drawHollow(importScale(obj.radius));
          break;
        case "chain":
          drawChainShape(obj.points.map(function(point) {
            return [importScale(point[0]), importScale(point[1])];
          }));
          break;
      }
    }
  }
  var typeToColor = {
    circle: "0.13f ,0.62f, 0.20f, 1.0f",
    goal: "0.16f, 0.53f, 0.78f, 1.0f",
    protagonist: "0.16f, 0.50f, 0.19f, 1.0f",
    hollow: "0.44f, 0.87f, 0.52f, 1.0f",
    chain: "0.13f ,0.62f, 0.20f, 1.0f"
  };
  function gen_goal_code(obj) {
    var code = "world.goal = new GameCircle(world.getWorld(), ";
    code += (obj.nature === "dynamic" ? "BodyDef.BodyType.DynamicBody" : "BodyDef.BodyType.StaticBody");
    ["radius", "x", "y"].forEach(function(prop) {
      code += ", " + obj[prop] + "f";
    });
    code += ", ";
    code += "new Color(" + typeToColor.goal + ")";
    code += ");\n";
    code += "world.goal.body.setUserData(\"goal\");\n";
    code += "world.bodies.add(world.goal);\n";
    return code;
  }
  function gen_protagonist_code(obj) {
    var code = "world.protagonist = new GameCircle(world.getWorld(), ";
    code += (obj.nature === "dynamic" ? "BodyDef.BodyType.DynamicBody" : "BodyDef.BodyType.StaticBody");
    ["radius", "x", "y"].forEach(function(prop) {
      code += ", " + obj[prop] + "f";
    });
    code += ", ";
    code += "new Color(" + typeToColor.protagonist + ")";
    code += ");\n";
    code += "world.protagonist.body.setUserData(\"false\");\n";
    code += "world.bodies.add(world.protagonist);\n";
    return code;
  }
  function gen_circle_code(obj) {
    var code = "world.bodies.add(new GameCircle(world.getWorld(), ";
    code += (obj.nature === "dynamic" ? "BodyDef.BodyType.DynamicBody" : "BodyDef.BodyType.StaticBody");
    ["radius", "x", "y"].forEach(function(prop) {
      code += ", " + obj[prop] + "f";
    });
    code += ", ";
    code += "new Color(" + typeToColor.circle + ")";
    code += "));\n";
    return code;
  }
  function gen_hollow_code(obj) {
    var code = "world.hollow = new GameHollow(world.getWorld()";
    ["radius", "x", "y"].forEach(function(prop) {
      code += ", " + obj[prop] + "f";
    });
    code += ", ";
    code += "new Color(" + typeToColor.hollow + ")";
    code += ");\n";
    code += "world.bodies.add(world.hollow);\n";
    return code;
  }
  function gen_chain_code(obj) {
    var code = "world.bodies.add(new GameChain(world.getWorld(), new Vector2[]{";
    for (var i = 0; i < obj.points.length - 1; i++) {
      code += "new Vector2(" + obj.points[i][0] + "f, " + obj.points[i][1] + "f), "
    }
    code += "new Vector2(" + obj.points[i][0] + "f, " + obj.points[i][1] + "f)";
    code += "}, new Color(" + typeToColor.chain + ")";
    code += "));\n";
    return code;
  }
  function gen_code(scene) {
    var code = "";
    var colors = scene.colors;
    var physicsValues = scene.physicsValues;
    scene = scene.scene;
    for (var i = 0; i < scene.length; i++) {
      var obj = scene[i];
      switch(obj.type) {
        case "circle":
          code += gen_circle_code(obj);
          break;
        case "hollow":
          code += gen_hollow_code(obj);
          break;
        case "goal":
          code += gen_goal_code(obj);
          break;
        case "protagonist":
          code += gen_protagonist_code(obj);
          break;
        case "chain":
          code += gen_chain_code(obj);
          break;
      }
    }
    return code;
  }
  function updateCode() {
    var jsonObj = exportScene();
    document.querySelector("#json").innerHTML = JSON.stringify(jsonObj);
    document.querySelector("#java").innerHTML = gen_code(jsonObj);
  }
  function createBox2dEnv() {
    function createBox2dHollow(obj) {
      var radius = obj.radius;
      var scale = 20;
      var angleDelta = (Math.PI / radius / scale);
      var numPoints = Math.floor((2 * scale * radius));
      var points = [];
      var angle = 0;
      var friction = defaultPhysicsValues.hollow.friction, restitution = defaultPhysicsValues.hollow.restitution;
      for (var i = 0; i < numPoints; angle += angleDelta, i++) {
        points.push(new b2Vec2(radius * Math.cos(angle), radius * Math.sin(angle)));
      }
      for (var i = 0; i < numPoints; i++) {
        var bodyDef = new b2BodyDef();
        // bodyDef.type = b2Body.b2_staticBody;
        bodyDef.type = b2_staticBody;
        bodyDef.allowSleep = true;
        var body = world.CreateBody(bodyDef);
        /*var shape = new b2PolygonShape();
        shape.SetAsEdge(points[i], points[(i + 1) % numPoints]);*/
        var shape = new b2EdgeShape();
        shape.Set(points[i], points[(i + 1) % numPoints]);
        shape.hasVertex0 = shape.hasVertex3 = true;
        shape.vertex0 = points[(((i - 1) % numPoints) + numPoints) % numPoints];
        shape.vertex3 = points[(i + 2) % numPoints];
        var fixtureDef = new b2FixtureDef();
        fixtureDef.shape = shape;
        fixtureDef.friction = friction;
        fixtureDef.restitution = restitution;
        // body.CreateFixture(fixtureDef);
        body.CreateFixtureFromDef(fixtureDef);
      }
      return function() {
        return strokeAndFill(svg.circle(2 * simulateScale(radius)).move(graphSize / 2 - simulateScale(radius),
          graphSize / 2 - simulateScale(radius)), "hollow");
      };
    }
    function createBox2dCircle(obj) {
      var x = obj.x, y = obj.y, radius = obj.radius;
      var defaultObj = (obj.type === "protagonist") ? defaultPhysicsValues.protagonist : defaultPhysicsValues.circle;
      var friction = defaultObj.friction, restitution = defaultObj.restitution;
      var angularDamping = defaultObj.angularDamping, density = defaultObj.density;
      var bodyDef = new b2BodyDef();
      bodyDef.allowSleep = true;
      bodyDef.angularDamping = angularDamping;
      // bodyDef.type = (obj.nature == "dynamic" ? b2Body.b2_dynamicBody : b2Body.b2_staticBody);
      bodyDef.type = (obj.nature == "dynamic" ? b2_dynamicBody : b2_staticBody);
      bodyDef.position.x = x;
      bodyDef.position.y = y;
      var body = world.CreateBody(bodyDef);
      var shape = new b2CircleShape();
      // shape.SetRadius(radius);
      shape.radius = radius;
      var fixtureDef = new b2FixtureDef();
      fixtureDef.shape = shape;
      fixtureDef.friction = friction;
      fixtureDef.restitution = restitution;
      fixtureDef.density = density;
      fixtureDef.angularDamping = angularDamping;
      // body.CreateFixture(fixtureDef);
      body.CreateFixtureFromDef(fixtureDef);
      if (obj.type === "protagonist") {
        world._protagonist = body;
      }
      function getType() {
        if (obj.type === "protagonist" || obj.type === "goal") {
          return obj.type;
        }
        return obj.nature;
      }
      return function() {
        var shape = strokeAndFill(svg.circle(2 * simulateScale(radius)), getType()).
          move(mapX(simulateScale(body.GetPosition().x) - simulateScale(radius)),
          mapY(simulateScale(body.GetPosition().y) + simulateScale(radius)));
        if (obj.type === "protagonist") {
          document.querySelector("#canvasDiv").scrollLeft = mapX(simulateScale(body.GetPosition().x)) - divWidth / 2;
          document.querySelector("#canvasDiv").scrollTop = mapY(simulateScale(body.GetPosition().y)) - divHeight / 2;
          if (showPhoneMode) {
            var paddedWidth = phoneWidth + 500;
            var paddedHeight = phoneHeight + 500;
            var phoneBoundary2 = svg.rect(paddedWidth, paddedHeight);
            phoneBoundary2.fill("none").stroke({ color: "black", width: 500 }).
              move(mapX(simulateScale(body.GetPosition().x)) - paddedWidth / 2, mapY((simulateScale(body.GetPosition().y))) - paddedHeight / 2);
            var phoneBoundary = svg.rect(phoneWidth, phoneHeight);
            phoneBoundary.fill("none").stroke({ color: "green", width: 1 }).
              move(mapX(simulateScale(body.GetPosition().x)) - phoneWidth / 2, mapY((simulateScale(body.GetPosition().y))) - phoneHeight / 2);
            return [shape, phoneBoundary, phoneBoundary2];
          }
        }
        return shape;
      };
    }
    function createBox2dChain(obj) {
      var friction = defaultPhysicsValues.chain.friction, restitution = defaultPhysicsValues.chain.restitution;
      var points = obj.points;
      for (var i = 0; i < points.length - 1; i++) {
        var pointA = new b2Vec2(points[i][0], points[i][1]);
        var pointB = new b2Vec2(points[i + 1][0], points[i + 1][1]);
        var bodyDef = new b2BodyDef();
        // bodyDef.type = b2Body.b2_staticBody;
        bodyDef.type = b2_staticBody;
        bodyDef.allowSleep = true;
        //bodyDef.angularDamping = angularDamping;
        var body = world.CreateBody(bodyDef);
        var shape = new b2EdgeShape();
        shape.Set(pointA, pointB);
        if (i > 0) {
          shape.vertex0 = points[i - 1];
          shape.hasVertex0 = true;
        }
        if (i < points.length - 2) {
          shape.vertex3 = points[i + 2];
          shape.hasVertex3 = true;
        }
        var fixtureDef = new b2FixtureDef();
        fixtureDef.shape = shape;
        fixtureDef.friction = friction;
        fixtureDef.restitution = restitution;
        body.CreateFixtureFromDef(fixtureDef);
      }
      return function() {
        var shapes = [];
        for (var i = 0; i < points.length - 1; i++) {
          shapes.push(strokeAndFill(svg.line(mapX(simulateScale(points[i][0])), mapY(simulateScale(points[i][1])),
            mapX(simulateScale(points[i + 1][0])), mapY(simulateScale(points[i + 1][1]))), "chain"));
        }
        return shapes;
      };
    }
    var jsonObj = exportScene().scene;
    var world = new b2World(new b2Vec2(0.0, gravity));
    window.world = world;
    world.renderMethods = [];
    var protagonistMethod = null;
    for (var i = 0; i < jsonObj.length; i++) {
      var obj = jsonObj[i];
      switch (obj.type) {
        case "hollow":
          world.renderMethods.push(createBox2dHollow(obj));
          break;
        case "circle":
        case "goal":
          world.renderMethods.push(createBox2dCircle(obj));
          break;
        case "protagonist":
          protagonistMethod = createBox2dCircle(obj);
          break;
        case "chain":
          world.renderMethods.push(createBox2dChain(obj));
          break;
      }
    }
    if (protagonistMethod) {
      world.renderMethods.push(protagonistMethod);
    }
    return world;
  }
  var force = new b2Vec2(0, 0);
  function keyDownHandler(event) {
    if (event.keyCode === 39) {
      force.x = forceX;
    } else if (event.keyCode === 37) {
      force.x = -forceX;
    }
  }
  function keyUpHandler(event) {
    if (event.keyCode === 39 && force.x > 0) {
      force.x = 0.0;
    } else if (event.keyCode === 37 && force.x < 0) {
      force.x = 0.0;
    }
  }
  function simulate() {
    function clearSVG() {
      simulate.background = strokeAndFill(svg.rect(graphSize, graphSize).
        move(0, 0), "background");
    }
    var world = createBox2dEnv();
    // var context = document.getElementById("canvas").getContext("2d");
    // context.translate(graphSize / 2, graphSize / 2);
    /*var debugDraw = new b2DebugDraw();
    var context = document.getElementById("canvas").getContext("2d");
    context.translate(graphSize / 2, graphSize / 2);
    context.scale(1, -1);
		debugDraw.SetSprite(context);
		debugDraw.SetDrawScale(30.0);
		debugDraw.SetFillAlpha(0.5);
		debugDraw.SetLineThickness(1.0);
		debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
		world.SetDebugDraw(debugDraw);*/
    document.body.addEventListener("keydown", keyDownHandler);
    document.body.addEventListener("keyup", keyUpHandler);
    clearSVG();
    shapes.push();
    redrawAxes();
    var t1 = 0, t2;
    function applyForce() {
      world._protagonist && world._protagonist.ApplyForceToCenter(force);
    }
    function animate(timestamp) {
      t2 = timestamp;
      if (simulationMode) {
        applyForce();
        world.Step((t2 - t1) / 1000, 8, 3);
        t1 = t2;
        // context.clearRect( -graphSize / 2 , -graphSize / 2 , graphSize, graphSize );
        simulate.shapes.forEach(function(shape) {
          shape.remove();
        });
        simulate.shapes.length = 0;
        world.renderMethods.forEach(function(method) {
          var shape = method();
          if (shape instanceof Array) {
            simulate.shapes.push.apply(simulate.shapes, shape);
          } else {
            simulate.shapes.push(shape);
          }
        });
        redrawAxes();
        //world.DrawDebugData();
        window.requestAnimationFrame(animate);
      }
    }
    window.requestAnimationFrame(animate);
  }
  simulate.background = null;
  simulate.shapes = [];
  function stopSimulation() {
    function redrawSVG() {
      simulate.background.remove();
      simulate.background = null;
      simulate.shapes.forEach(function(shape) {
        shape.remove();
      });
      simulate.shapes.length = 0;
    }
    document.body.removeEventListener("keydown", keyDownHandler);
    document.body.removeEventListener("keyup", keyUpHandler);
    force.x = 0.0;
    redrawSVG();
    scrollSVG();
  }
  function scrollSVG() {
    var scrollX = oldScrollX !== null ? oldScrollX : 1.3 * graphSize / 4;
    var scrollY = oldScrollY !== null ? oldScrollY : 1.3 * graphSize / 4;
    document.querySelector("#canvasDiv").scrollLeft = scrollX;
    document.querySelector("#canvasDiv").scrollTop = scrollY;
    oldScrollX = document.querySelector("#canvasDiv").scrollLeft;
    oldScrollY = document.querySelector("#canvasDiv").scrollTop;
  }
  function onLoad() {
    createSVG();
    scrollSVG();
    document.querySelector("#canvasDiv").addEventListener("scroll", function(event) {
      if (simulationMode) return;
      oldScrollX = this.scrollLeft;
      oldScrollY = this.scrollTop;
    });
    drawHollow(200);
    document.querySelector("#hollowRadiusBtn").addEventListener("click", function() {
      setHollowRadius(document.querySelector("#hollowRadius").value);
    });
    document.querySelector("#enableConstrained").addEventListener("click", function() {
      constrained = true;
      this.hidden = true;
      document.querySelector("#disableConstrained").hidden = false;
    });
    document.querySelector("#disableConstrained").addEventListener("click", function() {
      constrained = false;
      this.hidden = true;
      document.querySelector("#enableConstrained").hidden = false;
    });
    document.querySelector("#enableMarkingLines").addEventListener("click", function() {
      showMarkingLines = true;
      this.hidden = true;
      document.querySelector("#disableMarkingLines").hidden = false;
    });
    document.querySelector("#disableMarkingLines").addEventListener("click", function() {
      showMarkingLines = false;
      UIManager._clearMarkingLines();
      this.hidden = true;
      document.querySelector("#enableMarkingLines").hidden = false;
    });
    document.querySelector("#enablePhoneMode").addEventListener("click", function() {
      showPhoneMode = true;
      this.hidden = true;
      document.querySelector("#disablePhoneMode").hidden = false;
    });
    document.querySelector("#disablePhoneMode").addEventListener("click", function() {
      showPhoneMode = false;
      this.hidden = true;
      document.querySelector("#enablePhoneMode").hidden = false;
    });
    document.querySelector("svg").addEventListener("mousedown", function(event) {
      var vector = transformCoordinates(event, this);
      UIManager.onMouseDown(vector.x, vector.y);
    });
    document.querySelector("svg").addEventListener("contextmenu", function(event) {
      var vector = transformCoordinates(event, this);
      UIManager.onContextMenu(vector.x, vector.y);
      event.preventDefault();
      return false;
    });
    document.querySelector("svg").addEventListener("mouseup", function(event) {
      var vector = transformCoordinates(event, this);
      UIManager.onMouseUp(vector.x, vector.y);
    });
    document.querySelector("svg").addEventListener("mousemove", function(event) {
      var vector = transformCoordinates(event, this);
      UIManager.onMouseMove(vector.x, vector.y);
    });
    document.querySelector("#normalRadio").addEventListener("click", function(event) {
      UIManager.state = UIManager.STATE_IDLE;
      editMode = false;
    });
    document.querySelector("#editRadio").addEventListener("click", function(event) {
      editMode = true;
    });
    document.querySelector("#simulate").addEventListener("click", function(event) {
      simulationMode = true;
      this.hidden = true;
      document.querySelector("#stop").hidden = false;
      simulate();
    });
    document.querySelector("#stop").addEventListener("click", function(event) {
      simulationMode = false;
      this.hidden = true;
      document.querySelector("#simulate").hidden = false;
      stopSimulation();
    });
    document.body.addEventListener("keyup", function(event) {
      if (event.keyCode === 90) {
        undo();
      }
    });
    ["restitution-circle", "friction-circle", "density-circle", "angular-damping-circle",
    "friction-hollow", "restitution-hollow", "density-hollow",
    "friction-protagonist", "restitution-protagonist", "density-protagonist", "angular-damping-protagonist",
    "friction-chain", "restitution-chain", "density-chain"].forEach(function(id) {
      var el = document.querySelector("#" + id);
      el.value = defaultPhysicsValues[el.dataset.type][el.dataset.var];
      el.addEventListener("keyup", function(event) {
        defaultPhysicsValues[this.dataset.type][this.dataset.var] = parseFloat(this.value);
      });
    });
    document.querySelector("#gravity").value = gravity;
    document.querySelector("#force").value = forceX;
    document.querySelector("#gravity").addEventListener("keyup", function(event) {
      gravity = parseFloat(this.value);
    });
    document.querySelector("#force").addEventListener("keyup", function(event) {
      forceX = parseFloat(this.value);
    });
    ["protagonist-color", "hollow-color", "background-color", "dynamic-color",
    "static-color", "chain-color", "goal-color"].forEach(function(id) {
      var el = document.querySelector("#" + id);
      el.value = defaultColors[el.dataset.type];
      el.addEventListener("change", function(event) {
        defaultColors[this.dataset.type] = this.value;
        shapes.filter(function(shape) {
          switch (el.dataset.type) {
            case "protagonist":
              return shape.nature === ShapeWrapper.NATURE_PROTAGONIST;
              break;
            case "goal":
              return shape.nature === ShapeWrapper.NATURE_GOAL;
              break;
            case "dynamic":
              return shape.type === ShapeWrapper.NATURE_DYNAMIC;
              break;
            case "static":
              return shape.nature === ShapeWrapper.NATURE_STATIC;
              break;
            case "chain":
              return shape.type === ShapeWrapper.TYPE_POLYGON;
              break;
            return false;
          }
        }).forEach(function(shape) {
          strokeAndFill(shape.shape, el.dataset.type);
        });
        if (el.dataset.type === "hollow") {
          strokeAndFill(hollow, el.dataset.type);
        } else if (el.dataset.type === "background") {
          strokeAndFill(background, el.dataset.type);
        }
        updateCode();
      });
    });
    document.querySelector("#import").addEventListener("click", function(event) {
      importScene(JSON.parse(document.querySelector("#json").value));
    });
    document.querySelector("#startCurves").addEventListener("click", function() {
      curveMode = true;
      this.hidden = true;
      document.querySelector("#stopCurves").hidden = false;
    });
    document.querySelector("#stopCurves").addEventListener("click", function() {
      curveMode = false;
      this.hidden = true;
      document.querySelector("#startCurves").hidden = false;
    });
  }
  window.addEventListener("load", onLoad);
})();
