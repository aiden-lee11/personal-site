// Dragon implementation for Project 2
// Adapted a lot of my project 1 dragon with some more functionality
// Again cursor tab and gpt was used a lot

// Dragon animation constants
const FLAP_SPEED = 0.006;  // radians/ms
const FLAP_AMPL = 30;      // degrees
const ROTATION_SPEED = 0.025;

// Model preset for dragon positioning
const DRAGON_PRESET = {
    translate: [30.0, 16.0, 0.0],
    scale: 1,
    rotateY: 0
};

// Dragon fly-in animation
let g_dragonFlyInActive = false;
let g_dragonFlyInTime = 0;
const DRAGON_FLY_IN_DURATION = 3000; // ms
let g_dragonFlyStartPos = null;
const DRAGON_TARGET_POS = new Vector3([0, 3, 0]);
let g_dragonFlyInJustStarted = false;

// dragon perch / fly-out state
let g_dragonPerched = false;
let g_dragonFlyOutActive = false;
let g_dragonFlyOutTime = 0;
const DRAGON_FLY_OUT_DURATION = 3000; // ms
let g_dragonFlyOutStartPos = null;

// Automatic perch timing
let g_dragonAutoPerchEnabled = true;
let g_dragonTimeSinceLastUnperch = 0;  // ms since last unperch
let g_dragonTimeSincePerched = 0;  // ms since perched
let g_dragonNextPerchInterval = 0;  // random interval until next perch (ms)
let g_dragonPerchDuration = 0;  // random duration to stay perched (ms)

// Dragon death animation state
let g_dragonDeathActive = false;
let g_dragonDeathTime = 0;
let g_dragonDead = false;
let g_dragonDeathAlpha = 1.0;  // Current alpha for fade effect
let g_dragonDeathScale = 1.0;  // Current scale for grow effect
const DRAGON_DEATH_DURATION = 2000; // ms - 2 seconds for death animation

// Where to return when unperching (original orbit center)
const DRAGON_ORBIT_POS = new Vector3([
    DRAGON_PRESET.translate[0],
    DRAGON_PRESET.translate[1],
    DRAGON_PRESET.translate[2]
]);

// track last stable yaw so we don’t jitter when very close to target
let g_lastDragonYawDeg = 0;

// dragon faced 180 degrees wrong for awhile
const DRAGON_FACING_YAW_OFFSET_DEG = 180;

function createDragonBaseMatrix() {
    const p = DRAGON_PRESET;
    return buildDragonMatrixAtPosition(
        [p.translate[0], p.translate[1], p.translate[2]],
        p.rotateY || 0
    );
}


function buildDragonMatrixAtPosition(posVec3, yawDeg) {
    const m = new Matrix4();
    m.translate(posVec3[0], posVec3[1], posVec3[2]);
    m.rotate(yawDeg + DRAGON_FACING_YAW_OFFSET_DEG, 0, 1, 0);
    m.scale(DRAGON_PRESET.scale, DRAGON_PRESET.scale, DRAGON_PRESET.scale);
    return m;
}

// Build matrix with absolute world position (T * R * S order)
// This ensures elements[12:15] equals the input position directly,
// without being rotated by the yaw angle. Used for perch/unperch animations.
function buildDragonMatrixAtAbsolutePosition(posVec3, yawDeg) {
    const m = new Matrix4();
    // Start with scale
    m.setScale(DRAGON_PRESET.scale, DRAGON_PRESET.scale, DRAGON_PRESET.scale);
    // Left-multiply rotation: m = R * S
    m.rotate(yawDeg + DRAGON_FACING_YAW_OFFSET_DEG, 0, 1, 0);
    // Left-multiply translation: m = T * R * S
    m.translate(posVec3[0], posVec3[1], posVec3[2]);
    return m;
}


