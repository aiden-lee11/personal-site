// torch.js - Torch placement and rendering
// Handles torch placement, point lights, and rendering

// Torch light configuration
const TORCH_LIGHT_CONFIG = {
    color: [1.0, 0.6, 0.2],    // Warm orange flame
    intensity: 1.2,
    attenuation: {
        constant: 1.0,
        linear: 0.14,
        quadratic: 0.07
    }
};

// Array of placed torches
// Each torch: { id: string, position: {x, y, z}, lightId: string }
let g_torches = [];

// Counter for generating unique torch IDs
let g_torchIdCounter = 0;

// VBO offsets for torch mesh (set by main.js)
let g_torchFirst = 0;
let g_torchCount = 0;

// Test torch - disable now that we confirmed rendering works
let g_testTorchEnabled = false;

// Torch mesh height in model space (flame is at top)
const TORCH_MODEL_HEIGHT = 1.2;

// cursor tab and gpt was used for this to speed things up
function getFlamePositionFromMatrix(torchModelMatrix) {
    // Flame is at the top of the torch in model space: (0, TORCH_MODEL_HEIGHT, 0)
    const flamePosModelSpace = [0, TORCH_MODEL_HEIGHT, 0];
    
    // Transform using the model matrix
    const m = torchModelMatrix.elements;
    return [
        m[0] * flamePosModelSpace[0] + m[4] * flamePosModelSpace[1] + m[8] * flamePosModelSpace[2] + m[12],
        m[1] * flamePosModelSpace[0] + m[5] * flamePosModelSpace[1] + m[9] * flamePosModelSpace[2] + m[13],
        m[2] * flamePosModelSpace[0] + m[6] * flamePosModelSpace[1] + m[10] * flamePosModelSpace[2] + m[14]
    ];
}

