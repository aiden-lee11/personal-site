// Last edited by Aiden Lee 2025

// Global reference to the webGL context, canvas, and shaders
// A good amount of code was written with the help of cursor tab autocomplete, I apologize but I do not remember exactly which spots, so I will give a general citation to Cursor using the Sonnet 4.5 model
let g_canvas;
let gl;
let g_vshader;
let g_fshader;

// Global to keep track of the time of the _previous_ frame
let g_lastFrameMS = 0;

let g_keysPressed = {};
const KEYS_TO_TRACK = ['w', 'a', 's', 'd', 'r', 'f', 'q', 'e', 't'];

// GLSL uniform references
let g_uModel_ref;
let g_uWorld_ref;
let g_uCamera_ref;
let g_uProjection_ref;
let g_uTexture_ref;
let g_uCubeMap_ref;
let g_uDrawSkybox_ref;
let g_uLightDir_ref;
let g_uLightColor_ref;
let g_uModelWorldInverseTranspose_ref;
let g_uDrawMoon_ref;
let g_uAlpha_ref;
let g_uMoonLightEnabled_ref;

// End flash lighting toggle state (default: disabled)
let g_moonLightEnabled = false;
// Timer for automatically turning off end flash after 15 seconds
let g_endFlashTimer = null;

// End flash light direction (normalized direction TO the end flash) (cursor tab)
// Position end flash high in the sky, slightly to the side
const MOON_DIRECTION = (() => {
    const x = 0.3;
    const y = 0.8;
    const z = 0.5;
    const len = Math.sqrt(x*x + y*y + z*z);
    return [x/len, y/len, z/len];
})();

// End flash light color - purple-tinted light (cursor tab)
const MOON_LIGHT_COLOR = [1.0, 0.7, 1.0];  

// Dragon scene graph
let g_dragonRoot;
let g_dragonNodes = {};

let g_terrainModelMatrix;
let g_terrainWorldMatrix;
let g_projectionMatrix;

// Terrain Mesh definition
let g_terrainMesh;

const NUM_TOWERS = 8;
let g_towerModelMatrix;
let g_towerHeight = 35;
let g_towerWorldMatrices = [];
let g_towerMatrix;

let g_crystalFirst = 0;
let g_crystalCount = 0;
let g_crystalPositions = [];
let g_crystalRotation = 0;
const CRYSTAL_ROT_SPEED = 100;

// Crystal light configuration
const CRYSTAL_LIGHT_CONFIG = {
    color: [0.8, 0.4, 1.0],      // Purple-pink glow
    intensity: 1.5,
    attenuation: {
        constant: 1.0,
        linear: 0.09,
        quadratic: 0.032
    }
};

let g_terrainOptions = null;   // copy of options used to generate terrain
let g_terrainNoise = null;   // Noise instance using same seed

let g_terrainOffset = { x: 0, y: 0, z: 0 };  // world-space terrain translation

function initCrystalLights() {
    if (!g_pointLightManager) {
        console.warn('initCrystalLights: PointLightManager not initialized');
        return;
    }
    
    for (let i = 0; i < g_crystalPositions.length; i++) {
        const pos = g_crystalPositions[i];
        
        g_pointLightManager.addLight({
            id: `crystal_${i}`,
            position: [pos.x, pos.y + 2.0, pos.z],  // Slightly above crystal center
            color: CRYSTAL_LIGHT_CONFIG.color,
            intensity: CRYSTAL_LIGHT_CONFIG.intensity,
            attenuation: CRYSTAL_LIGHT_CONFIG.attenuation
        });
    }
    
    console.log(`Initialized ${g_crystalPositions.length} crystal lights`);
}

function updateCrystalLights() {
    if (!g_pointLightManager) return;
    
    for (let i = 0; i < g_crystalPositions.length; i++) {
        const pos = g_crystalPositions[i];
        
        // Crystals are stationary position-wise (only rotate), but we could add a bob
        // For now, just ensure position is correct
        g_pointLightManager.updateLight(`crystal_${i}`, {
            position: [pos.x, pos.y + 2.0, pos.z]
        });
    }
}

function main() {
    // Keep track of time each frame by starting with our current time
    g_lastFrameMS = Date.now();

    g_canvas = document.getElementById('canvas');

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Setup our reactions from keys and mouse
    setupControls();

    // We will call this at the end of most main functions from now on
    loadImageFiles();
}