// wing functionality was taken from my old project and made to look more realistic with GPT to help for joint approximation 
function setupDragonSceneGraph(g_root, g_nodes, drawList, wingMeshData) {
    // Create dragon base with position and scale
    const dragonBase = new SceneNode({ name: "dragon_base" })
        .setLocal(createDragonBaseMatrix());
    g_nodes["dragon_base"] = dragonBase;
    g_root.add(dragonBase);

    // Calculate where the wing bases are in model space (closest point to centerline)
    const wingLBase = findWingBase(wingMeshData.wingL);
    const wingRBase = findWingBase(wingMeshData.wingR);

    console.log("Wing base positions:", wingLBase, wingRBase);

    // Create shoulder joint nodes at the wing base positions
    const shoulderL = new SceneNode({ name: "shoulder_L" });
    const shoulderR = new SceneNode({ name: "shoulder_R" });

    g_nodes["shoulder_L"] = shoulderL;
    g_nodes["shoulder_R"] = shoulderR;
    dragonBase.add(shoulderL);
    dragonBase.add(shoulderR);

    // Store shoulder positions for the updater
    g_nodes["shoulder_L_pos"] = wingLBase;
    g_nodes["shoulder_R_pos"] = wingRBase;

    // Add dragon parts to the appropriate parent nodes
    for (const m of drawList) {
        if (m.name === "dragon_body") {
            // Body attaches directly to dragon base
            const node = new SceneNode({
                name: m.name, range: { first: m.first, count: m.count }, mode: m.mode
            });
            g_nodes[m.name] = node;
            dragonBase.add(node);
        } else if (m.name === "dragon_wingL") {
            // Left wing attaches to left shoulder joint
            // Offset so wing base is at shoulder origin
            const node = new SceneNode({
                name: m.name, range: { first: m.first, count: m.count }, mode: m.mode
            });
            node.setLocal(new Matrix4().translate(-wingLBase[0], -wingLBase[1], -wingLBase[2]));
            g_nodes[m.name] = node;
            shoulderL.add(node);
        } else if (m.name === "dragon_wingR") {
            // Right wing attaches to right shoulder joint
            // Offset so wing base is at shoulder origin
            const node = new SceneNode({
                name: m.name, range: { first: m.first, count: m.count }, mode: m.mode
            });
            node.setLocal(new Matrix4().translate(-wingRBase[0], -wingRBase[1], -wingRBase[2]));
            g_nodes[m.name] = node;
            shoulderR.add(node);
        }
    }

    // Enable wing flapping animation - now rotates shoulder joints
    installBasicWingFlap(g_nodes, wingMeshData);
}

// Find the wing's base position (average of vertices closest to centerline)
// again as I said aided by GPT
function findWingBase(wingMesh) {
    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;
    let minAbsX = Infinity;

    // Find minimum absolute X (closest to centerline)
    for (let i = 0; i < wingMesh.length; i += 3) {
        const absX = Math.abs(wingMesh[i]);
        if (absX < minAbsX) minAbsX = absX;
    }

    // Average vertices close to that minimum
    const threshold = minAbsX + 0.05;
    for (let i = 0; i < wingMesh.length; i += 3) {
        const x = wingMesh[i];
        const y = wingMesh[i + 1];
        const z = wingMesh[i + 2];

        if (Math.abs(x) < threshold) {
            sumX += x;
            sumY += y;
            sumZ += z;
            count++;
        }
    }

    if (count > 0) {
        return [sumX / count, sumY / count, sumZ / count];
    }
    return [0, 0.3, 0];  // Fallback
}

function updateDragon(g_nodes, g_rotationAxis, deltaMS) {
    // dont orbit if perched
    if (g_dragonPerched) return;

    const dragonBase = g_nodes["dragon_base"];
    if (dragonBase && g_rotationAxis && deltaMS) {
        const angle = -ROTATION_SPEED * deltaMS;
        dragonBase.local.rotate(angle, ...g_rotationAxis);
    }
}


// flaps created with my old logic, cursor tab, and gpt
function installBasicWingFlap(g_nodes) {
    // Get the SHOULDER nodes, not the wing nodes
    // The shoulders are the rotation joints
    const shoulderL = g_nodes["shoulder_L"];
    const shoulderR = g_nodes["shoulder_R"];

    if (!shoulderL || !shoulderR) {
        console.warn("Shoulder nodes not found, skipping wing flap animation");
        return;
    }

    // Get the calculated shoulder positions
    const shoulderLPos = g_nodes["shoulder_L_pos"];
    const shoulderRPos = g_nodes["shoulder_R_pos"];

    // Animate the shoulder joints - they rotate, carrying the wings with them
    // The shoulder POSITION stays fixed at the wing base, only the ROTATION changes
    shoulderL.updater = (_, self) => {
        const t = Date.now();
        const angle = Math.sin(t * FLAP_SPEED) * FLAP_AMPL;
        // Create matrix: rotate around origin, THEN translate to shoulder position
        // This makes the wing rotate around the shoulder point
        const M = new Matrix4();
        M.setRotate(angle, 0, 0, 1);          // First rotate around Z-axis
        M.translate(shoulderLPos[0], shoulderLPos[1], shoulderLPos[2]);  // Then move to shoulder position
        self.setLocal(M);
    };

    shoulderR.updater = (_, self) => {
        const t = Date.now();
        const angle = -Math.sin(t * FLAP_SPEED) * FLAP_AMPL;
        // Create matrix: rotate around origin, THEN translate to shoulder position
        // This makes the wing rotate around the shoulder point
        const M = new Matrix4();
        M.setRotate(angle, 0, 0, 1);           // First rotate around Z-axis
        M.translate(shoulderRPos[0], shoulderRPos[1], shoulderRPos[2]);  // Then move to shoulder position
        self.setLocal(M);
    };
}


