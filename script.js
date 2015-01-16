(function() {
  var svg;
  var shapes = [];
  var hollow, hollowRadius;
  var xAxis, yAxis;
  var graphSize = 600;
  var coordinateBar = document.querySelector("#coordinates");
  var shapeToSAT = {};
  var UIManager = {
    points: [],
    markingCircle: null,
    markingPoints: [],
    state: this.STATE_IDLE,
    onMouseDown: function(x, y) {
      if (this.state === this.STATE_CANCELLED) {
        return;
      }
      this.state = this.STATE_POLYGON;
      this.points.push(new SAT.Vector(x, y));
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
        this.points.length = 0;
      }
      this.state = this.STATE_IDLE;
    },
    onContextMenu: function(x, y) {
      if (this.points.length > 1) {
        this.state = this.STATE_IDLE;
        var points = [];
        this.points.forEach(function(point) {
          points.push([point.x, point.y]);
        });
        drawPolygon(points);
        this.points.length = 0;
      }
    },
    onMouseMove: function(x, y) {
      if (this.state === this.STATE_POLYGON) {
        this.state = this.STATE_CIRCLE;
        if (!this.markingCircle) {
          this.markingCircle = drawCircle(this.points[0].x, this.points[0].y,
            this.points[0].clone().sub(new SAT.Vector(x, y)).len());
        } else {
          updateRadius(this.markingCircle, (this.points[0].clone().sub(new SAT.Vector(x, y)).len()));
        }
      } else if (this.state === this.STATE_CIRCLE) {
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
      this.points.length = 0;
    }
  };
  UIManager.STATE_IDLE = 1;
  UIManager.STATE_CIRCLE = 2;
  UIManager.STATE_POLYGON = 3;
  UIManager.STATE_CANCELLED = 4;
  function ShapeWrapper(shape, type) {
    this.shape = shape;
    this.type = type;
    this.id = ShapeWrapper.ID++;
  }
  ShapeWrapper.TYPE_CIRCLE = 1;
  ShapeWrapper.TYPE_POLYGON = 2;
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
    shapes.push(wrapped);
    return wrapped;
  }
  function drawHollow(r) {
    redrawAxes();
    hollow = strokeAndFill(svg.circle(2 * r).move(graphSize / 2 - r, graphSize / 2 - r));
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
    makeDraggable(shape);
    redrawAxes();
    return shape;
  }
  function drawRectangle(x, y, w, h) {
    return drawPolygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
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
  function onLoad() {
    createSVG();
    drawHollow(200);
    drawCircle(-50, 100, 30);
    drawCircle(136, 92, 30);
    drawPolygon([[10, 50], [200, 500], [300, 500], [40, -10]].reverse());
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
  }
  window.addEventListener("load", onLoad);
})();