// cursor tab used a lot for this function since it was a lot of repetition
function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to initialize shaders.');
        return;
    }

    // class for building the terrain mesh
    let terrainGenerator = new TerrainGenerator();
    // use the current milliseconds as our seed by default
    let seed = new Date().getMilliseconds();

    // Setup the options for our terrain generation
    let options = {
        width: 100,
        height: 10,
        depth: 100,
        seed: seed,
        noisefn: "perlin", // Other options are "simplex" and "perlin"
        roughness: 10  // Lower roughness for smoother, plateau-like terrain (End dimension style)
    };

    // Save for sampling later in drive mode
    g_terrainOptions = options;
    g_terrainNoise = new Noise(seed);

    // construct a terrain mesh with vertices, UVs, shades, and normals
    let terrainData = terrainGenerator.generateTerrainMesh(options);
    let terrain = terrainData.vertices;
    let terrainUVs = terrainData.uvs;
    let terrainShades = terrainData.shades;
    let terrainNormals = terrainData.normals;

    // "flatten" the terrain vertices to construct our usual global mesh
    g_terrainMesh = []
    for (let i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i])
    }
    
    // Flatten terrain normals
    let flatTerrainNormals = [];
    for (let i = 0; i < terrainNormals.length; i++) {
        flatTerrainNormals.push(...terrainNormals[i]);
    }

    let towerShades = [];
    for (let i = 0; i < g_towerMesh.length / 3; i++) {
        towerShades.push(1.0); // full brightness
    }

    let portalShades = [];
    for (let i = 0; i < g_portalMesh.length / 3; i++) {
        portalShades.push(1.0);
    }

    let flatUVs = [];
    for (let i = 0; i < terrainUVs.length; i++) {
        flatUVs.push(...terrainUVs[i]);
    }

    // Create shades for the dragon parts (uniform shading for all parts)
    let dragonBodyShades = [];
    for (let i = 0; i < g_dragonBodyMesh.length / 3; i++) {
        dragonBodyShades.push(1.0); // full brightness
    }
    let dragonWingLShades = [];
    for (let i = 0; i < g_dragonWingLMesh.length / 3; i++) {
        dragonWingLShades.push(1.0); // full brightness
    }
    let dragonWingRShades = [];
    for (let i = 0; i < g_dragonWingRMesh.length / 3; i++) {
        dragonWingRShades.push(1.0); // full brightness
    }

    // Vertex counts
    const terrainVerts = g_terrainMesh.length / 3;
    const towerVerts = g_towerMesh.length / 3;
    const portalVerts = g_portalMesh.length / 3;
    const dragonBodyVerts = g_dragonBodyMesh.length / 3;
    const dragonWingLVerts = g_dragonWingLMesh.length / 3;
    const dragonWingRVerts = g_dragonWingRMesh.length / 3;
    const crystalVerts = g_crystalMesh.length / 3;
    const crystalBaseVerts = g_crystalBaseMesh.length / 3;
    const endermanVerts = g_endermanMesh.length / 3;
    const skyboxVerts = g_skyboxMesh.length / 3;
    const moonVerts = g_moonMesh.length / 3;
    const portalFillVerts = g_portalFillMesh.length / 3;
    const torchVerts = g_torchMesh.length / 3;

    // Create shades for enderman
    let endermanShades = [];
    for (let i = 0; i < endermanVerts; i++) {
        endermanShades.push(1.0);
    }

    // Create dummy UVs, shades, and normals for skybox (skybox doesn't use them, but VBO structure requires them)
    let skyboxUVs = [];
    let skyboxShades = [];
    let skyboxNormals = [];
    for (let i = 0; i < skyboxVerts; i++) {
        skyboxUVs.push(0.0, 0.0);
        skyboxShades.push(1.0);
        skyboxNormals.push(0.0, 1.0, 0.0); // dummy up normal
    }
    
    // Moon shades (fullbright - not used since moon is emissive)
    let moonShades = [];
    for (let i = 0; i < moonVerts; i++) {
        moonShades.push(1.0);
    }

    // Vertex section: terrain, towers, portal, dragon, crystal, crystalBase, enderman, skybox, moon, portalFill, torch
    let vertexSection = g_terrainMesh
        .concat(g_towerMesh)
        .concat(g_portalMesh)
        .concat(g_dragonBodyMesh, g_dragonWingLMesh, g_dragonWingRMesh)
        .concat(g_crystalMesh)
        .concat(g_crystalBaseMesh)
        .concat(g_endermanMesh)
        .concat(g_skyboxMesh)
        .concat(g_moonMesh)
        .concat(g_portalFillMesh)
        .concat(g_torchMesh);

    // UV section: terrain, towers, portal, dragon, crystal, crystalBase, enderman, skybox, moon, portalFill, torch
    let uvSection = flatUVs
        .concat(g_towerUVs)
        .concat(g_portalUVs)
        .concat(g_dragonBodyUVs, g_dragonWingLUVs, g_dragonWingRUVs)
        .concat(g_crystalUVs)
        .concat(g_crystalBaseUVs)
        .concat(g_endermanUVs)
        .concat(skyboxUVs)
        .concat(g_moonUVs)
        .concat(g_portalFillUVs)
        .concat(g_torchUVs);

    // Shade section: terrain, towers, portal, dragon, crystal, crystalBase, enderman, skybox, moon, portalFill, torch
    let shadeSection = terrainShades
        .concat(towerShades)
        .concat(portalShades)
        .concat(dragonBodyShades, dragonWingLShades, dragonWingRShades)
        .concat(g_crystalShades)
        .concat(g_crystalBaseShades)
        .concat(endermanShades)
        .concat(skyboxShades)
        .concat(moonShades)
        .concat(g_portalFillShades)
        .concat(g_torchShades);

    // Normal section: terrain, towers, portal, dragon, crystal, crystalBase, enderman, skybox, moon, portalFill, torch
    let normalSection = flatTerrainNormals
        .concat(g_towerNormals)
        .concat(g_portalNormals)
        .concat(g_dragonBodyNormals, g_dragonWingLNormals, g_dragonWingRNormals)
        .concat(g_crystalNormals)
        .concat(g_crystalBaseNormals)
        .concat(g_endermanNormals)
        .concat(skyboxNormals)
        .concat(g_moonNormals)
        .concat(g_portalFillNormals)
        .concat(g_torchNormals);

    // Where the crystal lives in the VBO
    g_crystalFirst = terrainVerts + towerVerts + portalVerts + dragonBodyVerts + dragonWingLVerts + dragonWingRVerts;
    g_crystalCount = crystalVerts;

    // Where the crystal base (obsidian) lives in the VBO
    window.g_crystalBaseFirst = g_crystalFirst + crystalVerts;
    window.g_crystalBaseCount = crystalBaseVerts;

    // Where the enderman lives in the VBO
    window.g_endermanFirst = window.g_crystalBaseFirst + crystalBaseVerts;
    window.g_endermanCount = endermanVerts;

    // Where the skybox lives in the VBO
    window.g_skyboxFirst = window.g_endermanFirst + endermanVerts;
    window.g_skyboxCount = skyboxVerts;
    
    // Where the moon lives in the VBO
    window.g_moonFirst = window.g_skyboxFirst + skyboxVerts;
    window.g_moonCount = moonVerts;

    // Where the portal fill lives in the VBO
    window.g_portalFillFirst = window.g_moonFirst + moonVerts;
    window.g_portalFillCount = portalFillVerts;

    // Where the torch lives in the VBO (used by torch.js)
    g_torchFirst = window.g_portalFillFirst + portalFillVerts;
    g_torchCount = torchVerts;

    // Final packed buffer: [positions][uvs][shades][normals]
    let data = vertexSection
        .concat(uvSection)
        .concat(shadeSection)
        .concat(normalSection);


    if (!initVBO(new Float32Array(data))) {
        return;
    }

    // Communicate our data layout to the GPU
    let allVerticesLength = vertexSection.length;
    let allUVsLength = uvSection.length;
    let allShadesLength = shadeSection.length;
    let uvOffset = allVerticesLength * FLOAT_SIZE;
    let shadeOffset = uvOffset + allUVsLength * FLOAT_SIZE;
    let normalOffset = shadeOffset + allShadesLength * FLOAT_SIZE;


    g_towerModelMatrix = new Matrix4();

    // Precompute tower world matrices in a ring
    g_towerWorldMatrices = [];
    g_crystalPositions = [];
    const radius = 40;  // how far from origin
    const centerX = 0;  // ring center in world space
    const centerZ = 0;

    // wanted the towers to be roughly a ring
    for (let i = 0; i < NUM_TOWERS; i++) {
        const angle = i * 2 * Math.PI / NUM_TOWERS;
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;


        const scaleY = 1.0 + Math.random() * 0.6;
        const translateY = -20
        const world = new Matrix4().translate(x, translateY, z).scale(1.0, scaleY, 1.0);

        g_towerWorldMatrices.push(world);

        const topY = (g_towerHeight + translateY) * scaleY;

        // store crystal center to be slightly above top
        g_crystalPositions.push({
            x: x,
            y: topY,
            z: z
        });
    }


    if (!setupVec(3, 'a_Position', 0, 0)) {
        return;
    }
    if (!setupVec(2, 'a_TexCoord', 0, uvOffset)) {
        return;
    }
    if (!setupVec(1, 'a_Shade', 0, shadeOffset)) {
        return;
    }
    if (!setupVec(3, 'a_Normal', 0, normalOffset)) {
        return;
    }

    // Get references to GLSL uniforms
    g_uModel_ref = gl.getUniformLocation(gl.program, 'u_Model');
    g_uWorld_ref = gl.getUniformLocation(gl.program, 'u_World');
    g_uCamera_ref = gl.getUniformLocation(gl.program, 'u_Camera');
    g_uProjection_ref = gl.getUniformLocation(gl.program, 'u_Projection');
    g_uTexture_ref = gl.getUniformLocation(gl.program, 'u_Texture');
    g_uCubeMap_ref = gl.getUniformLocation(gl.program, 'u_Skybox');
    g_uDrawSkybox_ref = gl.getUniformLocation(gl.program, 'u_DrawSkybox');
    g_uLightDir_ref = gl.getUniformLocation(gl.program, 'u_LightDir');
    g_uLightColor_ref = gl.getUniformLocation(gl.program, 'u_LightColor');
    g_uModelWorldInverseTranspose_ref = gl.getUniformLocation(gl.program, 'u_ModelWorldInverseTranspose');
    g_uDrawMoon_ref = gl.getUniformLocation(gl.program, 'u_DrawMoon');
    g_uAlpha_ref = gl.getUniformLocation(gl.program, 'u_Alpha');
    g_uMoonLightEnabled_ref = gl.getUniformLocation(gl.program, 'u_MoonLightEnabled');

    // Initialize point light manager and get uniform locations
    g_pointLightManager = new PointLightManager();
    g_pointLightManager.initUniforms(gl);
    
    // Initialize crystal lights (add a point light at each crystal position)
    initCrystalLights();

    // Offsets into VBO for different parts
    const towerFirst = g_terrainMesh.length / 3;
    const towerCount = g_towerMesh.length / 3;
    const portalFirst = towerFirst + towerCount;
    const portalCount = g_portalMesh.length / 3;

    const dragonBodyFirst = terrainVerts + towerVerts + portalVerts;

    // taken from first project
    const dragonDrawList = [
        {
            name: "dragon_body",
            first: dragonBodyFirst,
            count: g_dragonBodyMesh.length / 3,
            mode: gl.TRIANGULAR
        },
        {
            name: "dragon_wingL",
            first: dragonBodyFirst + (g_dragonBodyMesh.length / 3),
            count: g_dragonWingLMesh.length / 3,
            mode: gl.TRIANGLES
        },
        {
            name: "dragon_wingR",
            first: dragonBodyFirst
                + (g_dragonBodyMesh.length / 3)
                + (g_dragonWingLMesh.length / 3),
            count: g_dragonWingRMesh.length / 3,
            mode: gl.TRIANGLES
        }
    ];

    // Save for use in draw()
    window.g_towerFirst = towerFirst;
    window.g_towerCount = towerCount;
    window.g_portalFirst = portalFirst;
    window.g_portalCount = portalCount;

    // Create scene graph for dragon animation
    g_dragonRoot = new SceneNode({ name: "root" });
    g_dragonNodes = {};

    // Pass wing mesh data for automatic pivot calculation
    const wingMeshData = {
        wingL: g_dragonWingLMesh,
        wingR: g_dragonWingRMesh
    };
    setupDragonSceneGraph(g_dragonRoot, g_dragonNodes, dragonDrawList, wingMeshData);

    // Setup texture for end stone blocks 
    window.g_endStoneTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, window.g_endStoneTexturePointer);

    // Send image to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_endStoneImage);

    // Set texture parameters for pixelated Minecraft look
    // cursor tab suggested this
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // For non-power-of-two textures, must use CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for obsidian tower 
    window.g_obsidianTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, window.g_obsidianTexturePointer);

    // Send image to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_obsidianImage);

    // Set texture parameters for pixelated Minecraft look
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for bedrock 
    window.g_bedrockTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, window.g_bedrockTexturePointer);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_bedrockImage);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for dragon 
    window.g_dragonTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, window.g_dragonTexturePointer);

    // Send image to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_dragonImage);

    // Generate mipmap for smoother dragon texture
    gl.generateMipmap(gl.TEXTURE_2D);

    // Setup texture for enderman
    window.g_endermanTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, window.g_endermanTexturePointer);

    // Send image to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_endermanImage);

    // Set texture parameters for pixelated Minecraft look
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for end crystal
    window.g_crystalTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, window.g_crystalTexturePointer);

    // Send image to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_crystalImage);

    // DEBUG: Print texture info
    console.log('=== CRYSTAL TEXTURE DEBUG INFO ===');
    console.log('Texture dimensions:', g_crystalImage.width, 'x', g_crystalImage.height);
    console.log('Texture loaded:', g_crystalImage.complete);

    // Set texture parameters - use NEAREST for pixelated Minecraft look
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for end portal
    window.g_endPortalTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, window.g_endPortalTexturePointer);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_endPortalImage);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup texture for torch
    window.g_torchTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, window.g_torchTexturePointer);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_torchImage);

    // Set texture parameters for pixelated Minecraft look
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Setup cube map for skybox
    // https://webglfundamentals.org/webgl/lessons/webgl-cube-maps.html
    window.g_skyboxTexturePointer = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, window.g_skyboxTexturePointer);

    // Bind a texture to each cube map slot
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosX);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosY);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosZ);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegX);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegY);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegZ);

    // Mipmap our cube texture
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

    // Setup a model and world matrix for our terrain
    g_terrainModelMatrix = new Matrix4();
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2);

    // Store terrain translation for world-space sampling
    g_terrainOffset = {
        x: -options.width / 2,
        y: -options.height,
        z: -options.depth / 2
    };

    g_dragonMatrix = new Matrix4()
        .translate(0, 8, 0)
        .scale(0.5, 0.5, 0.5)
        .translate(-0.5, -0.5, -0.5);

    // Initialize free-flying camera at a good starting position
    initCamera();

    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 1000);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Setup for ticks
    g_lastFrameMS = Date.now();

    // Initialize blocked positions for enderman collision detection
    // Must be called after g_crystalPositions is populated
    initBlockedPositions();

    // Initialize endermen positions and teleport timers
    initEndermen();
    
    // Initialize dragon button visibility
    updateDragonButtons();
    
    // Initialize automatic perch timing
    initDragonAutoPerch();

    tick();
}

