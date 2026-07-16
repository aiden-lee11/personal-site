// loader.js - Asset loading
// Image, OBJ, and shader loading plus procedural generation

// Texture images
let g_endStoneImage;
let g_obsidianImage;
let g_dragonImage;
let g_bedrockImage;
let g_endermanImage;
let g_crystalImage;
let g_endPortalImage;
let g_torchImage;

// Skybox images
let g_skyPosX;
let g_skyPosY;
let g_skyPosZ;
let g_skyNegX;
let g_skyNegY;
let g_skyNegZ;

// Skybox cube mesh
let g_skyboxMesh = [];

// Dragon mesh data
let g_dragonBodyMesh = [];
let g_dragonBodyUVs = [];
let g_dragonBodyNormals = [];
let g_dragonWingLMesh = [];
let g_dragonWingLUVs = [];
let g_dragonWingLNormals = [];
let g_dragonWingRMesh = [];
let g_dragonWingRUVs = [];
let g_dragonWingRNormals = [];

// Tower mesh data
let g_towerMesh = [];
let g_towerUVs = [];
let g_towerNormals = [];

// Portal mesh data
let g_portalMesh = [];
let g_portalUVs = [];
let g_portalNormals = [];
let g_portalModelMatrix;

// Portal fill mesh data (obsidian blocks that fill portal when dragon dies)
let g_portalFillMesh = [];
let g_portalFillUVs = [];
let g_portalFillNormals = [];
let g_portalFillShades = [];

// Crystal mesh data (the glowing upper crystal part)
let g_crystalMesh = [];
let g_crystalUVs = [];
let g_crystalShades = [];
let g_crystalNormals = [];

// Crystal base mesh data (the solid bottom cube)
let g_crystalBaseMesh = [];
let g_crystalBaseUVs = [];
let g_crystalBaseShades = [];
let g_crystalBaseNormals = [];

// Moon mesh data (global)
let g_moonMesh = [];
let g_moonUVs = [];
let g_moonNormals = [];

// Torch mesh data
let g_torchMesh = [];
let g_torchUVs = [];
let g_torchNormals = [];
let g_torchShades = [];

/*
 * Helper function to load image files
 */
async function loadImageFiles() {
    g_endStoneImage = new Image();
    g_endStoneImage.src = "assets/textures/end_stone_texture.png";
    await g_endStoneImage.decode();

    // Load obsidian texture (or fallback to endstone if not available)
    g_obsidianImage = new Image();
    g_obsidianImage.src = "assets/textures/obsidian_texture.png";
    // Fallback to endstone if obsidian not found
    g_obsidianImage.onerror = function() {
        console.log("Obsidian texture not found, using end_stone as fallback");
        g_obsidianImage.src = "assets/textures/end_stone_texture.png";
    };
    await g_obsidianImage.decode();

    // Load dragon texture
    g_dragonImage = new Image();
    g_dragonImage.src = "assets/textures/dragontexture.png";
    await g_dragonImage.decode();

    g_bedrockImage = new Image();
    g_bedrockImage.src = "assets/textures/bedrock_texture.png";
    await g_bedrockImage.decode();

    // Load enderman texture
    g_endermanImage = new Image();
    g_endermanImage.src = "assets/textures/enderman.png";
    await g_endermanImage.decode();

    // Load crystal texture
    g_crystalImage = new Image();
    g_crystalImage.src = "assets/textures/end_crystal.png";
    await g_crystalImage.decode();

    // Load end portal texture
    g_endPortalImage = new Image();
    g_endPortalImage.src = "assets/textures/end_portal.png";
    await g_endPortalImage.decode();

    // Load torch texture
    g_torchImage = new Image();
    g_torchImage.src = "assets/textures/torch.png";
    await g_torchImage.decode();

    // Load skybox images
    g_skyPosX = new Image();
    g_skyPosY = new Image();
    g_skyPosZ = new Image();
    g_skyNegX = new Image();
    g_skyNegY = new Image();
    g_skyNegZ = new Image();
    g_skyPosX.src = "assets/textures/skybox/right.png";
    g_skyPosY.src = "assets/textures/skybox/top.png";
    g_skyPosZ.src = "assets/textures/skybox/front.png";
    g_skyNegX.src = "assets/textures/skybox/left.png";
    g_skyNegY.src = "assets/textures/skybox/bottom.png";
    g_skyNegZ.src = "assets/textures/skybox/back.png";
    await g_skyPosX.decode();
    await g_skyPosY.decode();
    await g_skyPosZ.decode();
    await g_skyNegX.decode();
    await g_skyNegY.decode();
    await g_skyNegZ.decode();

    // Load OBJ files
    await loadOBJFiles();
}