// not really fully functional logic as the body of the dragon does not always face the portal but oh well
// the logic to look at the center ie the atan stuff was a mix of me and gpt
function startDragonFlyIn() {
    const dragonBase = g_dragonNodes["dragon_base"];
    if (!dragonBase) return;

    // store starting
    g_dragonFlyStartPos = dragonBase.getPosition();

    // Compute initial yaw so we’re already facing the target from this spot
    const sx = g_dragonFlyStartPos.elements[0];
    const sz = g_dragonFlyStartPos.elements[2];

    const tx = DRAGON_TARGET_POS.elements[0];
    const tz = DRAGON_TARGET_POS.elements[2];

    const dx0 = tx - sx;
    const dz0 = tz - sz;

    if (dx0 !== 0 || dz0 !== 0) {
        const yawRad0 = Math.atan2(-dx0, -dz0);  // face toward target
        g_lastDragonYawDeg = yawRad0 * 180 / Math.PI;
    }

    g_dragonFlyInTime = 0;
    g_dragonFlyInActive = true;
    g_dragonFlyOutActive = false;
    g_dragonPerched = false;
    g_dragonFlyInJustStarted = true;
    
    // Reset automatic perch timing when manually triggered
    g_dragonTimeSinceLastUnperch = 0;
}


// the logic to look at the center ie the atan stuff was a mix of me and gpt
// so again used gpt and cursor tab for help
function updateDragonFlyIn(deltaMS) {
    const dragonBase = g_dragonNodes["dragon_base"];
    if (!dragonBase || !g_dragonFlyStartPos) return;

    const sx = g_dragonFlyStartPos.elements[0];
    const sy = g_dragonFlyStartPos.elements[1];
    const sz = g_dragonFlyStartPos.elements[2];

    // First frame of fly-in: don't move, just lock to the start position + yaw
    // Use buildDragonMatrixAtAbsolutePosition to preserve exact world position
    if (g_dragonFlyInJustStarted) {
        const m0 = buildDragonMatrixAtAbsolutePosition([sx, sy, sz], g_lastDragonYawDeg);
        dragonBase.setLocal(m0);
        g_dragonFlyInJustStarted = false;
        return;
    }

    g_dragonFlyInTime += deltaMS;
    let t = g_dragonFlyInTime / DRAGON_FLY_IN_DURATION;
    if (t >= 1) {
        t = 1;
        g_dragonFlyInActive = false;
        g_dragonPerched = true;
        // Reset perch timing when perch completes
        g_dragonTimeSincePerched = 0;
        // Generate random perch duration (10-20 seconds)
        g_dragonPerchDuration = 10000 + Math.random() * 10000; // 10-20 seconds in ms
    }

    const tx = DRAGON_TARGET_POS.elements[0];
    const ty = DRAGON_TARGET_POS.elements[1];
    const tz = DRAGON_TARGET_POS.elements[2];

    // Lerp position
    const x = sx + (tx - sx) * t;
    const y = sy + (ty - sy) * t;
    const z = sz + (tz - sz) * t;

    const pos = [x, y, z];

    // Compute forward direction
    const dx = tx - x;
    const dz = tz - z;
    const distSqXZ = dx * dx + dz * dz;

    let yawDeg;

    // If far enough from the target, compute actual yaw
    if (distSqXZ > 1e-4) {
        // Negative sign so dragon faces *toward* target
        const yawRad = Math.atan2(-dx, -dz);
        yawDeg = yawRad * 180 / Math.PI;
        g_lastDragonYawDeg = yawDeg;   // remember stable yaw
    } else {
        // Too close → keep previous yaw to avoid atan2(0,0) glitch
        // gpt generated
        yawDeg = g_lastDragonYawDeg;
    }

    // Build final model matrix using absolute position to avoid position jump
    const m = buildDragonMatrixAtAbsolutePosition(pos, yawDeg);
    dragonBase.setLocal(m);
}