function updateDragonButtons() {
    const perchBtn = document.getElementById('perchDragonBtn');
    const unperchBtn = document.getElementById('unperchDragonBtn');
    const killBtn = document.getElementById('killDragonBtn');
    const respawnBtn = document.getElementById('respawnDragonBtn');
    
    if (!perchBtn || !unperchBtn || !killBtn || !respawnBtn) return;
    
    // If dragon is dead, show only respawn button
    if (g_dragonDead) {
        perchBtn.style.display = 'none';
        unperchBtn.style.display = 'none';
        killBtn.style.display = 'none';
        respawnBtn.style.display = 'inline-block';
    }
    // If dragon is perched, show only kill button (unperch is automatic)
    else if (g_dragonPerched) {
        perchBtn.style.display = 'none';
        unperchBtn.style.display = 'none';  // Always hide unperch button - it's automatic
        killBtn.style.display = 'inline-block';
        respawnBtn.style.display = 'none';
    }
    // If dragon is in an animation, hide all buttons
    else if (g_dragonFlyInActive || g_dragonFlyOutActive || g_dragonDeathActive) {
        perchBtn.style.display = 'none';
        unperchBtn.style.display = 'none';
        killBtn.style.display = 'none';
        respawnBtn.style.display = 'none';
    }
    // Dragon is flying freely, show perch button
    else {
        perchBtn.style.display = 'inline-block';
        unperchBtn.style.display = 'none';
        killBtn.style.display = 'none';
        respawnBtn.style.display = 'none';
    }
}