/*
 * Helper function to load OBJ files
 */
async function loadOBJFiles() {
    // Build a procedural tower from cubes
    buildProceduralTower();
    console.log('Built procedural tower with', g_towerMesh.length / 3, 'vertices and', g_towerUVs.length / 2, 'UV coords');

    buildEndPortal();
    console.log('Built end portal with', g_portalMesh.length / 3, 'vertices and', g_portalUVs.length / 2, 'UV coords');

    buildPortalFill();

    // Load dragon OBJ file by groups (body, wings)
    let dragonData = await fetch('assets/objects/dragon_poseglide_flat.obj').then(response => response.text()).then((x) => x);
    const dragonGroups = {};
    const dragonNormals = {};
    const dragonGroupUVs = {};
    readObjFileByGroup(dragonData, dragonGroups, dragonNormals, dragonGroupUVs);

    // Extract body and wings from groups based on naming patterns
    g_dragonBodyMesh = [];
    g_dragonBodyUVs = [];
    g_dragonBodyNormals = [];
    g_dragonWingLMesh = [];
    g_dragonWingLUVs = [];
    g_dragonWingLNormals = [];
    g_dragonWingRMesh = [];
    g_dragonWingRUVs = [];
    g_dragonWingRNormals = [];

    // the dragon loading code was taken from my first project
    for (const name in dragonGroups) {
        if (/Wing.*L\b/.test(name)) {
            // Left wing groups
            g_dragonWingLMesh.push(...dragonGroups[name]);
            if (dragonGroupUVs[name]) {
                g_dragonWingLUVs.push(...dragonGroupUVs[name]);
            }
            if (dragonNormals[name]) {
                g_dragonWingLNormals.push(...dragonNormals[name]);
            }
        } else if (/Wing.*R\b/.test(name)) {
            // Right wing groups
            g_dragonWingRMesh.push(...dragonGroups[name]);
            if (dragonGroupUVs[name]) {
                g_dragonWingRUVs.push(...dragonGroupUVs[name]);
            }
            if (dragonNormals[name]) {
                g_dragonWingRNormals.push(...dragonNormals[name]);
            }
        } else {
            // Body (everything else)
            g_dragonBodyMesh.push(...dragonGroups[name]);
            if (dragonGroupUVs[name]) {
                g_dragonBodyUVs.push(...dragonGroupUVs[name]);
            }
            if (dragonNormals[name]) {
                g_dragonBodyNormals.push(...dragonNormals[name]);
            }
        }
    }

    console.log('Loaded dragon with:');
    console.log('  Body:', g_dragonBodyMesh.length / 3, 'vertices');
    console.log('  Wing L:', g_dragonWingLMesh.length / 3, 'vertices');
    console.log('  Wing R:', g_dragonWingRMesh.length / 3, 'vertices');
    
    // Ensure dragon normals are filled if missing (generate default up normals)
    const ensureNormals = (mesh, normals) => {
        const vertCount = mesh.length / 3;
        const normalCount = normals.length / 3;
        if (normalCount < vertCount) {
            const missing = vertCount - normalCount;
            for (let i = 0; i < missing; i++) {
                normals.push(0, 1, 0); // default up normal
            }
        }
    };
    ensureNormals(g_dragonBodyMesh, g_dragonBodyNormals);
    ensureNormals(g_dragonWingLMesh, g_dragonWingLNormals);
    ensureNormals(g_dragonWingRMesh, g_dragonWingRNormals);

    let crystalData = await fetch('assets/objects/end_crystal.obj')
        .then(response => response.text())
        .then(x => x);

    g_crystalMesh = [];
    g_crystalUVs = [];
    g_crystalNormals = [];
    
    // Custom OBJ loader that properly handles the end crystal format
    // Separates crystal parts (use crystal texture) from obsidian parts (use obsidian texture)
    const crystalLines = crystalData.split('\n');
    const crystalV = [];   // All vertices
    const crystalVT = [];  // All texture coordinates
    const crystalVN = [];  // All normals
    
    // Materials that use the crystal texture atlas
    const crystalMaterials = ['Material_0', 'CoreGlow', 'Glass'];
    let currentMaterial = '';
    
    // Track vertex counts per material for debugging
    const materialVertCounts = {};
    
    // Reset arrays
    g_crystalBaseMesh = [];
    g_crystalBaseUVs = [];
    g_crystalBaseNormals = [];
    g_crystalBaseShades = [];
    
    // First pass: collect all vertices, UVs, and normals
    // claude helped generate the custom parser
    for (const line of crystalLines) {
        const sline = line.trim().split(/\s+/);
        if (sline[0] === 'v') {
            crystalV.push([parseFloat(sline[1]), parseFloat(sline[2]), parseFloat(sline[3])]);
        } else if (sline[0] === 'vt') {
            crystalVT.push([parseFloat(sline[1]), parseFloat(sline[2])]);
        } else if (sline[0] === 'vn') {
            crystalVN.push([parseFloat(sline[1]), parseFloat(sline[2]), parseFloat(sline[3])]);
        }
    }
    
    console.log('=== CRYSTAL OBJ PARSING ===');
    console.log('Total vertices in file:', crystalV.length);
    console.log('Total UVs in file:', crystalVT.length);
    console.log('Total normals in file:', crystalVN.length);
    
    // Reset base arrays
    g_crystalBaseMesh = [];
    g_crystalBaseUVs = [];
    g_crystalBaseNormals = [];
    g_crystalBaseShades = [];
    
    // once again help from claude and myself
    // Y threshold to separate base (solid) from crystal (glowing)
    // Vertices below this Y go to base, above go to crystal
    const Y_THRESHOLD = 1.0;
    
    // Second pass: process faces for crystal materials, separating by Y position
    for (const line of crystalLines) {
        const sline = line.trim().split(/\s+/);
        
        // Track current material
        if (sline[0] === 'usemtl') {
            currentMaterial = sline[1];
            console.log('Switching to material:', currentMaterial);
            if (!materialVertCounts[currentMaterial]) {
                materialVertCounts[currentMaterial] = 0;
            }
        }
        
        if (sline[0] === 'f' && crystalMaterials.includes(currentMaterial)) {
            const faceVerts = sline.slice(1).filter(x => x !== '');
            
            // Parse vertex index (format: v/vt/vn)
            const parseCrystalVertex = (faceVert) => {
                const parts = faceVert.split('/');
                return {
                    v: parts[0] ? parseInt(parts[0]) - 1 : -1,
                    vt: parts[1] ? parseInt(parts[1]) - 1 : -1,
                    vn: parts[2] ? parseInt(parts[2]) - 1 : -1
                };
            };
            
            const verts = faceVerts.map(parseCrystalVertex);
            
            // Check if this face belongs to the base (Y < threshold) or crystal (Y >= threshold)
            // Use the average Y of all vertices in the face
            let avgY = 0;
            let validVerts = 0;
            for (const vert of verts.slice(0, 3)) {
                if (vert.v >= 0 && vert.v < crystalV.length) {
                    avgY += crystalV[vert.v][1];
                    validVerts++;
                }
            }
            avgY = validVerts > 0 ? avgY / validVerts : 0;
            
            const isBase = avgY < Y_THRESHOLD;
            
            // All faces in this file are triangles
            if (verts.length >= 3) {
                for (const vert of verts.slice(0, 3)) {
                    const targetMesh = isBase ? g_crystalBaseMesh : g_crystalMesh;
                    const targetUVs = isBase ? g_crystalBaseUVs : g_crystalUVs;
                    const targetNormals = isBase ? g_crystalBaseNormals : g_crystalNormals;
                    
                    if (vert.v >= 0 && vert.v < crystalV.length) {
                        targetMesh.push(crystalV[vert.v][0], crystalV[vert.v][1], crystalV[vert.v][2]);
                    }
                    if (vert.vt >= 0 && vert.vt < crystalVT.length) {
                        const u = crystalVT[vert.vt][0];
                        const v = 1.0 - crystalVT[vert.vt][1];  // Flip V for WebGL
                        targetUVs.push(u, v);
                    } else {
                        targetUVs.push(0.5, 0.5);
                    }
                    if (vert.vn >= 0 && vert.vn < crystalVN.length) {
                        targetNormals.push(crystalVN[vert.vn][0], crystalVN[vert.vn][1], crystalVN[vert.vn][2]);
                    } else {
                        targetNormals.push(0, 1, 0);
                    }
                    materialVertCounts[currentMaterial]++;
                }
            }
        }
    }
    
    // Create shades for base
    const baseVerts = g_crystalBaseMesh.length / 3;
    for (let i = 0; i < baseVerts; i++) {
        g_crystalBaseShades.push(1.0);
    }
    
    console.log('=== MATERIAL VERTEX COUNTS ===');
    for (const mat in materialVertCounts) {
        console.log(`  ${mat}: ${materialVertCounts[mat]} vertices`);
    }
    console.log('Crystal (glowing) parts loaded:', g_crystalMesh.length / 3, 'vertices');
    console.log('Crystal base (solid) parts loaded:', baseVerts, 'vertices');

    // Build shades for the crystal
    g_crystalShades = [];
    const crystalVerts = g_crystalMesh.length / 3;

    // DEBUG: Print UV coordinate statistics
    console.log('=== CRYSTAL UV DEBUG INFO ===');
    console.log('Total vertices:', crystalVerts);
    console.log('Total UVs loaded:', g_crystalUVs.length / 2);
    console.log('Total normals loaded:', g_crystalNormals.length / 3);
    
    if (g_crystalUVs.length > 0) {
        // Find min/max UV values
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < g_crystalUVs.length; i += 2) {
            minU = Math.min(minU, g_crystalUVs[i]);
            maxU = Math.max(maxU, g_crystalUVs[i]);
            minV = Math.min(minV, g_crystalUVs[i + 1]);
            maxV = Math.max(maxV, g_crystalUVs[i + 1]);
        }
        console.log('UV range - U:', minU.toFixed(4), 'to', maxU.toFixed(4));
        console.log('UV range - V:', minV.toFixed(4), 'to', maxV.toFixed(4));
    }

    // Create shades for all vertices
    for (let i = 0; i < crystalVerts; i++) {
        g_crystalShades.push(1.0);
    }

    console.log('Loaded end crystal with', crystalVerts, 'vertices');

    // Load enderman OBJ file - need to handle quads properly
    // cursor tab and gpt was used for this to speed things up
    let endermanData = await fetch('assets/objects/enderman.obj').then(response => response.text()).then((x) => x);
    
    // Custom loader that properly triangulates quads
    g_endermanMesh = [];
    g_endermanUVs = [];
    g_endermanNormals = [];
    
    const lines = endermanData.split('\n');
    const v = [];
    const vt = [];
    const vn = [];
    
    // First pass: collect all vertices, UVs, and normals
    for (const line of lines) {
        const sline = line.split(/[ ,]+/);
        if (sline[0] === 'v') {
            v.push(sline.slice(1, 4).map(x => Number(x)));
        } else if (sline[0] === 'vt') {
            vt.push(sline.slice(1, 3).map(x => Number(x)));
        } else if (sline[0] === 'vn') {
            vn.push(sline.slice(1, 4).map(x => Number(x)));
        }
    }
    
    // Second pass: process faces and triangulate quads
    for (const line of lines) {
        const sline = line.split(/[ ,]+/);
        if (sline[0] === 'f') {
            const faceVerts = sline.slice(1).filter(x => x !== '');
            
            // Process each vertex index (format: v/vt/vn or v//vn or v)
            const parseVertex = (faceVert) => {
                const parts = faceVert.split('/');
                return {
                    v: parts[0] ? Number(parts[0]) - 1 : -1,
                    vt: parts[1] ? Number(parts[1]) - 1 : -1,
                    vn: parts[2] ? Number(parts[2]) - 1 : -1
                };
            };
            
            const verts = faceVerts.map(parseVertex);
            
            // Triangulate: if quad, split into 2 triangles
            if (verts.length === 4) {
                // Quad: create triangles [0,1,2] and [0,2,3]
                const tri1 = [verts[0], verts[1], verts[2]];
                const tri2 = [verts[0], verts[2], verts[3]];
                
                for (const tri of [tri1, tri2]) {
                    for (const vert of tri) {
                        if (vert.v >= 0 && vert.v < v.length) {
                            g_endermanMesh.push(v[vert.v][0], v[vert.v][1], v[vert.v][2]);
                        }
                        if (vert.vt >= 0 && vert.vt < vt.length) {
                            g_endermanUVs.push(vt[vert.vt][0], 1 - vt[vert.vt][1]); // Flip V coordinate
                        }
                        if (vert.vn >= 0 && vert.vn < vn.length) {
                            g_endermanNormals.push(vn[vert.vn][0], vn[vert.vn][1], vn[vert.vn][2]);
                        }
                    }
                }
            } else if (verts.length === 3) {
                // Already a triangle
                for (const vert of verts) {
                    if (vert.v >= 0 && vert.v < v.length) {
                        g_endermanMesh.push(v[vert.v][0], v[vert.v][1], v[vert.v][2]);
                    }
                    if (vert.vt >= 0 && vert.vt < vt.length) {
                        g_endermanUVs.push(vt[vert.vt][0], 1 - vt[vert.vt][1]); // Flip V coordinate
                    }
                    if (vert.vn >= 0 && vert.vn < vn.length) {
                        g_endermanNormals.push(vn[vert.vn][0], vn[vert.vn][1], vn[vert.vn][2]);
                    }
                }
            }
        }
    }
    
    console.log('Loaded enderman (with quad triangulation):');
    console.log('  Total vertices:', g_endermanMesh.length / 3);
    console.log('  Total UVs:', g_endermanUVs.length / 2);
    console.log('  Total normals:', g_endermanNormals.length / 3);
    console.log('  Mesh sample (first 9 values):', g_endermanMesh.slice(0, 9));
    console.log('  UV sample (first 6 values):', g_endermanUVs.slice(0, 6));
    
    // Load skybox cube mesh
    let skyboxCubeData = await fetch('assets/objects/skybox_cube.obj')
        .then(response => response.text())
        .then(x => x);
    g_skyboxMesh = [];
    readObjFile(skyboxCubeData, g_skyboxMesh);
    console.log('Loaded skybox cube with', g_skyboxMesh.length / 3, 'vertices');
    
    // Center the enderman mesh at origin (so scaling doesn't offset position)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < g_endermanMesh.length; i += 3) {
        minX = Math.min(minX, g_endermanMesh[i]);
        maxX = Math.max(maxX, g_endermanMesh[i]);
        minY = Math.min(minY, g_endermanMesh[i + 1]);
        maxY = Math.max(maxY, g_endermanMesh[i + 1]);
        minZ = Math.min(minZ, g_endermanMesh[i + 2]);
        maxZ = Math.max(maxZ, g_endermanMesh[i + 2]);
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = minY;  // Use bottom of mesh so feet touch ground
    const centerZ = (minZ + maxZ) / 2;
    
    console.log('  Mesh bounds: X[', minX, ',', maxX, '] Y[', minY, ',', maxY, '] Z[', minZ, ',', maxZ, ']');
    console.log('  Centering mesh at:', centerX, centerY, centerZ);
    
    // Offset all vertices to center the mesh
    for (let i = 0; i < g_endermanMesh.length; i += 3) {
        g_endermanMesh[i] -= centerX;
        g_endermanMesh[i + 1] -= centerY;
        g_endermanMesh[i + 2] -= centerZ;
    }
    
    // Ensure UVs match vertex count
    if (g_endermanUVs.length / 2 !== g_endermanMesh.length / 3) {
        console.warn('UV count mismatch! Vertices:', g_endermanMesh.length / 3, 'UVs:', g_endermanUVs.length / 2);
        // Fill missing UVs with defaults
        const missingUVs = (g_endermanMesh.length / 3) - (g_endermanUVs.length / 2);
        for (let i = 0; i < missingUVs; i++) {
            g_endermanUVs.push(0, 0);
        }
        console.log('  Added', missingUVs, 'default UVs');
    }
    
    // Ensure normals match vertex count
    if (g_endermanNormals.length / 3 !== g_endermanMesh.length / 3) {
        console.warn('Normal count mismatch! Vertices:', g_endermanMesh.length / 3, 'Normals:', g_endermanNormals.length / 3);
        // Fill missing normals with default up direction
        const missingNormals = (g_endermanMesh.length / 3) - (g_endermanNormals.length / 3);
        for (let i = 0; i < missingNormals; i++) {
            g_endermanNormals.push(0, 1, 0);
        }
        console.log('  Added', missingNormals, 'default normals');
    }

    // Load torch OBJ file using helper that handles quads
    // cursor tab and gpt was used for this to speed things up
    let torchData = await fetch('assets/objects/torch.obj').then(response => response.text()).then(x => x);
    console.log('Fetched torch.obj, data length:', torchData.length);
    
    g_torchMesh = [];
    g_torchUVs = [];
    g_torchNormals = [];
    g_torchShades = [];
    
    // Use custom loader that triangulates quads (readObjFile only handles triangles)
    readObjFileWithQuads(torchData, g_torchMesh, g_torchNormals, g_torchUVs);
    
    // Center torch at origin with bottom at y=0
    if (g_torchMesh.length > 0) {
        let torchMinY = Infinity;
        let torchMaxY = -Infinity;
        for (let i = 1; i < g_torchMesh.length; i += 3) {
            torchMinY = Math.min(torchMinY, g_torchMesh[i]);
            torchMaxY = Math.max(torchMaxY, g_torchMesh[i]);
        }
        // Shift mesh so bottom is at y=0
        for (let i = 1; i < g_torchMesh.length; i += 3) {
            g_torchMesh[i] -= torchMinY;
        }
        // Verify centering worked
        let newMinY = Infinity;
        let newMaxY = -Infinity;
        for (let i = 1; i < g_torchMesh.length; i += 3) {
            newMinY = Math.min(newMinY, g_torchMesh[i]);
            newMaxY = Math.max(newMaxY, g_torchMesh[i]);
        }
        console.log(`  Torch Y bounds: min=${newMinY.toFixed(3)}, max=${newMaxY.toFixed(3)} (height=${(newMaxY - newMinY).toFixed(3)})`);
    }
    
    // Create shades for torch
    const torchVerts = g_torchMesh.length / 3;
    for (let i = 0; i < torchVerts; i++) {
        g_torchShades.push(1.0);
    }
    
    console.log('=== TORCH LOADING ===');
    console.log('Loaded torch with', torchVerts, 'vertices');
    console.log('  Mesh array length:', g_torchMesh.length);
    console.log('  UVs array length:', g_torchUVs.length);
    console.log('  Normals array length:', g_torchNormals.length);
    if (g_torchMesh.length > 0) {
        console.log('  First 3 vertices:', 
            [g_torchMesh[0], g_torchMesh[1], g_torchMesh[2]],
            [g_torchMesh[3], g_torchMesh[4], g_torchMesh[5]],
            [g_torchMesh[6], g_torchMesh[7], g_torchMesh[8]]);
    }

    loadGLSLFiles();
}