function startDragonFlyOut() {
    // only flyout if perched
    if (!g_dragonPerched) return;

    const dragonBase = g_dragonNodes["dragon_base"];
    if (!dragonBase) return;

    g_dragonFlyOutStartPos = dragonBase.getPosition();
    g_dragonFlyOutTime = 0;
    g_dragonFlyOutActive = true;
    g_dragonPerched = false;
    
    // Reset automatic perch timing when unperch starts
    g_dragonTimeSinceLastUnperch = 0;
    // Generate random interval until next perch (60-120 seconds, centered around 90)
    g_dragonNextPerchInterval = 60000 + Math.random() * 60000; // 60-120 seconds in ms
}

// same as above me and gpt 
function updateDragonFlyOut(deltaMS) {
    const dragonBase = g_dragonNodes["dragon_base"];
    if (!dragonBase || !g_dragonFlyOutStartPos) return;

    g_dragonFlyOutTime += deltaMS;
    let t = g_dragonFlyOutTime / DRAGON_FLY_OUT_DURATION;
    if (t >= 1) {
        t = 1;
        g_dragonFlyOutActive = false;
    }

    const sx = g_dragonFlyOutStartPos.elements[0];
    const sy = g_dragonFlyOutStartPos.elements[1];
    const sz = g_dragonFlyOutStartPos.elements[2];

    const tx = DRAGON_ORBIT_POS.elements[0];
    const ty = DRAGON_ORBIT_POS.elements[1];
    const tz = DRAGON_ORBIT_POS.elements[2];

    const x = sx + (tx - sx) * t;
    const y = sy + (ty - sy) * t;
    const z = sz + (tz - sz) * t;

    let yawDeg;
    
    // When fly-out completes, compute tangent yaw for orbit direction
    if (t >= 1) {
        // Dragon is at orbit position, compute tangent direction for clockwise orbit
        // The dragon orbits around origin (0, 0), so at position (x, z):
        // - For clockwise rotation (negative angle), tangent direction is (z, -x)
        // - This is the direction the dragon moves along the orbit path
        // - Example: at [30, 0], tangent is [0, -30] (moving in -Z direction)
        const tangentX = z;   // tangent direction X component (for clockwise)
        const tangentZ = -x;  // tangent direction Z component (for clockwise)
        const tangentDistSq = tangentX * tangentX + tangentZ * tangentZ;
        
        if (tangentDistSq > 1e-4) {
            // Compute yaw to face in tangent direction
            // Use same convention as other yaw calculations: atan2(-dx, -dz)
            const yawRad = Math.atan2(-tangentX, -tangentZ);
            yawDeg = yawRad * 180 / Math.PI;
            // Add 180 degrees to fix backwards rotation
            yawDeg += 180;
            if (yawDeg >= 360) yawDeg -= 360;
            g_lastDragonYawDeg = yawDeg;
        } else {
            // At origin, use default orientation with 180 degree offset
            yawDeg = 180;
            g_lastDragonYawDeg = yawDeg;
        }
    } else {
        // During fly-out, face toward orbit destination
        const dx = tx - x;
        const dz = tz - z;
        const distSqXZ = dx * dx + dz * dz;

        if (distSqXZ > 1e-4) {
            const yawRad = Math.atan2(-dx, -dz);
            yawDeg = yawRad * 180 / Math.PI;
            g_lastDragonYawDeg = yawDeg;
        } else {
            yawDeg = g_lastDragonYawDeg;
        }
    }

    // Use absolute position matrix to avoid position jumps
    const m = buildDragonMatrixAtAbsolutePosition([x, y, z], yawDeg);
    dragonBase.setLocal(m);
}

// cursor tab was used for this function
function startDragonDeath() {
    // Only kill dragon if it's perched
    if (!g_dragonPerched) {
        console.log("Dragon must be perched to kill it!");
        return;
    }
    
    // Don't start if already dead or dying
    if (g_dragonDead || g_dragonDeathActive) {
        return;
    }
    
    console.log("Starting dragon death animation...");
    g_dragonDeathActive = true;
    g_dragonDeathTime = 0;
    g_dragonDeathAlpha = 1.0;
    g_dragonDeathScale = 1.0;
    
    // Stop other animations
    g_dragonFlyInActive = false;
    g_dragonFlyOutActive = false;
}