// function to apply all the logic for a single frame tick
function tick() {
    // Calculate time since the last frame
    let currentTime = Date.now();
    let deltaMS = currentTime - g_lastFrameMS;
    g_lastFrameMS = currentTime;

    g_crystalRotation += CRYSTAL_ROT_SPEED * (deltaMS / 1000.0);
    if (g_crystalRotation >= 360) g_crystalRotation -= 360;

    updateCameraPosition(deltaMS);
    updateCameraLookAtLerp(deltaMS);  // <-- smooth look-at animation

    // Update dragon animation
    if (g_dragonDeathActive) {
        updateDragonDeath(deltaMS);
    } else if (g_dragonFlyInActive) {
        updateDragonFlyIn(deltaMS);
    } else if (g_dragonFlyOutActive) {
        updateDragonFlyOut(deltaMS);
    } else if (!g_dragonDead) {
        // Only orbits when not in a fly animation, not perched, and not dead
        updateDragon(g_dragonNodes, [0, 1, 0], deltaMS);
    }
    
    // Update automatic perch timing and trigger perch/unperch
    updateDragonAutoPerch(deltaMS);

    // Update all endermen positions and teleporting
    updateEndermen(deltaMS);
    
    // Update dragon button visibility
    updateDragonButtons();

    draw();

    requestAnimationFrame(tick, g_canvas);
}