// taken from various demos
function buildIcosahderonColorAttributes(vertexCount) {
    let colors = [];
    for (let i = 0; i < vertexCount / 3; i++) {
        // three vertices per triangle
        for (let vert = 0; vert < 3; vert++) {
            let shade = (i * 3) / vertexCount;
            colors.push(shade, shade, 1.0);
        }
    }
    return colors;
}

function buildProceduralTower() {
    g_towerMesh = [];
    g_towerUVs = [];
    g_towerNormals = [];

    const TOWER_WIDTH = 3;    // 3x3 base
    const BLOCK_SIZE = 1;     // Each block is 1 unit

    // use terrain generator to generate the cubes
    let cubeGenerator = new TerrainGenerator();

    for (let y = 0; y < g_towerHeight; y++) {
        for (let x = 0; x < TOWER_WIDTH; x++) {
            for (let z = 0; z < TOWER_WIDTH; z++) {
                let cubeData = cubeGenerator.generateCubeVertices(
                    x * BLOCK_SIZE - (TOWER_WIDTH * BLOCK_SIZE / 2),  
                    y * BLOCK_SIZE,
                    z * BLOCK_SIZE - (TOWER_WIDTH * BLOCK_SIZE / 2),
                    {
                        front: true,
                        back: true,
                        top: true,
                        bottom: true,
                        right: true,
                        left: true
                    }
                );

                for (let v of cubeData.vertices) {
                    g_towerMesh.push(...v);
                }

                for (let uv of cubeData.uvs) {
                    g_towerUVs.push(...uv);
                }
                
                for (let n of cubeData.normals) {
                    g_towerNormals.push(...n);
                }
            }
        }
    }
}

