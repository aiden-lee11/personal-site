// enderman.js - Enderman entity
// Enderman-specific state and behavior
// Since this model is quite repetitive, I had claude pretty much generate all the code for this file 

// Enderman mesh data
let g_endermanMesh = [];
let g_endermanUVs = [];
let g_endermanNormals = [];

// Enderman state variables - array of enderman objects
let g_endermen = [];  // Array of enderman objects, each with independent state
const g_endermanHeightOffset = 0.0;  // Height offset to position feet on terrain
let NUM_ENDERMEN = 150;  // Number of endermen to spawn (can be changed via slider)

// Collision detection constants
const TOWER_SIZE = 3.0;  // Towers are 3x3 blocks, add some margin
const TOWER_RADIUS = TOWER_SIZE / 2 + 0.5;  // Half size + margin
// Portal is now a circular ring: 5x5 outer boundary with 3x3 hollow center
// The ring spans from -2 to +2 in both X and Z, so collision radius is 2.5 + margin
const PORTAL_RADIUS = 2.5 + 0.5;  // Half of 5 + margin

// Array of blocked positions with their center coordinates and collision radius
// Each entry: { x, z, radius }
let g_blockedPositions = [];

// cursor tab and gpt was used for this to speed things up
function initBlockedPositions() {
    g_blockedPositions = [];
    
    // Add portal at origin with its collision radius
    g_blockedPositions.push({ x: 0, z: 0, radius: PORTAL_RADIUS });
    
    // Add each tower position from g_crystalPositions
    if (typeof g_crystalPositions !== 'undefined' && g_crystalPositions.length > 0) {
        for (const tower of g_crystalPositions) {
            g_blockedPositions.push({ x: tower.x, z: tower.z, radius: TOWER_RADIUS });
        }
    }
    
    console.log(`Initialized ${g_blockedPositions.length} blocked positions (1 portal + ${g_blockedPositions.length - 1} towers)`);
}

function isPositionBlocked(x, z) {
    // Iterate through all blocked positions and check distance-based collision
    for (const blocked of g_blockedPositions) {
        const dx = x - blocked.x;
        const dz = z - blocked.z;
        const distSq = dx * dx + dz * dz;
        const radiusSq = blocked.radius * blocked.radius;
        
        if (distSq < radiusSq) {
            return true;
        }
    }
    
    return false;
}

function updateEndermanHeight(enderman) {
    const sample = getTerrainSample(enderman.position.x, enderman.position.z);
    return sample.height + g_endermanHeightOffset;
}

// cursor tab and gpt was used for this to speed things up
function updateEndermen(deltaMS) {
    for (let i = 0; i < g_endermen.length; i++) {
        const enderman = g_endermen[i];
        
        // Update teleport timer
        enderman.teleportTimer += deltaMS;

        // Check if it's time to teleport
        if (enderman.teleportTimer >= enderman.teleportInterval) {
            // Generate random position within terrain bounds that doesn't collide with towers/portal
            if (g_terrainOptions) {
                const opts = g_terrainOptions;
                // Terrain is 100x100, centered at origin
                // g_terrainOffset.x = -50, so world X goes from -50 to +49
                // g_terrainOffset.z = -50, so world Z goes from -50 to +49
                const margin = 4.0;  // Keep margin from edges
                const minX = g_terrainOffset.x + margin;           // -50 + 4 = -46
                const maxX = g_terrainOffset.x + opts.width - margin;  // -50 + 100 - 4 = 46
                const minZ = g_terrainOffset.z + margin;           // -50 + 4 = -46
                const maxZ = g_terrainOffset.z + opts.depth - margin;  // -50 + 100 - 4 = 46

                // Try to find a valid position (max 50 attempts to avoid infinite loop)
                let attempts = 0;
                let validPosition = false;
                while (!validPosition && attempts < 50) {
                    const testX = minX + Math.random() * (maxX - minX);
                    const testZ = minZ + Math.random() * (maxZ - minZ);
                    
                    if (!isPositionBlocked(testX, testZ)) {
                        enderman.position.x = testX;
                        enderman.position.z = testZ;
                        validPosition = true;
                    }
                    attempts++;
                }
                
                // If we couldn't find a valid position after 50 attempts, just use the last attempt
                // (should be very rare)
                if (!validPosition) {
                    enderman.position.x = minX + Math.random() * (maxX - minX);
                    enderman.position.z = minZ + Math.random() * (maxZ - minZ);
                }
            }

            // Change rotation to a new random direction when teleporting
            enderman.rotation = Math.random() * 360;

            // Reset timer and generate new random interval (3-8 seconds)
            enderman.teleportTimer = 0;
            enderman.teleportInterval = 3000 + Math.random() * 5000;
        }
    }
}

// cursor tab and gpt was used for this to speed things up
function initEndermen() {
    g_endermen = [];
    
    if (!g_terrainOptions) {
        console.warn('Terrain options not available, cannot initialize endermen');
        return;
    }
    
    const opts = g_terrainOptions;
    const margin = 4.0;
    const minX = g_terrainOffset.x + margin;
    const maxX = g_terrainOffset.x + opts.width - margin;
    const minZ = g_terrainOffset.z + margin;
    const maxZ = g_terrainOffset.z + opts.depth - margin;
    
    for (let i = 0; i < NUM_ENDERMEN; i++) {
        // Generate random starting position that doesn't collide with towers/portal
        let attempts = 0;
        let validPosition = false;
        let startX, startZ;
        
        while (!validPosition && attempts < 50) {
            startX = minX + Math.random() * (maxX - minX);
            startZ = minZ + Math.random() * (maxZ - minZ);
            
            if (!isPositionBlocked(startX, startZ)) {
                validPosition = true;
            }
            attempts++;
        }
        
        // If we couldn't find a valid position after 50 attempts, just use the last attempt
        // (should be very rare)
        if (!validPosition) {
            startX = minX + Math.random() * (maxX - minX);
            startZ = minZ + Math.random() * (maxZ - minZ);
        }
        
        // Create enderman object with independent state
        const enderman = {
            position: { x: startX, z: startZ },
            teleportTimer: 0,
            // Each enderman gets a random initial teleport interval (0-8 seconds)
            // This ensures they don't all teleport at the same time
            teleportInterval: Math.random() * 8000,
            // Random rotation around Y-axis (0-360 degrees) so they face different directions
            rotation: Math.random() * 360
        };
        
        g_endermen.push(enderman);
    }
    
    console.log(`Initialized ${g_endermen.length} endermen`);
}

