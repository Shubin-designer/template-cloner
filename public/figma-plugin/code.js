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
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
  }
  function loadFont(family, weight) {
    return __async(this, null, function* () {
      const style = weight >= 700 ? "Bold" : weight >= 500 ? "Medium" : weight >= 300 ? "Light" : "Regular";
      const fontName = { family, style };
      try {
        yield figma.loadFontAsync(fontName);
        return fontName;
      } catch (e) {
        const fallback = { family: "Inter", style };
        try {
          yield figma.loadFontAsync(fallback);
          return fallback;
        } catch (e2) {
          const def = { family: "Inter", style: "Regular" };
          yield figma.loadFontAsync(def);
          return def;
        }
      }
    });
  }
  function createElementInFrame(el, parent) {
    return __async(this, null, function* () {
      if (el.type === "TEXT" && el.characters) {
        const text = figma.createText();
        const font = yield loadFont(el.fontFamily || "Inter", el.fontWeight || 400);
        text.fontName = font;
        text.characters = el.characters;
        text.name = el.name || "Text";
        text.x = el.x;
        text.y = el.y;
        text.resize(Math.max(1, el.width), Math.max(1, el.height));
        text.textAutoResize = "HEIGHT";
        if (el.fontSize) text.fontSize = el.fontSize;
        if (el.lineHeight && el.lineHeight > 0) {
          text.lineHeight = { value: el.lineHeight, unit: "PIXELS" };
        }
        if (el.letterSpacing) {
          text.letterSpacing = { value: el.letterSpacing, unit: "PIXELS" };
        }
        if (el.textAlign === "center") text.textAlignHorizontal = "CENTER";
        else if (el.textAlign === "right") text.textAlignHorizontal = "RIGHT";
        if (el.textColor) {
          text.fills = [{ type: "SOLID", color: hexToRgb(el.textColor) }];
        }
        parent.appendChild(text);
        return;
      }
      if (el.type === "IMAGE") {
        const rect2 = figma.createRectangle();
        rect2.name = el.name || "Image";
        rect2.x = el.x;
        rect2.y = el.y;
        rect2.resize(Math.max(1, el.width), Math.max(1, el.height));
        if (el.imageBase64) {
          try {
            const raw = figma.base64Decode(el.imageBase64);
            const image = figma.createImage(raw);
            rect2.fills = [{
              type: "IMAGE",
              scaleMode: "FILL",
              imageHash: image.hash
            }];
          } catch (e) {
            rect2.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
          }
        } else {
          rect2.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
        }
        if (el.borderRadius && el.borderRadius > 0) {
          rect2.cornerRadius = el.borderRadius;
        }
        parent.appendChild(rect2);
        return;
      }
      const rect = figma.createRectangle();
      rect.name = el.name || "Frame";
      rect.x = el.x;
      rect.y = el.y;
      rect.resize(Math.max(1, el.width), Math.max(1, el.height));
      if (el.backgroundColor) {
        rect.fills = [{ type: "SOLID", color: hexToRgb(el.backgroundColor) }];
      } else {
        rect.fills = [];
      }
      if (el.borderWidth && el.borderWidth > 0 && el.borderColor) {
        rect.strokes = [{ type: "SOLID", color: hexToRgb(el.borderColor) }];
        rect.strokeWeight = el.borderWidth;
      }
      if (el.borderRadius && el.borderRadius > 0) {
        rect.cornerRadius = el.borderRadius;
      }
      if (el.opacity != null && el.opacity < 1) {
        rect.opacity = el.opacity;
      }
      parent.appendChild(rect);
    });
  }
  function createDesignFromSpec(spec) {
    return __async(this, null, function* () {
      const page = spec.page;
      if (!page || !page.elements) {
        throw new Error("Invalid spec: missing page.elements");
      }
      const pageFrame = figma.createFrame();
      pageFrame.name = page.name || "Cloned Page";
      pageFrame.resize(Math.max(1, page.width), Math.max(1, page.height));
      pageFrame.x = 0;
      pageFrame.y = 0;
      pageFrame.clipsContent = true;
      if (page.backgroundColor) {
        pageFrame.fills = [{ type: "SOLID", color: hexToRgb(page.backgroundColor) }];
      } else {
        pageFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      }
      figma.currentPage.appendChild(pageFrame);
      for (const el of page.elements) {
        try {
          yield createElementInFrame(el, pageFrame);
        } catch (err) {
          console.error(`Failed to create element ${el.name}:`, err);
        }
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
          if (!spec || !spec.page || !spec.page.elements) {
            throw new Error("Invalid design spec: missing page.elements");
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