// end portal - circular/ring shape with 3-block edges and corner connectors
function buildEndPortal() {
    g_portalMesh = [];
    g_portalUVs = [];
    g_portalNormals = [];
    g_portalModelMatrix = new Matrix4();

    const BASE_Y = 0;
    const WALL_HEIGHT = 1;
    const PILLAR_HEIGHT = 4;

    // same thing use the cube gen
    let gen = new TerrainGenerator();

    function addCube(x, y, z) {
        const cubeData = gen.generateCubeVertices(
            x, y, z,
            {
                front: true,
                back: true,
                top: true,
                bottom: true,
                right: true,
                left: true
            }
        );

        for (let v of cubeData.vertices) {
            g_portalMesh.push(...v);
        }
        for (let uv of cubeData.uvs) {
            g_portalUVs.push(...uv);
        }
        for (let n of cubeData.normals) {
            g_portalNormals.push(...n);
        }
    }

    // Create a set to track which positions should have blocks
    const portalBlocks = new Set();
    
    portalBlocks.add('-1,3');
    portalBlocks.add('0,3');
    portalBlocks.add('1,3');
    
    // Bottom edge: 3 blocks centered (x = -1, 0, 1 at z = -2)
    portalBlocks.add('-1,-3');
    portalBlocks.add('0,-3');
    portalBlocks.add('1,-3');
    
    // Left edge: 3 blocks centered (z = -1, 0, 1 at x = -2)
    portalBlocks.add('-3,-1');
    portalBlocks.add('-3,0');
    portalBlocks.add('-3,1');
    
    // Right edge: 3 blocks centered (z = -1, 0, 1 at x = 2)
    portalBlocks.add('3,-1');
    portalBlocks.add('3,0');
    portalBlocks.add('3,1');
    
    // Corner blocks connecting the sides (4 corners)
    portalBlocks.add('-2,-2');  // bottom-left corner
    portalBlocks.add('-2,2');    // top-left corner
    portalBlocks.add('2,-2');    // bottom-right corner
    portalBlocks.add('2,2');    // top-right corner

    // Build the portal structure
    // First, add base layer for all portal blocks
    for (const blockKey of portalBlocks) {
        const [x, z] = blockKey.split(',').map(Number);
        addCube(x, BASE_Y, z);
        
        // Add raised walls for all portal blocks
        for (let y = BASE_Y + 1; y <= BASE_Y + WALL_HEIGHT; y++) {
            addCube(x, y, z);
        }
    }

    // Fill the interior hollow area (3x3 center) with bedrock base blocks
    // The interior is from -1 to +1 in both X and Z, excluding the center pillar
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            // Skip the center pillar position
            if (x === 0 && z === 0) continue;
            // Add bedrock base block for interior
            addCube(x, BASE_Y, z);
        }
    }

    // Fill the edge pieces of the portal
    for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
            if (x === 0 && z === 0) continue;
            addCube(x, BASE_Y, z);
        }
    }

    // Add central pillar at (0,0) going up above the bowl
    addCube(0, BASE_Y, 0);
    for (let y = BASE_Y + 1; y <= BASE_Y + PILLAR_HEIGHT; y++) {
        addCube(0, y, 0);
    }
}

