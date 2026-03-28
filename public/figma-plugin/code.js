var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function() {
  "use strict";
  const isMixed = (value) => typeof value === "symbol";
  const toHex = (color) => {
    const clamp = (value) => Math.min(255, Math.max(0, Math.round(value * 255)));
    const [r, g, b] = [clamp(color.r), clamp(color.g), clamp(color.b)];
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const serializePaints = (paints) => {
    if (isMixed(paints) || !paints || !Array.isArray(paints)) {
      return isMixed(paints) ? "mixed" : [];
    }
    return paints.filter((paint) => paint.type === "SOLID" && "color" in paint).map((paint) => ({
      type: paint.type,
      color: paint.type === "SOLID" ? toHex(paint.color) : void 0,
      opacity: paint.opacity
    }));
  };
  const getBounds = (node) => {
    if ("x" in node && "y" in node && "width" in node && "height" in node) {
      return {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      };
    }
    return void 0;
  };
  const serializeText = (node, base) => {
    let font;
    if (typeof node.fontName === "symbol") {
      font = "mixed";
    } else if (node.fontName) {
      font = node.fontName.family;
    }
    return __spreadProps(__spreadValues({}, base), {
      characters: node.characters,
      styles: __spreadProps(__spreadValues({}, base.styles), {
        fontSize: isMixed(node.fontSize) ? "mixed" : node.fontSize,
        fontFamily: font,
        textAlignHorizontal: isMixed(node.textAlignHorizontal) ? "mixed" : node.textAlignHorizontal
      })
    });
  };
  const serializeStyles = (node) => {
    const styles = {};
    if ("fills" in node) {
      styles.fills = serializePaints(node.fills);
    }
    if ("strokes" in node) {
      styles.strokes = serializePaints(node.strokes);
    }
    if ("cornerRadius" in node) {
      styles.cornerRadius = isMixed(node.cornerRadius) ? "mixed" : node.cornerRadius;
    }
    if ("paddingLeft" in node) {
      styles.padding = {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft
      };
    }
    return styles;
  };
  const serializeNode = (node) => {
    const base = {
      id: node.id,
      name: node.name,
      type: node.type,
      bounds: getBounds(node),
      styles: serializeStyles(node)
    };
    if (node.type === "TEXT") {
      return serializeText(node, base);
    }
    if ("children" in node) {
      return __spreadProps(__spreadValues({}, base), {
        children: node.children.map((child) => serializeNode(child))
      });
    }
    return base;
  };
  function loadFont(family, style) {
    return __async(this, null, function* () {
      const fontName = { family, style };
      try {
        yield figma.loadFontAsync(fontName);
        return fontName;
      } catch (e) {
      }
      const fallback = { family: "Inter", style };
      try {
        yield figma.loadFontAsync(fallback);
        return fallback;
      } catch (e) {
      }
      const def = { family: "Inter", style: "Regular" };
      yield figma.loadFontAsync(def);
      return def;
    });
  }
  function applyPaint(paint) {
    var _a, _b, _c;
    if (!paint || paint.visible === false) return void 0;
    if (paint.type === "SOLID" && paint.color) {
      return {
        type: "SOLID",
        color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
        opacity: (_b = (_a = paint.opacity) != null ? _a : paint.color.a) != null ? _b : 1
      };
    }
    if (paint.type === "GRADIENT_LINEAR" && paint.gradientStops) {
      return {
        type: "GRADIENT_LINEAR",
        gradientStops: paint.gradientStops.map((s) => {
          var _a2;
          return {
            color: { r: s.color.r, g: s.color.g, b: s.color.b, a: (_a2 = s.color.a) != null ? _a2 : 1 },
            position: s.position
          };
        }),
        gradientTransform: paint.gradientTransform || [[1, 0, 0], [0, 1, 0]],
        opacity: (_c = paint.opacity) != null ? _c : 1
      };
    }
    return void 0;
  }
  function buildFromHtmlToFigma(node, parent, images) {
    return __async(this, null, function* () {
      var _a, _b;
      if (!node || node.width < 0.5 || node.height < 0.5) return;
      if (node.type === "TEXT" && node.characters) {
        const text = figma.createText();
        const fontStyle = node.fontWeight || "Regular";
        const font = yield loadFont(node.fontFamily || "Inter", fontStyle);
        text.fontName = font;
        text.characters = node.characters;
        text.name = node.name || "Text";
        text.x = Math.round(node.x);
        text.y = Math.round(node.y);
        text.resize(Math.max(1, node.width), Math.max(1, node.height));
        if (node.fontSize) text.fontSize = node.fontSize;
        if (((_a = node.lineHeight) == null ? void 0 : _a.value) && node.lineHeight.value > 0) {
          text.lineHeight = { value: node.lineHeight.value, unit: "PIXELS" };
        }
        if (node.textAlignHorizontal) {
          const align = node.textAlignHorizontal.toUpperCase();
          if (align === "CENTER" || align === "RIGHT" || align === "LEFT" || align === "JUSTIFIED") {
            text.textAlignHorizontal = align;
          }
        }
        if (node.color) {
          const p = applyPaint(node.color);
          if (p) text.fills = [p];
        }
        text.textAutoResize = "NONE";
        parent.appendChild(text);
        return;
      }
      if (node.type === "SVG" && node.svg) {
        try {
          const svgNode = figma.createNodeFromSvg(node.svg);
          svgNode.x = Math.round(node.x);
          svgNode.y = Math.round(node.y);
          svgNode.resize(Math.max(1, node.width), Math.max(1, node.height));
          svgNode.name = node.name || "SVG";
          parent.appendChild(svgNode);
        } catch (e) {
          const rect = figma.createRectangle();
          rect.x = Math.round(node.x);
          rect.y = Math.round(node.y);
          rect.resize(Math.max(1, node.width), Math.max(1, node.height));
          rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
          parent.appendChild(rect);
        }
        return;
      }
      const frame = figma.createFrame();
      frame.name = node.name || "Frame";
      frame.x = Math.round(node.x);
      frame.y = Math.round(node.y);
      frame.resize(Math.max(1, node.width), Math.max(node.height, 1));
      frame.clipsContent = (_b = node.clipsContent) != null ? _b : false;
      if (node.backgroundFill) {
        const p = applyPaint(node.backgroundFill);
        if (p) frame.fills = [p];
        else frame.fills = [];
      } else {
        frame.fills = [];
      }
      if (node.imageUrl) {
        const base64 = images[node.imageUrl];
        if (base64) {
          try {
            const raw = figma.base64Decode(base64);
            const image = figma.createImage(raw);
            frame.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
          } catch (e) {
          }
        }
      }
      if (node.topLeftRadius) frame.topLeftRadius = node.topLeftRadius;
      if (node.topRightRadius) frame.topRightRadius = node.topRightRadius;
      if (node.bottomLeftRadius) frame.bottomLeftRadius = node.bottomLeftRadius;
      if (node.bottomRightRadius) frame.bottomRightRadius = node.bottomRightRadius;
      if (node.strokes && node.strokes.length > 0) {
        const strokePaints = [];
        for (const s of node.strokes) {
          const p = applyPaint(s);
          if (p && p.type === "SOLID") strokePaints.push(p);
        }
        if (strokePaints.length > 0) {
          frame.strokes = strokePaints;
          if (node.strokeTopWeight != null) frame.strokeTopWeight = node.strokeTopWeight;
          if (node.strokeBottomWeight != null) frame.strokeBottomWeight = node.strokeBottomWeight;
          if (node.strokeLeftWeight != null) frame.strokeLeftWeight = node.strokeLeftWeight;
          if (node.strokeRightWeight != null) frame.strokeRightWeight = node.strokeRightWeight;
        }
      }
      if (node.dropShadows && node.dropShadows.length > 0) {
        frame.effects = node.dropShadows.map((ds) => {
          var _a2;
          return {
            type: "DROP_SHADOW",
            color: { r: ds.colorRgba.r, g: ds.colorRgba.g, b: ds.colorRgba.b, a: (_a2 = ds.colorRgba.a) != null ? _a2 : 0.25 },
            offset: { x: ds.offsetX || 0, y: ds.offsetY || 0 },
            radius: ds.radius || 0,
            spread: ds.spread || 0,
            visible: true,
            blendMode: "NORMAL"
          };
        });
      }
      if (node.effects && node.effects.length > 0) {
        const existing = frame.effects || [];
        const blurs = node.effects.filter((e) => e.type === "LAYER_BLUR").map((e) => ({
          type: "LAYER_BLUR",
          radius: e.radius,
          visible: e.visible
        }));
        frame.effects = [...existing, ...blurs];
      }
      if (node.layoutMode) {
        frame.layoutMode = node.layoutMode;
        if (node.itemSpacing != null) frame.itemSpacing = node.itemSpacing;
        if (node.primaryAxisAlignItems) {
          frame.primaryAxisAlignItems = node.primaryAxisAlignItems;
        }
        if (node.counterAxisAlignItems) {
          frame.counterAxisAlignItems = node.counterAxisAlignItems;
        }
        frame.primaryAxisSizingMode = "AUTO";
        frame.counterAxisSizingMode = "FIXED";
      }
      if (node.padding) {
        if (node.padding.top) frame.paddingTop = node.padding.top;
        if (node.padding.right) frame.paddingRight = node.padding.right;
        if (node.padding.bottom) frame.paddingBottom = node.padding.bottom;
        if (node.padding.left) frame.paddingLeft = node.padding.left;
      }
      parent.appendChild(frame);
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          try {
            yield buildFromHtmlToFigma(child, frame, images);
          } catch (err) {
            console.error(`Failed: ${child.name}`, err);
          }
        }
      }
    });
  }
  function createDesignFromSpec(spec) {
    return __async(this, null, function* () {
      const { figmaTree, pageInfo, images = {} } = spec;
      if (!figmaTree) {
        throw new Error("Invalid spec: missing figmaTree");
      }
      const pageFrame = figma.createFrame();
      pageFrame.name = pageInfo.name || "Cloned Page";
      pageFrame.resize(Math.max(1, pageInfo.width), Math.max(1, pageInfo.height));
      pageFrame.x = 0;
      pageFrame.y = 0;
      pageFrame.clipsContent = true;
      pageFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      figma.currentPage.appendChild(pageFrame);
      const tree = figmaTree;
      if (tree.children) {
        for (const child of tree.children) {
          try {
            yield buildFromHtmlToFigma(child, pageFrame, images);
          } catch (err) {
            console.error(`Failed:`, err);
          }
        }
      }
      if (tree.backgroundFill) {
        const p = applyPaint(tree.backgroundFill);
        if (p) pageFrame.fills = [p];
      }
      figma.viewport.scrollAndZoomIntoView([pageFrame]);
      return [pageFrame.id];
    });
  }
  const sendStatus = () => {
    figma.ui.postMessage({
      type: "plugin-status",
      payload: {
        fileName: figma.root.name,
        selectionCount: figma.currentPage.selection.length
      }
    });
  };
  const serializeVariableValue = (value) => {
    if (typeof value === "object" && value !== null) {
      if ("type" in value && value.type === "VARIABLE_ALIAS") {
        return { type: "VARIABLE_ALIAS", id: value.id };
      }
      if ("r" in value && "g" in value && "b" in value) {
        const color = value;
        return {
          type: "COLOR",
          r: color.r,
          g: color.g,
          b: color.b,
          a: "a" in color ? color.a : 1
        };
      }
    }
    return value;
  };
  const handleRequest = (request) => __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
      switch (request.type) {
        case "get_document":
          return {
            type: request.type,
            requestId: request.requestId,
            data: serializeNode(figma.currentPage)
          };
        case "get_selection":
          return {
            type: request.type,
            requestId: request.requestId,
            data: figma.currentPage.selection.map((node) => serializeNode(node))
          };
        case "get_node": {
          const nodeId = request.nodeIds && request.nodeIds[0];
          if (!nodeId) {
            throw new Error("nodeIds is required for get_node");
          }
          const node = yield figma.getNodeByIdAsync(nodeId);
          if (!node || node.type === "DOCUMENT") {
            throw new Error(`Node not found: ${nodeId}`);
          }
          return {
            type: request.type,
            requestId: request.requestId,
            data: serializeNode(node)
          };
        }
        case "get_styles": {
          const [paintStyles, textStyles, effectStyles, gridStyles] = yield Promise.all([
            figma.getLocalPaintStylesAsync(),
            figma.getLocalTextStylesAsync(),
            figma.getLocalEffectStylesAsync(),
            figma.getLocalGridStylesAsync()
          ]);
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              paints: paintStyles.map((style) => ({
                id: style.id,
                name: style.name,
                paints: style.paints
              })),
              text: textStyles.map((style) => ({
                id: style.id,
                name: style.name,
                fontSize: style.fontSize,
                fontName: style.fontName
              })),
              effects: effectStyles.map((style) => ({
                id: style.id,
                name: style.name,
                effects: style.effects
              })),
              grids: gridStyles.map((style) => ({
                id: style.id,
                name: style.name,
                layoutGrids: style.layoutGrids
              }))
            }
          };
        }
        case "get_metadata": {
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              fileName: figma.root.name,
              currentPageId: figma.currentPage.id,
              currentPageName: figma.currentPage.name,
              pageCount: figma.root.children.length,
              pages: figma.root.children.map((page) => ({
                id: page.id,
                name: page.name
              }))
            }
          };
        }
        case "get_design_context": {
          const depth = (_b = (_a = request.params) == null ? void 0 : _a.depth) != null ? _b : 2;
          const serializeWithDepth = (node, currentDepth) => __async(this, null, function* () {
            var _a2, _b2;
            const serialized = serializeNode(node);
            if (currentDepth >= depth && serialized.children) {
              return __spreadProps(__spreadValues({}, serialized), {
                children: void 0,
                childCount: (_b2 = (_a2 = node.children) == null ? void 0 : _a2.length) != null ? _b2 : 0
              });
            }
            if (serialized.children) {
              const childNodes = yield Promise.all(
                serialized.children.map(
                  (child) => figma.getNodeByIdAsync(child.id)
                )
              );
              const serializedChildren = yield Promise.all(
                childNodes.filter(
                  (n) => n !== null && n.type !== "DOCUMENT"
                ).map((n) => serializeWithDepth(n, currentDepth + 1))
              );
              return __spreadProps(__spreadValues({}, serialized), {
                children: serializedChildren
              });
            }
            return serialized;
          });
          const selection = figma.currentPage.selection;
          const contextNodes = selection.length > 0 ? yield Promise.all(
            selection.map((node) => serializeWithDepth(node, 0))
          ) : [
            yield serializeWithDepth(
              figma.currentPage,
              0
            )
          ];
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              fileName: figma.root.name,
              currentPage: {
                id: figma.currentPage.id,
                name: figma.currentPage.name
              },
              selectionCount: selection.length,
              context: contextNodes
            }
          };
        }
        case "get_variable_defs": {
          const collections = yield figma.variables.getLocalVariableCollectionsAsync();
          const variableData = yield Promise.all(
            collections.map((collection) => __async(this, null, function* () {
              const variables = yield Promise.all(
                collection.variableIds.map(
                  (id) => figma.variables.getVariableByIdAsync(id)
                )
              );
              return {
                id: collection.id,
                name: collection.name,
                modes: collection.modes.map((mode) => ({
                  modeId: mode.modeId,
                  name: mode.name
                })),
                variables: variables.filter((v) => v !== null).map((variable) => ({
                  id: variable.id,
                  name: variable.name,
                  resolvedType: variable.resolvedType,
                  valuesByMode: Object.fromEntries(
                    Object.entries(variable.valuesByMode).map(
                      ([modeId, value]) => [
                        modeId,
                        serializeVariableValue(value)
                      ]
                    )
                  )
                }))
              };
            }))
          );
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              collections: variableData
            }
          };
        }
        case "get_screenshot": {
          const format = (_d = (_c = request.params) == null ? void 0 : _c.format) != null ? _d : "PNG";
          const scale = (_f = (_e = request.params) == null ? void 0 : _e.scale) != null ? _f : 2;
          let targetNodes;
          if (request.nodeIds && request.nodeIds.length > 0) {
            const nodes = yield Promise.all(
              request.nodeIds.map((id) => figma.getNodeByIdAsync(id))
            );
            targetNodes = nodes.filter(
              (node) => node !== null && node.type !== "DOCUMENT" && node.type !== "PAGE"
            );
          } else {
            targetNodes = [...figma.currentPage.selection];
          }
          if (targetNodes.length === 0) {
            throw new Error(
              "No nodes to export. Select nodes or provide nodeIds."
            );
          }
          const exports$1 = yield Promise.all(
            targetNodes.map((node) => __async(this, null, function* () {
              const settings = format === "SVG" ? { format: "SVG" } : format === "PDF" ? { format: "PDF" } : format === "JPG" ? {
                format: "JPG",
                constraint: { type: "SCALE", value: scale }
              } : {
                format: "PNG",
                constraint: { type: "SCALE", value: scale }
              };
              const bytes = yield node.exportAsync(settings);
              const base64 = figma.base64Encode(bytes);
              return {
                nodeId: node.id,
                nodeName: node.name,
                format,
                base64,
                width: node.width,
                height: node.height
              };
            }))
          );
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              exports: exports$1
            }
          };
        }
        case "create_design": {
          const spec = request.params;
          if (!spec || !spec.figmaTree) {
            throw new Error("Invalid design spec: missing figmaTree");
          }
          const createdIds = yield createDesignFromSpec(spec);
          return {
            type: request.type,
            requestId: request.requestId,
            data: { createdNodeIds: createdIds }
          };
        }
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }
    } catch (error) {
      return {
        type: request.type,
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  figma.showUI(__html__, { width: 320, height: 180 });
  sendStatus();
  figma.on("selectionchange", () => {
    sendStatus();
  });
  figma.ui.onmessage = (message) => __async(this, null, function* () {
    if (message.type === "ui-ready") {
      sendStatus();
      return;
    }
    if (message.type === "server-request") {
      const response = yield handleRequest(message.payload);
      try {
        figma.ui.postMessage(response);
      } catch (err) {
        figma.ui.postMessage({
          type: response.type,
          requestId: response.requestId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  });
})();