// cursor tab and gpt was used for this to speed things up
function placeTorch(x, z) {
    // Get terrain height at this position (this is the top of the terrain block)
    const terrainSample = getTerrainSample(x, z);
    // Place torch so its bottom (y=0 in model space) sits exactly on top of terrain
    // The terrain height is already the top of the block, so we use it directly
    const y = terrainSample.height;
    
    console.log(`Placing torch at terrain height: ${y.toFixed(3)} (terrain top at ${terrainSample.height.toFixed(3)})`);
    
    // Create unique IDs
    const torchId = `torch_${g_torchIdCounter}`;
    const lightId = `torch_light_${g_torchIdCounter}`;
    g_torchIdCounter++;
    
    // Create torch object
    const torch = {
        id: torchId,
        position: { x: x, y: y, z: z },
        lightId: lightId
    };
    
    // Add to torches array
    g_torches.push(torch);
    
    // Calculate light position using the same transformation as the torch model
    // Create the same model matrix used for rendering
    // IMPORTANT: Scale FIRST, then translate (so scale doesn't affect translation)
    const torchModelMatrix = new Matrix4()
        .scale(0.5, 0.5, 0.5)
        .translate(x, y, z);
    
    // Get flame position using the helper function (ensures exact match with rendering)
    const flamePos = getFlamePositionFromMatrix(torchModelMatrix);
    
    // Add point light at the transformed flame position
    if (g_pointLightManager) {
        g_pointLightManager.addLight({
            id: lightId,
            position: flamePos,
            color: TORCH_LIGHT_CONFIG.color,
            intensity: TORCH_LIGHT_CONFIG.intensity,
            attenuation: TORCH_LIGHT_CONFIG.attenuation
        });
        console.log(`Added torch light '${lightId}' at (${flamePos[0].toFixed(2)}, ${flamePos[1].toFixed(2)}, ${flamePos[2].toFixed(2)})`);
    } else {
        console.warn('g_pointLightManager not available - torch light not added');
    }
    
    console.log(`Placed torch '${torchId}' at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    
    return torch;
}

function removeTorch(torchId) {
    const index = g_torches.findIndex(t => t.id === torchId);
    if (index === -1) {
        console.warn(`removeTorch: Torch '${torchId}' not found`);
        return false;
    }
    
    const torch = g_torches[index];
    
    // Remove the associated point light
    if (g_pointLightManager) {
        g_pointLightManager.removeLight(torch.lightId);
    }
    
    // Remove from array
    g_torches.splice(index, 1);
    
    console.log(`Removed torch '${torchId}'`);
    return true;
}

function promptPlaceTorch() {
    // Prompt for X coordinate
    const xInput = prompt('Enter X coordinate for torch placement:', '0');
    if (xInput === null) return;  // User cancelled
    
    const x = parseFloat(xInput);
    if (isNaN(x)) {
        alert('Invalid X coordinate. Please enter a number.');
        return;
    }
    
    // Prompt for Z coordinate
    const zInput = prompt('Enter Z coordinate for torch placement:', '0');
    if (zInput === null) return;  // User cancelled
    
    const z = parseFloat(zInput);
    if (isNaN(z)) {
        alert('Invalid Z coordinate. Please enter a number.');
        return;
    }
    
    // Place the torch
    const torch = placeTorch(x, z);
    
    if (torch) {
        alert(`Torch placed at (${x}, ${torch.position.y.toFixed(2)}, ${z})`);
    }
}

// cursor tab used a lot for this function since it was a lot of repetition
function renderTorches(gl, uModelRef, uInverseTransposeRef) {
    // Check if we have torch mesh data
    if (g_torchCount === 0) {
        // Only warn once
        if (!renderTorches._warnedNoMesh) {
            console.warn('renderTorches: g_torchCount is 0, torch mesh may not be loaded');
            renderTorches._warnedNoMesh = true;
        }
        return;
    }
    
    // Bind torch texture
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, window.g_torchTexturePointer);
    gl.uniform1i(g_uTexture_ref, 8);
    
    const identity = new Matrix4();
    
    // Set world matrix to identity
    gl.uniformMatrix4fv(g_uWorld_ref, false, identity.elements);
    
    // Disable culling for torches (may have winding order issues)
    gl.disable(gl.CULL_FACE);
    
    // Debug log once
    if (!renderTorches._logged) {
        console.log('=== TORCH RENDER ===');
        console.log('VBO offset:', g_torchFirst, 'count:', g_torchCount);
        console.log('Test torch enabled:', g_testTorchEnabled);
        console.log('Placed torches:', g_torches.length);
        renderTorches._logged = true;
    }
    
    // ALWAYS render a test torch in the center of the world (floating in the air)
    if (g_testTorchEnabled) {
        const testTorchModel = new Matrix4()
            .setTranslate(0, 10, 0)  // Center of world, 10 units up in the air
            .scale(3.0, 3.0, 3.0);   // Make it big so we can see it
        
        gl.uniformMatrix4fv(uModelRef, false, testTorchModel.elements);
        
        if (uInverseTransposeRef) {
            let inverseTranspose = new Matrix4().setInverseOf(testTorchModel).transpose();
            gl.uniformMatrix4fv(uInverseTransposeRef, false, inverseTranspose.elements);
        }
        
        gl.drawArrays(gl.TRIANGLES, g_torchFirst, g_torchCount);
    }
    
    // Render placed torches
    for (const torch of g_torches) {
        // Create model matrix: scale FIRST, then translate (same as in placeTorch)
        // This ensures scale doesn't affect translation, and model/light positions match exactly
        const torchModel = new Matrix4()
            .scale(0.5, 0.5, 0.5)
            .translate(torch.position.x, torch.position.y, torch.position.z);
        
        // Update light position to match current model matrix (in case torch moved)
        if (g_pointLightManager) {
            const flamePos = getFlamePositionFromMatrix(torchModel);
            g_pointLightManager.updateLight(torch.lightId, {
                position: flamePos
            });
        }
        
        gl.uniformMatrix4fv(uModelRef, false, torchModel.elements);
        
        if (uInverseTransposeRef) {
            let inverseTranspose = new Matrix4().setInverseOf(torchModel).transpose();
            gl.uniformMatrix4fv(uInverseTransposeRef, false, inverseTranspose.elements);
        }
        
        gl.drawArrays(gl.TRIANGLES, g_torchFirst, g_torchCount);
    }
    
    // Re-enable culling
    gl.enable(gl.CULL_FACE);
}

function getTorchCount() {
    return g_torches.length;
}

function clearAllTorches() {
    // Remove all torch lights
    for (const torch of g_torches) {
        if (g_pointLightManager) {
            g_pointLightManager.removeLight(torch.lightId);
        }
    }
    
    g_torches = [];
    console.log('Cleared all torches');
}

