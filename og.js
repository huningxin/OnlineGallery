// Copyright 2016-present, Oculus VR, LLC.
// All rights reserved.

/* Forest Theme */
var activeTheme = {
  defaultButtonColor: "#F8D5B7",
  defaultBorderColor: "#2D1A10",
  defaultHighlightColor: "yellow",
  defaultIconColor: "#2D1A10",
  defaultClearColor: 0xF8D5B7,

  titleTextParams: {
    textColor: "#677C58",
    textSize: 0.32,
    textColorCenter: 0.48,
    textAlphaCenter: 0.48,
  },
  sampleTextParams: {
    textColor: "#2D1A10",
    textSize: 0.3,
    textColorCenter: 0.5,
    textAlphaCenter: 0.5,
  },
  sampleURLTextParams: {
    textColor: "#2D1A10",
    textSize: 0.2,
    textColorCenter: 0.49,
    textAlphaCenter: 0.49,
  },
  environment: {
    left: {
      texture: "ogp_theme_mono.jpg"
    },
    right: {
      texture: "ogp_theme_mono.jpg"
    }
  }
};

let textureLoader = {
  webLoader: new THREE.TextureLoader(),
  cache: {},
  useCache: true,
  getTexture: function (url) {
    let cache = this.cache;
    let webLoader = this.webLoader;
    if (!cache[url]) {
      cache[url] = new Promise(function (resolve, reject) {
        webLoader.setCrossOrigin('Access-Control-Allow-Origin');
        webLoader.load(url, function (texture) {
          // When the texture is ready, simply supply it.
          resolve(texture);
        }, function (xhr) {
          // No progress indications
        }, function (xhr) {
          // Failed to load the texture for some reason.
          reject()
        });
      });
    }

    // Have a way to turn off the caching.
    let cachedTexture = cache[url];
    if (!this.useCache) {
      delete cache[url];
    }
    return cachedTexture;
  }
};
let canvasTextureLoader = {
  cache: {},
  getButton: function (widthInMeters, heightInMeters, bgColor, borderColor, radius) {
    const cache = this.cache;
    let cacheValue = "" + widthInMeters + ":" + heightInMeters + ":" + bgColor + ":" + borderColor + ":" + radius;
    if (!cache[cacheValue]) {
      let canvas = document.createElement("canvas");
      let ctx = canvas.getContext("2d");

      // Set our width/height to an approximate pixel mapping given our size
      // in meters. 208 pixels per meter at our distance is pretty good.
      canvas.width = widthInMeters * 208;
      canvas.height = heightInMeters * 208;

      // The lineWidth will displace equally from the center pixel which will spill
      // out into our transparent margin.
      const lineWidth = 3;
      // Compute the actual margin based on the lineWidth which could be made configurable
      // later. We take half of the line width, add it to our 2 pixel desired margin and
      // ensure we cover half pixels with a ceiling.
      const margin = Math.ceil(2 + (lineWidth/2));
      const width = canvas.width - margin * 2;
      const height = canvas.height - margin * 2;

      // Set up configuration for our path operations. We have a lineWidth for the
      // border caused by stroke, a border color and a button fill color.
      ctx.lineWidth = lineWidth;
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;

      // We create our path and rely on the arc method to generate our edge line
      ctx.beginPath();
      ctx.moveTo(margin, margin + height - radius);
      ctx.arc(margin + radius, margin + radius, radius, Math.PI, -Math.PI/2);
      ctx.arc(margin + width - radius, margin + radius, radius, -Math.PI/2, 0);
      ctx.arc(margin + width - radius, margin + height - radius, radius, 0, Math.PI/2);
      ctx.arc(margin + radius, margin + height - radius, radius, Math.PI / 2, Math.PI);

      // We can use the path twice to render first a fill area (button) and then a
      // stroke (border) without having to configure the same path twice.
      ctx.fill();
      ctx.stroke();

      // Configure the canvas as a texture. Here we set up basic bilinear filtering
      // and disable mip-maps because we computed ideal pixel mappings for the initial
      // size of the canvas.
      let canvasTexture = new THREE.CanvasTexture(canvas);
      canvasTexture.minFilter = THREE.LinearFilter;
      canvasTexture.magFilter = THREE.LinearFilter;
      canvasTexture.generateMipmaps = false;
      cache[cacheValue] = canvasTexture;
    }

    return cache[cacheValue];
  }
};