// cursor tab and gpt was used for this to speed things up
function buildPortalFill() {
    g_portalFillMesh = [];
    g_portalFillUVs = [];
    g_portalFillNormals = [];
    g_portalFillShades = [];

    const BASE_Y = 1;  // One block above the portal base (on top of bedrock base)

    let gen = new TerrainGenerator();

    function addCube(x, y, z) {
        const cubeData = gen.generateCubeVertices(
            x, y, z,
            {
                front: true,
                back: true,
                top: true,
                bottom: true,
                right: true,
                left: true
            }
        );

        for (let v of cubeData.vertices) {
            g_portalFillMesh.push(...v);
        }
        for (let uv of cubeData.uvs) {
            g_portalFillUVs.push(...uv);
        }
        for (let n of cubeData.normals) {
            g_portalFillNormals.push(...n);
        }
    }

    // Fill the interior hollow area (3x3 center) with portal texture blocks
    // The interior is from -1 to +1 in both X and Z, excluding the center pillar
    // This matches the bedrock base fill but at BASE_Y + 1 (one block above)
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            // Skip the center pillar position
            if (x === 0 && z === 0) continue;
            
            addCube(x, BASE_Y, z);
        }
    }

    // Fill the edge pieces of the portal
    for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
            if (x === 0 && z === 0) continue;
            addCube(x, BASE_Y, z);
        }
    }
    
    // Create shades for the fill blocks
    const fillVerts = g_portalFillMesh.length / 3;
    for (let i = 0; i < fillVerts; i++) {
        g_portalFillShades.push(1.0);
    }
    
    console.log('Built portal fill with', fillVerts, 'vertices');
}

