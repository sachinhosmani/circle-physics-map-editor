(function() {
  var svg;
  var shapes = [];
  var lastShapes = [];
  var hollow, hollowRadius;
  var xAxis, yAxis;
  var graphSize = 2000;
  var coordinateBar = document.querySelector("#coordinates");
  var shapeToSAT = {};
  var exportChainShapes = [];
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
  function transformCoordinates(event) {
    var div = document.querySelector("#canvasDiv");
    var svg = document.querySelector("svg");
    return new SAT.Vector((event.pageX - svg.offsetLeft + div.scrollLeft - graphSize / 2),
      (graphSize / 2 - (event.pageY - svg.offsetTop + div.scrollTop)));
  }
  function createSVG() {
    svg = SVG('canvasDiv').size(graphSize, graphSize);
    document.querySelector("svg").addEventListener("mousemove", function(event) {
      var coords = transformCoordinates(event);
      coordinateBar.innerHTML = coords.x +
        ", " + coords.y;
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
    return graphSize / 2 - y;
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
      updateCode();
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
  function drawCircle(x, y, r) {
    var circle = strokeAndFill(svg.circle(2 * r).move(mapX(x - r), mapY(y + r)));
    var shape = storeShape(circle, ShapeWrapper.TYPE_CIRCLE);
    shapeToSAT[shape.id] = new SAT.Circle(new SAT.Vector(mapX(x), mapY(y)), r);
    shape.r = r;
    shape.shape.dblclick(function() {
      shape.nature = (shape.nature + 1) % 4;
      shape.shape.attr({fill: ShapeWrapper.colorMap[shape.nature]});
      updateCode();
    });
    makeDraggable(shape);
    redrawAxes();
    lastShapes.push([shape]);
    updateCode();
    return shape;
  }
  function drawRectangle(x, y, w, h) {
    var shape = drawPolygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
    lastShapes.push([shape]);
    updateCode();
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
    var lastShapesEntry = [];
    var pointA = points[0];
    for (var i = 1; i < points.length; i++) {
      lastShapesEntry.push(drawPolygon([pointA.slice(), points[i].slice()]));
      pointA = points[i];
    }
    lastShapesEntry.isLine = true;
    lastShapes.push(lastShapesEntry);
    exportChainShapes.push(points.slice());
    updateCode();
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
    var oldPos = shapeToSAT[shape.id].pos.clone();
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
    if (lastShapes[lastShapes.length - 1].isLine) {
      exportChainShapes.pop();
    }
    lastShapes[lastShapes.length - 1].forEach(function(shape) {
      removeShape(shape);
    });
    lastShapes.pop();
    updateCode();
  }
  function exportScene() {
    function exportScale(n) {
      return n / 30;
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
          obj.nature = "static",
          obj.type = "circle"
          break;
        case ShapeWrapper.NATURE_DYNAMIC:
          obj.nature = "dynamic",
          obj.type = "circle"
          break;
        case ShapeWrapper.NATURE_PROTAGONIST:
          obj.nature = "dynamic",
          obj.type = "protagonist"
          break;
        case ShapeWrapper.NATURE_GOAL:
          obj.nature = "static",
          obj.type = "goal"
          break;
        default:
          throw new Error("Invalid shape.nature");
        }
        scene.push(obj);
      }
    });
    exportChainShapes.forEach(function(chainShape) {
      scene.push({
        type: "chain",
        nature: "static",
        points: chainShape.map(function(point) {
          return [exportScale(point[0]), exportScale(point[1])]
        })
      });
    });
    return scene;
  }
  var typeToColor = {
    circle: "0.93f, 0.47f, 0.15f, 1.0f",
    goal: "0.16f, 0.53f, 0.78f, 1.0f",
    protagonist: "0.16f, 0.50f, 0.19f, 1.0f",
    hollow: "0.13f ,0.62f, 0.20f, 1.0f",
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
  };
  function onLoad() {
    createSVG();
    document.querySelector("#canvasDiv").scrollTop = 1.3 * graphSize / 4;
    document.querySelector("#canvasDiv").scrollLeft = 1.3 * graphSize / 4;
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