// Helper function to compute and set the inverse-transpose matrix for proper normal transformation
function setModelWorldInverseTranspose(modelMatrix, worldMatrix) {
    let modelWorld = new Matrix4().set(worldMatrix).multiply(modelMatrix);
    let inverseTranspose = new Matrix4().setInverseOf(modelWorld).transpose();
    gl.uniformMatrix4fv(g_uModelWorldInverseTranspose_ref, false, inverseTranspose.elements);
}

// draw to the screen on the next frame
function draw() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Camera + projection
    let cameraMatrix = calculateCameraMatrix();
    gl.uniformMatrix4fv(g_uCamera_ref, false, cameraMatrix.elements);
    gl.uniformMatrix4fv(g_uProjection_ref, false, g_projectionMatrix.elements);
    
    // Set end flash light direction and color (constant for whole frame)
    gl.uniform3fv(g_uLightDir_ref, MOON_DIRECTION);
    gl.uniform3fv(g_uLightColor_ref, MOON_LIGHT_COLOR);
    
    // Set end flash lighting enabled state
    gl.uniform1i(g_uMoonLightEnabled_ref, g_moonLightEnabled);
    
    // Upload point lights to GPU
    if (g_pointLightManager) {
        g_pointLightManager.uploadToGPU(gl);
    }
    
    // Default: not drawing end flash
    gl.uniform1i(g_uDrawMoon_ref, false);
    
    // Default alpha is 1.0 (fully opaque)
    gl.uniform1f(g_uAlpha_ref, 1.0);

    // --- SKYBOX RENDER (draw first so it appears behind everything) ---
    // Set our texture pointer to our cubemap location
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, window.g_skyboxTexturePointer);
    gl.uniform1i(g_uCubeMap_ref, 5);
    
    // The skybox doesn't care about our model/world matrix, so we just need to say to draw the skybox
    gl.uniform1i(g_uDrawSkybox_ref, true);
    
    // Disable depth writing for skybox so it doesn't interfere with other objects
    gl.depthMask(false);
    
    // Draw the skybox (no model/world matrix needed - it's always at infinity)
    const identity = new Matrix4();
    gl.uniformMatrix4fv(g_uModel_ref, false, identity.elements);
    gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);
    gl.drawArrays(gl.TRIANGLES, window.g_skyboxFirst, window.g_skyboxCount);
    
    // Re-enable depth writing for normal objects
    gl.depthMask(true);
    gl.uniform1i(g_uDrawSkybox_ref, false);

    // --- END FLASH RENDER (after skybox, before other objects) ---
    // Only render end flash if lighting is enabled
    if (g_moonLightEnabled) {
        // Position end flash far in the sky in the direction of the light
        const moonDistance = 200;  // Far away so it looks like it's in the sky
        const moonX = MOON_DIRECTION[0] * moonDistance;
        const moonY = MOON_DIRECTION[1] * moonDistance;
        const moonZ = MOON_DIRECTION[2] * moonDistance;
        
        // End flash is rendered as emissive (fullbright)
        gl.uniform1i(g_uDrawMoon_ref, true);
        
        // Use end stone texture for a pale end flash look (or could create a dedicated texture)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, window.g_endStoneTexturePointer);
        gl.uniform1i(g_uTexture_ref, 0);
        
        // Create end flash model matrix - position it in the sky
        const moonModelMatrix = new Matrix4()
            .translate(moonX, moonY, moonZ)
            .scale(3.0, 3.0, 3.0);  // Scale the end flash to be visible
        
        gl.uniformMatrix4fv(g_uModel_ref, false, moonModelMatrix.elements);
        gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);
        setModelWorldInverseTranspose(moonModelMatrix, identity);
        
        // Disable backface culling for the end flash (we want to see it from any angle)
        gl.disable(gl.CULL_FACE);
        gl.drawArrays(gl.TRIANGLES, window.g_moonFirst, window.g_moonCount);
        gl.enable(gl.CULL_FACE);
        
        // Done drawing end flash
        gl.uniform1i(g_uDrawMoon_ref, false);
    }

    // --- TERRAIN ---
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, window.g_endStoneTexturePointer);
    gl.uniform1i(g_uTexture_ref, 0);
    gl.uniformMatrix4fv(g_uModel_ref, false, g_terrainModelMatrix.elements);
    gl.uniformMatrix4fv(g_uWorld_ref, false, g_terrainWorldMatrix.elements);
    setModelWorldInverseTranspose(g_terrainModelMatrix, g_terrainWorldMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, g_terrainMesh.length / 3);

    // --- TOWERS ---
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, window.g_obsidianTexturePointer);
    gl.uniform1i(g_uTexture_ref, 1);
    gl.uniformMatrix4fv(g_uModel_ref, false, g_towerModelMatrix.elements);

    const towerFirst = window.g_towerFirst;
    const towerCount = window.g_towerCount;

    for (let i = 0; i < g_towerWorldMatrices.length; i++) {
        gl.uniformMatrix4fv(g_uWorld_ref, false, g_towerWorldMatrices[i].elements);
        setModelWorldInverseTranspose(g_towerModelMatrix, g_towerWorldMatrices[i]);
        gl.drawArrays(gl.TRIANGLES, towerFirst, towerCount);
    }

    // --- END PORTAL  ---
    gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, window.g_bedrockTexturePointer);
    gl.uniform1i(g_uTexture_ref, 3);

    // get the center y for the portal
    const centerSample = getTerrainSample(0, 0);
    g_portalModelMatrix.setIdentity();
    g_portalModelMatrix.translate(0, centerSample.height + 0.5, 0);

    gl.uniformMatrix4fv(g_uModel_ref, false, g_portalModelMatrix.elements);
    setModelWorldInverseTranspose(g_portalModelMatrix, identity);

    const portalFirst = window.g_portalFirst;
    const portalCount = window.g_portalCount;
    gl.drawArrays(gl.TRIANGLES, portalFirst, portalCount);

    // --- PORTAL FILL (only when dragon is dead) ---
    if (g_dragonDead) {
        gl.activeTexture(gl.TEXTURE7);
        gl.bindTexture(gl.TEXTURE_2D, window.g_endPortalTexturePointer);
        gl.uniform1i(g_uTexture_ref, 7);

        // Position portal fill at same height as portal
        const portalFillModel = new Matrix4()
            .setTranslate(0, centerSample.height + 0.5, 0);

        gl.uniformMatrix4fv(g_uModel_ref, false, portalFillModel.elements);
        setModelWorldInverseTranspose(portalFillModel, identity);
        gl.drawArrays(gl.TRIANGLES, window.g_portalFillFirst, window.g_portalFillCount);
    }

    // --- DRAGON ---
    // Only render dragon if not dead
    if (!g_dragonDead) {
        gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);

        // And the correct texture unit
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, window.g_dragonTexturePointer);
        gl.uniform1i(g_uTexture_ref, 2);

        // If death animation is active, use blending for fade effect
        if (g_dragonDeathActive) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.uniform1f(g_uAlpha_ref, g_dragonDeathAlpha);
        }

        // Now update & render scene graph
        g_dragonRoot.updateWorld(identity, 0);
        g_dragonRoot.render(gl, g_uModel_ref, g_uModelWorldInverseTranspose_ref);

        // Disable blending and reset alpha after dragon render
        if (g_dragonDeathActive) {
            gl.disable(gl.BLEND);
            gl.uniform1f(g_uAlpha_ref, 1.0);
        }
    }

    // --- END CRYSTALS ON TOWER TOPS ---
    gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);

    // Use crystal texture
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, window.g_crystalTexturePointer);
    gl.uniform1i(g_uTexture_ref, 6);

    // First pass: render the solid base (bottom cube) - no rotation, no blending
    for (let i = 0; i < g_crystalPositions.length; i++) {
        const p = g_crystalPositions[i];

        // Base doesn't rotate - just translate to position
        const baseModel = new Matrix4()
            .setTranslate(p.x, p.y, p.z);

        gl.uniformMatrix4fv(g_uModel_ref, false, baseModel.elements);
        setModelWorldInverseTranspose(baseModel, identity);
        gl.drawArrays(gl.TRIANGLES, window.g_crystalBaseFirst, window.g_crystalBaseCount);
    }

    // Second pass: render the glowing crystal parts - with rotation and additive blending
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);  // Additive blend for glow effect
    
    for (let i = 0; i < g_crystalPositions.length; i++) {
        const p = g_crystalPositions[i];

        // Rotate first (around origin), then translate to position
        const crystalModel = new Matrix4()
            .setRotate(g_crystalRotation + i * 30, 0, 1, 0)
            .translate(p.x, p.y, p.z);

        gl.uniformMatrix4fv(g_uModel_ref, false, crystalModel.elements);
        setModelWorldInverseTranspose(crystalModel, identity);
        gl.drawArrays(gl.TRIANGLES, g_crystalFirst, g_crystalCount);
    }
    
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    // --- ENDERMEN RENDER ---
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, window.g_endermanTexturePointer);
    gl.uniform1i(g_uTexture_ref, 4);
    gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);
    
    // Render all endermen
    // Debug: Try different culling modes for enderman (winding order issue)
    // Option 1: Disable culling entirely
    gl.disable(gl.CULL_FACE);
    
    for (let i = 0; i < g_endermen.length; i++) {
        const enderman = g_endermen[i];
        
        // Position the enderman on terrain based on current position
        // Mesh is now centered at origin in loader, so this works correctly:
        // 1. Rotate around Y-axis for random facing direction
        // 2. Translate to world position
        const endermanModel = new Matrix4()
            .setRotate(enderman.rotation, 0, 1, 0)
            .translate(enderman.position.x, updateEndermanHeight(enderman), enderman.position.z);
        
        gl.uniformMatrix4fv(g_uModel_ref, false, endermanModel.elements);
        setModelWorldInverseTranspose(endermanModel, identity);
        gl.drawArrays(gl.TRIANGLES, window.g_endermanFirst, window.g_endermanCount);
    }
    
    // Option 2: Try reverse cull face direction (uncomment to test)
    // gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.FRONT);  // Cull front faces instead of back
    // gl.drawArrays(gl.TRIANGLES, window.g_endermanFirst, window.g_endermanCount);
    // gl.cullFace(gl.BACK);  // Restore default
    
    gl.enable(gl.CULL_FACE);
    
    // --- TORCH RENDER ---
    renderTorches(gl, g_uModel_ref, g_uModelWorldInverseTranspose_ref);
}