// claude func
function buildMoonSphere(radius = 1.0, latSegments = 16, lonSegments = 16) {
    g_moonMesh = [];
    g_moonUVs = [];
    g_moonNormals = [];
    
    // Generate sphere vertices using spherical coordinates
    for (let lat = 0; lat < latSegments; lat++) {
        const theta1 = (lat / latSegments) * Math.PI;
        const theta2 = ((lat + 1) / latSegments) * Math.PI;
        
        for (let lon = 0; lon < lonSegments; lon++) {
            const phi1 = (lon / lonSegments) * 2 * Math.PI;
            const phi2 = ((lon + 1) / lonSegments) * 2 * Math.PI;
            
            // Four corners of the quad
            const p1 = spherePoint(radius, theta1, phi1);
            const p2 = spherePoint(radius, theta2, phi1);
            const p3 = spherePoint(radius, theta2, phi2);
            const p4 = spherePoint(radius, theta1, phi2);
            
            // UV coordinates
            const u1 = lon / lonSegments;
            const u2 = (lon + 1) / lonSegments;
            const v1 = lat / latSegments;
            const v2 = (lat + 1) / latSegments;
            
            // Triangle 1: p1, p2, p3
            g_moonMesh.push(p1.x, p1.y, p1.z);
            g_moonMesh.push(p2.x, p2.y, p2.z);
            g_moonMesh.push(p3.x, p3.y, p3.z);
            
            g_moonUVs.push(u1, v1);
            g_moonUVs.push(u1, v2);
            g_moonUVs.push(u2, v2);
            
            // Normals (normalized position for sphere centered at origin)
            g_moonNormals.push(p1.x/radius, p1.y/radius, p1.z/radius);
            g_moonNormals.push(p2.x/radius, p2.y/radius, p2.z/radius);
            g_moonNormals.push(p3.x/radius, p3.y/radius, p3.z/radius);
            
            // Triangle 2: p1, p3, p4
            g_moonMesh.push(p1.x, p1.y, p1.z);
            g_moonMesh.push(p3.x, p3.y, p3.z);
            g_moonMesh.push(p4.x, p4.y, p4.z);
            
            g_moonUVs.push(u1, v1);
            g_moonUVs.push(u2, v2);
            g_moonUVs.push(u2, v1);
            
            g_moonNormals.push(p1.x/radius, p1.y/radius, p1.z/radius);
            g_moonNormals.push(p3.x/radius, p3.y/radius, p3.z/radius);
            g_moonNormals.push(p4.x/radius, p4.y/radius, p4.z/radius);
        }
    }
    
    console.log('Built moon sphere with', g_moonMesh.length / 3, 'vertices');
}