// Used by our input controls to manipulate the scene.
function initScene(player, scene, guiSys) {
    // Generate our stereo pano objects, 50 by 50 segments will generate close to no waviness
    // but at the cost of a lot of geometry. Consider downgrading for specific images that don't
    // have a lot of straight lines.
  let panoGeometry = new THREE.SphereGeometry(0.5, 50, 50);

  // Our mesh is double sided since we view it from the inside out. This also has an impact on
  // how our texture maps are rendered.
  let panoLeftMat = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
  let panoRightMat = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
  let panoLeftObject = new THREE.Mesh(panoGeometry, panoLeftMat);
  let panoRightObject = new THREE.Mesh(panoGeometry, panoRightMat);

  // Compute our scale and rotation to account for the offsets in our image
  // Scale on the x is negative (turn our spherical coordinates inside out)
  // And our rotation is 90 degrees to switch from the right face to our front face.
  let scaleMatrix = new THREE.Matrix4().makeScale(-1800, 1800, 1800)
  let rotationMatrix = new THREE.Matrix4().makeRotationY(Math.PI * 0.5);
  let finalMatrix = new THREE.Matrix4().multiplyMatrices(scaleMatrix, rotationMatrix);

  // Since our objects are quite complicated with many faces and are quite large, we can
  // disable raycasting against the background entirely. This produces a measurable
  // performance improvement.
  panoLeftObject.raycast = function () {};
  panoRightObject.raycast = function () {};

  // Apply our rotation/scale, set our left eye layer value and then attach to the scene for later.
  panoLeftObject.applyMatrix(finalMatrix);
  panoLeftObject.layers.set(1);
  scene.leftEyeEnvironmentObject = panoLeftObject;

  // Apply our rotation/scale, set our right eye layer value and then attach to the scene for later.
  panoRightObject.layers.set(2);
  panoRightObject.applyMatrix(finalMatrix);
  scene.rightEyeEnvironmentObject = panoRightObject;

  // Panel based UX
  const panelSets = [
    {
      title: "Starter Kit",
      showRefreshButton: true,
      initialRotation: 0,
      samples: [
        {
          text: "Hello WebVR",
          url: "../WebVRSamples/HelloWebVR/index.html",
          description: "Intro to the basics of WebVR",
        },
        {
          text: "Gamepad",
          url: "../WebVRSamples/Gamepad/index.html",
          description: "Gear VR Touchpad as a Gamepad",
        },
        {
          text: "360 Photos",
          url: "../WebVRSamples/Pano/index.html",
          description: "Displaying 360 Photos",
        },
        {
          text: "VR Navigation",
          url: "../WebVRSamples/Navigation/index.html",
          description: "HTML 5 Navigation in VR!",
        },
      ],
    },
    {
      title: "React VR",
      showRefreshButton: false,
      initialRotation: Math.PI * 0.4,
      samples: [
        {
          text: "Hotel Tour",
          url: "https://s3.amazonaws.com/static.oculus.com/carmel/TourSample/index.html",
          description: "A beautiful virtual hotel tour!",
        },
        {
          text: "Cube Geometry",
          url: "https://s3.amazonaws.com/static.oculus.com/carmel/CubeSample/index.html",
          description: "Use and Change Cube Geometry!",
        },
        {
          text: "Flexbox Layout",
          url: "https://s3.amazonaws.com/static.oculus.com/carmel/LayoutSample/index.html",
          description: "Layout UI Panels using Flexbox!",
        },
        {
          text: "Mesh Import",
          url: "https://s3.amazonaws.com/static.oculus.com/carmel/MeshSample/index.html",
          description: "Combine UI Panels and Meshes!",
        },
      ],
    },
    {
      title: "Tech Demos",
      showRefreshButton: false,
      initialRotation: -Math.PI * 0.4,
      samples: [
        {
          text: "Konfigurator",
          description: "By: Sindre (Breach VR)",
          url: "http://vizor.io/sindre/configurator?start_mode=3"
        },
        {
          text: "In Infinity",
          description: "By: Yayoi Kusama / Vizor",
          url: "http://vizor.io/fthr/yayoi-kusama-in-infinity?start_mode=3"
        },
        {
          text: "Tea Room",
          description: "By: PlayCanvas",
          url: "https://playcanv.as/p/VNTAx5Eu/"
        },
        {
          text: "Sketchfab",
          description: "By: Sketchfab",
          url: "https://sketchfab.com/vr-browser?carmel=1&query=%7B%22collection%22%3A%221ebffd9adaa74ca498a0d5f05d8b8072%22%7D#4df0f3a261a64195b4d74cb3f830dac1"
        }
      ],
    },
  ];

  // We allow for a 2x4 grid, but we reserve the bottom system UX meaning
  // we have panel space for 6 samples, but we don't have to use them all.
  // Some cube maps may not support 6 panels.
  const yOffsets = [0.8, -0.2, -1.2];
  const xOffsets = [-1.25, 1.25];
  const zOffset = -3.5;

  // These are the panel sizes. Quite wide but narrow top to bottom. Good for text.
  const panelWidth = 2.0;
  const panelHeight = 0.5;

  // These are half width offsets so that we can center our panel.
  const panelCenterXOffset = -(panelWidth * 0.5);
  const panelCenterYOffset = (panelHeight * 0.5);

  // This value determines how much extra width we allow for the URL bar
  const panelURLGrowthX = 1.8;
  const panelURLGrowthY = 0.55;

  // These variables allow for slightly rotating the UI into the viewer as they rotate their head.
  const deg5 = Math.PI / 36;
  let quat = new THREE.Quaternion();

  for (let index in panelSets) {
    let panelSet = panelSets[index];

    // Create a new panel root for this panel set and apply the initial configuration such
    // as rotation, icon sets and
    let panelRoot = new THREE.Object3D();
    panelRoot.rotation.y = panelSet.initialRotation;

    // Build our title box.
    let titleUIView = new OVRUI.UIView(guiSys, activeTheme.titleTextParams);
    titleUIView.setFrame(0, 0, panelWidth, panelHeight);
    titleUIView.setLocalPosition([panelCenterXOffset, yOffsets[0] + 1.0, zOffset]);
    titleUIView.setIsInteractable(false);
    titleUIView.setText(panelSet.title);
    titleUIView.isTitle = true;
    player.uiViews.push(titleUIView);
    panelRoot.add(titleUIView);

    for (let index in panelSet.samples) {
      let sample = panelSet.samples[index];

      let xOffset = xOffsets[index%2];
      let yOffset = yOffsets[index/2>>0];
      let tiltIn = (index%2) ? -deg5 : deg5;
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tiltIn);

      let sampleUIView = new OVRUI.UIView(guiSys, activeTheme.sampleTextParams);
      sampleUIView.setFrame(panelCenterXOffset, panelCenterYOffset, panelWidth, panelHeight);
      sampleUIView.setLocalPosition([xOffset, yOffset, zOffset]);
      sampleUIView.setLocalRotation(quat);
      sampleUIView.setIsInteractable(true);
      // Hit slop increases our hit-test range so that we can see the cursor
      // as we get closer to a button. A little hit-slop is always helpful in
      // gaze based UX if there is enough space between interaction components.
      sampleUIView.setHitSlop(0.05, 0.05, 0.05, 0.05);
      sampleUIView.setText(sample.text);
      sampleUIView.command = function() { window.location = sample.url; };
      panelRoot.add(sampleUIView);

      let sampleURLUIView = new OVRUI.UIView(guiSys, activeTheme.sampleURLTextParams);
      sampleURLUIView.setFrame(
        panelCenterXOffset*panelURLGrowthX, panelCenterYOffset*panelURLGrowthY,
        panelWidth*panelURLGrowthX, panelHeight*panelURLGrowthY);

      // The URL panel shares the same location as the main panel, but is shifted down a bit.
      sampleURLUIView.setLocalPosition([xOffset, yOffset - 0.5, zOffset]);
      sampleURLUIView.setLocalRotation(quat);
      sampleURLUIView.setIsInteractable(false);

      let trimmedText = sample.description;
      if (!trimmedText) {
        let url = new URL(sample.url);
        if (url.pathname.indexOf("/") > -1) {
          trimmedText = url.hostname + " - " + url.pathname.substring(url.pathname.lastIndexOf("/")+1);
        }
      }

      if (trimmedText.length > 35) {
        trimmedText = trimmedText.substring(0, 35) + "...";
      }
      sampleURLUIView.setText(trimmedText);
      panelRoot.add(sampleURLUIView);

      // Attach our URL to our UIView
      sampleUIView.urlView = sampleURLUIView;

      // Store these so we can quickly clear them.
      player.uiViews.push(sampleUIView);
    }

    // Add a refresh button if applicable to this panel-set
    if (panelSet.showRefreshButton) {
      let refreshView = new OVRUI.UIView(guiSys, activeTheme.sampleTextParams);
      refreshView.setFrame(-0.15, -0.15, 0.3, 0.3);
      refreshView.setLocalPosition([0, yOffsets[0] + 2.0, zOffset]);
      refreshView.setOpacity(0);
      refreshView.setImage("refresh.png", () => { refreshView.setOpacity(1); });
      refreshView.command = function () { location.reload(); };
      refreshView.setIsInteractable(true);
      panelRoot.add(refreshView);

      // Let our player know about themable icons.
      player.icons.push(refreshView);
    }

    // Notify our GUI of the new panel.
    guiSys.add(panelRoot);
  }

  return function () {
    // Reset all existing views to 0 opacity so they stop displaying.
    let hitTestResult = guiSys._lastHitCache;
    let activeView = hitTestResult[hitTestResult.length - 1];
    if (activeView && activeView.isInteractable && activeView.urlView) {
      // Set our currently active view to 1.0 opacity.
      activeView.urlView.setOpacity(1.0);

      // If we aren't currently using our highlight texture do so now on the active view.
      if (activeView.imageMaterial.map !== activeView.highlightTexture) {
        activeView.setImageTexture(activeView.highlightTexture);
      }
    }

    player.uiViews.forEach(function (uiView) {
      if (uiView !== activeView && uiView.urlView) {
        uiView.urlView.setOpacity(0.0);

        // If we previously set our highlight texture revert back to our normal texture.
        if (uiView.imageMaterial.map !== uiView.imageTexture) {
          uiView.setImageTexture(uiView.baseTexture);
        }
      }
    });
  };
}