// cursor tab was used for this function
function updateDragonDeath(deltaMS) {
    if (!g_dragonDeathActive) return;
    
    const dragonBase = g_dragonNodes["dragon_base"];
    if (!dragonBase) return;
    
    g_dragonDeathTime += deltaMS;
    let t = g_dragonDeathTime / DRAGON_DEATH_DURATION;
    
    if (t >= 1) {
        t = 1;
        g_dragonDeathActive = false;
        g_dragonDead = true;
        g_dragonPerched = false;
        console.log("Dragon has been slain! Portal is now open.");
    }
    
    // Ease-out curve for smoother animation
    const easeOut = 1 - Math.pow(1 - t, 2);
    
    // Scale from 1x to 3x
    g_dragonDeathScale = 1.0 + easeOut * 2.0;
    
    // Fade from 1.0 to 0.0
    g_dragonDeathAlpha = 1.0 - easeOut;
    
    // Update dragon position with new scale
    const pos = DRAGON_TARGET_POS.elements;
    const m = new Matrix4();
    m.translate(pos[0], pos[1], pos[2]);
    m.rotate(g_lastDragonYawDeg + DRAGON_FACING_YAW_OFFSET_DEG, 0, 1, 0);
    m.scale(
        DRAGON_PRESET.scale * g_dragonDeathScale,
        DRAGON_PRESET.scale * g_dragonDeathScale,
        DRAGON_PRESET.scale * g_dragonDeathScale
    );
    
    dragonBase.setLocal(m);
}

// cursor tab was used for this function
function updateDragonAutoPerch(deltaMS) {
    // Don't auto-perch if dead, dying, or if auto-perch is disabled
    if (g_dragonDead || g_dragonDeathActive || !g_dragonAutoPerchEnabled) {
        return;
    }
    
    // If dragon is in a fly animation, don't update timing
    if (g_dragonFlyInActive || g_dragonFlyOutActive) {
        return;
    }
    
    // If dragon is perched, check if it's time to unperch
    if (g_dragonPerched) {
        g_dragonTimeSincePerched += deltaMS;
        if (g_dragonTimeSincePerched >= g_dragonPerchDuration) {
            // Time to automatically unperch
            startDragonFlyOut();
        }
    } else {
        // Dragon is orbiting, check if it's time to perch
        g_dragonTimeSinceLastUnperch += deltaMS;
        if (g_dragonTimeSinceLastUnperch >= g_dragonNextPerchInterval) {
            // Time to automatically perch
            startDragonFlyIn();
        }
    }
}

/**
 * Initialize automatic perch timing with random intervals
 */
function initDragonAutoPerch() {
    // Generate random interval until first perch (60-120 seconds)
    g_dragonNextPerchInterval = 60000 + Math.random() * 60000; // 60-120 seconds in ms
    g_dragonTimeSinceLastUnperch = 0;
    g_dragonTimeSincePerched = 0;
    g_dragonPerchDuration = 0;
}

/**
 * Respawn the dragon - removes portal fill and puts dragon back in orbit
 */
function respawnDragon() {
    // Only respawn if dragon is actually dead
    if (!g_dragonDead) {
        return;
    }
    
    console.log("Respawning dragon...");
    
    // Reset death state
    g_dragonDead = false;
    g_dragonDeathActive = false;
    g_dragonDeathAlpha = 1.0;
    g_dragonDeathScale = 1.0;
    g_dragonPerched = false;
    
    // Stop any active animations
    g_dragonFlyInActive = false;
    g_dragonFlyOutActive = false;
    
    // Reset dragon position to orbit position
    const dragonBase = g_dragonNodes["dragon_base"];
    if (dragonBase) {
        const orbitPos = DRAGON_ORBIT_POS.elements;
        // Use the same initial yaw as the dragon starts with, plus 180 degrees to fix backwards rotation
        // This matches createDragonBaseMatrix which uses DRAGON_PRESET.rotateY || 0
        const initialYaw = (DRAGON_PRESET.rotateY || 0) + 180;
        
        // Reset to initial orbit state - dragon will naturally orient as it orbits
        g_lastDragonYawDeg = initialYaw;
        
        // Set dragon to orbit position with initial orientation
        const m = buildDragonMatrixAtAbsolutePosition([orbitPos[0], orbitPos[1], orbitPos[2]], initialYaw);
        dragonBase.setLocal(m);
    }
    
    // Reset automatic perch timing
    initDragonAutoPerch();
    
    console.log("Dragon respawned and back in orbit!");
}

