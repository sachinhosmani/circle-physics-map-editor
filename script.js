(function() {
  var svg;
  var shapes = [];
  var lastShapes = [];
  var hollow, hollowRadius;
  var xAxis, yAxis;
  var graphSize = 600;
  var coordinateBar = document.querySelector("#coordinates");
  var shapeToSAT = {};
  var UIManager = {
    points: [],
    markingCircle: null,
    markingPoints: [],
    STATE_IDLE: 1,
    STATE_START: 2,
    STATE_CIRCLE: 3,
    STATE_POLYGON: 4,
    STATE_CANCELLED: 5,
    state: 1,
    onMouseDown: function(x, y) {
      if (this.state === this.STATE_CANCELLED) {
        return;
      }
      if (this.state === this.STATE_IDLE) {
        this.state = this.STATE_START;
      }
      this.points.push(new SAT.Vector(x, y));
      this.markingPoints.push(drawPoint(x, y));
    },
    onMouseUp: function(x, y) {
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
        this.state = this.STATE_POLYGON;
      }
    },
    onContextMenu: function(x, y) {
      if (this.points.length > 1) {
        this.state = this.STATE_IDLE;
        var points = [];
        this.points.forEach(function(point) {
          points.push([point.x, point.y]);
        });
        drawChainShape(points);
        this.points = [];
        this._clearMarkingPoints();
      }
    },
    onMouseMove: function(x, y) {
      if (this.state === this.STATE_START || this.state === this.STATE_CIRCLE) {
        this.state = this.STATE_CIRCLE;
        if (!this.markingCircle) {
          this.markingCircle = drawCircle(this.points[0].x, this.points[0].y,
            this.points[0].clone().sub(new SAT.Vector(x, y)).len());
        } else {
          updateRadius(this.markingCircle, (this.points[0].clone().sub(new SAT.Vector(x, y)).len()));
        }
      }
    },
    cancelDraw: function() {
      this.state = this.STATE_CANCELLED;
      this.points = [];
      this._clearMarkingPoints();
    },
    _clearMarkingPoints: function() {
      this.markingPoints.forEach(function(point) {
        point.remove();
      });
      this.markingPoints.length = 0;
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
  function transformCoordinates(event, svg) {
    return new SAT.Vector((event.pageX - svg.offsetLeft - graphSize / 2),
      (graphSize / 2 - (event.pageY - svg.offsetTop)));
  }
  function createSVG() {
    svg = SVG('canvasDiv').size(graphSize, graphSize);
    document.querySelector("svg").addEventListener("mousemove", function(event) {
      coordinateBar.innerHTML = (event.pageX - this.offsetLeft - graphSize / 2) +
        ", " + (graphSize / 2 - (event.pageY - this.offsetTop));
    });
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
    return y - graphSize / 2;
  }
  function strokeAndFill(obj) {
    return obj.stroke({ color: "blue", width: 2 }).attr({fill: "white"});
  }
  function makeDraggable(wrapped) {
    wrapped.shape.draggable(function(x, y) {
      return checkOverlaps(wrapped, x, y);
    });
    wrapped.shape.dragmove = function(delta, event) {
      redrawAxes();
    }
  }
  function storeShape(shape, type) {
    var wrapped = new ShapeWrapper(shape, type);
    shape.mousedown(function() {
      UIManager.cancelDraw();
    });
    /*shape.mouseup(function() {
      UIManager.cancelDraw();
    });*/
    shapes.push(wrapped);
    return wrapped;
  }
  function drawPoint(x, y) {
    var r = 1;
    return strokeAndFill(svg.circle(2 * r).move(mapX(x - r), mapY(y + r)));
  }
  function drawHollow(r) {
    hollow = strokeAndFill(svg.circle(2 * r).move(graphSize / 2 - r, graphSize / 2 - r));
    redrawAxes();
    hollowRadius = r;
  }
  function setHollowRadius(r) {
    if (!hollow) {
      return;
    }
    hollowRadius = r;
    hollow.radius(r);
  }
  function updateRadius(circle, r) {
    circle.shape.radius(r);
    circle.r = r;
    shapeToSAT[circle.id].r = r;
    redrawAxes();
  }
  function drawCircle(x, y, r) {
    var circle = strokeAndFill(svg.circle(2 * r).move(mapX(x - r), mapY(y + r)));
    var shape = storeShape(circle, ShapeWrapper.TYPE_CIRCLE);
    shapeToSAT[shape.id] = new SAT.Circle(new SAT.Vector(mapX(x), mapY(y)), r);
    shape.r = r;
    shape.shape.dblclick(function() {
      shape.nature = (shape.nature + 1) % 4;
      shape.shape.attr({fill: ShapeWrapper.colorMap[shape.nature]});
    });
    makeDraggable(shape);
    redrawAxes();
    lastShapes.length = 0;
    lastShapes.push(shape);
    return shape;
  }
  function drawRectangle(x, y, w, h) {
    var shape = drawPolygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
    lastShapes.length = 0;
    lastShapes.push(shape);
    return shape;
  }
  function drawPolygon(points) {
    if (points.length === 0) {
      return;
    }
    var pointsString = "";
    for (var i = 0; i < points.length - 1; i++) {
      pointsString += mapX(points[i][0]) + "," + mapY(points[i][1]) + " ";
    }
    pointsString += mapX(points[i][0]) + "," + mapY(points[i][1]);
    var polygon = strokeAndFill(svg.polygon(pointsString));
    var shape = storeShape(polygon, ShapeWrapper.TYPE_POLYGON);
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
    redrawAxes();
    return shape;
  }
  function drawChainShape(points) {
    if (points.length === 0) {
      return;
    }
    lastShapes.length = 0;
    var pointA = points[0];
    for (var i = 1; i < points.length; i++) {
      lastShapes.push(drawPolygon([pointA.slice(), points[i].slice()]));
      pointA = points[i];
    }
  }
  function checkOverlaps(shape, x, y) {
    function checkOverlap(aShape) {
      var res = checkOverlaps.lambdas[shape.type][aShape.type](shapeToSAT[shape.id],
        shapeToSAT[aShape.id]);
      return res;
    }
    var distance = new SAT.Vector(graphSize / 2, graphSize / 2);
    distance.sub(new SAT.Vector(x + shape.r, y + shape.r));
    if (distance.len() >
      hollowRadius - shape.r) {
      return false;
    }
    shapeToSAT[shape.id].pos.x = x + shape.r;
    shapeToSAT[shape.id].pos.y = y + shape.r;
    var result = false;
    shapes.forEach(function (aShape) {
      if (aShape.id === shape.id) {
        return;
      }
      if (checkOverlap(aShape)) {
        result = true;
      }
    });
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
    delete shapeToSAT[shape.id];
    for (var i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].id === shape.id) {
        shapes.splice(i, 1);
        break;
      }
    }
  }
  function undo() {
    lastShapes.forEach(function(shape) {
      removeShape(shape);
    });
    lastShapes.length = 0;
  }
  function exportScene() {
    function exportScale(n) {
      return n / 10;
    }
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
    this.shapes.forEach(function(shape) {

    });
    return scene;
  }
  function onLoad() {
    createSVG();
    drawHollow(200);
    //drawCircle(-50, 100, 30);
    //drawCircle(136, 92, 30);
    // drawPolygon([[10, 50], [200, 500], [300, 500], [40, -10]].reverse());
    document.querySelector("#hollowRadiusBtn").addEventListener("click", function() {
      setHollowRadius(document.querySelector("#hollowRadius").value);
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
    document.body.addEventListener("keyup", function(event) {
      if (event.keyCode === 90) {
        undo();
      }
    });
  }
  window.addEventListener("load", onLoad);
})();