// Helper function to compute a point on a sphere
function spherePoint(radius, theta, phi) {
    return {
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.cos(theta),
        z: radius * Math.sin(theta) * Math.sin(phi)
    };
}

// gave claude the obj file and it generated the code to parse it
function readObjFileWithQuads(objstring, positions, normals = [], texcoords = []) {
    const lines = objstring.split('\n');
    const v = [];   // vertices
    const vt = [];  // texture coords
    const vn = [];  // normals
    
    // First pass: collect all vertex data
    for (const line of lines) {
        const sline = line.trim().split(/\s+/);
        if (sline[0] === 'v' && sline.length >= 4) {
            v.push([parseFloat(sline[1]), parseFloat(sline[2]), parseFloat(sline[3])]);
        } else if (sline[0] === 'vt' && sline.length >= 3) {
            vt.push([parseFloat(sline[1]), parseFloat(sline[2])]);
        } else if (sline[0] === 'vn' && sline.length >= 4) {
            vn.push([parseFloat(sline[1]), parseFloat(sline[2]), parseFloat(sline[3])]);
        }
    }
    
    console.log('  OBJ has', v.length, 'vertices,', vt.length, 'texcoords,', vn.length, 'normals');
    
    // Helper to parse face vertex (format: v/vt/vn or v//vn or v/vt or v)
    const parseFaceVertex = (faceStr) => {
        const parts = faceStr.split('/');
        return {
            v: parts[0] ? parseInt(parts[0]) - 1 : -1,
            vt: parts[1] ? parseInt(parts[1]) - 1 : -1,
            vn: parts[2] ? parseInt(parts[2]) - 1 : -1
        };
    };
    
    // Helper to add a vertex to output arrays
    const addVertex = (fv) => {
        if (fv.v >= 0 && fv.v < v.length) {
            positions.push(v[fv.v][0], v[fv.v][1], v[fv.v][2]);
        }
        if (fv.vt >= 0 && fv.vt < vt.length) {
            texcoords.push(vt[fv.vt][0], 1.0 - vt[fv.vt][1]); // Flip V for WebGL
        } else if (texcoords.length < positions.length / 3 * 2) {
            texcoords.push(0, 0); // Default UV
        }
        if (fv.vn >= 0 && fv.vn < vn.length) {
            normals.push(vn[fv.vn][0], vn[fv.vn][1], vn[fv.vn][2]);
        } else if (normals.length < positions.length) {
            normals.push(0, 1, 0); // Default up normal
        }
    };
    
    // Second pass: process faces
    let faceCount = 0;
    for (const line of lines) {
        const sline = line.trim().split(/\s+/);
        if (sline[0] === 'f') {
            const faceVerts = sline.slice(1).filter(x => x !== '');
            
            if (faceVerts.length >= 3) {
                const verts = faceVerts.map(parseFaceVertex);
                
                if (verts.length === 3) {
                    // Triangle - add directly
                    addVertex(verts[0]);
                    addVertex(verts[1]);
                    addVertex(verts[2]);
                    faceCount++;
                } else if (verts.length === 4) {
                    // Quad - triangulate into 2 triangles
                    // Triangle 1: 0, 1, 2
                    addVertex(verts[0]);
                    addVertex(verts[1]);
                    addVertex(verts[2]);
                    // Triangle 2: 0, 2, 3
                    addVertex(verts[0]);
                    addVertex(verts[2]);
                    addVertex(verts[3]);
                    faceCount += 2;
                }
            }
        }
    }
    
    console.log('  Processed', faceCount, 'triangles, output:', positions.length / 3, 'vertices');
}

/*
 * Helper function to load our GLSL files for compiling in sequence
 */
async function loadGLSLFiles() {
    // Build moon sphere before loading shaders
    buildMoonSphere(5.0, 16, 16);  // 5 unit radius moon
    
    g_vshader = await fetch('./flat_color.vert').then(response => response.text()).then((x) => x);
    g_fshader = await fetch('./flat_color.frag').then(response => response.text()).then((x) => x);

    // wait until everything is loaded before rendering
    startRendering();
}