function loadEnvironment(activeTheme, scene) {
  // First remove our environment objects if they are already in the scene.
  scene.remove(scene.leftEyeEnvironmentObject);
  scene.remove(scene.rightEyeEnvironmentObject);

  // Next reset our left and right backgrounds. We'll fall back to the clear color
  // until they load.
  delete scene.backgroundLeft;
  delete scene.backgroundRight;

  if (activeTheme.environment) {
    let environment = activeTheme.environment;
    // Once we hit our next idle time, lets kick off all of the environment loads.
    var idle = window.requestIdleCallback || window.setImmediate || function (callback) { window.setTimeout(callback, 150); };
    idle(function () {
      // A cube map will have a series of left eye and right eye textures to load as well as an orientation
      // that we pass to the cube map environment shader.
      if (environment.isCube) {
        (new THREE.CubeTextureLoader()).load(environment.left.textures, function (texture) {
          texture.initialOrientation = environment.initialOrientation;
          scene.backgroundLeft = texture;
        });
        (new THREE.CubeTextureLoader()).load(environment.right.textures, function (texture) {
          texture.initialOrientation = environment.initialOrientation;
          scene.backgroundRight = texture;
        });
      }
      // Our other option is an equirectangular background which we'll use geometry for. This has already been created
      // and initialized for us and stored on the scene.
      else {
        // We use a Promise here to wrap the material updates. Once the material updates are complete we
        // will only then set up the objects in the scene to be rendered. This ensures both eyes render
        // at the same frame rather than potentially offset by 1 or more frames causing discomfort.
        Promise.all([
          textureLoader.getTexture(environment.left.texture).then(function (texture) {
            let material = scene.leftEyeEnvironmentObject.material;
            material.map = texture;
            material.needsUpdate = true;
          }),
          textureLoader.getTexture(environment.right.texture).then(function (texture) {
            let material = scene.rightEyeEnvironmentObject.material;
            material.map = texture;
            material.needsUpdate = true;
          })
        ]).then(function () {
          scene.add(scene.leftEyeEnvironmentObject);
          scene.add(scene.rightEyeEnvironmentObject);
        });
      }
    });
  }
}