function updateEndermanCount(value) {
    NUM_ENDERMEN = parseInt(value);
    document.getElementById('endermanCount').textContent = NUM_ENDERMEN;
    
    // Reinitialize endermen with new count if terrain is already loaded
    if (g_terrainOptions) {
        initEndermen();
    }
}

function toggleMoonLight() {
    // Clear any existing timer
    if (g_endFlashTimer !== null) {
        clearTimeout(g_endFlashTimer);
        g_endFlashTimer = null;
    }
    
    // Turn on end flash
    g_moonLightEnabled = true;
    const button = document.getElementById('moonLightToggle');
    button.value = 'End Flash Active';
    
    // Automatically turn off after 15 seconds
    g_endFlashTimer = setTimeout(() => {
        g_moonLightEnabled = false;
        button.value = 'Trigger End Flash';
        g_endFlashTimer = null;
    }, 15000);  // 15 seconds = 15000 milliseconds
}

function setupControls() {
    // Setup the dictionary of keys we're tracking
    KEYS_TO_TRACK.forEach(key => {
        g_keysPressed[key] = false;
    });

    // Set key flag to true when key starts being pressed
    document.addEventListener('keydown', function(event) {
        KEYS_TO_TRACK.forEach(key => {
            if (event.key == key) {
                g_keysPressed[key] = true;
            }
        });

        if (event.key === 't') {
            toggleCameraMode();
        }
    });

    // Set key flag to false when key stops being pressed
    document.addEventListener('keyup', function(event) {
        KEYS_TO_TRACK.forEach(key => {
            if (event.key == key) {
                g_keysPressed[key] = false;
            }
        });
    });
}
