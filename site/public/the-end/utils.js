// utils.js - General utility functions
// Vector math, lerp helpers, terrain sampling, and WebGL utilities

// The size in bytes of a floating point
const FLOAT_SIZE = 4;

/* --------- Vector helpers ---------- */
// GPT Helpers

function normalize3(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len > 1e-6) {
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
    // Default forward if something goes weird
    return { x: 0, y: 0, z: -1 };
}

function dot3(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a, b) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

// Rotate vector v around axis (unit-ish) by angle (radians)
function rotateAroundAxis(v, axis, angle) {
    const u = normalize3(axis);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dot = dot3(v, u);
    const cross = cross3(u, v);

    return normalize3({
        x: v.x * cosA + cross.x * sinA + u.x * dot * (1 - cosA),
        y: v.y * cosA + cross.y * sinA + u.y * dot * (1 - cosA),
        z: v.z * cosA + cross.z * sinA + u.z * dot * (1 - cosA)
    });
}

/* --------- Math helpers ---------- */

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpAngleDeg(a, b, t) {
    a = (a % 360 + 360) % 360;
    b = (b % 360 + 360) % 360;

    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return a + diff * t;
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

/* --------- Terrain sampling ---------- */
// made by myself and cursor tab

// cursor tab and gpt was used for this to speed things up
function calculateTerrainHeightAt(localX, localZ, noise, options, applySmoothing = true) {
    // Select noise function based on options
    let noisefn;
    if (options.noisefn === "wave") {
        noisefn = (x, z) => noise.wave2(x, z);
    }
    else if (options.noisefn === "simplex") {
        noisefn = (x, z) => noise.simplex2(x, z);
    }
    else if (options.noisefn === "perlin") {
        noisefn = (x, z) => noise.perlin2(x, z);
    }
    else {
        noisefn = (x, z) => noise.perlin2(x, z); // Default fallback
    }

    // Multi-octave noise: large-scale features + small detail
    const baseRoughness = options.roughness * 0.3; // Lower base frequency for plateaus
    const detailRoughness = options.roughness * 2.0; // Higher frequency for subtle detail
    
    // Calculate raw height at this point
    const calculateRawHeight = (x, z) => {
        let baseNoise = noisefn(
            x / options.width * baseRoughness,
            z / options.depth * baseRoughness);
        let detailNoise = noisefn(
            x / options.width * detailRoughness,
            z / options.depth * detailRoughness) * 0.15;
        let raw = baseNoise + detailNoise;
        let normalized = 0.5 * (raw + 1.0);
        return normalized * options.height;
    };
    
    let floatHeight = calculateRawHeight(localX, localZ);
    
    // Apply smoothing if requested
    if (applySmoothing) {
        const smoothingRadius = 1;
        let sum = floatHeight;
        let count = 1;
        
        for (let dx = -smoothingRadius; dx <= smoothingRadius; dx++) {
            for (let dz = -smoothingRadius; dz <= smoothingRadius; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip center point (already added)
                
                const nx = localX + dx;
                const nz = localZ + dz;
                let neighborHeight = calculateRawHeight(nx, nz);
                
                sum += neighborHeight;
                count++;
            }
        }
        
        floatHeight = sum / count;
    }
    
    return floatHeight;
}

function getTerrainSample(worldX, worldZ) {
    if (!g_terrainOptions || !g_terrainNoise) {
        return {
            height: 0,
            normal: { x: 0, y: 1, z: 0 }
        };
    }

    const opts = g_terrainOptions;

    // convert world space back into terrain-local coordinates
    const localX = worldX - g_terrainOffset.x;
    const localZ = worldZ - g_terrainOffset.z;

    // Use shared function to calculate smoothed terrain height
    let floatHeight = calculateTerrainHeightAt(localX, localZ, g_terrainNoise, opts, true);
    const blockHeight = Math.floor(floatHeight + 0.5);

    // top of highest cube is at local y = blockHeight + 1.
    const worldHeightTop = g_terrainOffset.y + blockHeight + 1;

    return {
        height: worldHeightTop,
        normal: { x: 0, y: 1, z: 0 }
    };
}

/* --------- WebGL utilities ---------- */

function initVBO(data) {
    // get the VBO handle
    let VBOloc = gl.createBuffer();
    if (!VBOloc) {
        console.error('Failed to create the vertex buffer object');
        return false;
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return true;
}

function setupVec(length, name, stride, offset) {
    // Get the attribute by name
    let attributeID = gl.getAttribLocation(gl.program, `${name}`);
    if (attributeID < 0) {
        console.error(`Failed to get the storage location of ${name}`);
        return false;
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, length, gl.FLOAT, false, stride, offset);
    gl.enableVertexAttribArray(attributeID);

    return true;
}

/* --------- Point Light Manager ---------- */

// Maximum number of point lights supported (WebGL 1.0 compatible)
const MAX_POINT_LIGHTS = 16;

// cursor tab and gpt was used for this to speed things up
class PointLightManager {
    constructor() {
        // Map of light id -> light object
        this.lights = new Map();
        
        // Cached uniform locations (set during init)
        this.uniformLocations = {
            positions: [],      // u_PointLightPositions[i]
            colors: [],         // u_PointLightColors[i]
            count: null,        // u_PointLightCount
            attenuation: null   // u_PointLightAttenuation (shared: constant, linear, quadratic)
        };
        
        // Default attenuation values (can be overridden per-light or globally)
        this.defaultAttenuation = {
            constant: 1.0,
            linear: 0.09,
            quadratic: 0.032
        };
    }
    
    initUniforms(gl) {
        // Get uniform locations for each light slot
        for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
            this.uniformLocations.positions[i] = gl.getUniformLocation(
                gl.program, `u_PointLightPositions[${i}]`
            );
            this.uniformLocations.colors[i] = gl.getUniformLocation(
                gl.program, `u_PointLightColors[${i}]`
            );
        }
        
        this.uniformLocations.count = gl.getUniformLocation(gl.program, 'u_PointLightCount');
        this.uniformLocations.attenuation = gl.getUniformLocation(gl.program, 'u_PointLightAttenuation');
        
        console.log('PointLightManager: Initialized uniform locations');
    }
    
    addLight(config) {
        if (this.lights.size >= MAX_POINT_LIGHTS) {
            console.warn(`PointLightManager: Cannot add light '${config.id}', max lights (${MAX_POINT_LIGHTS}) reached`);
            return false;
        }
        
        if (this.lights.has(config.id)) {
            console.warn(`PointLightManager: Light '${config.id}' already exists, updating instead`);
            return this.updateLight(config.id, config);
        }
        
        const light = {
            id: config.id,
            position: config.position || [0, 0, 0],
            color: config.color || [1, 1, 1],
            intensity: config.intensity !== undefined ? config.intensity : 1.0,
            attenuation: config.attenuation || { ...this.defaultAttenuation },
            enabled: true
        };
        
        this.lights.set(config.id, light);
        return true;
    }
    
    removeLight(id) {
        return this.lights.delete(id);
    }
    
    updateLight(id, updates) {
        const light = this.lights.get(id);
        if (!light) {
            console.warn(`PointLightManager: Light '${id}' not found`);
            return false;
        }
        
        if (updates.position) light.position = updates.position;
        if (updates.color) light.color = updates.color;
        if (updates.intensity !== undefined) light.intensity = updates.intensity;
        if (updates.attenuation) light.attenuation = { ...light.attenuation, ...updates.attenuation };
        if (updates.enabled !== undefined) light.enabled = updates.enabled;
        
        return true;
    }
    
    getLight(id) {
        return this.lights.get(id) || null;
    }
    
    getActiveLights() {
        return Array.from(this.lights.values()).filter(l => l.enabled);
    }
    
    uploadToGPU(gl) {
        const activeLights = this.getActiveLights();
        const count = Math.min(activeLights.length, MAX_POINT_LIGHTS);
        
        // Upload light count
        gl.uniform1i(this.uniformLocations.count, count);
        
        // Upload each light's position and color (with intensity applied)
        for (let i = 0; i < count; i++) {
            const light = activeLights[i];
            
            // Upload position
            gl.uniform3fv(this.uniformLocations.positions[i], light.position);
            
            // Upload color with intensity applied
            const colorWithIntensity = [
                light.color[0] * light.intensity,
                light.color[1] * light.intensity,
                light.color[2] * light.intensity
            ];
            gl.uniform3fv(this.uniformLocations.colors[i], colorWithIntensity);
        }
        
        // Upload shared attenuation (use first light's attenuation or default)
        const atten = count > 0 ? activeLights[0].attenuation : this.defaultAttenuation;
        gl.uniform3fv(this.uniformLocations.attenuation, [
            atten.constant,
            atten.linear,
            atten.quadratic
        ]);
    }
    
    clear() {
        this.lights.clear();
    }
    
    get count() {
        return this.lights.size;
    }
}

// Global point light manager instance
let g_pointLightManager = null;