// Helper for applying a theme to our UIView buttons. This sets up the appropriate
// text color, size, background colors and borders depending on how the view is
// configured.
function applyTheme(newTheme, scene, player) {
  player.glRenderer.setClearColor(newTheme.defaultClearColor);
  player.uiViews.forEach(function (uiView) {
    // We can't set theme colors for buttons that have images since that will
    // bleed through our alpha.
    if (!newTheme.buttonImage) {
      // If we are using non-image based UI for the buttons, then compute a set of textures
      // with alpha borders. Remove the image based path once we verify we don't have any.
      uiView.baseTexture = canvasTextureLoader.getButton(2, 0.5, newTheme.defaultButtonColor, newTheme.defaultBorderColor, 15);
      uiView.highlightTexture = canvasTextureLoader.getButton(2, 0.5, newTheme.defaultButtonColor, newTheme.defaultHighlightColor, 15)
      uiView.setImageTexture(uiView.baseTexture);
    }
    else {
      uiView.setBackgroundColor(null);
      uiView.setBorderColor(null);

      // Only if we are using button images do we set the opacity first and then once the image
      // loads we show the UI. This prevents our buttons from showing as squares before the image
      // is ready.
      uiView.setOpacity(0);
      textureLoader.getTexture(newTheme.buttonImage).then(function (texture) {
        uiView.setImageTexture(texture);
        uiView.setOpacity(1);
      });
    }
    const textParams = (uiView.isTitle) ? newTheme.titleTextParams : newTheme.sampleTextParams;

    uiView.setTextColor(textParams.textColor);
    uiView.setTextSize(textParams.textSize);
    uiView.setTextColorCenter(textParams.textColorCenter);
    uiView.setTextAlphaCenter(textParams.textAlphaCenter);

    // If we also have a urlView then update the styling to match the current theme as well.
    if (uiView.urlView) {
      // We apply the same background and border elision code to the urlViews.
      if (!newTheme.urlImage) {
        // The computation here for setting the image texture is magic math which should be
        // configured by the theme, but we haven't lifted enough out. For now, let it be.
        uiView.urlView.setImageTexture(canvasTextureLoader.getButton(2*1.8, 0.5*0.55, newTheme.defaultButtonColor, newTheme.defaultBorderColor, 8));
      }
      else {
        // Unset anything that would override or be overriden by specifying an image button.
        uiView.urlView.setBackgroundColor(null);
        uiView.urlView.setBorderColor(null);

        // Same as our button image we need to set opacity until the image loads. There is
        // race condition if we change theme while also hovering buttons since setting
        // opacity back to 1 to show is controlled by our hover state of our parent UIView.
        uiView.urlView.setOpacity(0);
        textureLoader.getTexture(newTheme.urlImage).then(function (texture) {
          uiView.urlView.setImageTexture(texture);
        });
      }
      uiView.urlView.setTextColor(newTheme.sampleURLTextParams.textColor);
      uiView.urlView.setTextSize(newTheme.sampleURLTextParams.textSize);
      uiView.urlView.setTextColorCenter(newTheme.sampleURLTextParams.textColorCenter);
      uiView.urlView.setTextAlphaCenter(newTheme.sampleURLTextParams.textAlphaCenter);
    }
  });

  // We may have any number of icons in the view. Swap all of the colors for the current themes default icon color.
  player.icons.forEach(function (icon) {
    icon.setImageColor(newTheme.defaultIconColor);
  });
  loadEnvironment(newTheme, scene);
}

// If we are running in Chrome use some defaults that are closer to our projection
// in the Gear VR. This helps us understand where we have wasted pixels and also
// how many actual pixels we are working with.
let ovrPlayerOptions = {
  antialias: false
};
if (/vrmono\=1/.test(location.search) || window.VRDisplay === undefined) {
  const playerWidth = 1024;
  const playerHeight = 1024;

  ovrPlayerOptions.width = playerWidth;
  ovrPlayerOptions.height = playerHeight;
  ovrPlayerOptions.camera = new THREE.PerspectiveCamera(90, playerWidth / playerHeight, 0.01, 1000);
  ovrPlayerOptions.camera.layers.enable(1);
}
var player = new OVRUI.Player(ovrPlayerOptions);
player.uiViews = [];
player.icons = [];

// We need a clear color that isn't full black to help with contrast.
// Ideally we make this a light pastel color coincident with our dominant
// color in whatever cube map we load in the future.
player.glRenderer.setClearColor(activeTheme.defaultClearColor)

// Our THREE.js scene is our basis for holding the OVRUI GUI. For the GUI
// we configure an auto-hiding cursor to be compliant with UX Guidelines.
var scene = new THREE.Scene();
var guiSys = new OVRUI.GuiSys(scene, {
  cursorEnabled: true,
  cursorAutoHide: false,
});

// Handle gamepad input for activation
guiSys.eventDispatcher.addEventListener("GuiSysEvent", function (evt) {
  if (evt.eventType === OVRUI.GuiSysEventType.INPUT_EVENT) {
    if (evt.args.inputEvent.type === "GamepadInputEvent") {
      let buttonId = evt.args.inputEvent.buttonId;
      let uiView = evt.args.target;
      if (uiView && uiView.isInteractable) {
        // Activate using A
        if (buttonId === 0 && uiView.command) {
          uiView.command();
        }
      }
    }
    else if (evt.args.inputEvent.type === "MouseInputEvent") {
      if (evt.args.inputEvent.mouseEventType === "mousedown") {
        let uiView = evt.args.target;
        if (uiView && uiView.isInteractable && uiView.command) {
          guiSys.mouseDownView = uiView;
          guiSys.mouseDownX = evt.args.inputEvent.viewportX;
          guiSys.mouseDownY = evt.args.inputEvent.viewportY;
        }
      }
      else if (evt.args.inputEvent.mouseEventType === "mouseup") {
        let uiView = evt.args.target;
        if (uiView && uiView.isInteractable && uiView.command && uiView == guiSys.mouseDownView) {
          function inRange(target, current, variance) {
            return (current => target - variance) && (current <= target + variance);
          }
          if (inRange(guiSys.mouseDownX, evt.args.inputEvent.viewportX, 0.025) &&
              inRange(guiSys.mouseDownY, evt.args.inputEvent.viewportY, 0.025)) {
            uiView.command();
          }
        }
        delete guiSys.mouseDownView;
      }
    }
  }
});

// Initialize the scene and retrieve the frame animation function.
let frame = initScene(player, scene, guiSys);

// Apply our theme dynamically rather than as part of scene init so we can change this on the fly.
applyTheme(activeTheme, scene, player);

var render = function() {
  player.requestAnimationFrame(render);
  player.frame();
  // Passing a glRenderer enables mouse events to work when on a desktop browser.
  guiSys.frame(player.camera, player.glRenderer);
  frame();
  player.render(scene);
};
player.requestAnimationFrame(render);

// DEBUG-ONLY code to make sure that if you are in developer mode you can tap on the screen
// register a click and treat that like a button. This allows for basic navigation without
// a control or GearVR headset.
if (player.isMobile) {
  window.addEventListener("click", function () {
    let lastHit = guiSys.lastHit;
    if (lastHit && lastHit.isInteractable && lastHit.command) {
      lastHit.command();
    }
  });
}